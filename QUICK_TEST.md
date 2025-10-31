# Quick Test Guide

## 🚀 Start Testing

### Step 1: Start Backend Server

**Option A: Using the start script**
```bash
cd ChatCut/backend
./start_server.sh
```

**Option B: Manual start**
```bash
cd ChatCut/backend
source venv/bin/activate
python main.py
```

**Expected output:**
```
Starting ChatCut Backend on http://127.0.0.1:3001
```

**Verify it's running:**
Open a new terminal and run:
```bash
curl http://localhost:3001/health
```

You should see:
```json
{
  "status": "ok",
  "ai_provider": {
    "provider": "gemini",
    "configured": true
  }
}
```

### Step 2: Test AI Endpoint

In another terminal:
```bash
curl -X POST http://localhost:3001/api/process-prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "zoom in by 120%"}'
```

**Expected response:**
```json
{
  "action": "zoomIn",
  "parameters": {"endScale": 120},
  "confidence": 1.0,
  "message": "Zooming in to 120%"
}
```

### Step 3: Build and Load Plugin

**Build frontend:**
```bash
cd ChatCut/frontend
npm run build
```

**Load in Premiere Pro:**
```bash
npm run uxp:load
```

### Step 4: Test in Plugin UI

1. **Select a video clip** on the timeline in Premiere Pro
2. **Open the ChatCut plugin panel**
3. **Type a prompt** in the chat input:
   - "zoom in by 120%"
   - "zoom out to 80%"
   - "zoom in gradually"

**Expected UI behavior:**
- You'll see: "🤖 Processing prompt: ..."
- Then: "✨ AI understood: ..."
- Then: "✅ Action applied successfully to 1 clip(s)!"

## 🐛 Troubleshooting

### Backend says "configured: false"
- Make sure `.env` file exists in `backend/` directory
- Check API key is set (not placeholder)
- Restart backend server after changing .env

### Frontend can't connect
- Verify backend is running (check http://localhost:3001/health)
- Check browser console for CORS errors
- Make sure backend is on port 3001

### AI not extracting actions
- Check backend console logs
- Verify API key is valid
- Try simpler prompts first

## 📊 What Changed in UI

### Before
- Simple string matching ("zoom in" → fixed 150%)
- Limited to keywords
- No parameter customization

### After (Current)
- AI processes any natural language prompt
- Extracts custom parameters (120%, 80%, etc.)
- Shows AI processing status
- More intelligent action selection

