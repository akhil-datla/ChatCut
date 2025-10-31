# Backend Status Check

## Current Issue: HTTP 503

The frontend is getting `503 Service Unavailable` which means:

### Possible Causes:
1. **Backend server not running** ❌
2. **Backend crashed** 💥
3. **Backend error handling the request** ⚠️

## Quick Fix Steps

### Step 1: Check if Backend is Running

```bash
curl http://localhost:3001/health
```

If this fails, backend is not running.

### Step 2: Start/Restart Backend

```bash
cd ChatCut/backend
source venv/bin/activate
python main.py
```

**Keep this terminal window open!** The server must keep running.

### Step 3: Verify Backend Started Correctly

When you start the server, you should see:
```
Starting ChatCut Backend on http://127.0.0.1:3001
```

**You should NOT see:**
- `⚠️ WARNING: gemini provider not configured`
- Any Python tracebacks/errors

### Step 4: Test Endpoint Directly

In a new terminal (while backend is running):
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

If you get an error, check backend terminal for error messages.

### Step 5: Keep Backend Running

**IMPORTANT:** The backend server must stay running in a terminal window. If you close the terminal, the server stops and you'll get 503 errors.

### Step 6: Reload Plugin (After Backend is Running)

```bash
cd ChatCut/frontend
npm run uxp:reload
```

## Why 503?

503 Service Unavailable typically means:
- Server is down
- Server crashed
- Server is overloaded
- Server can't handle the request

In this case, it's likely the server **is not running** or **crashed**.

## Troubleshooting

### Backend Won't Start
- Check `.env` file exists in `backend/` directory
- Verify `GEMINI_API_KEY` is set (not placeholder)
- Check Python version (3.9+)
- Make sure port 3001 is not in use

### Backend Starts but Crashes
- Check backend terminal for error messages
- Verify API key is valid
- Check if Gemini API is accessible

### Still Getting 503
- Make sure backend is actually running (check process)
- Try restarting backend completely
- Check if firewall is blocking port 3001

