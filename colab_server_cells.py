# =============================================================================
# COLAB SERVER CELL 7 - Copy this into your notebook (replace existing Cell 7)
# =============================================================================
# This version adds progress polling support for the ChatCut UXP plugin.
# UXP doesn't support SSE streaming, so we use a polling approach instead.
# =============================================================================

"""
#@title 7. START SERVER (with Progress Polling)
# GET YOUR TOKEN: https://ngrok.com -> sign up -> Your Authtoken
# Kill any existing ngrok tunnels
try:
    from pyngrok import ngrok
    ngrok.kill()
except:
    pass
NGROK_TOKEN = "YOUR_TOKEN_HERE"  # <-- PASTE YOUR TOKEN

#============================================================
from pyngrok import ngrok
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import threading
import json as json_lib
import uuid
import shutil

if NGROK_TOKEN == "YOUR_TOKEN_HERE":
    raise ValueError("Paste your ngrok token above! Get it free at https://ngrok.com")

ngrok.set_auth_token(NGROK_TOKEN)

app = FastAPI(title="ChatCut")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Store completed files for download
completed_files = {}

# Job progress storage - key: job_id, value: progress dict
job_progress = {}

@app.get("/health")
def health():
    return {"status": "ok", "gpu": DEVICE}

@app.get("/effects")
def effects():
    return {"effects": list(RENDERERS.keys())}

def update_progress(job_id, stage, progress, message, **extra):
    '''Update progress for a job.'''
    job_progress[job_id] = {
        "status": "processing" if stage not in ["complete", "error"] else stage,
        "stage": stage,
        "progress": progress,
        "message": message,
        **extra
    }
    print(f"[Job {job_id}] {stage}: {progress}% - {message}")

def process_job(job_id, file_path, filename, prompt):
    '''Background job to process video - updates job_progress as it runs.'''
    try:
        update_progress(job_id, "tracking", 0, "Starting object tracking...")
        global tracks_df_cached
        tracks_df_cached = None

        # Get video info
        cap = cv2.VideoCapture(file_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        w, h = int(cap.get(3)), int(cap.get(4))
        duration = total_frames / fps if fps else 0
        cap.release()

        # Run tracking with progress updates
        model = load_model(use_seg=True)
        name_map = _build_name_map(model)

        stream = model.track(source=file_path, imgsz=960, tracker='bytetrack.yaml', stream=True,
                            conf=0.25, iou=0.45, vid_stride=1, device=DEVICE, verbose=False, persist=True)

        frames_data = []
        cursor = 0
        last_progress = -1

        for result in stream:
            dets = []
            if result.boxes is not None and result.boxes.id is not None:
                ids = result.boxes.id.int().cpu().tolist()
                xyxy = result.boxes.xyxy.cpu().tolist()
                confs = result.boxes.conf.cpu().tolist()
                clss = result.boxes.cls.int().cpu().tolist()
                masks = result.masks.data.cpu().numpy() if result.masks else None
                for i, tid in enumerate(ids):
                    dets.append({'id': int(tid), 'cls': name_map.get(clss[i], str(clss[i])),
                                'conf': float(confs[i]), 'bbox_xyxy': [float(v) for v in xyxy[i]],
                                'mask_rle': encode_mask(masks[i]) if masks is not None else None})
            frames_data.append({'frame_index': cursor, 't': cursor/fps, 'detections': dets})
            cursor += 1

            # Update progress every 5%
            track_progress = int((cursor / total_frames) * 60) if total_frames > 0 else 0  # 0-60%
            if track_progress >= last_progress + 5:
                last_progress = track_progress
                update_progress(job_id, "tracking", track_progress,
                              f"Tracking frame {cursor}/{total_frames}...")

        # Build tracks dict
        tracks = {
            'video_path': file_path,
            'fps': fps,
            'size': [w, h],
            'duration': duration,
            'frames': frames_data
        }

        update_progress(job_id, "tracking", 60, f"Tracked {len(frames_data)} frames")

        # Parse command
        update_progress(job_id, "parsing", 65, "Parsing command...")
        cmds = parse_nl_to_dsl(prompt, tracks['duration'])
        cmd = cmds[0]
        update_progress(job_id, "parsing", 70, f"{cmd.effect} on '{cmd.object}'")

        # Plan keyframes
        update_progress(job_id, "planning", 75, "Planning keyframes...")
        plan = plan_effect(cmd, tracks)
        update_progress(job_id, "planning", 80, f"Planned {len(plan['timeline'])} keyframes")

        # Render
        update_progress(job_id, "rendering", 85, "Starting render...")

        out_name = f"processed_{filename}"
        out_path = EXPORT_DIR / out_name

        # Run renderer
        clip = VideoFileClip(plan['video_path'])
        sampler = timeline_sampler(plan['timeline'])
        W, H = plan['frame_size']
        effect_name = plan['effect']

        # Get transform function
        if effect_name == 'ZoomFollow':
            def transform(f, s, shape):
                cx, cy = s['center']
                sc = np.clip(s['scale'], 0.2, 1.0)
                cw, ch = max(W*sc, 64), max(H*sc, 64)
                x1 = int(np.clip(cx - cw/2, 0, W - cw))
                y1 = int(np.clip(cy - ch/2, 0, H - ch))
                return cv2.resize(f[y1:y1+int(ch), x1:x1+int(cw)], (W, H), interpolation=cv2.INTER_CUBIC)
        elif effect_name == 'Spotlight':
            strength = plan['params'].get('strength', 0.7)
            feather = plan['params'].get('feather', 45)
            def transform(f, s, shape):
                m = ensure_mask(s, shape, feather)
                return (f * m + f * (1-strength) * (1-m)).astype(np.uint8)
        elif effect_name == 'BlurBackground':
            k = plan['params'].get('ksize', 21)
            k = k if k % 2 else k + 1
            def transform(f, s, shape):
                m = ensure_mask(s, shape, 25)
                return (f * m + cv2.GaussianBlur(f, (k,k), 0) * (1-m)).astype(np.uint8)
        else:
            def transform(f, s, shape):
                return f

        def proc(get_frame, t):
            frame = get_frame(t)
            if t < plan['t_in'] or t > plan['t_out']:
                return frame
            return transform(frame, sampler(t), (H, W))

        update_progress(job_id, "rendering", 90, "Rendering video...")

        # Force Premiere-friendly output: CFR, fixed GOP, no B-pyramid, 48k audio, faststart, stable timebase.
        target_fps = clip.fps or fps or 30
        gop_size = max(1, int(round(target_fps)))
        ffmpeg_params = [
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
            "-level", "4.1",
            "-g", str(gop_size),
            "-keyint_min", str(gop_size),
            "-bf", "0",
            "-sc_threshold", "0",
            "-vsync", "cfr",
            "-video_track_timescale", "90000",
            "-movflags", "+faststart",
            "-fflags", "+genpts",
            "-ar", "48000",
        ]

        clip.fl(proc).write_videofile(
            str(out_path),
            codec="libx264",
            audio=True,
            audio_codec="aac",
            audio_fps=48000,
            audio_bitrate="192k",
            fps=target_fps,
            ffmpeg_params=ffmpeg_params,
            logger=None,
        )
        clip.close()

        # Store for download
        completed_files[out_name] = str(out_path)

        # Mark complete
        update_progress(job_id, "complete", 100, "Processing complete!",
                       file_ready=True,
                       filename=out_name,
                       output_path=str(out_path),
                       download_url=f"/download/{out_name}")

    except Exception as e:
        print(f"Job {job_id} error: {e}")
        traceback.print_exc()
        update_progress(job_id, "error", 0, f"Error: {str(e)}", error=str(e))
    finally:
        # Clean up temp file
        if os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except:
                pass

@app.post("/start-job")
async def start_job(file: UploadFile = File(...), prompt: str = Form(...)):
    '''Start a video processing job - returns job_id immediately.

    Poll /progress/{job_id} to track progress.
    When complete, download from /download/{filename}.
    '''
    # Generate unique job ID
    job_id = str(uuid.uuid4())[:8]

    # Save uploaded file
    tmp_dir = tempfile.mkdtemp()
    file_path = os.path.join(tmp_dir, file.filename)

    with open(file_path, 'wb') as f:
        content = await file.read()
        f.write(content)

    print(f"[Job {job_id}] Started: {file.filename}")
    print(f"[Job {job_id}] Prompt: {prompt}")

    # Initialize progress
    update_progress(job_id, "upload", 5, f"Received {file.filename}")

    # Start background processing
    thread = threading.Thread(
        target=process_job,
        args=(job_id, file_path, file.filename, prompt),
        daemon=True
    )
    thread.start()

    return {
        "job_id": job_id,
        "status": "started",
        "message": f"Processing started for {file.filename}"
    }

@app.get("/progress/{job_id}")
def get_progress(job_id: str):
    '''Get progress for a job.

    Returns:
        {
            "status": "processing" | "complete" | "error" | "not_found",
            "stage": "upload" | "tracking" | "parsing" | "planning" | "rendering" | "complete" | "error",
            "progress": 0-100,
            "message": "Human readable message",
            // On complete:
            "file_ready": true,
            "filename": "processed_video.mp4",
            "output_path": "/content/exports/processed_video.mp4",
            "download_url": "/download/processed_video.mp4"
        }
    '''
    if job_id not in job_progress:
        return {"status": "not_found", "error": f"Job {job_id} not found"}

    return job_progress[job_id]

@app.get("/download/{filename}")
async def download(filename: str):
    '''Download a processed video file.'''
    if filename not in completed_files:
        raise HTTPException(404, f"File not found: {filename}")

    path = completed_files[filename]
    if not os.path.exists(path):
        raise HTTPException(404, f"File no longer exists: {filename}")

    return FileResponse(str(path), filename=filename, media_type="video/mp4")

# Keep old /process endpoint for backwards compatibility
@app.post("/process")
async def process(file: UploadFile = File(...), prompt: str = Form(...)):
    tmp = None
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1] or '.mp4')
        tmp.write(await file.read())
        tmp.close()
        print(f"Received: {file.filename}")
        print(f"Prompt: {prompt}")

        print("Tracking...")
        global tracks_df_cached
        tracks_df_cached = None
        tracks = detect_and_track(tmp.name, use_seg=True, frame_stride=1)
        print(f"Tracked {len(tracks['frames'])} frames, {tracks['duration']:.1f}s")

        print("Parsing...")
        cmds = parse_nl_to_dsl(prompt, tracks['duration'])
        cmd = cmds[0]
        print(f"{cmd.effect} on '{cmd.object}' [{cmd.t_in:.1f}s-{cmd.t_out:.1f}s]")

        print("Planning...")
        plan = plan_effect(cmd, tracks)

        print("Rendering...")
        out_name = f"processed_{file.filename}"
        out_path = EXPORT_DIR / out_name
        RENDERERS[plan['effect']](plan, out_path)
        print(f"Done: {out_path}")

        return FileResponse(str(out_path), filename=out_name, media_type="video/mp4")

    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        raise HTTPException(500, str(e))
    finally:
        if tmp and os.path.exists(tmp.name): os.unlink(tmp.name)

# Start server in background thread
def run_server():
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")

print("Starting server...")
thread = threading.Thread(target=run_server, daemon=True)
thread.start()

import time
time.sleep(2)

url = ngrok.connect(8000)
print("")
print("=" * 50)
print("SERVER READY (with Progress Polling)")
print("=" * 50)
print(f"")
print(f"Copy this URL into ChatCut:")
print(f"")
print(f"   {url}")
print(f"")
print("=" * 50)
print("")
print("Endpoints:")
print("  POST /start-job       - Start processing (returns job_id)")
print("  GET  /progress/{id}   - Poll progress (0-100%)")
print("  GET  /download/{file} - Download processed video")
print("  POST /process         - Original sync endpoint")
print("  GET  /health          - Health check")
print("")
print("Server running in background!")
print("   To stop: Runtime -> Restart runtime")
"""
