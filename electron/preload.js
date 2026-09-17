const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostHUD', {
  isElectron: true,
  setAlwaysOnTop: (flag) => ipcRenderer.send('hud-set-always-on-top', flag),
  setOpacity: (opacity) => ipcRenderer.send('hud-set-opacity', opacity),
  minimize: () => ipcRenderer.send('hud-minimize'),
  hide: () => ipcRenderer.send('hud-hide'),
  close: () => ipcRenderer.send('hud-close')
});
