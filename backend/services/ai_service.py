"""
AI Service - Provider-agnostic AI processing

This service uses the AI provider abstraction layer to process prompts.
The provider can be switched via configuration without code changes.
"""
import os
from typing import Dict, Any

from .ai_provider import AIProvider
from .providers import GeminiProvider

# Provider factory - switch providers here
_PROVIDER_INSTANCE: AIProvider = None


def _get_provider() -> AIProvider:
    """
    Get the configured AI provider instance.
    Always creates fresh instance to ensure env vars are loaded.
    """
    global _PROVIDER_INSTANCE
    
    provider_type = os.getenv("AI_PROVIDER", "gemini").lower()
    
    # Always create new instance to pick up env changes (dotenv loads before this)
    if provider_type == "gemini":
        _PROVIDER_INSTANCE = GeminiProvider()
    else:
        raise ValueError(f"Unknown AI provider: {provider_type}. Set AI_PROVIDER env var.")
    
    if not _PROVIDER_INSTANCE.is_configured():
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_gemini_api_key_here":
            print(f"⚠️  WARNING: GEMINI_API_KEY not set. Please set GEMINI_API_KEY in .env file")
        else:
            print(f"⚠️  WARNING: Gemini provider configured but API key may be invalid. Key length: {len(api_key)}")
    
    return _PROVIDER_INSTANCE


def process_prompt(user_prompt: str) -> Dict[str, Any]:
    """
    Process user prompt and extract structured action with parameters.
    
    This function uses the configured AI provider to extract actions.
    The provider can be switched via AI_PROVIDER environment variable.
    
    Args:
        user_prompt: Natural language user request (e.g., "zoom in by 120%")
    
    Returns:
        {
            "action": str,  # e.g., "zoomIn", "zoomOut"
            "parameters": dict,  # e.g., {"endScale": 120, "animated": false}
            "confidence": float,  # 0.0 to 1.0
            "message": str  # Human-readable explanation
        }
    """
    provider = _get_provider()
    return provider.process_prompt(user_prompt)


def get_available_actions() -> Dict[str, Dict[str, Any]]:
    """
    Returns a registry of available actions and their parameter schemas.
    This helps the AI understand what actions are available.
    
    Note: This is provider-agnostic and describes the system's capabilities,
    not provider-specific features.
    """
    return {
        "zoomIn": {
            "description": "Zoom in on video clip",
            "parameters": {
                "endScale": {"type": "number", "default": 150, "description": "Target zoom scale as percentage"},
                "startScale": {"type": "number", "default": 100, "description": "Starting zoom scale"},
                "animated": {"type": "boolean", "default": True, "description": "Whether to animate zoom"},
                "duration": {"type": "number", "default": None, "description": "Duration in seconds"},
                "interpolation": {"type": "string", "default": "BEZIER", "enum": ["LINEAR", "BEZIER", "HOLD", "EASE_IN", "EASE_OUT"]}
            }
        },
        "zoomOut": {
            "description": "Zoom out on video clip",
            "parameters": {
                "endScale": {"type": "number", "default": 100, "description": "Target zoom scale as percentage"},
                "startScale": {"type": "number", "default": 150, "description": "Starting zoom scale"},
                "animated": {"type": "boolean", "default": True, "description": "Whether to animate zoom"},
                "duration": {"type": "number", "default": None, "description": "Duration in seconds"},
                "interpolation": {"type": "string", "default": "BEZIER", "enum": ["LINEAR", "BEZIER", "HOLD", "EASE_IN", "EASE_OUT"]}
            }
        },
        "applyFilter": {
            "description": "Apply a video filter effect",
            "parameters": {
                "filterName": {"type": "string", "required": True, "description": "Name of the filter to apply"}
            }
        },
        "applyTransition": {
            "description": "Apply a transition effect",
            "parameters": {
                "transitionName": {"type": "string", "required": True, "description": "Name of the transition"},
                "duration": {"type": "number", "default": 1.0, "description": "Duration in seconds"},
                "applyToStart": {"type": "boolean", "default": True, "description": "Apply to start of clip"},
                "transitionAlignment": {"type": "number", "default": 0.5, "description": "Alignment of the transition (0.0=start, 0.5=center, 1.0=end)"}
            }
        },
        "applyBlur": {
            "description": "Apply a Gaussian blur to the clip",
            "parameters": {
                "blurAmount": {"type": "number", "default": 50, "description": "Blurriness amount (e.g., 0-500)"}
            }
        },
        "applyAudioFilter": {
            "description": "Apply an audio effect/filter to an audio clip",
            "parameters": {
                "filterDisplayName": {"type": "string", "required": True, "description": "Display name of the audio filter (e.g., 'Parametric EQ', 'Reverb', 'DeNoise')"}
            }
        },
        "adjustVolume": {
            "description": "Adjust the volume of an audio clip",
            "parameters": {
                "volumeDb": {"type": "number", "required": True, "description": "Volume adjustment in decibels (positive = louder, negative = quieter, e.g., 3 = +3dB louder, -6 = -6dB quieter)"}
            }
        }
    }


def get_provider_info() -> Dict[str, Any]:
    """
    Get information about the currently configured provider
    """
    try:
        provider = _get_provider()
        return {
            "provider": provider.get_provider_name(),
            "configured": provider.is_configured()
        }
    except Exception as e:
        return {
            "provider": "unknown",
            "configured": False,
            "error": str(e)
        }
