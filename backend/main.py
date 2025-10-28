from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

from models.schemas import PromptRequest, EffectResponse, ErrorResponse
from services.gemini_service import GeminiService

# Load environment variables
load_dotenv()

app = FastAPI(
    title="ChatCut Backend",
    version="0.1.0",
    description="AI-powered video editing assistant for Premiere Pro"
)

# Enable CORS for the UXP frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini service
try:
    gemini_service = GeminiService()
    print("✓ Gemini service initialized successfully")
except Exception as e:
    print(f"⚠ Warning: Gemini service failed to initialize: {str(e)}")
    print("  Make sure to set GEMINI_API_KEY in your .env file")
    gemini_service = None


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "ChatCut Backend",
        "version": "0.1.0",
        "status": "running",
        "gemini_enabled": gemini_service is not None
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "gemini_api": "not_configured"
    }

    if gemini_service:
        is_connected = await gemini_service.test_connection()
        health_status["gemini_api"] = "connected" if is_connected else "error"

    return health_status


@app.post("/api/ping")
async def ping(request: dict):
    """Simple ping endpoint to verify connection between frontend and backend"""
    message = request.get("message", "")
    print(f"[Ping] Received message: {message}")
    return {
        "status": "ok",
        "received": message
    }


@app.post("/api/process-prompt", response_model=EffectResponse)
async def process_prompt(request: PromptRequest):
    """
    Process a natural language prompt and return effect instructions

    Args:
        request: PromptRequest with user prompt and optional timeline info

    Returns:
        EffectResponse with effect name, parameters, and metadata
    """
    if not gemini_service:
        raise HTTPException(
            status_code=503,
            detail="Gemini API service not available. Please configure GEMINI_API_KEY."
        )

    try:
        print(f"[Process Prompt] User prompt: {request.prompt}")
        if request.start_time and request.end_time:
            duration = (request.end_time - request.start_time) / 254016000000  # Convert ticks to seconds
            print(f"[Process Prompt] Timeline selection: {duration:.2f} seconds")

        # Process prompt with Gemini
        effect_response = await gemini_service.process_prompt(request.prompt)

        print(f"[Process Prompt] Effect: {effect_response.effect_name}")
        print(f"[Process Prompt] Confidence: {effect_response.confidence:.2f}")
        print(f"[Process Prompt] Parameters: {effect_response.parameters}")

        return effect_response

    except Exception as e:
        print(f"[Process Prompt] Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing prompt: {str(e)}"
        )


if __name__ == "__main__":
    print("=" * 60)
    print("ChatCut Backend Starting...")
    print("=" * 60)
    print(f"Server: http://localhost:3001")
    print(f"Docs: http://localhost:3001/docs")
    print(f"Health: http://localhost:3001/health")
    print("=" * 60)

    # Check for API key
    if not os.getenv("GEMINI_API_KEY"):
        print("⚠ WARNING: GEMINI_API_KEY not found in environment")
        print("  Create a .env file with your Gemini API key")
        print("  Get your key from: https://ai.google.dev/")
    print()

    uvicorn.run(app, host="127.0.0.1", port=3001)
