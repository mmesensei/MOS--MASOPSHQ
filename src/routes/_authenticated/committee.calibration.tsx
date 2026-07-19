// Calibration dashboard — admin-only. Ranks each executive's prediction accuracy
// per subject_type, surfaces systematic bias, and lets the Operator tune the
// weights that runDeliberation uses when scoring incoming reviews.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Gauge, Lock, RotateCcw, Save, AlertTriangle, Download, FileJson } from "lucide-react";
import { MosShell } from "@/components/mos-shell";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  DEFAULT_WEIGHTS,
  EXECS,
  SUBJECT_TYPES,
  type CalibrationCell,
  type CalibrationWeights,
  type Exec,
  type SubjectType,
  getCalibrationSummary,
  getCalibrationWeights,
  updateCalibrationWeights,
} from "@/lib/calibration.functions";

export const Route = createFileRoute("/_authenticated/committee/calibration")({
  component: CalibrationPage,
});

const EXEC_LABEL: Record<Exec, { title: string; role: string; badge: string }> = {
  iris:     { title: "IRIS",     role: "Chief Strategy Officer",   badge: "bg-iris/15 text-iris" },
  apex:     { title: "APEX",     role: "Chief Operations Officer", badge: "bg-apex/15 text-apex" },
  katana:   { title: "KATANA",   role: "Chief Execution Officer",  badge: "bg-katana/15 text-katana" },
  sentinel: { title: "SENTINEL", role: "Chief Risk Officer",       badge: "bg-sentinel/15 text-sentinel" },
};

const FLAG_LABEL: Record<string, { label: string; className: string }> = {
  "low-accuracy":            { label: "Low accuracy",          className: "bg-destructive/15 text-destructive" },
  "overconfident":           { label: "Overconfident",         className: "bg-amber-500/15 text-amber-400" },
  "roi-overshoot":           { label: "ROI overshoot",         className: "bg-primary/15 text-primary" },
  "risk-underrating":        { label: "Risk under-rated",      className: "bg-destructive/15 text-destructive" },
  "effort-underestimation":  { label: "Effort under-estimated",className: "bg-amber-500/15 text-amber-400" },
};

