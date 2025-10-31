"""
Manual test script - Run this to test the backend without pytest
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_service import process_prompt, get_available_actions


def test_basic():
    """Basic manual test"""
    print("=" * 50)
    print("ChatCut Backend Manual Test")
    print("=" * 50)
    
    # Test 1: Available actions
    print("\n1. Testing available actions...")
    actions = get_available_actions()
    print(f"   ✅ Found {len(actions)} actions: {list(actions.keys())}")
    
    # Test 2: API key check
    print("\n2. Checking API key...")
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        print(f"   ✅ API key found: {api_key[:10]}...")
    else:
        print("   ⚠️  API key not set. Set GEMINI_API_KEY to test AI features.")
        return
    
    # Test 3: Prompt processing
    print("\n3. Testing prompt processing...")
    test_prompts = [
        "zoom in by 120%",
        "zoom out to 80%",
        "zoom in gradually",
        "make it brighter",
    ]
    
    for prompt in test_prompts:
        print(f"\n   Testing: '{prompt}'")
        result = process_prompt(prompt)
        
        if result["action"]:
            print(f"   ✅ Action: {result['action']}")
            print(f"   ✅ Parameters: {result['parameters']}")
            print(f"   ✅ Confidence: {result['confidence']}")
            print(f"   ✅ Message: {result['message']}")
        else:
            print(f"   ⚠️  No action extracted: {result['message']}")
            if result.get("error"):
                print(f"   ❌ Error: {result['error']}")
    
    print("\n" + "=" * 50)
    print("Test complete!")
    print("=" * 50)


if __name__ == "__main__":
    test_basic()

