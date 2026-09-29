/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    onUpdateAvailable: (cb: () => void) => void
    onUpdateDownloaded: (cb: () => void) => void
    installUpdate: () => void
    platform: NodeJS.Platform
    getPrinters: () => Promise<Electron.PrinterInfo[]>
    printReceipt: (html: string, printerName?: string) => Promise<{ success: boolean }>
    printCurrentPageA4?: (name?: string) => Promise<{ success: boolean; path?: string; reason?: string }>
    printDocumentA4?: (html: string, name?: string) => Promise<{ success: boolean; path?: string; reason?: string }>
  }
}
