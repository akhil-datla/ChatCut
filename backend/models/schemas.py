"""
Pydantic models for API request/response schemas.
Simple and minimal - no overengineering.
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel


class ProcessPromptRequest(BaseModel):
    """Request model for processing user prompts"""
    prompt: str


class ProcessPromptResponse(BaseModel):
    """Response model for AI-processed prompts"""
    action: Optional[str] = None
    parameters: Dict[str, Any] = {}
    confidence: float = 0.0
    message: str = ""
    error: Optional[str] = None
    raw_response: Optional[str] = None  # For debugging only

