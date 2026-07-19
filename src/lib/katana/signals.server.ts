// Signal collection for KATANA confidence & recovery — server-only.
// Aggregates deterministic operational signals from Supabase without any
// LLM calls, so confidence remains explainable.

import type { ConfidenceInputs } from "./confidence";

export async function collectSignals(params: {
  userId: string;
  taskKind: string;
  agent: string;
  capability: string;
  attemptCount: number;
  maxAttempts: number;
  riskLevel: string;
  requiresApproval: boolean;
  workflowComplete: boolean;
  dependenciesAllCompleted: boolean;
  sentinelAllowed: boolean;
  sentinelAction: "allow" | "warn" | "throttle" | "block";
}): Promise<ConfidenceInputs> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Provider health (best binding for this user + capability)
  let availability: number | null = null;
  let consec: number | null = null;
  const { data: health } = await supabaseAdmin
    .from("sentinel_provider_health")
    .select("availability, consecutive_failures")
    .eq("user_id", params.userId)
    .eq("capability", params.capability)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (health && health.length) {
    availability = Number(health[0].availability ?? 0);
    consec = Number(health[0].consecutive_failures ?? 0);
  }

  // Historical success rate for same task_kind, user-scoped, last 200 events
  let hs: number | null = null;
  let hsN = 0;
  const { data: events } = await supabaseAdmin
    .from("operational_events")
    .select("outcome_class")
    .eq("user_id", params.userId)
    .eq("subsystem", "katana.runner")
    .contains("context", { task_kind: params.taskKind })
    .limit(200);
  if (events && events.length) {
    hsN = events.length;
    const success = events.filter((e) => e.outcome_class === "success").length;
    // Exclude blocked from the denominator per Learning Truth invariant
    const relevant = events.filter((e) => e.outcome_class === "success" || e.outcome_class === "failure").length;
    hs = relevant > 0 ? success / relevant : null;
  }

  // Learned pattern (best matching subject key)
  let patternConf: number | null = null;
  const { data: patterns } = await supabaseAdmin
    .from("learned_patterns")
    .select("confidence, success_count, failure_count")
    .eq("user_id", params.userId)
    .eq("subject_key", `task_kind:${params.taskKind}`)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (patterns && patterns.length) {
    const p = patterns[0];
    const total = (p.success_count ?? 0) + (p.failure_count ?? 0);
    const bias = total > 0 ? ((p.success_count ?? 0) - (p.failure_count ?? 0)) / total * 0.15 : 0;
    patternConf = Math.max(0, Math.min(1, Number(p.confidence ?? 0.5) + bias));
  }

  return {
    workflow_complete: params.workflowComplete,
    dependencies_all_completed: params.dependenciesAllCompleted,
    attempt_count: params.attemptCount,
    max_attempts: params.maxAttempts,
    risk_level: params.riskLevel,
    requires_approval: params.requiresApproval,
    provider_availability: availability,
    provider_consecutive_failures: consec,
    sentinel_allowed: params.sentinelAllowed,
    sentinel_action: params.sentinelAction,
    historical_success_rate: hs,
    historical_sample_size: hsN,
    similar_pattern_confidence: patternConf,
  };
}
