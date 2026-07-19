import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
} from "@/integrations/lovable/appUserConnector";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "microsoft_onedrive";

const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Files.Read",
  "Files.Read.All",
];

export const startOneDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: string) => z.string().url().parse(v))
  .handler(async ({ data: targetOrigin, context }) => {
    const clientKey = process.env.MICROSOFT_ONEDRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY;
    if (!clientKey) throw new Error("OneDrive connector client is not configured");

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl: targetOrigin,
      responseMode: "web_message",
      webMessageTargetOrigin: targetOrigin,
      credentialsConfiguration: { scopes: SCOPES },
    });
    return { authorizationUrl };
  });

export const saveOneDriveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectionAPIKey: string; accountLabel?: string }) =>
    z.object({ connectionAPIKey: z.string().min(1), accountLabel: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    await saveConnectionKeyForUser(context.userId, CONNECTOR_ID, data.connectionAPIKey, data.accountLabel);
    return { ok: true };
  });

export const getOneDriveStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("app_user_connections")
      .select("id, account_label, status, created_at, updated_at")
      .eq("connector_id", CONNECTOR_ID)
      .maybeSingle();
    if (!data) return { connected: false as const };
    // Try to fetch identity to confirm token
    try {
      const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
      const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
      if (!key) return { connected: false as const };
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: "/me/drive?$select=owner,driveType",
      });
      if (res.ok) {
        const body = (await res.json()) as { owner?: { user?: { displayName?: string; email?: string } }; driveType?: string };
        const label =
          body?.owner?.user?.displayName || body?.owner?.user?.email || data.account_label || "OneDrive";
        return { connected: true as const, accountLabel: label, driveType: body?.driveType, since: data.created_at };
      }
    } catch {
      /* fall through */
    }
    return { connected: true as const, accountLabel: data.account_label ?? "OneDrive", since: data.created_at };
  });

export const disconnectOneDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CONNECTOR_ID,
        });
      } catch {
        /* ignore gateway errors, still clear local */
      }
    }
    await deleteConnectionForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  file?: { mimeType?: string };
  folder?: unknown;
  lastModifiedDateTime?: string;
  parentReference?: { path?: string };
  webUrl?: string;
}

