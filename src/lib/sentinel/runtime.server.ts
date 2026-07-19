// SENTINEL runtime — server-only.
// Central place where cost, health, budgets, kill-switch and anomalies are
// evaluated. Callers (KATANA runner, provider facade) ask short questions;
// SENTINEL returns an authoritative decision. Never bypass by writing to
// tables directly.

import { recordEvent } from "@/lib/memory/events.server";

export type PolicyMode = "disabled" | "monitor" | "warn" | "throttle" | "block";
export type BudgetScope =
  | "daily_total"
  | "provider"
  | "capability"
  | "executive"
  | "workflow"
  | "single_execution"
  | "cost_growth";

export interface GuardContext {
  userId: string;
  provider?: string;
  capability?: string;
  executiveId?: string;
  workflowId?: string;
  estimatedMicroUsd?: number;
}

export interface GuardDecision {
  allow: boolean;
  action: "allow" | "warn" | "throttle" | "block";
  reasons: string[];
  killSwitch: boolean;
}

/**
 * Master guard used by autonomous executors before doing work.
 * Fail-closed: if telemetry is broken and fail_policy='closed', deny.
 */
export async function evaluateGuard(ctx: GuardContext): Promise<GuardDecision> {
  const reasons: string[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Kill switch + runtime state
    const { data: rt } = await supabaseAdmin
      .from("sentinel_runtime_state")
      .select("kill_switch_active, kill_switch_reason, disabled_bindings, fail_policy")
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (rt?.kill_switch_active) {
      return {
        allow: false,
        action: "block",
        killSwitch: true,
        reasons: [`kill_switch:${rt.kill_switch_reason ?? "active"}`],
      };
    }

    // 2. Administratively disabled binding
    const disabled = (rt?.disabled_bindings ?? []) as Array<{ provider?: string; capability?: string }>;
    if (
      ctx.provider &&
      ctx.capability &&
      disabled.some((b) => b.provider === ctx.provider && b.capability === ctx.capability)
    ) {
      return { allow: false, action: "block", killSwitch: false, reasons: [`disabled_binding:${ctx.provider}/${ctx.capability}`] };
    }

    // 3. Provider health (only for the binding actually in use)
    if (ctx.provider && ctx.capability) {
      const { data: health } = await supabaseAdmin
        .from("sentinel_provider_health")
        .select("administratively_disabled, availability, consecutive_failures")
        .eq("user_id", ctx.userId)
        .eq("provider", ctx.provider)
        .eq("capability", ctx.capability)
        .maybeSingle();
      if (health?.administratively_disabled) {
        return { allow: false, action: "block", killSwitch: false, reasons: [`provider_disabled:${ctx.provider}/${ctx.capability}`] };
      }
      if (health && (health.consecutive_failures ?? 0) >= 5) {
        reasons.push(`degraded:${ctx.provider}/${ctx.capability}`);
      }
    }

    // 4. Budget policies
    const policies = await loadPolicies(ctx.userId);
    let action: GuardDecision["action"] = "allow";

    for (const p of policies) {
      if (p.mode === "disabled" || p.mode === "monitor") continue;
      const spent = await usageForPolicy(ctx.userId, p, ctx);
      const projected = spent + (ctx.estimatedMicroUsd ?? 0);
      const compared = p.scope === "single_execution" ? (ctx.estimatedMicroUsd ?? 0) : projected;
      if (compared >= p.limit_micro_usd) {
        reasons.push(`budget_${p.scope}:${compared}/${p.limit_micro_usd}`);
        if (p.mode === "block") return { allow: false, action: "block", killSwitch: false, reasons };
        if (p.mode === "throttle") action = "throttle";
        else if (p.mode === "warn" && action === "allow") action = "warn";
      }
    }

    return { allow: true, action, killSwitch: false, reasons };
  } catch (err) {
    // Telemetry failure → apply fail policy
    console.warn("[sentinel.guard] telemetry error:", err instanceof Error ? err.message : err);
    // Default fail-closed for autonomous execution.
    return { allow: false, action: "block", killSwitch: false, reasons: ["telemetry_unavailable_fail_closed"] };
  }
}

interface Policy {
  id: string;
  scope: BudgetScope;
  scope_key: string | null;
  mode: PolicyMode;
  limit_micro_usd: number;
  window_kind: string;
}

async function loadPolicies(userId: string): Promise<Policy[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sentinel_budget_policies")
    .select("id, scope, scope_key, mode, limit_micro_usd, window_kind")
    .eq("user_id", userId);
  return (data ?? []) as unknown as Policy[];
}

