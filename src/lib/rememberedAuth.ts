export type RememberedLoginProvider = "password" | "google";

export interface RememberedLogin {
  email: string;
  provider: RememberedLoginProvider;
  updatedAt: number;
}

const REMEMBERED_LOGIN_KEY = "ucu.remembered-login";
const PENDING_PROVIDER_KEY = "ucu.pending-auth-provider";

export function getRememberedLogin(): RememberedLogin | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(REMEMBERED_LOGIN_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RememberedLogin>;
    if (!parsed.email || (parsed.provider !== "password" && parsed.provider !== "google")) {
      return null;
    }

    return {
      email: parsed.email,
      provider: parsed.provider,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveRememberedLogin(email: string, provider: RememberedLoginProvider) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      REMEMBERED_LOGIN_KEY,
      JSON.stringify({ email, provider, updatedAt: Date.now() } satisfies RememberedLogin),
    );
  } catch {
    // Ignore storage failures.
  }
}

export function clearRememberedLogin() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(REMEMBERED_LOGIN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function setPendingAuthProvider(provider: RememberedLoginProvider) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PENDING_PROVIDER_KEY, provider);
  } catch {
    // Ignore storage failures.
  }
}

export function consumePendingAuthProvider(): RememberedLoginProvider | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(PENDING_PROVIDER_KEY);
    window.localStorage.removeItem(PENDING_PROVIDER_KEY);
    return value === "password" || value === "google" ? value : null;
  } catch {
    return null;
  }
}