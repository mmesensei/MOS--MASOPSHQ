// Public Google OAuth 2.0 callback. Runs server-side in the Cloudflare Worker.
// Security: single-use state, PKCE verifier, ID-token signature/issuer/audience/
// nonce verification, drive.readonly scope check, IP+state rate limits before
// any MOS user identity is resolved. Never logs or returns token material.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          audit,
          checkRateLimit,
          decrypt,
          encrypt,
          exchangeCode,
          hashIp,
          hashSub,
          verifyIdToken,
        } = await import("@/server/googleOAuth.server");

        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code");
        const errorParam = url.searchParams.get("error");

        // Rate limit BEFORE resolving a MOS user identity.
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        const ipHash = hashIp(ip);
        if (!(await checkRateLimit("gcb:ip:" + ipHash, 30))) return htmlPage("Too many requests.", 429);
        if (state && !(await checkRateLimit("gcb:st:" + state.slice(0, 32), 3)))
          return htmlPage("Too many requests.", 429);

        if (errorParam) {
          await audit(null, "callback_error", { error: errorParam, ip_hash: ipHash });
          return htmlPage(`Google denied access: ${escapeHtml(errorParam)}.`, 400);
        }
        if (!state || !code) return htmlPage("Missing state or code.", 400);

        // Atomically consume the state row (single-use).
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();
        const { data: stateRow, error: stateErr } = await supabaseAdmin
          .from("google_oauth_states")
          .update({ consumed_at: nowIso })
          .eq("state", state)
          .is("consumed_at", null)
          .gt("expires_at", nowIso)
          .select("user_id, code_verifier, nonce, redirect_target")
          .maybeSingle();
        if (stateErr || !stateRow) {
          await audit(null, "state_invalid", { ip_hash: ipHash });
          return htmlPage("Sign-in link is invalid, expired, or already used. Start again.", 400);
        }

        try {
          const tok = await exchangeCode(code, stateRow.code_verifier);

          const grantedScopes = (tok.scope ?? "").split(/\s+/).filter(Boolean);
          if (!grantedScopes.includes("https://www.googleapis.com/auth/drive.readonly")) {
            await audit(stateRow.user_id, "scope_missing", { granted: grantedScopes });
            return htmlPage(
              "Required Google Drive read-only access was not granted. Retry and keep the Drive checkbox selected.",
              400,
            );
          }
          if (!tok.id_token) {
            await audit(stateRow.user_id, "id_token_missing", {});
            return htmlPage("Google did not return an ID token.", 400);
          }

          const claims = await verifyIdToken(tok.id_token, stateRow.nonce);
          // Identity is bound to Google's immutable sub, not email.
          const subHash = hashSub(claims.sub);

          const expiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString();
          const patch = {
            user_id: stateRow.user_id,
            google_sub: claims.sub,
            account_email: claims.email ?? null,
            account_name: claims.name ?? null,
            scopes: grantedScopes,
            access_token_ciphertext: encrypt(tok.access_token),
            access_token_expires_at: expiresAt,
            revoked_at: null,
            updated_at: nowIso,
            ...(tok.refresh_token ? { refresh_token_ciphertext: encrypt(tok.refresh_token) } : {}),
          };

          const { error: upErr } = await supabaseAdmin
            .from("google_connections")
            .upsert(patch as never, { onConflict: "user_id" });
          if (upErr) throw new Error("Storage error");

          await audit(stateRow.user_id, "connected", {
            google_sub_hash: subHash,
            scopes: grantedScopes,
            issued_refresh: Boolean(tok.refresh_token),
          });

          const target = safeRedirect(stateRow.redirect_target) + "?gdrive_custom=connected";
          return new Response(null, { status: 302, headers: { location: target } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await audit(stateRow.user_id, "callback_failed", { error: msg.slice(0, 200) });
          // Best-effort: revoke tokens if we somehow got them, but we didn't store yet.
          return htmlPage("Connection failed. Please try again.", 500);
        }
      },
    },
  },
});

function safeRedirect(target: string | null | undefined): string {
  if (!target) return "/knowledge-connections";
  // Only allow same-site absolute paths.
  if (!target.startsWith("/") || target.startsWith("//")) return "/knowledge-connections";
  return target;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function htmlPage(message: string, status = 200): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>MOS · Google connection</title>
<body style="font-family:system-ui,sans-serif;background:#0a0a0f;color:#e5e5e5;padding:2.5rem;max-width:640px;margin:auto">
  <h1 style="font-size:1.25rem">${escapeHtml(message)}</h1>
  <p><a style="color:#8b5cf6" href="/knowledge-connections">Return to Knowledge Connections</a></p>
</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
