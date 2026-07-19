// Server functions for threads, messages, missions, documents, council, audit.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { MOS_V1_SEED } from "@/lib/mos-doctrine";

// Only the MOS V1 constitutional doctrine is seeded into the Institutional
// Library. Commercial doctrine (the MASOPS Bibles and executive constitutions)
// is the Operator's IP and is loaded server-side into executive context only.
const SEED_DOCS: Array<{ title: string; version: string; source_filename: string; content: string }> = [
  { title: "MOS V1 — Constitution & Executive Doctrine", version: "v1", source_filename: "MosV1.pdf", content: MOS_V1_SEED },
];

const execEnum = z.enum(["iris", "apex", "katana", "sentinel"]);

// --- Threads ---
export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { executive: ExecutiveId }) => ({ executive: execEnum.parse(d.executive) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("executive_threads")
      .select("*")
      .eq("executive", data.executive)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows;
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { executive: ExecutiveId; title?: string }) => ({
    executive: execEnum.parse(d.executive),
    title: d.title?.slice(0, 120) || "New Feed",
  }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("executive_threads")
      .insert({ user_id: context.userId, executive: data.executive, title: data.title })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      executive: data.executive,
      action: "thread.create",
      entity_type: "thread",
      entity_id: row.id,
    });
    return row;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => ({ threadId: z.string().uuid().parse(d.threadId) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("executive_threads").delete().eq("id", data.threadId);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: "thread.delete",
      entity_type: "thread",
      entity_id: data.threadId,
    });
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; title: string }) => ({
    threadId: z.string().uuid().parse(d.threadId),
    title: z.string().min(1).max(120).parse(d.title),
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("executive_threads")
      .update({ title: data.title })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Messages ---
export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => ({ threadId: z.string().uuid().parse(d.threadId) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("executive_messages")
      .select("*")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows;
  });

export const persistTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; userText: string; assistantText: string }) => ({
    threadId: z.string().uuid().parse(d.threadId),
    userText: z.string().min(1).max(20000).parse(d.userText),
    assistantText: z.string().min(1).max(80000).parse(d.assistantText),
  }))
  .handler(async ({ data, context }) => {
    const rows = [
      { thread_id: data.threadId, user_id: context.userId, role: "user", content: data.userText },
      { thread_id: data.threadId, user_id: context.userId, role: "assistant", content: data.assistantText },
    ];
    const { error } = await context.supabase.from("executive_messages").insert(rows);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("executive_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.threadId);
    // Auto-title from first exchange
    const { count } = await context.supabase
      .from("executive_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", data.threadId);
    if (count === 2) {
      const derived = data.userText.slice(0, 60).replace(/\s+/g, " ").trim();
      await context.supabase
        .from("executive_threads")
        .update({ title: derived || "New Feed" })
        .eq("id", data.threadId);
    }
    return { ok: true };
  });

// --- Missions ---
export const listMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("missions")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const createMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; objective?: string; priority?: string; sponsor?: ExecutiveId }) => ({
    title: z.string().min(1).max(200).parse(d.title),
    objective: d.objective?.slice(0, 4000) || null,
    priority: z.enum(["Low", "Medium", "High", "Critical"]).parse(d.priority || "Medium"),
    sponsor: d.sponsor ? execEnum.parse(d.sponsor) : null,
  }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("missions")
      .insert({
        user_id: context.userId,
        title: data.title,
        objective: data.objective,
        priority: data.priority,
        sponsor_executive: data.sponsor,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => ({
    id: z.string().uuid().parse(d.id),
    status: z.string().max(50).parse(d.status),
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("missions").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Institutional Documents ---
export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("institutional_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const seedDoctrineIfEmpty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await context.supabase
      .from("institutional_documents")
      .select("source_filename")
      .eq("is_seed", true);
    const have = new Set((existing ?? []).map((r) => r.source_filename));
    const missing = SEED_DOCS.filter((d) => !have.has(d.source_filename));
    if (missing.length === 0) return { seeded: 0 };
    const { error } = await context.supabase.from("institutional_documents").insert(
      missing.map((d) => ({ user_id: context.userId, is_seed: true, ...d })),
    );
    if (error) throw new Error(error.message);
    return { seeded: missing.length };
  });

export const addDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; content: string; version?: string; source_filename?: string }) => ({
    title: z.string().min(1).max(200).parse(d.title),
    content: z.string().min(1).max(200000).parse(d.content),
    version: d.version?.slice(0, 30) || "v1",
    source_filename: d.source_filename?.slice(0, 200) || null,
  }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("institutional_documents")
      .insert({ user_id: context.userId, ...data, is_seed: false })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// --- Executive Council ---
async function runExec(exec: ExecutiveId, apiKey: string, prompt: string): Promise<string> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const { privateDoctrineFor } = await import("@/lib/doctrine/private-doctrine.server");
  const { getExecutiveSystemPrompt } = await import("@/lib/executives-prompts.server");
  const doctrine = privateDoctrineFor(exec);
  const base = getExecutiveSystemPrompt(exec);
  const result = await generateText({
    model: gateway(DEFAULT_MODEL),
    system: doctrine ? `${base}${doctrine}` : base,
    prompt,
  });
  return result.text;
}

export const listCouncilSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("council_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data;
  });

export const convokeCouncil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { request: string }) => ({
    request: z.string().min(10).max(4000).parse(d.request),
  }))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const { data: sess, error } = await context.supabase
      .from("council_sessions")
      .insert({ user_id: context.userId, operator_request: data.request, status: "convening" })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const req = data.request;
    // 1. IRIS defines the true objective.
    const iris = await runExec(
      "iris",
      key,
      `Operator request:\n"""${req}"""\n\nAs IRIS, define the TRUE strategic objective, why it matters, success criteria, key constraints, and the audience of stakeholders. Then state which executives should be engaged. Be concise (max ~250 words).`,
    );
    // 2. APEX designs the system.
    const apex = await runExec(
      "apex",
      key,
      `Operator request:\n"""${req}"""\n\nIRIS's strategic definition:\n"""${iris}"""\n\nAs APEX, design the system/architecture needed: process map, SOP outline, KPIs, information flow, and automation opportunities. Concise (max ~250 words).`,
    );
    // 3. KATANA plans execution.
    const katana = await runExec(
      "katana",
      key,
      `Operator request:\n"""${req}"""\n\nStrategy: ${iris}\n\nSystems: ${apex}\n\nAs KATANA, produce the execution plan: phases, first mission, milestones, dependencies, resources, blockers, and completion criteria. Concise (max ~250 words).`,
    );
    // 4. SENTINEL risk-reviews.
    const sentinel = await runExec(
      "sentinel",
      key,
      `Operator request:\n"""${req}"""\n\nStrategy: ${iris}\nSystems: ${apex}\nExecution plan: ${katana}\n\nAs SENTINEL, deliver the risk & security review. Classify risks, list vulnerabilities, cite required approval level (1-5), recommend safeguards, and give a verdict: PROCEED / PROCEED WITH GUARDRAILS / HOLD FOR OPERATOR / BLOCK. Concise (max ~250 words).`,
    );
    // 5. IRIS unifies.
    const final = await runExec(
      "iris",
      key,
      `Operator request:\n"""${req}"""\n\nCouncil findings:\n- IRIS strategy: ${iris}\n- APEX systems: ${apex}\n- KATANA execution: ${katana}\n- SENTINEL risk: ${sentinel}\n\nAs IRIS, deliver the unified Executive Council Recommendation to the Operator. Structure:\n1. Mission definition (1-2 lines)\n2. Recommendation (clear directive)\n3. Required Operator decisions\n4. Any Council disagreements to surface\n5. Next best action\n\nBe direct and decisive. Max ~300 words.`,
    );

    const { error: uErr } = await context.supabase
      .from("council_sessions")
      .update({
        iris_analysis: iris,
        apex_analysis: apex,
        katana_analysis: katana,
        sentinel_analysis: sentinel,
        final_recommendation: final,
        status: "complete",
      })
      .eq("id", sess.id);
    if (uErr) throw new Error(uErr.message);

    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: "council.convoke",
      entity_type: "council_session",
      entity_id: sess.id,
    });

    return sess.id;
  });

// --- Profile ---
export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });
