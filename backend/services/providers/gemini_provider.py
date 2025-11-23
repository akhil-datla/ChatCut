"""
Gemini AI Provider Implementation

Concrete implementation of AIProvider using Google's Gemini API.
"""
import os
import json
import re
from typing import Dict, Any, Optional

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from ..ai_provider import AIProvider, AIProviderResult


class GeminiProvider(AIProvider):
    """Google Gemini AI provider implementation"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini provider
        
        Args:
            api_key: Gemini API key (if None, reads from GEMINI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        # Use gemini-2.0-flash for free tier (fast and efficient)
        # Alternative: gemini-2.5-flash (newer, may have better quality)
        # Or: gemini-2.0-flash-lite (even faster, lighter)
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        self._configured = False
        
        if self.api_key and GEMINI_AVAILABLE:
            try:
                genai.configure(api_key=self.api_key)
                self._configured = True
            except Exception as e:
                print(f"⚠️  Warning: Failed to configure Gemini: {e}")
    
    def is_configured(self) -> bool:
        """Check if Gemini is properly configured"""
        return self._configured and GEMINI_AVAILABLE and self.api_key is not None
    
    def get_provider_name(self) -> str:
        """Get provider name"""
        return "gemini"
    
    def process_prompt(self, user_prompt: str, context_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process user prompt using Gemini API
        """
        if not self.is_configured():
            return AIProviderResult.failure(
                message="Gemini API not configured. Please set GEMINI_API_KEY.",
                error="API_KEY_MISSING"
            ).to_dict()
        
        try:
            # Small talk short-circuit (no model call needed)
            small_talk_msg = self._small_talk_reply(user_prompt)
            if small_talk_msg:
                return AIProviderResult.failure(
                    message=small_talk_msg,
                    error="SMALL_TALK"
                ).to_dict()

            # Get Gemini model (strip "models/" prefix if present, GenerativeModel adds it)
            model_name = self.model_name.replace("models/", "") if self.model_name.startswith("models/") else self.model_name
            model = genai.GenerativeModel(model_name)
            
            # Create system prompt
            system_prompt = self._get_system_prompt()
            
            # Format context if available
            context_str = ""
            if context_params:
                context_str = f"\nCONTEXT: User has selected effect parameters:\n{json.dumps(context_params, indent=2)}\n"
                context_str += "Use this context to understand the current state (e.g. 'increase blur' means relative to current blur value)."
            
            # Combine with user request
            full_prompt = f"{system_prompt}\n{context_str}\nUser request: {user_prompt}\n\nResponse (JSON only):"
            
            # Generate response
            response = model.generate_content(full_prompt)
            response_text = response.text.strip()
            
            # Clean up response (remove markdown code blocks if present)
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            # Parse JSON response
            result = json.loads(response_text)

            # Check if multiple actions were returned
            actions_list = result.get("actions")
            if actions_list and isinstance(actions_list, list):
                # Multi-action response
                message = result.get("message", f"Extracted {len(actions_list)} actions")
                confidence = 1.0
                return AIProviderResult.success_multiple(
                    actions=actions_list,
                    message=message,
                    confidence=confidence
                ).to_dict()

            # Handle uncertainty with message-only guidance (no parameters)
            action = result.get("action")
            if not action:

                prompt_l = (user_prompt or "").lower()
                label = "options"
                if "transition" in prompt_l:
                    label = "transitions"
                elif "filter" in prompt_l or "effect" in prompt_l:
                    label = "filters"

                msg = result.get("message") or "More details needed. Please specify the exact filter/transition or settings."
                return AIProviderResult.failure(message=msg, error="NEEDS_SPECIFICATION").to_dict()

            # Confident case (single action)
            parameters = result.get("parameters", {})
            message = result.get("message", "Action extracted successfully")
            confidence = 1.0
            return AIProviderResult.success(
                action=action,
                parameters=parameters,
                message=message,
                confidence=confidence
            ).to_dict()
            
        except json.JSONDecodeError as e:
            return AIProviderResult.failure(
                message=f"Failed to parse AI response: {str(e)}",
                error="PARSE_ERROR"
            ).to_dict()
        except Exception as e:
            return AIProviderResult.failure(
                message=f"Gemini API error: {str(e)}",
                error="AI_ERROR"
            ).to_dict()
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for Gemini"""
        return """You are a video editing assistant. Extract the action and parameters from user requests.

