"""
Colab Proxy Service - Handles communication with Colab server
Proxies requests from frontend to Colab server and manages file uploads/downloads
"""
import requests
import os
import mimetypes
from pathlib import Path
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


def _normalize_colab_url(colab_url: str) -> str:
    """Normalize Colab URL - ensure it has proper protocol and no trailing slash"""
    url = colab_url.strip()
    
    # ngrok-free.dev domains: Use HTTPS but disable SSL verification
    # (Browsers require HTTPS, and backend SSL verification causes issues)
    if 'ngrok-free.dev' in url or 'ngrok-free.app' in url:
        # Remove any existing protocol
        url = url.replace('https://', '').replace('http://', '')
        # Use HTTPS for ngrok-free domains (required by browsers, SSL verification disabled in requests)
        url = f"https://{url}"
    else:
        # Other domains use HTTPS
        if not url.startswith(('http://', 'https://')):
            url = f"https://{url}"
    
    return url.rstrip('/')


def start_colab_job(file_path: str, prompt: str, colab_url: str, trim_info: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """
    Start a Colab processing job by uploading video file and prompt.
    
    Args:
        file_path: Absolute path to the video file
        prompt: Natural language command describing the effect
        colab_url: ngrok URL of the Colab server
        trim_info: Optional dict with 'trim_start' and 'trim_end' (not yet supported by Colab server)
        
    Returns:
        dict with job_id, status, message, and optional error
    """
    try:
        # Validate file exists
        if not Path(file_path).exists():
            return {
                "job_id": None,
                "status": "error",
                "message": f"File not found: {file_path}",
                "error": "FILE_NOT_FOUND"
            }
        
        if not os.access(file_path, os.R_OK):
            return {
                "job_id": None,
                "status": "error",
                "message": f"Cannot read file: {file_path}",
                "error": "FILE_ACCESS_ERROR"
            }
        
        # Normalize Colab URL
        normalized_url = _normalize_colab_url(colab_url)
        start_job_url = f"{normalized_url}/start-job"
        
        logger.info(f"[Colab] Starting job: {Path(file_path).name}")
        logger.info(f"[Colab] Prompt: {prompt}")
        logger.info(f"[Colab] Colab URL: {normalized_url}")
        
        # Read file and prepare multipart/form-data upload
        filename = Path(file_path).name
        
        # Detect MIME type from file extension
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type or not mime_type.startswith('video/'):
            # Default to video/mp4 if detection fails
            mime_type = 'video/mp4'
        
        # Use a session to maintain cookies (helps with ngrok warning page)
        session = requests.Session()
        
        # Add headers to bypass ngrok-free.dev warning page
        session.headers.update({
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'ChatCut-Backend/1.0',
            'Accept': 'application/json',
        })
        
        with open(file_path, 'rb') as f:
            files = {
                'file': (filename, f, mime_type)
            }
            data = {
                'prompt': prompt
            }
            
            # Upload to Colab server
            # Disable SSL verification for ngrok-free.dev domains (they have SSL cert issues)
            verify_ssl = not ('ngrok-free.dev' in start_job_url or 'ngrok-free.app' in start_job_url)
            
            response = session.post(
                start_job_url,
                files=files,
                data=data,
                timeout=120,  # 2 minutes for upload
                allow_redirects=True,  # Follow redirects in case ngrok redirects after warning
                verify=verify_ssl  # Disable SSL verification for ngrok-free domains
            )
        
        if response.status_code != 200:
            error_msg = response.text[:500] if response.text else "Unknown error"
            logger.error(f"[Colab] Start job failed: {response.status_code} - {error_msg}")
            return {
                "job_id": None,
                "status": "error",
                "message": f"Colab server error: {response.status_code}",
                "error": "COLAB_SERVER_ERROR",
                "details": error_msg
            }
        
        try:
            result = response.json()
        except ValueError as e:
            # Log the actual response to debug
            response_text = response.text[:1000] if response.text else "No response body"
            logger.error(f"[Colab] Invalid JSON response: {e}")
            logger.error(f"[Colab] Response status: {response.status_code}")
            logger.error(f"[Colab] Response headers: {dict(response.headers)}")
            logger.error(f"[Colab] Response body (first 1000 chars): {response_text}")
            
            # Check if it's the ngrok warning page (HTML response)
            response_lower = response_text.lower()
            is_html_response = '<!doctype html>' in response_lower or '<html' in response_lower
            is_ngrok_warning = ('ngrok' in response_lower and 
                               ('warning' in response_lower or 'browser' in response_lower or 
                                'potential threat' in response_lower))
            
            if is_html_response or is_ngrok_warning:
                return {
                    "job_id": None,
                    "status": "error",
                    "message": "ngrok warning page detected - received HTML instead of JSON. The ngrok-skip-browser-warning header may not be working. Try visiting the URL in a browser first to accept the warning.",
                    "error": "NGROK_WARNING_PAGE"
                }
            
            return {
                "job_id": None,
                "status": "error",
                "message": f"Invalid response from Colab server (expected JSON, got HTML): {response_text[:200]}",
                "error": "INVALID_RESPONSE"
            }
        
        job_id = result.get("job_id")
        
        if not job_id:
            logger.error(f"[Colab] No job_id in response: {result}")
            return {
                "job_id": None,
                "status": "error",
                "message": "No job ID returned from Colab server",
                "error": "NO_JOB_ID"
            }
        
        logger.info(f"[Colab] Job started successfully: {job_id}")
        return {
            "job_id": job_id,
            "status": "started",
            "message": result.get("message", f"Processing started for {filename}"),
            "error": None
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"[Colab] Network error starting job: {e}")
        return {
            "job_id": None,
            "status": "error",
            "message": f"Failed to connect to Colab server: {str(e)}",
            "error": "NETWORK_ERROR"
        }
    except Exception as e:
        logger.error(f"[Colab] Unexpected error starting job: {e}", exc_info=True)
        return {
            "job_id": None,
            "status": "error",
            "message": f"Error starting job: {str(e)}",
            "error": "UNEXPECTED_ERROR"
        }


def get_colab_progress(job_id: str, colab_url: str, original_filename: str = "video") -> Dict[str, Any]:
    """
    Get progress status for a Colab job.
    
    Args:
        job_id: Job ID from start_colab_job
        colab_url: ngrok URL of the Colab server
        original_filename: Original filename for output naming
        
    Returns:
        dict with status, stage, progress, message, output_path (when complete), and optional error
    """
    try:
        normalized_url = _normalize_colab_url(colab_url)
        progress_url = f"{normalized_url}/progress/{job_id}"
        
        # Add headers to bypass ngrok-free.dev warning page
        headers = {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'ChatCut-Backend/1.0'
        }
        
        # Disable SSL verification for ngrok-free.dev domains
        verify_ssl = not ('ngrok-free.dev' in progress_url or 'ngrok-free.app' in progress_url)
        
        response = requests.get(progress_url, headers=headers, timeout=30, verify=verify_ssl)
        
        if response.status_code != 200:
            logger.error(f"[Colab] Progress check failed: {response.status_code}")
            return {
                "status": "error",
                "stage": "unknown",
                "progress": 0,
                "message": f"Failed to get progress: {response.status_code}",
                "output_path": None,
                "error": "PROGRESS_CHECK_FAILED"
            }
        
        try:
            progress_data = response.json()
        except ValueError as e:
            # Log the actual response to debug
            response_text = response.text[:500] if response.text else "No response body"
            logger.error(f"[Colab] Invalid JSON response: {e}")
            logger.error(f"[Colab] Response status: {response.status_code}")
            logger.error(f"[Colab] Response body (first 500 chars): {response_text}")
            
            # Check if it's the ngrok warning page
            if 'ngrok' in response_text.lower() and ('warning' in response_text.lower() or 'browser' in response_text.lower()):
                return {
                    "status": "error",
                    "stage": "unknown",
                    "progress": 0,
                    "message": "ngrok warning page detected",
                    "output_path": None,
                    "error": "NGROK_WARNING_PAGE"
                }
            
            return {
                "status": "error",
                "stage": "unknown",
                "progress": 0,
                "message": f"Invalid response from Colab server: {response_text[:200]}",
                "output_path": None,
                "error": "INVALID_RESPONSE"
            }
        status = progress_data.get("status", "unknown")
        stage = progress_data.get("stage", "processing")
        # Ensure progress is a float (Colab might return int)
        progress = float(progress_data.get("progress", 0))
        message = progress_data.get("message", "Processing...")
        
        # If job is complete, download the video
        if status == "complete":
            download_url = progress_data.get("download_url")
            filename = progress_data.get("filename")
            
            if not download_url or not filename:
                logger.error(f"[Colab] Complete but no download info: {progress_data}")
                return {
                    "status": "error",
                    "stage": "complete",
                    "progress": 100,
                    "message": "Job complete but no download URL provided",
                    "output_path": None,
                    "error": "NO_DOWNLOAD_URL"
                }
            
            # Download the video
            output_path = download_colab_video(download_url, colab_url, filename)
            
            if output_path:
                return {
                    "status": "complete",
                    "stage": "complete",
                    "progress": 100,
                    "message": message or "Processing complete!",
                    "output_path": output_path,
                    "error": None
                }
            else:
                return {
                    "status": "error",
                    "stage": "complete",
                    "progress": 100,
                    "message": "Job complete but video download failed",
                    "output_path": None,
                    "error": "DOWNLOAD_FAILED"
                }
        
        elif status == "error":
            error_msg = progress_data.get("error", progress_data.get("message", "Unknown error"))
            logger.error(f"[Colab] Job error: {error_msg}")
            return {
                "status": "error",
                "stage": stage,
                "progress": progress,
                "message": f"Job failed: {error_msg}",
                "output_path": None,
                "error": "JOB_FAILED"
            }
        
        elif status == "not_found":
            # Job not found on Colab server
            error_msg = progress_data.get("error", "Job not found")
            logger.error(f"[Colab] Job not found: {error_msg}")
            return {
                "status": "not_found",
                "stage": "unknown",
                "progress": 0,
                "message": f"Job not found: {error_msg}",
                "output_path": None,
                "error": "JOB_NOT_FOUND"
            }
        
        else:
            # Still processing (status is "processing", "pending", "running", etc.)
            return {
                "status": "processing",
                "stage": stage,
                "progress": progress,
                "message": message,
                "output_path": None,
                "error": None
            }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"[Colab] Network error checking progress: {e}")
        return {
            "status": "error",
            "stage": "unknown",
            "progress": 0,
            "message": f"Failed to connect to Colab server: {str(e)}",
            "output_path": None,
            "error": "NETWORK_ERROR"
        }
    except Exception as e:
        logger.error(f"[Colab] Unexpected error checking progress: {e}", exc_info=True)
        return {
            "status": "error",
            "stage": "unknown",
            "progress": 0,
            "message": f"Error checking progress: {str(e)}",
            "output_path": None,
            "error": "UNEXPECTED_ERROR"
        }


