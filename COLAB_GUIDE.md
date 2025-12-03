# ChatCut Colab Server Guide

Run ChatCut's AI video effects on Google Colab's free GPU.

---

## Prerequisites

- Google account (for Colab)
- Premiere Pro with ChatCut plugin installed
- 5 minutes to set up

---

## Step 1: Get Your API Keys

### Gemini API Key (Required)
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API Key**
3. Copy the key (starts with `AIza...`)

### ngrok Token (Required)
1. Sign up at [ngrok.com](https://ngrok.com) (free)
2. Go to **Your Authtoken** in the dashboard
3. Copy the token

---

## Step 2: Open the Notebook

### Option A: Upload to Colab
1. Go to [Google Colab](https://colab.research.google.com)
2. Click **File > Upload notebook**
3. Upload `chatcut_colab_server.ipynb`

### Option B: VS Code + Colab Extension
1. Install the **Colab** extension in VS Code
2. Open `chatcut_colab_server.ipynb` in VS Code
3. Click **Connect** in the notebook toolbar
4. Select a Colab runtime

---

## Step 3: Enable GPU

1. Go to **Runtime > Change runtime type**
2. Select **T4 GPU** (free) or **A100** (Pro)
3. Click **Save**

---

## Step 4: Enter Your Keys

### In Cell 2 (Imports & Config)
Find and update:
```python
GEMINI_API_KEY = "paste_your_gemini_key_here"
```

### In Cell 7 (Start Server)
Find and update:
```python
NGROK_TOKEN = "paste_your_ngrok_token_here"
```

---

## Step 5: Run All Cells

1. Click **Runtime > Run all** (or `Ctrl+F9`)
2. Wait 2-3 minutes for setup
3. Look for the server URL at the bottom:

```
============================================================
CHATCUT SERVER READY
============================================================

Copy this URL into Premiere Pro:

   https://abc123.ngrok-free.app

============================================================
```

---

## Step 6: Connect Premiere Pro

1. Copy the ngrok URL from Colab output
2. In Premiere Pro: **Window > second toggle
4. Paste the Colab URL
5. Click **Connect**

---

## Step 7: Process Videos

1. Select clip(s) on your timeline
2. Type a command:
   - `"zoom in on the person in the gray shirt"`
   - `"blur the background"`
   - `"spotlight the speaker"`
3. Click **Send** or press Enter
4. Wait for processing (30-120 seconds)
5. Download and import the result

---

## Available Effects

| Say this... | Effect |
|-------------|--------|
| `zoom in on [person/object]` | Auto-follow zoom |
| `spotlight [person]` | Highlight subject |
| `blur background` | Background blur |
| `pixelate [person]` | Censor/blur face |
| `callout on [object]` | Add label |
| `show path` | Motion trail |

---

## Configuration

### Quality Mode (Cell 2)
```python
TEST_MODE = False  # Full quality (slower)
TEST_MODE = True   # 480p preview (faster)
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Gemini API key not set" | Check key in Cell 2, should start with `AIza...` |
| "ngrok token invalid" | Get fresh token from ngrok dashboard |
| Connection failed | Copy new ngrok URL (changes each session) |
| Session stopped | Click **Runtime > Run all** to restart |
| Slow processing | Enable GPU in Runtime settings |

---

## Session Limits (Free Tier)

- **Runtime**: ~4 hours continuous
- **GPU**: T4 (free) or upgrade to A100
- **Inactivity**: Disconnects after ~90 min idle
- **Tip**: Keep browser tab open and active

---

## VS Code Colab Extension

For local editing with Colab execution:

1. Install **Colab** extension in VS Code
2. Open the `.ipynb` file
3. Click **Connect** in notebook toolbar
4. Choose **Connect to Google Colab**
5. Edit locally, run on Colab GPU

Benefits:
- Better code editing
- Local file access
- Syntax highlighting
- Git integration

---

*The ngrok URL changes every session. Always copy the new URL after restarting.*
