"""
Tests for API endpoints - Testing FastAPI endpoints
"""
import os
import sys
import pytest

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

