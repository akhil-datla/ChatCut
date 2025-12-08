"""
Pydantic models for API request/response schemas.
Simple and minimal - no overengineering.
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class ProcessPromptRequest(BaseModel):
    """Request model for processing user prompts"""
    prompt: str
    context_params: Optional[Dict[str, Any]] = None


class ProcessPromptResponse(BaseModel):
    """Response model for AI-processed prompts"""
    action: Optional[str] = None
    parameters: Dict[str, Any] = {}
    # 'actions' allows returning multiple edits in one prompt: list of {action: str, parameters: dict}
    actions: Optional[List[Dict[str, Any]]] = None
    confidence: float = 0.0
    message: str = ""
    error: Optional[str] = None
    raw_response: Optional[str] = None  # For debugging only


class ProcessMediaRequest(BaseModel):
    """Request model for processing a single media file with AI"""
    filePath: str
    prompt: str


class ProcessMediaResponse(BaseModel):
    """Response model for media processing"""
    action: Optional[str] = None
    parameters: Dict[str, Any] = {}
    confidence: float = 0.0
    message: str = ""
    error: Optional[str] = None
    original_path: Optional[str] = None
    output_path: Optional[str] = None
    task_id: Optional[str] = None


class ProcessObjectTrackingRequest(BaseModel):
    """Request model for processing media file with object tracking"""
    filePath: str
    prompt: str


class ProcessObjectTrackingResponse(BaseModel):
    """Response model for object tracking processing"""
    action: Optional[str] = None
    parameters: Dict[str, Any] = {}
    confidence: float = 0.0
    message: str = ""
    error: Optional[str] = None
    tracked_objects: Optional[List[Dict[str, Any]]] = None  # List of tracked objects with positions
    tracking_data: Optional[Dict[str, Any]] = None  # Frame-by-frame tracking data


class ColabStartRequest(BaseModel):
    """Request model for starting a Colab processing job"""
    file_path: str
    prompt: str
    colab_url: str
    trim_start: Optional[float] = None
    trim_end: Optional[float] = None


class ColabStartResponse(BaseModel):
    """Response model for Colab job start"""
    job_id: Optional[str] = None
    status: str
    message: str
    error: Optional[str] = None


class ColabProgressRequest(BaseModel):
    """Request model for checking Colab job progress"""
    job_id: str
    colab_url: str
    original_filename: str = "video"


class ColabProgressResponse(BaseModel):
    """Response model for Colab job progress"""
    status: str  # "processing" | "complete" | "error"
    stage: str
    progress: float  # 0-100
    message: str
    output_path: Optional[str] = None
    error: Optional[str] = None


class ColabHealthRequest(BaseModel):
    """Request model for Colab server health check"""
    colab_url: str


class ColabHealthResponse(BaseModel):
    """Response model for Colab server health check"""
    healthy: bool
    status: str
    gpu: Optional[str] = None
    error: Optional[str] = None


class AskQuestionRequest(BaseModel):
    """Request model for asking Premiere Pro questions"""
    messages: List[Dict[str, str]]  # List of {role: str, content: str}
    
    class Config:
        # Allow extra fields but ignore them (defensive - in case frontend sends id, timestamp, etc.)
        extra = "ignore"


class AskQuestionResponse(BaseModel):
    """Response model for Premiere Pro question answers"""
    message: str
    error: Optional[str] = None

