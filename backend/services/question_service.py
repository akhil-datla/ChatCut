"""
Question service for answering Premiere Pro questions using AI.
"""
from services.ai_service import _get_provider
from typing import List, Dict, Any

PREMIERE_HELP_SYSTEM_PROMPT = """You are a Premiere Pro assistant trained on Premiere Pro workflows, UI navigation, and editing techniques.

Your role is to help users understand:
- How to use Premiere Pro features and effects
- Where to find specific tools and settings
- How to achieve desired editing outcomes
- Best practices for video editing in Premiere Pro

Guidelines:
- Provide step-by-step, actionable instructions
- Reference specific UI elements and menu paths when possible
- Keep responses concise and practical
- Focus on Premiere Pro-specific workflows
- If asked about something outside Premiere Pro, politely redirect

Examples:
- "How do I cut a clip?" → Explain Razor tool, keyboard shortcuts, timeline editing
- "Where is the blur effect?" → Guide to Effects panel, Video Effects > Blur & Sharpen
- "How to change clip proportions?" → Explain Motion effect, Scale parameter, or Transform effect
"""


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
    # Convert to provider's expected format (may need adapter)
    # Defensively extract only role and content, ensuring they're strings
    formatted_messages = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue  # Skip invalid entries
        formatted_messages.append({
            'role': str(msg.get('role', 'user')),
            'content': str(msg.get('content', ''))
        })
    
    # Use provider's chat completion method if available
    # Otherwise, construct prompt manually
    full_prompt = PREMIERE_HELP_SYSTEM_PROMPT + "\n\n"
    for msg in formatted_messages[-10:]:  # Last 10 messages for context
        role_label = "User" if msg['role'] == 'user' else "Assistant"
        full_prompt += f"{role_label}: {msg['content']}\n\n"
    
    full_prompt += "Assistant:"
    
    # Call AI provider (may need to add chat completion method)
    # For now, use existing process_prompt infrastructure
    # This is a simplification - may need provider-specific chat API
    response = provider.process_prompt(full_prompt, None)
    
    return {
        'message': response.get('message', 'I\'m not sure—can you rephrase?'),
        'error': response.get('error')
    }

