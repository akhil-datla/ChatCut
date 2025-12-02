# Testing Separate Audio Prompt & Error Handling

This guide explains how to test the new changes that separate audio editing from video editing.

## What Changed

1. **Separate System Prompt**: Audio editing requests now use a dedicated prompt focused on audio effects
2. **Separate Error Handling**: Audio errors are handled separately with audio-specific messages

## Prerequisites

### 1. Build the Frontend

First, rebuild the frontend with the new changes:

```bash
cd /Users/hariraghavan/Downloads/ChatCut/frontend
npm run build
```

**Expected output:**
```
Hash: ...
Version: webpack 4.32.2
Time: XXXXms
Built at: ...
```

### 2. Start the Backend Server

Open a **new terminal** and start the backend:

```bash
cd /Users/hariraghavan/Downloads/ChatCut/backend
source venv/bin/activate
python main.py
```

**Keep this terminal open!** You should see:
```
Starting ChatCut Backend on http://127.0.0.1:3001
```

### 3. Verify Backend is Running

In another terminal, test:
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

## Reload Plugin in UXP Developer Tools

### Method 1: Using UXP Developer Tools (Recommended)

1. **Open UXP Developer Tools** (should already be open)
2. **Find your ChatCut plugin** in the list
3. **Click the "•••" button** (three dots) next to the plugin
4. **Click "Reload"**

The plugin will reload with the new code.

### Method 2: Right-click in Premiere Pro

1. **Right-click on the ChatCut plugin panel** in Premiere Pro
2. **Select "Reload Plugin"** from the context menu

### Method 3: Restart Premiere Pro

If the above methods don't work:
1. **Close Premiere Pro completely**
2. **Reopen Premiere Pro**
3. Plugin will load with latest build

## Test Cases

### Test 1: Verify Audio Requests Use Separate Prompt

**Setup:**
1. Open Premiere Pro Beta
2. Create a new project/sequence
3. Import an **audio file** (MP3, WAV, etc.)
4. Drag it to an **audio track** in the timeline
5. **Select the audio clip**

**Test:**
1. Open ChatCut plugin panel
2. Type: `adjust volume by 3 decibels`
3. Press Enter

**Expected Results:**
- ✅ Console shows: `🤖 Sending to AI: "adjust volume by 3 decibels"`
- ✅ Console shows: `✨ AI extracted: "adjustVolume" with parameters: {"volumeDb": 3}`
- ✅ Console shows: `✅ Audio effect applied successfully to 1 clip(s)!` (NEW: audio-specific message)
- ✅ Volume is adjusted

**What to Verify:**
- Check the **backend terminal** - you should see the request being processed
- The AI should recognize this as an audio request and use the audio-specific prompt

### Test 2: Verify Video Requests Use Video Prompt

**Setup:**
1. Select a **video clip** on a video track
2. (Make sure no audio clips are selected)

**Test:**
1. Type: `zoom in by 120%`
2. Press Enter

**Expected Results:**
- ✅ Console shows: `🤖 Sending to AI: "zoom in by 120%"`
- ✅ Console shows: `✨ AI extracted: "zoomIn" with parameters: {"endScale": 120}`
- ✅ Console shows: `✅ Action applied successfully to 1 clip(s)!` (video message)
- ✅ Video zooms in

**What to Verify:**
- This should use the video editing prompt (not audio prompt)
- Check backend terminal to confirm

### Test 3: Test Audio Filter with Separate Error Handling

**Setup:**
1. Select an **audio clip**

**Test:**
1. Type: `add reverb`
2. Press Enter

**Expected Results:**
- ✅ Console shows: `✨ AI extracted: "applyAudioFilter" with parameters: {"filterDisplayName": "Reverb"}`
- ✅ Console shows: `✅ Audio effect applied successfully to 1 clip(s)!` (audio-specific)
- ✅ Reverb filter is applied

**If it fails:**
- Should show: `❌ Audio effect failed. Make sure you have audio clips selected and the requested audio filter is available.` (audio-specific error)

### Test 4: Test Audio Error Messages Are Separate

**Setup:**
1. Select a **video clip** (not audio)
2. Try an audio command

