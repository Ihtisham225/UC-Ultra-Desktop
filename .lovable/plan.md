## Goal
Let anyone who signs into zapzetta with Google also be able to sign into ucultra with the same Google account (one click, no separate password).

## How it works
Both apps run on Lovable Cloud, so each has its own user database. They cannot share sessions, but they can share the **same Google identity**. When a user clicks "Sign in with Google" in ucultra:
- If they already used that Google account here → logged in.
- If it's their first time on ucultra (but they exist on zapzetta) → a new ucultra account is auto-created using the same Google email. No password, no extra signup step.

The end-user experience feels like SSO: one Google click works on both apps.

## Changes in this project (ucultra)
1. Google sign-in is already wired up via `lovable.auth.signInWithOAuth("google", ...)` on the `/auth` page — no code changes needed for the button itself.
2. Confirm Google is enabled as a provider in Lovable Cloud auth settings (managed Google OAuth — works out of the box, no client ID/secret required).
3. Verify the sign-up flow allows new Google users to be created automatically (default behavior, just confirm `disable_signup` is off).
4. Onboarding: a brand-new Google user landing on ucultra for the first time will hit the existing onboarding flow (create shop, etc.). Confirm that's acceptable, or we can add a note telling zapzetta users they'll set up their ucultra shop on first visit.

## Changes in zapzetta
Same one-time setup: ensure Google sign-in is enabled there too (likely already done since you mentioned it). No code coordination between the two apps is required.

## What this does NOT give you
- Shared data (customers, sales, shops) between the two apps — each project keeps its own database.
- A single shared session — users still click "Sign in with Google" once per app, but no password is ever needed.
- Auto-provisioning of a ucultra shop from zapzetta data.

If you later want true data sharing or a single session, that requires the "shared external Supabase" or "SAML SSO" routes instead.

## Technical notes
- Provider: managed Google OAuth via `@lovable.dev/cloud-auth-js` (already installed).
- No secrets to add. No edge functions to deploy.
- Custom domains (`ucultra.com`, `www.ucultra.com`) are already in the OAuth redirect allowlist via Lovable's broker.
