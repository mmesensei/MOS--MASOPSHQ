// KATANA V1 — Chief Execution Officer server functions.
// Asset library ingestion, opportunity discovery (Revenue Board), and
// mission handoff with the User Agreement gate.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { EXECUTIVES } from "@/lib/executives";
import { EXECUTIVE_CHARTER } from "@/lib/charter";

const CATEGORY_ENUM = z.enum([
  "shorts",
  "course",
  "linkedin_posts",
  "sops",
  "youtube_video",
  "ebook",
  "digital_product",
  "consulting_package",
  "automation",
  "marketing_campaign",
  "training",
]);

export const KATANA_CATEGORIES: Record<z.infer<typeof CATEGORY_ENUM>, { label: string; icon: string }> = {
  shorts: { label: "Shorts waiting", icon: "🔥" },
  course: { label: "Course ideas", icon: "💰" },
  linkedin_posts: { label: "LinkedIn posts", icon: "📈" },
  sops: { label: "SOPs to formalize", icon: "🎓" },
  youtube_video: { label: "YouTube videos", icon: "🎥" },
  ebook: { label: "eBooks / guides", icon: "📚" },
  digital_product: { label: "Digital products", icon: "📦" },
  consulting_package: { label: "Consulting packages", icon: "🤝" },
  automation: { label: "Automation candidates", icon: "🛠" },
  marketing_campaign: { label: "Marketing campaigns", icon: "📣" },
  training: { label: "Training programs", icon: "🎯" },
};

// ============ Asset ingestion (metadata only, non-destructive) ============

function kindFromMime(mime: string | null | undefined, name: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.includes("pdf") || m.includes("word") || m.includes("presentation") || m.includes("spreadsheet"))
    return "doc";
  if (m.startsWith("text/") || m.includes("json") || m.includes("xml")) return "text";
  if (/\.(mp4|mov|mkv|webm|avi)$/i.test(name)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name)) return "image";
  if (/\.(mp3|wav|m4a|aac|flac)$/i.test(name)) return "audio";
  if (/\.(pdf|docx?|pptx?|xlsx?)$/i.test(name)) return "doc";
  if (/\.(txt|md|csv|json|xml|html?)$/i.test(name)) return "text";
  return "other";
}

export const scanConnectedSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let discovered = 0;

    // 1) Existing vault_documents (Drive/OneDrive metadata already harvested)
    const { data: vault } = await context.supabase
      .from("vault_documents")
      .select("id, source, remote_id, name, mime_type, size_bytes, path, snippet")
      .limit(500);
    if (vault && vault.length) {
      const rows = vault.map((v) => ({
        user_id: context.userId,
        source: (v.source === "google_drive" || v.source === "onedrive") ? v.source : "vault",
        source_ref: v.remote_id ?? v.id,
        kind: kindFromMime(v.mime_type, v.name),
        title: v.name,
        mime: v.mime_type,
        size_bytes: v.size_bytes,
        extracted_text: v.snippet ?? null,
        metadata: { path: v.path } as never,
      }));
      const { error, count } = await supabaseAdmin
        .from("katana_assets")
        .upsert(rows, { onConflict: "user_id,source,source_ref", ignoreDuplicates: true, count: "exact" });
      if (!error) discovered += count ?? rows.length;
    }

    // 2) SOPs
    const { data: sops } = await context.supabase.from("sops").select("id, title, summary, category, tags").limit(200);
    if (sops && sops.length) {
      const rows = sops.map((s) => ({
        user_id: context.userId,
        source: "sop" as const,
        source_ref: s.id,
        kind: "text",
        title: s.title,
        extracted_text: s.summary ?? null,
        categories: s.category ? [s.category] : [],
        tags: (s.tags as string[] | null) ?? [],
      }));
      const { error } = await supabaseAdmin
        .from("katana_assets")
        .upsert(rows, { onConflict: "user_id,source,source_ref", ignoreDuplicates: true });
      if (!error) discovered += rows.length;
    }

    // 3) Missions
    const { data: missions } = await context.supabase
      .from("missions")
      .select("id, title, objective, charter")
      .limit(200);
    if (missions && missions.length) {
      const rows = missions.map((m) => ({
        user_id: context.userId,
        source: "mission" as const,
        source_ref: m.id,
        kind: "text",
        title: m.title,
        extracted_text: m.objective ?? null,
      }));
      const { error } = await supabaseAdmin
        .from("katana_assets")
        .upsert(rows, { onConflict: "user_id,source,source_ref", ignoreDuplicates: true });
      if (!error) discovered += rows.length;
    }

    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: "katana.scan",
      entity_type: "katana_assets",
      executive: "katana",
      metadata: { discovered } as never,
    });

    return { discovered };
  });

