// Operator Intervention Center — shows tasks/missions awaiting a decision.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert, CheckCircle2, XCircle, Pause } from "lucide-react";
import { listInterventions, resolveIntervention, listSecurityEvents } from "@/lib/katana/sentinel.functions";

const RISK_TINT: Record<string, string> = {
  low: "text-emerald-400 border-emerald-500/30",
  moderate: "text-amber-400 border-amber-500/30",
  high: "text-orange-400 border-orange-500/30",
  critical: "text-red-400 border-red-500/30",
};

export function KatanaInterventionQueue() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInterventions);
  const eventsFn = useServerFn(listSecurityEvents);
  const resolveFn = useServerFn(resolveIntervention);

  const interventions = useQuery({
    queryKey: ["katana", "interventions"],
    queryFn: () => listFn(),
    refetchInterval: 20_000,
  });
  const events = useQuery({
    queryKey: ["katana", "security-events"],
    queryFn: () => eventsFn(),
    refetchInterval: 30_000,
  });

  const resolveMut = useMutation({
    mutationFn: (vars: { id: string; decision: "approve" | "reject" | "pause" }) =>
      resolveFn({ data: vars }),
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["katana", "interventions"] });
      qc.invalidateQueries({ queryKey: ["katana", "security-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = interventions.data ?? [];
  const recentEvents = (events.data ?? []).slice(0, 5);

  return (
    <section className="mb-4 rounded-lg border border-border/60 bg-surface/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-katana" />
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Sentinel · Intervention Queue
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {items.length} open · {recentEvents.length} recent security events
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded border border-dashed border-border/40 p-4 text-xs text-muted-foreground">
          No decisions pending. Sentinel will surface anything that needs your input here.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const risk = (it as { risk_level: string }).risk_level;
            return (
              <li
                key={(it as { id: string }).id}
                className={`rounded-md border bg-background/40 p-3 ${RISK_TINT[risk] ?? "border-border/60"}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider">{risk} risk</span>
                      <span className="text-xs font-medium">{(it as { title: string }).title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{(it as { reason: string }).reason}</p>
                    {(it as { recommended_action: string | null }).recommended_action && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Recommended: {(it as { recommended_action: string }).recommended_action}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={() =>
                        resolveMut.mutate({ id: (it as { id: string }).id, decision: "approve" })
                      }
                      disabled={resolveMut.isPending}
                      className="inline-flex items-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
                      title="Approve"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </button>
                    <button
                      onClick={() =>
                        resolveMut.mutate({ id: (it as { id: string }).id, decision: "pause" })
                      }
                      disabled={resolveMut.isPending}
                      className="inline-flex items-center gap-1 rounded border border-amber-500/40 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/10 disabled:opacity-40"
                      title="Pause"
                    >
                      <Pause className="h-3 w-3" /> Pause
                    </button>
                    <button
                      onClick={() =>
                        resolveMut.mutate({ id: (it as { id: string }).id, decision: "reject" })
                      }
                      disabled={resolveMut.isPending}
                      className="inline-flex items-center gap-1 rounded border border-red-500/40 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                      title="Reject"
                    >
                      <XCircle className="h-3 w-3" /> Reject
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {recentEvents.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Recent Sentinel events
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
            {recentEvents.map((e) => {
              const ev = e as { id: string; created_at: string; stage: string; action: string; decision: string; risk_level: string };
              return (
                <li key={ev.id} className="flex gap-2">
                  <span className="text-muted-foreground/60">{new Date(ev.created_at).toLocaleTimeString()}</span>
                  <span className="uppercase">[{ev.risk_level}]</span>
                  <span>{ev.stage}</span>
                  <span>·</span>
                  <span>{ev.action}</span>
                  <span className="ml-auto">{ev.decision}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
