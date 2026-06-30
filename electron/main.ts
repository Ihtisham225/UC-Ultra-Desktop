import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, PrinterInfo } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { autoUpdater } from 'electron-updater'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DIST_PATH = path.join(__dirname, '../dist')
const PUBLIC_PATH = app.isPackaged
  ? DIST_PATH
  : path.join(__dirname, '../public')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ─── Window ────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    icon: path.join(PUBLIC_PATH, 'favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Minimise to tray on close instead of quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(DIST_PATH, 'index.html'))
  }
}

// ─── System Tray ───────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(PUBLIC_PATH, 'favicon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('UC-Ultra POS')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open UC-Ultra POS',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(menu)

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// ─── Thermal Printing ──────────────────────────────────────────────────────

// List all printers available on the OS
ipcMain.handle('get-printers', async (): Promise<PrinterInfo[]> => {
  if (!mainWindow) return []
  return mainWindow.webContents.getPrintersAsync()
})

// Print an HTML receipt to a named printer (defaults to system default)
ipcMain.handle('print-receipt', async (_event, html: string, printerName?: string) => {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    win.webContents.once('did-finish-load', () => {
      const options: Electron.WebContentsPrintOptions = {
        silent: true,           // no print dialog
        printBackground: true,
        // Thermal printers typically use 80mm roll — no margins
        margins: { marginType: 'none' },
        ...(printerName ? { deviceName: printerName } : {}),
      }

      win.webContents.print(options, (success, reason) => {
        win.destroy()
        if (success) resolve({ success: true })
        else reject(new Error(reason))
      })
    })
  })
})

// ─── Auto-updater ──────────────────────────────────────────────────────────

autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update-available')
})

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-downloaded')
})

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall()
})

// ─── App lifecycle ─────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  // On macOS keep app running in tray even when all windows are closed
  if (process.platform !== 'darwin') {
    // Only quit if the user chose Quit from the tray menu
    if (app.isQuitting) app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.whenReady().then(() => {
  createWindow()
  createTray()

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})

// Augment app type to carry the isQuitting flag
declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}
app.isQuitting = false
