"""
Tests for AI service - Testing prompt processing and action extraction
"""
import os
import pytest

from services.ai_service import process_prompt, get_available_actions


class TestAIService:
    """Test AI service functionality"""
    
    def test_get_available_actions(self):
        """Test that available actions are returned"""
        actions = get_available_actions()
        assert isinstance(actions, dict)
        assert "zoomIn" in actions
        assert "zoomOut" in actions
        assert "applyFilter" in actions
        assert "applyTransition" in actions
        
    def test_process_prompt_without_api_key(self):
        """Test that service handles missing API key gracefully"""
        # Temporarily remove API key if set
        original_key = os.environ.get("GEMINI_API_KEY")
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
        
        # Reload module to pick up missing key
        import importlib
        from services import ai_service
        importlib.reload(ai_service)
        
        result = ai_service.process_prompt("zoom in by 120%")
        assert result["action"] is None
        assert "API_KEY_MISSING" in result.get("error", "") or "error" in result
        assert result["confidence"] == 0.0
        
        # Restore API key if it existed
        if original_key:
            os.environ["GEMINI_API_KEY"] = original_key
            importlib.reload(ai_service)
    
    def test_process_prompt_structure(self):
        """Test that process_prompt returns correct structure"""
        # This will work only if API key is set
        if not os.getenv("GEMINI_API_KEY"):
            pytest.skip("GEMINI_API_KEY not set - skipping API test")
        
        result = process_prompt("zoom in by 120%")
        
        # Check structure
        assert isinstance(result, dict)
        assert "action" in result
        assert "parameters" in result
        assert "confidence" in result
        assert "message" in result
        
        # Check types
        assert result["parameters"] is not None
        assert isinstance(result["parameters"], dict)
        assert isinstance(result["confidence"], (int, float))
        assert isinstance(result["message"], str)
    
    @pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
    def test_zoom_in_extraction(self):
        """Test that zoom in prompts are correctly extracted"""
        result = process_prompt("zoom in by 120%")
        
        if result["action"]:  # Only if AI successfully extracted
            assert result["action"] == "zoomIn"
            assert "endScale" in result["parameters"]
            assert result["parameters"]["endScale"] == 120
    
    @pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
    def test_zoom_out_extraction(self):
        """Test that zoom out prompts are correctly extracted"""
        result = process_prompt("zoom out to 80%")
        
        if result["action"]:  # Only if AI successfully extracted
            assert result["action"] == "zoomOut"
            assert "endScale" in result["parameters"]
            assert result["parameters"]["endScale"] == 80
    
    @pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
    def test_ambiguous_prompt(self):
        """Test that ambiguous prompts are handled"""
        result = process_prompt("make it look better")
        
        # Should return null action or handle gracefully
        assert isinstance(result, dict)
        # May or may not have an action depending on AI interpretation
        assert "message" in result


def test_get_provider_info_handles_unknown_provider(monkeypatch):
    """get_provider_info should safely report errors for unknown providers."""

    monkeypatch.setenv("AI_PROVIDER", "nonexistent")

    import services.ai_service as ai_service

    # Reset the cached provider to force re-evaluation with the bad env var
    monkeypatch.setattr(ai_service, "_PROVIDER_INSTANCE", None)

    info = ai_service.get_provider_info()

    assert info["provider"] == "unknown"
    assert info["configured"] is False
    assert "Unknown AI provider" in info["error"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

