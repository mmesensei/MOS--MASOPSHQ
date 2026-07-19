// Executive Awareness Engine — proactive observations across the four executives.
// Each executive scans the Operator's real workspace (missions, vault, SOPs,
// journal, activity) and generates prioritized observations without being asked.
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createHash } from "crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";

const execEnum = z.enum(["iris", "apex", "katana", "sentinel"]);

const TRIGGERS = [
  "hq_load", "office_load", "mission_created", "mission_stalled",
  "vault_harvested", "sop_created", "sop_updated",
  "automation_created", "automation_failed", "journal_event",
] as const;
type Trigger = typeof TRIGGERS[number];

// Executive-scoped charter for observation kinds.
const KINDS: Record<ExecutiveId, string[]> = {
  iris:     ["strategy", "growth", "knowledge_gap", "long_term_risk", "recommendation"],
  apex:     ["operations", "bottleneck", "mission_progress", "execution_risk", "resource"],
  katana:   ["tactical_win", "automation_opportunity", "sop_improvement", "repetition"],
  sentinel: ["security", "compliance", "sensitivity", "access", "threat"],
};

const RESPONSIBILITIES: Record<ExecutiveId, string> = {
  iris:     "Chief Executive Strategist. Notice strategic direction, growth opportunities, executive recommendations, knowledge gaps, and long-term risks.",
  apex:     "Chief Systems Architect. Notice operational health, process bottlenecks, mission progress, execution risks, and resource utilization.",
  katana:   "Chief Execution Officer. Notice fast tactical wins, automation opportunities, SOP improvements, and repetitive tasks.",
  sentinel: "Chief Security & Intelligence Officer. Notice security exposure, compliance gaps, sensitive information handling, access concerns, and operational threats.",
};

function hashObservation(userId: string, exec: ExecutiveId, headline: string) {
  return createHash("sha256")
    .update(`${userId}::${exec}::${headline.toLowerCase().trim().replace(/\s+/g, " ")}`)
    .digest("hex")
    .slice(0, 24);
}

// ---------- READ ----------

export const listObservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { executive?: ExecutiveId; limit?: number } = {}) => ({
    executive: d.executive ? execEnum.parse(d.executive) : undefined,
    limit: Math.min(Math.max(d.limit ?? 12, 1), 50),
  }))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("executive_observations")
      .select("*")
      .is("dismissed_at", null)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.executive) q = q.eq("executive", data.executive);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- DISMISS / ACK ----------

export const dismissObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("executive_observations")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acknowledgeObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("executive_observations")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- GENERATE ----------

// Throttle: don't re-scan the whole workspace more than once every 4 minutes
// per trigger — significant-event triggers bypass by passing force:true.
const SCAN_COOLDOWN_MS = 4 * 60_000;

