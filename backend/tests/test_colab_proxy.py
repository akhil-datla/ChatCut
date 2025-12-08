"""
Tests for Colab Proxy Service - Testing Colab server communication
"""
import os
import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, mock_open
import requests

from services.colab_proxy import (
    start_colab_job,
    get_colab_progress,
    check_colab_health,
    download_colab_video,
    _normalize_colab_url
)


class TestColabProxyURLNormalization:
    """Test URL normalization helper"""
    
    def test_normalize_url_with_https(self):
        """Test URL already has https://"""
        assert _normalize_colab_url("https://abc123.ngrok.io") == "https://abc123.ngrok.io"
    
    def test_normalize_url_with_http(self):
        """Test URL has http://"""
        assert _normalize_colab_url("http://abc123.ngrok.io") == "http://abc123.ngrok.io"
    
    def test_normalize_url_without_protocol(self):
        """Test URL without protocol gets https:// added"""
        assert _normalize_colab_url("abc123.ngrok.io") == "https://abc123.ngrok.io"
    
    def test_normalize_url_removes_trailing_slash(self):
        """Test trailing slash is removed"""
        assert _normalize_colab_url("https://abc123.ngrok.io/") == "https://abc123.ngrok.io"
    
    def test_normalize_url_strips_whitespace(self):
        """Test whitespace is stripped"""
        assert _normalize_colab_url("  https://abc123.ngrok.io  ") == "https://abc123.ngrok.io"


