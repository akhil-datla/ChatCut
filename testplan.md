# ChatCut Automated Test Suite

**Document Name:** Automated Test Plan  
**Product Name:** ChatCut  
**Team Name:** ChatCut Team  
**Last Updated:** 2025-12-04

## Overview

This document describes the automated test suite for the ChatCut backend services. The test suite provides comprehensive coverage of the AI processing pipeline, API endpoints, provider abstractions, and integration flows.

## Test Organization

The automated tests are located in `backend/tests/` and organized by functionality:

```
backend/tests/
├── conftest.py                      # Shared test configuration and fixtures
├── README.md                        # Quick start guide for running tests
├── test_ai_provider_result.py       # Tests for AIProviderResult helper class
├── test_ai_service.py               # Tests for AI prompt processing service
├── test_api_endpoints.py            # Tests for FastAPI REST endpoints
├── test_audio_effects.py            # Tests for audio-specific prompt parsing
├── test_gemini_provider.py          # Tests for Gemini AI provider implementation
├── test_integration.py              # End-to-end integration tests
├── test_provider_abstraction.py     # Tests for provider abstraction layer
└── test_video_provider.py           # Tests for video generation provider
```

## Running the Tests

### Prerequisites

```bash
# Install test dependencies
pip install pytest

# Optional: Set API keys for integration tests
export GEMINI_API_KEY=your_key_here
export RUNWAY_API_KEY=your_key_here
```

### Run Commands

```bash
# Run all tests
pytest backend/tests/ -v

# Run specific test file
pytest backend/tests/test_ai_service.py -v

# Run tests without API keys (skips integration tests)
pytest backend/tests/ -v

# Run tests with coverage
pytest backend/tests/ --cov=services --cov-report=html
```

## Test Modules

### 1. test_ai_provider_result.py

**Purpose:** Validates the AIProviderResult helper class that provides consistent serialization across all AI providers.

**Test Cases:**
- `test_success_helper_includes_defaults`: Verifies that successful results include all required fields (action, parameters, message, confidence=1.0, error=None)
- `test_success_multiple_tracks_actions_list`: Tests handling of multiple actions in a single response (action=None, actions=[...])
- `test_failure_sets_error_and_zero_confidence`: Ensures failure responses set confidence=0.0 and populate error field

**Key Validations:**
- Consistent data structure across success/failure cases
- Proper default values for optional fields
- Correct handling of single vs. multiple actions

---

### 2. test_ai_service.py

**Purpose:** Tests the core AI service layer that processes user prompts and extracts editing actions.

**Test Cases:**
- `test_get_available_actions`: Verifies the catalog of available actions includes zoomIn, zoomOut, applyFilter, applyTransition
- `test_process_prompt_without_api_key`: Ensures graceful degradation when GEMINI_API_KEY is missing (returns error with confidence=0.0)
- `test_process_prompt_structure`: Validates response structure includes action, parameters, confidence, message fields
- `test_zoom_in_extraction`: Tests extraction of zoom in commands with scale parameters (e.g., "zoom in by 120%" → endScale: 120)
- `test_zoom_out_extraction`: Tests zoom out command parsing (e.g., "zoom out to 80%" → endScale: 80)
- `test_ambiguous_prompt`: Verifies handling of vague prompts (e.g., "make it look better")
- `test_get_provider_info_handles_unknown_provider`: Tests error reporting for unsupported AI providers

**Key Validations:**
- Correct action extraction from natural language
- Parameter parsing accuracy
- Error handling for missing configuration
- Response structure consistency

**Dependencies:** Requires GEMINI_API_KEY for full test coverage (some tests skip if not available)

---

### 3. test_api_endpoints.py

**Purpose:** Tests all FastAPI REST endpoints for correct request/response handling.

