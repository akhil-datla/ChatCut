"""
Tests for provider abstraction layer
"""
import os
import sys
import pytest

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_provider import AIProvider, AIProviderResult
from services.providers import GeminiProvider


class TestProviderAbstraction:
    """Test provider abstraction layer"""
    
    def test_ai_provider_result_success(self):
        """Test AIProviderResult success creation"""
        result = AIProviderResult.success(
            action="zoomIn",
            parameters={"endScale": 120},
            message="Zooming in"
        )
        
        assert result.action == "zoomIn"
        assert result.parameters == {"endScale": 120}
        assert result.confidence == 1.0
        assert result.message == "Zooming in"
        assert result.error is None
        
        # Test to_dict
        result_dict = result.to_dict()
        assert result_dict["action"] == "zoomIn"
        assert result_dict["parameters"] == {"endScale": 120}
    
    def test_ai_provider_result_failure(self):
        """Test AIProviderResult failure creation"""
        result = AIProviderResult.failure(
            message="Test error",
            error="TEST_ERROR"
        )
        
        assert result.action is None
        assert result.parameters == {}
        assert result.confidence == 0.0
        assert result.message == "Test error"
        assert result.error == "TEST_ERROR"
    
    def test_gemini_provider_interface(self):
        """Test that GeminiProvider implements AIProvider interface"""
        provider = GeminiProvider()
        
        # Check interface methods exist
        assert hasattr(provider, 'process_prompt')
        assert hasattr(provider, 'is_configured')
        assert hasattr(provider, 'get_provider_name')
        
        # Check provider name
        assert provider.get_provider_name() == "gemini"
        
        # Check configuration (without API key should be False)
        if not os.getenv("GEMINI_API_KEY"):
            assert provider.is_configured() == False
    
    def test_gemini_provider_without_key(self):
        """Test GeminiProvider handles missing API key gracefully"""
        provider = GeminiProvider()
        
        result = provider.process_prompt("zoom in by 120%")
        
        # Should return failure structure
        assert isinstance(result, dict)
        assert result["action"] is None
        assert result["error"] == "API_KEY_MISSING"
        assert result["confidence"] == 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

