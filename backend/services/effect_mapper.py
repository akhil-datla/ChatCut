"""
Effect Mapper Service
Maps user prompts to Premiere Pro effects using predefined rules and AI assistance
"""

from typing import Dict, List, Tuple


class EffectMapper:
    """Maps natural language prompts to Premiere Pro effects"""

    # Premiere Pro effect definitions for MVP
    EFFECTS = {
        "black_white": {
            "name": "Black & White",
            "category": "Video Effects > Image Control > Black & White",
            "parameters": {},
            "keywords": ["black and white", "b&w", "grayscale", "monochrome", "desaturate"]
        },
        "gaussian_blur": {
            "name": "Gaussian Blur",
            "category": "Video Effects > Blur & Sharpen > Gaussian Blur",
            "parameters": {
                "blurriness": {"min": 0, "max": 100, "default": 50}
            },
            "keywords": ["blur", "blurry", "soft focus", "defocus"]
        },
        "transform": {
            "name": "Transform",
            "category": "Video Effects > Distort > Transform",
            "parameters": {
                "scale": {"min": 0, "max": 500, "default": 100},
                "position_x": {"min": -1000, "max": 1000, "default": 0},
                "position_y": {"min": -1000, "max": 1000, "default": 0},
                "rotation": {"min": -360, "max": 360, "default": 0}
            },
            "keywords": ["zoom", "scale", "move", "pan", "rotate", "transform", "size"]
        }
    }

    @staticmethod
    def get_system_prompt() -> str:
        """Generate system prompt for Gemini API"""
        return """You are an expert at mapping video editing requests to Adobe Premiere Pro effects.

Given a user prompt, return a JSON response with:
- effect_name: The Premiere Pro effect name (e.g., "Black & White", "Gaussian Blur", "Transform")
- effect_category: The full effect path (e.g., "Video Effects > Blur & Sharpen > Gaussian Blur")
- parameters: A dictionary of effect parameters and values
- confidence: Your confidence level (0.0-1.0)
- description: A brief description of what will be applied

Available Premiere Pro effects for MVP:

1. Black & White
   - Category: "Video Effects > Image Control > Black & White"
   - Parameters: None
   - Use for: black and white, grayscale, monochrome, desaturate

2. Gaussian Blur
   - Category: "Video Effects > Blur & Sharpen > Gaussian Blur"
   - Parameters: blurriness (0-100)
   - Use for: blur, soft focus, defocus
   - "slight blur" = 25, "blur" = 50, "heavy blur" = 100

3. Transform
   - Category: "Video Effects > Distort > Transform"
   - Parameters: scale (0-500%), position_x (-1000 to 1000), position_y (-1000 to 1000), rotation (-360 to 360)
   - Use for: zoom, scale, move, pan, rotate
   - "zoom in" = scale 150%, "zoom out" = scale 50%
   - "move left" = position_x -200, "move right" = position_x 200
   - "move up" = position_y -200, "move down" = position_y 200

IMPORTANT RULES:
- Only use the 3 effects listed above
- If the request cannot be mapped to these effects, set confidence to 0.0 and explain why
- Use reasonable parameter values based on the intensity of the request
- Be specific in the description about what will happen

Example Responses:

User: "make this black and white"
{
  "effect_name": "Black & White",
  "effect_category": "Video Effects > Image Control > Black & White",
  "parameters": {},
  "confidence": 0.95,
  "description": "Will convert the clip to black and white (grayscale)"
}

User: "blur this clip"
{
  "effect_name": "Gaussian Blur",
  "effect_category": "Video Effects > Blur & Sharpen > Gaussian Blur",
  "parameters": {"blurriness": 50},
  "confidence": 0.9,
  "description": "Will apply moderate blur with blurriness set to 50"
}

User: "zoom in 2x"
{
  "effect_name": "Transform",
  "effect_category": "Video Effects > Distort > Transform",
  "parameters": {"scale": 200},
  "confidence": 0.95,
  "description": "Will zoom in to 200% (2x magnification)"
}

User: "add rain to this scene"
{
  "effect_name": null,
  "effect_category": null,
  "parameters": {},
  "confidence": 0.0,
  "description": "Cannot add rain effect - this requires AI video generation which is not available in the current MVP. Only native Premiere Pro effects (Black & White, Blur, Transform) are supported."
}

Now process the user's prompt:"""

    @staticmethod
    def get_available_effects() -> List[str]:
        """Get list of available effect names"""
        return [effect["name"] for effect in EffectMapper.EFFECTS.values()]

    @staticmethod
    def validate_parameters(effect_key: str, parameters: Dict) -> Tuple[bool, Dict, str]:
        """
        Validate and clamp parameters to valid ranges

        Returns:
            Tuple of (is_valid, clamped_parameters, error_message)
        """
        if effect_key not in EffectMapper.EFFECTS:
            return False, {}, f"Unknown effect: {effect_key}"

        effect_def = EffectMapper.EFFECTS[effect_key]
        param_defs = effect_def.get("parameters", {})
        clamped = {}

        for param_name, param_value in parameters.items():
            if param_name not in param_defs:
                continue  # Skip unknown parameters

            param_def = param_defs[param_name]
            min_val = param_def["min"]
            max_val = param_def["max"]

            # Clamp value to valid range
            clamped_value = max(min_val, min(max_val, param_value))
            clamped[param_name] = clamped_value

        return True, clamped, ""