async function listChildren(key: string, itemPath: string): Promise<DriveItem[]> {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: CONNECTOR_ID,
    path: itemPath,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OneDrive list failed (${res.status}): ${t}`);
  }
  const body = (await res.json()) as { value?: DriveItem[] };
  return body.value ?? [];
}

const TEXT_LIKE = /^(text\/|application\/(json|xml|csv|rtf|markdown))/i;
const OFFICE_EXT = /\.(docx?|pptx?|xlsx?|pdf|txt|md|rtf|csv|json|xml|html?)$/i;

async function walkDrive(key: string, maxFiles: number): Promise<DriveItem[]> {
  const found: DriveItem[] = [];
  const queue: string[] = ["/me/drive/root/children?$top=200"];
  const seen = new Set<string>();
  while (queue.length && found.length < maxFiles) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    let items: DriveItem[];
    try {
      items = await listChildren(key, path);
    } catch {
      continue;
    }
    for (const item of items) {
      if (item.folder) {
        queue.push(`/me/drive/items/${item.id}/children?$top=200`);
      } else if (item.file && (TEXT_LIKE.test(item.file.mimeType ?? "") || OFFICE_EXT.test(item.name))) {
        found.push(item);
        if (found.length >= maxFiles) break;
      }
    }
  }
  return found;
}

export const scanOneDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { maxFiles?: number } = {}) =>
    z.object({ maxFiles: z.number().int().min(1).max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = await getConnectionKeyForUser(context.userId, "microsoft_onedrive");
    if (!key) throw new Error("OneDrive is not connected");

    const items = await walkDrive(key, data.maxFiles ?? 50);
    const rows = items.map((it) => ({
      user_id: context.userId,
      source: "onedrive",
      remote_id: it.id,
      name: it.name,
      path: it.parentReference?.path ?? null,
      mime_type: it.file?.mimeType ?? null,
      size_bytes: it.size ?? null,
      modified_at: it.lastModifiedDateTime ?? null,
      status: "discovered",
    }));

    if (rows.length === 0) return { discovered: 0 };

    const { error } = await supabaseAdmin
      .from("vault_documents")
      .upsert(rows, { onConflict: "user_id,source,remote_id", ignoreDuplicates: true });
    if (error) throw error;

    return { discovered: rows.length };
  });

async function fetchDocumentText(key: string, remoteId: string, mimeType: string | null, name: string): Promise<string> {
  // For Office docs, request PDF conversion isn't easily parseable; grab raw content for text-like only.
  const isText = TEXT_LIKE.test(mimeType ?? "") || /\.(txt|md|csv|json|xml|html?)$/i.test(name);
  if (!isText) return ""; // rely on filename + metadata for classification
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: CONNECTOR_ID,
    path: `/me/drive/items/${remoteId}/content`,
  });
  if (!res.ok) return "";
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  return text.slice(0, 40000);
}

const EXECUTIVE_MAP: Record<string, string> = {
  strategy: "iris",
  vision: "iris",
  leadership: "iris",
  growth: "iris",
  operations: "apex",
  sop: "apex",
  process: "apex",
  workflow: "apex",
  execution: "katana",
  asset: "katana",
  revenue: "katana",
  automation: "katana",
  policy: "sentinel",
  compliance: "sentinel",
  risk: "sentinel",
  governance: "sentinel",
  audit: "sentinel",
  security: "sentinel",
};

function pickExecutive(text: string, fallback = "iris"): string {
  const lc = text.toLowerCase();
  let best = fallback;
  let bestScore = 0;
  for (const [k, exec] of Object.entries(EXECUTIVE_MAP)) {
    const score = (lc.match(new RegExp(`\\b${k}`, "g")) ?? []).length;
    if (score > bestScore) {
      bestScore = score;
      best = exec;
    }
  }
  return best;
}

async function classifyWithAI(name: string, snippet: string, path: string | null) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const prompt = `You are the MOS Knowledge Harvesting Engine. Classify this document and extract institutional intelligence. Return STRICT JSON matching the schema.

DOCUMENT
Name: ${name}
Path: ${path ?? "(root)"}
Content (may be truncated):
"""
${snippet.slice(0, 12000)}
"""

Schema:
{
 "knowledge_type": "sop|framework|training|policy|report|template|research|meeting_notes|other",
 "department": "strategy|operations|execution|governance|finance|people|other",
 "sensitivity": "public|internal|confidential|restricted",
 "priority": "low|medium|high|critical",
 "executive_owner": "iris|apex|katana|sentinel",
 "knowledge_score": 0-100,
 "summary": "2-3 sentences",
 "insights": ["3-5 bullet insights"],
 "lessons": ["1-3 lessons learned"],
 "sop_opportunities": ["0-3"],
 "training_opportunities": ["0-3"],
 "asset_opportunities": ["0-3"],
 "automation_opportunities": ["0-3"],
 "revenue_opportunities": ["0-3"],
 "risks": ["0-3"]
}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You return only strict minified JSON. No prose, no code fences." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI classify failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { summary: cleaned.slice(0, 400) };
  }
}

export const harvestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");

    const { data: doc, error: dErr } = await supabaseAdmin
      .from("vault_documents")
      .select("*")
      .eq("id", data.documentId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!doc) throw new Error("Document not found");

    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) throw new Error("OneDrive is not connected");

    const text = await fetchDocumentText(key, doc.remote_id, doc.mime_type, doc.name);
    const snippet = text.slice(0, 1200);
    const analysis = await classifyWithAI(doc.name, text || `Filename only: ${doc.name}`, doc.path);
    const owner: string = analysis.executive_owner || pickExecutive(`${doc.name} ${text}`);

    const { error: uErr } = await supabaseAdmin
      .from("vault_documents")
      .update({
        raw_text: text || null,
        snippet: snippet || null,
        status: "harvested",
        executive_owner: owner,
        knowledge_type: analysis.knowledge_type ?? null,
        department: analysis.department ?? null,
        sensitivity: analysis.sensitivity ?? null,
        priority: analysis.priority ?? null,
        knowledge_score: typeof analysis.knowledge_score === "number" ? analysis.knowledge_score : null,
        classification: {
          knowledge_type: analysis.knowledge_type,
          department: analysis.department,
          sensitivity: analysis.sensitivity,
          priority: analysis.priority,
        },
        analysis,
        harvested_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    if (uErr) throw uErr;
    return { ok: true, executive_owner: owner };
  });

export const harvestBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } = {}) =>
    z.object({ limit: z.number().int().min(1).max(20).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pending } = await supabaseAdmin
      .from("vault_documents")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "discovered")
      .order("created_at", { ascending: true })
      .limit(data.limit ?? 8);

    let processed = 0;
    for (const row of pending ?? []) {
      try {
        await (harvestDocument as unknown as (a: { data: { documentId: string } }) => Promise<unknown>)({
          data: { documentId: row.id },
        });
        processed++;
      } catch {
        await supabaseAdmin
          .from("vault_documents")
          .update({ status: "error" })
          .eq("id", row.id);
      }
    }
    return { processed };
  });

export const listVaultDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("vault_documents")
      .select("*")
      .order("harvested_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });
