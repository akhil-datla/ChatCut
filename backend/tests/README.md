# Backend Tests

## Test Structure

- `test_ai_service.py` - Tests for AI prompt processing
- `test_api_endpoints.py` - Tests for FastAPI endpoints
- `test_integration.py` - Integration tests for full flow

## Running Tests

### Install test dependencies:
```bash
pip install pytest
```

### Run all tests:
```bash
pytest tests/ -v
```

### Run specific test file:
```bash
pytest tests/test_ai_service.py -v
```

### Run with API key (for integration tests):
```bash
GEMINI_API_KEY=your_key_here pytest tests/ -v
```

## Test Coverage

- ✅ AI service structure and error handling
- ✅ API endpoint validation
- ✅ Prompt extraction and parameter parsing
- ✅ Integration flow testing

## Notes

- Some tests require `GEMINI_API_KEY` to be set
- Tests without API key will skip API-dependent tests
- Mock tests can be added for offline testing

