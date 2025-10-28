# ChatCut

AI-powered video editing assistant for Adobe Premiere Pro. ChatCut uses natural language processing to apply video effects through simple text prompts.

## Overview

ChatCut consists of two main components:
- **Frontend**: A UXP (Unified Extensibility Platform) plugin panel for Premiere Pro
- **Backend**: A Python FastAPI server that processes prompts using Google Gemini AI

## Prerequisites

- **Adobe Premiere Pro** 23.0.0 or higher
- **Node.js** and npm (for frontend)
- **Python** 3.8+ (for backend)
- **UXP Developer Tools** (for loading the plugin)
- **Google Gemini API Key** (get yours at [https://ai.google.dev/](https://ai.google.dev/))

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create .env file with your Gemini API key
# Copy .env.example to .env and add your key
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=your_api_key_here

# Run the backend server
python main.py
```

The backend server will start at `http://localhost:3001`

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build and watch for changes (development)
npm run watch

# OR build for production (one-time build)
npm run build
```

### 3. Load Plugin in Premiere Pro

1. Open **UXP Developer Tools**
2. Click **"Add Plugin..."**
3. Navigate to `frontend/dist/` and select `manifest.json`
4. Click the **•••** button next to your plugin
5. Click **"Load"**
6. Switch to Premiere Pro - you should see the ChatCut panel

## Usage

1. **Start the backend server** (must be running before using the plugin)
   ```bash
   cd backend
   python main.py
   ```

2. **Open Premiere Pro** and load a project

3. **Open the ChatCut panel** (Windows > Extensions > ChatCut)

4. **Select clips** on the timeline

5. **Enter a prompt** like:
   - "make this black and white"
   - "blur this clip"
   - "zoom in 2x"

6. The AI will process your request and apply the corresponding effect!

## Supported Effects (MVP)

- **Black & White** - Convert clips to grayscale
- **Gaussian Blur** - Apply blur effects with adjustable intensity
- **Transform** - Scale, rotate, and move clips

## Project Structure

```
ChatCut/
├── backend/              # Python FastAPI backend
│   ├── main.py          # Main server file
│   ├── models/          # Data models
│   ├── services/        # Gemini AI service & effect mapper
│   └── requirements.txt # Python dependencies
│
├── frontend/            # UXP Plugin (React)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API clients & Premiere Pro integration
│   │   └── panels/      # Main App panel
│   ├── plugin/          # Plugin manifest & HTML
│   └── dist/            # Built plugin (generated)
│
└── README.md           # This file
```

## Development

### Backend Development

The backend uses FastAPI with hot-reload enabled. Just edit files in `backend/` and the server will automatically restart.

**Useful endpoints:**
- `GET /` - Server info
- `GET /health` - Health check
- `POST /api/ping` - Test connection
- `POST /api/process-prompt` - Process AI prompts

View API docs at: `http://localhost:3001/docs`

### Frontend Development

Use `npm run watch` to automatically rebuild when you make changes:

```bash
cd frontend
npm run watch
```

After making changes:
1. Reload the plugin in UXP Developer Tools
2. Test in Premiere Pro

### Important: UXP Network Restrictions

⚠️ **UXP plugins can only access network APIs via domain names, not IP addresses.**

- ✅ Use: `http://localhost:3001`
- ❌ Don't use: `http://127.0.0.1:3001`

## Troubleshooting

### Backend won't start
- Make sure Python 3.8+ is installed: `python --version`
- Install dependencies: `pip install -r requirements.txt`
- Check that your Gemini API key is set in `backend/.env`

### Frontend won't build
- Delete `node_modules/` and `package-lock.json`
- Run `npm install` again
- Make sure you're in the `frontend/` directory

### Plugin won't load in Premiere Pro
- Make sure you ran `npm run build` or `npm run watch` first
- Point UXP Developer Tools to `frontend/dist/manifest.json`
- Check that Premiere Pro version is 23.0.0 or higher
- Check UXP Developer Tools console for errors

### Effects not applying
- Make sure backend server is running (`python main.py`)
- Check browser console in UXP DevTools for connection errors
- Verify you have clips selected on the timeline
- Try the `/health` endpoint: `http://localhost:3001/health`

## License

See [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

Made with ❤️ for video editors everywhere
