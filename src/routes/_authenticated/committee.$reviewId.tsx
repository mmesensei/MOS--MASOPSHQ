import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { ExecutivePresence } from "@/components/executive-presence";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getReview, runDeliberation, recordOutcome } from "@/lib/committee.functions";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Gavel, CheckCircle2, HelpCircle, XCircle, Beaker, Lock, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/committee/$reviewId")({
  component: BoardroomPage,
});

const EXECS = ["iris", "apex", "katana", "sentinel"] as const;
type Exec = (typeof EXECS)[number];

const EXEC_META: Record<Exec, { title: string; role: string; scoreKey: string; badge: string }> = {
  iris:     { title: "IRIS",     role: "Chief Strategy Officer",   scoreKey: "strategic",   badge: "bg-iris/15 text-iris" },
  apex:     { title: "APEX",     role: "Chief Operations Officer", scoreKey: "operational", badge: "bg-apex/15 text-apex" },
  katana:   { title: "KATANA",   role: "Chief Execution Officer",  scoreKey: "execution",   badge: "bg-katana/15 text-katana" },
  sentinel: { title: "SENTINEL", role: "Chief Risk Officer",       scoreKey: "risk",        badge: "bg-sentinel/15 text-sentinel" },
};

const STANCE_META: Record<string, { label: string; className: string }> = {
  thinking:  { label: "Thinking",  className: "bg-surface text-muted-foreground animate-pulse" },
  agree:     { label: "Agrees",    className: "bg-emerald-500/15 text-emerald-400" },
  partial:   { label: "Partial",   className: "bg-primary/15 text-primary" },
  challenge: { label: "Challenges", className: "bg-amber-500/15 text-amber-400" },
  escalate:  { label: "Escalates", className: "bg-destructive/15 text-destructive" },
  abstain:   { label: "Abstains",  className: "bg-surface text-muted-foreground" },
};

