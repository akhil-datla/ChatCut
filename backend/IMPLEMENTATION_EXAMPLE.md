# Phase 1 Implementation Example: Function Calling

This shows how to refactor `GeminiProvider` to use structured function calling instead of the monolithic prompt.

## Before (Current Approach)

```python
# 600+ line system prompt with all actions, examples, rules embedded
system_prompt = """You are a video editing assistant...
[600 lines of instructions]
"""

response = model.generate_content(system_prompt + user_prompt)
# Parse JSON from response text
```

## After (Function Calling Approach)

### Step 1: Create Action Schema Registry

```python
# backend/services/action_schemas.py

def get_action_schemas():
    """Return function declarations for Gemini function calling"""
    return [
        {
            "name": "zoomIn",
            "description": "Zoom in on video clip. Increases scale percentage.",
            "parameters": {
                "type": "object",
                "properties": {
                    "endScale": {
                        "type": "number",
                        "description": "Target zoom scale as percentage (100 = original, 150 = 1.5x larger). Default: 150 if not specified."
                    },
                    "startScale": {
                        "type": "number",
                        "description": "Starting zoom scale (only if user specifies 'from X to Y'). Default: 100."
                    },
                    "animated": {
                        "type": "boolean",
                        "description": "Whether to animate zoom over time. TRUE for 'slow', 'gradual', 'ken burns'. FALSE for static zoom (default)."
                    },
                    "duration": {
                        "type": "number",
                        "description": "Duration of animation in seconds (optional, uses full clip if not specified)."
                    },
                    "interpolation": {
                        "type": "string",
                        "enum": ["LINEAR", "BEZIER", "HOLD", "EASE_IN", "EASE_OUT"],
                        "description": "Animation curve. BEZIER is default for animated zooms."
                    }
                },
                "required": ["endScale"]
            }
        },
        {
            "name": "zoomOut",
            "description": "Zoom out on video clip. Decreases scale percentage.",
            "parameters": {
                "type": "object",
                "properties": {
                    "endScale": {"type": "number", "description": "Target zoom scale (default: 100)"},
                    "startScale": {"type": "number", "description": "Starting zoom scale (default: 150)"},
                    "animated": {"type": "boolean", "description": "Whether to animate (default: false)"},
                    "duration": {"type": "number", "description": "Duration in seconds (optional)"},
                    "interpolation": {"type": "string", "enum": ["LINEAR", "BEZIER", "HOLD", "EASE_IN", "EASE_OUT"]}
                },
                "required": ["endScale"]
            }
        },
        {
            "name": "applyBlur",
            "description": "Apply Gaussian blur effect to video clip.",
            "parameters": {
                "type": "object",
                "properties": {
                    "blurAmount": {
                        "type": "number",
                        "description": "Blur amount (0-500, practical range 10-100). Default: 50 if not specified."
                    }
                },
                "required": ["blurAmount"]
            }
        },
        {
            "name": "applyFilter",
            "description": "Apply a video filter/effect to clip. Use exact filter matchName from Premiere Pro.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filterName": {
                        "type": "string",
                        "description": "Exact filter matchName (e.g., 'AE.ADBE Black & White', 'AE.ADBE Gaussian Blur 2')"
                    }
                },
                "required": ["filterName"]
            }
        },
        {
            "name": "applyTransition",
            "description": "Apply a transition effect between clips.",
            "parameters": {
                "type": "object",
                "properties": {
                    "transitionName": {
                        "type": "string",
                        "description": "Exact transition matchName (e.g., 'AE.ADBE Cross Dissolve New')"
                    },
                    "duration": {
                        "type": "number",
                        "description": "Duration in seconds (default: 1.0)"
                    },
                    "applyToStart": {
                        "type": "boolean",
                        "description": "Apply to start (true) or end (false) of clip (default: true)"
                    }
                },
                "required": ["transitionName"]
            }
        },
        {
            "name": "modifyParameter",
            "description": "Modify an effect parameter after effect is applied.",
            "parameters": {
                "type": "object",
                "properties": {
                    "parameterName": {
                        "type": "string",
                        "description": "Name of parameter to modify (e.g., 'Horizontal Blocks', 'Blurriness', 'Opacity')"
                    },
                    "value": {
                        "type": "number",
                        "description": "New value for the parameter"
                    },
                    "componentName": {
                        "type": "string",
                        "description": "Optional: Name of effect containing parameter (e.g., 'Mosaic', 'Gaussian Blur')"
                    }
                },
                "required": ["parameterName", "value"]
            }
        },
        {
            "name": "adjustVolume",
            "description": "Adjust volume of audio clip in decibels.",
            "parameters": {
                "type": "object",
                "properties": {
                    "volumeDb": {
                        "type": "number",
                        "description": "Volume adjustment in dB (positive = louder, negative = quieter, e.g., 3 = +3dB)"
                    }
                },
                "required": ["volumeDb"]
            }
        },
        {
            "name": "applyAudioFilter",
            "description": "Apply an audio effect/filter to audio clip.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filterDisplayName": {
                        "type": "string",
                        "description": "Display name of audio filter (e.g., 'Reverb', 'Parametric EQ', 'DeNoise')"
                    }
                },
                "required": ["filterDisplayName"]
            }
        }
    ]
```

