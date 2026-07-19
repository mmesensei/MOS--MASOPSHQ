// Post-workflow learning: evaluate completed missions and store structured
// learnings that future planning can reference.
//
// Truth rules (see task-outcomes.ts):
// - Agent success counts ONLY tasks whose capability actually executed.
// - Provider-blocked / operator-blocked / infrastructure-blocked outcomes
//   are recorded separately and never charged as agent failures.
// - Retrospectives run only when the workflow reaches a legitimate
//   terminal condition (all tasks past in_progress).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyTaskOutcome, classifyWorkflow, isTerminal } from "./task-outcomes";

export const captureMissionLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { missionId: string }) => ({
    missionId: z.string().uuid().parse(d.missionId),
  }))
  .handler(async ({ data, context }) => {
    const { data: tasks, error } = await context.supabase
      .from("katana_agent_tasks")
      .select("agent, status, attempt_count, started_at, completed_at, estimated_cost_cents, actual_cost_cents, estimated_time_ms, task_kind, error, output, requires_approval")
      .eq("mission_id", data.missionId);
    if (error) throw new Error(error.message);
    if (!tasks?.length) return { skipped: true };

    const allTerminal = tasks.every((t) => isTerminal(t.status));
    if (!allTerminal) return { skipped: true, reason: "mission_in_progress" };

    interface AgentStats {
      total: number;
      executed: number;              // tasks whose capability actually ran (success + failure)
      execution_success: number;     // agent credit
      execution_failure: number;     // agent debit
      provider_block: number;        // NOT charged to agent
      operator_block: number;
      infrastructure_block: number;
      cancellation: number;
      retries: number;
      avg_ms: number | null;
    }
    const perAgent: Record<string, AgentStats> = {};
    let cost_delta = 0;
    let duration_delta = 0;
    const failure_notes: string[] = [];
    const provider_block_notes: Array<{ agent: string; task_kind: string; capability: string; production_package_ready: boolean }> = [];

    for (const t of tasks) {
      const cls = classifyTaskOutcome(t as { status: string; error?: string | null; output?: unknown });
      const a = perAgent[t.agent] ?? (perAgent[t.agent] = {
        total: 0, executed: 0, execution_success: 0, execution_failure: 0,
        provider_block: 0, operator_block: 0, infrastructure_block: 0,
        cancellation: 0, retries: 0, avg_ms: null,
      });
      a.total++;
      if (cls === "execution_success") { a.executed++; a.execution_success++; }
      else if (cls === "execution_failure") { a.executed++; a.execution_failure++; }
      else if (cls === "provider_block") a.provider_block++;
      else if (cls === "operator_block") a.operator_block++;
      else if (cls === "infrastructure_block") a.infrastructure_block++;
      else if (cls === "cancellation") a.cancellation++;

      a.retries += Math.max(0, (t.attempt_count ?? 1) - 1);
      if (t.started_at && t.completed_at) {
        const d = new Date(t.completed_at).getTime() - new Date(t.started_at).getTime();
        a.avg_ms = a.avg_ms === null ? d : Math.round((a.avg_ms + d) / 2);
        if (t.estimated_time_ms) duration_delta += d - t.estimated_time_ms;
      }
      // Only cost actual execution; blocked tasks with 0 cost are neutral.
      cost_delta += (t.actual_cost_cents ?? 0) - (t.estimated_cost_cents ?? 0);

      if (cls === "execution_failure" && t.error) {
        failure_notes.push(`${t.agent}/${t.task_kind}: ${t.error.slice(0, 120)}`);
      }
      if (cls === "provider_block") {
        const out = (t.output as { production_package_ready?: boolean } | null) ?? null;
        provider_block_notes.push({
          agent: t.agent,
          task_kind: t.task_kind,
          capability: t.task_kind,
          production_package_ready: out?.production_package_ready === true,
        });
      }
    }

    // Derive per-agent success rate only from tasks that genuinely executed.
    const per_agent_rates: Record<string, { success_rate_pct: number | null; sample_size: number }> = {};
    for (const [agent, s] of Object.entries(perAgent)) {
      per_agent_rates[agent] = {
        sample_size: s.executed,
        success_rate_pct: s.executed > 0 ? Math.round((s.execution_success / s.executed) * 100) : null,
      };
    }

    const workflow_outcome = classifyWorkflow(
      tasks.map((t) => ({ status: t.status, error: t.error, output: t.output })),
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("katana_learnings").upsert(
      {
        user_id: context.userId,
        source_mission_id: data.missionId,
        kind: "mission_retrospective",
        key: `mission:${data.missionId}`,
        value: {
          workflow_outcome,
          tasks: tasks.length,
          per_agent: perAgent,
          per_agent_rates,
          cost_delta_cents: cost_delta,
          duration_delta_ms: duration_delta,
          failure_notes,
          provider_block_notes,
        } as never,
        state: "observed",
      },
      { onConflict: "user_id,kind,key" },
    );
    if (insErr) throw new Error(insErr.message);
    return { captured: true, workflow_outcome, agents: Object.keys(perAgent) };
  });