class TestColabProxyStartJob:
    """Test start_colab_job function"""
    
    @pytest.fixture
    def temp_video_file(self):
        """Create a temporary video file for testing"""
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as f:
            f.write(b'fake video content')
            temp_path = f.name
        yield temp_path
        # Cleanup
        if os.path.exists(temp_path):
            os.unlink(temp_path)
    
    def test_start_job_success(self, temp_video_file):
        """Test successful job start"""
        with patch('services.colab_proxy.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "job_id": "abc12345",
                "status": "started",
                "message": "Processing started"
            }
            mock_post.return_value = mock_response
            
            result = start_colab_job(
                temp_video_file,
                "zoom on the person",
                "https://test.ngrok.io"
            )
            
            assert result["job_id"] == "abc12345"
            assert result["status"] == "started"
            assert result["error"] is None
            mock_post.assert_called_once()
    
    def test_start_job_file_not_found(self):
        """Test error when file doesn't exist"""
        result = start_colab_job(
            "/nonexistent/file.mp4",
            "test prompt",
            "https://test.ngrok.io"
        )
        
        assert result["job_id"] is None
        assert result["status"] == "error"
        assert result["error"] == "FILE_NOT_FOUND"
        assert "not found" in result["message"].lower()
    
    def test_start_job_file_not_readable(self, temp_video_file):
        """Test error when file is not readable"""
        # Make file unreadable (if possible)
        try:
            os.chmod(temp_video_file, 0o000)
            result = start_colab_job(
                temp_video_file,
                "test prompt",
                "https://test.ngrok.io"
            )
            # On some systems, chmod might not work, so check if we got the error
            if result["error"] == "FILE_ACCESS_ERROR":
                assert result["job_id"] is None
                assert result["status"] == "error"
        finally:
            os.chmod(temp_video_file, 0o644)
    
    def test_start_job_colab_server_error(self, temp_video_file):
        """Test error when Colab server returns error"""
        with patch('services.colab_proxy.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_response.text = "Internal Server Error"
            mock_post.return_value = mock_response
            
            result = start_colab_job(
                temp_video_file,
                "test prompt",
                "https://test.ngrok.io"
            )
            
            assert result["job_id"] is None
            assert result["status"] == "error"
            assert result["error"] == "COLAB_SERVER_ERROR"
    
    def test_start_job_no_job_id_in_response(self, temp_video_file):
        """Test error when Colab doesn't return job_id"""
        with patch('services.colab_proxy.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "started",
                "message": "Processing started"
                # Missing job_id
            }
            mock_post.return_value = mock_response
            
            result = start_colab_job(
                temp_video_file,
                "test prompt",
                "https://test.ngrok.io"
            )
            
            assert result["job_id"] is None
            assert result["status"] == "error"
            assert result["error"] == "NO_JOB_ID"
    
    def test_start_job_network_error(self, temp_video_file):
        """Test error when network request fails"""
        with patch('services.colab_proxy.requests.post') as mock_post:
            mock_post.side_effect = requests.exceptions.ConnectionError("Connection failed")
            
            result = start_colab_job(
                temp_video_file,
                "test prompt",
                "https://test.ngrok.io"
            )
            
            assert result["job_id"] is None
            assert result["status"] == "error"
            assert result["error"] == "NETWORK_ERROR"
            assert "connect" in result["message"].lower()
    
    def test_start_job_timeout(self, temp_video_file):
        """Test error when request times out"""
        with patch('services.colab_proxy.requests.post') as mock_post:
            mock_post.side_effect = requests.exceptions.Timeout("Request timed out")
            
            result = start_colab_job(
                temp_video_file,
                "test prompt",
                "https://test.ngrok.io"
            )
            
            assert result["job_id"] is None
            assert result["status"] == "error"
            assert result["error"] == "NETWORK_ERROR"
    
    def test_start_job_with_trim_info(self, temp_video_file):
        """Test job start with trim info (should be accepted but not yet used by Colab)"""
        with patch('services.colab_proxy.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "job_id": "abc12345",
                "status": "started"
            }
            mock_post.return_value = mock_response
            
            result = start_colab_job(
                temp_video_file,
                "test prompt",
                "https://test.ngrok.io",
                trim_info={"trim_start": 1.0, "trim_end": 5.0}
            )
            
            assert result["job_id"] == "abc12345"
            # Trim info is accepted but not yet sent to Colab (future enhancement)


class TestColabProxyGetProgress:
    """Test get_colab_progress function"""
    
    def test_get_progress_processing(self):
        """Test progress check when job is still processing"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "processing",
                "stage": "tracking",
                "progress": 45,
                "message": "Tracking frame 100/200..."
            }
            mock_get.return_value = mock_response
            
            result = get_colab_progress("abc12345", "https://test.ngrok.io")
            
            assert result["status"] == "processing"
            assert result["stage"] == "tracking"
            assert result["progress"] == 45
            assert result["output_path"] is None
            assert result["error"] is None
    
    def test_get_progress_complete(self):
        """Test progress check when job is complete"""
        with patch('services.colab_proxy.requests.get') as mock_get, \
             patch('services.colab_proxy.download_colab_video') as mock_download:
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "complete",
                "stage": "complete",
                "progress": 100,
                "message": "Processing complete!",
                "download_url": "/download/processed_video.mp4",
                "filename": "processed_video.mp4"
            }
            mock_get.return_value = mock_response
            mock_download.return_value = "/path/to/output/processed_video.mp4"
            
            result = get_colab_progress("abc12345", "https://test.ngrok.io")
            
            assert result["status"] == "complete"
            assert result["progress"] == 100
            assert result["output_path"] == "/path/to/output/processed_video.mp4"
            assert result["error"] is None
            mock_download.assert_called_once()
    
    def test_get_progress_complete_no_download_url(self):
        """Test error when complete but no download URL"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "complete",
                "stage": "complete",
                "progress": 100,
                "message": "Processing complete!"
                # Missing download_url and filename
            }
            mock_get.return_value = mock_response
            
            result = get_colab_progress("abc12345", "https://test.ngrok.io")
            
            assert result["status"] == "error"
            assert result["error"] == "NO_DOWNLOAD_URL"
            assert "download URL" in result["message"]
    
    def test_get_progress_error(self):
        """Test progress check when job has error"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "error",
                "stage": "rendering",
                "progress": 85,
                "error": "Rendering failed",
                "message": "Error during rendering"
            }
            mock_get.return_value = mock_response
            
            result = get_colab_progress("abc12345", "https://test.ngrok.io")
            
            assert result["status"] == "error"
            assert result["error"] == "JOB_FAILED"
            assert "failed" in result["message"].lower()
    
    def test_get_progress_not_found(self):
        """Test progress check when job not found"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "not_found",
                "error": "Job abc12345 not found"
            }
            mock_get.return_value = mock_response
            
            result = get_colab_progress("abc12345", "https://test.ngrok.io")
            
            # Status "not_found" should be passed through
            assert result["status"] == "not_found"
    
    def test_get_progress_http_error(self):
        """Test error when HTTP request fails"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 404
            mock_get.return_value = mock_response
            
            result = get_colab_progress("abc12345", "https://test.ngrok.io")
            
            assert result["status"] == "error"
            assert result["error"] == "PROGRESS_CHECK_FAILED"
    
    def test_get_progress_network_error(self):
        """Test error when network request fails"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_get.side_effect = requests.exceptions.ConnectionError("Connection failed")
            
            result = get_colab_progress("abc12345", "https://test.ngrok.io")
            
            assert result["status"] == "error"
            assert result["error"] == "NETWORK_ERROR"


