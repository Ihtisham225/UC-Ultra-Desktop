import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { ThemeProvider } from "./contexts/ThemeContext";

// Best-effort cleanup of any service workers and caches that may have been
// registered by previous versions of this app. We treat this site as a normal
// website (no offline / no SW caching) — only the manifest is kept so users
// can still "Install" it as a PWA shortcut.
async function cleanupLegacyServiceWorkersAndCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
  } catch { /* ignore */ }
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
    }
  } catch { /* ignore */ }
}
void cleanupLegacyServiceWorkersAndCaches();

// Purge any leftover offline / quick-login data from previous app versions.
try { localStorage.removeItem("ucu.quick-login.v1"); } catch { /* ignore */ }
try {
  if ("indexedDB" in window) {
    indexedDB.deleteDatabase("swiftpos-offline");
  }
} catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
