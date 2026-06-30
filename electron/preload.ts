import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Auto-updater
  onUpdateAvailable: (cb: () => void) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb: () => void) => ipcRenderer.on('update-downloaded', cb),
  installUpdate: () => ipcRenderer.send('install-update'),

  // Platform
  platform: process.platform,

  // Thermal printing
  getPrinters: (): Promise<Electron.PrinterInfo[]> =>
    ipcRenderer.invoke('get-printers'),

  printReceipt: (html: string, printerName?: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('print-receipt', html, printerName),
})
