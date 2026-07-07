# UC-Ultra Desktop

Desktop app for [UC-Ultra](https://ucultra.com) — a multi-vendor point of sale.
Built with Electron + React + Vite, offline-first with background sync to the cloud.

## Download

Grab the latest installer from the [Releases page](https://github.com/Ihtisham225/UC-Ultra-Desktop/releases/latest):

| Platform | File |
|---|---|
| macOS — Apple Silicon (M1/M2/M3/M4) | `UC-Ultra-x.x.x-arm64.dmg` |
| macOS — Intel | `UC-Ultra-x.x.x.dmg` |
| Windows — installer | `UC-Ultra.Setup.x.x.x.exe` |
| Windows — portable (no install) | `UC-Ultra.x.x.x.exe` |

macOS builds are code-signed and notarized by Apple. The app updates itself
automatically — when a new version is ready you'll see a "Relaunch to update"
prompt in the corner.

## Features

- Offline-first: all reads/writes hit a local IndexedDB store; a background
  engine syncs two-way with the cloud whenever you're online
- OS-level thermal receipt printing (Epson, Star, XPrinter, and other
  ESC/POS-style printers)
- System tray with minimise-to-tray
- Barcode scanning, product variants, credit sales / debt tracking,
  purchases, expenses, analytics

## Development

```sh
npm install --legacy-peer-deps
cp .env.example .env   # fill in your Supabase project values
npm run dev            # Vite + Electron with hot reload
```

### Building installers locally

```sh
npm run dist:mac   # signed .dmg/.zip for the current Mac's architecture
npm run dist:win   # Windows installer (requires Windows or Wine)
```

### Releasing

Releases are built and published by GitHub Actions:

```sh
# bump "version" in package.json first, then:
git tag v1.x.x && git push origin v1.x.x
```

The workflow builds macOS (arm64 + x64, signed + notarized) and Windows
installers and attaches them to a GitHub Release. Running apps pick the
update up automatically.

## License

Source-available, all rights reserved — see [LICENSE](LICENSE).
