"""
AI Provider Abstraction Layer

This module defines the interface for AI providers and allows switching
between different AI services (Gemini, OpenAI, Anthropic, etc.) without
changing the rest of the codebase.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List


class AIProvider(ABC):
    """Abstract base class for AI providers"""
    
    @abstractmethod
    def process_prompt(self, user_prompt: str, context_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process user prompt and extract structured action with parameters.
        
        Args:
            user_prompt: Natural language user request
            context_params: Optional context parameters (e.g., selected effect settings)
        
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
    
    @abstractmethod
    def process_question(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Process a question/chat request with conversation history.
        This is separate from action extraction - used for question answering.
        
        Args:
            messages: List of message dicts with 'role' ('user'|'assistant') and 'content'
        
        Returns:
            {
                "message": str,              # Answer text
                "error": str | None          # Error code if failed
            }
        """
        pass


class AIProviderResult:
    """Standardized result structure for AI providers"""
    
    def __init__(
        self,
        action: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        actions: Optional[list] = None,
        confidence: float = 0.0,
        message: str = "",
        error: Optional[str] = None
    ):
        self.action = action
        self.parameters = parameters or {}
        # 'actions' is an optional list of action objects: [{"action": "applyFilter", "parameters": {...}}, ...]
        self.actions = actions or None
        self.confidence = confidence
        self.message = message
        self.error = error
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            "action": self.action,
            "parameters": self.parameters,
            "actions": self.actions,
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
    def success_multiple(cls, actions: list, message: str = "", confidence: float = 1.0):
        """Create a successful result with multiple actions

        actions: list of {"action": str, "parameters": dict}
        """
        return cls(
            action=None,
            parameters={},
            actions=actions,
            confidence=confidence,
            message=message or f"Extracted {len(actions)} actions"
        )
    
    @classmethod
    def failure(cls, message: str, error: Optional[str] = None):
        """Create a failure result"""
        return cls(
            message=message,
            error=error or "EXTRACTION_FAILED",
            confidence=0.0
        )

