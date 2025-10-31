# Important: Reload Plugin After Rebuild

## 🔄 The Problem

After rebuilding the frontend, Premiere Pro is still running the **old cached code**. You must reload the plugin to see the new AI integration.

## ✅ Solution

### Method 1: Reload Plugin (Recommended)
```bash
cd ChatCut/frontend
npm run uxp:reload
```

### Method 2: Restart Premiere Pro
- Close Premiere Pro completely
- Reopen Premiere Pro
- Reload the plugin

### Method 3: Debug Mode
```bash
cd ChatCut/frontend
npm run uxp:debug
```

## 🔍 How to Verify It's Working

After reloading, you should see these **NEW** messages in the plugin:

### ✅ Working (New Code)
- "🤖 Sending to AI: ..."
- "✨ AI extracted: ..."
- "💬 AI message: ..."
- Console shows: `[Edit] AI Response: {action: "zoomIn", parameters: {endScale: 120}, ...}`

### ❌ Not Working (Old Code Still Running)
- "[Backend] Ping response"
- "[Edit] Starting zoom on clips"
- No AI extraction messages
- Still uses fixed 150% zoom

## 🧪 Quick Test

1. **Rebuild frontend**: `npm run build`
2. **Reload plugin**: `npm run uxp:reload`
3. **Select a clip** in Premiere Pro
4. **Type**: "zoom in by 120%"
5. **Check console** for AI response messages

## 🐛 If Still Not Working

1. **Check backend is running**: `curl http://localhost:3001/health`
2. **Check backend logs** for AI processing
3. **Clear browser cache** if using debug mode
4. **Restart Premiere Pro** completely

