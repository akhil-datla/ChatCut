# Undo Feature Documentation

## Overview

The Undo feature allows you to reverse the last edit and previous edits made through ChatCut. It supports undoing:
- **Zoom In/Out** - Restores previous scale values and keyframes
- **Apply Filter** - Removes the applied filter
- **Apply Transition** - Removes the applied transition
- **Apply Blur** - Removes the blur effect

## How to Use

1. **Make an Edit**: Use ChatCut to apply any supported edit (e.g., "zoom in by 120%", "apply blur", etc.)
2. **Click Undo**: Click the "Undo" button in the header to reverse the last edit
3. **Multiple Undos**: You can undo multiple edits in sequence - each undo reverses the most recent edit

## Running the Application

### Prerequisites

1. **Backend Server**: The backend must be running
2. **Frontend Built**: The frontend must be built and the plugin reloaded

### Step 1: Start the Backend Server

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

The server should start on `http://localhost:3001`. You should see:
```
Server running on http://localhost:3001
```

### Step 2: Build the Frontend

```bash
cd frontend
npm install  # If you haven't already
npm run build
```

### Step 3: Reload the Plugin in Premiere Pro

After building, you need to reload the plugin in Premiere Pro:

**Option A: Use UXP CLI (if installed)**
```bash
cd frontend
npm run uxp:reload
```

**Option B: Use Plugin Menu**
1. Right-click on the ChatCut plugin panel in Premiere Pro
2. Select "Reload Plugin" from the menu

**Option C: Restart Premiere Pro**
1. Close Premiere Pro completely
2. Reopen Premiere Pro
3. The plugin will load with the latest build

## Testing the Undo Feature

### Test 1: Undo Zoom In

1. **Open Premiere Pro** and create/open a project with video clips
2. **Select a video clip** on the timeline
3. **Type in ChatCut**: "zoom in by 150%"
4. **Verify the zoom** - The clip should be zoomed in
5. **Click the Undo button** in the header
6. **Expected Result**: 
   - Console message: "↩️ Undoing: zoomIn..."
   - Console message: "✅ Undo successful! Reverted 1 clip(s)"
   - The clip should return to its previous zoom level

### Test 2: Undo Multiple Edits

1. **Select a video clip** on the timeline
2. **First edit**: Type "zoom in by 120%"
   - Wait for confirmation: "✅ Action applied successfully"
3. **Second edit**: Type "zoom in by 150%"
   - Wait for confirmation: "✅ Action applied successfully"
4. **First Undo**: Click Undo button
   - Should undo the 150% zoom, leaving 120% zoom
5. **Second Undo**: Click Undo button again
   - Should undo the 120% zoom, returning to original state

### Test 3: Undo Blur

1. **Select a video clip** on the timeline
2. **Type**: "apply blur"
3. **Verify**: The clip should have blur applied
4. **Click Undo**: The blur should be removed

### Test 4: Undo Filter

1. **Select a video clip** on the timeline
2. **Type**: "apply filter [filter name]"
   - Replace `[filter name]` with an actual filter name from Premiere Pro
3. **Verify**: The filter should be applied
4. **Click Undo**: The filter should be removed

### Test 5: Undo Transition

1. **Select a video clip** on the timeline
2. **Type**: "apply transition [transition name]"
   - Replace `[transition name]` with an actual transition name
3. **Verify**: The transition should be applied
4. **Click Undo**: The transition should be removed

### Test 6: Undo Button States

1. **Before any edits**: The Undo button should be disabled (grayed out)
2. **After an edit**: The Undo button should be enabled
3. **After undoing all edits**: The Undo button should be disabled again

## Troubleshooting

### Undo Button Not Appearing

- **Check**: Make sure you've rebuilt the frontend (`npm run build`)
- **Check**: Make sure you've reloaded the plugin in Premiere Pro
- **Check**: Check browser console for any JavaScript errors

### Undo Not Working

1. **Check Backend**: Make sure the backend server is running
   ```bash
   curl http://localhost:3001/health
   ```

2. **Check Console**: Open the browser console (F12) and look for error messages
   - Look for `[Undo]` prefixed messages
   - Check for any red error messages

3. **Check Edit History**: The undo feature only works for edits made through ChatCut
   - Manual edits in Premiere Pro cannot be undone with this feature
   - Only edits made after the feature was added will be tracked

### Undo Partially Works

- **For Zoom**: If undo partially works, it may be because some clips don't have the Motion effect
- **For Filters/Transitions**: If undo fails, the filter/transition may have been manually removed or the clip may have been deleted

## Technical Details

### How It Works

1. **State Capture**: Before each edit, the current state is captured (e.g., scale keyframes for zoom)
2. **History Storage**: After a successful edit, the action and previous state are stored in memory
3. **Undo Execution**: When undo is clicked, the previous state is restored or the added effect is removed

### Limitations

- **Memory Only**: Edit history is stored in memory and is lost when the plugin is reloaded
- **Single Session**: History doesn't persist across Premiere Pro sessions
- **TrackItem References**: If clips are deleted or moved, undo may fail for those clips
- **Manual Edits**: Manual edits made outside ChatCut are not tracked

### Supported Actions

- ✅ `zoomIn` - Restores previous scale keyframes
- ✅ `zoomOut` - Restores previous scale keyframes
- ✅ `applyFilter` - Removes the filter component
- ✅ `applyTransition` - Removes the transition
- ✅ `applyBlur` - Removes the Gaussian Blur component

## Development

### Files Modified

- `frontend/src/services/undoService.js` - Undo service with undo functions
- `frontend/src/components/container.jsx` - Edit history tracking and undo handler
- `frontend/src/components/header.jsx` - Undo button UI
- `frontend/src/components/header.css` - Undo button styling

### Adding Undo Support for New Actions

To add undo support for a new action:

1. **Add undo function** in `undoService.js`:
   ```javascript
   export async function undoNewAction(historyEntry) {
     // Implementation to reverse the action
   }
   ```

2. **Add case** in `executeUndo` function:
   ```javascript
   case 'newAction':
     return await undoNewAction(historyEntry);
   ```

3. **Update `capturePreviousState`** if state capture is needed:
   ```javascript
   if (actionName === 'newAction') {
     // Capture previous state
   }
   ```

## Quick Test Checklist

- [ ] Backend server is running
- [ ] Frontend is built (`npm run build`)
- [ ] Plugin is reloaded in Premiere Pro
- [ ] Undo button appears in header
- [ ] Undo button is disabled when no edits exist
- [ ] Undo button is enabled after making an edit
- [ ] Undo successfully reverses zoom edits
- [ ] Undo successfully reverses blur edits
- [ ] Multiple undos work correctly
- [ ] Console shows appropriate messages

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify the backend server is running
3. Ensure the plugin has been reloaded after building
4. Check that you're testing with supported actions (zoom, blur, filter, transition)

