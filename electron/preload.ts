import { contextBridge, ipcRenderer } from 'electron'

type UpdateState = {
  status: 'idle' | 'checking' | 'available' | 'downloaded' | 'none' | 'error'
  version?: string
  percent?: number
  message?: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Auto-updater
  onUpdateAvailable: (cb: (version: string) => void) =>
    ipcRenderer.on('update-available', (_e, version: string) => cb(version)),
  onUpdateDownloaded: (cb: (version: string) => void) =>
    ipcRenderer.on('update-downloaded', (_e, version: string) => cb(version)),
  onUpdateState: (cb: (state: UpdateState) => void) =>
    ipcRenderer.on('update-state', (_e, state: UpdateState) => cb(state)),
  /** Read whatever the updater already reported before the UI mounted. */
  getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke('get-update-state'),
  checkForUpdates: (): Promise<UpdateState> => ipcRenderer.invoke('check-for-updates'),
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
