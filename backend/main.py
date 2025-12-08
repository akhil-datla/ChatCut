from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn
import os
from pathlib import Path

from models.schemas import (
    ProcessPromptRequest, 
    ProcessPromptResponse,
    ProcessMediaRequest,
    ProcessMediaResponse,
    ProcessObjectTrackingRequest,
    ProcessObjectTrackingResponse,
    ColabStartRequest,
    ColabStartResponse,
    ColabProgressRequest,
    ColabProgressResponse,
    ColabHealthRequest,
    ColabHealthResponse,
    AskQuestionRequest,
    AskQuestionResponse
)
from services.ai_service import process_prompt

from services.providers.video_provider import process_media
from services.providers.object_tracking_provider import process_object_tracking
from services.colab_proxy import start_colab_job, get_colab_progress, check_colab_health
from services.question_service import process_question

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


@app.post("/api/process-object-tracking", response_model=ProcessObjectTrackingResponse)
async def process_object_tracking_endpoint(request: ProcessObjectTrackingRequest):
    """
    Process media file with object tracking capabilities.
    This endpoint will handle object detection and tracking requests.
    """
    print(f"[Object Tracking] Processing file: {request.filePath}")
    print(f"[Object Tracking] Prompt: {request.prompt}")
    
    # Validate file access
    file_path = request.filePath
    try:
        if not Path(file_path).exists():
            return ProcessObjectTrackingResponse(
                action=None,
                message=f"File not found: {file_path}",
                error="FILE_NOT_FOUND"
            )
        
        if not os.access(file_path, os.R_OK):
            return ProcessObjectTrackingResponse(
                action=None,
                message=f"Cannot read file: {file_path}",
                error="FILE_ACCESS_ERROR"
            )
        
        print(f"  ✓ {Path(file_path).name}")
        
    except Exception as e:
        print(f"  ✗ {file_path}: {e}")
        return ProcessObjectTrackingResponse(
            action=None,
            message=f"Error accessing file: {str(e)}",
            error="FILE_ACCESS_ERROR"
        )
    
    # Process with object tracking provider
    result = process_object_tracking(request.prompt, file_path)
    print(f"[Object Tracking] Result: action={result.get('action')}")
    
    return ProcessObjectTrackingResponse(**result)


@app.post("/api/colab-start", response_model=ColabStartResponse)
async def colab_start_endpoint(request: ColabStartRequest):
    """
    Start a Colab processing job by uploading video file and prompt.
    Proxies request to Colab server.
    """
    print(f"[Colab] Starting job: {request.file_path}")
    print(f"[Colab] Prompt: {request.prompt}")
    print(f"[Colab] Colab URL: {request.colab_url}")
    
    # Validate file access
    file_path = request.file_path
    try:
        if not Path(file_path).exists():
            return ColabStartResponse(
                job_id=None,
                status="error",
                message=f"File not found: {file_path}",
                error="FILE_NOT_FOUND"
            )
        
        if not os.access(file_path, os.R_OK):
            return ColabStartResponse(
                job_id=None,
                status="error",
                message=f"Cannot read file: {file_path}",
                error="FILE_ACCESS_ERROR"
            )
        
        print(f"  ✓ {Path(file_path).name}")
        
    except Exception as e:
        print(f"  ✗ {file_path}: {e}")
        return ColabStartResponse(
            job_id=None,
            status="error",
            message=f"Error accessing file: {str(e)}",
            error="FILE_ACCESS_ERROR"
        )
    
    # Prepare trim info if provided
    trim_info = None
    if request.trim_start is not None and request.trim_end is not None:
        trim_info = {
            "trim_start": request.trim_start,
            "trim_end": request.trim_end
        }
        print(f"  Trim info: {request.trim_start:.2f}s - {request.trim_end:.2f}s")
    
    # Start Colab job
    result = start_colab_job(file_path, request.prompt, request.colab_url, trim_info)
    print(f"[Colab] Start result: job_id={result.get('job_id')}, status={result.get('status')}")
    
    return ColabStartResponse(**result)


@app.post("/api/colab-progress", response_model=ColabProgressResponse)
async def colab_progress_endpoint(request: ColabProgressRequest):
    """
    Get progress status for a Colab job.
    Proxies request to Colab server and downloads video when complete.
    """
    print(f"[Colab] Checking progress: job_id={request.job_id}")
    
    result = get_colab_progress(request.job_id, request.colab_url, request.original_filename)
    print(f"[Colab] Progress result: status={result.get('status')}, progress={result.get('progress')}%")
    
    return ColabProgressResponse(**result)


@app.post("/api/colab-health", response_model=ColabHealthResponse)
async def colab_health_endpoint(request: ColabHealthRequest):
    """
    Check if Colab server is healthy and reachable.
    Proxies health check request to Colab server.
    """
    print(f"[Colab] Health check: {request.colab_url}")
    
    result = check_colab_health(request.colab_url)
    print(f"[Colab] Health result: healthy={result.get('healthy')}")
    
    return ColabHealthResponse(**result)


@app.post("/api/ask-question", response_model=AskQuestionResponse)
async def ask_question(request: AskQuestionRequest):
    """
    Answer Premiere Pro questions using AI.
    Takes conversation history and returns helpful answer.
    """
    print(f"[Questions] Processing question: {len(request.messages)} messages")
    
    result = process_question(request.messages)
    print(f"[Questions] Response generated")
    
    return AskQuestionResponse(**result)


@app.get("/health")
async def health():
    """Health check endpoint"""
    from services.ai_service import get_provider_info
    provider_info = get_provider_info()
    return {
        "status": "ok",
        "ai_provider": provider_info
    }


if __name__ == "__main__":
    print("Starting ChatCut Backend on http://127.0.0.1:3001")
    uvicorn.run(app, host="127.0.0.1", port=3001)