### Step 2: Refactor GeminiProvider

```python
# backend/services/providers/gemini_provider.py (simplified)

from .action_schemas import get_action_schemas

class GeminiProvider(AIProvider):
    def process_prompt(self, user_prompt: str, context_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process prompt using Gemini function calling"""
        
        # Small talk check (keep existing)
        small_talk_msg = self._small_talk_reply(user_prompt)
        if small_talk_msg:
            return AIProviderResult.failure(message=small_talk_msg, error="SMALL_TALK").to_dict()
        
        model = genai.GenerativeModel(self.model_name)
        
        # Build tools from schemas
        tools = [{
            "function_declarations": get_action_schemas()
        }]
        
        # Simple system instruction (no massive prompt!)
        system_instruction = """You are a video editing assistant. 
Extract the user's intent and call the appropriate function with correct parameters.
- For zoom: extract scale percentages, animation preferences, timing
- For filters/transitions: use exact matchName values from Premiere Pro
- If user requests multiple edits, you can call multiple functions
- If uncertain about filter/transition name, ask for clarification"""
        
        # Format context if available
        messages = []
        if context_params:
            messages.append({
                "role": "user",
                "parts": [f"Context: Current effect parameters: {json.dumps(context_params)}"]
            })
        
        messages.append({
            "role": "user",
            "parts": [user_prompt]
        })
        
        # Generate with function calling
        response = model.generate_content(
            messages,
            tools=tools,
            system_instruction=system_instruction
        )
        
        # Extract function call from response
        if response.candidates[0].content.parts[0].function_call:
            function_call = response.candidates[0].content.parts[0].function_call
            action_name = function_call.name
            parameters = dict(function_call.args)
            
            return AIProviderResult.success(
                action=action_name,
                parameters=parameters,
                message=f"Extracted {action_name} with parameters"
            ).to_dict()
        
        # Handle multiple function calls (if supported)
        # Or fallback to text response parsing
        
        # Handle uncertainty/needs clarification
        if response.text:
            return AIProviderResult.failure(
                message=response.text,
                error="NEEDS_SPECIFICATION"
            ).to_dict()
```

### Step 3: Benefits

**Before:**
- 600+ line prompt
- Hard to maintain
- Adding new action = editing massive string
- No schema validation

**After:**
- ~50 line system instruction
- Action schemas in code (version controlled)
- Adding new action = add one dict to `get_action_schemas()`
- Schema validation built-in
- Better IDE support (autocomplete, type checking)

### Step 4: Migration Path

1. Create `action_schemas.py` with all current actions
2. Refactor `GeminiProvider.process_prompt()` to use function calling
3. Test with existing prompts
4. Remove old system prompt code
5. Add new actions by updating schema registry

**No frontend changes needed!** Response format stays the same.

---

## Notes on Gemini Function Calling

- Gemini 2.0+ supports function calling natively
- Function calls are structured (no JSON parsing needed)
- Can handle multiple function calls in one response
- Better parameter validation than free-form JSON

## Filter/Transition Whitelists

For filters and transitions, you can still include whitelists in the system instruction:

```python
system_instruction = """...
Available video filters: AE.ADBE Black & White, AE.ADBE Gaussian Blur 2, ...
Available transitions: AE.ADBE Cross Dissolve New, AE.ADBE Dip To Black, ...
Use exact matchName values from these lists."""
```

Or better: load whitelists from a JSON file and include in function description.



