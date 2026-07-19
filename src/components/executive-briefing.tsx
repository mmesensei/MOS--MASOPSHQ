// Executive Briefing — the "What your executives noticed" panel plus per-avatar
// speech bubbles. Uses the awareness engine to display proactive observations.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bell, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { ExecutivePresence } from "@/components/executive-presence";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import {
  acknowledgeObservation,
  dismissObservation,
  generateObservations,
  listObservations,
} from "@/lib/awareness.functions";

export interface Observation {
  id: string;
  executive: ExecutiveId;
  kind: string;
  headline: string;
  reasoning: string | null;
  recommended_action: string | null;
  score: number;
  trigger: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

const COLOR: Record<ExecutiveId, string> = {
  iris: "text-iris",
  apex: "text-apex",
  katana: "text-katana",
  sentinel: "text-sentinel",
};
const BORDER: Record<ExecutiveId, string> = {
  iris: "border-iris/40",
  apex: "border-apex/40",
  katana: "border-katana/40",
  sentinel: "border-sentinel/40",
};

/** Trigger a workspace scan on mount. Debounced by the server cooldown. */
export function useAwarenessScan(trigger: string, currentPage?: string) {
  const qc = useQueryClient();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    generateObservations({ data: { trigger: trigger as never, currentPage } })
      .then((r) => {
        if (r && "inserted" in r && r.inserted > 0) {
          qc.invalidateQueries({ queryKey: ["observations"] });
        }
      })
      .catch(() => void 0);
  }, [trigger, currentPage, qc]);
}

/** Fires a toast + red-badge alert when a critical (score 5) observation lands. */
function useCriticalToasts(observations: Observation[]) {
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const o of observations) {
      if (o.score < 5) continue;
      if (seen.current.has(o.id)) continue;
      seen.current.add(o.id);
      toast.error(`${o.executive.toUpperCase()} — ${o.headline}`, {
        description: o.recommended_action ?? undefined,
        duration: 8000,
      });
    }
  }, [observations]);
}

export function ExecutiveBriefingFeed() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["observations"],
    queryFn: () => listObservations({ data: { limit: 12 } }) as unknown as Promise<Observation[]>,
    refetchInterval: 45_000,
  });
  const observations = q.data ?? [];
  useCriticalToasts(observations);

  const dismissM = useMutation({
    mutationFn: (id: string) => dismissObservation({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["observations"] }),
  });
  const ackM = useMutation({
    mutationFn: (id: string) => acknowledgeObservation({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["observations"] }),
  });

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Executive Awareness</div>
          <h2 className="mt-1 font-display text-xl font-semibold">What your executives noticed</h2>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
          <Bell className="h-3 w-3" /> {observations.length} open
        </div>
      </div>

      {observations.length === 0 ? (
        <div className="hq-panel p-6 text-center text-sm text-muted-foreground">
          The executives are still surveying your workspace. Observations appear here as they surface.
        </div>
      ) : (
        <div className="hq-panel divide-y divide-border/50 p-2">
          {observations.map((o) => {
            const exec = EXECUTIVES[o.executive];
            const critical = o.score >= 4;
            return (
              <div key={o.id} className={`flex items-start gap-3 p-3 ${critical ? "bg-destructive/5" : ""}`}>
                <div className="flex-shrink-0">
                  <ExecutivePresence executive={o.executive} state="reviewing" size="chip" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-mono uppercase tracking-widest ${COLOR[o.executive]}`}>{exec.name}</span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">{o.kind.replace(/_/g, " ")}</span>
                    <ScoreBadge score={o.score} />
                    <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground/95">{o.headline}</p>
                  {o.reasoning && <p className="mt-1 text-xs text-muted-foreground">{o.reasoning}</p>}
                  {o.recommended_action && (
                    <p className={`mt-2 text-xs ${COLOR[o.executive]}`}>
                      <span className="font-mono uppercase tracking-widest opacity-70">Next →</span> {o.recommended_action}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1">
                  <button
                    onClick={() => ackM.mutate(o.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                    title="Acknowledge"
                  ><Check className="h-3.5 w-3.5" /></button>
                  <button
                    onClick={() => dismissM.mutate(o.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                    title="Dismiss"
                  ><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const label = ["", "Info", "Useful", "Important", "High Priority", "Critical"][score] ?? "Info";
  const cls =
    score >= 5 ? "bg-destructive/20 text-destructive border-destructive/30" :
    score === 4 ? "bg-katana/15 text-katana border-katana/30" :
    score === 3 ? "bg-primary/15 text-primary border-primary/30" :
    "bg-surface text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${cls}`}>
      {score >= 4 && <AlertTriangle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

/** Speech bubble anchored to a specific executive's avatar. */
export function ExecutiveSpeechBubble({ executive }: { executive: ExecutiveId }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["observations", executive],
    queryFn: () => listObservations({ data: { executive, limit: 3 } }) as unknown as Promise<Observation[]>,
    refetchInterval: 45_000,
  });
  const top = useMemo(() => (q.data ?? []).find((o) => !o.acknowledged_at) ?? null, [q.data]);
  const dismissM = useMutation({
    mutationFn: (id: string) => dismissObservation({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: ["observations", executive] });
    },
  });

  if (!top) return null;

  return (
    <div className={`absolute -top-2 left-full ml-2 z-10 hidden w-56 rounded-lg border ${BORDER[executive]} bg-background/95 p-2 shadow-lg backdrop-blur md:block`}>
      <div className={`text-[9px] font-mono uppercase tracking-widest ${COLOR[executive]}`}>Noticed</div>
      <p className="mt-1 text-xs leading-snug text-foreground/95">{top.headline}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(top.created_at), { addSuffix: true })}</span>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismissM.mutate(top.id); }}
          className="rounded p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          title="Dismiss"
        ><X className="h-3 w-3" /></button>
      </div>
    </div>
  );
}
