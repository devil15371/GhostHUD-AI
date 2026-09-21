const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostHUD', {
  isElectron: true,
  // Secure Gemini API backend caller (API key is kept hidden in Node main process)
  generateGemini: (params) => ipcRenderer.invoke('gemini-generate', params),
  hasApiKey: () => ipcRenderer.invoke('get-has-api-key'),
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),

  // Window & Mascot states
  setMascotMode: (isMascot) => ipcRenderer.send('hud-set-mascot-mode', isMascot),
  onModeChanged: (callback) => ipcRenderer.on('hud-mode-changed', (event, mode) => callback(mode)),
  onWokenUp: (callback) => ipcRenderer.on('hud-woken-up', () => callback()),

  setAlwaysOnTop: (flag) => ipcRenderer.send('hud-set-always-on-top', flag),
  setOpacity: (opacity) => ipcRenderer.send('hud-set-opacity', opacity),
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('hud-move-window', { deltaX, deltaY }),
  minimize: () => ipcRenderer.send('hud-minimize'),
  hide: () => ipcRenderer.send('hud-hide'),
  close: () => ipcRenderer.send('hud-close')
});
