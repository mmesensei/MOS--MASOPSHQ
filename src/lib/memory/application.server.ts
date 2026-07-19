// Phase 6 — Memory application tracking (server-only).
// Records that a learned pattern *influenced* a decision, and later reinforces
// or weakens its usefulness based on the outcome tied to that application.
// A memory is not rewarded merely for being retrieved.

export type ApplicationSurface =
  | "planning"
  | "provider_selection"
  | "task_assignment"
  | "recovery"
  | "validation"
  | "handoff";

/**
 * Bump applied_count + last_applied_at when a pattern *materially* influenced
 * a decision on the given surface. Idempotency-safe; failures are swallowed.
 */
export async function notePatternApplied(input: {
  patternId: string;
  surface: ApplicationSurface;
  taskId?: string | null;
  missionId?: string | null;
  reason?: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("learned_patterns")
      .select("id, applied_count, detail")
      .eq("id", input.patternId)
      .maybeSingle();
    if (!data) return;
    const detail = { ...((data.detail as Record<string, unknown>) ?? {}) };
    const trail = Array.isArray(detail.application_trail) ? detail.application_trail as unknown[] : [];
    trail.unshift({
      at: new Date().toISOString(),
      surface: input.surface,
      task_id: input.taskId ?? null,
      mission_id: input.missionId ?? null,
      reason: (input.reason ?? "").slice(0, 200),
    });
    detail.application_trail = trail.slice(0, 20);
    await supabaseAdmin
      .from("learned_patterns")
      .update({
        applied_count: (data.applied_count ?? 0) + 1,
        last_applied_at: new Date().toISOString(),
        detail: detail as never,
      })
      .eq("id", input.patternId);
  } catch (err) {
    console.warn("[memory.application] notePatternApplied threw:", err instanceof Error ? err.message : err);
  }
}

/**
 * Adjust `usefulness` in [-1..1] after an application-tied outcome resolves.
 * EWMA: 0.8 * prev + 0.2 * signal, where signal ∈ {+1 success, -1 failure}.
 * Callers MUST only invoke this when notePatternApplied was recorded for
 * this decision — otherwise usefulness would drift on unrelated events.
 */
export async function reinforcePatternUsefulness(input: {
  patternId: string;
  outcome: "success" | "failure";
  evidenceEventIds?: string[];
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("learned_patterns")
      .select("id, usefulness, evidence_event_ids")
      .eq("id", input.patternId)
      .maybeSingle();
    if (!data) return;
    const signal = input.outcome === "success" ? 1 : -1;
    const prev = Number(data.usefulness ?? 0);
    const next = Math.max(-1, Math.min(1, 0.8 * prev + 0.2 * signal));
    const evidence = [
      ...(input.evidenceEventIds ?? []),
      ...((data.evidence_event_ids as string[] | null) ?? []),
    ].slice(0, 20);
    await supabaseAdmin
      .from("learned_patterns")
      .update({ usefulness: next, evidence_event_ids: evidence })
      .eq("id", input.patternId);
  } catch (err) {
    console.warn("[memory.application] reinforce threw:", err instanceof Error ? err.message : err);
  }
}
