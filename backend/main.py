from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import uvicorn
import os
import json
from pathlib import Path

from models.schemas import (
    ProcessPromptRequest,
    ProcessPromptResponse,
    ProcessMediaRequest,
    ProcessMediaResponse,
    ColabProcessRequest,
    ColabProcessResponse,
    ColabStartRequest
)
import subprocess
import requests
from services.ai_service import process_prompt

from services.providers.video_provider import process_media

# Load environment variables
load_dotenv()

app = FastAPI(title="ChatCut Backend", version="0.1.0")

# Enable CORS for the UXP frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple ping endpoint to test connection
@app.post("/api/ping")
async def ping(request: dict):
    """Simple ping endpoint to verify connection between frontend and backend"""
    message = request.get("message", "")
    print(f"[Ping] Received message: {message}")
    return {
        "status": "ok",
        "received": message
    }


@app.post("/api/process-prompt", response_model=ProcessPromptResponse)
async def process_user_prompt(request: ProcessPromptRequest):
    """
    Process user prompt through AI and return structured action with parameters.
    
    Example:
        Request: {"prompt": "zoom in by 120%"}
        Response: {
            "action": "zoomIn",
            "parameters": {"endScale": 120, "animated": false},
            "confidence": 1.0,
            "message": "Zooming in to 120%"
        }
    """
    print(f"[AI] Processing prompt: {request.prompt}")
    if request.context_params:
        print(f"[AI] Context parameters: {len(request.context_params)} items")
        
    result = process_prompt(request.prompt, request.context_params)
    print(f"[AI] Result: {result}")
    return ProcessPromptResponse(**result)


@app.post("/api/process-media", response_model=ProcessMediaResponse)
async def process_media_files(request: ProcessMediaRequest):
    """Process a single media file with AI. Validates file access and processes prompt."""
    print(f"[Media] Processing file: {request.prompt}")
    
    # Validate file access
    file_path = request.filePath
    try:
        if not Path(file_path).exists():
            return ProcessMediaResponse(
                action=None,
                message=f"File not found: {file_path}",
                error="FILE_NOT_FOUND"
            )
        
        if not os.access(file_path, os.R_OK):
            return ProcessMediaResponse(
                action=None,
                message=f"Cannot read file: {file_path}",
                error="FILE_ACCESS_ERROR"
            )
        
        print(f"  ✓ {Path(file_path).name}")
        
    except Exception as e:
        print(f"  ✗ {file_path}: {e}")
        return ProcessMediaResponse(
            action=None,
            message=f"Error accessing file: {str(e)}",
            error="FILE_ACCESS_ERROR"
        )
    
    # Process media with video provider
    ai_result = process_media(request.prompt, file_path)
    print(f"[Media] Result: action={ai_result.get('action')}")
    
    return ProcessMediaResponse(**ai_result)


@app.get("/health")
async def health():
    """Health check endpoint"""
    from services.ai_service import get_provider_info
    provider_info = get_provider_info()
    return {
        "status": "ok",
        "ai_provider": provider_info
    }


@app.post("/api/colab-health")
async def check_colab_health(request: dict):
    """Proxy health check to Colab server (avoids CORS/UXP restrictions)."""
    colab_url = request.get("colab_url", "").rstrip('/')

    if not colab_url:
        return {"healthy": False, "error": "No URL provided"}

    try:
        response = requests.get(f"{colab_url}/health", timeout=10)
        if response.status_code == 200:
            return {"healthy": True, "data": response.json()}
        return {"healthy": False, "status": response.status_code}
    except requests.exceptions.Timeout:
        return {"healthy": False, "error": "Timeout"}
    except Exception as e:
        return {"healthy": False, "error": str(e)}


def get_video_gop_size(video_path: str) -> int:
    """Get source video framerate and calculate GOP size (1 keyframe per second)."""
    try:
        result = subprocess.run([
            'ffprobe', '-v', 'quiet',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=r_frame_rate',
            '-of', 'csv=p=0',
            str(video_path)
        ], capture_output=True, text=True)
        r_frame = result.stdout.strip()
        if '/' in r_frame:
            num, den = map(int, r_frame.split('/'))
            fps = num / den if den else 30.0
        else:
            fps = float(r_frame) if r_frame else 30.0
        return int(round(fps))  # 1 keyframe per second
    except Exception:
        return 30


