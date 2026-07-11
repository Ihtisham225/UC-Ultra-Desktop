import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { completeGoogleSignIn } from "@/lib/googleAuth";

/**
 * Listens for the Google OAuth deep-link callback delivered by the Electron
 * main process, then completes sign-in and routes into the app. Handles both
 * the warm case (live event) and a cold start (link buffered before mount).
 * No-ops outside Electron.
 */
export function OAuthBridge() {
  const navigate = useNavigate();
  const processed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const handle = async (data: { token?: string; state?: string; error?: string } | null) => {
      if (!data) return;
      const key = data.token || data.error || "";
      if (!key || processed.current.has(key)) return; // de-dupe live + buffered delivery
      processed.current.add(key);

      const r = await completeGoogleSignIn(data);
      if (r.ok) {
        toast.success("Signed in with Google");
        navigate("/");
      } else if (r.error) {
        toast.error(r.error);
      }
    };

    api.onOAuthCallback?.((data) => { void handle(data); });
    api.consumePendingOAuth?.().then((data) => { void handle(data); }).catch(() => {});
  }, [navigate]);

  return null;
}
