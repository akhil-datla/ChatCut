# Testing Audio Effects Feature

This guide explains how to test the new audio effects functionality (volume adjustment and audio filters).

## Prerequisites

### 1. Start Backend Server

```bash
cd ChatCut/backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

**Keep this terminal open!** You should see:
```
Starting ChatCut Backend on http://127.0.0.1:3001
```

### 2. Verify Backend is Running

In a new terminal:
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

### 3. Reload Plugin in Premiere Pro

**Option A: Right-click plugin panel → "Reload Plugin"**

**Option B: Restart Premiere Pro completely**

## Testing Setup

### 1. Create Test Project

1. Open Premiere Pro Beta (version 25.2 or later)
2. Create a new project
3. Create a new sequence
4. **Import an audio file** (MP3, WAV, etc.) into your project
5. **Drag the audio file to an audio track** in the timeline
6. **Select the audio clip** on the timeline

### 2. Open ChatCut Plugin

1. Go to **Window → Extensions → ChatCut** (or wherever your plugin is)
2. The plugin panel should open showing the chat interface

## Test Cases

### Test 1: Volume Adjustment (Increase)

**Steps:**
1. Select an audio clip on the timeline
2. In ChatCut plugin, type: `adjust volume by 3 decibels`
3. Press Enter or click Send

**Expected Results:**
- ✅ Console shows: `🎵 Processing audio request: "adjust volume by 3 decibels"`
- ✅ Console shows: `✨ AI extracted: "adjustVolume" with parameters: {"volumeDb": 3}`
- ✅ Console shows: `✅ Volume adjusted: 0dB → 3dB (+3dB)`
- ✅ Audio clip volume increases (you should hear it louder)

**What to Check:**
- Open the audio clip's effects panel in Premiere Pro
- Look for a "Gain" or "Volume" effect
- The gain/volume parameter should show +3dB

### Test 2: Volume Adjustment (Decrease)

**Steps:**
1. Select an audio clip on the timeline
2. Type: `reduce volume by 6dB`
3. Press Enter

**Expected Results:**
- ✅ Console shows: `✅ Volume adjusted: XdB → YdB (-6dB)` (where Y = X - 6)
- ✅ Audio clip volume decreases

### Test 3: Volume Adjustment (Multiple Clips)

**Steps:**
1. Select **multiple audio clips** on different tracks
2. Type: `make it louder by 3dB`
3. Press Enter

**Expected Results:**
- ✅ All selected audio clips have volume adjusted
- ✅ Console shows: `✅ Action applied successfully to N clip(s)!`

### Test 4: Apply Audio Filter (Reverb)

**Steps:**
1. Select an audio clip
2. Type: `add reverb`
3. Press Enter

**Expected Results:**
- ✅ Console shows: `✨ AI extracted: "applyAudioFilter" with parameters: {"filterDisplayName": "Reverb"}`
- ✅ Console shows: `✅ Audio filter applied: Reverb` (or similar name)
- ✅ Reverb effect is added to the audio clip

**What to Check:**
- Open the audio clip's effects panel
- You should see a "Reverb" effect in the effects list

### Test 5: Apply Audio Filter (Parametric EQ)

**Steps:**
1. Select an audio clip
2. Type: `apply parametric eq`
3. Press Enter

**Expected Results:**
- ✅ Parametric EQ filter is applied
- ✅ Console confirms success

### Test 6: Apply Audio Filter (Noise Reduction)

**Steps:**
1. Select an audio clip
2. Type: `add noise reduction`
3. Press Enter

**Expected Results:**
- ✅ Noise reduction filter is applied (if available)
- ✅ Or helpful message if filter not found

## Troubleshooting

### Issue: "No audio clips selected"

**Solution:**
- Make sure you're selecting clips on **audio tracks**, not video tracks
- Audio tracks are typically below video tracks in the timeline
- The clip must be an actual audio clip (not a video clip with audio)

### Issue: "Could not find Gain/Volume filter"

**Solution:**
- Check the console output - it will list available audio filters
- Try manually adding a "Gain" or "Volume" effect in Premiere Pro first
- The filter name might be different in your Premiere Pro version

### Issue: "Backend server is not running"

**Solution:**
- Go back to Prerequisites section
- Make sure backend is running on port 3001
- Check with `curl http://localhost:3001/health`

### Issue: AI doesn't recognize audio commands

**Solution:**
- Check backend console for errors
- Try more explicit commands:
  - `adjust volume by 3 decibels` (works better than "make louder")
  - `add reverb effect` (works better than just "reverb")
- Check that GEMINI_API_KEY is set in backend/.env

### Issue: Volume adjustment doesn't work

**Solution:**
- Check console for error messages
- Look for: `Available audio filters: ...` - this shows what filters are available
- Try applying a Gain filter manually first, then test again
- The parameter name might be different - check console logs

## Debugging Tips

### Check Console Output

The plugin console will show:
- Available audio filters when volume adjustment is attempted
- Current gain values before/after adjustment
- Error messages with helpful hints

### Check Premiere Pro Effects Panel

1. Select the audio clip
2. Open **Effects Controls** panel (Window → Effects Controls)
3. Look for audio effects that were added
4. Check parameter values

### Check Browser Console

1. In Premiere Pro, open Developer Tools (if available)
2. Or check the UXP Developer Tool console
3. Look for JavaScript errors or warnings

## Expected Console Output Examples

### Successful Volume Adjustment:
```
🎵 Processing audio request: "adjust volume by 3 decibels"
🤖 Sending to AI...
✨ AI extracted: "adjustVolume" with parameters: {"volumeDb": 3}
💬 AI message: Adjusting volume by 3dB
Available audio filters: Gain, Parametric EQ, Reverb, DeNoise, ...
Adding audio filter: Gain
✅ Volume adjusted: 0dB → 3dB (+3dB)
✅ Action applied successfully to 1 clip(s)!
```

### Successful Audio Filter:
```
🎵 Processing audio request: "add reverb"
🤖 Sending to AI...
✨ AI extracted: "applyAudioFilter" with parameters: {"filterDisplayName": "Reverb"}
💬 AI message: Applying Reverb
Available audio filters: Gain, Parametric EQ, Reverb, DeNoise, ...
✅ Audio filter applied: Reverb
✅ Action applied successfully to 1 clip(s)!
```

## Next Steps

Once basic tests pass:
1. Try different volume values (e.g., -12dB, +6dB)
2. Try different audio filters (check available filters from console)
3. Test with multiple clips selected
4. Test edge cases (very large volume changes, etc.)

## Notes

- **Filter names may vary** by Premiere Pro version
- The console will show available filters when volume adjustment is attempted
- Some filters might not be available in all Premiere Pro versions
- Volume adjustment adds to current value (doesn't replace it)