class TestColabProxyHealthCheck:
    """Test check_colab_health function"""
    
    def test_health_check_success(self):
        """Test successful health check"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "ok",
                "gpu": "T4"
            }
            mock_get.return_value = mock_response
            
            result = check_colab_health("https://test.ngrok.io")
            
            assert result["healthy"] is True
            assert result["status"] == "ok"
            assert result["gpu"] == "T4"
            assert result["error"] is None
    
    def test_health_check_failed_status(self):
        """Test health check when server returns error status"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_get.return_value = mock_response
            
            result = check_colab_health("https://test.ngrok.io")
            
            assert result["healthy"] is False
            assert result["status"] == "error"
    
    def test_health_check_network_error(self):
        """Test health check when network fails"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_get.side_effect = requests.exceptions.ConnectionError("Connection failed")
            
            result = check_colab_health("https://test.ngrok.io")
            
            assert result["healthy"] is False
            assert result["status"] == "error"
            assert "connect" in result["error"].lower()
    
    def test_health_check_timeout(self):
        """Test health check when request times out"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_get.side_effect = requests.exceptions.Timeout("Request timed out")
            
            result = check_colab_health("https://test.ngrok.io")
            
            assert result["healthy"] is False
            assert result["status"] == "error"


class TestColabProxyDownloadVideo:
    """Test download_colab_video function"""
    
    @pytest.fixture
    def output_dir(self):
        """Create output directory for testing"""
        output_dir = Path("output")
        output_dir.mkdir(exist_ok=True)
        yield output_dir
        # Cleanup test files
        for file in output_dir.glob("test_*.mp4"):
            file.unlink()
    
    def test_download_video_success_relative_url(self, output_dir):
        """Test successful video download with relative URL"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.content = b'fake video content'
            mock_get.return_value = mock_response
            
            result = download_colab_video(
                "/download/processed_video.mp4",
                "https://test.ngrok.io",
                "test_processed_video.mp4"
            )
            
            assert result is not None
            assert result.endswith("test_processed_video.mp4")
            assert Path(result).exists()
            assert Path(result).read_bytes() == b'fake video content'
            
            # Cleanup
            Path(result).unlink()
    
    def test_download_video_success_absolute_url(self, output_dir):
        """Test successful video download with absolute URL"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.content = b'fake video content'
            mock_get.return_value = mock_response
            
            result = download_colab_video(
                "https://test.ngrok.io/download/processed_video.mp4",
                "https://test.ngrok.io",
                "test_processed_video2.mp4"
            )
            
            assert result is not None
            assert Path(result).exists()
            
            # Cleanup
            Path(result).unlink()
    
    def test_download_video_http_error(self):
        """Test error when download HTTP request fails"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 404
            mock_get.return_value = mock_response
            
            result = download_colab_video(
                "/download/processed_video.mp4",
                "https://test.ngrok.io",
                "test_video.mp4"
            )
            
            assert result is None
    
    def test_download_video_network_error(self):
        """Test error when download network fails"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_get.side_effect = requests.exceptions.ConnectionError("Connection failed")
            
            result = download_colab_video(
                "/download/processed_video.mp4",
                "https://test.ngrok.io",
                "test_video.mp4"
            )
            
            assert result is None
    
    def test_download_video_timeout(self):
        """Test error when download times out"""
        with patch('services.colab_proxy.requests.get') as mock_get:
            mock_get.side_effect = requests.exceptions.Timeout("Request timed out")
            
            result = download_colab_video(
                "/download/processed_video.mp4",
                "https://test.ngrok.io",
                "test_video.mp4"
            )
            
            assert result is None

