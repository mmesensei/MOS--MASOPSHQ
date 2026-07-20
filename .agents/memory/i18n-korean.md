---
name: Korean i18n system
description: How the EN/KO language toggle and translation pipeline work in MASOPS
---

# Korean Translation System

## Architecture
- **`src/lib/i18n.tsx`** — `LanguageProvider` context + `useLanguage()` + `useT()` hook. Static KO strings (~60 keys). Persists to `localStorage("mos-lang")`. Syncs `<html lang>` attribute.
- **`src/lib/translate.server.ts`** — Server function `translateToKorean({ text })`. Calls Lovable AI Gateway (Gemini) with a Korean localization expert system prompt. Requires `LOVABLE_API_KEY` env var.
- **`src/components/translate-button.tsx`** — `<TranslateButton text="..." />` wraps any content block. Lazy-fetches AI translation on first KO request, caches in component state. Global lang context triggers auto-translate when toggled.

## Global toggle location
`src/components/mos-shell.tsx` — `한국어` button in the top-right header (desktop) and at the bottom of the sidebar (mobile).

## Key decisions
- Static UI strings (nav, labels, doctrine) use the `t(key, fallback)` pattern — instant, no API call.
- Dynamic content (briefings, journal, executive output) uses `<TranslateButton>` — lazy AI translation.
- Translation is idiomatic Korean, not word-for-word. System prompt explicitly instructs the LLM to treat it as professional Korean localization.
- `LOVABLE_API_KEY` must be set for dynamic translation to work. Static UI toggle works without it.

**Why:** Korean is context-dependent; one English word maps to many Korean words. Word-for-word translation (e.g. Google Translate free tier) produces unnatural output. Running through Gemini with a localization-expert prompt produces natural 존댓말 for a professional platform.