export const listAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("katana_assets")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============ Opportunity discovery (Revenue Board) ============

const OpportunitySchema = z.object({
  category: CATEGORY_ENUM,
  title: z.string().min(3).max(200),
  rationale: z.string().min(10).max(1200),
  estimated_value_band: z.enum(["S", "M", "L", "XL"]).default("M"),
  effort_band: z.enum(["S", "M", "L", "XL"]).default("M"),
  source_asset_ids: z.array(z.string().uuid()).default([]),
  opportunity_type: z.string().max(80).optional(),
  business_category: z.string().max(80).optional(),
  revenue_category: z.string().max(80).optional(),
  estimated_value_cents: z.number().int().nonnegative().max(1_000_000_000).optional(),
  estimated_time_minutes: z.number().int().nonnegative().max(100_000).optional(),
  estimated_roi: z.number().min(0).max(1000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  complexity: z.enum(["trivial", "low", "medium", "high", "extreme"]).optional(),
  automation_readiness: z.enum(["manual", "assisted", "semi_auto", "auto"]).optional(),
  required_agents: z.array(z.enum(["katana", "apex", "iris", "sentinel"])).optional(),
  deliverables: z.array(z.string().max(200)).max(20).optional(),
  recommended_mission: z.object({
    objective: z.string(),
    deliverables: z.array(z.string()).default([]),
    next_actions: z.array(z.string()).default([]),
    delegate_to: z.enum(["katana", "apex", "iris", "sentinel"]).default("katana"),
  }),
  four_questions: z.object({
    reduces_manual_work: z.boolean(),
    increases_asset_value: z.boolean(),
    preserves_knowledge: z.boolean(),
    strengthens_masops: z.boolean(),
  }),
});

const VALUE_WEIGHT = { S: 1, M: 3, L: 6, XL: 10 } as const;
const EFFORT_WEIGHT = { S: 1, M: 2, L: 4, XL: 7 } as const;

function computePriority(o: z.infer<typeof OpportunitySchema>): number {
  const v = VALUE_WEIGHT[o.estimated_value_band];
  const e = EFFORT_WEIGHT[o.effort_band];
  const gate = Object.values(o.four_questions).filter(Boolean).length;
  const conf = o.confidence ?? 0.6;
  return Math.round(((v / e) * 10 + gate * 4) * conf * 5);
}

export const evaluate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Rate-limit via existing engine quota
    const { error: quotaErr } = await context.supabase.rpc("enforce_engine_quota", {
      _action: "katana.evaluate",
      _per_hour: 5,
      _per_day: 20,
      _metadata: {} as never,
    });
    if (quotaErr) throw new Error(quotaErr.message);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: assets } = await context.supabase
      .from("katana_assets")
      .select("id, kind, title, extracted_text, tags, categories, source")
      .order("updated_at", { ascending: false })
      .limit(80);

    if (!assets || assets.length === 0) {
      return { discovered: 0, message: "No assets scanned yet. Run 'Scan sources' first." };
    }

    const material = assets
      .map((a) => `- [${a.kind}|${a.source}|${a.id}] ${a.title}${a.extracted_text ? ` — ${a.extracted_text.slice(0, 300)}` : ""}`)
      .join("\n");

    const { KATANA_CXO_RUBRIC } = await import("@/lib/doctrine/katana-cxo-rubric.server");
    const { privateDoctrineFor } = await import("@/lib/doctrine/private-doctrine.server");
    const { getExecutiveSystemPrompt } = await import("@/lib/executives-prompts.server");
    const privateDoc = privateDoctrineFor("katana") ?? "";

    const system = `${EXECUTIVE_CHARTER}\n\n${getExecutiveSystemPrompt("katana")}\n\n${KATANA_CXO_RUBRIC}${privateDoc}`;

    const prompt = `Review the Operator's assets below. Apply the Ten Questions to each, then produce 4-10 HIGH-LEVERAGE opportunities that maximize the value of what the Operator already owns.

ASSETS (id | kind | source):
${material.slice(0, 8000)}

Rules:
- Each opportunity must reference 1+ source_asset_ids from the list above (use the UUID shown in [brackets]).
- Group by category. Prefer diverse categories over 10 identical shorts.
- V1 does NOT publish, upload, spend, or contact external services. Deliverables are drafts, outlines, or scheduled mission work.
- Every opportunity must pass the Four Questions gate (at least one true).

Return ONLY a JSON array (no markdown, no prose) matching this shape:
[{
  "category": "shorts|course|linkedin_posts|sops|youtube_video|ebook|digital_product|consulting_package|automation|marketing_campaign|training",
  "title": "punchy title",
  "rationale": "why this multiplies value of the source assets",
  "estimated_value_band": "S|M|L|XL",
  "effort_band": "S|M|L|XL",
  "source_asset_ids": ["<uuid from above>"],
  "opportunity_type": "e.g. content_repurpose, productization, sop_formalization, campaign, training",
  "business_category": "e.g. marketing, education, consulting, operations, product",
  "revenue_category": "direct_sale|ads|subscription|lead_gen|consulting|brand|internal_efficiency",
  "estimated_value_cents": 0,
  "estimated_time_minutes": 0,
  "estimated_roi": 0.0,
  "confidence": 0.0,
  "complexity": "trivial|low|medium|high|extreme",
  "automation_readiness": "manual|assisted|semi_auto|auto",
  "required_agents": ["katana","apex","iris","sentinel"],
  "deliverables": ["deliverable 1", "..."],
  "recommended_mission": {
    "objective": "one-sentence mission objective",
    "deliverables": ["deliverable 1", "..."],
    "next_actions": ["first action", "..."],
    "delegate_to": "katana|apex|iris|sentinel"
  },
  "four_questions": {
    "reduces_manual_work": true|false,
    "increases_asset_value": true|false,
    "preserves_knowledge": true|false,
    "strengthens_masops": true|false
  }
}]

For every asset also consider transformations into: YouTube videos, Shorts, TikTok, Instagram Reels, Facebook, LinkedIn, SOPs, training courses, internal docs, executive reports, marketing campaigns, presentations, case studies, digital downloads, consulting assets, email campaigns, knowledge-base articles. Never ask "what file is this?" — ask "what business value can this become?"`;

    const gateway = createLovableAiGatewayProvider(key);
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
    const arr = z.array(OpportunitySchema).min(1).max(15).parse(parsed);
    // Filter: must pass Four Questions gate
    const filtered = arr.filter((o) =>
      Object.values(o.four_questions).some((v) => v === true),
    );

    const assetIdSet = new Set(assets.map((a) => a.id));
    const enriched = filtered.map((o) => {
      const required = new Set(o.required_agents ?? []);
      required.add(o.recommended_mission.delegate_to);
      return { o, priority: computePriority(o), required: Array.from(required) };
    });
    enriched.sort((a, b) => b.priority - a.priority);

    const rows = enriched.map(({ o, priority, required }) => ({
      user_id: context.userId,
      category: o.category,
      title: o.title.slice(0, 200),
      rationale: o.rationale.slice(0, 1200),
      estimated_value_band: o.estimated_value_band,
      effort_band: o.effort_band,
      source_asset_ids: o.source_asset_ids.filter((id) => assetIdSet.has(id)),
      recommended_mission: o.recommended_mission as never,
      four_questions: o.four_questions as never,
      status: "open" as const,
      opportunity_type: o.opportunity_type ?? null,
      business_category: o.business_category ?? null,
      revenue_category: o.revenue_category ?? null,
      estimated_value_cents: o.estimated_value_cents ?? null,
      estimated_time_minutes: o.estimated_time_minutes ?? null,
      estimated_roi: o.estimated_roi ?? null,
      confidence: o.confidence ?? null,
      complexity: o.complexity ?? null,
      automation_readiness: o.automation_readiness ?? null,
      required_agents: required,
      deliverables: (o.deliverables ?? o.recommended_mission.deliverables) as never,
      priority_rank: priority,
      automation_ready: (o.automation_readiness ?? "manual") === "auto",
    }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin.from("katana_opportunities").insert(rows).select();
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: "katana.evaluate",
      entity_type: "katana_opportunities",
      executive: "katana",
      metadata: { discovered: rows.length } as never,
    });

    return { discovered: rows.length, opportunities: inserted };
  });

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("katana_opportunities")
      .select("*")
      .order("priority_rank", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const dismissOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("katana_opportunities")
      .update({ status: "dismissed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      user_id: context.userId, action: "katana.opportunity.dismissed",
      entity_type: "katana_opportunity", entity_id: data.id, executive: "katana",
    });
    return { ok: true };
  });

