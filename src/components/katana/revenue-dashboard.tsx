// KATANA Revenue Intelligence Dashboard strip.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Zap, Shield, Target, Sparkles, Clock, Rocket, HeartPulse, Activity, AlertTriangle, ShieldAlert, Power } from "lucide-react";
import { getRevenueDashboard } from "@/lib/katana/discovery.functions";
import { getOperationalHealth } from "@/lib/katana/telemetry.functions";
import { getSentinelStatus } from "@/lib/sentinel/controls.functions";
import { getTrustMetrics } from "@/lib/katana/trust.functions";

function fmtCents(n: number): string {
  if (!n) return "$0";
  if (n >= 100_000_00) return `$${(n / 100_000).toFixed(1)}k`;
  return `$${(n / 100).toFixed(0)}`;
}
function fmtMinutes(n: number): string {
  if (!n) return "0h";
  if (n < 60) return `${n}m`;
  const h = Math.round(n / 60);
  if (h < 40) return `${h}h`;
  return `${Math.round(h / 8)}d`;
}

export function KatanaRevenueDashboard() {
  const fn = useServerFn(getRevenueDashboard);
  const opsFn = useServerFn(getOperationalHealth);
  const sentinelFn = useServerFn(getSentinelStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["katana", "dashboard"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });
  const { data: ops } = useQuery({
    queryKey: ["katana", "ops-health"],
    queryFn: () => opsFn(),
    refetchInterval: 15_000,
  });
  const { data: sentinel } = useQuery({
    queryKey: ["sentinel", "status"],
    queryFn: () => sentinelFn(),
    refetchInterval: 30_000,
  });
  const trustFn = useServerFn(getTrustMetrics);
  const { data: trust } = useQuery({
    queryKey: ["katana", "trust"],
    queryFn: () => trustFn(),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="mb-4 rounded-lg border border-border/60 bg-surface/50 p-3 text-xs text-muted-foreground">
        Loading revenue intelligence…
      </div>
    );
  }

  const tiles = [
    { icon: TrendingUp, label: "Pipeline value", value: fmtCents(data.revenue.pipeline_value_cents), tint: "text-status-success" },
    { icon: Rocket, label: "Proj. monthly", value: fmtCents(data.revenue.projected_monthly_cents), tint: "text-katana" },
    { icon: Target, label: "Open opps", value: `${data.totals.opportunities_open}`, tint: "text-status-info" },
    { icon: Sparkles, label: "Missions", value: `${data.totals.missions_completed}/${data.totals.missions}`, tint: "text-iris" },
    { icon: Clock, label: "Time saved", value: fmtMinutes(data.automation.estimated_minutes_saved), tint: "text-status-warning" },
    { icon: Zap, label: "Velocity", value: `${data.health.execution_velocity_pct}%`, tint: "text-cyan-300" },
    { icon: Shield, label: "Success", value: `${data.health.mission_success_rate_pct}%`, tint: "text-emerald-300" },
    { icon: HeartPulse, label: "Health", value: `${data.health.business_health_score}`, tint: "text-katana" },
  ];

  return (
    <section className="mb-4 rounded-lg border border-border/60 bg-surface/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Revenue Intelligence</div>
        <div className="text-[11px] text-muted-foreground">
          APEX {data.agent_load.apex} · IRIS {data.agent_load.iris} · SENTINEL {data.agent_load.sentinel} · KATANA {data.agent_load.katana}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="rounded-md border border-border/60 bg-background/40 p-2">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${t.tint}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</span>
              </div>
              <div className="mt-1 text-sm font-semibold">{t.value}</div>
            </div>
          );
        })}
      </div>
      {ops && (
        <div className="mt-3 space-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3 text-status-success" />Runner: {ops.runner_last_activity ? new Date(ops.runner_last_activity).toLocaleTimeString() : "idle"}</span>
            <span>Running {ops.counts.running ?? 0} · Ready {ops.counts.ready ?? 0} · Queued {ops.counts.queued ?? 0}</span>
            <span>Retrying {ops.counts.retrying ?? 0}</span>
            <span className="text-emerald-300">Executed ✓ {ops.outcomes.execution_success}</span>
            <span className="text-rose-300">Failed {ops.outcomes.execution_failure}</span>
            <span className="text-amber-300">Blocked {ops.outcomes.provider_block + ops.outcomes.infrastructure_block}</span>
            <span>Cancelled {ops.outcomes.cancellation}</span>
            {ops.pending_approvals > 0 && (
              <span className="inline-flex items-center gap-1 text-status-warning"><AlertTriangle className="h-3 w-3" />{ops.pending_approvals} awaiting approval</span>
            )}
            {ops.estimated_queue_drain_minutes !== null && (
              <span>ETA drain ~{ops.estimated_queue_drain_minutes}m</span>
            )}
            <span>Cost 24h ${(ops.cost_last_24h_cents / 100).toFixed(2)}</span>
          </div>
          {ops.capability_readiness.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-amber-300/90">
              <span className="uppercase tracking-wider text-[10px] text-muted-foreground">Capabilities blocked:</span>
              {ops.capability_readiness.slice(0, 4).map((c) => (
                <span key={c.capability}>
                  {c.capability} ({c.tasks_blocked} blocked{c.production_packages_ready ? `, ${c.production_packages_ready} pkg ready` : ""}, oldest {c.oldest_blocked_age_minutes}m)
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {sentinel && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 pt-2 text-[11px]">
          <span className="inline-flex items-center gap-1 font-mono uppercase tracking-wider text-muted-foreground">
            <ShieldAlert className="h-3 w-3 text-status-success" />Sentinel
          </span>
          <span className={sentinel.kill_switch_active ? "inline-flex items-center gap-1 text-rose-400" : "inline-flex items-center gap-1 text-emerald-300"}>
            <Power className="h-3 w-3" />
            {sentinel.kill_switch_active ? `KILL SWITCH: ${sentinel.kill_switch_reason ?? "active"}` : "runtime armed"}
          </span>
          <span className="text-muted-foreground">Today ${sentinel.today_cost_usd.toFixed(2)}</span>
          <span className="text-muted-foreground">Anomalies {sentinel.anomalies.length}</span>
          <span className="text-muted-foreground">Policies {sentinel.budget_policies.length}</span>
          {sentinel.provider_health.slice(0, 3).map((h) => (
            <span key={`${h.provider}:${h.capability}`} className={h.administratively_disabled ? "text-rose-300" : (h.consecutive_failures ?? 0) >= 3 ? "text-amber-300" : "text-muted-foreground"}>
              {h.provider}/{h.capability}: {h.administratively_disabled ? "off" : `${Math.round(Number(h.availability) * 100)}%`}
            </span>
          ))}
        </div>
      )}
      {trust && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 pt-2 text-[11px]">
          <span className="inline-flex items-center gap-1 font-mono uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3 text-status-info" />Trust · {trust.window_days}d
          </span>
          <span className="text-emerald-300">Success {(trust.rates.success_rate * 100).toFixed(0)}%</span>
          <span className="text-cyan-300">Verified {(trust.rates.verified_completion_rate * 100).toFixed(0)}%</span>
          <span className="text-amber-300">Blocked {(trust.rates.blocked_rate * 100).toFixed(0)}%</span>
          <span className="text-violet-300">Recovery {(trust.rates.recovery_success_rate * 100).toFixed(0)}%</span>
          {trust.confidence.avg_predicted != null && (
            <span className="text-muted-foreground">
              Confidence {(trust.confidence.avg_predicted * 100).toFixed(0)}%
              {trust.confidence.calibration_gap != null && (
                <span className="text-rose-300/80"> · gap {(trust.confidence.calibration_gap * 100).toFixed(0)}%</span>
              )}
            </span>
          )}
          {trust.latency.p95_ms != null && (
            <span className="text-muted-foreground">p95 {(trust.latency.p95_ms / 1000).toFixed(1)}s</span>
          )}
          <span className="text-muted-foreground">
            Interventions {trust.operator.interventions_open} · Approvals {trust.operator.approvals_pending}
          </span>
        </div>
      )}
    </section>
  );
}
