// Workflow planner: opportunity → task graph across executive agents.
// Small, deterministic decomposition; AI is used only for the brief of
// each task, not for the graph shape (keeps cost predictable).
//
// Phase 6 — Planner Intelligence Pass:
// each planned task carries an explainable `reason` string derived from
// operational trust metrics, provider availability, active interventions,
// and learned-pattern signals. Publish / render / high-risk / cross-account
// steps stay sequential-only via `requires_approval` — no auto-parallel
// duplicate external actions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExecutiveId } from "@/lib/executives";

interface PlannedTask {
  agent: ExecutiveId;
  task_kind: string;
  input: Record<string, unknown>;
  depends_on_idx: number[];
  requires_approval: boolean;
  risk_level: "low" | "moderate" | "high" | "critical";
  estimated_time_ms: number;
  estimated_cost_cents: number;
  reason?: string;
}

// Category → task graph template. Every step names an agent + capability.
// Publish/render steps are marked requires_approval so the operator gates them.
function planForCategory(category: string, title: string): PlannedTask[] {
  const base = { title };
  const brief = (agent: ExecutiveId, kind: string, prompt: string): PlannedTask => ({
    agent,
    task_kind: kind,
    input: { ...base, prompt, brief: prompt },
    depends_on_idx: [],
    requires_approval: false,
    risk_level: "low",
    estimated_time_ms: 20_000,
    estimated_cost_cents: 1,
  });

  switch (category) {
    case "shorts":
    case "youtube_video":
      return [
        brief("apex", "creative_hook", `Draft 5 hook options + 3 title candidates for: ${title}`),
        brief("apex", "caption_generation", `Draft captions & description for: ${title}`),
        { ...brief("katana", "render", `Render short-form video for: ${title}`), requires_approval: true, depends_on_idx: [0, 1] },
        { ...brief("katana", "publish", `Publish approved video: ${title}`), requires_approval: true, risk_level: "moderate", depends_on_idx: [2] },
      ];
    case "linkedin_posts":
      return [
        brief("apex", "creative_hook", `Draft LinkedIn post + 3 hook variants for: ${title}`),
        brief("iris", "strategic_review", `Review post for strategic alignment: ${title}`),
        { ...brief("katana", "publish", `Publish LinkedIn post: ${title}`), requires_approval: true, depends_on_idx: [1] },
      ];
    case "sops":
      return [
        brief("apex", "sop_draft", `Draft an SOP from: ${title}`),
        brief("sentinel", "compliance_review", `Review SOP for compliance/safety: ${title}`),
      ];
    case "course":
    case "training":
      return [
        brief("iris", "curriculum_outline", `Outline curriculum for: ${title}`),
        brief("apex", "module_content", `Draft module content for: ${title}`),
        brief("apex", "assessment_design", `Design assessments for: ${title}`),
      ];
    case "ebook":
      return [
        brief("iris", "book_outline", `Outline the ebook: ${title}`),
        brief("apex", "chapter_draft", `Draft chapters based on outline: ${title}`),
      ];
    default:
      return [
        brief("katana", "workflow_plan", `Decompose and plan execution for: ${title}`),
        brief("apex", "asset_draft", `Produce draft deliverable for: ${title}`),
        brief("sentinel", "quality_gate", `QA check before completion: ${title}`),
      ];
  }
}

