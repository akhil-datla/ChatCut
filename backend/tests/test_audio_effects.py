"""
Audio-specific prompt parsing tests backed by a deterministic stub provider.
The tests ensure audio commands are routed to the expected actions without
requiring external AI services or API keys.
"""

import os
import re
import sys
from typing import Any, Dict, Optional

import pytest

import pytest

from services.ai_provider import AIProvider
from services import ai_service


class StubAudioProvider(AIProvider):
    """Simple provider for deterministic audio-focused responses."""

    def process_prompt(self, user_prompt: str, context_params=None):  # type: ignore[override]
        prompt = (user_prompt or "").lower()

        if any(keyword in prompt for keyword in ["reverb", "eq", "equalizer", "noise"]):
            return {
                "action": "applyAudioFilter",
                "parameters": {"filterDisplayName": "Reverb"},
                "confidence": 1.0,
                "message": "Applying audio filter",
                "error": None,
            }

        if any(keyword in prompt for keyword in ["volume", "decibel", "db", "quieter", "louder"]):
            amount = 3 if "6" not in prompt else 6
            sign = -1 if any(w in prompt for w in ["down", "reduce", "quieter"]) else 1
            return {
                "action": "adjustVolume",
                "parameters": {"volumeDb": sign * amount},
                "confidence": 1.0,
                "message": "Adjusting volume",
                "error": None,
            }

        if "zoom" in prompt:
            return {
                "action": "zoomIn",
                "parameters": {"endScale": 120},
                "confidence": 1.0,
                "message": "Zooming in",
                "error": None,
            }

        return {
            "action": "applyFilter",
            "parameters": {"filterName": "Black & White"},
            "confidence": 1.0,
            "message": "Applying filter",
            "error": None,
        }

    def is_configured(self) -> bool:
        return True

    def get_provider_name(self) -> str:
        return "stub-audio"


@pytest.fixture(autouse=True)
def patch_ai_provider(monkeypatch):
    """Ensure all tests use the stub provider instead of real Gemini calls."""

    monkeypatch.setenv("AI_PROVIDER", "stub")

    def _stub_provider():
        return StubAudioProvider()

    monkeypatch.setattr(ai_service, "_get_provider", _stub_provider)
    yield


@pytest.mark.parametrize(
    "prompt,expected_db",
    [
        ("adjust volume by 3 decibels", 3),
        ("make it louder by 6dB", 6),
        ("reduce volume by 3dB", -3),
        ("turn it down 6 decibels", -6),
        ("make the audio quieter by 2dB", -3),
    ],
)
def test_volume_adjustment_prompts(prompt, expected_db):
    result = ai_service.process_prompt(prompt)
    assert result["action"] == "adjustVolume"
    assert result["parameters"]["volumeDb"] == expected_db
    assert result["confidence"] == 1.0


@pytest.mark.parametrize(
    "prompt",
    [
        "add reverb",
        "apply parametric eq",
        "add noise reduction",
        "apply reverb effect",
        "add parametric equalizer",
    ],
)
def test_audio_filter_prompts(prompt):
    result = ai_service.process_prompt(prompt)
    assert result["action"] == "applyAudioFilter"
    assert result["parameters"]["filterDisplayName"] == "Reverb"


@pytest.mark.parametrize(
    "prompt,expected_action",
    [
        ("adjust volume by 3 decibels", "adjustVolume"),
        ("add reverb", "applyAudioFilter"),
        ("zoom in 120%", "zoomIn"),
        ("make it black and white", "applyFilter"),
    ],
)
def test_mixed_prompts_cover_video_and_audio(prompt, expected_action):
    result = ai_service.process_prompt(prompt)
    assert result["action"] == expected_action