function CalibrationPage() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const qc = useQueryClient();

  const summary = useQuery({
    queryKey: ["committee.calibration.summary"],
    queryFn: () => getCalibrationSummary(),
    enabled: isAdmin,
  });
  const weightsQ = useQuery({
    queryKey: ["committee.calibration.weights"],
    queryFn: () => getCalibrationWeights(),
    enabled: isAdmin,
  });

  const [w, setW] = useState<CalibrationWeights>(DEFAULT_WEIGHTS);
  useEffect(() => { if (weightsQ.data) setW(weightsQ.data); }, [weightsQ.data]);

  const save = useMutation({
    mutationFn: (v: CalibrationWeights) => updateCalibrationWeights({ data: v }),
    onSuccess: () => { toast.success("Calibration weights saved"); qc.invalidateQueries({ queryKey: ["committee.calibration.weights"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  // Per-exec average accuracy for the leaderboard.
  const leaderboard = useMemo(() => {
    const cells = summary.data?.cells ?? [];
    return EXECS.map((exec) => {
      const rows = cells.filter((c) => c.executive === exec);
      const samples = rows.reduce((s, r) => s + r.samples, 0);
      const acc = samples ? rows.reduce((s, r) => s + r.accuracy * r.samples, 0) / samples : 0;
      const conf = samples ? rows.reduce((s, r) => s + r.avg_confidence * r.samples, 0) / samples : 0;
      const flags = new Set<string>();
      rows.forEach((r) => r.systematic_flags.forEach((f) => flags.add(f)));
      return { exec, samples, accuracy: acc, avg_confidence: conf, overconfidence: conf - acc * 100, flags: [...flags] };
    }).sort((a, b) => b.accuracy - a.accuracy || b.samples - a.samples);
  }, [summary.data]);

  const cellIndex = useMemo(() => {
    const m = new Map<string, CalibrationCell>();
    (summary.data?.cells ?? []).forEach((c) => m.set(`${c.executive}::${c.subject_type}`, c));
    return m;
  }, [summary.data]);

  if (adminLoading) return <MosShell><div className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">Verifying access…</div></MosShell>;
  if (!isAdmin) {
    return (
      <MosShell>
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="font-display text-2xl font-semibold">Calibration is Operator-only.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Only the admin owner can view or tune executive calibration history.</p>
        </div>
      </MosShell>
    );
  }

  const dirty = !!weightsQ.data && (
    weightsQ.data.roi_overshoot_weight !== w.roi_overshoot_weight ||
    weightsQ.data.risk_underrating_weight !== w.risk_underrating_weight ||
    weightsQ.data.effort_underestimation_weight !== w.effort_underestimation_weight ||
    weightsQ.data.accuracy_weight !== w.accuracy_weight
  );

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/committee" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Committee
        </Link>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">
              <Gauge className="h-3.5 w-3.5" /> Executive Calibration
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Prediction accuracy & systematic bias</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Every recorded outcome feeds back into the board. This dashboard shows how each executive has performed per subject
              class and lets you tune how strongly history bends future confidence.
            </p>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {summary.data ? <>Based on {summary.data.totals.outcomes} recorded outcome{summary.data.totals.outcomes === 1 ? "" : "s"}.</> : "Loading…"}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              onClick={() => exportCalibration("csv", summary.data?.cells ?? [], leaderboard, w)}
              disabled={!summary.data || summary.data.cells.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button
              onClick={() => exportCalibration("json", summary.data?.cells ?? [], leaderboard, w)}
              disabled={!summary.data || summary.data.cells.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-40"
            >
              <FileJson className="h-3.5 w-3.5" /> Export JSON
            </button>
          </div>
        </header>


        {/* WEIGHT CONTROLS */}
        <section className="hq-panel mb-8 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Calibration weights</div>
              <h2 className="mt-1 font-display text-lg font-semibold">How strongly history influences the board</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setW({ ...DEFAULT_WEIGHTS })}
                className="inline-flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
              <button
                onClick={() => save.mutate(w)}
                disabled={!dirty || save.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-primary-foreground disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving…" : "Save weights"}
              </button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <WeightSlider
              label="Historical accuracy"
              hint="Scales how much a low-accuracy track record dampens confidence and score."
              value={w.accuracy_weight}
              onChange={(v) => setW({ ...w, accuracy_weight: v })}
            />
            <WeightSlider
              label="ROI overshoot penalty"
              hint="Bigger = harsher score cut when IRIS/APEX/KATANA have overpromised ROI."
              value={w.roi_overshoot_weight}
              onChange={(v) => setW({ ...w, roi_overshoot_weight: v })}
            />
            <WeightSlider
              label="Risk under-rating penalty"
              hint="Bigger = harsher safety cut when SENTINEL has been too permissive."
              value={w.risk_underrating_weight}
              onChange={(v) => setW({ ...w, risk_underrating_weight: v })}
            />
            <WeightSlider
              label="Effort under-estimation penalty"
              hint="Bigger = harsher ops cut when APEX has under-scoped required hours."
              value={w.effort_underestimation_weight}
              onChange={(v) => setW({ ...w, effort_underestimation_weight: v })}
            />
          </div>
        </section>

        {/* LEADERBOARD */}
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold">Executive ranking</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {leaderboard.map((r, i) => (
              <div key={r.exec} className="hq-panel p-4">
                <div className="flex items-center justify-between">
                  <div className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest ${EXEC_LABEL[r.exec].badge}`}>
                    #{i + 1} · {EXEC_LABEL[r.exec].title}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{r.samples} call{r.samples === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{EXEC_LABEL[r.exec].role}</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Stat label="Accuracy" value={r.samples ? `${Math.round(r.accuracy * 100)}%` : "—"}
                        tone={r.samples ? (r.accuracy >= 0.7 ? "good" : r.accuracy >= 0.5 ? "warn" : "bad") : "muted"} />
                  <Stat label="Avg confidence" value={r.samples ? `${Math.round(r.avg_confidence)}%` : "—"} tone="muted" />
                </div>
                <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Overconfidence gap:{" "}
                  <span className={r.overconfidence >= 20 ? "text-amber-400" : "text-muted-foreground"}>
                    {r.samples ? `${Math.round(r.overconfidence) >= 0 ? "+" : ""}${Math.round(r.overconfidence)} pts` : "—"}
                  </span>
                </div>
                {r.flags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {r.flags.map((f) => (
                      <span key={f} className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest ${FLAG_LABEL[f]?.className ?? "bg-surface"}`}>
                        {FLAG_LABEL[f]?.label ?? f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* MATRIX */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">By subject class</h2>
          {summary.isLoading ? (
            <div className="hq-panel p-6 text-sm text-muted-foreground">Loading calibration matrix…</div>
          ) : (summary.data?.cells.length ?? 0) === 0 ? (
            <div className="hq-panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              No outcomes recorded yet. Close out a decided review with a Win/Loss/Partial verdict to seed the board's memory.
            </div>
          ) : (
            <div className="hq-panel overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <th className="px-3 py-2">Subject class</th>
                    {EXECS.map((e) => <th key={e} className="px-3 py-2">{EXEC_LABEL[e].title}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {SUBJECT_TYPES.map((s) => (
                    <tr key={s} className="border-t border-border/40">
                      <td className="px-3 py-3 align-top text-[11px] font-mono uppercase tracking-widest text-foreground/80">{s}</td>
                      {EXECS.map((e) => {
                        const c = cellIndex.get(`${e}::${s}`);
                        return (
                          <td key={e} className="px-3 py-3 align-top">
                            {c ? <CellView cell={c} /> : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MosShell>
  );
}

function WeightSlider({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/30 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-xs font-mono text-primary">×{value.toFixed(2)}</div>
      </div>
      <input
        type="range" min={0} max={3} step={0.05} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
      <div className="mt-1 flex justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>off</span><span>default</span><span>max</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "muted" }) {
  const cls = tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function CellView({ cell }: { cell: CalibrationCell }) {
  const accTone = cell.accuracy >= 0.7 ? "text-emerald-400" : cell.accuracy >= 0.5 ? "text-amber-400" : "text-destructive";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={`font-mono text-sm ${accTone}`}>{Math.round(cell.accuracy * 100)}%</span>
        <span className="text-[10px] text-muted-foreground">n={cell.samples}</span>
      </div>
      <div className="text-[10px] font-mono text-muted-foreground">
        conf {cell.avg_confidence}% · gap {cell.overconfidence >= 0 ? "+" : ""}{cell.overconfidence}
      </div>
      <div className="text-[10px] text-muted-foreground">
        ROI Δ {cell.roi_bias >= 0 ? "+" : ""}{cell.roi_bias}
        {" · "}risk Δ {cell.risk_bias >= 0 ? "+" : ""}{cell.risk_bias}
        {" · "}effort Δ {cell.effort_bias >= 0 ? "+" : ""}{cell.effort_bias}h
      </div>
      {cell.systematic_flags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {cell.systematic_flags.map((f) => (
            <span key={f} className={`rounded px-1 py-0.5 text-[9px] font-mono uppercase tracking-widest ${FLAG_LABEL[f]?.className ?? "bg-surface"}`}>
              {FLAG_LABEL[f]?.label ?? f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Export helpers ---

type LeaderRow = {
  exec: Exec; samples: number; accuracy: number; avg_confidence: number; overconfidence: number; flags: string[];
};

function download(name: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCalibration(
  format: "csv" | "json",
  cells: CalibrationCell[],
  leaderboard: LeaderRow[],
  weights: CalibrationWeights,
) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (format === "json") {
    const payload = {
      generated_at: new Date().toISOString(),
      calibration_weights: weights,
      leaderboard: leaderboard.map((r) => ({
        executive: r.exec,
        samples: r.samples,
        accuracy: Math.round(r.accuracy * 1000) / 1000,
        avg_confidence: Math.round(r.avg_confidence),
        overconfidence: Math.round(r.overconfidence),
        systematic_flags: r.flags,
      })),
      bias_matrix: cells,
    };
    download(`calibration-${stamp}.json`, "application/json", JSON.stringify(payload, null, 2));
    return;
  }
  const meta = [
    `# generated_at,${new Date().toISOString()}`,
    `# weights,accuracy=${weights.accuracy_weight},roi=${weights.roi_overshoot_weight},risk=${weights.risk_underrating_weight},effort=${weights.effort_underestimation_weight}`,
    ``,
    `## Leaderboard`,
    ["executive", "samples", "accuracy", "avg_confidence", "overconfidence", "flags"].join(","),
    ...leaderboard.map((r) => [r.exec, r.samples, r.accuracy.toFixed(3), Math.round(r.avg_confidence), Math.round(r.overconfidence), r.flags.join("|")].map(csvEscape).join(",")),
    ``,
    `## Bias matrix`,
    ["executive", "subject_type", "samples", "accuracy", "avg_confidence", "overconfidence", "roi_bias", "risk_bias", "effort_bias", "systematic_flags"].join(","),
    ...cells.map((c) => [c.executive, c.subject_type, c.samples, c.accuracy, c.avg_confidence, c.overconfidence, c.roi_bias, c.risk_bias, c.effort_bias, c.systematic_flags.join("|")].map(csvEscape).join(",")),
  ].join("\n");
  download(`calibration-${stamp}.csv`, "text/csv;charset=utf-8", meta);
}

