import requests
import os
import base64
import mimetypes
import time
from pathlib import Path

def process_media(prompt: str, file_path: str) -> dict:
    """
    Process a single video file with Runway ML
    
    Args:
        prompt: Text prompt describing the desired transformation
        file_path: Absolute path to the video file
        
    Returns:
        dict with action, message, error, output_path, and original_path
    """
    print(f"[Media] Processing: {prompt}")
    print(f"[Media] File: {file_path}")
    
    api_key = os.getenv("RUNWAY_API_KEY")
    if not api_key:
        return {
            "action": None,
            "message": "Runway API key not configured.",
            "error": "API_KEY_MISSING"
        }
    
    MAX_DATA_URI_SIZE = 16777216  # 16MB max as per Runway API docs
    path = file_path
    
    # Check if it's already a URL or data URI
    if path.startswith("https://") or path.startswith("data:video/"):
        video_uri = path
    else:
        # Convert local file to data URI
        try:
            if not os.path.exists(path):
                return {
                    "action": None,
                    "message": f"File not found: {path}",
                    "error": "FILE_NOT_FOUND"
                }
                
            # Check file size
            file_size = os.path.getsize(path)
            print(f"[Runway] File size: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)")
            
            # Data URI will be ~33% larger due to base64 encoding
            estimated_uri_size = int(file_size * 1.37)
            if estimated_uri_size > MAX_DATA_URI_SIZE:
                return {
                    "action": None,
                    "message": f"File too large: {file_size / 1024 / 1024:.2f} MB (max ~12MB for data URI)",
                    "error": "FILE_TOO_LARGE"
                }
            
            # Determine MIME type
            mime, _ = mimetypes.guess_type(path)
            if not mime or not mime.startswith("video/"):
                ext = os.path.splitext(path)[1].lower()
                mime = {
                    ".mp4": "video/mp4",
                    ".mov": "video/quicktime",
                    ".webm": "video/webm",
                    ".avi": "video/x-msvideo"
                }.get(ext, "video/mp4")
            
            # Encode to base64
            with open(path, "rb") as f:
                b64_data = base64.b64encode(f.read()).decode("ascii")
            
            video_uri = f"data:{mime};base64,{b64_data}"
            
            # Verify URI length
            uri_len = len(video_uri)
            print(f"[Runway] Data URI size: {uri_len} chars ({uri_len / 1024 / 1024:.2f} MB)")
            
            if uri_len > MAX_DATA_URI_SIZE:
                return {
                    "action": None,
                    "message": f"Encoded URI too large: {uri_len / 1024 / 1024:.2f} MB (max 16MB)",
                    "error": "URI_TOO_LARGE"
                }
                
        except Exception as e:
            return {
                "action": None,
                "message": f"Failed to encode file: {str(e)}",
                "error": "ENCODING_ERROR"
            }
    
    # Send to Runway API
    url = 'https://api.dev.runwayml.com/v1/video_to_video'
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06"
    }
    
    payload = {
        "model": "gen4_aleph",
        "videoUri": video_uri,
        "ratio": "1280:720",
        "promptText": prompt
    }
    
    try:
        print(f"[Runway] Sending request for: {os.path.basename(path) if not path.startswith('http') else path}")
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        
        if response.status_code != 200:
            print(f"  Status: {response.status_code}")
            print(f"  Error: {response.text}")
            return {
                "action": None,
                "message": f"Runway API error: {response.status_code}",
                "error": "API_ERROR",
                "details": response.text[:500]
            }
        
        # Parse response to get task ID
        task_data = response.json()
        task_id = task_data.get("id")
        
        if not task_id:
            return {
                "action": None,
                "message": "No task ID in response",
                "error": "NO_TASK_ID"
            }
            
        print(f"  Task created: {task_id}")
        print(f"  Status: {task_data.get('status', 'UNKNOWN')}")
        
        # Poll for completion
        max_polls = 60  # 10 minutes max (10s intervals)
        poll_interval = 10  # seconds
        task_url = f"https://api.dev.runwayml.com/v1/tasks/{task_id}"
        
        for attempt in range(max_polls):
            time.sleep(poll_interval)
            poll_response = requests.get(task_url, headers=headers, timeout=30)
            
            if poll_response.status_code != 200:
                print(f"  Poll attempt {attempt + 1}: Failed ({poll_response.status_code})")
                continue
            
            task_status = poll_response.json()
            status = task_status.get("status")
            print(f"  Poll attempt {attempt + 1}: {status}")
            
            if status == "SUCCEEDED":
                # Get output video URL
                output_url = task_status.get("output")
                if not output_url:
                    return {
                        "action": None,
                        "message": "No output URL in completed task",
                        "error": "NO_OUTPUT_URL"
                    }
                
                # Handle if output is a list (extract first URL)
                if isinstance(output_url, list):
                    if not output_url:
                        return {
                            "action": None,
                            "message": "Empty output URL list",
                            "error": "EMPTY_OUTPUT"
                        }
                    output_url = output_url[0]
                
                # Download the processed video
                print(f"  Downloading from: {output_url}")
                video_response = requests.get(output_url, timeout=300)
                
                if video_response.status_code != 200:
                    return {
                        "action": None,
                        "message": "Failed to download processed video",
                        "error": "DOWNLOAD_FAILED"
                    }
                
                # Save video to output directory
                output_dir = Path("output")
                output_dir.mkdir(exist_ok=True)
                
                original_name = Path(path).stem if not path.startswith("http") else "video"
                output_path = output_dir / f"{original_name}_runway_{task_id}.mp4"
                
                with open(output_path, "wb") as f:
                    f.write(video_response.content)
                
                # Convert to absolute path for frontend
                absolute_output_path = output_path.resolve()
                
                print(f"  ✓ Saved to: {absolute_output_path}")
                
                return {
                    "action": None,
                    "message": f"Successfully processed video. Saved to: {absolute_output_path}",
                    "error": None,
                    "original_path": path,
                    "output_path": str(absolute_output_path),
                    "task_id": task_id
                }
            
            elif status == "FAILED":
                error_msg = task_status.get("failure", {}).get("message", "Unknown error")
                print(f"  ✗ Task failed: {error_msg}")
                return {
                    "action": None,
                    "message": f"Task failed: {error_msg}",
                    "error": "TASK_FAILED"
                }
            
            elif status in ["PENDING", "RUNNING"]:
                # Continue polling
                continue
            else:
                # Unknown status
                print(f"  Unknown status: {status}")
        
        # Timeout (max_polls reached)
        print(f"  ✗ Timeout after {max_polls * poll_interval}s")
        return {
            "action": None,
            "message": f"Timeout waiting for task completion (waited {max_polls * poll_interval}s)",
            "error": "TIMEOUT"
        }
            
    except Exception as e:
        print(f"[Runway] Error: {e}")
        return {
            "action": None,
            "message": f"Error processing video: {str(e)}",
            "error": "PROCESSING_ERROR"
        }