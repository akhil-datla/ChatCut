from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

from models.schemas import ProcessPromptRequest, ProcessPromptResponse
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
