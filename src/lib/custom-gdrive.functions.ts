// Server functions for the custom Google OAuth Drive flow.
// Client-facing surface: connect / status / disconnect / list folders /
// select / unselect / list selected. Token material never leaves the server.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function loadOAuth() {
  return await import("@/server/googleOAuth.server");
}

// ---------- Connect ----------

export const startCustomGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { redirectTarget?: string } = {}) =>
    z.object({ redirectTarget: z.string().max(300).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const oauth = await loadOAuth();
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("Google OAuth client is not configured");

    const { verifier, challenge } = oauth.newPkce();
    const state = oauth.newState();
    const nonce = oauth.newNonce();
    const redirectTarget = data.redirectTarget && data.redirectTarget.startsWith("/")
      ? data.redirectTarget
      : "/knowledge-connections";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_oauth_states").insert({
      state,
      user_id: context.userId,
      code_verifier: verifier,
      nonce,
      redirect_target: redirectTarget,
    });
    if (error) throw new Error("Could not create OAuth state");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: oauth.CALLBACK_URL,
      scope: oauth.GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    await oauth.audit(context.userId, "oauth_started", {});
    return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  });

// ---------- Status (no token fields exposed) ----------

export const getCustomGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("google_connections")
      .select(
        "account_email, account_name, scopes, access_token_expires_at, last_refreshed_at, revoked_at, created_at, updated_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data || data.revoked_at) return { connected: false as const };
    return {
      connected: true as const,
      accountEmail: data.account_email,
      accountName: data.account_name,
      scopes: data.scopes ?? [],
      accessTokenExpiresAt: data.access_token_expires_at,
      lastRefreshedAt: data.last_refreshed_at,
      connectedAt: data.created_at,
    };
  });

// ---------- Disconnect ----------

export const disconnectCustomGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const oauth = await loadOAuth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("google_connections")
      .select("refresh_token_ciphertext, access_token_ciphertext")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (data?.refresh_token_ciphertext) {
      try { await oauth.revokeGoogleToken(oauth.decrypt(data.refresh_token_ciphertext)); } catch { /* best-effort */ }
    }
    if (data?.access_token_ciphertext) {
      try { await oauth.revokeGoogleToken(oauth.decrypt(data.access_token_ciphertext)); } catch { /* best-effort */ }
    }
    // Delete token material and selections so browse/sync immediately fail.
    await supabaseAdmin.from("google_connections").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("google_selected_folders").delete().eq("user_id", context.userId);
    await oauth.audit(context.userId, "disconnected", {});
    return { ok: true as const };
  });

// ---------- Access-token accessor (auto-refresh) ----------

async function getUserAccessToken(userId: string): Promise<string> {
  const oauth = await loadOAuth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("google_connections")
    .select("access_token_ciphertext, access_token_expires_at, refresh_token_ciphertext, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.revoked_at) throw new Error("Google Drive is not connected");

  const expiresAtMs = data.access_token_expires_at ? new Date(data.access_token_expires_at).getTime() : 0;
  if (data.access_token_ciphertext && expiresAtMs > Date.now() + 60_000) {
    return oauth.decrypt(data.access_token_ciphertext);
  }
  if (!data.refresh_token_ciphertext) {
    throw new Error("Google session expired and no refresh token is stored. Reconnect Google Drive.");
  }
  const refreshed = await oauth.refreshAccessToken(oauth.decrypt(data.refresh_token_ciphertext));
  const patch = {
    access_token_ciphertext: oauth.encrypt(refreshed.access_token),
    access_token_expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
    last_refreshed_at: new Date().toISOString(),
    ...(refreshed.refresh_token ? { refresh_token_ciphertext: oauth.encrypt(refreshed.refresh_token) } : {}),
  };
  await supabaseAdmin.from("google_connections").update(patch as never).eq("user_id", userId);
  await oauth.audit(userId, "token_refreshed", {});
  return refreshed.access_token;
}

// ---------- Folder browsing (supports shared drives) ----------

interface DriveFolder { id: string; name: string; parents?: string[]; driveId?: string }

export const listCustomDriveFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string; parentId?: string } = {}) =>
    z.object({ query: z.string().max(200).optional(), parentId: z.string().max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = await getUserAccessToken(context.userId);
    const clauses = ["mimeType = 'application/vnd.google-apps.folder'", "trashed = false"];
    if (data.parentId) clauses.push(`'${data.parentId.replace(/'/g, "\\'")}' in parents`);
    if (data.query) clauses.push(`name contains '${data.query.replace(/'/g, "\\'")}'`);
    const q = encodeURIComponent(clauses.join(" and "));
    const fields = encodeURIComponent("files(id,name,parents,driveId)");
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${q}` +
      `&pageSize=50&fields=${fields}` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Drive list failed (${res.status})`);
    const body = (await res.json()) as { files?: DriveFolder[] };
    return body.files ?? [];
  });

