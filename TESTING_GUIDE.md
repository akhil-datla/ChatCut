# Testing Guide - AI Integration

## Quick Test Checklist

### 1. Backend Setup ✅
- [x] Dependencies installed
- [x] .env file created
- [ ] API key added to .env
- [ ] Backend server running

### 2. Frontend Setup
- [ ] Frontend built
- [ ] Plugin loaded in Premiere Pro
- [ ] Backend connection verified

### 3. Testing Flow
- [ ] Test ping endpoint
- [ ] Test AI prompt processing
- [ ] Test action dispatch
- [ ] Test video editing

## Step-by-Step Testing

### Start Backend Server

```bash
cd ChatCut/backend
source venv/bin/activate
python main.py
```

**Expected output:**
```
Starting ChatCut Backend on http://127.0.0.1:3001
```

**Verify it's working:**
```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "ok",
  "ai_provider": {
    "provider": "gemini",
    "configured": true
  }
}
```

### Test AI Prompt Processing

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

### Test in Plugin UI

1. **Start Backend Server** (keep it running)
2. **Build Frontend** (if needed)
3. **Load Plugin in Premiere Pro**
4. **Select a video clip** on the timeline
5. **Try these prompts:**
   - "zoom in by 120%"
   - "zoom out to 80%"
   - "zoom in gradually"
   - "zoom in to 150%"

**Expected behavior:**
- Plugin shows "🤖 Processing prompt..."
- AI extracts action and parameters
- Action is applied to selected clip(s)
- Success message appears

## Troubleshooting

### Backend Not Starting
- Check port 3001 is available
- Verify virtual environment is activated
- Check .env file exists and has API key

### API Key Not Working
- Verify key is in .env file (not .env.example)
- Check key doesn't have quotes around it
- Restart backend server after adding key

### Frontend Can't Connect
- Verify backend is running on port 3001
- Check CORS is enabled (should be by default)
- Look at browser console for errors

### AI Not Extracting Actions
- Check backend logs for errors
- Verify API key is valid
- Try simpler prompts first ("zoom in")

## UI Changes to Look For

### Before (Old)
- Hardcoded string parsing
- Only "zoom in" / "zoom out" keywords
- Fixed 150% zoom

### After (New)
- AI processing indicator: "🤖 Processing prompt..."
- AI extraction message: "✨ AI understood: ..."
- Custom parameters from user request
- Supports variations like "120%", "gradually", etc.

## Test Prompts

### Good Prompts (Should Work)
- ✅ "zoom in by 120%"
- ✅ "zoom out to 80%"
- ✅ "zoom in gradually"
- ✅ "zoom in to 200%"
- ✅ "make it zoom in"

### Edge Cases (May Need Improvement)
- ⚠️ "zoom in a bit" (no number)
- ⚠️ "make it bigger" (ambiguous)
- ⚠️ "zoom in slightly" (relative)

## Expected Console Output

### Backend Console
```
[AI] Processing prompt: zoom in by 120%
[AI] Result: {'action': 'zoomIn', 'parameters': {'endScale': 120}, ...}
```

### Plugin Console
```
🤖 Processing prompt: "zoom in by 120%"
✨ AI understood: Zooming in to 120%
✅ Action applied successfully to 1 clip(s)!
```

