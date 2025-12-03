"""
AI Provider implementations

This package contains concrete implementations of the AIProvider interface.
Add new providers here (OpenAI, Anthropic, etc.)
"""
from .gemini_provider import GeminiProvider
from .object_tracking_provider import process_object_tracking

__all__ = ['GeminiProvider', 'process_object_tracking']

