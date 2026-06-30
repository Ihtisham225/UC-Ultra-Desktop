import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (cb: () => void) =>
    ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb: () => void) =>
    ipcRenderer.on('update-downloaded', cb),
  installUpdate: () => ipcRenderer.send('install-update'),
  platform: process.platform,
})
