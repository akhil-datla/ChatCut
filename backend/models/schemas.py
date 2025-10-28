from pydantic import BaseModel, Field
from typing import Dict, Optional


class PromptRequest(BaseModel):
    """Request model for prompt processing"""
    prompt: str = Field(..., description="User's natural language prompt")
    start_time: Optional[float] = Field(None, description="Timeline start time in ticks")
    end_time: Optional[float] = Field(None, description="Timeline end time in ticks")


class EffectParameters(BaseModel):
    """Parameters for a video effect"""
    name: str = Field(..., description="Effect parameter name")
    value: float | str | int = Field(..., description="Parameter value")


class EffectResponse(BaseModel):
    """Response model for processed effect"""
    effect_name: str = Field(..., description="Premiere Pro effect name")
    effect_category: str = Field(..., description="Effect category path")
    parameters: Dict[str, float | str | int] = Field(default_factory=dict, description="Effect parameters")
    confidence: float = Field(..., ge=0.0, le=1.0, description="AI confidence in interpretation")
    description: str = Field(..., description="Human-readable description of what will be applied")


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional error details")
