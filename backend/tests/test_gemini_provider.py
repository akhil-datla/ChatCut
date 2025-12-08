"""
Unit tests for GeminiProvider focusing on configuration, small talk handling,
content routing helpers, and error responses without hitting external APIs.
"""

import pytest

from services.providers.gemini_provider import GeminiProvider


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    """Speed up tests by removing the intentional delay."""

    monkeypatch.setattr("services.providers.gemini_provider.time.sleep", lambda _: None)
    yield


def test_missing_api_key_returns_failure(monkeypatch):
    """Provider should short-circuit when no API key is configured."""

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    provider = GeminiProvider()

    result = provider.process_prompt("hello")

    assert result["action"] is None
    assert result["error"] == "API_KEY_MISSING"
    assert "Gemini API not configured" in result["message"]


def test_small_talk_short_circuit(monkeypatch):
    """Small talk should not call the model when configuration is forced true."""

    provider = GeminiProvider(api_key="dummy")

    # Force configured state and deterministic small talk branch
    monkeypatch.setattr(provider, "is_configured", lambda: True)
    monkeypatch.setattr(provider, "_small_talk_reply", lambda prompt: "Hi there!")

    result = provider.process_prompt("hello")

    assert result["action"] is None
    assert result["error"] == "SMALL_TALK"
    assert "ChatCut" in result["message"] or "Hi" in result["message"]


@pytest.mark.parametrize(
    "prompt,expected",
    [
        ("please add reverb", True),
        ("boost the volume", True),
        ("zoom in the clip", False),
        ("what time is it", False),
    ],
)
def test_audio_detection_helper(prompt, expected):
    provider = GeminiProvider(api_key="dummy")
    assert provider._is_audio_request(prompt) is expected