def trim_video_ffmpeg(input_path: str, start_sec: float, end_sec: float) -> str:
    """
    Trim video using FFmpeg with re-encoding to ensure proper keyframes.
    Reads source FPS to calculate matching GOP size.

    Args:
        input_path: Path to source video file
        start_sec: Start time in seconds (from source)
        end_sec: End time in seconds (from source)

    Returns:
        Path to trimmed video file

    Raises:
        Exception if FFmpeg fails
    """
    output_dir = Path(__file__).parent / "output" / "trimmed"
    output_dir.mkdir(exist_ok=True, parents=True)

    # Create unique filename with timestamps
    input_stem = Path(input_path).stem
    output_path = output_dir / f"{input_stem}_{start_sec:.2f}_{end_sec:.2f}.mp4"

    # Skip if already trimmed (cache)
    if output_path.exists():
        print(f"[Trim] Using cached: {output_path}")
        return str(output_path)

    duration = end_sec - start_sec
    gop_size = get_video_gop_size(input_path)
    target_fps = gop_size or 30

    print(f"[Trim] Trimming {input_path}")
    print(f"[Trim] From {start_sec:.2f}s to {end_sec:.2f}s ({duration:.2f}s)")
    print(f"[Trim] GOP size: {gop_size} (matching source FPS)")

    # FFmpeg re-encode with Premiere-friendly settings: CFR, fixed GOP, no B-pyramid, 48 kHz audio, faststart
    result = subprocess.run([
        'ffmpeg', '-y',
        '-hide_banner', '-loglevel', 'error',
        '-ss', str(start_sec),
        '-i', input_path,
        '-t', str(duration),
        '-r', str(target_fps),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'high',
        '-level', '4.1',
        '-g', str(gop_size),
        '-keyint_min', str(gop_size),
        '-sc_threshold', '0',
        '-bf', '0',
        '-vsync', 'cfr',
        '-video_track_timescale', '90000',
        '-movflags', '+faststart',
        '-fflags', '+genpts',
        '-c:a', 'aac',
        '-ar', '48000',
        '-b:a', '192k',
        '-af', 'aresample=async=1:first_pts=0',
        '-map', '0:v:0',
        '-map', '0:a:0?',
        str(output_path)
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print(f"[Trim] FFmpeg error: {result.stderr}")
        raise Exception(f"FFmpeg trim failed: {result.stderr[:500]}")

    output_size = output_path.stat().st_size / 1024 / 1024
    print(f"[Trim] Created: {output_path} ({output_size:.2f} MB)")
    return str(output_path)


@app.post("/api/colab-start")
async def start_colab_job(request: ColabStartRequest):
    """
    Start a Colab processing job and return job_id for progress polling.

    The frontend can then poll /api/colab-progress to track progress.
    When complete, downloads the processed video and returns local path.

    If trim_start and trim_end are provided, the video is trimmed locally
    before uploading to Colab (prevents uploading full source files).
    """
    print(f"[Colab Start] Starting job:")
    print(f"  File: {request.file_path}")
    print(f"  Prompt: {request.prompt}")
    print(f"  Colab URL: {request.colab_url}")
    if request.trim_start is not None and request.trim_end is not None:
        print(f"  Trim: {request.trim_start:.2f}s - {request.trim_end:.2f}s")

    # Validate file exists
    file_path = Path(request.file_path)
    if not file_path.exists():
        return {"error": "FILE_NOT_FOUND", "message": f"File not found: {request.file_path}"}

    if not os.access(request.file_path, os.R_OK):
        return {"error": "FILE_ACCESS_ERROR", "message": f"Cannot read file: {request.file_path}"}

    # Trim video if trim info provided (prevents uploading full source files)
    upload_path = request.file_path
    if request.trim_start is not None and request.trim_end is not None:
        try:
            print(f"[Colab Start] Trimming video before upload...")
            upload_path = trim_video_ffmpeg(
                request.file_path,
                request.trim_start,
                request.trim_end
            )
            print(f"[Colab Start] Using trimmed file: {upload_path}")
        except Exception as e:
            print(f"[Colab Start] Trim failed: {e}")
            return {"error": "TRIM_ERROR", "message": f"Failed to trim video: {str(e)}"}

    upload_file = Path(upload_path)

    # Normalize Colab URL
    colab_url = request.colab_url.rstrip('/')

    # Check Colab health first
    try:
        health_response = requests.get(f"{colab_url}/health", timeout=10)
        if health_response.status_code != 200:
            return {"error": "COLAB_SERVER_ERROR", "message": f"Colab server not healthy: {health_response.status_code}"}
    except requests.exceptions.RequestException as e:
        return {"error": "COLAB_CONNECTION_ERROR", "message": f"Cannot connect to Colab server: {str(e)}"}

    # Upload file to Colab's /start-job endpoint
    try:
        upload_size = upload_file.stat().st_size / 1024 / 1024
        print(f"[Colab Start] Uploading {upload_file.name} ({upload_size:.2f} MB)...")

        with open(upload_file, 'rb') as f:
            files = {'file': (upload_file.name, f, 'video/mp4')}
            data = {'prompt': request.prompt}

            response = requests.post(
                f"{colab_url}/start-job",
                files=files,
                data=data,
                timeout=120  # 2 minute timeout for upload
            )

        if response.status_code != 200:
            error_detail = response.text[:500] if response.text else "Unknown error"
            return {"error": "COLAB_START_ERROR", "message": f"Failed to start job: {error_detail}"}

        result = response.json()
        print(f"[Colab Start] Job started: {result}")

        # Return job info including the colab_url for progress polling
        return {
            "job_id": result.get("job_id"),
            "status": result.get("status"),
            "message": result.get("message"),
            "colab_url": colab_url  # Include so frontend can poll progress
        }

    except requests.exceptions.Timeout:
        return {"error": "COLAB_TIMEOUT", "message": "Upload timed out (>2 minutes)"}
    except requests.exceptions.RequestException as e:
        return {"error": "COLAB_REQUEST_ERROR", "message": f"Error communicating with Colab: {str(e)}"}
    except Exception as e:
        return {"error": "UNEXPECTED_ERROR", "message": f"Unexpected error: {str(e)}"}


@app.post("/api/colab-progress")
async def get_colab_progress(request: dict):
    """
    Get progress for a Colab job.

    Request: { "job_id": "abc123", "colab_url": "https://xxx.ngrok.io" }

    Returns progress dict from Colab, or downloads file if complete.
    """
    job_id = request.get("job_id")
    colab_url = request.get("colab_url", "").rstrip('/')

    if not job_id:
        return {"error": "No job_id provided", "status": "error"}
    if not colab_url:
        return {"error": "No colab_url provided", "status": "error"}

    try:
        response = requests.get(f"{colab_url}/progress/{job_id}", timeout=10)

        if response.status_code != 200:
            return {"status": "error", "error": f"Progress check failed: {response.status_code}"}

        progress_data = response.json()
        print(f"[Colab Progress] Job {job_id}: {progress_data.get('stage')} {progress_data.get('progress')}%")

        # If job is complete, download the file
        if progress_data.get("status") == "complete" and progress_data.get("download_url"):
            download_url = progress_data["download_url"]
            filename = progress_data.get("filename", "processed_video.mp4")

            print(f"[Colab Progress] Downloading: {colab_url}{download_url}")

            try:
                download_response = requests.get(f"{colab_url}{download_url}", timeout=300)

                if download_response.status_code != 200:
                    return {
                        **progress_data,
                        "download_error": f"Failed to download: {download_response.status_code}"
                    }

                # Save locally
                output_dir = Path(__file__).parent / "output"
                output_dir.mkdir(exist_ok=True)

                # Use original filename stem for output
                original_stem = Path(request.get("original_filename", "video")).stem
                output_filename = f"colab_{original_stem}.mp4"
                output_path = output_dir / output_filename

                with open(output_path, 'wb') as f:
                    f.write(download_response.content)

                output_size = output_path.stat().st_size / 1024 / 1024
                print(f"[Colab Progress] Saved: {output_path} ({output_size:.2f} MB)")

                # Return progress with local output path
                return {
                    **progress_data,
                    "output_path": str(output_path.resolve()),
                    "local_filename": output_filename
                }

            except requests.exceptions.RequestException as e:
                return {
                    **progress_data,
                    "download_error": f"Download failed: {str(e)}"
                }

        return progress_data

    except requests.exceptions.Timeout:
        return {"status": "error", "error": "Progress check timed out"}
    except requests.exceptions.RequestException as e:
        return {"status": "error", "error": f"Error checking progress: {str(e)}"}
    except Exception as e:
        return {"status": "error", "error": f"Unexpected error: {str(e)}"}


@app.post("/api/colab-process", response_model=ColabProcessResponse)
async def process_with_colab(request: ColabProcessRequest):
    """
    Proxy endpoint to forward video processing requests to Colab.

    The user must have a Colab notebook running with the FastAPI server
    exposed via ngrok. The ngrok URL is provided in the request.

    Flow:
    1. Read video file from local path
    2. Upload to Colab via ngrok URL
    3. Colab processes (YOLO tracking + effect rendering)
    4. Download processed video and save locally
    5. Return local path for Premiere Pro to import
    """
    print(f"[Colab] Processing request:")
    print(f"  File: {request.file_path}")
    print(f"  Prompt: {request.prompt}")
    print(f"  Effect: {request.effect_type or 'auto-detect'}")
    print(f"  Colab URL: {request.colab_url}")

    # Validate file exists
    file_path = Path(request.file_path)
    if not file_path.exists():
        return ColabProcessResponse(
            message=f"File not found: {request.file_path}",
            error="FILE_NOT_FOUND"
        )

    if not os.access(request.file_path, os.R_OK):
        return ColabProcessResponse(
            message=f"Cannot read file: {request.file_path}",
            error="FILE_ACCESS_ERROR"
        )

    # Normalize Colab URL (remove trailing slash)
    colab_url = request.colab_url.rstrip('/')

    # Check if Colab server is reachable
    try:
        health_response = requests.get(f"{colab_url}/health", timeout=10)
        if health_response.status_code != 200:
            return ColabProcessResponse(
                message=f"Colab server not healthy: {health_response.status_code}",
                error="COLAB_SERVER_ERROR"
            )
        print(f"  Colab health: {health_response.json()}")
    except requests.exceptions.RequestException as e:
        return ColabProcessResponse(
            message=f"Cannot connect to Colab server: {str(e)}",
            error="COLAB_CONNECTION_ERROR"
        )

    # Upload file to Colab for processing
    try:
        print(f"[Colab] Uploading {file_path.name}...")

        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, 'video/mp4')}
            data = {
                'prompt': request.prompt,
            }
            if request.effect_type:
                data['effect_type'] = request.effect_type

            response = requests.post(
                f"{colab_url}/process",
                files=files,
                data=data,
                timeout=600  # 10 minute timeout for processing
            )

        if response.status_code != 200:
            error_detail = response.text[:500] if response.text else "Unknown error"
            return ColabProcessResponse(
                message=f"Colab processing failed: {error_detail}",
                error="COLAB_PROCESSING_ERROR"
            )

        # Save the returned video locally
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)

        output_filename = f"colab_{file_path.stem}.mp4"
        output_path = output_dir / output_filename

        with open(output_path, 'wb') as f:
            f.write(response.content)

        output_size = output_path.stat().st_size / 1024 / 1024
        print(f"[Colab] Saved processed video: {output_path} ({output_size:.2f} MB)")

        return ColabProcessResponse(
            message=f"Successfully processed video with Colab",
            original_path=str(file_path.resolve()),
            output_path=str(output_path.resolve())
        )

    except requests.exceptions.Timeout:
        return ColabProcessResponse(
            message="Colab processing timed out (>10 minutes)",
            error="COLAB_TIMEOUT"
        )
    except requests.exceptions.RequestException as e:
        return ColabProcessResponse(
            message=f"Error communicating with Colab: {str(e)}",
            error="COLAB_REQUEST_ERROR"
        )
    except Exception as e:
        return ColabProcessResponse(
            message=f"Unexpected error: {str(e)}",
            error="UNEXPECTED_ERROR"
        )


