// Server-only helpers for the custom Google OAuth 2.0 + PKCE flow.
// NEVER import this file from a client component or a *.functions.ts file at
// module scope; load inside handler bodies with `await import(...)`.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const CALLBACK_URL =
  process.env.GOOGLE_OAUTH_CALLBACK_URL ??
  "https://mosv1.lovable.app/api/public/google/oauth/callback";

// Least-privilege: identity + Drive read-only. drive.readonly is verified on
// the callback (must appear in returned scopes) or the connection is refused.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
];

function key(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not set");
  // Derive a 32-byte AES key by SHA-256 of the configured secret so any
  // length/encoding of the source secret works.
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decrypt(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function newPkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
export function newState(): string { return b64url(randomBytes(32)); }
export function newNonce(): string { return b64url(randomBytes(16)); }

export function hashSub(sub: string): string {
  return createHash("sha256").update("sub|" + sub).digest("hex").slice(0, 16);
}

export function hashIp(ip: string): string {
  const salt = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "salt";
  return createHash("sha256").update("ip|" + salt + "|" + ip).digest("hex").slice(0, 32);
}

// ---------- Google discovery / JWKS ----------

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleIdClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  hd?: string;
}

export async function verifyIdToken(idToken: string, expectedNonce: string): Promise<GoogleIdClaims> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not set");
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    // jose enforces exp/iat/nbf automatically.
  });
  if (payload.nonce !== expectedNonce) throw new Error("ID token nonce mismatch");
  if (!payload.sub) throw new Error("ID token missing sub");
  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : undefined,
    email_verified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : undefined,
    hd: typeof payload.hd === "string" ? payload.hd : undefined,
  };
}

// ---------- Token exchange / refresh / revoke ----------

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  scope?: string;
  token_type?: string;
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: CALLBACK_URL,
      code_verifier: codeVerifier,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
  } catch {
    /* best-effort */
  }
}

// ---------- Rate limiting (pre-identity, IP/state keyed) ----------

const WINDOW_MS = 10 * 60 * 1000;

export async function checkRateLimit(bucketKey: string, limit: number): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS).toISOString();
  const { data } = await supabaseAdmin
    .from("google_oauth_rate_limits")
    .select("count")
    .eq("bucket_key", bucketKey)
    .eq("window_start", windowStart)
    .maybeSingle();
  const current = data?.count ?? 0;
  if (current >= limit) return false;
  await supabaseAdmin
    .from("google_oauth_rate_limits")
    .upsert(
      { bucket_key: bucketKey, window_start: windowStart, count: current + 1 },
      { onConflict: "bucket_key,window_start" },
    );
  return true;
}

// ---------- Audit ----------

export async function audit(
  userId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("knowledge_audit_log").insert({
    actor_id: userId,
    target_user_id: userId,
    source: "google_oauth_custom",
    action,
    metadata: metadata as never,
  });
}