export const generateObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trigger?: Trigger; force?: boolean; currentPage?: string } = {}) => ({
    trigger: (d.trigger && (TRIGGERS as readonly string[]).includes(d.trigger) ? d.trigger : "hq_load") as Trigger,
    force: !!d.force,
    currentPage: d.currentPage?.slice(0, 200) ?? null,
  }))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { skipped: "no_key" as const, inserted: 0 };

    // Cooldown check.
    if (!data.force) {
      const { data: recent } = await context.supabase
        .from("executive_observations")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (recent && recent[0]) {
        const age = Date.now() - new Date(recent[0].created_at).getTime();
        if (age < SCAN_COOLDOWN_MS) return { skipped: "cooldown" as const, inserted: 0 };
      }
    }

    // Gather workspace context (bounded).
    const [missionsRes, vaultRes, sopsRes, journalRes, activityRes, recentObsRes] = await Promise.all([
      context.supabase.from("missions").select("id,title,stage,status,priority,sponsor_executive,updated_at,objective,charter,risks,deliverables").order("updated_at", { ascending: false }).limit(20),
      context.supabase.from("vault_documents").select("id,name,executive_owner,knowledge_type,sensitivity,priority,status,knowledge_score,harvested_at").order("harvested_at", { ascending: false, nullsFirst: false }).limit(30),
      context.supabase.from("sops").select("id,title,category,summary,updated_at,tags").order("updated_at", { ascending: false }).limit(20),
      context.supabase.from("executive_journal").select("executive,kind,content,created_at").order("created_at", { ascending: false }).limit(20),
      context.supabase.from("mission_activity").select("mission_id,actor,event,detail,created_at").order("created_at", { ascending: false }).limit(20),
      context.supabase.from("executive_observations").select("executive,headline,created_at").order("created_at", { ascending: false }).limit(30),
    ]);

    const missions = missionsRes.data ?? [];
    const vault = vaultRes.data ?? [];
    const sops = sopsRes.data ?? [];
    const journal = journalRes.data ?? [];
    const activity = activityRes.data ?? [];
    const recentObs = recentObsRes.data ?? [];

    // Derived signals — cheap heuristics the model can lean on.
    const now = Date.now();
    const stalled = missions
      .filter((m) => !["completed", "archived"].includes(m.stage))
      .map((m) => ({ ...m, days_since_update: Math.round((now - new Date(m.updated_at).getTime()) / 86400000) }))
      .filter((m) => m.days_since_update >= 5);

    const vaultByOwner: Record<string, number> = {};
    let unownedSensitive = 0;
    let unclassified = 0;
    for (const d of vault) {
      const o = d.executive_owner ?? "unassigned";
      vaultByOwner[o] = (vaultByOwner[o] ?? 0) + 1;
      if (!d.executive_owner && (d.sensitivity === "high" || d.sensitivity === "confidential")) unownedSensitive++;
      if (!d.knowledge_type) unclassified++;
    }

    const workspace = {
      current_page: data.currentPage,
      trigger: data.trigger,
      missions_summary: {
        total: missions.length,
        by_stage: missions.reduce<Record<string, number>>((acc, m) => { acc[m.stage] = (acc[m.stage] ?? 0) + 1; return acc; }, {}),
        stalled: stalled.map((m) => ({ id: m.id, title: m.title, stage: m.stage, days_since_update: m.days_since_update })),
        active: missions.filter((m) => m.stage === "active").slice(0, 6).map((m) => ({ id: m.id, title: m.title, priority: m.priority, sponsor: m.sponsor_executive })),
      },
      vault_summary: {
        total: vault.length,
        by_owner: vaultByOwner,
        unowned_sensitive_count: unownedSensitive,
        unclassified_count: unclassified,
        recent: vault.slice(0, 8).map((d) => ({ name: d.name, owner: d.executive_owner, type: d.knowledge_type, sensitivity: d.sensitivity, score: d.knowledge_score })),
      },
      sops_summary: {
        total: sops.length,
        by_category: sops.reduce<Record<string, number>>((acc, s) => { acc[s.category] = (acc[s.category] ?? 0) + 1; return acc; }, {}),
        recent: sops.slice(0, 6).map((s) => ({ title: s.title, category: s.category, tags: s.tags })),
      },
      journal_recent: journal.slice(0, 12).map((j) => ({ executive: j.executive, kind: j.kind, content: j.content })),
      activity_recent: activity.slice(0, 12).map((a) => ({ event: a.event, actor: a.actor, detail: a.detail })),
      already_noticed: recentObs.map((o) => ({ executive: o.executive, headline: o.headline })),
    };

    // Refuse trivial scans — nothing to observe.
    if (missions.length === 0 && vault.length === 0 && sops.length === 0 && journal.length === 0) {
      return { skipped: "empty_workspace" as const, inserted: 0 };
    }

    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `You are the Executive Awareness Engine for the Mastermind Operations System.
Four executives — IRIS, APEX, KATANA, SENTINEL — are scanning the Operator's live workspace
and reporting proactive observations WITHOUT being prompted.

RULES:
- Every observation MUST cite specific evidence from the workspace payload.
- Do NOT invent data. If nothing meaningful exists for an executive, output an empty array for them.
- Do NOT repeat anything in "already_noticed" (compare by meaning, not exact wording).
- Skip generic AI-sounding observations. Speak like a senior executive noticing something specific.
- Each observation is short (headline <= 140 chars). Reasoning cites the evidence. Recommended action is one sentence.
- Score 1=info, 2=useful, 3=important, 4=high priority, 5=executive critical. Reserve 5 for true urgency.

EXECUTIVE RESPONSIBILITIES:
- IRIS: ${RESPONSIBILITIES.iris} Kinds: ${KINDS.iris.join(", ")}.
- APEX: ${RESPONSIBILITIES.apex} Kinds: ${KINDS.apex.join(", ")}.
- KATANA: ${RESPONSIBILITIES.katana} Kinds: ${KINDS.katana.join(", ")}.
- SENTINEL: ${RESPONSIBILITIES.sentinel} Kinds: ${KINDS.sentinel.join(", ")}.

WORKSPACE (JSON):
${JSON.stringify(workspace).slice(0, 12000)}

Return ONLY valid JSON in exactly this shape (no prose, no code fence):
{
  "observations": [
    {
      "executive": "iris" | "apex" | "katana" | "sentinel",
      "kind": "string (one of the executive's kinds above)",
      "headline": "string, <= 140 chars, specific",
      "reasoning": "string, cites specific evidence",
      "recommended_action": "string, one concrete next step",
      "score": 1 | 2 | 3 | 4 | 5,
      "evidence_refs": ["short strings pointing to items in the workspace"]
    }
  ]
}

Produce AT MOST 2 observations per executive, AT MOST 6 total. Only include executives with something specific to report.`;

    let parsed: { observations?: unknown[] } = {};
    try {
      const { text } = await generateText({ model: gateway(DEFAULT_MODEL), prompt });
      const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
      parsed = JSON.parse(clean);
    } catch {
      return { skipped: "model_error" as const, inserted: 0 };
    }

    const raw = Array.isArray(parsed.observations) ? parsed.observations : [];
    const validKinds = new Set(Object.values(KINDS).flat());
    type Row = {
      user_id: string; executive: string; kind: string; headline: string;
      reasoning: string | null; recommended_action: string | null;
      evidence: { refs: string[] }; score: number; hash: string; trigger: string;
    };
    const rows: Row[] = [];

    for (const o of raw.slice(0, 8)) {
      const obs = o as Record<string, unknown>;
      const executive = obs.executive as string;
      const headline = typeof obs.headline === "string" ? obs.headline.trim() : "";
      const kind = typeof obs.kind === "string" ? obs.kind.trim() : "";
      if (!execEnum.safeParse(executive).success) continue;
      if (!headline || headline.length < 8) continue;
      if (!validKinds.has(kind)) continue;
      const scoreRaw = Number(obs.score);
      const score = Number.isFinite(scoreRaw) ? Math.min(5, Math.max(1, Math.round(scoreRaw))) : 2;
      const reasoning = typeof obs.reasoning === "string" ? obs.reasoning.slice(0, 800) : null;
      const action = typeof obs.recommended_action === "string" ? obs.recommended_action.slice(0, 400) : null;
      const refs = Array.isArray(obs.evidence_refs) ? obs.evidence_refs.slice(0, 10).map(String) : [];
      rows.push({
        user_id: context.userId,
        executive: executive as ExecutiveId,
        kind,
        headline: headline.slice(0, 240),
        reasoning,
        recommended_action: action,
        evidence: { refs },
        score,
        hash: hashObservation(context.userId, executive as ExecutiveId, headline),
        trigger: data.trigger,
      });
    }

    if (rows.length === 0) return { skipped: "no_new" as const, inserted: 0 };

    // Upsert on hash — silently drop duplicates.
    const { data: inserted, error } = await context.supabase
      .from("executive_observations")
      .upsert(rows, { onConflict: "user_id,hash", ignoreDuplicates: true })
      .select("id");

    if (error) return { skipped: "db_error" as const, inserted: 0, error: error.message };
    return { ok: true as const, inserted: inserted?.length ?? 0 };
  });

// Silence unused-import warning when the file is imported for types only.
export type { ExecutiveId };
export const _executives = EXECUTIVES;