**Test:**
1. Type: `adjust volume by 3dB`
2. Press Enter

**Expected Results:**
- ✅ Should show: `❌ No audio clips selected. Please select audio clips on audio tracks.`
- ✅ Error message is audio-specific

### Test 5: Test Video Error Messages Remain Separate

**Setup:**
1. Select an **audio clip** (not video)
2. Try a video command

**Test:**
1. Type: `zoom in 120%`
2. Press Enter

**Expected Results:**
- ✅ Should show: `❌ No video clips selected. Please select clips with video content on video tracks.`
- ✅ Error message is video-specific

## How to Verify the Separate Prompts Are Working

### Check Backend Logs

When you send a request, check the **backend terminal**:

**For Audio Requests:**
- The backend should detect audio keywords and use `_get_audio_system_prompt()`
- You can add a debug print to verify (see below)

**For Video Requests:**
- The backend should use `_get_system_prompt()` (the video editing prompt)

### Add Debug Logging (Optional)

To verify which prompt is being used, you can temporarily add logging:

In `backend/services/providers/gemini_provider.py`, around line 76:

```python
# Determine if this is an audio-related request and use appropriate prompt
is_audio_request = self._is_audio_request(user_prompt)
if is_audio_request:
    print(f"🎵 Using AUDIO prompt for: {user_prompt}")
    system_prompt = self._get_audio_system_prompt()
else:
    print(f"🎬 Using VIDEO prompt for: {user_prompt}")
    system_prompt = self._get_system_prompt()
```

Then check the backend terminal when you send requests.

## Expected Console Output Examples

### Audio Request (Success):
```
Found 1 selected clip(s)
🤖 Sending to AI: "adjust volume by 3 decibels"
✨ AI extracted: "adjustVolume" with parameters: {"volumeDb": 3}
💬 AI message: Adjusting volume by 3dB
✅ Audio effect applied successfully to 1 clip(s)!
```

### Audio Request (Error):
```
Found 0 selected clip(s)
❌ No audio clips selected. Please select audio clips on audio tracks.
```

### Video Request (Success):
```
Found 1 selected clip(s)
🤖 Sending to AI: "zoom in by 120%"
✨ AI extracted: "zoomIn" with parameters: {"endScale": 120}
💬 AI message: Zooming in to 120%
✅ Action applied successfully to 1 clip(s)!
```

### Video Request (Error):
```
Found 0 selected clip(s)
❌ No video clips selected. Please select clips with video content on video tracks.
```

## Troubleshooting

### Issue: Plugin doesn't reload

**Solution:**
- Try restarting Premiere Pro completely
- Check UXP Developer Tools for errors
- Make sure you ran `npm run build` first

### Issue: Backend not responding

**Solution:**
- Check backend terminal for errors
- Verify backend is running: `curl http://localhost:3001/health`
- Check that GEMINI_API_KEY is set in backend/.env

### Issue: Audio requests still use video prompt

**Solution:**
- Check backend terminal for debug messages
- Verify `_is_audio_request()` is detecting audio keywords
- Try more explicit audio keywords: "volume", "reverb", "decibel"

### Issue: Error messages not separate

**Solution:**
- Make sure you rebuilt the frontend: `npm run build`
- Reload the plugin
- Check console output for the new audio-specific messages

## Quick Test Checklist

- [ ] Frontend rebuilt (`npm run build`)
- [ ] Backend server running (`python main.py`)
- [ ] Plugin reloaded in UXP Developer Tools
- [ ] Audio request shows "Audio effect applied successfully" (not generic message)
- [ ] Video request shows "Action applied successfully" (video message)
- [ ] Audio errors show audio-specific messages
- [ ] Video errors show video-specific messages

## Success Criteria

✅ **Separate Prompts Working:**
- Audio requests trigger audio-specific prompt
- Video requests trigger video-specific prompt
- Backend logs show which prompt is used

✅ **Separate Error Handling Working:**
- Audio success: "Audio effect applied successfully..."
- Audio errors: "Audio effect failed..." with audio-specific tips
- Video success: "Action applied successfully..."
- Video errors: Generic error messages

If all tests pass, the changes are working correctly! 🎉

