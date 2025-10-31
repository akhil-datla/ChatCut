# Start Backend Server

## Critical: Backend Must Be Running!

The backend server is **NOT currently running**. You must start it before the plugin can work.

## Quick Start

Open a terminal and run:

```bash
cd ChatCut/backend
source venv/bin/activate
python main.py
```

**Keep this terminal window open!** If you close it, the backend stops.

## Expected Output

When the backend starts, you should see:
```
Starting ChatCut Backend on http://127.0.0.1:3001
```

**You should NOT see:**
- `⚠️ WARNING: gemini provider not configured`

## Verify It's Working

In a **new terminal**, test:
```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "ai_provider": {
    "provider": "gemini",
    "configured": true
  }
}
```

## Then Reload Plugin

After backend is running:
```bash
cd ChatCut/frontend
npm run uxp:reload
```

## After Both Are Running

1. Backend server running (keep terminal open)
2. Plugin reloaded in Premiere Pro
3. Test: Select clip → Type "zoom in 120%"

You should see:
- "🤖 Sending to AI: ..."
- "✨ AI extracted: \"zoomIn\" with parameters: {\"endScale\":120}"
- Clip zooms to 120%