**Test Cases:**
- `test_ping_endpoint`: Basic connectivity test (POST /api/ping)
- `test_health_endpoint`: Health check endpoint validation (GET /health)
- `test_process_prompt_endpoint_structure`: Validates /api/process-prompt response structure
- `test_process_prompt_missing_field`: Tests validation error handling (422 status) for missing required fields
- `test_process_prompt_empty_string`: Ensures empty prompts are handled gracefully
- `test_process_media_missing_file`: Tests FILE_NOT_FOUND error when video file doesn't exist
- `test_process_object_tracking_with_stub`: Validates object tracking endpoint with mocked provider
- `test_health_endpoint_reports_provider_info`: Ensures health endpoint includes AI provider metadata
- `test_process_media_permission_error`: Tests FILE_ACCESS_ERROR when file is not readable
- `test_process_object_tracking_missing_file`: Validates error handling for missing tracking input files

**Key Validations:**
- HTTP status codes (200, 422)
- Request validation (required fields, types)
- Error response format consistency
- File access validation before processing
- Provider metadata exposure

**Test Approach:** Uses FastAPI TestClient for synchronous endpoint testing without network calls

---

### 4. test_audio_effects.py

**Purpose:** Tests audio-specific prompt parsing using a deterministic stub provider (no API keys required).

**Test Cases:**
- `test_volume_adjustment_prompts`: Parameterized tests for volume commands
  - "adjust volume by 3 decibels" → volumeDb: 3
  - "make it louder by 6dB" → volumeDb: 6
  - "reduce volume by 3dB" → volumeDb: -3
  - "turn it down 6 decibels" → volumeDb: -6
  - "make the audio quieter by 2dB" → volumeDb: -3

- `test_audio_filter_prompts`: Tests audio filter recognition
  - "add reverb" → applyAudioFilter with filterDisplayName: "Reverb"
  - "apply parametric eq" → audio filter action
  - "add noise reduction" → audio filter action

- `test_mixed_prompts_cover_video_and_audio`: Validates correct routing between audio and video commands
  - "adjust volume by 3 decibels" → adjustVolume
  - "add reverb" → applyAudioFilter
  - "zoom in 120%" → zoomIn
  - "make it black and white" → applyFilter

**Key Features:**
- Uses StubAudioProvider for deterministic testing
- No external API dependencies
- Tests both positive and negative volume adjustments
- Validates audio vs. video command differentiation

---

### 5. test_gemini_provider.py

**Purpose:** Unit tests for the Gemini AI provider focusing on configuration, error handling, and content routing without external API calls.

**Test Cases:**
- `test_missing_api_key_returns_failure`: Verifies API_KEY_MISSING error when GEMINI_API_KEY is not set
- `test_small_talk_short_circuit`: Tests that casual conversation is handled locally without API calls (returns SMALL_TALK error)
- `test_audio_detection_helper`: Parameterized tests for the audio request detection helper
  - "please add reverb" → detected as audio
  - "boost the volume" → detected as audio
  - "zoom in the clip" → not audio
  - "what time is it" → not audio

**Key Features:**
- Uses monkeypatching to avoid external API calls
- Removes intentional sleep delays for faster testing
- Tests internal helper methods (_is_audio_request)
- Validates configuration state handling

---

### 6. test_integration.py

**Purpose:** End-to-end integration tests that exercise the full pipeline from user prompt to action structure.

**Test Cases:**
- `test_zoom_in_full_flow`: Tests complete flow for zoom in commands
  - "zoom in by 120%" → action: zoomIn, endScale: 120
  - "zoom in to 150%" → action: zoomIn, endScale: 150
  - "make it zoom in gradually" → action: zoomIn

- `test_parameter_extraction_variations`: Tests parameter extraction from different phrasings
  - "zoom in by 120 percent"
  - "zoom to 120%"
  - "zoom in 120%"
  - "120% zoom in"

- `test_zoom_out_variations`: Tests zoom out command variations
  - "zoom out"
  - "zoom out to 80%"
  - "zoom out by 20%"
  - "make it smaller"

**Key Features:**
- Requires GEMINI_API_KEY (skips if not available)
- Tests real AI provider responses
- Validates parameter extraction accuracy
- Includes debug output for visual verification

**Note:** These tests make actual API calls when GEMINI_API_KEY is configured.

