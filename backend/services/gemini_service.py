"""
Gemini Service
Handles communication with Google Gemini API for prompt processing
"""

import os
import json
from typing import Dict, Optional
from google import genai
from google.genai import types

from models.schemas import EffectResponse
from services.effect_mapper import EffectMapper


class GeminiService:
    """Service for interacting with Google Gemini API"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini service

        Args:
            api_key: Google Gemini API key. If None, reads from GEMINI_API_KEY env var
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY not found. Please set it in your .env file or pass it to the constructor."
            )

        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-2.0-flash-001"
        self.effect_mapper = EffectMapper()

    async def process_prompt(self, user_prompt: str) -> EffectResponse:
        """
        Process user prompt and return effect instructions

        Args:
            user_prompt: Natural language prompt from user

        Returns:
            EffectResponse with effect details

        Raises:
            Exception: If API call fails or response is invalid
        """
        try:
            # Get system prompt from effect mapper
            system_prompt = self.effect_mapper.get_system_prompt()

            # Call Gemini API
            response = self.client.models.generate_content(
                model=self.model,
                contents=f"{system_prompt}\n\nUser prompt: {user_prompt}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,  # Lower temperature for more consistent results
                )
            )

            # Parse JSON response
            result = json.loads(response.text)

            # Validate and create response
            effect_response = EffectResponse(
                effect_name=result.get("effect_name", ""),
                effect_category=result.get("effect_category", ""),
                parameters=result.get("parameters", {}),
                confidence=result.get("confidence", 0.0),
                description=result.get("description", "")
            )

            # If we have a valid effect, validate parameters
            if effect_response.confidence > 0.5 and effect_response.effect_name:
                effect_key = self._get_effect_key(effect_response.effect_name)
                if effect_key:
                    is_valid, clamped_params, error = self.effect_mapper.validate_parameters(
                        effect_key, effect_response.parameters
                    )
                    if is_valid:
                        effect_response.parameters = clamped_params

            return effect_response

        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse Gemini API response as JSON: {str(e)}")
        except Exception as e:
            raise Exception(f"Error processing prompt with Gemini API: {str(e)}")

    def _get_effect_key(self, effect_name: str) -> Optional[str]:
        """Get effect key from effect name"""
        for key, effect in self.effect_mapper.EFFECTS.items():
            if effect["name"].lower() == effect_name.lower():
                return key
        return None

    async def test_connection(self) -> bool:
        """
        Test connection to Gemini API

        Returns:
            True if connection successful, False otherwise
        """
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents="Say 'hello' in JSON format: {\"message\": \"hello\"}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            result = json.loads(response.text)
            return "message" in result
        except Exception as e:
            print(f"Gemini API connection test failed: {str(e)}")
            return False