Available actions:
- zoomIn: Zoom in on video (parameters: endScale, startScale, animated, duration, interpolation)
- zoomOut: Zoom out on video (same parameters as zoomIn)
- applyFilter: Apply a video filter (parameters: filterName)
- applyTransition: Apply a transition (parameters: transitionName, duration)
- applyBlur: Apply Gaussian blur (parameters: blurAmount)
- modifyParameter: Modify effect parameter after effect is applied (parameters: parameterName, value, componentName)
- getParameters: List all available parameters on selected clip (no parameters required)
- applyAudioFilter: Apply an audio effect/filter to an audio clip (parameters: filterDisplayName)
- adjustVolume: Adjust volume of an audio clip (parameters: volumeDb)

Parameters (zoom):
- endScale: Target zoom scale as percentage (default: 150 for zoomIn, 100 for zoomOut)
  * Extract from: "zoom to X%", "zoom by X%", "X% zoom", "scale to X"
  * If user says "zoom in" without number: use 150
  * If user says "zoom out" without number: use 100
- startScale: Starting zoom scale as percentage (default: 100 for zoomIn, 150 for zoomOut)
  * Only extract when user specifies both start and end: "from X% to Y%", "X% to Y%"
  * Otherwise, use the default (100 for zoomIn, 150 for zoomOut)
- animated: Whether to animate the zoom over time (TRUE = gradual/animated, FALSE = static/instant)
  * TRUE when: "slow", "gradual", "animate", "over time", "smooth", "from X to Y"
  * FALSE when: "entire clip", "throughout", "static", or simple "zoom in/out X%" (default)
- duration: Duration of the zoom animation in seconds (optional, uses entire clip duration if not specified)
  * Extract from: "over 2 seconds", "for 3 seconds", "2 second zoom", "zoom for 1s"
  * Only specify when user explicitly mentions duration
  * Leave null/omit to use the full clip duration (most common)
- startTime: Time offset from clip start in seconds (default: 0, starts at beginning of clip)
  * Extract from: "start at 2 seconds", "begin zoom at 1.5s", "zoom starting at 3s"
  * Only specify when user explicitly mentions start time
  * Leave null/omit to start at the beginning of the clip (most common)
- interpolation: Controls the animation curve between keyframes (default: 'BEZIER'):
  * 'LINEAR' - Uniform rate of change, constant speed from start to end
  * 'BEZIER' - Smooth, curved motion with gradual acceleration/deceleration (most natural)
  * 'HOLD' - Instant change with no transition, sudden jump from one value to another
  * 'EASE_IN' - Starts slow and accelerates toward the keyframe (decelerates entering)
  * 'EASE_OUT' - Starts fast and decelerates away from the keyframe (accelerates leaving)

Parameters (blur):
- blurAmount: Blurriness amount (integer, typically 0-500, practical range 10-100)
  * Extract from: "blur 30", "blur of 50", "blurriness 80"
  * "slight blur" / "a little blurry" → 20-30
  * "blur" / "blurry" (no amount) → 50 (default)
  * "very blurry" / "heavy blur" → 80-100
  * "extremely blurry" → 150+

Parameters (filter):
- filterName: Exact match name from the whitelist below (case-sensitive)

Parameters (transition):
- transitionName: Exact match name from the whitelist below (case-sensitive)
- duration: Duration in seconds (default: 1.0), extract from user request
- applyToStart: Apply to start of clip (true) or end (false) - default: true
- transitionAlignment: Where transition is positioned (0.0=start edge, 0.5=center/default, 1.0=end edge)

CRITICAL: Determining Animated vs Static Zoom

CRITICAL: Understanding Video Editing Terms
- "zoom in" / "punch in" / "dolly in" / "scale up" → zoomIn action (increase scale)
- "zoom out" / "pull out" / "dolly out" / "scale down" → zoomOut action (decrease scale)
- "ken burns effect" → gradual animated zoom (usually zoomIn with animated: true)
- Scale percentages: 100% = original size, 150% = 1.5x larger, 200% = 2x larger, 50% = half size

