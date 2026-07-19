// Live operational telemetry for the Revenue Board / Ops dashboard.
// Distinguishes execution success from provider/operator/infrastructure blocks
// so blocked capabilities never inflate agent success metrics.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyTaskOutcome } from "./task-outcomes";

export interface CapabilityBlockSummary {
  capability: string;
  tasks_blocked: number;
  production_packages_ready: number;
  oldest_blocked_age_minutes: number;
}

export interface OpsHealth {
  counts: Record<string, number>;
  outcomes: {
    execution_success: number;
    execution_failure: number;
    provider_block: number;
    operator_block: number;
    infrastructure_block: number;
    cancellation: number;
    in_progress: number;
  };
  by_agent: Record<string, { total: number; running: number; execution_success: number; execution_failure: number; blocked: number }>;
  pending_approvals: number;
  bottlenecks: Array<{ id: string; agent: string; task_kind: string; status: string; age_minutes: number }>;
  avg_duration_ms: number | null;
  estimated_queue_drain_minutes: number | null;
  cost_last_24h_cents: number;
  runner_last_activity: string | null;
  capability_readiness: CapabilityBlockSummary[];
}

export const getOperationalHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpsHealth> => {
    const { data: tasks } = await context.supabase
      .from("katana_agent_tasks")
      .select("id, agent, task_kind, status, error, output, created_at, started_at, completed_at, execution_history, locked_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const counts: Record<string, number> = {};
    const outcomes = {
      execution_success: 0,
      execution_failure: 0,
      provider_block: 0,
      operator_block: 0,
      infrastructure_block: 0,
      cancellation: 0,
      in_progress: 0,
    };
    const by_agent: Record<string, { total: number; running: number; execution_success: number; execution_failure: number; blocked: number }> = {
      iris: { total: 0, running: 0, execution_success: 0, execution_failure: 0, blocked: 0 },
      apex: { total: 0, running: 0, execution_success: 0, execution_failure: 0, blocked: 0 },
      katana: { total: 0, running: 0, execution_success: 0, execution_failure: 0, blocked: 0 },
      sentinel: { total: 0, running: 0, execution_success: 0, execution_failure: 0, blocked: 0 },
    };
    let pending_approvals = 0;
    const durations: number[] = [];
    const bottlenecks: OpsHealth["bottlenecks"] = [];
    let runner_last_activity: string | null = null;
    const capMap = new Map<string, { tasks_blocked: number; production_packages_ready: number; oldest_blocked_age_minutes: number }>();

    for (const t of tasks ?? []) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
      const cls = classifyTaskOutcome(t as { status: string; error?: string | null; output?: unknown });
      if (cls in outcomes) (outcomes as Record<string, number>)[cls]++;

      const a = by_agent[t.agent] ?? (by_agent[t.agent] = { total: 0, running: 0, execution_success: 0, execution_failure: 0, blocked: 0 });
      a.total++;
      if (t.status === "running") a.running++;
      if (cls === "execution_success") a.execution_success++;
      if (cls === "execution_failure") a.execution_failure++;
      if (cls === "provider_block" || cls === "infrastructure_block" || cls === "operator_block") a.blocked++;
      if (t.status === "waiting_on_operator") pending_approvals++;
      if (t.locked_at && (!runner_last_activity || t.locked_at > runner_last_activity)) {
        runner_last_activity = t.locked_at;
      }
      if (t.started_at && t.completed_at) {
        durations.push(new Date(t.completed_at).getTime() - new Date(t.started_at).getTime());
      }
      if (["running", "waiting_on_operator", "blocked", "retrying"].includes(t.status)) {
        const age = (Date.now() - new Date(t.created_at).getTime()) / 60_000;
        bottlenecks.push({
          id: t.id,
          agent: t.agent,
          task_kind: t.task_kind,
          status: t.status,
          age_minutes: Math.round(age),
        });
      }
      if (cls === "provider_block") {
        const capKey = t.task_kind ?? "unknown";
        const entry = capMap.get(capKey) ?? { tasks_blocked: 0, production_packages_ready: 0, oldest_blocked_age_minutes: 0 };
        entry.tasks_blocked++;
        const out = t.output as { production_package_ready?: boolean } | null;
        if (out && out.production_package_ready === true) entry.production_packages_ready++;
        const age = Math.round((Date.now() - new Date(t.created_at).getTime()) / 60_000);
        if (age > entry.oldest_blocked_age_minutes) entry.oldest_blocked_age_minutes = age;
        capMap.set(capKey, entry);
      }
    }
    bottlenecks.sort((a, b) => b.age_minutes - a.age_minutes);

    const avg_duration_ms = durations.length
      ? Math.round(durations.reduce((s, x) => s + x, 0) / durations.length)
      : null;
    const queued = (counts.queued ?? 0) + (counts.ready ?? 0) + (counts.waiting_on_dependency ?? 0);
    const estimated_queue_drain_minutes =
      avg_duration_ms && queued > 0 ? Math.round((queued * avg_duration_ms) / 60_000 / 3) : null;

    // Phase 7: read from canonical sentinel_cost_ledger (micro-USD → cents).
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { data: cost } = await context.supabase
      .from("sentinel_cost_ledger")
      .select("cost_micro_usd")
      .gte("created_at", since);
    const cost_last_24h_cents = Math.round(
      (cost ?? []).reduce((s, r) => s + Number(r.cost_micro_usd ?? 0), 0) / 10_000,
    );


    const capability_readiness: CapabilityBlockSummary[] = [...capMap.entries()]
      .map(([capability, v]) => ({ capability, ...v }))
      .sort((a, b) => b.tasks_blocked - a.tasks_blocked);

    return {
      counts,
      outcomes,
      by_agent,
      pending_approvals,
      bottlenecks: bottlenecks.slice(0, 5),
      avg_duration_ms,
      estimated_queue_drain_minutes,
      cost_last_24h_cents,
      runner_last_activity,
      capability_readiness,
    };
  });
