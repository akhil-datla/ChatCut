#!/usr/bin/env python3
"""
Quick test script for the new question service implementation.
Run this to verify the question answering works correctly.
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.question_service import process_question

def test_question_service():
    """Test the question service with a simple question"""
    print("Testing question service...")
    print("-" * 50)
    
    # Test 1: Simple question
    print("\nTest 1: Simple question about Premiere Pro")
    messages = [
        {
            'role': 'user',
            'content': 'How do I cut a clip in Premiere Pro?'
        }
    ]
    
    try:
        response = process_question(messages)
        print(f"Response: {response.get('message', 'No message')}")
        print(f"Error: {response.get('error', 'None')}")
        
        if response.get('error'):
            print(f"❌ Test failed with error: {response.get('error')}")
            return False
        elif not response.get('message'):
            print("❌ Test failed: No message returned")
            return False
        else:
            print("✅ Test 1 passed!")
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 2: Conversation history
    print("\nTest 2: Conversation history")
    messages = [
        {
            'role': 'user',
            'content': 'What are some good color changing video effects?'
        },
        {
            'role': 'assistant',
            'content': 'Some popular color effects include Lumetri Color, Color Correction, and Color Grading effects.'
        },
        {
            'role': 'user',
            'content': 'How do I apply Lumetri Color?'
        }
    ]
    
    try:
        response = process_question(messages)
        print(f"Response: {response.get('message', 'No message')}")
        print(f"Error: {response.get('error', 'None')}")
        
        if response.get('error'):
            print(f"❌ Test failed with error: {response.get('error')}")
            return False
        elif not response.get('message'):
            print("❌ Test failed: No message returned")
            return False
        else:
            print("✅ Test 2 passed!")
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 3: Verify no action extraction
    print("\nTest 3: Verify no action extraction (should return text, not JSON)")
    messages = [
        {
            'role': 'user',
            'content': 'Where is the blur effect located?'
        }
    ]
    
    try:
        response = process_question(messages)
        message = response.get('message', '')
        
        # Check if response looks like JSON (action extraction)
        if message.strip().startswith('{') and '"action"' in message:
            print(f"❌ Test failed: Response looks like action extraction: {message[:100]}")
            return False
        else:
            print(f"✅ Test 3 passed! Response is text-based: {message[:100]}...")
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 50)
    print("✅ All tests passed!")
    return True

if __name__ == '__main__':
    success = test_question_service()
    sys.exit(0 if success else 1)

