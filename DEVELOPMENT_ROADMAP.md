# ChatCut Development Roadmap

## Current Status: ✅ AI Integration Complete

The core AI integration is implemented and ready for testing. Users can now send natural language prompts and the AI will extract actions and parameters.

## Development TODO List

### Phase 1: Testing & Stabilization (Current)
- [x] Install dependencies (google-generativeai, python-dotenv)
- [x] Create test suite structure
- [ ] Set up GEMINI_API_KEY in `.env` file
- [ ] Test AI prompt extraction end-to-end
- [ ] Test with Premiere Pro plugin
- [ ] Fix any parameter extraction issues

### Phase 2: Enhanced Actions (Next Steps)
- [ ] Add more actions to registry:
  - [ ] `brightness` - Adjust brightness
  - [ ] `contrast` - Adjust contrast
  - [ ] `saturation` - Adjust saturation
  - [ ] `speed` - Change clip playback speed
  - [ ] `crop` - Crop video
  - [ ] `rotate` - Rotate video
- [ ] Improve parameter extraction for numeric values
- [ ] Add support for time-based parameters (e.g., "zoom in at 2 seconds")
- [ ] Add support for multiple actions in one prompt

### Phase 3: AI Improvements
- [ ] Refine AI prompts for better extraction
- [ ] Add confidence thresholds (reject low-confidence actions)
- [ ] Add action confirmation for ambiguous requests
- [ ] Improve handling of edge cases:
  - [ ] Percentages without numbers ("zoom in a bit")
  - [ ] Relative values ("zoom in more")
  - [ ] Negative actions ("don't zoom")
- [ ] Add context awareness (remember previous actions)

### Phase 4: User Experience
- [ ] Add loading indicators during AI processing
- [ ] Show extracted parameters before applying
- [ ] Add undo/redo support
- [ ] Add action history/log
- [ ] Better error messages for failed actions
- [ ] Add help text for available actions

### Phase 5: Advanced Features
- [ ] Batch processing multiple prompts
- [ ] Voice input support (future)
- [ ] Action templates/presets
- [ ] Custom action definitions
- [ ] Multi-clip coordination ("sync zoom across all clips")

### Phase 6: Performance & Reliability
- [ ] Add caching for common prompts
- [ ] Add retry logic for API failures
- [ ] Optimize AI response times
- [ ] Add rate limiting
- [ ] Add logging and monitoring

## Quick Start Checklist

1. **Backend Setup:**
   ```bash
   cd ChatCut/backend
   source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   # Add your GEMINI_API_KEY to .env
   python main.py
   ```

2. **Frontend Setup:**
   - Build frontend with webpack
   - Load plugin in Premiere Pro
   - Test connection to backend

3. **Testing:**
   ```bash
   cd backend
   pytest tests/ -v
   ```

## Action Registry

Current actions:
- ✅ `zoomIn` - Zoom in on clips
- ✅ `zoomOut` - Zoom out on clips
- ✅ `applyFilter` - Apply video filters
- ✅ `applyTransition` - Apply transitions

To add a new action:
1. Add handler in `frontend/src/services/actionDispatcher.js`
2. Add to AI prompt in `backend/services/ai_service.py`
3. Update action registry documentation

## Notes

- Keep actions simple and focused
- Prioritize functionality over UI polish
- Test with real Premiere Pro projects
- Document all new actions

