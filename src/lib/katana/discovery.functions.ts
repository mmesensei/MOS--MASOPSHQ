// KATANA Phase 2 — Revenue Intelligence Dashboard, agent-task views, learnings.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyTaskOutcome, isTerminal } from "./task-outcomes";

export const getRevenueDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supa = context.supabase;
    const [oppsRes, missionsRes, assetsRes, tasksRes, learningsRes] = await Promise.all([
      supa.from("katana_opportunities").select("*").limit(500),
      supa.from("missions").select("*").limit(500),
      supa.from("katana_assets").select("id, authorized").limit(2000),
      supa.from("katana_agent_tasks").select("agent, status, mission_id, error, output").limit(1000),
      supa.from("katana_learnings").select("id, kind").limit(500),
    ]);

    const opps = (oppsRes.data ?? []) as Array<{
      status: string;
      estimated_value_cents: number | null;
      estimated_time_minutes: number | null;
      estimated_roi: number | null;
      priority_rank: number | null;
      category: string;
      title: string;
      id: string;
    }>;
    const missions = (missionsRes.data ?? []) as Array<{ stage: string; estimated_roi: number | null; id: string; title: string }>;
    const tasks = (tasksRes.data ?? []) as Array<{ agent: string; status: string; error?: string | null; output?: unknown }>;

    const open = opps.filter((o) => o.status === "open");
    const accepted = opps.filter((o) => o.status === "accepted");
    const completed = missions.filter((m) => ["completed", "closed"].includes(m.stage));

    const sumCents = (list: typeof opps) => list.reduce((a, b) => a + (b.estimated_value_cents ?? 0), 0);
    const sumMinutes = (list: typeof opps) => list.reduce((a, b) => a + (b.estimated_time_minutes ?? 0), 0);

    const projectedMonthlyCents = Math.round(sumCents(open) * 0.15);
    const projectedAnnualCents = sumCents(open);
    const automationSavingsMinutes = sumMinutes(accepted);

    const topROI = [...open]
      .filter((o) => (o.estimated_roi ?? 0) > 0)
      .sort((a, b) => (b.estimated_roi ?? 0) - (a.estimated_roi ?? 0))
      .slice(0, 5);
    const quickWins = [...open]
      .filter((o) => (o.estimated_time_minutes ?? 0) > 0 && (o.estimated_time_minutes ?? 0) <= 120)
      .sort((a, b) => (b.priority_rank ?? 0) - (a.priority_rank ?? 0))
      .slice(0, 5);
    const longTerm = [...open]
      .filter((o) => (o.estimated_time_minutes ?? 0) > 480)
      .sort((a, b) => (b.priority_rank ?? 0) - (a.priority_rank ?? 0))
      .slice(0, 5);

    const missionSuccessRate = missions.length
      ? Math.round((completed.length / missions.length) * 100)
      : 0;
    // Execution velocity counts only tasks whose capability actually executed
    // (execution_success). Blocked provider outcomes are excluded from both
    // numerator and denominator — they never happened.
    const executedTasks = tasks.filter((t) => {
      const c = classifyTaskOutcome(t);
      return c === "execution_success" || c === "execution_failure";
    });
    const executionVelocity = executedTasks.length
      ? Math.round(
          (executedTasks.filter((t) => classifyTaskOutcome(t) === "execution_success").length /
            executedTasks.length) * 100,
        )
      : 0;

    const businessHealth = Math.min(
      100,
      Math.round(
        (open.length > 0 ? 25 : 0) +
          (accepted.length > 0 ? 25 : 0) +
          missionSuccessRate * 0.3 +
          executionVelocity * 0.2,
      ),
    );

    return {
      totals: {
        assets: assetsRes.data?.length ?? 0,
        assets_authorized: (assetsRes.data ?? []).filter((a) => a.authorized).length,
        opportunities_open: open.length,
        opportunities_accepted: accepted.length,
        missions: missions.length,
        missions_completed: completed.length,
        learnings: learningsRes.data?.length ?? 0,
      },
      revenue: {
        projected_monthly_cents: projectedMonthlyCents,
        projected_annual_cents: projectedAnnualCents,
        pipeline_value_cents: sumCents(open) + sumCents(accepted),
      },
      automation: {
        estimated_minutes_saved: automationSavingsMinutes,
      },
      health: {
        mission_success_rate_pct: missionSuccessRate,
        execution_velocity_pct: executionVelocity,
        business_health_score: businessHealth,
      },
      buckets: {
        top_roi: topROI,
        quick_wins: quickWins,
        long_term: longTerm,
      },
      agent_load: {
        apex: tasks.filter((t) => t.agent === "apex" && !isTerminal(t.status)).length,
        iris: tasks.filter((t) => t.agent === "iris" && !isTerminal(t.status)).length,
        sentinel: tasks.filter((t) => t.agent === "sentinel" && !isTerminal(t.status)).length,
        katana: tasks.filter((t) => t.agent === "katana" && !isTerminal(t.status)).length,
      },
    };
  });

export const listAgentTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { missionId?: string } | undefined) => ({
    missionId: d?.missionId ? z.string().uuid().parse(d.missionId) : undefined,
  }))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("katana_agent_tasks").select("*")
      .order("created_at", { ascending: false }).limit(200);
    if (data.missionId) q = q.eq("mission_id", data.missionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const recordLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: string; key: string; value?: Record<string, unknown>; weight?: number; source_mission_id?: string }) => ({
    kind: z.string().min(1).max(80).parse(d.kind),
    key: z.string().min(1).max(200).parse(d.key),
    value: (d.value ?? {}) as Record<string, unknown>,
    weight: Math.max(0, Math.min(100, d.weight ?? 1)),
    source_mission_id: d.source_mission_id ? z.string().uuid().parse(d.source_mission_id) : null,
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("katana_learnings").upsert(
      {
        user_id: context.userId,
        kind: data.kind,
        key: data.key,
        value: data.value as never,
        weight: data.weight,
        source_mission_id: data.source_mission_id,
      } as never,
      { onConflict: "user_id,kind,key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
