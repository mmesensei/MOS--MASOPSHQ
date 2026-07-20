---
name: Lovable OAuth broker on Replit
description: The lovable.auth.signInWithOAuth broker (/~oauth/initiate) returns 404 on Replit; use supabase.auth.signInWithOAuth directly instead. App now uses MOS Supabase project (vitjdkseidpujgvxqzhm).
---

# Lovable OAuth Broker on Replit

## Rule
Do not use `lovable.auth.signInWithOAuth` on Replit. Use `supabase.auth.signInWithOAuth` directly.

**Why:** The `@lovable.dev/cloud-auth-js` library routes all OAuth through `/~oauth/initiate`, which is a path handled by Lovable's hosting infrastructure. On Replit, that path returns 404 since Lovable's proxy is not present.

**How to apply:** In `src/routes/auth.tsx`, the `handleGoogle` function uses `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/hq' } })` — keep it this way.

## Supabase Project
The app uses Supabase project **`vitjdkseidpujgvxqzhm`** (MOS) on Replit.

**Why:** The original Lovable-managed project (`bccedahkudjotobvgqhb`) is inaccessible. A task agent migrated to `vssftkkpprxxyrgmuzxt` (Mosv1), but that project also proved inaccessible via the Management API. The MOS project (`vitjdkseidpujgvxqzhm`) is the one owned and accessible by the user's Supabase access token.

## MOS Project Configuration (vitjdkseidpujgvxqzhm)
- Google OAuth enabled (client ID/secret from GOOGLE_OAUTH_CLIENT_ID/SECRET secrets)
- `site_url` = `https://mosv1.replit.app`
- `uri_allow_list` = `https://mosv1.replit.app/**,https://<replit-dev-domain>/**`
- All 33 migrations applied (53 public tables total)
- One migration (20260716233826) has a `DROP POLICY IF EXISTS ... ON public.admin_config` that fails on fresh DB — was applied with that line skipped (admin_config table never existed in any migration)

## Redirect URIs to register in Google Cloud Console
- Dev: `https://<replit-dev-domain>/api/public/google/oauth/callback`
- Prod: `https://mosv1.replit.app/api/public/google/oauth/callback`
