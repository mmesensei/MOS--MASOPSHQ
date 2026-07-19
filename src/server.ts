import "./lib/error-capture";

import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// ── Client-entry detection ────────────────────────────────────────────────────
// Locate the client JS bundle once at startup so SSR-error responses can
// include it and let the browser fall back to client-side rendering.
//
// In production the built output is laid out as:
//   .output/
//     server/index.mjs   ← we are here (import.meta.url)
//     public/assets/index-<hash>.js  ← what we want
//
// We scan the directory instead of hard-coding the hash so the path stays
// correct across builds.
let _clientEntryUrl: string | null | undefined; // undefined = not yet resolved

function getClientEntryUrl(): string | null {
  if (_clientEntryUrl !== undefined) return _clientEntryUrl;
  try {
    // fileURLToPath + dirname is the ESM-safe equivalent of __dirname
    const serverDir = dirname(fileURLToPath(import.meta.url));
    const assetsDir = resolve(serverDir, "../public/assets");
    const files = readdirSync(assetsDir);
    const entry = files.find((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
    _clientEntryUrl = entry ? `/assets/${entry}` : null;
    if (_clientEntryUrl === null) {
      console.warn(
        "[server] WARNING: No client entry file (index-<hash>.js) found in .output/public/assets/. " +
        "SSR error responses will fall back to the static error page instead of the CSR shell. " +
        "Run `npm run build` to regenerate the client bundle.",
      );
    }
  } catch {
    // Running in dev (no .output directory) or the build is non-standard;
    // fall back to the static error page.
    _clientEntryUrl = null;
  }
  return _clientEntryUrl;
}

// h3 swallows in-handler throws (including route loader throws) into a normal
// 500 Response with a JSON body.  The full shape emitted by h3's HTTPError.toJSON()
// is {"status":500,"statusText":"...","unhandled":true,"message":"HTTPError"} —
// try/catch on the outer fetch() alone never fires for those because h3 catches
// the throw internally and converts it to a Response.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return buildErrorResponse();
}

/**
 * Detect the JSON body shape that h3 produces when an unhandled error is
 * swallowed inside a route handler or loader.
 *
 * h3's `HTTPError.toJSON()` always serialises to:
 *   { status: <number>, statusText: <string|undefined>, unhandled: true, message: "HTTPError" }
 * when the error was not explicitly created via `createError`.
 *
 * Intentional `createError` responses have `unhandled` as `undefined`/`false` and
 * carry the real message — those are NOT swallowed errors and should pass through.
 */
function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Build the SSR-failure response.
 *
 * When the client bundle is detectable the response is a 200 CSR shell — the
 * browser loads the React app and renders normally, so the user never sees
 * the error.  When the bundle cannot be found we return a 500 with a friendly
 * static error page so the user still gets actionable UI.
 *
 * Error *details* are only logged server-side; nothing identifying is sent to
 * the browser.
 */
function buildErrorResponse(): Response {
  const clientEntryUrl = getClientEntryUrl();
  const html = renderErrorPage({ clientEntryUrl });

  // Return 200 when we can hand off to CSR — the page will work correctly.
  // Return 500 for the static fallback so monitoring/proxies flag the failure.
  const status = clientEntryUrl ? 200 : 500;

  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return buildErrorResponse();
    }
  },
};
