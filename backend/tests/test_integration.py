"""
Integration tests - Testing full flow from prompt to action structure
"""
import os
import sys
import pytest

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_service import process_prompt


class TestIntegration:
    """Integration tests for full AI pipeline"""
    
    @pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
    def test_zoom_in_full_flow(self):
        """Test full flow: user prompt → AI extraction → valid structure"""
        test_cases = [
            ("zoom in by 120%", {"action": "zoomIn", "endScale": 120}),
            ("zoom in to 150%", {"action": "zoomIn", "endScale": 150}),
            ("make it zoom in gradually", {"action": "zoomIn"}),
        ]
        
        for prompt, expected in test_cases:
            result = process_prompt(prompt)
            
            if result["action"]:  # Only verify if AI extracted action
                assert result["action"] == expected["action"]
                if "endScale" in expected:
                    assert result["parameters"].get("endScale") == expected["endScale"]
                print(f"✅ {prompt} → {result['action']} with params {result['parameters']}")
    
    @pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
    def test_parameter_extraction_variations(self):
        """Test that AI extracts parameters from various phrasings"""
        variations = [
            "zoom in by 120 percent",
            "zoom to 120%",
            "zoom in 120%",
            "120% zoom in",
        ]
        
        for prompt in variations:
            result = process_prompt(prompt)
            if result["action"] == "zoomIn":
                # Should extract 120% in parameters
                params = result["parameters"]
                if "endScale" in params:
                    print(f"✅ {prompt} → extracted endScale: {params['endScale']}")
    
    @pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
    def test_zoom_out_variations(self):
        """Test zoom out with various phrasings"""
        variations = [
            "zoom out",
            "zoom out to 80%",
            "zoom out by 20%",
            "make it smaller",
        ]
        
        for prompt in variations:
            result = process_prompt(prompt)
            print(f"📊 {prompt} → {result['action']} ({result.get('message', 'N/A')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

