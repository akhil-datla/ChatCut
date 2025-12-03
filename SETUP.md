# ChatCut MVP Setup Guide

## Prerequisites

- **Premiere Pro** 23.0.0 or higher
- **Node.js** 16+ and npm
- **Python** 3.8+
- **UXP Developer Tools**
- **Google Gemini API Key** (free tier available)

---

## Step 1: Get Your Gemini API Key

1. Go to https://ai.google.dev/
2. Click "Get API Key" → "Create API key in new project"
3. Copy your API key (starts with `AIza...`)

---

## Step 2: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create .env file with your API key
echo "GEMINI_API_KEY=your_api_key_here" > .env
# On Windows PowerShell:
# New-Item -Path .env -ItemType File -Value "GEMINI_API_KEY=your_api_key_here"

# Start the backend server
python main.py
```

You should see:
```
============================================================
ChatCut Backend Starting...
============================================================
Server: http://localhost:3001
Docs: http://localhost:3001/docs
Health: http://localhost:3001/health
============================================================
✓ Gemini service initialized successfully
```

**Leave this terminal running!**

---

## Step 3: Frontend Setup

Open a **new terminal**:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if you haven't already)
npm install

# Build the plugin
npm run watch
```

You should see:
```
webpack 4.47.0
Built at: ...
    Asset       Size
index.html  199 bytes
  index.js    2.5 MiB
```

**Leave this terminal running!** It will auto-rebuild when you change code.

---

## Step 4: Load Plugin into Premiere Pro

1. **Launch Premiere Pro** (version 23.0.0+)

2. **Open UXP Developer Tools**

3. **Add the Plugin**:
   - Click "Add Plugin..."
   - Navigate to: `D:\ChatCut\frontend\dist\manifest.json`
   - Select it and click "Open"

4. **Load the Plugin**:
   - Find "ChatCut" in the plugin list
   - Click the ••• button → "Load"

5. **Open the Panel in Premiere Pro**:
   - In Premiere Pro, go to: **Window → Extensions → ChatCut**
   - The panel should appear!

---

## Step 5: Test the MVP

### Test 1: Check Backend Connection

1. Look at the bottom of the ChatCut panel
2. You should see: `Backend: ✓ Connected`
3. If not, make sure the Python server is running on localhost:3001

### Test 2: Get Timeline Selection

1. In Premiere Pro, open a sequence with video clips
2. Set **In** and **Out** points on your timeline (press `I` and `O`)
3. In the ChatCut panel, click **"Get Current Selection"**
4. You should see the duration displayed

### Test 3: Process a Prompt

1. In the ChatCut panel, type a prompt:
   - "make this black and white"
   - "blur this clip"
   - "zoom in 150%"

2. Click **"Process Prompt"**

3. You should see:
   - AI Interpretation card with effect details
   - Confidence score
   - Description of what will happen

4. (Effect application is coming in Phase 3)

---

## Troubleshooting

### Backend won't start

**Error**: `GEMINI_API_KEY not found`
- Make sure you created the `.env` file in the `backend` directory
- Check that the file contains: `GEMINI_API_KEY=your_actual_key`

**Error**: `ModuleNotFoundError: No module named 'google'`
- Run: `pip install google-genai`

### Frontend won't build

**Error**: `Invalid Version: npm:acorn-with-stage3`
- Delete `package-lock.json` and `node_modules`
- Run `npm install` again
- (We already fixed this earlier!)

### Plugin won't load

**Error**: "No applications are connected"
- Make sure Premiere Pro is running
- Restart UXP Developer Tools
- Try unloading and reloading the plugin

**Panel doesn't appear**
- In Premiere Pro: Window → Extensions → ChatCut
- Check UXP Developer Tools for error messages

### Backend connection fails

**Error**: "Backend not connected" banner in panel
- Make sure Python server is running on port 3001
- Check firewall settings
- Try accessing http://localhost:3001/health in a browser

---

## Development Workflow

### Making Frontend Changes

1. Edit files in `frontend/src/`
2. Webpack will auto-rebuild (if `npm run watch` is running)
3. In UXP Developer Tools, click ••• → "Reload"
4. Panel updates automatically!

### Making Backend Changes

1. Edit files in `backend/`
2. Stop the server (Ctrl+C)
3. Restart: `python main.py`
4. No need to reload the frontend

### Debugging

**Frontend**:
- In UXP Developer Tools, click ••• → "Debug"
- Opens Chrome DevTools
- Check Console for errors

**Backend**:
- Watch the terminal where `python main.py` is running
- All requests are logged there

---

## API Endpoints

Once running, you can test the backend directly:

- **Health Check**: http://localhost:3001/health
- **API Docs**: http://localhost:3001/docs (interactive Swagger UI)
- **Root**: http://localhost:3001/

### Example API Call

```bash
# Test prompt processing (requires Gemini API key)
curl -X POST http://localhost:3001/api/process-prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "make this black and white"}'
```

---

## What's Working in This MVP

✅ Frontend panel loads in Premiere Pro
✅ Timeline selection detection
✅ Backend API connection
✅ Gemini AI prompt processing
✅ Effect mapping (Black & White, Blur, Transform)
✅ Confidence scoring
✅ Error handling

## What's NOT Working Yet

❌ Actually applying effects to timeline (Phase 3)
❌ Multi-track support
❌ Undo functionality
❌ AI video generation (out of scope for MVP)

---

## Next Steps

See [plan.md](plan.md) for the full roadmap!

**Current Phase**: Phase 2 Complete ✓
**Next Phase**: Phase 3 - Effect Application

---

## Getting Help

- Check [plan.md](plan.md) for architecture details
- See backend logs for API errors
- Use UXP Debug console for frontend errors
- Gemini API docs: https://ai.google.dev/gemini-api/docs

---

**Ready to ship this MVP!** 🚀