async function usageForPolicy(userId: string, p: Policy, ctx: GuardContext): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const day = new Date(Date.now() - (p.window_kind === "hour" ? 3600_000 : 0)).toISOString().slice(0, 10);
  let q = supabaseAdmin
    .from("sentinel_cost_ledger")
    .select("cost_micro_usd")
    .eq("user_id", userId)
    .eq("day", day);
  switch (p.scope) {
    case "provider": if (ctx.provider !== p.scope_key) return 0; q = q.eq("provider", p.scope_key!); break;
    case "capability": if (ctx.capability !== p.scope_key) return 0; q = q.eq("capability", p.scope_key!); break;
    case "executive": if (ctx.executiveId !== p.scope_key) return 0; q = q.eq("executive_id", p.scope_key!); break;
    case "workflow": if (ctx.workflowId !== p.scope_key) return 0; q = q.eq("workflow_id", p.scope_key!); break;
    case "single_execution": return 0; // compared against estimate only
    case "cost_growth": break; // baseline compared elsewhere; treat as daily total
    case "daily_total": break;
  }
  const { data } = await q;
  return (data ?? []).reduce((s, r) => s + Number(r.cost_micro_usd ?? 0), 0);
}

// ==================== Cost ledger writer ====================
export interface LedgerEntry {
  userId: string;
  provider: string;
  model?: string | null;
  capability: string;
  executiveId?: string | null;
  subsystem: string;
  workflowId?: string | null;
  taskId?: string | null;
  missionId?: string | null;
  costMicroUsd: number;
  estimatedMicroUsd?: number | null;
  latencyMs?: number | null;
  outcome?: "success" | "failure" | "blocked" | "timeout";
  eventId?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordCost(entry: LedgerEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sentinel_cost_ledger").upsert(
      {
        user_id: entry.userId,
        provider: entry.provider,
        model: entry.model ?? null,
        capability: entry.capability,
        executive_id: entry.executiveId ?? null,
        subsystem: entry.subsystem,
        workflow_id: entry.workflowId ?? null,
        task_id: entry.taskId ?? null,
        mission_id: entry.missionId ?? null,
        cost_micro_usd: Math.max(0, Math.round(entry.costMicroUsd)),
        estimated_micro_usd: entry.estimatedMicroUsd ?? null,
        latency_ms: entry.latencyMs ?? null,
        outcome: entry.outcome ?? "success",
        event_id: entry.eventId ?? null,
        dedupe_key: entry.dedupeKey ?? null,
        metadata: (entry.metadata ?? {}) as never,
      } as never,
      { onConflict: entry.dedupeKey ? "user_id,dedupe_key" : undefined, ignoreDuplicates: !!entry.dedupeKey } as never,
    );
  } catch (err) {
    console.warn("[sentinel.ledger] failed:", err instanceof Error ? err.message : err);
  }
}

// ==================== Provider health tracking ====================
export interface HealthObservation {
  userId: string;
  provider: string;
  capability: string;
  success: boolean;
  latencyMs?: number;
  errorKind?: "timeout" | "auth" | "quota" | "5xx" | "malformed" | "unsupported" | "other";
  errorMessage?: string;
}

export async function observeProviderCall(obs: HealthObservation): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("sentinel_provider_health")
      .select("*")
      .eq("user_id", obs.userId)
      .eq("provider", obs.provider)
      .eq("capability", obs.capability)
      .maybeSingle();

    const alpha = 0.2; // EWMA smoothing
    const sample = (existing?.sample_count ?? 0) + 1;
    const prevAvail = Number(existing?.availability ?? 1.0);
    const prevErr = Number(existing?.error_rate ?? 0.0);
    const prevTimeout = Number(existing?.timeout_rate ?? 0.0);
    const prevAvg = Number(existing?.avg_latency_ms ?? 0);
    const prevP95 = Number(existing?.p95_latency_ms ?? 0);

    const successVal = obs.success ? 1 : 0;
    const availability = prevAvail + alpha * (successVal - prevAvail);
    const errorRate = prevErr + alpha * ((obs.success ? 0 : 1) - prevErr);
    const isTimeout = obs.errorKind === "timeout";
    const timeoutRate = prevTimeout + alpha * ((isTimeout ? 1 : 0) - prevTimeout);
    const avgLatency = obs.latencyMs != null
      ? Math.round(prevAvg + alpha * (obs.latencyMs - prevAvg))
      : prevAvg;
    const p95 = obs.latencyMs != null ? Math.max(prevP95, obs.latencyMs) : prevP95;
    const consecutive = obs.success ? 0 : (existing?.consecutive_failures ?? 0) + 1;

    await supabaseAdmin.from("sentinel_provider_health").upsert(
      {
        user_id: obs.userId,
        provider: obs.provider,
        capability: obs.capability,
        availability,
        error_rate: errorRate,
        timeout_rate: timeoutRate,
        avg_latency_ms: avgLatency,
        p95_latency_ms: p95,
        consecutive_failures: consecutive,
        sample_count: sample,
        last_success_at: obs.success ? new Date().toISOString() : existing?.last_success_at ?? null,
        last_failure_at: !obs.success ? new Date().toISOString() : existing?.last_failure_at ?? null,
        last_error: obs.success ? existing?.last_error ?? null : (obs.errorMessage ?? obs.errorKind ?? "error").slice(0, 300),
        administratively_disabled: existing?.administratively_disabled ?? false,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,provider,capability" } as never,
    );

    // Anomaly: repeated consecutive failures
    if (consecutive === 5) {
      await raiseAnomaly({
        userId: obs.userId,
        anomalyType: "provider_repeated_failures",
        severity: "high",
        confidence: 0.9,
        observedValue: consecutive,
        baselineValue: 0,
        provider: obs.provider,
        capability: obs.capability,
        recommendedResponse: "Investigate provider or fall back to alternative binding.",
        dedupeKey: `provider_failures:${obs.provider}:${obs.capability}`,
      });
    }
  } catch (err) {
    console.warn("[sentinel.health] failed:", err instanceof Error ? err.message : err);
  }
}

