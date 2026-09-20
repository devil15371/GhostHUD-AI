const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow = null;
let currentMode = 'expanded'; // 'expanded' | 'mascot'

// Last expanded bounds to restore properly
let expandedBounds = { width: 380, height: 580, x: null, y: null };

// Load environment variables securely from .env (never exposed)
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let val = (match[2] || '').trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[match[1]] = val;
        }
      }
    } catch (err) {
      console.warn('Could not read .env file:', err);
    }
  }
}

loadEnv();

function getStoredApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  // Fallback to user config in userData
  const configPath = path.join(app.getPath('userData'), 'secure_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.apiKey) return data.apiKey.trim();
    } catch (e) {}
  }
  return '';
}

function saveStoredApiKey(key) {
  const cleanKey = (key || '').trim();
  process.env.GEMINI_API_KEY = cleanKey;

  // Save to .env file if writable
  const envPath = path.join(__dirname, '../.env');
  try {
    fs.writeFileSync(envPath, `GEMINI_API_KEY=${cleanKey}\n`, 'utf8');
  } catch (e) {}

  // Also save to userData secure storage
  const configPath = path.join(app.getPath('userData'), 'secure_config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify({ apiKey: cleanKey }, null, 2), 'utf8');
  } catch (e) {}
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const winWidth = 380;
  const winHeight = 580;
  const posX = screenWidth - winWidth - 20;
  const posY = 40;

  expandedBounds = { width: winWidth, height: winHeight, x: posX, y: posY };

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 120,
    minHeight: 120,
    x: posX,
    y: posY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    vibrancy: 'under-window', // macOS frosted glass
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Ensure it floats on top of full-screen lectures (YouTube, VLC, Adobe, Zoom)
  if (process.platform === 'darwin') {
    mainWindow.setAlwaysOnTop(true, 'floating', 1);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerGlobalShortcuts() {
  const shortcutKey = 'Alt+Space';
  const fallbackShortcut = 'CommandOrControl+Shift+Space';

  const toggleOrWake = () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (currentMode === 'mascot') {
      // Expand from mascot mode
      setMascotMode(false);
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('hud-woken-up');
    } else {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        // Switch to mascot mode rather than disappearing completely
        setMascotMode(true);
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  };

  try {
    globalShortcut.register(shortcutKey, toggleOrWake);
    globalShortcut.register(fallbackShortcut, toggleOrWake);
  } catch (err) {
    console.warn('Could not register global hotkey:', err);
  }
}

function setMascotMode(isMascot) {
  if (!mainWindow) return;

  const currentBounds = mainWindow.getBounds();

  if (isMascot) {
    if (currentMode !== 'mascot') {
      expandedBounds = currentBounds;
    }
    currentMode = 'mascot';

    // Shrink window into 3D mascot footprint
    const mascotWidth = 160;
    const mascotHeight = 220;
    // Keep aligned to the right edge of previous window
    const newX = currentBounds.x + (currentBounds.width - mascotWidth);
    const newY = currentBounds.y;

    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setBounds({
      x: Math.max(10, newX),
      y: Math.max(10, newY),
      width: mascotWidth,
      height: mascotHeight
    }, true);

    mainWindow.webContents.send('hud-mode-changed', 'mascot');
  } else {
    currentMode = 'expanded';
    const targetW = expandedBounds.width || 380;
    const targetH = expandedBounds.height || 580;
    const targetX = Math.max(10, (currentBounds.x + currentBounds.width) - targetW);
    const targetY = currentBounds.y;

    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setBounds({
      x: targetX,
      y: targetY,
      width: targetW,
      height: targetH
    }, true);

    mainWindow.webContents.send('hud-mode-changed', 'expanded');
  }
}

// --------------------------------------------------------------------------
// Secure Gemini API Proxy in Node Backend (Key Never Exposed to Frontend)
// --------------------------------------------------------------------------

ipcMain.handle('gemini-generate', async (event, { promptText, attachedImage, model = 'gemini-2.5-flash' }) => {
  const apiKey = getStoredApiKey();

  if (!apiKey) {
    return {
      success: false,
      isDemo: true,
      error: 'NO_API_KEY',
      message: 'No API key configured. You can use Demo Mode or enter your free Gemini key in Settings.'
    };
  }

  // Human, friendly, peer-tutor system instruction
  const systemInstruction = 
    "You are Koko, a friendly, brilliantly smart anime study companion sitting on the user's screen while they watch a lecture or study. " +
    "Personality: Warm, witty, concise, human, and encouraging. Never sound like a robotic AI manual or say 'Certainly!' or 'As an AI model'. " +
    "Rules: " +
    "1. Explain lecture concepts simply and intuitively using relatable metaphors. " +
    "2. If an equation or math is shown, break down every variable with LaTeX math notation ($...$ and $$...$$). " +
    "3. Be punchy and keep answers quick to read so the user doesn't miss lecture progress. " +
    "4. Use clear bullet points and bold keywords.";

  const parts = [];
  if (attachedImage && attachedImage.base64) {
    parts.push({
      inlineData: {
        mimeType: attachedImage.mimeType || 'image/png',
        data: attachedImage.base64
      }
    });
  }

  parts.push({
    text: promptText || "Hey Koko, look at this slide/screenshot! What's the main idea here?"
  });

  const bodyData = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: parts }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1000
    }
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData)
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const reply = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "Couldn't formulate a reply!";
            resolve({ success: true, reply });
          } else {
            const errMsg = parsed?.error?.message || `API error ${res.statusCode}`;
            resolve({ success: false, error: errMsg });
          }
        } catch (parseErr) {
          resolve({ success: false, error: 'Failed to parse Gemini response' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Gemini request timed out. Check your connection.' });
    });

    req.write(bodyData);
    req.end();
  });
});

ipcMain.handle('get-has-api-key', () => {
  return !!getStoredApiKey();
});

ipcMain.handle('save-api-key', (event, key) => {
  saveStoredApiKey(key);
  return true;
});

// Window controls IPC
ipcMain.on('hud-set-mascot-mode', (event, isMascot) => {
  setMascotMode(isMascot);
});

ipcMain.on('hud-set-always-on-top', (event, flag) => {
  if (!mainWindow) return;
  if (process.platform === 'darwin') {
    mainWindow.setAlwaysOnTop(flag, 'floating', 1);
  } else {
    mainWindow.setAlwaysOnTop(flag, 'screen-saver');
  }
});

ipcMain.on('hud-set-opacity', (event, opacity) => {
  if (!mainWindow) return;
  const safeOpacity = Math.max(0.15, Math.min(1.0, opacity));
  mainWindow.setOpacity(safeOpacity);
});

ipcMain.on('hud-minimize', () => {
  setMascotMode(true);
});

ipcMain.on('hud-hide', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('hud-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
