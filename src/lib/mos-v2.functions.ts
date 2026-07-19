// Server functions for the Mission lifecycle, SOP library, and Executive Journal.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { EXECUTIVE_CHARTER } from "@/lib/charter";
import { SOP_SEED } from "@/lib/sop-seed";

const execEnum = z.enum(["iris", "apex", "katana", "sentinel"]);
const stageEnum = z.enum(["proposed", "chartered", "active", "in_review", "completed", "held", "archived"]);

// ============ MISSIONS ============

export const listMissionsV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("missions")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getMission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { data: mission, error } = await context.supabase
      .from("missions").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!mission) return null;
    const { data: activity } = await context.supabase
      .from("mission_activity").select("*")
      .eq("mission_id", data.id).order("created_at", { ascending: false });
    return { mission, activity: activity ?? [] };
  });

const CharterSchema = z.object({
  iris_intent: z.string(),
  apex_structure: z.string(),
  katana_plan: z.string(),
  sentinel_risk: z.string(),
});

export const birthMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string; objective: string; priority: string; sponsor: ExecutiveId;
    charter: z.infer<typeof CharterSchema>;
    deliverables: string[]; risks: string[];
  }) => ({
    title: z.string().min(3).max(200).parse(d.title),
    objective: z.string().min(3).max(4000).parse(d.objective),
    priority: z.enum(["Low", "Medium", "High", "Critical"]).parse(d.priority),
    sponsor: execEnum.parse(d.sponsor),
    charter: CharterSchema.parse(d.charter),
    deliverables: z.array(z.string().max(300)).max(20).parse(d.deliverables),
    risks: z.array(z.string().max(300)).max(20).parse(d.risks),
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
        stage: "chartered",
        status: "Approved",
        charter: data.charter,
        deliverables: data.deliverables,
        risks: data.risks,
      })
      .select().single();
    if (error) throw new Error(error.message);
    await context.supabase.from("mission_activity").insert({
      mission_id: row.id, user_id: context.userId,
      actor: "operator", event: "chartered",
      detail: `Mission chartered with ${data.sponsor.toUpperCase()} as sponsor.`,
    });
    await context.supabase.from("audit_logs").insert({
      user_id: context.userId, action: "mission.charter",
      entity_type: "mission", entity_id: row.id,
    });
    return row;
  });

export const advanceMissionStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; stage: string; note?: string }) => ({
    id: z.string().uuid().parse(d.id),
    stage: stageEnum.parse(d.stage),
    note: d.note?.slice(0, 500) || null,
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("missions").update({ stage: data.stage }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("mission_activity").insert({
      mission_id: data.id, user_id: context.userId,
      actor: "operator", event: `stage:${data.stage}`, detail: data.note,
    });
    return { ok: true };
  });

// ============ MISSION WIZARD — executive contributions ============

async function callExec(exec: ExecutiveId, apiKey: string, prompt: string, max = 300): Promise<string> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const { operatorDoctrineFor } = await import("@/lib/doctrine/operator-doctrine.server");
  const { privateDoctrineFor } = await import("@/lib/doctrine/private-doctrine.server");
  const { getExecutiveSystemPrompt } = await import("@/lib/executives-prompts.server");
  const priv = privateDoctrineFor(exec) ?? "";
  const op = operatorDoctrineFor(exec) ?? "";
  const system = `${EXECUTIVE_CHARTER}\n\n${getExecutiveSystemPrompt(exec)}${priv}${op}`;
  const { text } = await generateText({
    model: gateway(DEFAULT_MODEL),
    system,
    prompt: `${prompt}\n\nRespond in under ${max} words. Plain prose, no headings.`,
  });
  return text.trim();
}

export const wizardIrisIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rawIntent: string }) => ({ rawIntent: z.string().min(5).max(2000).parse(d.rawIntent) }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY!;
    return callExec("iris", key,
      `The Operator wants to start a mission. Their raw intent:\n"""${data.rawIntent}"""\n\nAs IRIS, restate the TRUE mission objective (one paragraph), why it matters to the Operator's larger arc, what success will look like concretely, and the single most important constraint to respect.`,
      250);
  });

export const wizardApexStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rawIntent: string; irisIntent: string }) => ({
    rawIntent: z.string().parse(d.rawIntent),
    irisIntent: z.string().parse(d.irisIntent),
  }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY!;
    return callExec("apex", key,
      `Mission raw intent:\n"""${data.rawIntent}"""\n\nIRIS's mission definition:\n"""${data.irisIntent}"""\n\nAs APEX, design the structure: phases (2-4), the 3-5 concrete deliverables the mission must produce, KPIs to measure success, and any SOPs or templates worth extracting from this mission for reuse.`,
      280);
  });

export const wizardKatanaPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rawIntent: string; irisIntent: string; apexStructure: string }) => ({
    rawIntent: z.string().parse(d.rawIntent),
    irisIntent: z.string().parse(d.irisIntent),
    apexStructure: z.string().parse(d.apexStructure),
  }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY!;
    return callExec("katana", key,
      `Mission intent: ${data.irisIntent}\n\nStructure: ${data.apexStructure}\n\nAs KATANA, produce the execution plan: first three concrete moves, resources or people needed, the first blocker likely to appear, and the completion criteria that will move this from Active to In Review.`,
      280);
  });

