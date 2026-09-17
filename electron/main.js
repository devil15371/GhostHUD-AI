const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const winWidth = 390;
  const winHeight = 580;
  // Position in the top right corner by default
  const posX = screenWidth - winWidth - 24;
  const posY = 40;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 280,
    minHeight: 180,
    x: posX,
    y: posY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    vibrancy: 'under-window', // macOS native frosted glass
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Ensure it floats on top of full-screen lectures (YouTube, VLC, Adobe, etc.)
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
  // Option+Space on Mac, Alt+Space on Windows
  const shortcutKey = process.platform === 'darwin' ? 'Alt+Space' : 'Alt+Space';
  const fallbackShortcut = 'CommandOrControl+Shift+Space';

  const toggleVisibility = () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.focus();
      }
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  try {
    globalShortcut.register(shortcutKey, toggleVisibility);
    globalShortcut.register(fallbackShortcut, toggleVisibility);
  } catch (err) {
    console.warn('Could not register global hotkey:', err);
  }
}

// IPC Handlers from Renderer
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
  // Renderer handles CSS opacity smoothly; we can also update window opacity
  const safeOpacity = Math.max(0.1, Math.min(1.0, opacity));
  mainWindow.setOpacity(safeOpacity);
});

ipcMain.on('hud-minimize', () => {
  if (mainWindow) mainWindow.minimize();
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
