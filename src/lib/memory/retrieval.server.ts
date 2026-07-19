// Bounded memory retrieval — server-only.
// Returns compact memory packets ranked by relevance, recency, confidence
// and usefulness. Respects sensitivity + ownership boundaries.

import type { ExecutiveId } from "@/lib/executives";

export interface RetrievalScope {
  userId: string;
  executiveId?: ExecutiveId | null;
  subjectKey?: string | null;
  missionId?: string | null;
  taskId?: string | null;
  subsystem?: string | null;
  topic?: string | null;
  limit?: number;      // hard cap enforced below
  includeRestricted?: boolean; // owner-only surfaces
}

export interface MemoryPacket {
  source: "pattern" | "event";
  id: string;
  summary: string;
  confidence: number;
  reason: string;                  // why selected
  evidence: string[];              // event ids
  recency_ts: string;
  executive_id: ExecutiveId | null;
  subject_key: string | null;
  pattern_type?: string | null;
  event_type?: string | null;
  outcome_class?: string | null;
}

const HARD_CAP = 8;

/**
 * Retrieve a bounded memory packet list. Never returns raw context blobs —
 * only summaries and light metadata. Caller injects into prompts sparingly.
 */
export async function retrieveMemoryPacket(scope: RetrievalScope): Promise<MemoryPacket[]> {
  const cap = Math.min(scope.limit ?? 5, HARD_CAP);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // --- Patterns ---
    let pq = supabaseAdmin
      .from("learned_patterns")
      .select("id, summary, confidence, usefulness, evidence_event_ids, last_observed_at, executive_id, subject_key, pattern_type, sensitivity, success_count, failure_count")
      .eq("user_id", scope.userId)
      .eq("status", "active")
      .order("last_observed_at", { ascending: false })
      .limit(cap * 2);
    if (scope.executiveId) pq = pq.eq("executive_id", scope.executiveId);
    if (scope.subjectKey) pq = pq.eq("subject_key", scope.subjectKey);
    if (!scope.includeRestricted) pq = pq.neq("sensitivity", "restricted");

    const { data: patterns } = await pq;

    // --- Recent high-signal events (as a fallback / complement) ---
    let eq = supabaseAdmin
      .from("operational_events")
      .select("id, summary, confidence, severity, created_at, executive_id, subsystem, event_type, outcome_class, sensitivity")
      .eq("user_id", scope.userId)
      .in("outcome_class", ["failure", "blocked", "override", "anomaly", "decision"])
      .order("created_at", { ascending: false })
      .limit(cap * 2);
    if (scope.executiveId) eq = eq.eq("executive_id", scope.executiveId);
    if (scope.subsystem) eq = eq.eq("subsystem", scope.subsystem);
    if (scope.missionId) eq = eq.eq("mission_id", scope.missionId);
    if (scope.taskId) eq = eq.eq("task_id", scope.taskId);
    if (!scope.includeRestricted) eq = eq.neq("sensitivity", "restricted");

    const { data: events } = await eq;

    const now = Date.now();
    type Pat = NonNullable<typeof patterns>[number];
    type Evt = NonNullable<typeof events>[number];

    const scoredPatterns: (MemoryPacket & { score: number })[] = (patterns ?? []).map((p: Pat) => {
      const ageDays = Math.max(1, (now - new Date(p.last_observed_at).getTime()) / 86_400_000);
      const recency = 1 / Math.log2(ageDays + 2);
      const conf = Number(p.confidence ?? 0);
      const useful = Number(p.usefulness ?? 0);
      const score = conf * 0.5 + recency * 0.3 + Math.max(0, useful) * 0.2;
      return {
        source: "pattern",
        id: p.id,
        summary: p.summary,
        confidence: conf,
        reason: `active pattern (obs ${(p.success_count ?? 0)}/${(p.failure_count ?? 0)+(p.success_count ?? 0)} success)`,
        evidence: ((p.evidence_event_ids as string[] | null) ?? []).slice(0, 5),
        recency_ts: p.last_observed_at,
        executive_id: p.executive_id as ExecutiveId | null,
        subject_key: p.subject_key,
        pattern_type: p.pattern_type,
        score,
      };
    });

    const scoredEvents: (MemoryPacket & { score: number })[] = (events ?? []).map((e: Evt) => {
      const ageDays = Math.max(1, (now - new Date(e.created_at).getTime()) / 86_400_000);
      const recency = 1 / Math.log2(ageDays + 2);
      const sev = Number(e.severity ?? 3) / 5;
      const conf = Number(e.confidence ?? 0.5);
      const score = recency * 0.5 + sev * 0.3 + conf * 0.2;
      return {
        source: "event",
        id: e.id,
        summary: e.summary,
        confidence: conf,
        reason: `${e.outcome_class} in ${e.subsystem}`,
        evidence: [e.id],
        recency_ts: e.created_at,
        executive_id: e.executive_id as ExecutiveId | null,
        subject_key: null,
        event_type: e.event_type,
        outcome_class: e.outcome_class,
        score,
      };
    });

    const merged = [...scoredPatterns, ...scoredEvents]
      .sort((a, b) => b.score - a.score)
      .slice(0, cap)
      .map(({ score: _score, ...rest }) => rest as MemoryPacket);

    return merged;
  } catch (err) {
    console.warn("[memory.retrieval] threw:", err instanceof Error ? err.message : err);
    return [];
  }
}