def check_colab_health(colab_url: str) -> Dict[str, Any]:
    """
    Check if Colab server is healthy and reachable.
    
    Args:
        colab_url: ngrok URL of the Colab server
        
    Returns:
        dict with healthy (bool), status, and optional error
    """
    try:
        normalized_url = _normalize_colab_url(colab_url)
        health_url = f"{normalized_url}/health"
        
        # Add headers to bypass ngrok-free.dev warning page
        headers = {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'ChatCut-Backend/1.0'
        }
        
        response = requests.get(health_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            try:
                health_data = response.json()
                gpu = health_data.get("gpu", "unknown")
                logger.info(f"[Colab] Health check passed: GPU={gpu}")
                return {
                    "healthy": True,
                    "status": "ok",
                    "gpu": gpu,
                    "error": None
                }
            except ValueError as e:
                logger.error(f"[Colab] Invalid JSON in health response: {e}")
                return {
                    "healthy": False,
                    "status": "error",
                    "error": "Invalid response format"
                }
        else:
            logger.warning(f"[Colab] Health check failed: {response.status_code}")
            return {
                "healthy": False,
                "status": "error",
                "error": f"Health check returned {response.status_code}"
            }
        
    except requests.exceptions.RequestException as e:
        logger.warning(f"[Colab] Health check network error: {e}")
        return {
            "healthy": False,
            "status": "error",
            "error": f"Failed to connect: {str(e)}"
        }
    except Exception as e:
        logger.error(f"[Colab] Health check unexpected error: {e}", exc_info=True)
        return {
            "healthy": False,
            "status": "error",
            "error": f"Unexpected error: {str(e)}"
        }


def download_colab_video(download_url: str, colab_url: str, filename: str) -> Optional[str]:
    """
    Download processed video from Colab server and save to local output directory.
    
    Args:
        download_url: Relative download URL from Colab (e.g., "/download/processed_video.mp4")
        colab_url: ngrok URL of the Colab server
        filename: Filename to save as
        
    Returns:
        Absolute path to downloaded file, or None if download failed
    """
    try:
        normalized_url = _normalize_colab_url(colab_url)
        
        # Handle both relative and absolute URLs
        if download_url.startswith('http'):
            full_url = download_url
        else:
            full_url = f"{normalized_url}{download_url}"
        
        logger.info(f"[Colab] Downloading video from: {full_url}")
        
        # Add headers to bypass ngrok-free.dev warning page
        headers = {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'ChatCut-Backend/1.0'
        }
        
        # Disable SSL verification for ngrok-free.dev domains
        verify_ssl = not ('ngrok-free.dev' in full_url or 'ngrok-free.app' in full_url)
        
        # Download video
        response = requests.get(full_url, headers=headers, timeout=300, verify=verify_ssl)  # 5 minutes for download
        
        if response.status_code != 200:
            logger.error(f"[Colab] Download failed: {response.status_code}")
            return None
        
        # Save to output directory
        output_dir = Path("output")
        try:
            output_dir.mkdir(exist_ok=True)
        except OSError as e:
            logger.error(f"[Colab] Failed to create output directory: {e}")
            return None
        
        output_path = output_dir / filename
        
        try:
            with open(output_path, 'wb') as f:
                f.write(response.content)
        except IOError as e:
            logger.error(f"[Colab] Failed to write video file: {e}")
            return None
        
        # Convert to absolute path
        absolute_path = output_path.resolve()
        
        logger.info(f"[Colab] Video downloaded successfully: {absolute_path}")
        return str(absolute_path)
        
    except requests.exceptions.RequestException as e:
        logger.error(f"[Colab] Network error downloading video: {e}")
        return None
    except Exception as e:
        logger.error(f"[Colab] Unexpected error downloading video: {e}", exc_info=True)
        return None

