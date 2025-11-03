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
    ProcessMediaResponse
)
from services.ai_service import process_prompt

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
    result = process_prompt(request.prompt)
    print(f"[AI] Result: {result}")
    return ProcessPromptResponse(**result)


@app.post("/api/process-media", response_model=ProcessMediaResponse)
async def process_media_files(request: ProcessMediaRequest):
    """Process media files with AI. Validates file access and processes prompt."""
    print(f"[Media] Processing {len(request.filePaths)} file(s): {request.prompt}")
    
    # Quick check: count accessible files
    accessible = 0
    for path in request.filePaths:
        try:
            if Path(path).exists() and os.access(path, os.R_OK):
                accessible += 1
                print(f"  ✓ {Path(path).name}")
        except Exception as e:
            print(f"  ✗ {path}: {e}")
    
    if accessible == 0:
        return ProcessMediaResponse(
            action=None,
            message=f"Could not access any files. Check paths.",
            error="FILE_ACCESS_ERROR"
        )
    
    # Process prompt with AI
    ai_result = process_prompt(request.prompt)
    print(f"[Media] Result: action={ai_result.get('action')}, files OK={accessible}/{len(request.filePaths)}")
    
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


if __name__ == "__main__":
    print("Starting ChatCut Backend on http://127.0.0.1:3001")
    uvicorn.run(app, host="127.0.0.1", port=3001)
