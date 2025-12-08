"""
Question service for answering Premiere Pro questions using AI.
"""
from services.ai_service import _get_provider
from typing import List, Dict, Any

# Note: System prompt is now handled by the provider's process_question() method
# This keeps the prompt with the provider implementation for better maintainability


def process_question(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Process a Premiere Pro question using AI.
    
    Args:
        messages: List of message dicts with 'role' ('user'|'assistant') and 'content'
    
    Returns:
        Dict with 'message' (answer text) and optionally 'error'
    """
    provider = _get_provider()
    
    # Format messages for AI provider
    # Defensively extract only role and content, ensuring they're strings
    formatted_messages = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue  # Skip invalid entries
        formatted_messages.append({
            'role': str(msg.get('role', 'user')),
            'content': str(msg.get('content', ''))
        })
    
    # Use the dedicated question answering method
    # This is separate from action extraction and uses proper chat API
    response = provider.process_question(formatted_messages)
    
    # Ensure consistent return format
    return {
        'message': response.get('message', 'I\'m not sure—can you rephrase?'),
        'error': response.get('error')
    }

