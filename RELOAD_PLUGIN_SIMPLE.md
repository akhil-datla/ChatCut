# How to Reload Plugin (No UXP CLI Needed)

## ✅ Simple Method: Use Plugin Menu

The plugin has a built-in reload option:

1. **Right-click on the plugin panel** in Premiere Pro
2. **Select "Reload Plugin"** from the menu
3. Plugin reloads with new code

That's it! No CLI needed.

## Alternative Method: Restart Premiere Pro

1. **Close Premiere Pro completely**
2. **Reopen Premiere Pro**
3. Plugin automatically loads with latest build

## Method 3: Use UXP Developer Tools (If Installed)

If you have UXP Developer Tools installed:
1. Open UXP Developer Tools
2. Find your plugin
3. Click the "•••" button
4. Click "Reload"

## After Reloading

Once reloaded, you should see **NEW** messages:
- ✅ "🤖 Sending to AI: ..."
- ✅ "✨ AI extracted: ..."
- ✅ Console shows AI response

If you still see:
- ❌ "[Backend] Ping response"
- ❌ "[Edit] Starting zoom on clips"

Then the old code is still cached - try restarting Premiere Pro completely.

## Current Status

- ✅ Frontend rebuilt with new code
- ✅ Backend configuration correct
- ⚠️ **Backend server needs to be running** (start with `python main.py` in backend directory)
- ⚠️ **Plugin needs to be reloaded** (use menu or restart Premiere Pro)