---

### 7. test_provider_abstraction.py

**Purpose:** Tests the provider abstraction layer that enables swapping AI providers (Gemini, OpenAI, etc.).

**Test Cases:**
- `test_ai_provider_result_success`: Tests creation of successful result objects
  - Validates action, parameters, confidence, message, error fields
  - Tests to_dict() serialization

- `test_ai_provider_result_failure`: Tests creation of failure result objects
  - Ensures action=None, confidence=0.0, error populated

- `test_gemini_provider_interface`: Validates GeminiProvider implements AIProvider interface
  - Checks for process_prompt, is_configured, get_provider_name methods
  - Verifies provider name is "gemini"
  - Tests configuration detection without API key

- `test_gemini_provider_without_key`: Tests graceful handling of missing API key
  - Returns failure structure with API_KEY_MISSING error

**Key Features:**
- Interface compliance testing
- Ensures consistent behavior across providers
- Tests configuration state detection

---

### 8. test_video_provider.py

**Purpose:** Tests the video generation provider (Runway) focusing on validation and error handling.

**Test Cases:**
- `test_missing_runway_api_key`: Verifies API_KEY_MISSING error when RUNWAY_API_KEY is not set
- `test_file_not_found`: Tests FILE_NOT_FOUND error for non-existent video files
- `test_file_too_large`: Tests FILE_TOO_LARGE error for videos exceeding size limit (20MB)
  - Uses monkeypatching to simulate large file without creating actual large file
  - Ensures rejection happens before base64 encoding

**Key Features:**
- File validation testing (existence, size, permissions)
- Error handling before expensive operations
- No actual API calls (uses monkeypatching)

---

## Test Infrastructure

### conftest.py

Provides shared test configuration:
- Adds backend package root to Python path
- Ensures consistent import behavior across all test files
- Eliminates need for per-test sys.path manipulation

### Fixtures and Utilities

Common patterns used across tests:
- `monkeypatch`: Pytest fixture for mocking environment variables, functions, and attributes
- `tmp_path`: Pytest fixture providing temporary directories for file testing
- `TestClient`: FastAPI's test client for synchronous endpoint testing
- `@pytest.mark.skipif`: Conditional test execution based on environment
- `@pytest.mark.parametrize`: Data-driven testing with multiple inputs

## Test Coverage Summary

| Category | Coverage |
|----------|----------|
| AI Service | ✅ Structure, error handling, action catalog |
| API Endpoints | ✅ All REST endpoints, validation, errors |
| Prompt Processing | ✅ Zoom, filters, transitions, audio effects |
| Provider Abstraction | ✅ Interface compliance, result serialization |
| Audio Commands | ✅ Volume adjustment, audio filters |
| Video Processing | ✅ File validation, size limits |
| Integration | ✅ End-to-end prompt → action flows |
| Configuration | ✅ Missing keys, provider selection |

## Continuous Integration

Tests are designed to run in CI/CD environments:
- **Fast mode**: Tests without API keys run quickly using mocks and stubs
- **Full mode**: Tests with API keys validate real provider integrations
- **Flexible**: Tests skip gracefully when dependencies are unavailable

## Future Enhancements

Potential areas for additional test coverage:
- [ ] Object tracking provider tests
- [ ] Multi-track action handling
- [ ] Context parameter passing
- [ ] Rate limiting and retry logic
- [ ] More audio effect variations
- [ ] Video filter parameter ranges
- [ ] Concurrent request handling

## Related Documentation

- [backend/tests/README.md](backend/tests/README.md) - Quick start guide for running tests
- [TEST_PLAN_AND_REPORT.md](TEST_PLAN_AND_REPORT.md) - Manual system test scenarios and user story validation
- [backend/ARCHITECTURE_PLAN.md](backend/ARCHITECTURE_PLAN.md) - Backend architecture overview

---

**Note:** This automated test suite complements the manual test scenarios in TEST_PLAN_AND_REPORT.md. Manual tests focus on user-facing functionality and UI interactions, while automated tests ensure backend service reliability and correctness.