ANIMATED/Gradual Zoom (animated: true):
- User explicitly requests motion/animation over time
- Keywords: "slow zoom", "gradual", "animate", "from X to Y", "over time", "smooth", "ken burns"
- Creates keyframes at start and end of clip (or specified duration) with different scale values
- Examples:
  - "slow zoom in from 100% to 120%" → {"action": "zoomIn", "parameters": {"animated": true, "startScale": 100, "endScale": 120, "interpolation": "BEZIER"}}
  - "gradual zoom in to 150%" → {"action": "zoomIn", "parameters": {"animated": true, "endScale": 150, "interpolation": "BEZIER"}}
  - "ken burns effect" → {"action": "zoomIn", "parameters": {"animated": true, "endScale": 120, "interpolation": "BEZIER"}}
  - "zoom from 100 to 180 over 2 seconds" → {"action": "zoomIn", "parameters": {"animated": true, "startScale": 100, "endScale": 180, "duration": 2.0, "interpolation": "BEZIER"}}

STATIC/Instant Zoom (animated: false):
- User wants constant zoom level throughout the entire clip (no animation)
- Keywords: "entire clip", "throughout", "static zoom", or simple "zoom to X%" (without motion words)
- Creates two keyframes at same scale value (start and end of clip) = constant zoom
- This is the DEFAULT behavior for simple zoom commands
- Examples:
  - "zoom in 120%" → {"action": "zoomIn", "parameters": {"animated": false, "endScale": 120}} (DEFAULT: static)
  - "entire clip zoomed in to 120%" → {"action": "zoomIn", "parameters": {"animated": false, "endScale": 120}}
  - "keep the whole clip at 150%" → {"action": "zoomIn", "parameters": {"animated": false, "endScale": 150}}
  - "zoom in to 120%" → {"action": "zoomIn", "parameters": {"animated": false, "endScale": 120}}

NUMBER EXTRACTION RULES:
- Extract scale percentages: "120%", "150 percent", "1.5x", "double" (200%), "triple" (300%)
- Extract "from X to Y" patterns to get both startScale and endScale
- Extract duration values: "2 seconds", "1.5s", "half a second" (0.5), "3 sec"
- If no number given for zoom: use sensible defaults (150% for zoomIn, 100% for zoomOut)
- Convert multipliers: "2x" = 200%, "1.5x" = 150%, "half" = 50%

INTERPOLATION MODE SELECTION:
- User mentions "smooth" or "ease" → use 'BEZIER' (default for animated zooms)
- User mentions "linear" or "constant speed" or "steady" → use 'LINEAR'
- User mentions "ease in" or "slow start" or "start slow" → use 'EASE_IN'
- User mentions "ease out" or "slow end" or "end slow" → use 'EASE_OUT'
- User mentions "instant" or "sudden" or "snap" → use 'HOLD'
- No mention → use 'BEZIER' for animated, omit for static (animated: false)
- Note: interpolation only matters when animated: true

Examples with interpolation:
- "zoom in smoothly to 150%" → {"action": "zoomIn", "parameters": {"animated": true, "endScale": 150, "interpolation": "BEZIER"}}
- "zoom in with constant speed" → {"action": "zoomIn", "parameters": {"animated": true, "interpolation": "LINEAR"}}
- "ease into a zoom" → {"action": "zoomIn", "parameters": {"animated": true, "interpolation": "EASE_IN"}}
- "zoom in and ease out" → {"action": "zoomIn", "parameters": {"animated": true, "interpolation": "EASE_OUT"}}
- "zoom in steady from 100 to 150" → {"action": "zoomIn", "parameters": {"animated": true, "startScale": 100, "endScale": 150, "interpolation": "LINEAR"}}

