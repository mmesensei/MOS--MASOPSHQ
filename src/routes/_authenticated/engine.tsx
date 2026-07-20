import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { RouteError } from "@/components/route-error";
import { ExecutivePresence } from "@/components/executive-presence";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getActiveGoal, upsertGoal, listOpportunities, scanOpportunities, setOpportunityStatus } from "@/lib/engine.functions";
import { createReview, runDeliberation } from "@/lib/committee.functions";
import { Sparkles, Target, ShieldCheck, Zap, Skull, CheckCircle2, PlayCircle, TrendingUp, DollarSign, Clock, AlertTriangle, Lock, Gavel } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/engine")({
  component: EnginePage,
  errorComponent: RouteError,
});

function AdminOnlyGate() {
  return (
    <MosShell>
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Restricted Surface</div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Opportunity Lab is Operator-only.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          A private research and planning workspace. Every request is verified server-side against the role registry — client tricks won't reach the data. MOS never receives, holds, invests, trades, or transfers funds; any financial action happens through your own regulated accounts, after your own review.
        </p>
        <Link to="/hq" className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Return to Headquarters
        </Link>
      </div>
    </MosShell>
  );
}


const CHANNEL_STYLE: Record<string, { label: string; badge: string; icon: string }> = {
  digital:   { label: "Digital",   badge: "bg-iris/15 text-iris",         icon: "📦" },
  ecom:      { label: "E-com",     badge: "bg-apex/15 text-apex",         icon: "🛒" },
  affiliate: { label: "Affiliate", badge: "bg-katana/15 text-katana",     icon: "📣" },
  brokerage: { label: "Yield",     badge: "bg-sentinel/15 text-sentinel", icon: "🏦" },
};

function EnginePage() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const qc = useQueryClient();
  const goal = useQuery({
    queryKey: ["engine.goal"],
    queryFn: () => getActiveGoal(),
    enabled: isAdmin,
  });
  const [showForm, setShowForm] = useState(false);

  if (adminLoading) {
    return <MosShell><div className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">Verifying access…</div></MosShell>;
  }
  if (!isAdmin) return <AdminOnlyGate />;

  useEffect(() => {
    if (goal.data === null) setShowForm(true);
  }, [goal.data]);

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Opportunity Lab</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              IRIS is researching business opportunities for your review.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Set your working capital range, target, and risk envelope. IRIS surfaces vetted business plays across your allowed channels for you to evaluate.
              Nothing runs without your explicit approval, and MOS never receives, holds, invests, trades, or transfers funds — any real-world action happens through your own regulated accounts. Results vary; no outcome is guaranteed.
            </p>
          </div>
          <div className="hidden md:block">
            <ExecutivePresence executive="iris" state={goal.data ? "thinking" : "listening"} size="bust" />
          </div>
        </header>


        {goal.isLoading && <div className="hq-panel p-6 text-sm text-muted-foreground">Loading your goal…</div>}

        {!goal.isLoading && (showForm || !goal.data) && (
          <GoalForm goal={goal.data ?? null} onDone={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["engine.goal"] }); }} />
        )}

        {!goal.isLoading && goal.data && !showForm && (
          <>
            <GoalCard goal={goal.data} onEdit={() => setShowForm(true)} />
            <OpportunityBoard goalId={goal.data.id} channels={["digital", "ecom", "affiliate", "brokerage"]} />
          </>
        )}
      </div>
    </MosShell>
  );
}

// ---------- GOAL FORM ----------

type Goal = NonNullable<Awaited<ReturnType<typeof getActiveGoal>>>;

