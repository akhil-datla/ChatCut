# AI Provider Guide

## Architecture Overview

The AI system uses an **abstraction layer** to support multiple AI providers without code changes.

```
┌─────────────────────────────────────────┐
│   Application Code                      │
│   (main.py, ai_service.py)              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   AI Provider Interface                 │
│   (ai_provider.py)                      │
│   - process_prompt()                    │
│   - is_configured()                    │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼──────┐      ┌───────▼─────┐
│ Gemini  │      │  OpenAI     │
│Provider │      │  Provider   │
└─────────┘      └─────────────┘
  (existing)      (future)
```

## Current Providers

### Gemini (Default)
- **Location**: `services/providers/gemini_provider.py`
- **Configuration**: Set `GEMINI_API_KEY` in `.env`
- **Status**: ✅ Implemented

### Future Providers

To add a new provider:

1. **Create provider class** in `services/providers/your_provider.py`:
```python
from ..ai_provider import AIProvider, AIProviderResult

class YourProvider(AIProvider):
    def __init__(self, api_key: Optional[str] = None):
        # Initialize your provider
        pass
    
    def is_configured(self) -> bool:
        # Check if provider is ready
        return True
    
    def get_provider_name(self) -> str:
        return "your_provider"
    
    def process_prompt(self, user_prompt: str) -> Dict[str, Any]:
        # Implement your provider logic
        # Return AIProviderResult.success() or .failure()
        pass
```

2. **Register in `ai_service.py`**:
```python
from .providers import GeminiProvider, YourProvider

def _get_provider() -> AIProvider:
    provider_type = os.getenv("AI_PROVIDER", "gemini").lower()
    
    if provider_type == "gemini":
        return GeminiProvider()
    elif provider_type == "your_provider":
        return YourProvider()
    # ...
```

3. **Export in `providers/__init__.py`**:
```python
from .gemini_provider import GeminiProvider
from .your_provider import YourProvider

__all__ = ['GeminiProvider', 'YourProvider']
```

## Switching Providers

### Via Environment Variable

Set `AI_PROVIDER` in your `.env` file:

```bash
# Use Gemini (default)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key

# Switch to OpenAI (when implemented)
AI_PROVIDER=openai
OPENAI_API_KEY=your_key

# Switch to Anthropic (when implemented)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key
```

### Check Current Provider

The `/health` endpoint shows which provider is active:

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "ai_provider": {
    "provider": "gemini",
    "configured": true
  }
}
```

## Provider Interface

All providers must implement:

```python
class AIProvider(ABC):
    @abstractmethod
    def process_prompt(self, user_prompt: str) -> Dict[str, Any]:
        """Process prompt and return structured result"""
        pass
    
    @abstractmethod
    def is_configured(self) -> bool:
        """Check if provider is ready"""
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Return provider name"""
        pass
```

## Return Format

All providers must return this structure:

```python
{
    "action": str | None,      # Action name or None
    "parameters": dict,        # Extracted parameters
    "confidence": float,       # 0.0 to 1.0
    "message": str,            # Human-readable message
    "error": str | None       # Error code if failed
}
```

Use `AIProviderResult` helper:
```python
# Success
return AIProviderResult.success(
    action="zoomIn",
    parameters={"endScale": 120},
    message="Zooming in to 120%"
).to_dict()

# Failure
return AIProviderResult.failure(
    message="Could not understand request",
    error="PARSE_ERROR"
).to_dict()
```

## Example: Adding OpenAI

1. Install: `pip install openai`
2. Create `services/providers/openai_provider.py`
3. Implement `OpenAIProvider(AIProvider)`
4. Register in `ai_service.py`
5. Set `AI_PROVIDER=openai` in `.env`

The rest of the codebase doesn't need to change!

