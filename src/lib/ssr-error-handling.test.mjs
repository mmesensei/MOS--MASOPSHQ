/**
 * Tests for SSR error handling — verifying that SSR failures degrade
 * gracefully rather than returning blank screens or raw JSON 500s.
 *
 * Run with:  node --test src/lib/ssr-error-handling.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ── Inline the pure helpers so the test has no build/transpile dependency ───

function isH3SwallowedErrorBody(body) {
  try {
    const payload = JSON.parse(body);
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function renderErrorPage(opts = {}) {
  const { clientEntryUrl } = opts;

  if (clientEntryUrl) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module" src="${clientEntryUrl}"></script>
  </head>
  <body></body>
</html>`;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
    </div>
  </body>
</html>`;
}

// ── isH3SwallowedErrorBody ───────────────────────────────────────────────────

test("isH3SwallowedErrorBody detects h3 swallowed error body", () => {
  const body = JSON.stringify({ unhandled: true, message: "HTTPError" });
  assert.equal(isH3SwallowedErrorBody(body), true);
});

test("isH3SwallowedErrorBody rejects non-matching JSON", () => {
  assert.equal(isH3SwallowedErrorBody(JSON.stringify({ error: "nope" })), false);
  assert.equal(isH3SwallowedErrorBody(JSON.stringify({ unhandled: false, message: "HTTPError" })), false);
  assert.equal(isH3SwallowedErrorBody(JSON.stringify({ unhandled: true, message: "Other" })), false);
});

test("isH3SwallowedErrorBody returns false for non-JSON input", () => {
  assert.equal(isH3SwallowedErrorBody("not json"), false);
  assert.equal(isH3SwallowedErrorBody(""), false);
});

// ── renderErrorPage — static fallback ────────────────────────────────────────

test("renderErrorPage static fallback contains no stack trace or error details", () => {
  const html = renderErrorPage();
  assert.ok(html.includes("<!doctype html>"), "should return a valid HTML document");
  assert.ok(!html.includes("Error:"), "must not expose error details to browser");
  assert.ok(!html.includes("stack"), "must not expose stack trace to browser");
  assert.ok(!html.includes("at "), "must not expose stack frames to browser");
});

test("renderErrorPage static fallback provides actionable UI (not blank)", () => {
  const html = renderErrorPage();
  // Should have visible user-facing content, not just a blank body
  assert.ok(html.includes("<body>"), "should have a body");
  assert.ok(html.includes("didn't load") || html.includes("Something went wrong") || html.includes("<h1>"),
    "should have user-facing content");
});

// ── renderErrorPage — CSR shell ───────────────────────────────────────────────

test("renderErrorPage CSR shell includes client entry script", () => {
  const url = "/assets/index-AbCd1234.js";
  const html = renderErrorPage({ clientEntryUrl: url });
  assert.ok(html.includes(`src="${url}"`), "CSR shell must include client entry script tag");
  assert.ok(html.includes('type="module"'), "script tag must be type=module");
});

test("renderErrorPage CSR shell does not expose error details", () => {
  const html = renderErrorPage({ clientEntryUrl: "/assets/index-AbCd1234.js" });
  assert.ok(!html.includes("Error:"), "must not expose error details");
  assert.ok(!html.includes("stack"), "must not expose stack trace");
});

test("renderErrorPage CSR shell is valid HTML with correct structure", () => {
  const html = renderErrorPage({ clientEntryUrl: "/assets/index-AbCd1234.js" });
  assert.ok(html.startsWith("<!doctype html>"), "should be a valid HTML document");
  assert.ok(html.includes("<html"), "should have html element");
  assert.ok(html.includes("<head>"), "should have head element");
  assert.ok(html.includes("<body>"), "should have body element");
});

test("renderErrorPage null clientEntryUrl falls back to static error page", () => {
  const html = renderErrorPage({ clientEntryUrl: null });
  // Should NOT be the CSR shell
  assert.ok(!html.includes('type="module"'), "should not include module script when entry is null");
  // Should be the static fallback
  assert.ok(html.includes("<!doctype html>"), "should be a valid HTML document");
});

// ── isH3SwallowedErrorBody — actual h3 body shape ────────────────────────────
// h3's HTTPError.toJSON() emits:
//   { status: <number>, statusText: <string|undefined>, unhandled: true, message: "HTTPError" }
// when an unhandled throw (e.g. a route loader crash) is swallowed internally.

test("isH3SwallowedErrorBody detects actual h3 full body shape (with status + statusText)", () => {
  // This is the exact shape h3 HTTPError.toJSON() produces for an unhandled loader throw.
  const body = JSON.stringify({ status: 500, statusText: "Internal Server Error", unhandled: true, message: "HTTPError" });
  assert.equal(isH3SwallowedErrorBody(body), true);
});

test("isH3SwallowedErrorBody detects h3 body when statusText is undefined (serialised as absent key)", () => {
  // statusText is undefined when no statusText was provided; JSON.stringify omits undefined values.
  const body = JSON.stringify({ status: 500, unhandled: true, message: "HTTPError" });
  assert.equal(isH3SwallowedErrorBody(body), true);
});

test("isH3SwallowedErrorBody detects h3 body regardless of extra fields", () => {
  // h3 may add extra fields; the check must remain robust to additional keys.
  const body = JSON.stringify({ status: 503, statusText: "Service Unavailable", unhandled: true, message: "HTTPError", data: null });
  assert.equal(isH3SwallowedErrorBody(body), true);
});

test("isH3SwallowedErrorBody does NOT detect intentional createError responses", () => {
  // createError({ status: 500, message: "Database timeout" }) produces
  // { status: 500, message: "Database timeout" } with unhandled absent/false.
  const body = JSON.stringify({ status: 500, message: "Database timeout" });
  assert.equal(isH3SwallowedErrorBody(body), false);
});

test("isH3SwallowedErrorBody does NOT detect createError with unhandled:false", () => {
  const body = JSON.stringify({ status: 500, unhandled: false, message: "HTTPError" });
  assert.equal(isH3SwallowedErrorBody(body), false);
});

test("isH3SwallowedErrorBody does NOT detect createError with unhandled:null", () => {
  const body = JSON.stringify({ status: 500, unhandled: null, message: "HTTPError" });
  assert.equal(isH3SwallowedErrorBody(body), false);
});

// ── normalizeCatastrophicSsrResponse logic (simulated) ───────────────────────
// These tests replicate the guard logic in normalizeCatastrophicSsrResponse so
// we can confirm which response shapes are converted vs. passed through.

function simulateNormalize(status, contentType, body) {
  // Mirrors: if (response.status < 500) return response;
  if (status < 500) return { converted: false, reason: "status < 500" };
  // Mirrors: if (!contentType.includes("application/json")) return response;
  if (!contentType.includes("application/json")) return { converted: false, reason: "not JSON content-type" };
  // Mirrors: if (!isH3SwallowedErrorBody(body)) return response;
  if (!isH3SwallowedErrorBody(body)) return { converted: false, reason: "body not a swallowed h3 error" };
  return { converted: true };
}

test("normalizeCatastrophicSsrResponse logic: converts h3 unhandled 500 JSON (full shape)", () => {
  const body = JSON.stringify({ status: 500, statusText: "Internal Server Error", unhandled: true, message: "HTTPError" });
  const result = simulateNormalize(500, "application/json; charset=utf-8", body);
  assert.equal(result.converted, true, "should convert h3 unhandled 500 JSON to error page");
});

test("normalizeCatastrophicSsrResponse logic: passes through 4xx responses untouched", () => {
  const body = JSON.stringify({ unhandled: true, message: "HTTPError" });
  const result = simulateNormalize(404, "application/json", body);
  assert.equal(result.converted, false, "4xx should not be converted");
  assert.equal(result.reason, "status < 500");
});

test("normalizeCatastrophicSsrResponse logic: passes through 2xx responses untouched", () => {
  const result = simulateNormalize(200, "text/html", "<html></html>");
  assert.equal(result.converted, false);
});

test("normalizeCatastrophicSsrResponse logic: passes through 500 non-JSON responses untouched", () => {
  // A plain-text or HTML 500 is not the h3 swallowed pattern and should not be replaced.
  const result = simulateNormalize(500, "text/html; charset=utf-8", "<h1>Server Error</h1>");
  assert.equal(result.converted, false, "non-JSON 500 should not be converted");
  assert.equal(result.reason, "not JSON content-type");
});

test("normalizeCatastrophicSsrResponse logic: passes through 500 JSON from intentional createError", () => {
  // An intentional createError (e.g. auth check) must not be swallowed.
  const body = JSON.stringify({ status: 500, message: "Upstream service unavailable" });
  const result = simulateNormalize(500, "application/json", body);
  assert.equal(result.converted, false, "intentional createError 500 should not be converted");
  assert.equal(result.reason, "body not a swallowed h3 error");
});

test("normalizeCatastrophicSsrResponse logic: redirect (3xx) passes through", () => {
  // Loader redirects produce 3xx responses — not 500s — so they pass through.
  const result = simulateNormalize(302, "text/html", "");
  assert.equal(result.converted, false);
  assert.equal(result.reason, "status < 500");
});
