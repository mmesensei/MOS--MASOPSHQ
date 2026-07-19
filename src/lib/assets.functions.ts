// KATANA Asset Factory — server functions for asset discovery, scoring, approval.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { EXECUTIVES } from "@/lib/executives";
import { EXECUTIVE_CHARTER } from "@/lib/charter";

const ASSET_TYPES = [
  "sop_library", "template", "framework", "playbook", "training_program",
  "certification", "assessment", "knowledge_base", "digital_product",
  "consulting_package", "membership", "micro_course", "full_course",
  "automation_package", "toolkit", "operational_system", "industry_program",
  "ai_workforce_template", "licensing_package", "subscription_asset",
] as const;

const STATUSES = ["opportunity", "reviewing", "approved", "in_build", "launched", "archived", "rejected"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

export const listAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("assets").select("*").order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getAsset = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("assets").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateAssetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => ({
    id: z.string().uuid().parse(d.id),
    status: z.enum(STATUSES).parse(d.status),
  }))
  .handler(async ({ data, context }) => {
    const patch = data.status === "approved"
      ? { status: data.status, approved_at: new Date().toISOString() }
      : { status: data.status };
    const { error } = await context.supabase.from("assets").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createAssetManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string; asset_type: string; description?: string; purpose?: string;
    target_audience?: string; priority?: string; revenue_model?: string;
  }) => ({
    name: z.string().min(3).max(200).parse(d.name),
    asset_type: z.enum(ASSET_TYPES).parse(d.asset_type),
    description: d.description?.slice(0, 2000) || null,
    purpose: d.purpose?.slice(0, 1000) || null,
    target_audience: d.target_audience?.slice(0, 500) || null,
    priority: d.priority ? z.enum(PRIORITIES).parse(d.priority) : "Medium",
    revenue_model: d.revenue_model?.slice(0, 500) || null,
  }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("assets")
      .insert({ user_id: context.userId, proposed_by: "operator", ...data })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============ KATANA DISCOVERY ENGINE ============

const OpportunitySchema = z.object({
  name: z.string(),
  asset_type: z.enum(ASSET_TYPES),
  description: z.string(),
  purpose: z.string(),
  target_audience: z.string(),
  priority: z.enum(PRIORITIES),
  revenue_model: z.string(),
  automation_notes: z.string(),
  source_type: z.string().optional(),
  source_id: z.string().uuid().optional().nullable(),
  scorecard: z.object({
    strategic_value: z.number().min(1).max(10),
    business_value: z.number().min(1).max(10),
    revenue_potential: z.number().min(1).max(10),
    complexity: z.number().min(1).max(10),
    risk: z.number().min(1).max(10),
    scalability: z.number().min(1).max(10),
    automation_readiness: z.number().min(1).max(10),
    time_to_launch: z.number().min(1).max(10),
    institutional_value: z.number().min(1).max(10),
  }),
});

export const discoverAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Pull raw material: missions, SOPs, journal.
    const [{ data: missions }, { data: sops }, { data: journal }] = await Promise.all([
      context.supabase.from("missions").select("id,title,objective,stage,charter,deliverables").limit(30),
      context.supabase.from("sops").select("id,title,summary,category,tags").limit(50),
      context.supabase.from("executive_journal").select("kind,content").order("created_at", { ascending: false }).limit(30),
    ]);

    const material = [
      "MISSIONS:", ...(missions ?? []).map((m) => `- [${m.stage}] ${m.title}: ${m.objective ?? ""}`).slice(0, 20),
      "\nSOPs:", ...(sops ?? []).map((s) => `- [${s.category}] ${s.title}: ${s.summary ?? ""}`).slice(0, 30),
      "\nJOURNAL:", ...(journal ?? []).map((j) => `- (${j.kind}) ${j.content}`).slice(0, 20),
    ].join("\n");

    const gateway = createLovableAiGatewayProvider(key);
    const { getExecutiveSystemPrompt } = await import("@/lib/executives-prompts.server");
    const system = `${EXECUTIVE_CHARTER}\n\n${getExecutiveSystemPrompt("katana")}\n\nYou are KATANA in Asset Factory mode. Your job: convert unused knowledge into scalable assets. Nothing valuable remains unused. Nothing repeatable remains manual. Nothing scalable remains small.`;

    const prompt = `Review the Operator's institutional material below. Identify 3-6 HIGH-LEVERAGE asset opportunities that are not already assets. Bias toward: productizing consulting, turning frameworks into training/certification, turning SOPs into templates or automation packages, and recurring-revenue plays.

MATERIAL:
${material.slice(0, 6000)}

Return ONLY a JSON array (no markdown, no prose) of opportunities in this exact shape:
[{
  "name": "short punchy asset name",
  "asset_type": "one of: sop_library|template|framework|playbook|training_program|certification|assessment|knowledge_base|digital_product|consulting_package|membership|micro_course|full_course|automation_package|toolkit|operational_system|industry_program|ai_workforce_template|licensing_package|subscription_asset",
  "description": "2-3 sentence description of the asset",
  "purpose": "why this exists / problem it solves",
  "target_audience": "who buys or uses this",
  "priority": "Low|Medium|High|Critical",
  "revenue_model": "consulting|training|certification|membership|licensing|subscription|template|digital_product|service|recurring — pick one and explain in one line",
  "automation_notes": "one line on how much of delivery can be automated or templatized",
  "scorecard": {
    "strategic_value": 1-10,
    "business_value": 1-10,
    "revenue_potential": 1-10,
    "complexity": 1-10,
    "risk": 1-10,
    "scalability": 1-10,
    "automation_readiness": 1-10,
    "time_to_launch": 1-10,
    "institutional_value": 1-10
  }
}]`;

    const { text } = await generateText({
      model: gateway(DEFAULT_MODEL),
      system,
      prompt,
    });

    let parsed: unknown;
    try {
      const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("KATANA returned malformed output. Try again.");
    }
    const arr = z.array(OpportunitySchema).min(1).max(10).parse(parsed);

    const rows = arr.map((o) => ({
      user_id: context.userId,
      name: o.name.slice(0, 200),
      asset_type: o.asset_type,
      description: o.description.slice(0, 2000),
      purpose: o.purpose.slice(0, 1000),
      target_audience: o.target_audience.slice(0, 500),
      priority: o.priority,
      revenue_model: o.revenue_model.slice(0, 500),
      automation_notes: o.automation_notes.slice(0, 500),
      scorecard: o.scorecard,
      status: "opportunity" as const,
      proposed_by: "katana",
    }));

    const { data: inserted, error } = await context.supabase.from("assets").insert(rows).select();
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      user_id: context.userId, action: "assets.discovered",
      entity_type: "asset", executive: "katana",
      metadata: { count: rows.length },
    });

    return { discovered: rows.length, assets: inserted };
  });

export const ASSET_TYPE_LABELS: Record<string, string> = {
  sop_library: "SOP Library", template: "Template", framework: "Framework",
  playbook: "Playbook", training_program: "Training Program", certification: "Certification",
  assessment: "Assessment", knowledge_base: "Knowledge Base", digital_product: "Digital Product",
  consulting_package: "Consulting Package", membership: "Membership",
  micro_course: "Micro Course", full_course: "Full Course",
  automation_package: "Automation Package", toolkit: "Toolkit",
  operational_system: "Operational System", industry_program: "Industry Program",
  ai_workforce_template: "AI Workforce Template", licensing_package: "Licensing Package",
  subscription_asset: "Subscription Asset",
};