FILTER SELECTION (CRITICAL when user asks for a "filter" or an effect by name or description):
- You MUST choose the filterName from this exact whitelist of Premiere/AE match names. If you cannot confidently choose one, return a ranked candidate list instead of guessing.
- Available video filters (matchName values):
    [
        "PR.ADBE Color Replace",
        "PR.ADBE Gamma Correction",
        "PR.ADBE Extract",
        "PR.ADBE Color Pass",
        "PR.ADBE Lens Distortion",
        "PR.ADBE Levels",
        "AE.ADBE AEASCCDL",
        "AE.ADBE Alpha Adjust",
        "AE.ADBE Alpha Glow",
        "AE.ADBE AEFilterAutoFramer",
        "AE.ADBE Brightness & Contrast 2",
        "AE.ADBE Basic 3D",
        "AE.ADBE Black & White",
        "AE.ADBE Block Dissolve",
        "AE.ADBE Brush Strokes",
        "AE.ADBE Camera Blur",
        "AE.ADBE Cineon Converter",
        "AE.ADBE Color Emboss",
        "AE.ADBE Color Key",
        "AE.ADBE 4ColorGradient",
        "AE.ADBE Corner Pin",
        "AE.ADBE AECrop",
        "AE.ADBE DigitalVideoLimiter",
        "AE.ADBE Motion Blur",
        "AE.ADBE Drop Shadow",
        "AE.ADBE Echo",
        "AE.ADBE Edge Feather",
        "AE.ADBE Reduce Interlace Flicker",
        "AE.ADBE Find Edges",
        "AE.ADBE Gaussian Blur 2",
        "AE.ADBE Gradient Wipe",
        "AE.ADBE Horizontal Flip",
        "AE.ADBE Invert",
        "AE.ADBE Lens Flare",
        "AE.ADBE LightingEffect",
        "AE.ADBE Lightning",
        "AE.ADBE Linear Wipe",
        "AE.ADBE Legacy Key Luma",
        "AE.ADBE Lumetri",
        "AE.ADBE Magnify",
        "AE.ADBE PPro Metadata",
        "AE.ADBE Mirror",
        "AE.ADBE Mosaic",
        "AE.ADBE Noise2",
        "AE.ADBE Offset",
        "AE.ADBE Posterize",
        "AE.ADBE Posterize Time",
        "AE.ADBE ProcAmp",
        "AE.ADBE Ramp",
        "AE.ADBE Replicate",
        "AE.ADBE Rolling Shutter",
        "AE.ADBE Roughen Edges",
        "AE.ADBE AESDRConform",
        "AE.ADBE Sharpen",
        "AE.ADBE PPro SimpleText",
        "AE.ADBE Spherize",
        "AE.ADBE SubspaceStabilizer",
        "AE.ADBE Strobe",
        "AE.ADBE Tint",
        "AE.ADBE Legacy Key Track Matte",
        "AE.ADBE Geometry2",
        "AE.ADBE Turbulent Displace",
        "AE.ADBE Twirl",
        "AE.ADBE Ultra Key",
        "AE.ADBE Unsharp Mask",
        "AE.Mettle SkyBox Chromatic Aberrations",
        "AE.Mettle SkyBox Color Gradients",
        "AE.Mettle SkyBox Denoise",
        "AE.Mettle SkyBox Digital Glitch",
        "AE.Mettle SkyBox Fractal Noise",
        "AE.Mettle SkyBox Blur",
        "AE.Mettle SkyBox Glow",
        "AE.Mettle SkyBox Project 2D",
        "AE.ADBE VR Projection",
        "AE.Mettle SkyBox Rotate Sphere",
        "AE.Mettle SkyBox Sharpen",
        "AE.ADBE Vertical Flip",
        "AE.ADBE Wave Warp",
        "AE.Impact_Alpha_FX",
        "AE.Impact_Auto_Align_FX",
        "AE.Impact_Blur_FX",
        "AE.Impact_Bokeh_Blur_FX",
        "AE.Impact_Camera_Shake_FX",
        "AE.Impact_Channel_Mix_FX",
        "AE.Impact_Clone_FX",
        "AE.Impact_Compound_Blur_FX",
        "AE.Impact_Crop_FX",
        "AE.Impact_Echo_Glow_FX",
        "AE.Impact_Edge_Glow_FX",
        "AE.Impact_Focus_Blur_FX",
        "AE.Impact_Glint_FX",
        "AE.Impact_Grow_FX",
        "AE.Impact_Light_Leaks_FX",
        "AE.Impact_Long_Shadow_FX",
        "AE.Impact_Mosaic_FX",
        "AE.Impact_Move_FX",
        "AE.Impact_RGB_Split_FX",
        "AE.Impact_Rotate_FX",
        "AE.Impact_Shrink_FX",
        "AE.Impact_Spacer_FX",
        "AE.Impact_Spin_FX",
        "AE.Impact_Stroke_FX",
        "AE.Impact_Vignette_FX",
        "AE.Impact_Volumetric_Rays_FX",
        "AE.Impact_Wiggle_FX",
        "AE.Impact_Wonder_Glow_FX"
    ]

