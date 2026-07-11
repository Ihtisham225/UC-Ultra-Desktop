import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Auto-updater
  onUpdateAvailable: (cb: (version: string) => void) =>
    ipcRenderer.on('update-available', (_e, version: string) => cb(version)),
  onUpdateDownloaded: (cb: (version: string) => void) =>
    ipcRenderer.on('update-downloaded', (_e, version: string) => cb(version)),
  installUpdate: () => ipcRenderer.send('install-update'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  // Platform
  platform: process.platform,

  // Thermal printing
  getPrinters: (): Promise<Electron.PrinterInfo[]> =>
    ipcRenderer.invoke('get-printers'),

  printReceipt: (html: string, printerName?: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('print-receipt', html, printerName),

  // Google OAuth bridge
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  onOAuthCallback: (cb: (data: { token?: string; state?: string; error?: string }) => void) =>
    ipcRenderer.on('oauth-callback', (_e, data) => cb(data)),
  consumePendingOAuth: (): Promise<{ token?: string; state?: string; error?: string } | null> =>
    ipcRenderer.invoke('consume-pending-oauth'),
})
