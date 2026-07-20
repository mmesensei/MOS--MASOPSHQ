---
name: OAuth callback route pattern
description: Why a dedicated /auth/callback route is required for Google OAuth in TanStack Start
---

# OAuth Callback Route

## The rule
Always set `redirectTo: origin + "/auth/callback"` for Supabase OAuth. Never redirect directly to a protected route (e.g. `/hq`).

**Why:** TanStack Start's `beforeLoad` on `/_authenticated` runs before the Supabase client has had time to process the `#access_token` hash from the OAuth redirect. This causes the session check to fail and bounces the user back to `/auth` even though OAuth succeeded — producing the symptom "first login lets me in but doesn't log me in."

**How to apply:** The `/auth/callback` route (`src/routes/auth.callback.tsx`) polls `supabase.auth.getSession()` every 200ms and also listens to `onAuthStateChange` for `SIGNED_IN`, then navigates to `/hq`. This eliminates the race condition entirely. Any future OAuth provider (GitHub, etc.) should use the same callback URL.
