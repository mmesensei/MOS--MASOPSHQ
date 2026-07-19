// Phase 1 — Universal Asset Intake for KATANA.
// Registers assets from any source into public.katana_assets with multi-dim classification.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROVIDERS = ["google_drive", "onedrive", "dropbox", "upload", "local_folder"] as const;
const KINDS = ["video", "image", "audio", "doc", "text", "presentation", "spreadsheet", "archive", "other"] as const;
const MIME_FAMILIES = ["video", "image", "audio", "document", "presentation", "spreadsheet", "archive", "other"] as const;
const PRIORITY_BANDS = ["critical", "high", "medium", "low"] as const;

function mimeToFamily(mime: string | null | undefined): (typeof MIME_FAMILIES)[number] {
  if (!mime) return "other";
  const m = mime.toLowerCase();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.includes("presentation") || m.endsWith(".presentation") || m.includes("powerpoint")) return "presentation";
  if (m.includes("spreadsheet") || m.includes("excel") || m === "text/csv") return "spreadsheet";
  if (m.includes("zip") || m.includes("compressed") || m.includes("tar")) return "archive";
  if (m.startsWith("text/") || m.includes("pdf") || m.includes("word") || m.includes("document")) return "document";
  return "other";
}

function familyToKind(f: (typeof MIME_FAMILIES)[number]): (typeof KINDS)[number] {
  if (f === "document") return "doc";
  return f;
}

// ---------------- Sources ----------------

export const listSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("katana_asset_sources")
      .select("*")
      .order("provider", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    provider: (typeof PROVIDERS)[number];
    account_label?: string | null;
    scopes?: string[];
    status?: "active" | "not_configured" | "revoked" | "error";
    root_path?: string | null;
  }) => ({
    provider: z.enum(PROVIDERS).parse(d.provider),
    account_label: d.account_label?.slice(0, 200) ?? null,
    scopes: d.scopes ?? [],
    status: d.status ?? "active",
    root_path: d.root_path?.slice(0, 500) ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("katana_asset_sources")
      .select("id")
      .eq("user_id", context.userId)
      .eq("provider", data.provider)
      .eq("account_label", data.account_label ?? "")
      .maybeSingle();

    const patch = {
      user_id: context.userId,
      provider: data.provider,
      account_label: data.account_label,
      scopes: data.scopes,
      status: data.status,
      root_path: data.root_path,
      connected_at: data.status === "active" ? new Date().toISOString() : null,
      revoked_at: data.status === "revoked" ? new Date().toISOString() : null,
    };

    if (existing) {
      const { data: row, error } = await context.supabase
        .from("katana_asset_sources")
        .update(patch).eq("id", existing.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("katana_asset_sources").insert(patch).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------- Assets ----------------

const RegisterAssetSchema = z.object({
  source: z.enum(["google_drive", "onedrive", "dropbox", "upload", "local_folder", "manual", "internal"]),
  source_ref: z.string().min(1).max(500),
  source_uri: z.string().max(1000).optional().nullable(),
  title: z.string().min(1).max(300),
  mime: z.string().max(200).optional().nullable(),
  size_bytes: z.number().int().nonnegative().optional().nullable(),
  content_hash: z.string().max(200).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  authorized: z.boolean().optional(),
});

export const registerAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RegisterAssetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const family = mimeToFamily(data.mime);
    const kind = familyToKind(family);

    const { data: existing } = await context.supabase
      .from("katana_assets")
      .select("id, version")
      .eq("user_id", context.userId)
      .eq("source", data.source)
      .eq("source_ref", data.source_ref)
      .maybeSingle();

    const row = {
      user_id: context.userId,
      source: data.source,
      source_ref: data.source_ref,
      source_provider: data.source,
      source_uri: data.source_uri ?? null,
      title: data.title,
      kind,
      mime: data.mime ?? null,
      mime_family: family,
      size_bytes: data.size_bytes ?? null,
      content_hash: data.content_hash ?? null,
      metadata: (data.metadata ?? {}) as never,
      authorized: data.authorized ?? true,
      last_scanned_at: new Date().toISOString(),
    };

    if (existing) {
      const { data: updated, error } = await context.supabase
        .from("katana_assets")
        .update({ ...row, version: (existing.version ?? 1) + 1 })
        .eq("id", existing.id).select().single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: inserted, error } = await context.supabase
      .from("katana_assets").insert(row).select().single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const listAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider?: string; authorized?: boolean; limit?: number }) => ({
    provider: d?.provider ? z.enum(PROVIDERS).parse(d.provider) : undefined,
    authorized: d?.authorized,
    limit: Math.min(Math.max(d?.limit ?? 100, 1), 500),
  }))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("katana_assets").select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.provider) q = q.eq("source_provider", data.provider);
    if (typeof data.authorized === "boolean") q = q.eq("authorized", data.authorized);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setAssetAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; authorized: boolean }) => ({
    id: z.string().uuid().parse(d.id), authorized: !!d.authorized,
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("katana_assets")
      .update({ authorized: data.authorized })
      .eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAssetClassification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    business_category?: string[];
    execution_category?: string[];
    priority_band?: (typeof PRIORITY_BANDS)[number];
    tags?: string[];
    categories?: string[];
  }) => ({
    id: z.string().uuid().parse(d.id),
    business_category: d.business_category?.slice(0, 20) ?? undefined,
    execution_category: d.execution_category?.slice(0, 20) ?? undefined,
    priority_band: d.priority_band ? z.enum(PRIORITY_BANDS).parse(d.priority_band) : undefined,
    tags: d.tags?.slice(0, 30) ?? undefined,
    categories: d.categories?.slice(0, 20) ?? undefined,
  }))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.business_category) patch.business_category = data.business_category;
    if (data.execution_category) patch.execution_category = data.execution_category;
    if (data.priority_band) patch.priority_band = data.priority_band;
    if (data.tags) patch.tags = data.tags;
    if (data.categories) patch.categories = data.categories;
    const { error } = await context.supabase.from("katana_assets")
      .update(patch as never).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Scan sweeps (log-only in Phase 1; provider walk added later) ----------------

export const logScanSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    provider: string; source_id?: string;
    files_seen: number; files_authorized: number; files_skipped: number;
    duration_ms: number; notes?: string;
  }) => ({
    provider: z.enum(PROVIDERS).parse(d.provider),
    source_id: d.source_id ? z.string().uuid().parse(d.source_id) : null,
    files_seen: Math.max(0, d.files_seen | 0),
    files_authorized: Math.max(0, d.files_authorized | 0),
    files_skipped: Math.max(0, d.files_skipped | 0),
    duration_ms: Math.max(0, d.duration_ms | 0),
    notes: d.notes?.slice(0, 500) ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("katana_scan_log")
      .insert({ user_id: context.userId, ...data }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listScanLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("katana_scan_log")
      .select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const PROVIDER_LABELS: Record<string, string> = {
  google_drive: "Google Drive",
  onedrive: "OneDrive",
  dropbox: "Dropbox",
  upload: "Direct Upload",
  local_folder: "Local Folder",
};