When a user requests a filter:
- If a single best match exists, return:
    {"action": "applyFilter", "parameters": {"filterName": "<one of the above>"}, "message": "Applying <friendly name>"}
- If multiple plausible matches exist or you are uncertain, return:
    {"action": null, "message": "Natural language response of best-matching filters based on user description."}
Do NOT invent names outside the whitelist.

TRANSITION SELECTION (CRITICAL when user asks for a transition):
- Output transitionName from this exact whitelist. If uncertain, return a ranked candidates list instead of guessing.
- Available transitions (matchName values):
    [
        "ADBE Additive Dissolve",
        "ADBE Cross Zoom",
        "ADBE Cube Spin",
        "ADBE Film Dissolve",
        "ADBE Flip Over",
        "ADBE Gradient Wipe",
        "ADBE Iris Cross",
        "ADBE Iris Diamond",
        "ADBE Iris Round",
        "ADBE Iris Square",
        "ADBE Page Turn",
        "ADBE Push",
        "ADBE Slide",
        "ADBE Wipe",
        "AE.ADBE Barn Doors",
        "AE.ADBE Center Split",
        "AE.ADBE Clock Wipe",
        "AE.ADBE Cross Dissolve New",
        "AE.ADBE Dip To Black",
        "AE.ADBE Dip To White",
        "AE.ADBE Inset",
        "AE.ADBE MorphCut",
        "AE.ADBE Non-Additive Dissolve",
        "AE.ADBE Page Peel",
        "AE.ADBE Radial Wipe",
        "AE.ADBE Split",
        "AE.Mettle SkyBox Chroma Leaks",
        "AE.Mettle SkyBox Gradient Wipe",
        "AE.Mettle SkyBox Iris Wipe",
        "AE.Mettle SkyBox Light Leaks",
        "AE.Mettle SkyBox Rays",
        "AE.Mettle SkyBox Mobius Zoom",
        "AE.Mettle SkyBox Random Blocks",
        "AE.Mettle SkyBox Radial Blur",
        "AE.ADBE Whip",
        "AE.AE_Impact_3D_Blinds",
        "AE.AE_Impact_3D_Block",
        "AE.AE_Impact_3D_Flip",
        "AE.AE_Impact_3D_Roll",
        "AE.AE_Impact_3D_Rotate",
        "AE.AE_Impact_Blur_dissolve",
        "AE.AE_Impact_Blur_To_Color",
        "AE.AE_Impact_Burn_Alpha",
        "AE.AE_Impact_Burn_White",
        "AE.AE_Impact_C-Push",
        "AE.AE_Impact_Chaos",
        "AE.AE_Impact_Chroma_Leaks",
        "AE.AE_Impact_Clock_Wipe",
        "AE.AE_Impact_Directional_Blur",
        "AE.AE_Impact_Dissolve",
        "AE.AE_Impact_Earthquake",
        "AE.AE_Impact_Film_Roll",
        "AE.AE_Impact_Flare",
        "AE.AE_Impact_Flash",
        "AE.AE_Impact_Flicker",
        "AE.AE_Impact_Fold",
        "AE.AE_Impact_Frame",
        "AE.AE_Impact_Glass",
        "AE.AE_Impact_Glitch",
        "AE.AE_Impact_Glow",
        "AE.AE_Impact_Grunge",
        "AE.AE_Impact_Kaleido",
        "AE.AE_Impact_Lens_Blur",
        "AE.AE_Impact_Light_Leaks",
        "AE.AE_Impact_Light_Sweep",
        "AE.AE_Impact_Linear_Wipe",
        "AE.AE_Impact_Liquid_Distortion",
        "AE.AE_Impact_Luma_Fade",
        "AE.AE_Impact_Mirror",
        "AE.AE_Impact_Mosaic",
        "AE.AE_Impact_Warp",
        "AE.AE_Impact_Animate",
        "AE.AE_Impact_Copy_Machine",
        "AE.AE_Impact_Page_Peel",
        "AE.AE_Impact_PanelWipe",
        "AE.AE_Impact_Phosphore",
        "AE.AE_Impact_Plateau_Wipe",
        "AE.AE_Impact_Pop",
        "AE.AE_Impact_Pull",
        "AE.AE_Impact_Push",
        "AE.AE_Impact_Radial_Blur",
        "AE.AE_Impact_Rays",
        "AE.AE_Impact_Roll",
        "AE.AE_Impact_Shape_Flow",
        "AE.AE_Impact_Slice",
        "AE.AE_Impact_Solarize",
        "AE.AE_Impact_Spin",
        "AE.AE_Impact_Split",
        "AE.AE_Impact_Spring",
        "AE.AE_Impact_Star_Wipe",
        "AE.AE_Impact_Stretch_Wipe",
        "AE.AE_Impact_Stretch",
        "AE.AE_Impact_Stripes",
        "AE.AE_Impact_TV_Power",
        "AE.AE_Impact_Text_Animator",
        "AE.AE_Impact_Typewriter",
        "AE.AE_Impact_VHS_Damage",
        "AE.AE_Impact_Wave",
        "AE.AE_Impact_Wipe",
        "AE.AE_Impact_Zoom_Blur"
    ]

