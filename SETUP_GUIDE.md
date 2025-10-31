# ChatCut AI Integration - Setup Guide

## ✅ Setup Complete!

All dependencies are installed and the codebase is ready for testing.

## Quick Start

### 1. Backend Setup

```bash
cd ChatCut/backend
source venv/bin/activate
```

### 2. Configure AI Provider

Create a `.env` file in the `backend/` directory:

```bash
cp .env.example .env
```

Edit `.env` and configure your AI provider:

**For Gemini (default):**
```
AI_PROVIDER=gemini
GEMINI_API_KEY=your_actual_api_key_here
```

**Get Gemini API key:** https://makersuite.google.com/app/apikey

**Note:** The system uses an abstraction layer - you can switch providers later by changing `AI_PROVIDER` in `.env`. See `PROVIDER_ABSTRACTION.md` for details.

### 3. Start Backend Server

```bash
python main.py
```

The backend will start on `http://127.0.0.1:3001`

### 4. Test the Backend

Open a new terminal and run:

```bash
# Test manual script
cd ChatCut/backend
source venv/bin/activate
python tests/test_manual.py

# Or run pytest tests
pytest tests/test_ai_service.py -v
```

### 5. Test API Endpoints

```bash
# Test ping endpoint
curl -X POST http://localhost:3001/api/ping \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Test AI processing (requires API key)
curl -X POST http://localhost:3001/api/process-prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "zoom in by 120%"}'
```

## File Structure

```
ChatCut/
├── backend/
│   ├── main.py                    # FastAPI server
│   ├── services/
│   │   └── ai_service.py          # Gemini AI integration
│   ├── models/
│   │   └── schemas.py             # Pydantic models
│   ├── tests/                     # Test suite
│   │   ├── test_ai_service.py
│   │   ├── test_api_endpoints.py
│   │   ├── test_integration.py
│   │   ├── test_manual.py
│   │   └── README.md
│   └── .env                       # API key (create this)
├── frontend/
│   └── src/
│       ├── services/
│       │   ├── actionDispatcher.js    # Action registry
│       │   └── backendClient.js        # API client
│       └── components/
│           └── container.jsx            # Updated to use AI
└── DEVELOPMENT_ROADMAP.md         # Development TODO list
```

## Testing

### Run All Tests
```bash
cd backend
pytest tests/ -v
```

### Run Specific Tests
```bash
# AI service tests
pytest tests/test_ai_service.py -v

# Integration tests (requires API key)
GEMINI_API_KEY=your_key pytest tests/test_integration.py -v

# Manual test script
python tests/test_manual.py
```

## Troubleshooting

### Issue: "API key not set" or "Provider not configured"
- Create `.env` file in `backend/` directory
- Add provider configuration:
  ```
  AI_PROVIDER=gemini
  GEMINI_API_KEY=your_key_here
  ```
- Check provider status: `curl http://localhost:3001/health`

### Issue: Import errors
- Make sure virtual environment is activated
- Run: `pip install -r requirements.txt`

### Issue: Backend won't start
- Check if port 3001 is available
- Make sure all dependencies are installed
- Check Python version (3.9+)

### Issue: AI not extracting parameters
- Verify API key is correct
- Check console for error messages
- Test with simple prompts first ("zoom in")

## Next Steps

1. **Set up API key** in `.env` file
2. **Start backend server**
3. **Test with plugin** - Load plugin in Premiere Pro and try prompts:
   - "zoom in by 120%"
   - "zoom out to 80%"
   - "zoom in gradually"
4. **Check DEVELOPMENT_ROADMAP.md** for next features to implement

## Available Actions

- ✅ `zoomIn` - Zoom in with customizable scale
- ✅ `zoomOut` - Zoom out with customizable scale
- ✅ `applyFilter` - Apply video filters
- ✅ `applyTransition` - Apply transitions

See `DEVELOPMENT_ROADMAP.md` for planned actions.

