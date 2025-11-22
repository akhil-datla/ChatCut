"""
Manual test script for audio effects functionality

This script tests the AI's ability to recognize audio effect commands.
Run this to verify the backend can correctly parse audio-related prompts.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_service import process_prompt


def test_volume_adjustment():
    """Test volume adjustment prompts"""
    print("\n" + "="*60)
    print("TESTING VOLUME ADJUSTMENT PROMPTS")
    print("="*60)
    
    test_cases = [
        "adjust volume by 3 decibels",
        "make it louder by 6dB",
        "reduce volume by 3dB",
        "turn it down 6 decibels",
        "increase volume by 5dB",
        "make the audio quieter by 2dB",
    ]
    
    for prompt in test_cases:
        print(f"\n📝 Prompt: '{prompt}'")
        try:
            result = process_prompt(prompt)
            print(f"   Action: {result.get('action')}")
            print(f"   Parameters: {result.get('parameters')}")
            print(f"   Message: {result.get('message')}")
            
            if result.get('action') == 'adjustVolume':
                print("   ✅ PASS - Correctly identified as adjustVolume")
            else:
                print(f"   ⚠️  WARNING - Expected 'adjustVolume', got '{result.get('action')}'")
        except Exception as e:
            print(f"   ❌ ERROR: {e}")


def test_audio_filter_prompts():
    """Test audio filter application prompts"""
    print("\n" + "="*60)
    print("TESTING AUDIO FILTER PROMPTS")
    print("="*60)
    
    test_cases = [
        "add reverb",
        "apply parametric eq",
        "add noise reduction",
        "apply reverb effect",
        "add parametric equalizer",
    ]
    
    for prompt in test_cases:
        print(f"\n📝 Prompt: '{prompt}'")
        try:
            result = process_prompt(prompt)
            print(f"   Action: {result.get('action')}")
            print(f"   Parameters: {result.get('parameters')}")
            print(f"   Message: {result.get('message')}")
            
            if result.get('action') == 'applyAudioFilter':
                print("   ✅ PASS - Correctly identified as applyAudioFilter")
            else:
                print(f"   ⚠️  WARNING - Expected 'applyAudioFilter', got '{result.get('action')}'")
        except Exception as e:
            print(f"   ❌ ERROR: {e}")


def test_mixed_prompts():
    """Test prompts that might be ambiguous"""
    print("\n" + "="*60)
    print("TESTING MIXED/EDGE CASE PROMPTS")
    print("="*60)
    
    test_cases = [
        ("adjust volume by 3 decibels", "adjustVolume"),
        ("add reverb", "applyAudioFilter"),
        ("zoom in 120%", "zoomIn"),  # Should still work for video
        ("make it black and white", "applyFilter"),  # Video filter
    ]
    
    for prompt, expected_action in test_cases:
        print(f"\n📝 Prompt: '{prompt}'")
        print(f"   Expected: {expected_action}")
        try:
            result = process_prompt(prompt)
            action = result.get('action')
            print(f"   Got: {action}")
            
            if action == expected_action:
                print(f"   ✅ PASS")
            else:
                print(f"   ⚠️  WARNING - Expected '{expected_action}', got '{action}'")
        except Exception as e:
            print(f"   ❌ ERROR: {e}")


if __name__ == "__main__":
    print("\n🧪 Audio Effects Backend Tests")
    print("="*60)
    print("This tests the AI's ability to parse audio effect commands.")
    print("Make sure GEMINI_API_KEY is set in .env file")
    print("="*60)
    
    try:
        test_volume_adjustment()
        test_audio_filter_prompts()
        test_mixed_prompts()
        
        print("\n" + "="*60)
        print("✅ Tests completed!")
        print("="*60)
        print("\nNext steps:")
        print("1. Start backend: python main.py")
        print("2. Reload plugin in Premiere Pro")
        print("3. Test with actual audio clips in Premiere Pro")
        print("="*60)
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()

