"""
AI Provider Abstraction Layer

This module defines the interface for AI providers and allows switching
between different AI services (Gemini, OpenAI, Anthropic, etc.) without
changing the rest of the codebase.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


class AIProvider(ABC):
    """Abstract base class for AI providers"""
    
    @abstractmethod
    def process_prompt(self, user_prompt: str) -> Dict[str, Any]:
        """
        Process user prompt and extract structured action with parameters.
        
        Args:
            user_prompt: Natural language user request
        
        Returns:
            {
                "action": str | None,      # Action name or None
                "parameters": dict,        # Extracted parameters
                "confidence": float,       # 0.0 to 1.0
                "message": str,            # Human-readable explanation
                "error": str | None       # Error code if failed
            }
        """
        pass
    
    @abstractmethod
    def is_configured(self) -> bool:
        """Check if provider is properly configured"""
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Get the name of the provider"""
        pass


class AIProviderResult:
    """Standardized result structure for AI providers"""
    
    def __init__(
        self,
        action: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        confidence: float = 0.0,
        message: str = "",
        error: Optional[str] = None
    ):
        self.action = action
        self.parameters = parameters or {}
        self.confidence = confidence
        self.message = message
        self.error = error
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            "action": self.action,
            "parameters": self.parameters,
            "confidence": self.confidence,
            "message": self.message,
            "error": self.error
        }
    
    @classmethod
    def success(cls, action: str, parameters: Dict[str, Any], message: str = "", confidence: float = 1.0):
        """Create a successful result"""
        return cls(
            action=action,
            parameters=parameters,
            confidence=confidence,
            message=message or f"Extracted action: {action}"
        )
    
    @classmethod
    def failure(cls, message: str, error: Optional[str] = None):
        """Create a failure result"""
        return cls(
            message=message,
            error=error or "EXTRACTION_FAILED",
            confidence=0.0
        )