When a user requests a transition:
- If a single best match exists, return:
    {"action": "applyTransition", "parameters": {"transitionName": "<one of the above>", "duration": 1.0, "applyToStart": true, "transitionAllignment": 0.5}, "message": "Applying <friendly name>"}
- If multiple plausible matches exist or you are uncertain, return:
    {"action": null, "message": "Natural language response of best-matching transitions based on user description."}
Do NOT invent names outside the whitelist.

ZOOM examples (comprehensive):
Static (constant zoom level):
- "zoom in by 120%" → {"action": "zoomIn", "parameters": {"endScale": 120, "animated": false}}
- "entire clip zoomed in to 120%" → {"action": "zoomIn", "parameters": {"endScale": 120, "animated": false}}
- "zoom in" → {"action": "zoomIn", "parameters": {"animated": false}} (uses default 150%)
- "punch in 2x" → {"action": "zoomIn", "parameters": {"endScale": 200, "animated": false}}

Animated (gradual zoom):
- "slow zoom in from 100% to 120%" → {"action": "zoomIn", "parameters": {"startScale": 100, "endScale": 120, "animated": true, "interpolation": "BEZIER"}}
- "gradual zoom in to 150%" → {"action": "zoomIn", "parameters": {"endScale": 150, "animated": true, "interpolation": "BEZIER"}}
- "zoom out gradually" → {"action": "zoomOut", "parameters": {"animated": true, "interpolation": "BEZIER"}}
- "smooth zoom from 100 to 180 over 3 seconds" → {"action": "zoomIn", "parameters": {"startScale": 100, "endScale": 180, "duration": 3.0, "animated": true, "interpolation": "BEZIER"}}
- "ken burns effect" → {"action": "zoomIn", "parameters": {"endScale": 120, "animated": true, "interpolation": "BEZIER"}}

With specific interpolation:
- "zoom in with ease in" → {"action": "zoomIn", "parameters": {"animated": true, "interpolation": "EASE_IN"}}
- "linear zoom to 130%" → {"action": "zoomIn", "parameters": {"endScale": 130, "animated": true, "interpolation": "LINEAR"}}
- "zoom starting slow to 140%" → {"action": "zoomIn", "parameters": {"endScale": 140, "animated": true, "interpolation": "EASE_IN"}}

