import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { createReview, listReviews, runDeliberation } from "@/lib/committee.functions";
import { Users, Gavel, Send, Lock, AlertTriangle, CheckCircle2, Beaker, HelpCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/committee")({
  component: CommitteePage,
});

const DECISION_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  approve:                  { label: "Approve",             className: "bg-emerald-500/15 text-emerald-400", icon: CheckCircle2 },
  approve_with_conditions:  { label: "Approve w/ conditions", className: "bg-primary/15 text-primary",         icon: CheckCircle2 },
  run_pilot:                { label: "Run pilot",           className: "bg-katana/15 text-katana",           icon: Beaker },
  request_more_data:        { label: "Request more data",   className: "bg-amber-500/15 text-amber-400",     icon: HelpCircle },
  reject:                   { label: "Reject",              className: "bg-destructive/15 text-destructive", icon: XCircle },
};

function CommitteePage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const reviews = useQuery({
    queryKey: ["committee.list"],
    queryFn: () => listReviews({ data: {} }),
    enabled: isAdmin,
    refetchInterval: (q) => (q.state.data?.some((r) => r.phase !== "decided" && r.phase !== "error") ? 3000 : false),
  });

  const create = useMutation({
    mutationFn: () => createReview({ data: { subject_type: "manual", title: title.trim(), summary: summary.trim() || undefined, context: {} } }),
    onSuccess: async ({ id }) => {
      toast.success("Convening the board…");
      setTitle(""); setSummary("");
      qc.invalidateQueries({ queryKey: ["committee.list"] });
      // Kick deliberation in background; UI streams via realtime.
      runDeliberation({ data: { reviewId: id } }).catch((e) => toast.error(e instanceof Error ? e.message : "Deliberation failed"));
      navigate({ to: "/committee/$reviewId", params: { reviewId: id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to open review"),
  });

  if (isLoading) return <MosShell><div className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">Verifying access…</div></MosShell>;
  if (!isAdmin) {
    return (
      <MosShell>
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="font-display text-2xl font-semibold">Executive Committee is Operator-only.</h1>
          <Link to="/hq" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Return to HQ</Link>
        </div>
      </MosShell>
    );
  }

  const rows = reviews.data ?? [];
  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">
              <Gavel className="h-3.5 w-3.5" /> Executive Committee
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">The board meets when you call it.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              IRIS proposes. APEX weighs execution. KATANA plans the strike. SENTINEL challenges every assumption.
              You watch the debate, hear the concerns, and receive a board-level recommendation.
            </p>
          </div>
          <Link
            to="/committee/calibration"
            className="shrink-0 rounded-md border border-border/60 bg-surface px-3 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            Calibration →
          </Link>
        </header>


        <div className="hq-panel mb-8 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Convene the board</h2>
          </div>
          <div className="grid gap-3">
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal title — one line"
              className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
            <textarea
              value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
              placeholder="Context. What's the play? What are the numbers? What's your ask of the board?"
              className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
            <div className="flex justify-end">
              <button
                onClick={() => create.mutate()}
                disabled={!title.trim() || create.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> {create.isPending ? "Convening…" : "Send to Committee"}
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Recent decisions</div>
          {rows.length === 0 ? (
            <div className="hq-panel p-8 text-center text-sm text-muted-foreground">No reviews yet. The board is standing by.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((r) => {
                const meta = r.decision ? DECISION_META[r.decision] : null;
                const Icon = meta?.icon;
                const inProgress = r.phase !== "decided" && r.phase !== "error";
                return (
                  <Link key={r.id} to="/committee/$reviewId" params={{ reviewId: r.id }} className="hq-panel block p-4 transition hover:border-primary/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                          <span className="rounded bg-surface px-1.5 py-0.5">{r.subject_type}</span>
                          {inProgress && <span className="inline-flex items-center gap-1 text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> {r.phase}</span>}
                        </div>
                        <h3 className="mt-1.5 font-display text-base font-semibold leading-snug">{r.title}</h3>
                      </div>
                      {meta && Icon && (
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-widest ${meta.className}`}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                      )}
                    </div>
                    {r.decision && (
                      <div className="mt-3 grid grid-cols-4 gap-1.5 text-[10px]">
                        <MiniScore label="Strategy" value={r.strategic_score} />
                        <MiniScore label="Ops" value={r.operational_score} />
                        <MiniScore label="Exec" value={r.execution_score} />
                        <MiniScore label="Safety" value={r.risk_score} />
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-muted-foreground">Opened {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="hidden">{[AlertTriangle].map((_, i) => <span key={i} />)}</div>
    </MosShell>
  );
}

function MiniScore({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = v >= 70 ? "text-emerald-400" : v >= 40 ? "text-amber-400" : "text-destructive";
  return (
    <div className="rounded bg-background/40 px-1.5 py-1 text-center">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-semibold ${color}`}>{value ?? "—"}</div>
    </div>
  );
}