@app.post("/api/colab-process-stream")
async def process_with_colab_stream(request: ColabProcessRequest):
    """
    SSE streaming endpoint for Colab video processing.

    Proxies progress events from Colab to the frontend as Server-Sent Events.
    On completion, downloads the processed video and returns the local path.

    Events streamed:
        - upload: Receiving/uploading video
        - tracking: YOLO object tracking progress
        - parsing: Command parsing
        - planning: Keyframe planning
        - rendering: Video rendering progress
        - complete: Processing complete with output_path
        - error: Processing error
    """
    print(f"[Colab SSE] Processing request:")
    print(f"  File: {request.file_path}")
    print(f"  Prompt: {request.prompt}")
    print(f"  Colab URL: {request.colab_url}")

    def sse_event(stage: str, progress: int, message: str, **extra) -> str:
        """Format a Server-Sent Event."""
        data = {"stage": stage, "progress": progress, "message": message, **extra}
        return f"data: {json.dumps(data)}\n\n"

    async def generate():
        # Validate file exists
        file_path = Path(request.file_path)
        if not file_path.exists():
            yield sse_event("error", 0, f"File not found: {request.file_path}", error="FILE_NOT_FOUND")
            return

        if not os.access(request.file_path, os.R_OK):
            yield sse_event("error", 0, f"Cannot read file: {request.file_path}", error="FILE_ACCESS_ERROR")
            return

        # Normalize Colab URL
        colab_url = request.colab_url.rstrip('/')

        # Check Colab health
        try:
            health_response = requests.get(f"{colab_url}/health", timeout=10)
            if health_response.status_code != 200:
                yield sse_event("error", 0, f"Colab server not healthy: {health_response.status_code}", error="COLAB_SERVER_ERROR")
                return
        except requests.exceptions.RequestException as e:
            yield sse_event("error", 0, f"Cannot connect to Colab server: {str(e)}", error="COLAB_CONNECTION_ERROR")
            return

        yield sse_event("upload", 0, "📤 Uploading video to Colab...")

        try:
            # Upload file to Colab's streaming endpoint
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.name, f, 'video/mp4')}
                data = {'prompt': request.prompt}
                if request.effect_type:
                    data['effect_type'] = request.effect_type

                # Use stream=True to get SSE response
                response = requests.post(
                    f"{colab_url}/process-stream",
                    files=files,
                    data=data,
                    stream=True,
                    timeout=600
                )

            if response.status_code != 200:
                yield sse_event("error", 0, f"Colab returned error: {response.status_code}", error="COLAB_ERROR")
                return

            # Process SSE events from Colab
            download_url = None
            filename = None

            for line in response.iter_lines():
                if not line:
                    continue

                line = line.decode('utf-8')
                if not line.startswith('data: '):
                    continue

                try:
                    event_data = json.loads(line[6:])  # Remove "data: " prefix

                    # Check for completion
                    if event_data.get('stage') == 'complete':
                        download_url = event_data.get('download_url')
                        filename = event_data.get('filename')
                        # Don't yield complete yet - we need to download first
                        yield sse_event("downloading", 0, "📥 Downloading processed video...")
                    elif event_data.get('stage') == 'error':
                        yield sse_event("error", 0, event_data.get('message', 'Unknown error'),
                                       error=event_data.get('error', 'COLAB_ERROR'))
                        return
                    else:
                        # Forward the event as-is
                        yield f"data: {json.dumps(event_data)}\n\n"

                except json.JSONDecodeError:
                    continue

            # Download the processed video
            if download_url and filename:
                try:
                    print(f"[Colab SSE] Downloading: {colab_url}{download_url}")
                    download_response = requests.get(f"{colab_url}{download_url}", timeout=300)

                    if download_response.status_code != 200:
                        yield sse_event("error", 0, f"Failed to download video: {download_response.status_code}",
                                       error="DOWNLOAD_ERROR")
                        return

                    # Save locally
                    output_dir = Path(__file__).parent / "output"
                    output_dir.mkdir(exist_ok=True)

                    output_filename = f"colab_{file_path.stem}.mp4"
                    output_path = output_dir / output_filename

                    with open(output_path, 'wb') as f:
                        f.write(download_response.content)

                    output_size = output_path.stat().st_size / 1024 / 1024
                    print(f"[Colab SSE] Saved: {output_path} ({output_size:.2f} MB)")

                    # Send final completion event with local paths
                    yield sse_event("complete", 100, "🎉 Processing complete!",
                                   file_ready=True,
                                   original_path=str(file_path.resolve()),
                                   output_path=str(output_path.resolve()))

                except requests.exceptions.RequestException as e:
                    yield sse_event("error", 0, f"Download failed: {str(e)}", error="DOWNLOAD_ERROR")
                    return
            else:
                yield sse_event("error", 0, "No download URL received from Colab", error="NO_DOWNLOAD_URL")

        except requests.exceptions.Timeout:
            yield sse_event("error", 0, "Colab processing timed out (>10 minutes)", error="TIMEOUT")
        except requests.exceptions.RequestException as e:
            yield sse_event("error", 0, f"Error communicating with Colab: {str(e)}", error="REQUEST_ERROR")
        except Exception as e:
            yield sse_event("error", 0, f"Unexpected error: {str(e)}", error="UNEXPECTED_ERROR")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    print("Starting ChatCut Backend on http://127.0.0.1:3001")
    uvicorn.run(app, host="127.0.0.1", port=3001)
