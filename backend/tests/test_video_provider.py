"""
Unit tests for video_provider process_media covering validation and error paths.
"""

import os
from pathlib import Path

import pytest

pytest.importorskip("requests")

from services.providers import video_provider


def test_missing_runway_api_key(monkeypatch, tmp_path):
    """When the API key is absent the provider should return a clear error."""

    monkeypatch.delenv("RUNWAY_API_KEY", raising=False)
    test_file = tmp_path / "video.mp4"
    test_file.write_bytes(b"dummy")

    result = video_provider.process_media("prompt", str(test_file))

    assert result["error"] == "API_KEY_MISSING"
    assert result["action"] is None


def test_file_not_found(monkeypatch, tmp_path):
    monkeypatch.setenv("RUNWAY_API_KEY", "dummy")
    missing_path = tmp_path / "missing.mp4"

    result = video_provider.process_media("prompt", str(missing_path))

    assert result["error"] == "FILE_NOT_FOUND"
    assert "File not found" in result["message"]


def test_file_too_large(monkeypatch, tmp_path):
    """Large files should be rejected before attempting base64 encoding."""

    monkeypatch.setenv("RUNWAY_API_KEY", "dummy")
    video_path = tmp_path / "huge.mp4"
    video_path.write_bytes(b"small")

    # Force the size check to exceed the limit so encoding is skipped
    monkeypatch.setattr(os.path, "getsize", lambda _: 20 * 1024 * 1024)

    result = video_provider.process_media("prompt", str(video_path))

    assert result["error"] == "FILE_TOO_LARGE"
    assert "File too large" in result["message"]
    assert result["action"] is None
