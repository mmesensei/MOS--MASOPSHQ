// Compact Mission Attention panel — surfaces tasks and Sentinel alerts
// that need visibility, without redesigning the /katana Revenue Board.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Clock, UserCheck, Ban, RotateCw, AlertTriangle, ShieldAlert } from "lucide-react";
import { missionAttention } from "@/lib/katana/sentinel.functions";

type Task = {
  id: string;
  agent: string;
  task_kind: string;
  status: string;
  risk_level: string | null;
  next_retry_at: string | null;
};

type Alert = {
  id: string;
  action: string;
  severity: string;
  risk_level: string;
  rationale: string | null;
  created_at: string;
};

const BUCKETS: Array<{
  key: string;
  label: string;
  statuses: string[];
  icon: typeof Activity;
  tint: string;
}> = [
  { key: "running", label: "Running", statuses: ["running"], icon: Activity, tint: "text-cyan-400" },
  { key: "blocked", label: "Blocked", statuses: ["blocked"], icon: Ban, tint: "text-orange-400" },
  { key: "operator", label: "Waiting on you", statuses: ["waiting_on_operator"], icon: UserCheck, tint: "text-amber-400" },
  { key: "dep", label: "Waiting on deps", statuses: ["waiting_on_dependency"], icon: Clock, tint: "text-slate-300" },
  { key: "retry", label: "Retrying", statuses: ["retrying"], icon: RotateCw, tint: "text-violet-400" },
  { key: "failed", label: "Failed", statuses: ["failed"], icon: AlertTriangle, tint: "text-red-400" },
];

export function MissionAttentionPanel() {
  const fn = useServerFn(missionAttention);
  const q = useQuery({
    queryKey: ["katana", "attention"],
    queryFn: () => fn(),
    refetchInterval: 15_000,
  });

  const tasks = (q.data?.tasks ?? []) as Task[];
  const alerts = (q.data?.alerts ?? []) as Alert[];
  const openInterventions = q.data?.open_interventions ?? 0;

  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-white">Mission Attention</h3>
        </div>
        <span className="text-[11px] text-slate-400">
          {openInterventions} open intervention{openInterventions === 1 ? "" : "s"}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {BUCKETS.map((b) => {
          const items = tasks.filter((t) => b.statuses.includes(t.status));
          const Icon = b.icon;
          return (
            <div key={b.key} className="rounded-lg border border-white/5 bg-black/30 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 ${b.tint}`} />
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">{b.label}</span>
                </div>
                <span className="text-sm font-semibold text-white">{items.length}</span>
              </div>
              {items.slice(0, 3).map((t) => (
                <div key={t.id} className="mt-1 truncate text-[11px] text-slate-300" title={t.task_kind}>
                  · {t.agent}: {t.task_kind}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {alerts.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
            Sentinel alerts
          </div>
          <ul className="space-y-1">
            {alerts.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-xs text-slate-300">
                <span
                  className={
                    a.severity === "critical"
                      ? "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                      : a.severity === "high"
                      ? "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400"
                      : "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                  }
                />
                <span className="truncate">
                  <span className="font-medium text-white">{a.action}</span>
                  {a.rationale ? ` — ${a.rationale}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