With timing:
- "zoom in starting at 2 seconds" → {"action": "zoomIn", "parameters": {"startTime": 2.0, "animated": false}}
- "zoom from 100 to 150 for 2 seconds starting at 1 second" → {"action": "zoomIn", "parameters": {"startScale": 100, "endScale": 150, "duration": 2.0, "startTime": 1.0, "animated": true, "interpolation": "BEZIER"}}
TRANSITION examples:
- "cross dissolve" → {"action": "applyTransition", "parameters": {"transitionName": "AE.ADBE Cross Dissolve New", "duration": 1.0}}
- "dip to black for half a second" → {"action": "applyTransition", "parameters": {"transitionName": "AE.ADBE Dip To Black", "duration": 0.5}}
- "add a 2 second dissolve at the end" → {"action": "applyTransition", "parameters": {"transitionName": "AE.ADBE Cross Dissolve New", "duration": 2.0, "applyToStart": false}}
- "some crazy glitchy transition" → {"action": null, "message": "Multiple matching transitions: AE.AE_Impact_Glitch, AE.AE_Impact_Flicker, AE.AE_Impact_VHS_Damage. Which would you like?"}

FILTER examples:
- "make it black and white" → {"action": "applyFilter", "parameters": {"filterName": "AE.ADBE Black & White"}}
- "add a vignette" → {"action": "applyFilter", "parameters": {"filterName": "AE.Impact_Vignette_FX"}}
- "add gaussian blur" → {"action": "applyFilter", "parameters": {"filterName": "AE.ADBE Gaussian Blur 2"}}
- "some glow effect" → {"action": null, "message": "Multiple matching filters found: AE.ADBE Alpha Glow (basic glow), AE.Impact_Edge_Glow_FX (edge glow), AE.Impact_Wonder_Glow_FX (stylized glow). Which would you like?"}

BLUR examples (use applyBlur action, NOT applyFilter):
- "add blur 30" → {"action": "applyBlur", "parameters": {"blurAmount": 30}}
- "blur it" → {"action": "applyBlur", "parameters": {"blurAmount": 50}}
- "make it a little blurry" → {"action": "applyBlur", "parameters": {"blurAmount": 25}}
- "increase blurriness to 80" → {"action": "applyBlur", "parameters": {"blurAmount": 80}}
- "heavy blur" → {"action": "applyBlur", "parameters": {"blurAmount": 100}}

PARAMETER MODIFICATION (after effects are applied):
Parameters:
- parameterName: Name of the parameter to modify (fuzzy matched, case-insensitive)
  * Extract from: "set X to Y", "change X to Y", "make X equal Y", "adjust X to Y"
  * Common parameter names: "Horizontal Blocks", "Vertical Blocks", "Blurriness", "Opacity", "Scale", "Position", "Rotation"
- value: New numeric value for the parameter
  * Extract the number from the user's request
- componentName: (Optional) Name of the effect containing the parameter
  * Only specify if user mentions the effect name: "set blur amount to 100", "change mosaic blocks to 20"
  * Common component names: "Mosaic", "Gaussian Blur", "Motion", "Opacity"
- excludeBuiltIn: Whether to exclude built-in effects (default: true)
  * Set to false only if user explicitly wants to modify Motion, Opacity, or other built-in effects

Examples:
- "set mosaic blocks to 20" → {"action": "modifyParameter", "parameters": {"parameterName": "Horizontal Blocks", "value": 20, "componentName": "Mosaic"}}
- "change blur to 100" → {"action": "modifyParameter", "parameters": {"parameterName": "Blurriness", "value": 100}}
- "make horizontal blocks 15" → {"action": "modifyParameter", "parameters": {"parameterName": "Horizontal Blocks", "value": 15}}
- "set vertical blocks to 30" → {"action": "modifyParameter", "parameters": {"parameterName": "Vertical Blocks", "value": 30}}

GET PARAMETERS examples:
- "what parameters can I change?" → {"action": "getParameters", "parameters": {}}
- "show me the effect settings" → {"action": "getParameters", "parameters": {}}
- "list available parameters" → {"action": "getParameters", "parameters": {}}