// ============ Accept opportunity → mission + User Agreement gate ============

const AgreementSchema = z.object({
  opportunityId: z.string().uuid(),
  ownershipConfirmed: z.literal(true),
  approvalScope: z.enum(["once", "always"]),
});

function workflowSignature(category: string, delegateTo: string): string {
  return `katana:${category}:${delegateTo}`;
}

export const previewExecutionAgreement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { data: opp, error } = await context.supabase
      .from("katana_opportunities")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!opp) throw new Error("Opportunity not found");

    const assetIds = (opp.source_asset_ids as string[]) ?? [];
    const { data: assets } = assetIds.length
      ? await context.supabase.from("katana_assets").select("id, title, source, kind").in("id", assetIds)
      : { data: [] as Array<{ id: string; title: string; source: string; kind: string }> };

    const mission = (opp.recommended_mission ?? {}) as {
      objective?: string;
      deliverables?: string[];
      delegate_to?: string;
    };

    const sig = workflowSignature(opp.category, mission.delegate_to ?? "katana");
    const { data: trusted } = await context.supabase
      .from("katana_trusted_workflows")
      .select("id")
      .eq("workflow_signature", sig)
      .maybeSingle();

    return {
      opportunity: opp,
      assets: assets ?? [],
      ai_services: [`Lovable AI Gateway · ${DEFAULT_MODEL}`],
      deliverables: mission.deliverables ?? [],
      publishing_included: false,
      estimated_tokens: 4000,
      delegate_to: mission.delegate_to ?? "katana",
      workflow_signature: sig,
      already_trusted: !!trusted,
    };
  });

