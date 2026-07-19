# Project Overview

A full-stack application built with **TanStack Start** (React 19, SSR), **Supabase** (auth + database), **Tailwind CSS v4**, and **Radix UI** components. Originally developed in [Lovable](https://lovable.dev) and imported to Replit.

## Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (TanStack Router + Vite + Nitro) |
| UI | React 19, Radix UI, Tailwind CSS v4, shadcn/ui |
| Auth & DB | Supabase (project: `bccedahkudjotobvgqhb`) |
| AI | Vercel AI SDK (`ai` package) |
| 3D | Three.js / React Three Fiber |
| Runtime | Node.js 22 |

## Running the App

```bash
npm run dev
```

The dev server starts on **port 5000** (`http://localhost:5000`).

The workflow **"Start application"** is configured to run this automatically.

## Replit-Specific Configuration

`vite.config.ts` overrides the `@lovable.dev/vite-tanstack-config` defaults to use:
- **host**: `0.0.0.0` (IPv4 — Replit containers do not support IPv6 `::`)
- **port**: `5000` (required for Replit's webview preview)
- **strictPort**: `true`

Without this override the Lovable package defaults to `host: "::"` (IPv6) and `port: 8080`, neither of which works in Replit's environment.

## Environment Variables

All Supabase variables are set in Replit's shared environment and in `.env`:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project REST endpoint |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `SUPABASE_PROJECT_ID` | Supabase project ID |
| `VITE_SUPABASE_*` | Client-side equivalents (injected by Vite) |

## Routes

File-based routing via TanStack Router. Key routes:

- `/` — Home (`src/routes/index.tsx`)
- `/auth` — Auth flow (`src/routes/auth.tsx`)
- `/_authenticated/*` — Protected routes (missions, office, council, vault, etc.)
- `/api/*` — Server API routes (chat, voice, public endpoints)

## Supabase Auth

Authentication is handled via `@lovable.dev/cloud-auth-js` and `@supabase/supabase-js`. Google OAuth is configured on the Supabase project side — no changes needed in this codebase for OAuth to work, provided the Supabase project has the redirect URLs configured.

## User Preferences

- Do not refactor or redesign code; fix only what is required to make the app run.
- Keep existing architecture, UI, database schema, and application logic intact.
