# How to Fix the Gemini API Key Error

## The Problem
You're seeing: `"AI couldn't understand: Gemini API not configured. Please set GEMINI_API_KEY."`

## The Solution

The `.env` file has been created with your API key. Now you need to **restart the backend server** so it can load the API key.

### Step 1: Stop the Current Backend Server

If the backend server is running, stop it:
- Press `Ctrl+C` in the terminal where the server is running
- Or close the terminal window

### Step 2: Navigate to Backend Directory

```bash
cd backend
```

### Step 3: Activate Virtual Environment (if using one)

```bash
# On Windows (PowerShell)
venv\Scripts\Activate.ps1

# On Windows (Command Prompt)
venv\Scripts\activate.bat

# On Linux/macOS
source venv/bin/activate
```

### Step 4: Verify .env File Exists

```bash
# Check if .env file exists
cat .env
# Should show: GEMINI_API_KEY=AIzaSyAXVihFG4ajEcnJ_LxvFdsMHAKBDV06i3g
```

### Step 5: Start the Backend Server

```bash
python main.py
```

### Step 6: Verify It's Working

When the server starts, you should see:
- ✅ No warning about "GEMINI_API_KEY not set"
- ✅ Server running on `http://localhost:3001`

You can also test the health endpoint:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "ai_provider": {
    "provider": "gemini",
    "configured": true
  }
}
```

### Step 7: Test in ChatCut

1. Reload the ChatCut plugin in Premiere Pro
2. Try "zoom in 150%" again
3. The error should be gone!

## Troubleshooting

**If you still see the error:**
1. Make sure the `.env` file is in the `backend` directory (not `backend/backend`)
2. Make sure there are no extra spaces or quotes around the API key in `.env`
3. Make sure `python-dotenv` is installed: `pip install python-dotenv`
4. Check the backend console for any error messages when it starts

**File location:**
The `.env` file should be at: `backend/.env`

**File contents should be exactly:**
```
GEMINI_API_KEY=AIzaSyAXVihFG4ajEcnJ_LxvFdsMHAKBDV06i3g
```

(No quotes, no spaces around the `=`, just the key after the `=`)