export const listCustomSelectedFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("google_selected_folders")
      .select("id, folder_id, folder_name, drive_id, is_shared_drive, last_sync_at, last_sync_status, file_count, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const addCustomSelectedFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { folderId: string; folderName: string; driveId?: string }) =>
    z.object({
      folderId: z.string().min(1).max(200),
      folderName: z.string().min(1).max(300),
      driveId: z.string().max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const oauth = await loadOAuth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_selected_folders").upsert(
      {
        user_id: context.userId,
        folder_id: data.folderId,
        folder_name: data.folderName,
        drive_id: data.driveId ?? null,
        is_shared_drive: Boolean(data.driveId),
      },
      { onConflict: "user_id,folder_id" },
    );
    if (error) throw error;
    await oauth.audit(context.userId, "folder_added", { folder_name: data.folderName }, );
    return { ok: true as const };
  });

export const removeCustomSelectedFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { folderId: string }) =>
    z.object({ folderId: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const oauth = await loadOAuth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("google_selected_folders")
      .delete()
      .eq("user_id", context.userId)
      .eq("folder_id", data.folderId);
    await oauth.audit(context.userId, "folder_removed", {});
    return { ok: true as const };
  });

// ---------- Sync (metadata only → vault_documents bridge for KATANA) ----------

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  headRevisionId?: string;
  trashed?: boolean;
}

async function listFilesInFolder(token: string, folderId: string, pageToken?: string) {
  const q = encodeURIComponent(`'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    "nextPageToken, files(id,name,mimeType,size,modifiedTime,parents,webViewLink,headRevisionId,trashed)",
  );
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${q}` +
    `&pageSize=200&fields=${fields}` +
    `&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives` +
    (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive list failed (${res.status})`);
  return (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
}

export const syncCustomGoogleDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const oauth = await loadOAuth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = await getUserAccessToken(context.userId);

    const { data: folders } = await supabaseAdmin
      .from("google_selected_folders")
      .select("id, folder_id, folder_name")
      .eq("user_id", context.userId);

    if (!folders || folders.length === 0) {
      await oauth.audit(context.userId, "sync_skipped_no_folders", {});
      return { synced: 0, folders: 0, failed: 0 };
    }

    let totalDiscovered = 0;
    let totalFailed = 0;

    for (const folder of folders) {
      let pageToken: string | undefined;
      let count = 0;
      const errors: string[] = [];
      try {
        do {
          const page = await listFilesInFolder(token, folder.folder_id, pageToken);
          const rows = (page.files ?? []).filter((f) => !f.trashed).map((f) => ({
            user_id: context.userId,
            source: "google_drive",
            remote_id: f.id,
            name: f.name,
            path: folder.folder_name,
            mime_type: f.mimeType,
            size_bytes: f.size ? Number(f.size) : null,
            modified_at: f.modifiedTime ?? null,
            status: "discovered",
            analysis: {
              gdrive: {
                folderId: folder.folder_id,
                webViewLink: f.webViewLink,
                headRevisionId: f.headRevisionId,
                provider: "google_drive_custom",
              },
            },
          }));
          if (rows.length) {
            const { error } = await supabaseAdmin
              .from("vault_documents")
              .upsert(rows, { onConflict: "user_id,source,remote_id", ignoreDuplicates: false });
            if (error) {
              errors.push(error.message);
              totalFailed += rows.length;
            } else {
              count += rows.length;
            }
          }
          pageToken = page.nextPageToken;
        } while (pageToken);

        await supabaseAdmin
          .from("google_selected_folders")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: errors.length ? "partial" : "ok",
            last_sync_error: errors.length ? errors.join("; ").slice(0, 500) : null,
            file_count: count,
          })
          .eq("id", folder.id);
        totalDiscovered += count;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        totalFailed++;
        await supabaseAdmin
          .from("google_selected_folders")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "error",
            last_sync_error: msg.slice(0, 500),
          })
          .eq("id", folder.id);
      }
    }

    await oauth.audit(context.userId, "sync_completed", {
      totalDiscovered,
      folders: folders.length,
      failed: totalFailed,
    });
    return { synced: totalDiscovered, folders: folders.length, failed: totalFailed };
  });

export const listCustomKnowledgeAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("knowledge_audit_log")
      .select("id, actor_id, source, action, target_ref, metadata, created_at")
      .eq("actor_id", context.userId)
      .in("source", ["google_oauth_custom", "google_drive"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