// ==================== Anomaly detection ====================
export interface AnomalyInput {
  userId: string;
  anomalyType: string;
  severity?: "info" | "warning" | "high" | "critical";
  confidence?: number;
  observedValue?: number;
  baselineValue?: number;
  provider?: string;
  capability?: string;
  executiveId?: string;
  workflowId?: string;
  taskId?: string;
  subsystem?: string;
  evidence?: unknown[];
  recommendedResponse?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

export async function raiseAnomaly(a: AnomalyInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sentinel_anomalies").upsert(
      {
        user_id: a.userId,
        anomaly_type: a.anomalyType,
        severity: a.severity ?? "warning",
        confidence: a.confidence ?? 0.7,
        observed_value: a.observedValue ?? null,
        baseline_value: a.baselineValue ?? null,
        provider: a.provider ?? null,
        capability: a.capability ?? null,
        executive_id: a.executiveId ?? null,
        workflow_id: a.workflowId ?? null,
        task_id: a.taskId ?? null,
        subsystem: a.subsystem ?? "sentinel",
        evidence: (a.evidence ?? []) as never,
        recommended_response: a.recommendedResponse ?? null,
        dedupe_key: a.dedupeKey ?? null,
        metadata: (a.metadata ?? {}) as never,
      } as never,
      { onConflict: a.dedupeKey ? "user_id,dedupe_key" : undefined, ignoreDuplicates: !!a.dedupeKey } as never,
    );

    await recordEvent({
      userId: a.userId,
      subsystem: "sentinel",
      eventType: `anomaly.${a.anomalyType}`,
      outcomeClass: "anomaly",
      summary: `SENTINEL anomaly ${a.anomalyType}${a.provider ? ` on ${a.provider}` : ""}`,
      severity: a.severity === "critical" ? 5 : a.severity === "high" ? 4 : 3,
      confidence: a.confidence ?? 0.7,
      context: { observed: a.observedValue, baseline: a.baselineValue, capability: a.capability, provider: a.provider },
      dedupeKey: a.dedupeKey ? `sentinel.anomaly:${a.dedupeKey}` : null,
    });
  } catch (err) {
    console.warn("[sentinel.anomaly] failed:", err instanceof Error ? err.message : err);
  }
}

// ==================== Cost-growth anomaly ====================
export async function checkCostGrowth(userId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayRows } = await supabaseAdmin
      .from("sentinel_cost_ledger")
      .select("cost_micro_usd")
      .eq("user_id", userId)
      .eq("day", today);
    const todaySpent = (todayRows ?? []).reduce((s, r) => s + Number(r.cost_micro_usd ?? 0), 0);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const { data: histRows } = await supabaseAdmin
      .from("sentinel_cost_ledger")
      .select("cost_micro_usd, day")
      .eq("user_id", userId)
      .gte("day", sevenDaysAgo)
      .lt("day", today);
    const totals = new Map<string, number>();
    for (const r of histRows ?? []) {
      totals.set(r.day as string, (totals.get(r.day as string) ?? 0) + Number(r.cost_micro_usd ?? 0));
    }
    const values = [...totals.values()];
    if (values.length < 3) return;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg > 0 && todaySpent > avg * 3) {
      await raiseAnomaly({
        userId,
        anomalyType: "cost_growth_spike",
        severity: "warning",
        confidence: 0.7,
        observedValue: todaySpent,
        baselineValue: avg,
        recommendedResponse: "Review today's high-cost workflows; consider a daily budget policy.",
        dedupeKey: `cost_growth:${today}`,
      });
    }
  } catch (err) {
    console.warn("[sentinel.growth] failed:", err instanceof Error ? err.message : err);
  }
}
