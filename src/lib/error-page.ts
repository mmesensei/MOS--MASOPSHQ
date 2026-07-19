export interface ErrorPageOptions {
  /**
   * URL of the client-side JS entry bundle.
   *
   * When provided the response becomes a minimal HTML shell that loads the
   * React app via CSR so the user lands on a working page instead of a static
   * error screen. The status code should be 200 in this case so the browser
   * processes the shell normally.
   *
   * When omitted (e.g. the assets directory cannot be read) a self-contained
   * error page is returned instead.
   */
  clientEntryUrl?: string | null;
}

/**
 * Returns an HTML response body for an SSR failure.
 *
 * If `clientEntryUrl` is supplied the body is a minimal shell that loads the
 * React bundle so the browser falls back to client-side rendering — the user
 * never sees an error at all.  When it is absent (asset detection failed) a
 * friendly static error page is returned so the user at least gets actionable
 * UI instead of a raw 500.
 *
 * Error details are intentionally kept out of the browser response; they are
 * logged server-side by the caller.
 */
export function renderErrorPage(opts?: ErrorPageOptions): string {
  const { clientEntryUrl } = opts ?? {};

  // ── CSR shell: SSR failed but we have the client bundle. ────────────────
  // Serve a bare <html> + <script type="module"> so the browser loads the
  // React app and renders fully client-side. No dehydrated state is present,
  // so TanStack Start/Router performs a fresh CSR pass — equivalent to
  // visiting the page with JS-only rendering.
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

  // ── Static fallback: no client bundle available. ─────────────────────────
  // Show a self-contained error page so the user gets actionable UI rather
  // than a blank screen or a raw JSON 500 body.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