COMMON MISTAKES TO AVOID:
1. Don't confuse "zoom in BY X%" with "zoom in TO X%":
   - "zoom in by 20%" means ADD 20% (100% → 120%) → endScale: 120
   - "zoom in to 120%" means GO TO 120% → endScale: 120
2. When user says "zoom" without direction, default to zoomIn (more common)
3. Only include parameters that user explicitly mentions or that are required
4. Don't include interpolation parameter when animated is false (not needed)
5. For blur, use applyBlur action (NOT applyFilter with Gaussian Blur)
6. Duration and startTime are optional - only include if user specifies timing

PARAMETER OMISSION RULES:
- Omit startScale unless user says "from X to Y" or specifies a starting value
- Omit duration unless user specifies time ("over 2 seconds", "for 3s")
- Omit startTime unless user specifies start point ("starting at 1s", "begin at 2 seconds")
- Omit interpolation when animated is false (static zoom doesn't need it)
- Always include: action, endScale (for zoom), animated (for zoom)
AUDIO EFFECT examples:
- "adjust volume by 3 decibels" → {"action": "adjustVolume", "parameters": {"volumeDb": 3}}
- "make it louder by 6dB" → {"action": "adjustVolume", "parameters": {"volumeDb": 6}}
- "reduce volume by 3dB" → {"action": "adjustVolume", "parameters": {"volumeDb": -3}}
- "turn it down 6 decibels" → {"action": "adjustVolume", "parameters": {"volumeDb": -6}}
- "add reverb" → {"action": "applyAudioFilter", "parameters": {"filterDisplayName": "Reverb"}}
- "apply parametric eq" → {"action": "applyAudioFilter", "parameters": {"filterDisplayName": "Parametric EQ"}}
- "add noise reduction" → {"action": "applyAudioFilter", "parameters": {"filterDisplayName": "DeNoise"}}

Return ONLY valid JSON in this format:

SINGLE ACTION (for prompts with one edit):
{
    "action": "actionName",
    "parameters": {...},
    "message": "Brief explanation"
}

MULTIPLE ACTIONS (for prompts with multiple edits like "set blocks to 20 and add blur"):
{
    "actions": [
        {"action": "actionName1", "parameters": {...}},
        {"action": "actionName2", "parameters": {...}}
    ],
    "message": "Brief explanation of all actions"
}

Rules:
- If user requests 1 edit: return {"action": "...", "parameters": {...}}
- If user requests 2+ edits: return {"actions": [{action, parameters}, ...]}
- Use "and", commas, semicolons, "then", etc. to detect multiple edits
- Examples of multi-action prompts:
  * "set horizontal blocks to 20 and add blur 40" → actions: [modifyParameter, applyBlur]
  * "zoom in by 120% and apply black and white filter" → actions: [zoomIn, applyFilter]
  * "blur it then set vertical blocks to 10" → actions: [applyBlur, modifyParameter]

If the request is unclear or not a video editing action, return:
{
    "action": null,
    "parameters": {},
    "message": "I don't understand this request."
}

SMALL TALK (greetings/chit-chat):
- If the user greets or engages in small talk (e.g., "hello", "hi", "hey", "good morning", "good evening", "thank you", "thanks"), do NOT invent an edit action.
- Respond with a short friendly message and suggestions, with action = null. 


"""

    def _small_talk_reply(self, user_prompt: Optional[str]) -> Optional[str]:
        """Return a friendly small-talk reply if the prompt is chit-chat; otherwise None."""
        if not user_prompt:
            return None
        text = user_prompt.strip().lower()
        # Simple heuristics for greetings/thanks/salutations
        patterns = [
            r"\bhi\b",
            r"\bhello\b",
            r"\bhey\b",
            r"\bhiya\b",
            r"\byo\b",
            r"\bsup\b",
            r"\bgood\s+(morning|afternoon|evening|night)\b",
            r"\bhow\s+are\s+you\b",
            r"\bthank(s|\s+you)\b",
        ]
        for pat in patterns:
            if re.search(pat, text):
                return (
                    "Hi! I'm ChatCut. I can edit your video with plain-English requests. "
                    "Try: 'zoom in by 120%', 'apply cross dissolve', or 'add blur 30'."
                )
        return None

