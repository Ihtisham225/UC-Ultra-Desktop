/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    onUpdateAvailable: (cb: () => void) => void
    onUpdateDownloaded: (cb: () => void) => void
    installUpdate: () => void
    platform: NodeJS.Platform
  }
}