export const wizardSentinelRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rawIntent: string; irisIntent: string; apexStructure: string; katanaPlan: string }) => ({
    rawIntent: z.string().parse(d.rawIntent),
    irisIntent: z.string().parse(d.irisIntent),
    apexStructure: z.string().parse(d.apexStructure),
    katanaPlan: z.string().parse(d.katanaPlan),
  }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY!;
    return callExec("sentinel", key,
      `Mission intent: ${data.irisIntent}\nStructure: ${data.apexStructure}\nPlan: ${data.katanaPlan}\n\nAs SENTINEL, deliver the risk review: risk classification, top 2-3 specific risks (name them), required approval level (1-5), safeguards to install, and one clear verdict: PROCEED / PROCEED WITH GUARDRAILS / HOLD FOR OPERATOR / BLOCK. Also state whether a LOWER-RISK PATH to the same outcome exists — if yes, name it.`,
      280);
  });

// ============ SOPs ============

const sopCat = z.enum(["sop", "template", "training", "scenario", "framework", "pattern"]);

export const listSops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sops").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getSop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sops").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const seedSopsIfEmpty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("sops").select("id", { count: "exact", head: true }).eq("is_seed", true);
    if ((count ?? 0) > 0) return { seeded: 0 };
    const rows = SOP_SEED.map((s) => ({
      user_id: context.userId,
      is_seed: true,
      category: s.category,
      title: s.title,
      summary: s.summary,
      body: s.body,
      source: s.source,
      tags: s.tags,
    }));
    const { error } = await context.supabase.from("sops").insert(rows);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });

export const createSop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { category: string; title: string; summary?: string; body: string; source?: string; tags?: string[] }) => ({
    category: sopCat.parse(d.category),
    title: z.string().min(3).max(200).parse(d.title),
    summary: d.summary?.slice(0, 500) || null,
    body: z.string().min(10).max(30000).parse(d.body),
    source: d.source?.slice(0, 200) || null,
    tags: (d.tags ?? []).slice(0, 20).map((t) => t.slice(0, 40)),
  }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sops")
      .insert({ user_id: context.userId, is_seed: false, ...data })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sops").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const draftSopWithApex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topic: string; category?: string }) => ({
    topic: z.string().min(5).max(2000).parse(d.topic),
    category: d.category ? sopCat.parse(d.category) : "sop",
  }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY!;
    const body = await callExec("apex", key,
      `The Operator wants an SOP drafted on: "${data.topic}"\n\nWrite the SOP in markdown. Include: Purpose, Trigger, Steps (numbered), Rule (one non-negotiable), and Anti-Pattern. Be operator-grade, not corporate.`,
      600);
    const summary = await callExec("apex", key,
      `Write a one-sentence summary (max 20 words) for this SOP:\n"""${body.slice(0, 1000)}"""`,
      40);
    const title = data.topic.slice(0, 80);
    return { title, summary, body, category: data.category };
  });

// ============ EXECUTIVE JOURNAL ============

export const listJournal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { executive?: ExecutiveId; limit?: number }) => ({
    executive: d.executive ? execEnum.parse(d.executive) : undefined,
    limit: Math.min(d.limit ?? 25, 100),
  }))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("executive_journal").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (data.executive) q = q.eq("executive", data.executive);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows;
  });

export const reflectAndJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { executive: ExecutiveId; userText: string; assistantText: string; missionId?: string }) => ({
    executive: execEnum.parse(d.executive),
    userText: z.string().min(1).max(20000).parse(d.userText),
    assistantText: z.string().min(1).max(80000).parse(d.assistantText),
    missionId: d.missionId ? z.string().uuid().parse(d.missionId) : null,
  }))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { skipped: "no_key" };
    // Skip trivial exchanges.
    if (data.userText.length < 30) return { skipped: "trivial" };

    const gateway = createLovableAiGatewayProvider(key);
    const prompt = `You are ${data.executive.toUpperCase()}, reflecting privately after a conversation with your Operator.

Operator said:\n"""${data.userText.slice(0, 2000)}"""

Your response was:\n"""${data.assistantText.slice(0, 2500)}"""

Write EXACTLY ONE journal entry in this JSON format only (no other text):
{"kind":"learned|observed|opportunity|correction|value","content":"one sentence, first-person, what you learned about your Operator, spotted, or want to remember"}

Skip if the exchange was purely mechanical or trivial by outputting: {"skip":true}`;

    const { text } = await generateText({
      model: gateway(DEFAULT_MODEL),
      prompt,
    });
    try {
      const clean = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      const parsed = JSON.parse(clean);
      if (parsed.skip) return { skipped: "trivial" };
      if (!parsed.kind || !parsed.content) return { skipped: "malformed" };
      const kinds = ["learned", "observed", "opportunity", "correction", "value"];
      if (!kinds.includes(parsed.kind)) return { skipped: "invalid_kind" };
      const { error } = await context.supabase.from("executive_journal").insert({
        user_id: context.userId,
        executive: data.executive,
        kind: parsed.kind,
        content: String(parsed.content).slice(0, 800),
        mission_id: data.missionId,
      });
      if (error) return { skipped: "db_error" };
      return { ok: true };
    } catch {
      return { skipped: "parse_error" };
    }
  });

export async function fetchRecentJournalServer(
  supabase: { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Array<{ kind: string; content: string }> | null }> } } } } },
  executive: ExecutiveId, n = 8,
): Promise<string> {
  const { data } = await supabase.from("executive_journal")
    .select("kind,content")
    .eq("executive", executive)
    .order("created_at", { ascending: false })
    .limit(n);
  if (!data || data.length === 0) return "";
  const lines = data.reverse().map((r) => `- (${r.kind}) ${r.content}`).join("\n");
  return `\n\nWHAT YOU HAVE LEARNED FROM THIS OPERATOR SO FAR (your growth journal — newest last):\n${lines}`;
}