export const planOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { opportunityId: string }) => ({
    opportunityId: z.string().uuid().parse(d.opportunityId),
  }))
  .handler(async ({ data, context }) => {
    const { data: opp, error: oErr } = await context.supabase
      .from("katana_opportunities")
      .select("*")
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!opp) throw new Error("Opportunity not found");

    const planned = planForCategory(opp.category, opp.title);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // --- Planner Intelligence Pass -----------------------------------------
    // Pull owner-scoped trust signals to build an explainable `reason` per task.
    const [{ data: kindHistory }, { data: healthRows }, { data: patterns }, { data: interventions }] = await Promise.all([
      supabaseAdmin
        .from("katana_agent_tasks")
        .select("task_kind, status")
        .eq("user_id", context.userId)
        .in("status", ["completed", "completed_with_warnings", "failed", "blocked"])
        .limit(500),
      supabaseAdmin
        .from("sentinel_provider_health")
        .select("capability, availability, consecutive_failures")
        .eq("user_id", context.userId)
        .limit(200),
      supabaseAdmin
        .from("learned_patterns")
        .select("id, subject_key, confidence, usefulness, summary, executive_id, sensitivity")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .neq("sensitivity", "restricted")
        .limit(200),
      supabaseAdmin
        .from("katana_intervention_queue")
        .select("kind")
        .eq("user_id", context.userId)
        .eq("status", "open")
        .limit(200),
    ]);

    const trustByKind = new Map<string, { verified: number; failed: number; blocked: number }>();
    for (const r of kindHistory ?? []) {
      const b = trustByKind.get(r.task_kind) ?? { verified: 0, failed: 0, blocked: 0 };
      if (r.status === "completed" || r.status === "completed_with_warnings") b.verified++;
      else if (r.status === "failed") b.failed++;
      else if (r.status === "blocked") b.blocked++;
      trustByKind.set(r.task_kind, b);
    }
    const openInterventionKinds = new Set((interventions ?? []).map((i) => i.kind));
    const patternByKind = new Map<string, { id: string; confidence: number; usefulness: number; summary: string }>();
    for (const p of patterns ?? []) {
      if (!p.subject_key?.startsWith("task_kind:")) continue;
      const key = p.subject_key.slice("task_kind:".length);
      if (!patternByKind.has(key)) {
        patternByKind.set(key, {
          id: p.id,
          confidence: Number(p.confidence ?? 0.5),
          usefulness: Number(p.usefulness ?? 0),
          summary: p.summary,
        });
      }
    }
    // Applied-pattern trail — bump applied_count for patterns that materially
    // influenced planning. Fire-and-forget.
    const applyPromises: Promise<unknown>[] = [];
    const notePatternApplied = async (patternId: string, taskReason: string) => {
      const { notePatternApplied: fn } = await import("@/lib/memory/application.server");
      return fn({ patternId, surface: "planning", missionId: undefined, reason: taskReason });
    };

    // Ensure a mission exists so tasks group under it.
    let missionId: string | null = null;
    const priorityRank = (opp.priority_rank ?? 5) as number;
    const priorityLabel = priorityRank >= 20 ? "High" : priorityRank >= 8 ? "Medium" : "Low";
    const { data: mission } = await supabaseAdmin
      .from("missions")
      .insert({
        user_id: context.userId,
        title: opp.title.slice(0, 120),
        objective: (opp.rationale ?? opp.title).slice(0, 500),
        status: "Active",
        priority: priorityLabel,
        stage: "active",
        required_agents: ["katana", "apex"],
      })
      .select("id")
      .maybeSingle();
    missionId = mission?.id ?? null;

    // Insert tasks in dependency order so we can wire depends_on uuids.
    const idByIdx: Record<number, string> = {};
    for (let i = 0; i < planned.length; i++) {
      const p = planned[i];
      const dependIds = p.depends_on_idx.map((idx) => idByIdx[idx]).filter(Boolean);

      // Build explainable reason from Phase 3–5 signals.
      const bits: string[] = [];
      const hist = trustByKind.get(p.task_kind);
      if (hist) {
        const total = hist.verified + hist.failed + hist.blocked;
        if (total > 0) {
          bits.push(`history: verified=${hist.verified}/${total}, failed=${hist.failed}, blocked=${hist.blocked}`);
        }
      }
      const pat = patternByKind.get(p.task_kind);
      if (pat) {
        bits.push(`pattern(conf=${pat.confidence.toFixed(2)},useful=${pat.usefulness.toFixed(2)}): ${pat.summary.slice(0, 80)}`);
        applyPromises.push(notePatternApplied(pat.id, `planned:${p.task_kind}`));
      }
      const healthNote = (healthRows ?? [])
        .filter((h) => h.availability != null && Number(h.availability) < 0.7)
        .map((h) => `${h.capability}=${Number(h.availability).toFixed(2)}`)
        .slice(0, 2)
        .join(",");
      if (healthNote) bits.push(`degraded_providers:${healthNote}`);
      if (openInterventionKinds.has("capability_unavailable")) bits.push("open_capability_intervention");
      if (p.requires_approval) bits.push("sequential-only:operator-approval-required");
      if (dependIds.length) bits.push(`depends_on=${dependIds.length}`);

      const reason = bits.length
        ? `${p.agent}/${p.task_kind}: ${bits.join(" | ")}`
        : `${p.agent}/${p.task_kind}: baseline plan (no prior signal)`;

      const { data: inserted, error } = await supabaseAdmin
        .from("katana_agent_tasks")
        .insert({
          user_id: context.userId,
          mission_id: missionId,
          opportunity_id: opp.id,
          agent: p.agent,
          task_kind: p.task_kind,
          status: "queued", // runner promotes to ready when deps clear
          input: p.input as never,
          depends_on: dependIds,
          risk_level: p.risk_level,
          requires_approval: p.requires_approval,
          estimated_cost_cents: p.estimated_cost_cents,
          estimated_time_ms: p.estimated_time_ms,
          idempotency_key: `${opp.id}:${i}`,
          reason,
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (inserted) idByIdx[i] = inserted.id;
    }

    await supabaseAdmin
      .from("katana_opportunities")
      .update({ status: "planning" })
      .eq("id", opp.id);

    // Await pattern application bumps but don't fail planning on their error.
    await Promise.allSettled(applyPromises);

    return {
      mission_id: missionId,
      tasks: Object.values(idByIdx),
      count: Object.keys(idByIdx).length,
    };
  });
