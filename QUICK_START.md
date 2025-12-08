# ChatCut - Quick Start (2 Minutes)

## Prerequisites Checklist

- [ ] Premiere Pro 23.0+ installed
- [ ] Node.js installed
- [ ] Python 3.8+ installed
- [ ] UXP Developer Tools installed

---

## 🚀 Setup (Copy-Paste These Commands)

### 1. Get Gemini API Key (30 seconds)
1. Go to: https://ai.google.dev/
2. Click "Get API Key"
3. Copy the key (starts with `AIza...`)

### 2. Backend Setup (1 minute)

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` file:
```bash
# Windows Command Prompt:
echo GEMINI_API_KEY=your_key_here > .env

# Windows PowerShell:
Set-Content -Path .env -Value "GEMINI_API_KEY=your_key_here"

# Mac/Linux:
echo "GEMINI_API_KEY=your_key_here" > .env
```

Start server:
```bash
python main.py
```

✅ You should see: "✓ Gemini service initialized successfully"

**Leave this running!**

### 3. Frontend Setup (30 seconds)

Open **NEW terminal**:
```bash
cd frontend
npm run watch
```

✅ You should see webpack building...

**Leave this running!**

### 4. Load in Premiere Pro (30 seconds)

1. Open Premiere Pro
2. Open UXP Developer Tools
3. Click "Add Plugin..."
4. Select: `D:\ChatCut\frontend\dist\manifest.json`
5. Click ••• → "Load"
6. In Premiere Pro: Window → Extensions → ChatCut

---

## ✅ Test It!

1. Open a sequence in Premiere Pro
2. Press `I` and `O` to set in/out points
3. In ChatCut panel:
   - Click "Get Current Selection"
   - Type: "make this black and white"
   - Click "Process Prompt"

You should see the AI interpretation!

---

## 🆘 Quick Fixes

**"Backend not connected"**
→ Make sure `python main.py` is running

**"GEMINI_API_KEY not found"**
→ Check your `.env` file exists in `backend/` folder

**Plugin won't load**
→ Make sure Premiere Pro is running first

**npm install errors**
→ Delete `node_modules` and `package-lock.json`, try again

---

## 📖 Full Docs

- [SETUP.md](SETUP.md) - Detailed setup guide
- [MVP_STATUS.md](MVP_STATUS.md) - What's working
- [plan.md](plan.md) - Full technical plan

---

**You're ready to go!** 🎉
