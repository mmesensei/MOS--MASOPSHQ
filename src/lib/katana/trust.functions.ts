// KATANA Trust Metrics — Phase 5.
// Owner-scoped operational trust indicators derived from operational_events
// and katana_agent_tasks. Never counts blocked/operator/infrastructure blocks
// as success or failure — preserves Learning Truth invariant.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyTaskOutcome } from "./task-outcomes";

export interface TrustMetrics {
  window_days: number;
  totals: {
    tasks_observed: number;
    execution_success: number;
    execution_failure: number;
    verified_completion: number;
    blocked: number;
    cancelled: number;
  };
  rates: {
    success_rate: number;              // success / (success + failure)
    verified_completion_rate: number;  // verified / success
    blocked_rate: number;              // blocked / total
    recovery_success_rate: number;     // retries that eventually succeeded / retries observed
  };
  confidence: {
    avg_predicted: number | null;      // avg confidence.score at execution time
    avg_actual: number | null;         // 1 for verified, 0 for failure
    calibration_gap: number | null;    // avg |predicted - actual|
    sample_size: number;
  };
  latency: {
    avg_ms: number | null;
    p95_ms: number | null;
    long_running_tasks: number;
  };
  operator: {
    interventions_open: number;
    approvals_pending: number;
  };
  by_task_kind: Array<{
    task_kind: string;
    runs: number;
    success_rate: number;
    verified_rate: number;
    avg_confidence: number | null;
  }>;
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export const getTrustMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrustMetrics> => {
    const windowDays = 7;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60_000).toISOString();

    const { data: tasks } = await context.supabase
      .from("katana_agent_tasks")
      .select("id, task_kind, status, error, output, started_at, completed_at, attempt_count, execution_history")
      .gte("created_at", since)
      .limit(1000);

    let success = 0;
    let failure = 0;
    let verified = 0;
    let blocked = 0;
    let cancelled = 0;
    let retriesObserved = 0;
    let retriesRecovered = 0;
    const durations: number[] = [];
    let longRunning = 0;
    const predicted: number[] = [];
    const actual: number[] = [];
    const gaps: number[] = [];
    const byKind = new Map<string, { runs: number; success: number; verified: number; confidences: number[] }>();

    for (const t of tasks ?? []) {
      const cls = classifyTaskOutcome(t as { status: string; error?: string | null; output?: unknown });
      const kind = t.task_kind ?? "unknown";
      const bucket = byKind.get(kind) ?? { runs: 0, success: 0, verified: 0, confidences: [] };
      bucket.runs++;

      if (cls === "execution_success") { success++; bucket.success++; }
      else if (cls === "execution_failure") failure++;
      else if (cls === "provider_block" || cls === "infrastructure_block" || cls === "operator_block") blocked++;
      else if (cls === "cancellation") cancelled++;

      if ((t.attempt_count ?? 1) > 1) {
        retriesObserved++;
        if (cls === "execution_success") retriesRecovered++;
      }

      if (t.started_at && t.completed_at) {
        const d = new Date(t.completed_at).getTime() - new Date(t.started_at).getTime();
        if (d > 0) durations.push(d);
        if (d > 5 * 60_000) longRunning++;
      }

      const hist = (t.execution_history as Array<Record<string, unknown>>) ?? [];
      const last = hist[hist.length - 1];
      if (last && typeof last.confidence_score === "number") {
        predicted.push(last.confidence_score);
        bucket.confidences.push(last.confidence_score);
        if (cls === "execution_success") {
          const validation = last.validation as { verified_completion?: boolean } | undefined;
          const isVerified = !!validation?.verified_completion;
          if (isVerified) { verified++; bucket.verified++; }
          const act = isVerified ? 1 : 0.7;
          actual.push(act);
          gaps.push(Math.abs(last.confidence_score - act));
        } else if (cls === "execution_failure") {
          actual.push(0);
          gaps.push(Math.abs(last.confidence_score - 0));
        }
      }

      byKind.set(kind, bucket);
    }

    const total = (tasks ?? []).length;
    const durSorted = [...durations].sort((a, b) => a - b);

    const { data: interventions } = await context.supabase
      .from("katana_intervention_queue")
      .select("id, kind")
      .eq("status", "open")
      .limit(500);
    const openInterventions = interventions?.length ?? 0;

    const { data: pending } = await context.supabase
      .from("katana_agent_tasks")
      .select("id")
      .eq("status", "waiting_on_operator")
      .limit(500);
    const pendingApprovals = pending?.length ?? 0;

    const avg = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

    const by_task_kind = [...byKind.entries()]
      .map(([task_kind, v]) => ({
        task_kind,
        runs: v.runs,
        success_rate: v.runs ? v.success / v.runs : 0,
        verified_rate: v.success ? v.verified / v.success : 0,
        avg_confidence: avg(v.confidences),
      }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 12);

    return {
      window_days: windowDays,
      totals: {
        tasks_observed: total,
        execution_success: success,
        execution_failure: failure,
        verified_completion: verified,
        blocked,
        cancelled,
      },
      rates: {
        success_rate: (success + failure) > 0 ? success / (success + failure) : 0,
        verified_completion_rate: success > 0 ? verified / success : 0,
        blocked_rate: total > 0 ? blocked / total : 0,
        recovery_success_rate: retriesObserved > 0 ? retriesRecovered / retriesObserved : 0,
      },
      confidence: {
        avg_predicted: avg(predicted),
        avg_actual: avg(actual),
        calibration_gap: avg(gaps),
        sample_size: gaps.length,
      },
      latency: {
        avg_ms: avg(durations),
        p95_ms: percentile(durSorted, 0.95),
        long_running_tasks: longRunning,
      },
      operator: {
        interventions_open: openInterventions,
        approvals_pending: pendingApprovals,
      },
      by_task_kind,
    };
  });
