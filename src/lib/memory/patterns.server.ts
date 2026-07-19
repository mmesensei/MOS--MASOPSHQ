// Learned Patterns writer — server-only.
// Compact reusable learnings. Never treated as permanent truth; revisable,
// confidence-weighted, and replaceable when contradicted by new evidence.

import type { ExecutiveId } from "@/lib/executives";
import type { Sensitivity } from "./events.server";

export type PatternStatus = "active" | "superseded" | "rejected" | "draft";

export interface UpsertPatternInput {
  userId: string;
  executiveId?: ExecutiveId | null;
  subjectKey: string;
  patternType: string;
  summary: string;
  detail?: Record<string, unknown>;
  evidenceEventIds?: string[];
  /** signed delta applied to success/failure counts on this call */
  outcomeDelta?: "success" | "failure" | "neutral";
  /** raw confidence signal from this observation, 0..1 */
  observationConfidence?: number;
  sensitivity?: Sensitivity;
}

/**
 * Upsert a learned pattern. Aggregates counts and blends confidence with
 * an EWMA rather than overwriting. Returns pattern id, or null on failure.
 *
 * Uniqueness is enforced by the partial unique index
 * (user_id, executive_id, subject_key, pattern_type) WHERE status='active'.
 */
export async function upsertLearnedPattern(input: UpsertPatternInput): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find current active pattern (if any) for this scope.
    const q = supabaseAdmin
      .from("learned_patterns")
      .select("id, confidence, success_count, failure_count, evidence_event_ids, detail, version")
      .eq("user_id", input.userId)
      .eq("subject_key", input.subjectKey)
      .eq("pattern_type", input.patternType)
      .eq("status", "active");
    if (input.executiveId) q.eq("executive_id", input.executiveId);
    else q.is("executive_id", null);
    const { data: existing } = await q.maybeSingle();

    const obs = Math.max(0, Math.min(1, input.observationConfidence ?? 0.5));

    if (!existing) {
      const row = {
        user_id: input.userId,
        executive_id: input.executiveId ?? null,
        subject_key: input.subjectKey,
        pattern_type: input.patternType,
        summary: input.summary.slice(0, 800),
        detail: input.detail ?? {},
        evidence_event_ids: (input.evidenceEventIds ?? []).slice(0, 20),
        confidence: obs,
        success_count: input.outcomeDelta === "success" ? 1 : 0,
        failure_count: input.outcomeDelta === "failure" ? 1 : 0,
        sensitivity: input.sensitivity ?? "internal",
        last_observed_at: new Date().toISOString(),
      };
      const { data, error } = await supabaseAdmin
        .from("learned_patterns")
        .insert(row as never)
        .select("id")
        .maybeSingle();
      if (error) {
        console.warn("[memory.patterns] insert failed:", error.message);
        return null;
      }
      return (data as { id: string } | null)?.id ?? null;
    }

    // EWMA blend: 0.7 old + 0.3 observation.
    const prevConf = Number(existing.confidence ?? 0.4);
    const nextConf = Math.max(0, Math.min(1, 0.7 * prevConf + 0.3 * obs));
    const successCount = (existing.success_count ?? 0) + (input.outcomeDelta === "success" ? 1 : 0);
    const failureCount = (existing.failure_count ?? 0) + (input.outcomeDelta === "failure" ? 1 : 0);

    // Bounded evidence list — keep most recent 20.
    const evidence = [
      ...(input.evidenceEventIds ?? []),
      ...((existing.evidence_event_ids as string[] | null) ?? []),
    ].slice(0, 20);

    const { error } = await supabaseAdmin
      .from("learned_patterns")
      .update({
        summary: input.summary.slice(0, 800),
        detail: (input.detail ?? existing.detail ?? {}) as never,
        evidence_event_ids: evidence,
        confidence: nextConf,
        success_count: successCount,
        failure_count: failureCount,
        last_observed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      console.warn("[memory.patterns] update failed:", error.message);
      return null;
    }
    return existing.id;
  } catch (err) {
    console.warn("[memory.patterns] threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Weaken a pattern when contradicted; rejects when confidence collapses.
 */
export async function contradictPattern(patternId: string, note?: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("learned_patterns")
      .select("confidence, failure_count, detail")
      .eq("id", patternId)
      .maybeSingle();
    if (!data) return;
    const next = Math.max(0, Number(data.confidence ?? 0) - 0.15);
    const status = next < 0.1 ? "rejected" : "active";
    const detail = { ...((data.detail as Record<string, unknown>) ?? {}), last_contradiction: note ?? null };
    await supabaseAdmin
      .from("learned_patterns")
      .update({
        confidence: next,
        failure_count: (data.failure_count ?? 0) + 1,
        status,
        detail: detail as never,
      })
      .eq("id", patternId);
  } catch (err) {
    console.warn("[memory.patterns] contradict threw:", err instanceof Error ? err.message : err);
  }
}
