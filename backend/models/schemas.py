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


class ColabProcessRequest(BaseModel):
    """Request model for Colab video processing"""
    file_path: str
    prompt: str
    effect_type: Optional[str] = None


class ColabProcessResponse(BaseModel):
    """Response model for Colab processing"""
    status: str = "processing"
    message: str = ""
    error: Optional[str] = None
    original_path: Optional[str] = None
    output_path: Optional[str] = None
    progress: Optional[int] = None


class ColabStartRequest(BaseModel):
    """Request model for starting Colab session"""
    ngrok_url: Optional[str] = None 

