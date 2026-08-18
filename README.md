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

## Windows code signing

Unsigned installers trigger Microsoft Defender SmartScreen — "Windows
protected your PC … Publisher: Unknown" — on download and again on first run.
Nothing is wrong with the build; Windows simply does not know the publisher.

Only a code signing certificate removes it. The build already reads the
standard electron-builder variables, so signing turns on by adding two repo
secrets and cutting a release — no code change:

| Secret | Value |
| --- | --- |
| `WIN_CSC_LINK` | the `.pfx` certificate, base64-encoded |
| `WIN_CSC_KEY_PASSWORD` | its password |

Certificate options, cheapest first:

- **Azure Trusted Signing** — ~$10/month, Microsoft's own service. Signs via
  an API rather than a USB token and carries SmartScreen reputation from the
  start. Requires an organisation that can be verified.
- **OV certificate** — ~$200–400/year. Removes "unknown publisher", but
  SmartScreen reputation still builds with download volume, so warnings can
  persist for a while.
- **EV certificate** — ~$400–800/year on a hardware token. Instant SmartScreen
  reputation.

Until then, users can continue past the warning with **More info → Run
anyway**; the download page explains this inline.
