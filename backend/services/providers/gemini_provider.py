"""
Gemini AI Provider Implementation

Concrete implementation of AIProvider using Google's Gemini API.
"""
import os
import json
from typing import Dict, Any, Optional

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from ..ai_provider import AIProvider, AIProviderResult


class GeminiProvider(AIProvider):
    """Google Gemini AI provider implementation"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini provider
        
        Args:
            api_key: Gemini API key (if None, reads from GEMINI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        # Use gemini-2.0-flash for free tier (fast and efficient)
        # Alternative: gemini-2.5-flash (newer, may have better quality)
        # Or: gemini-2.0-flash-lite (even faster, lighter)
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        self._configured = False
        
        if self.api_key and GEMINI_AVAILABLE:
            try:
                genai.configure(api_key=self.api_key)
                self._configured = True
            except Exception as e:
                print(f"⚠️  Warning: Failed to configure Gemini: {e}")
    
    def is_configured(self) -> bool:
        """Check if Gemini is properly configured"""
        return self._configured and GEMINI_AVAILABLE and self.api_key is not None
    
    def get_provider_name(self) -> str:
        """Get provider name"""
        return "gemini"
    
    def process_prompt(self, user_prompt: str) -> Dict[str, Any]:
        """
        Process user prompt using Gemini API
        """
        if not self.is_configured():
            return AIProviderResult.failure(
                message="Gemini API not configured. Please set GEMINI_API_KEY.",
                error="API_KEY_MISSING"
            ).to_dict()
        
        try:
            # Get Gemini model (strip "models/" prefix if present, GenerativeModel adds it)
            model_name = self.model_name.replace("models/", "") if self.model_name.startswith("models/") else self.model_name
            model = genai.GenerativeModel(model_name)
            
            # Create system prompt
            system_prompt = self._get_system_prompt()
            
            # Combine with user request
            full_prompt = f"{system_prompt}\n\nUser request: {user_prompt}\n\nResponse (JSON only):"
            
            # Generate response
            response = model.generate_content(full_prompt)
            response_text = response.text.strip()
            
            # Clean up response (remove markdown code blocks if present)
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            # Parse JSON response
            result = json.loads(response_text)
            
            # Extract data
            action = result.get("action")
            parameters = result.get("parameters", {})
            message = result.get("message", "Action extracted successfully")
            
            # Calculate confidence
            confidence = 1.0 if action else 0.0
            
            return AIProviderResult.success(
                action=action,
                parameters=parameters,
                message=message,
                confidence=confidence
            ).to_dict()
            
        except json.JSONDecodeError as e:
            return AIProviderResult.failure(
                message=f"Failed to parse AI response: {str(e)}",
                error="PARSE_ERROR"
            ).to_dict()
        except Exception as e:
            return AIProviderResult.failure(
                message=f"Gemini API error: {str(e)}",
                error="AI_ERROR"
            ).to_dict()
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for Gemini"""
        return """You are a video editing assistant. Extract the action and parameters from user requests.

Available actions:
- zoomIn: Zoom in on video (parameters: endScale, startScale, animated, duration, interpolation)
- zoomOut: Zoom out on video (same parameters as zoomIn)
- applyFilter: Apply a video filter (parameters: filterName)
- applyTransition: Apply a transition (parameters: transitionName, duration)

Parameters:
- endScale: Target zoom scale as percentage (default: 150 for zoomIn, 100 for zoomOut)
- startScale: Starting zoom scale (default: 100 for zoomIn, 150 for zoomOut)
- animated: Whether to animate the zoom over time (TRUE = gradual/animated, FALSE = static/instant)
- duration: Duration in seconds (optional, uses clip duration if not specified)
- interpolation: 'LINEAR', 'BEZIER', 'HOLD', 'EASE_IN', 'EASE_OUT' (default: 'BEZIER')

CRITICAL: Determining Animated vs Static Zoom

ANIMATED/Gradual Zoom (animated: true):
- User mentions: "slow zoom", "gradual zoom", "animate", "zoom from X to Y", "zoom over time"
- Examples:
  - "slow zoom in from 100% to 120%" → {"animated": true, "startScale": 100, "endScale": 120}
  - "gradual zoom in to 150%" → {"animated": true, "endScale": 150}
  - "zoom in gradually" → {"animated": true}
  - "animate a zoom from 100% to 120%" → {"animated": true, "startScale": 100, "endScale": 120}

STATIC/Instant Zoom (animated: false):
- User mentions: "entire clip", "throughout", "static", "zoom to X" (without "from" or "slow")
- Simple requests without animation keywords default to static
- Examples:
  - "zoom in 120%" → {"animated": false, "endScale": 120} (DEFAULT: static)
  - "entire clip zoomed in to 120%" → {"animated": false, "endScale": 120}
  - "zoom the whole clip to 150%" → {"animated": false, "endScale": 150}
  - "zoom in to 120%" → {"animated": false, "endScale": 120}

Extract numbers from user requests. Extract "from X to Y" to get both startScale and endScale.

Examples:
- "zoom in by 120%" → {"action": "zoomIn", "animated": false, "endScale": 120}
- "slow zoom in from 100% to 120%" → {"action": "zoomIn", "animated": true, "startScale": 100, "endScale": 120}
- "entire clip zoomed in to 120%" → {"action": "zoomIn", "animated": false, "endScale": 120}
- "gradual zoom in to 150%" → {"action": "zoomIn", "animated": true, "endScale": 150}
- "zoom out gradually" → {"action": "zoomOut", "animated": true}

Return ONLY valid JSON in this format:
{
    "action": "actionName",
    "parameters": {...},
    "message": "Brief explanation"
}

If the request is unclear or not a video editing action, return:
{
    "action": null,
    "parameters": {},
    "message": "I don't understand this request."
}
"""

