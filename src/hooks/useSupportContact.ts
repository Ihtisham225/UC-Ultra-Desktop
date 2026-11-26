import { useEffect, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { SUPPORT_DEFAULTS, type SupportContact } from "@/lib/support-contact";

const CACHE_KEY = "ucu.supportContact";

function cached(): SupportContact {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { ...SUPPORT_DEFAULTS, ...(JSON.parse(raw) as Partial<SupportContact>) };
  } catch { /* storage unavailable */ }
  return SUPPORT_DEFAULTS;
}

/**
 * The support contact the super admin sets on the web (/admin → Settings).
 * Starts from the last copy this terminal saw (or the old built-in details),
 * then refreshes from the server when online.
 */
export function useSupportContact(): SupportContact {
  const [contact, setContact] = useState<SupportContact>(cached);
  useEffect(() => {
    if (!navigator.onLine) return;
    let live = true;
    rpc<SupportContact>("getSupportContactAction")
      .then((c) => {
        if (!live || !c) return;
        setContact(c);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
      })
      .catch(() => { /* an older server without the action: keep what we have */ });
    return () => { live = false; };
  }, []);
  return contact;
}
