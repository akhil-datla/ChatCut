# ChatCut

An AI-powered Adobe Premiere Pro plugin that lets you edit videos using natural language commands. Instead of navigating menus, simply type requests like "zoom in by 120%" or "apply a cross dissolve" and ChatCut handles the rest.

## Features

- **Natural Language Editing**: Type commands in plain English to edit your videos
- **AI-Powered Understanding**: Uses Google Gemini to interpret your intent and extract parameters
- **Multiple Actions Supported**:
  - Zoom in/out with customizable scale and animation
  - Apply 60+ video filters (blur, sharpen, color correction, etc.)
  - Apply 100+ transitions (cross dissolve, dip to black, wipes, etc.)
  - Gaussian blur with adjustable intensity
- **Batch Operations**: Apply edits to multiple selected clips at once
- **Smart Responses**: Handles ambiguous requests with clarifying questions
- **Extensible Architecture**: Provider abstraction allows swapping AI backends (Gemini, OpenAI, etc.)

## Tech Stack

**Backend**
- Python 3.9+
- FastAPI
- Google Gemini API
- Uvicorn (ASGI server)

**Frontend**
- React 16.8
- Adobe UXP (Universal Extensibility Platform)
- Webpack

## Project Structure

```
ChatCut/
├── backend/                    # Python FastAPI backend
│   ├── main.py                 # FastAPI app and routes
│   ├── requirements.txt        # Python dependencies
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response models
│   ├── services/
│   │   ├── ai_service.py       # Provider-agnostic AI service
│   │   └── providers/
│   │       └── gemini_provider.py  # Google Gemini implementation
│   └── tests/                  # Test suite
├── frontend/                   # Adobe UXP React plugin
│   ├── package.json
│   ├── webpack.config.js
│   ├── plugin/
│   │   └── manifest.json       # UXP plugin manifest
│   └── src/
│       ├── components/         # React components
│       └── services/           # API client and action handlers
└── notebooks/                  # Jupyter notebooks for experiments
```

## Prerequisites

- Python 3.9 or higher
- Node.js 14+ and npm
- Adobe Premiere Pro 2023 or later
- Adobe UXP Developer Tools
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

## Installation

### Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `.env` and add your API key:
```
AI_PROVIDER=gemini
GEMINI_API_KEY=your_api_key_here
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Build the plugin
npm run build

# Or use watch mode for development
npm run watch
```

## Usage

### 1. Start the Backend Server

```bash
cd backend
python main.py
```

The server runs on `http://localhost:3001`.

### 2. Load the Plugin in Premiere Pro

1. Open Adobe UXP Developer Tools
2. Click "Add Plugin" and select `frontend/dist/manifest.json`
3. Click "Load" to load the plugin
4. The ChatCut panel will appear in Premiere Pro

### 3. Edit with Natural Language

1. Select one or more clips in your Premiere Pro timeline
2. Type a command in the ChatCut panel, for example:
   - "Zoom in by 150%"
   - "Apply a cross dissolve transition"
   - "Add gaussian blur at 50%"
   - "Apply the lumetri color filter"
3. Press Enter and watch the magic happen

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/process-prompt` | POST | Process natural language into editing action |
| `/api/process-media` | POST | Process with media file context |
| `/api/ping` | POST | Test backend connection |
| `/health` | GET | Health check with provider info |

### Example Request

```bash
curl -X POST http://localhost:3001/api/process-prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "zoom in by 120%"}'
```

### Example Response

```json
{
  "action": "zoomIn",
  "parameters": {
    "endScale": 120,
    "animated": false
  },
  "confidence": 0.95,
  "message": "I'll zoom in to 120% scale."
}
```

## Supported Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `zoomIn` | Zoom into the clip | `endScale`, `startScale`, `animated`, `duration` |
| `zoomOut` | Zoom out of the clip | `endScale`, `startScale`, `animated`, `duration` |
| `applyFilter` | Apply a video filter | `filterName` |
| `applyTransition` | Apply a transition | `transitionName`, `duration`, `applyToStart` |
| `applyBlur` | Apply Gaussian blur | `blurAmount` (0-100+) |

## Development

### Running Tests

```bash
cd backend
pytest tests/ -v
```

### Adding a New AI Provider

See `backend/services/providers/PROVIDER_GUIDE.md` for instructions on implementing new AI providers (OpenAI, Anthropic, etc.).

### Building for Production

```bash
cd frontend
npm run build
```

## Configuration

Environment variables (in `backend/.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | AI provider to use | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `GEMINI_MODEL` | Gemini model version | `gemini-2.0-flash` |

## Troubleshooting

**Backend returns 503 errors**
- Ensure your API key is valid and set in `.env`
- Check that the Gemini API is accessible from your network

**Plugin won't load in Premiere Pro**
- Ensure you're using UXP Developer Tools (not CEP)
- Verify the manifest.json path is correct
- Check Premiere Pro version compatibility (2023+)

**Network errors from plugin**
- UXP requires domain names, not IP addresses
- Use `localhost` instead of `127.0.0.1`

## License

See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read through the existing documentation:
- `DEVELOPMENT_ROADMAP.md` - Planned features and phases
- `TESTING_GUIDE.md` - How to write and run tests
- `backend/services/providers/PROVIDER_GUIDE.md` - Adding new AI providers
