# Diagnosis: Why 120% Isn't Working

## The Problem

Logs show:
- `[Backend] Ping response` - Still calling OLD `sendPing` endpoint
- `[Edit] Starting zoom on clips` - Old code still running
- Zoom applies at 150% instead of 120%

## Root Cause

1. **Frontend not reloaded** - Plugin is still running old cached code
2. **Backend API key loading** - May not be loading when server starts
3. **AI extraction** - Need to verify it's extracting parameters correctly

## Solutions

### Step 1: Verify Backend is Running with API Key

```bash
cd ChatCut/backend
source venv/bin/activate
python main.py
```

Check output - should see:
- No "⚠️ WARNING: gemini provider not configured"
- Server starts without errors

### Step 2: Test Backend Directly

```bash
curl -X POST http://localhost:3001/api/process-prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "zoom in 120%"}'
```

**Expected response:**
```json
{
  "action": "zoomIn",
  "parameters": {"endScale": 120},
  "confidence": 1.0,
  "message": "..."
}
```

If this returns `null` action or wrong parameters, the AI isn't extracting correctly.

### Step 3: Rebuild and Reload Frontend

```bash
cd ChatCut/frontend
npm run build
npm run uxp:reload
```

### Step 4: Verify New Code is Running

After reload, try "zoom in 120%" again.

**NEW code should show:**
- "🤖 Sending to AI: ..."
- "✨ AI extracted: ..."
- Console: `[Edit] AI Response: {action: "zoomIn", parameters: {endScale: 120}}`

**OLD code (still cached):**
- "[Backend] Ping response"
- "[Edit] Starting zoom on clips"
- No AI extraction messages

## If AI Still Not Extracting Parameters

The issue might be in the AI prompt. Check:
1. Gemini API is responding
2. JSON parsing is working
3. Parameters are being extracted correctly

Test with simple prompt first: "zoom in by 120 percent"

