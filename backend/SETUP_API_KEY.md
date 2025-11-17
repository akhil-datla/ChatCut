# Setting Up Gemini API Key

## Quick Setup

The backend needs a Gemini API key to process AI prompts. Here's how to set it up:

### Option 1: Create a `.env` file (Recommended)

1. **Create a `.env` file** in the `backend` directory:
   ```bash
   cd backend
   touch .env  # On Windows: type nul > .env
   ```

2. **Add your API key** to the `.env` file:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Restart the backend server** - it will automatically load the `.env` file

### Option 2: Set Environment Variable (Temporary)

**On Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your_actual_api_key_here"
cd backend
python main.py
```

**On Windows (Command Prompt):**
```cmd
set GEMINI_API_KEY=your_actual_api_key_here
cd backend
python main.py
```

**On Linux/macOS:**
```bash
export GEMINI_API_KEY="your_actual_api_key_here"
cd backend
python main.py
```

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key
5. Add it to your `.env` file or set it as an environment variable

### Verify It's Working

After setting the API key and starting the server, you should see:
- No warning messages about missing API key
- The `/health` endpoint should show `"configured": true`

Test the health endpoint:
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

### Troubleshooting

**Error: "Gemini API not configured"**
- Make sure the `.env` file is in the `backend` directory
- Check that the API key doesn't have quotes around it in the `.env` file
- Restart the backend server after creating/updating `.env`

**Error: "API_KEY_MISSING"**
- Verify the environment variable is set correctly
- Check that `python-dotenv` is installed: `pip install python-dotenv`
- Make sure you're running the server from the `backend` directory

**Still not working?**
- Check the backend console for error messages
- Verify the API key is valid by testing it directly with the Gemini API
- Make sure there are no extra spaces or characters in the API key

