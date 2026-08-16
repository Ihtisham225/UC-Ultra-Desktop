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
    trafficLightPosition: { x: 16, y: 16 },
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
/**
 * Print a slip through the main process.
 *
 * This exists because the renderer's own `window.print()` is not equivalent:
 * Chromium in a normal browser honours `@page { margin: 0 }`, but Electron's
 * print path applies its default page margins regardless, which inset the slip
 * and push its right edge outside an 80mm head's 72mm print window — the last
 * character of every line is then physically cut off. Forcing
 * `marginType: 'none'` here is the only place that can be set.
 *
 * `silent` defaults to false so the cashier still chooses the printer.
 */
ipcMain.handle('print-receipt', async (_event, html: string, printerName?: string, silent = false) => {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    win.webContents.once('did-finish-load', () => {
      const options: Electron.WebContentsPrintOptions = {
        silent,
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

type UpdateState = {
  status: 'idle' | 'checking' | 'available' | 'downloaded' | 'none' | 'error'
  version?: string
  percent?: number
  message?: string
}

/**
 * The renderer mounts a second or two after the main process starts checking,
 * and a cached update finishes downloading almost instantly — so the events
 * routinely fired before anyone was listening and the pill never appeared.
 * Keep the last state here and let the renderer read it on mount.
 */
let updateState: UpdateState = { status: 'idle' }

const setUpdateState = (next: UpdateState) => {
  updateState = next
  mainWindow?.webContents.send('update-state', next)
}

autoUpdater.on('checking-for-update', () => setUpdateState({ status: 'checking' }))

autoUpdater.on('update-available', (info) => {
  setUpdateState({ status: 'available', version: info.version, percent: 0 })
  mainWindow?.webContents.send('update-available', info.version)
})

autoUpdater.on('download-progress', (p) => {
  setUpdateState({ status: 'available', version: updateState.version, percent: Math.round(p.percent) })
})

autoUpdater.on('update-not-available', () => setUpdateState({ status: 'none' }))

autoUpdater.on('update-downloaded', (info) => {
  setUpdateState({ status: 'downloaded', version: info.version })
  mainWindow?.webContents.send('update-downloaded', info.version)
})

// Without this the updater fails silently — a bad manifest, a network block or
// a signature mismatch looked exactly like "no update available".
autoUpdater.on('error', (err) => {
  console.error('[updater]', err)
  setUpdateState({ status: 'error', message: err?.message ?? String(err) })
})

ipcMain.handle('get-update-state', () => updateState)

ipcMain.handle('check-for-updates', async (): Promise<UpdateState> => {
  if (!app.isPackaged) return { status: 'error', message: 'Updates only run in the installed app, not in dev.' }
  try {
    const result = await autoUpdater.checkForUpdates()
    // checkForUpdates resolves before the download finishes; the events above
    // carry it the rest of the way.
    if (!result) return updateState
    return updateState.status === 'idle' ? { status: 'checking' } : updateState
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setUpdateState({ status: 'error', message })
    return updateState
  }
})

ipcMain.on('install-update', () => {
  // Bypass the minimise-to-tray close handler so the updater can quit
  app.isQuitting = true
  autoUpdater.quitAndInstall()
})

ipcMain.handle('get-app-version', () => app.getVersion())

// ─── Google OAuth deep link (ucultra://auth?token=…&state=…) ────────────────

const PROTOCOL = 'ucultra'
let pendingOAuth: { token?: string; state?: string; error?: string } | null = null

function registerProtocol() {
  // In dev the runner is the electron binary, so the launch args must be passed
  // explicitly for the OS to route the protocol back to this instance.
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

function handleDeepLink(url?: string) {
  if (!url || !url.startsWith(`${PROTOCOL}://`)) return
  try {
    const u = new URL(url)
    if (u.host !== 'auth') return
    pendingOAuth = {
      token: u.searchParams.get('token') ?? undefined,
      state: u.searchParams.get('state') ?? undefined,
      error: u.searchParams.get('error') ?? undefined,
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('oauth-callback', pendingOAuth)
    }
  } catch {
    /* ignore malformed links */
  }
}

// Open a URL in the user's default browser (used to start Google sign-in).
ipcMain.handle('open-external', (_e, url: string) => shell.openExternal(url))

// The renderer pulls any deep link that arrived before it was listening
// (e.g. a cold start launched by the protocol).
ipcMain.handle('consume-pending-oauth', () => {
  const p = pendingOAuth
  pendingOAuth = null
  return p
})

// macOS delivers the deep link through open-url.
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

// Only one instance may own the protocol; the OS hands the link to it.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Windows/Linux deliver the deep link as a CLI arg to the second instance.
    handleDeepLink(argv.find((a) => a.startsWith(`${PROTOCOL}://`)))
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

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
  registerProtocol()
  createWindow()
  createTray()

  // Cold start via the protocol (Windows/Linux pass the URL in argv).
  handleDeepLink(process.argv.find((a) => a.startsWith(`${PROTOCOL}://`)))

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
    // Long-running POS sessions: re-check every hour so the update
    // banner appears without needing an app restart
    setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 60 * 60 * 1000)
  }
})

// Augment app type to carry the isQuitting flag
declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}
app.isQuitting = false