export const acceptOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AgreementSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: opp, error: oErr } = await context.supabase
      .from("katana_opportunities")
      .select("*")
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!opp) throw new Error("Opportunity not found");
    if (opp.status !== "open") throw new Error("Opportunity is not open");

    const mission = (opp.recommended_mission ?? {}) as {
      objective?: string;
      deliverables?: string[];
      next_actions?: string[];
      delegate_to?: string;
    };

    const oppAny = opp as unknown as {
      required_agents?: string[] | null;
      estimated_time_minutes?: number | null;
      estimated_roi?: number | null;
      priority_rank?: number | null;
      deliverables?: unknown;
      business_category?: string | null;
    };
    const requiredAgents = Array.from(
      new Set([...(oppAny.required_agents ?? []), mission.delegate_to ?? "katana"]),
    );

    // Sentinel risk classification + idempotency key computed server-side.
    const { classifyRisk, idempotencyKey } = await import("@/lib/katana/sentinel.functions");
    const risk = classifyRisk({
      publishing: false,
      external_services: ["lovable_ai_gateway"],
      spending_cents: 0,
      deletes_or_overwrites: false,
      sensitive_data: false,
      reversible: true,
      connected_systems: (oppAny.required_agents ?? []).length,
      confidence: (opp as unknown as { confidence?: number }).confidence ?? 0.7,
    });
    const missionIdemKey = idempotencyKey([
      context.userId, "mission", opp.id, opp.category, mission.delegate_to ?? "katana",
    ]);

    // Prevent duplicate mission creation for the same opportunity.
    const { data: dup } = await context.supabase
      .from("missions").select("id").eq("idempotency_key", missionIdemKey).maybeSingle();
    if (dup) {
      return { ok: true, missionId: (dup as { id: string }).id, duplicate: true };
    }

    const { data: newMission, error: mErr } = await context.supabase
      .from("missions")
      .insert({
        user_id: context.userId,
        title: opp.title,
        objective: mission.objective ?? opp.rationale,
        stage: "chartered",
        charter: {
          origin: "katana_opportunity",
          opportunity_id: opp.id,
          category: opp.category,
          rationale: opp.rationale,
          delegate_to: mission.delegate_to ?? "katana",
          next_actions: mission.next_actions ?? [],
          four_questions: opp.four_questions,
          publishing_included: false,
          risk_reasons: risk.reasons,
        } as never,
        deliverables: (mission.deliverables ?? []) as never,
        business_goal: oppAny.business_category ?? null,
        success_metrics: (mission.deliverables ?? []) as never,
        execution_path: (mission.next_actions ?? []) as never,
        risks: risk.reasons as never,
        completion_criteria: (mission.deliverables ?? []) as never,
        priority: Math.min(5, Math.max(1, Math.round(((oppAny.priority_rank ?? 30) / 100) * 5) || 3)),
        estimated_roi: oppAny.estimated_roi ?? null,
        estimated_completion_minutes: oppAny.estimated_time_minutes ?? null,
        required_agents: requiredAgents,
        risk_level: risk.level,
        approval_scope: data.approvalScope,
        idempotency_key: missionIdemKey,
      } as never)
      .select()
      .single();
    if (mErr) throw new Error(mErr.message);

    await context.supabase
      .from("katana_opportunities")
      .update({ status: "accepted", mission_id: newMission.id })
      .eq("id", opp.id);

    // Speed Hand-Off: fan out parallel agent tasks with per-task idempotency + risk.
    const AGENT_TASKS: Record<string, string> = {
      apex: "creative_analysis",
      iris: "executive_prioritization",
      sentinel: "security_validation",
      katana: "assemble_deliverables",
    };
    // Critical-risk actions never auto-run; high-risk sits in pending review.
    const initialStatus: string =
      risk.level === "critical" ? "waiting_on_operator"
      : risk.level === "high" ? "pending_security_review"
      : "queued";

    const tasks = requiredAgents.map((agent) => ({
      user_id: context.userId,
      mission_id: newMission.id,
      opportunity_id: opp.id,
      agent,
      task_kind: AGENT_TASKS[agent] ?? "coordinate",
      status: initialStatus,
      risk_level: risk.level,
      idempotency_key: idempotencyKey([context.userId, "task", newMission.id, agent, AGENT_TASKS[agent] ?? "coordinate"]),
      input: {
        opportunity_title: opp.title,
        objective: mission.objective ?? null,
        deliverables: mission.deliverables ?? [],
        category: opp.category,
      } as never,
    }));
    if (tasks.length) {
      await context.supabase.from("katana_agent_tasks").insert(tasks as never);
    }

    // Sentinel event + intervention when the operator must confirm at execution.
    await context.supabase.from("katana_security_events").insert({
      user_id: context.userId,
      mission_id: newMission.id,
      stage: "mission_accepted",
      action: "accept_opportunity",
      decision: risk.level === "critical" ? "escalate" : risk.level === "high" ? "allow_with_confirmation" : "allow",
      risk_level: risk.level,
      severity: risk.level === "critical" ? "critical" : risk.level === "high" ? "high" : "info",
      rationale: risk.reasons.join(", ") || "baseline risk",
      metadata: { opportunity_id: opp.id, score: risk.score } as never,
    } as never);

    if (risk.level === "high" || risk.level === "critical") {
      await context.supabase.from("katana_intervention_queue").insert({
        user_id: context.userId,
        mission_id: newMission.id,
        kind: "risk_confirmation",
        title: `Confirm ${risk.level}-risk mission: ${opp.title}`,
        reason: `Sentinel classified this mission as ${risk.level} risk (${risk.reasons.join(", ") || "policy"}). Confirm before KATANA runs any task.`,
        risk_level: risk.level,
        recommended_action: risk.level === "critical" ? "Review scope before authorizing" : "Confirm to release tasks",
        options: [
          { id: "approve", label: "Approve and release" },
          { id: "reject", label: "Reject mission" },
          { id: "pause", label: "Pause for review" },
        ] as never,
      } as never);
    }

    if (data.approvalScope === "always" && risk.level !== "critical") {
      const sig = workflowSignature(opp.category, mission.delegate_to ?? "katana");
      await context.supabase.from("katana_trusted_workflows").upsert(
        { user_id: context.userId, workflow_signature: sig, scope: { category: opp.category, risk: risk.level } as never },
        { onConflict: "user_id,workflow_signature" },
      );
    }

    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: "katana.opportunity.accepted",
      entity_type: "mission",
      entity_id: newMission.id,
      executive: "katana",
      metadata: { opportunity_id: opp.id, approval_scope: data.approvalScope, risk: risk.level } as never,
    });

    return { ok: true, missionId: newMission.id, risk: risk.level };
  });