const DECISION_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  approve:                  { label: "APPROVED",              className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  approve_with_conditions:  { label: "APPROVED w/ CONDITIONS",className: "bg-primary/15 text-primary border-primary/30",           icon: CheckCircle2 },
  run_pilot:                { label: "RUN PILOT",             className: "bg-katana/15 text-katana border-katana/30",              icon: Beaker },
  request_more_data:        { label: "MORE DATA NEEDED",      className: "bg-amber-500/15 text-amber-400 border-amber-500/30",    icon: HelpCircle },
  reject:                   { label: "REJECTED",              className: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
};

function BoardroomPage() {
  const { reviewId } = Route.useParams();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const qc = useQueryClient();

  const data = useQuery({
    queryKey: ["committee.review", reviewId],
    queryFn: () => getReview({ data: { id: reviewId } }),
    enabled: isAdmin,
    refetchInterval: (q) => {
      const phase = q.state.data?.review?.phase;
      return phase && phase !== "decided" && phase !== "error" ? 1500 : false;
    },
  });

  // Realtime — light up seats as positions land.
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase.channel(`committee:${reviewId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "committee_positions", filter: `review_id=eq.${reviewId}` },
        () => qc.invalidateQueries({ queryKey: ["committee.review", reviewId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "committee_reviews", filter: `id=eq.${reviewId}` },
        () => qc.invalidateQueries({ queryKey: ["committee.review", reviewId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, reviewId, qc]);

  const rerun = useMutation({
    mutationFn: () => runDeliberation({ data: { reviewId } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Deliberation failed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["committee.review", reviewId] }),
  });

  const outcome = useMutation({
    mutationFn: (v: { outcome: string; actual_roi_pct?: number; notes?: string }) =>
      recordOutcome({ data: { reviewId, ...v } }),
    onSuccess: () => { toast.success("Outcome recorded — board memory updated"); qc.invalidateQueries({ queryKey: ["committee.review", reviewId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (adminLoading) return <MosShell><div className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">Verifying access…</div></MosShell>;
  if (!isAdmin) {
    return <MosShell><div className="mx-auto max-w-2xl px-6 py-24 text-center"><Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><h1 className="font-display text-2xl font-semibold">Boardroom is Operator-only.</h1></div></MosShell>;
  }

  if (data.isLoading || !data.data) {
    return <MosShell><div className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">Loading boardroom…</div></MosShell>;
  }

  const { review, positions, outcome: prior } = data.data;
  const positionsByExec = new Map(positions.map((p) => [p.executive as Exec, p]));
  const inProgress = review.phase !== "decided" && review.phase !== "error";
  const decisionMeta = review.decision ? DECISION_META[review.decision] : null;
  const DecisionIcon = decisionMeta?.icon;

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/committee" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Committee
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">
            <Gavel className="h-3.5 w-3.5" /> Board Session
            {inProgress && review.current_speaker && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {review.current_speaker.toUpperCase()} has the floor
              </span>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{review.title}</h1>
          {review.summary && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{review.summary}</p>}
          <div className="mt-1 text-[11px] text-muted-foreground">
            Opened {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
            {review.decided_at && <> · Decided {formatDistanceToNow(new Date(review.decided_at), { addSuffix: true })}</>}
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {EXECS.map((exec) => {
            const p = positionsByExec.get(exec);
            const meta = EXEC_META[exec];
            const stance = STANCE_META[p?.stance ?? "thinking"];
            const speaking = review.current_speaker === exec && inProgress;
            const state: "listening" | "thinking" | "speaking" | "reviewing" =
              !p ? "listening" : p.is_streaming || speaking ? "thinking" : review.decision ? "speaking" : "reviewing";
            const scores = (p?.scores as Record<string, number> | null) ?? null;
            const scoreVal = scores?.[meta.scoreKey];
            return (
              <div key={exec} className={`hq-panel p-4 transition ${speaking ? "border-primary/60 shadow-[0_0_0_1px_rgb(var(--primary)/0.4)]" : ""}`}>
                <div className="flex items-center gap-3">
                  <ExecutivePresence executive={exec} state={state} size="chip" />
                  <div className="min-w-0">
                    <div className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest ${meta.badge}`}>{meta.title}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{meta.role}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest ${stance.className}`}>{stance.label}</span>
                  {p && !p.is_streaming && <span className="text-[10px] font-mono text-muted-foreground">{p.confidence}% conf</span>}
                </div>
                {p?.key_concern && !p.is_streaming && (
                  <div className="mt-3 rounded border border-border/40 bg-background/30 p-2 text-[11px] italic text-foreground/85">
                    "{p.key_concern}"
                  </div>
                )}
                {p?.rationale && !p.is_streaming && (
                  <p className="mt-2 text-xs text-foreground/85">{p.rationale}</p>
                )}
                {p?.recommendation && !p.is_streaming && (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    <span className="font-mono uppercase tracking-widest">Recommends:</span> {p.recommendation}
                  </div>
                )}
                {scoreVal != null && (
                  <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px]">
                    <span className="font-mono uppercase tracking-widest text-muted-foreground">{meta.scoreKey === "risk" ? "Safety" : meta.scoreKey}</span>
                    <span className={`font-semibold ${scoreVal >= 70 ? "text-emerald-400" : scoreVal >= 40 ? "text-amber-400" : "text-destructive"}`}>{scoreVal}/100</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CONSENSUS + DECISION */}
        {review.phase === "decided" && decisionMeta && DecisionIcon && (
          <div className={`mt-8 rounded-lg border p-6 ${decisionMeta.className}`}>
            <div className="flex items-center gap-3">
              <DecisionIcon className="h-6 w-6" />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-70">Board Decision</div>
                <div className="font-display text-2xl font-semibold tracking-tight">{decisionMeta.label}</div>
              </div>
            </div>
            {review.decision_rationale && <p className="mt-3 text-sm">{review.decision_rationale}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              <ConsensusBar label="Strategy"   value={review.strategic_score} />
              <ConsensusBar label="Operations" value={review.operational_score} />
              <ConsensusBar label="Execution"  value={review.execution_score} />
              <ConsensusBar label="Safety"     value={review.risk_score} />
              <ConsensusBar label="Confidence" value={review.confidence_score} />
              <ConsensusBar label="Alignment"  value={review.alignment_score} />
            </div>
            {Array.isArray(review.conditions) && review.conditions.length > 0 && (
              <div className="mt-4 rounded-md border border-current/20 bg-background/40 p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest opacity-70">Conditions & concerns</div>
                <ul className="mt-2 space-y-1 text-xs">
                  {(review.conditions as { from: string; condition: string; recommendation: string }[]).map((c, i) => (
                    <li key={i}><span className="font-mono uppercase tracking-widest">{c.from}:</span> {c.condition}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {review.phase === "decided" && (
          <div className="hq-panel mt-6 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Record outcome</h2>
              <span className="text-[10px] text-muted-foreground">Feeds the board's learning loop.</span>
            </div>
            {prior ? (
              <div className="text-sm text-foreground/85">
                Recorded: <strong>{prior.outcome}</strong>
                {prior.actual_roi_pct != null && <> · actual ROI {prior.actual_roi_pct}%</>}
                {prior.notes && <div className="mt-1 text-xs italic text-muted-foreground">"{prior.notes}"</div>}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(["win", "partial", "loss", "abandoned"] as const).map((o) => (
                  <button key={o} onClick={() => {
                      const roi = prompt(`Actual ROI % (leave blank if unknown):`);
                      const notes = prompt(`Notes for the board's memory (optional):`);
                      outcome.mutate({ outcome: o, actual_roi_pct: roi ? Number(roi) : undefined, notes: notes ?? undefined });
                    }}
                    className="rounded-md bg-surface px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:bg-primary/15 hover:text-primary">
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {review.phase === "error" && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Deliberation errored. {review.error ?? ""}
            <button onClick={() => rerun.mutate()} className="ml-2 underline">Retry</button>
          </div>
        )}

        {!inProgress && review.phase === "decided" && (
          <div className="mt-6 flex justify-end">
            <button onClick={() => rerun.mutate()} disabled={rerun.isPending} className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-40">
              {rerun.isPending ? "Reconvening…" : "Reconvene the board"}
            </button>
          </div>
        )}
      </div>
    </MosShell>
  );
}

function ConsensusBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest opacity-70">
        <span>{label}</span><span>{value ?? "—"}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-background/40">
        <div className="h-full bg-current" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
