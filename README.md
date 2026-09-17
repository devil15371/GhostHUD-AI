# 👻 GhostHUD AI — Always-on-Top Floating Lecture Companion

> **Never lose your lecture timestamp again.** A translucent floating AI assistant designed specifically for watching video lectures, reading PDFs, and studying without switching tabs or getting distracted.

---

## 🌟 Highlights & Capabilities

- 📌 **Always-On-Top Floating HUD**: Sits neatly over YouTube, Coursera, Udemy, VLC, Zoom, or Adobe Reader.
- 🌫️ **Auto-Ghost Mode (Translucency Engine)**: Automatically fades down to **20% opacity** when you're watching the lecture so it doesn't block video content or equations. Hovering your mouse or pressing a hotkey instantly wakes it up to 100% crisp visibility!
- 📸 **Direct Screenshot & Image Doubts (<kbd>Cmd+V</kbd> / <kbd>Ctrl+V</kbd>)**: Take a screenshot of a teacher's slide or whiteboard, paste it straight into the window, and Gemini Vision explains it step-by-step.
- ⚡ **Lecture Quick-Action Chips**:
  - `⚡ Explain Simply`: 1-sentence ELI12 definition with an intuitive analogy.
  - `📐 Math / Formula`: LaTeX breakdown ($...$ and $$...$$) with step-by-step symbol explanation.
  - `📝 3 Bullets`: Ultra-concise high-yield revision summary.
  - `🎯 Quiz Me`: 2 rapid test questions to check your lecture retention.
- 🎙️ **Voice Ask (Whisper Doubt)**: Tap the microphone to whisper your question hands-free.
- 🤖 **Free Gemini AI**: Uses Google Gemini 1.5 Flash / 2.5 Flash via Google AI Studio's free tier. Includes a smart demo mode if no key is entered yet!

---

## 🚀 How to Run (Choose Your Platform)

### Option 1: Desktop App (macOS & Windows) ⭐ Recommended
Run GhostHUD as a native desktop app with true OS-level Always-On-Top and global shortcuts:

```bash
cd "/Users/aman/ai tab"
npm start
```

- **Global Shortcut**: Press <kbd>Option + Space</kbd> (Mac) or <kbd>Alt + Space</kbd> (Windows) anywhere on your computer to summon or hide GhostHUD.
- **Always-on-Top**: Floats over full-screen video players, VLC, PDFs, and browser windows.

---

### Option 2: Chrome & Brave Web App (Document Picture-in-Picture)
Run GhostHUD directly in Chrome or Brave with zero installation:

1. Start the local server:
   ```bash
   cd "/Users/aman/ai tab"
   npm run web
   ```
2. Open **Chrome** or **Brave** and navigate to:
   ```
   http://localhost:5173
   ```
3. In the top-right header, click the **Pop Out (PiP)** button:
   - A genuine OS-level floating Picture-in-Picture window will pop out on your screen!
   - It will stay floating on top while you browse any other tabs or apps.

---

### Option 3: Chrome & Brave Browser Extension
Inject GhostHUD directly into YouTube, Coursera, and any lecture site:

1. Open your browser:
   - **Chrome**: Navigate to `chrome://extensions`
   - **Brave**: Navigate to `brave://extensions`
2. Enable the **"Developer mode"** toggle in the top-right corner.
3. Click **"Load unpacked"**.
4. Select the `extension/` folder located inside `/Users/aman/ai tab`.
5. Now, whenever you open YouTube or any lecture website:
   - A sleek floating `GhostHUD` pill appears in the top-right corner.
   - Click it or press <kbd>Alt + Space</kbd> to open your study HUD directly over the video!

---

## 🔑 Getting Your Free Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API Key"** (100% free forever, no credit card required).
4. Click the **⚙️ Settings** icon in the GhostHUD header, paste your key, and click **Save & Apply**.

---

## 🗂️ Project Structure

```
ai tab/
├── electron/
│   ├── main.js             # Frameless transparent always-on-top window & hotkeys
│   └── preload.js          # Secure IPC bridge
├── src/
│   ├── index.html          # Cyber-glass HUD interface
│   ├── style.css           # Glassmorphism, ghost translucency transitions
│   ├── app.js              # Gemini Vision client, screenshot paste, KaTeX math rendering
│   ├── pip.js              # Chrome/Brave Document Picture-in-Picture controller
│   └── vendor/             # Bundled KaTeX & Marked libraries (offline-ready)
├── extension/
│   ├── manifest.json       # Manifest V3 for Chrome & Brave
│   ├── background.js       # Extension service worker
│   ├── content.js          # Floating HUD injector
│   └── content.css         # Extension styling
├── server.js               # Zero-dependency local web server
└── package.json            # Scripts: start (Electron), web (Chrome/Brave)
```