function GoalForm({ goal, onDone }: { goal: Goal | null; onDone: () => void }) {
  const [starting, setStarting] = useState(goal ? String(goal.starting_capital) : "50");
  const [target, setTarget] = useState(goal ? String(goal.target_capital) : "500");
  const [days, setDays] = useState(goal ? String(goal.timeframe_days) : "60");
  const [risk, setRisk] = useState(goal ? goal.risk_tolerance : 3);
  const [autonomy, setAutonomy] = useState(goal ? String(goal.autonomy_threshold_usd) : "10");
  const [notes, setNotes] = useState(goal?.notes ?? "");

  const save = useMutation({
    mutationFn: () => upsertGoal({ data: {
      id: goal?.id,
      starting_capital: Number(starting),
      current_capital: goal ? Number(goal.current_capital) : Number(starting),
      target_capital: Number(target),
      timeframe_days: Number(days),
      risk_tolerance: risk,
      autonomy_threshold_usd: Number(autonomy),
      notes: notes.trim() || undefined,
    } }),
    onSuccess: () => { toast.success(goal ? "Goal updated" : "Planning goal set"); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const s = Number(starting) || 0;
  const t = Number(target) || 0;
  const d = Number(days) || 1;
  const multiplier = s > 0 ? t / s : 0;
  const dailyPct = multiplier > 1 ? (Math.pow(multiplier, 1 / d) - 1) * 100 : 0;
  const realistic = dailyPct <= 5;

  return (
    <div className="hq-panel p-6">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">{goal ? "Edit planning goal" : "Set your planning goal"}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Working capital (USD)"><input type="number" min={0} step={1} value={starting} onChange={(e) => setStarting(e.target.value)} className={inputCls} /></Field>
        <Field label="Target (USD)"><input type="number" min={1} step={1} value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} /></Field>
        <Field label="Timeframe (days)"><input type="number" min={1} step={1} value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} /></Field>

        <Field label={`Risk tolerance: ${risk}/5`}>
          <input type="range" min={1} max={5} value={risk} onChange={(e) => setRisk(Number(e.target.value))} className="w-full" />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>preserve</span><span>aggressive</span></div>
        </Field>
        <Field label="Approval threshold (USD)">
          <input type="number" min={0} step={1} value={autonomy} onChange={(e) => setAutonomy(e.target.value)} className={inputCls} />
          <div className="mt-1 text-[10px] text-muted-foreground">Under this = MOS may prepare and stage the next step. Any external, financial, or publishing action still requires your explicit approval and runs through your own accounts.</div>
        </Field>
        <Field label="Notes for IRIS (skills, constraints, preferences)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="e.g. no ecommerce, US-based, writing background…" />
        </Field>
      </div>

      <div className="mt-4 rounded-md border border-border/60 bg-background/40 p-3 text-xs">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono uppercase tracking-widest text-muted-foreground">Growth math (planning only — no guarantees)</span>
        </div>
        <div className="mt-1">
          {multiplier > 0 ? (
            <>
              <span className="text-foreground/90">{multiplier.toFixed(2)}× in {d} days implies ~<span className={realistic ? "text-emerald-400" : "text-destructive"}>{dailyPct.toFixed(2)}% daily growth</span> to hit target</span>
              {!realistic && (
                <div className="mt-1 flex items-start gap-1.5 text-destructive">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>SENTINEL note: anything requiring &gt;5%/day is speculation, not planning. IRIS will propose the best realistic options and be honest about the gap. Results always depend on your own execution.</span>
                </div>
              )}
            </>
          ) : <span className="text-muted-foreground">Enter capital and target.</span>}
        </div>
      </div>


      <div className="mt-4 flex justify-end gap-2">
        {goal && <button onClick={onDone} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button>}
        <button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40">
          <Sparkles className="h-4 w-4" /> {save.isPending ? "Saving…" : goal ? "Update goal" : "Start planning"}
        </button>

      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/60";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>{children}</label>;
}

// ---------- GOAL CARD ----------

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const cur = Number(goal.current_capital);
  const start = Number(goal.starting_capital);
  const tgt = Number(goal.target_capital);
  const progress = Math.min(100, Math.max(0, ((cur - start) / Math.max(tgt - start, 1)) * 100));
  return (
    <div className="hq-panel mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Active goal</div>
          <div className="mt-1 font-display text-2xl font-semibold">
            ${cur.toFixed(2)} <span className="text-muted-foreground">→</span> ${tgt.toFixed(2)}
            <span className="ml-3 text-sm font-normal text-muted-foreground">in {goal.timeframe_days} days</span>
          </div>
          <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-gradient-to-r from-iris via-apex to-sentinel" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{progress.toFixed(1)}% of the way</div>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <span className="rounded-md bg-surface px-2 py-1 font-mono uppercase tracking-widest text-muted-foreground">Risk {goal.risk_tolerance}/5</span>
          <span className="rounded-md bg-surface px-2 py-1 font-mono uppercase tracking-widest text-muted-foreground">Prep ≤ ${Number(goal.autonomy_threshold_usd).toFixed(0)}</span>
          <button onClick={onEdit} className="text-xs text-muted-foreground underline hover:text-foreground">Edit goal</button>
        </div>

      </div>
    </div>
  );
}

// ---------- OPPORTUNITY BOARD ----------

function OpportunityBoard({ goalId, channels }: { goalId: string; channels: string[] }) {
  const qc = useQueryClient();
  const opps = useQuery({ queryKey: ["engine.opps", goalId], queryFn: () => listOpportunities({ data: { goalId } }) });
  const scan = useMutation({
    mutationFn: () => scanOpportunities({ data: { goalId, channels, count: 6 } }),
    onSuccess: (r) => { toast.success(`IRIS surfaced ${r.inserted} play${r.inserted === 1 ? "" : "s"}`); qc.invalidateQueries({ queryKey: ["engine.opps", goalId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Scan failed"),
  });

  const rows = opps.data ?? [];
  const proposed = rows.filter((r) => r.status === "proposed");
  const active = rows.filter((r) => r.status === "approved" || r.status === "active");
  const done = rows.filter((r) => ["completed", "killed", "rejected"].includes(r.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Opportunity board</h2>
          <p className="text-xs text-muted-foreground">IRIS ranks plays by fit, risk, and confidence.</p>
        </div>
        <button onClick={() => scan.mutate()} disabled={scan.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-iris/15 px-4 py-2 text-sm font-medium text-iris hover:bg-iris/25 disabled:opacity-40">
          <Sparkles className="h-4 w-4" /> {scan.isPending ? "IRIS scanning…" : "Scan for opportunities"}
        </button>
      </div>

      <Section title="Proposed — awaiting your call" empty="Nothing staged yet. Trigger a scan." rows={proposed} goalId={goalId} />
      {active.length > 0 && <Section title="In play" empty="" rows={active} goalId={goalId} />}
      {done.length > 0 && <Section title="Archive" empty="" rows={done} goalId={goalId} />}
    </div>
  );
}

function Section({ title, empty, rows, goalId }: { title: string; empty: string; rows: Awaited<ReturnType<typeof listOpportunities>>; goalId: string }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        empty ? <div className="hq-panel p-6 text-center text-sm text-muted-foreground">{empty}</div> : null
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => <OpportunityCard key={r.id} row={r} goalId={goalId} />)}
        </div>
      )}
    </div>
  );
}

function OpportunityCard({ row, goalId }: { row: Awaited<ReturnType<typeof listOpportunities>>[number]; goalId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const style = CHANNEL_STYLE[row.channel] ?? { label: row.channel, badge: "bg-surface text-muted-foreground", icon: "•" };
  const setStatus = useMutation({
    mutationFn: (v: { status: string; kill_reason?: string; actual_return_usd?: number }) => setOpportunityStatus({ data: { id: row.id, ...v } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["engine.opps", goalId] }); qc.invalidateQueries({ queryKey: ["engine.goal"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const sendToCommittee = useMutation({
    mutationFn: async () => {
      const existing = (row as unknown as { committee_review_id?: string | null }).committee_review_id;
      if (existing) return { id: existing };
      const res = await createReview({ data: {
        subject_type: "opportunity",
        subject_id: row.id,
        title: row.title,
        summary: row.thesis,
        context: {
          channel: row.channel, capital_required: row.capital_required,
          projected_return_usd: row.projected_return_usd, projected_roi_pct: row.projected_roi_pct,
          timeframe_days: row.timeframe_days, risk_score: row.risk_score,
          effort_score: row.effort_score, confidence: row.confidence,
          evidence: row.evidence, playbook: row.playbook,
        },
      } });
      runDeliberation({ data: { reviewId: res.id } }).catch(() => {});
      return res;
    },
    onSuccess: ({ id }) => { toast.success("Board convened"); navigate({ to: "/committee/$reviewId", params: { reviewId: id } }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const playbook = Array.isArray(row.playbook) ? (row.playbook as { step?: number; action?: string; owner?: string; requires_approval?: boolean }[]) : [];

  return (
    <div className="hq-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
            <span className={`rounded px-1.5 py-0.5 ${style.badge}`}>{style.icon} {style.label}</span>
            <span className="rounded bg-surface px-1.5 py-0.5 text-muted-foreground">Risk {row.risk_score}/5</span>
            <span className="rounded bg-surface px-1.5 py-0.5 text-muted-foreground">Effort {row.effort_score}/5</span>
            <span className="rounded bg-surface px-1.5 py-0.5 text-muted-foreground">{row.confidence}% confidence</span>
          </div>
          <h3 className="mt-2 font-display text-base font-semibold leading-snug">{row.title}</h3>
        </div>
      </div>

      <p className="mt-2 text-sm text-foreground/85">{row.thesis}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Metric icon={DollarSign} label="Capital"    value={`$${Number(row.capital_required).toFixed(0)}`} />
        <Metric icon={TrendingUp} label="Return"     value={`+$${Number(row.projected_return_usd).toFixed(0)}`} sub={`${Number(row.projected_roi_pct).toFixed(0)}% ROI`} />
        <Metric icon={Clock}      label="Timeframe"  value={`${row.timeframe_days}d`} />
      </div>

      {row.evidence && (
        <div className="mt-2 rounded border border-border/40 bg-background/30 p-2 text-[11px] italic text-muted-foreground">
          {row.evidence}
        </div>
      )}

      {playbook.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">Playbook ({playbook.length} steps)</summary>
          <ol className="mt-2 space-y-1 text-xs text-foreground/85">
            {playbook.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{s.step ?? i + 1}</span>
                <div className="flex-1">
                  <span>{s.action}</span>
                  {s.owner && <span className="ml-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">— {s.owner}</span>}
                  {s.requires_approval && <span className="ml-1.5 rounded bg-destructive/15 px-1 py-0.5 text-[9px] uppercase tracking-widest text-destructive">approval</span>}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 text-xs">
        <span className="text-muted-foreground">Staged {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span>
        <div className="flex items-center gap-2">
          {row.status === "proposed" && (
            <>
              <button onClick={() => setStatus.mutate({ status: "rejected" })} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Reject">
                <Skull className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => sendToCommittee.mutate()} disabled={sendToCommittee.isPending} className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40" title="Send to Executive Committee">
                <Gavel className="h-3.5 w-3.5" /> {sendToCommittee.isPending ? "Convening…" : "Committee"}
              </button>
              <button onClick={() => setStatus.mutate({ status: "approved" })} className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 font-medium text-primary hover:bg-primary/25">
                <ShieldCheck className="h-3.5 w-3.5" /> Approve
              </button>
            </>
          )}
          {row.status === "approved" && (
            <button onClick={() => setStatus.mutate({ status: "active" })} className="inline-flex items-center gap-1 rounded-md bg-katana/15 px-2 py-1 font-medium text-katana hover:bg-katana/25">
              <PlayCircle className="h-3.5 w-3.5" /> Launch
            </button>
          )}
          {row.status === "active" && (
            <>
              <button onClick={() => { const r = prompt("Why kill?"); if (r) setStatus.mutate({ status: "killed", kill_reason: r }); }} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Kill">
                <Skull className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { const v = prompt("Actual net return $ (recycles into capital):"); if (v != null) setStatus.mutate({ status: "completed", actual_return_usd: Number(v) }); }} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 font-medium text-emerald-400 hover:bg-emerald-500/25">
                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
              </button>
            </>
          )}
          {["completed", "killed", "rejected"].includes(row.status) && (
            <span className="rounded bg-surface px-1.5 py-0.5 font-mono uppercase tracking-widest text-muted-foreground">{row.status}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: typeof DollarSign; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-background/40 p-2">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// silence lint
void Zap;
