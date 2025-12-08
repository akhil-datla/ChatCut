"""
Tests for API endpoints - Testing FastAPI endpoints
"""
import os
import pytest

pytest.importorskip("fastapi")

from fastapi.testclient import TestClient
from main import app


class TestAPIEndpoints:
    """Test API endpoint functionality"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)

    def test_ping_endpoint(self, client):
        """Test ping endpoint works"""
        response = client.post("/api/ping", json={"message": "test"})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["received"] == "test"

    def test_health_endpoint(self, client):
        """Test health endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_process_prompt_endpoint_structure(self, client):
        """Test process-prompt endpoint returns correct structure"""
        response = client.post("/api/process-prompt", json={"prompt": "zoom in by 120%"})
        assert response.status_code == 200
        data = response.json()

        # Check structure
        assert "action" in data
        assert "parameters" in data
        assert "confidence" in data
        assert "message" in data

        # Check types
        assert isinstance(data["parameters"], dict)
        assert isinstance(data["confidence"], (int, float))

    def test_process_prompt_missing_field(self, client):
        """Test that missing prompt field returns error"""
        response = client.post("/api/process-prompt", json={})
        assert response.status_code == 422  # Validation error

    def test_process_prompt_empty_string(self, client):
        """Test that empty prompt is handled"""
        response = client.post("/api/process-prompt", json={"prompt": ""})
        assert response.status_code == 200
        data = response.json()
        # Should return some response (may be null action if empty)
        assert isinstance(data, dict)

    def test_process_media_missing_file(self, client):
        """Process media should gracefully report missing files."""
        response = client.post(
            "/api/process-media",
            json={"prompt": "test", "filePath": "/tmp/nonexistent.mp4"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["error"] == "FILE_NOT_FOUND"
        assert data["action"] is None

    def test_process_object_tracking_with_stub(self, client, tmp_path, monkeypatch):
        """Verify object-tracking endpoint validates file access and returns provider response."""
        dummy_file = tmp_path / "sample.mp4"
        dummy_file.write_bytes(b"data")

        def _stub_process(prompt, file_path):
            return {
                "action": "trackObjects",
                "message": "tracking",
                "error": None,
                "confidence": 0.9,
                "tracked_objects": ["person"],
                "tracking_data": {"frames": 10},
            }

        monkeypatch.setattr("services.providers.object_tracking_provider.process_object_tracking", _stub_process)

        response = client.post(
            "/api/process-object-tracking",
            json={"prompt": "track", "filePath": str(dummy_file)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "trackObjects"
        assert data["tracked_objects"] == ["person"]
        assert data["tracking_data"] == {"frames": 10}

    def test_health_endpoint_reports_provider_info(self, client, monkeypatch):
        """Health route should surface provider metadata even on failures."""

        monkeypatch.setattr(
            "services.ai_service.get_provider_info",
            lambda: {"provider": "stub", "configured": True},
        )

        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["ai_provider"] == {"provider": "stub", "configured": True}

    def test_process_media_permission_error(self, client, tmp_path, monkeypatch):
        """Process media should surface unreadable file errors before provider call."""

        blocked_file = tmp_path / "blocked.mp4"
        blocked_file.write_bytes(b"data")

        def _deny_access(path, mode=None):
            return False if str(path) == str(blocked_file) else os.access(path, mode)

        monkeypatch.setattr(os, "access", _deny_access)

        response = client.post(
            "/api/process-media",
            json={"prompt": "test", "filePath": str(blocked_file)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["error"] == "FILE_ACCESS_ERROR"
        assert data["action"] is None

    def test_process_object_tracking_missing_file(self, client):
        """Object tracking endpoint should flag missing files clearly."""

        response = client.post(
            "/api/process-object-tracking",
            json={"prompt": "track", "filePath": "/tmp/does-not-exist.mp4"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["error"] == "FILE_NOT_FOUND"
        assert data["action"] is None

    def test_colab_start_missing_file(self, client):
        """Colab start endpoint should flag missing files."""
        response = client.post(
            "/api/colab-start",
            json={
                "file_path": "/tmp/nonexistent.mp4",
                "prompt": "zoom on person",
                "colab_url": "https://test.ngrok.io"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["error"] == "FILE_NOT_FOUND"
        assert data["job_id"] is None

    def test_colab_start_missing_fields(self, client):
        """Colab start endpoint should validate required fields."""
        # Missing colab_url
        response = client.post(
            "/api/colab-start",
            json={
                "file_path": "/tmp/test.mp4",
                "prompt": "test"
            }
        )
        assert response.status_code == 422  # Validation error

    def test_colab_start_success(self, client, tmp_path, monkeypatch):
        """Colab start endpoint should start job successfully."""
        test_file = tmp_path / "test.mp4"
        test_file.write_bytes(b"fake video")

        def _mock_start_job(file_path, prompt, colab_url, trim_info=None):
            return {
                "job_id": "test123",
                "status": "started",
                "message": "Processing started",
                "error": None
            }

        monkeypatch.setattr("services.colab_proxy.start_colab_job", _mock_start_job)

        response = client.post(
            "/api/colab-start",
            json={
                "file_path": str(test_file),
                "prompt": "zoom on person",
                "colab_url": "https://test.ngrok.io"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == "test123"
        assert data["status"] == "started"
        assert data["error"] is None

    def test_colab_start_with_trim_info(self, client, tmp_path, monkeypatch):
        """Colab start endpoint should accept trim info."""
        test_file = tmp_path / "test.mp4"
        test_file.write_bytes(b"fake video")

        def _mock_start_job(file_path, prompt, colab_url, trim_info=None):
            return {
                "job_id": "test123",
                "status": "started",
                "message": "Processing started",
                "error": None
            }

        monkeypatch.setattr("services.colab_proxy.start_colab_job", _mock_start_job)

        response = client.post(
            "/api/colab-start",
            json={
                "file_path": str(test_file),
                "prompt": "zoom on person",
                "colab_url": "https://test.ngrok.io",
                "trim_start": 1.0,
                "trim_end": 5.0
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == "test123"

    def test_colab_progress_missing_fields(self, client):
        """Colab progress endpoint should validate required fields."""
        response = client.post(
            "/api/colab-progress",
            json={
                "job_id": "test123"
                # Missing colab_url
            }
        )
        assert response.status_code == 422  # Validation error

    def test_colab_progress_processing(self, client, monkeypatch):
        """Colab progress endpoint should return processing status."""
        def _mock_get_progress(job_id, colab_url, original_filename="video"):
            return {
                "status": "processing",
                "stage": "tracking",
                "progress": 45,
                "message": "Tracking frames...",
                "output_path": None,
                "error": None
            }

        monkeypatch.setattr("services.colab_proxy.get_colab_progress", _mock_get_progress)

        response = client.post(
            "/api/colab-progress",
            json={
                "job_id": "test123",
                "colab_url": "https://test.ngrok.io",
                "original_filename": "test.mp4"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert data["progress"] == 45
        assert data["output_path"] is None

    def test_colab_progress_complete(self, client, monkeypatch):
        """Colab progress endpoint should return complete status with output path."""
        def _mock_get_progress(job_id, colab_url, original_filename="video"):
            return {
                "status": "complete",
                "stage": "complete",
                "progress": 100,
                "message": "Processing complete!",
                "output_path": "/path/to/output/processed_video.mp4",
                "error": None
            }

        monkeypatch.setattr("services.colab_proxy.get_colab_progress", _mock_get_progress)

        response = client.post(
            "/api/colab-progress",
            json={
                "job_id": "test123",
                "colab_url": "https://test.ngrok.io"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "complete"
        assert data["progress"] == 100
        assert data["output_path"] == "/path/to/output/processed_video.mp4"

    def test_colab_health_missing_fields(self, client):
        """Colab health endpoint should validate required fields."""
        response = client.post(
            "/api/colab-health",
            json={}
        )
        assert response.status_code == 422  # Validation error

    def test_colab_health_success(self, client, monkeypatch):
        """Colab health endpoint should return healthy status."""
        def _mock_check_health(colab_url):
            return {
                "healthy": True,
                "status": "ok",
                "gpu": "T4",
                "error": None
            }

        monkeypatch.setattr("services.colab_proxy.check_colab_health", _mock_check_health)

        response = client.post(
            "/api/colab-health",
            json={
                "colab_url": "https://test.ngrok.io"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["healthy"] is True
        assert data["status"] == "ok"
        assert data["gpu"] == "T4"

    def test_colab_health_unhealthy(self, client, monkeypatch):
        """Colab health endpoint should return unhealthy status."""
        def _mock_check_health(colab_url):
            return {
                "healthy": False,
                "status": "error",
                "error": "Connection failed"
            }

        monkeypatch.setattr("services.colab_proxy.check_colab_health", _mock_check_health)

        response = client.post(
            "/api/colab-health",
            json={
                "colab_url": "https://test.ngrok.io"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["healthy"] is False
        assert data["status"] == "error"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
