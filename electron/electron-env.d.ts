/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    onUpdateAvailable: (cb: () => void) => void
    onUpdateDownloaded: (cb: () => void) => void
    installUpdate: () => void
    platform: NodeJS.Platform
    onPowerState?: (cb: (state: 'lock' | 'unlock' | 'suspend' | 'resume') => void) => () => void
    getPrinters: () => Promise<Electron.PrinterInfo[]>
    printReceipt: (html: string, printerName?: string) => Promise<{ success: boolean }>
    printLabel?: (html: string, widthMm: number, heightMm: number) => Promise<{ success: boolean; reason?: string }>
    printCurrentPageA4?: (name?: string) => Promise<{ success: boolean; path?: string; reason?: string }>
    printDocumentA4?: (html: string, name?: string) => Promise<{ success: boolean; path?: string; reason?: string }>
  }
}
