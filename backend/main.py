from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

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


if __name__ == "__main__":
    print("Starting ChatCut Backend on http://127.0.0.1:3001")
    uvicorn.run(app, host="127.0.0.1", port=3001)
