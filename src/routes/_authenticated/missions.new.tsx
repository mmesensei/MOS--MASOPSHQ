import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { ExecutivePresence, type PresenceState } from "@/components/executive-presence";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import {
  wizardIrisIntent, wizardApexStructure, wizardKatanaPlan, wizardSentinelRisk, birthMission,
} from "@/lib/mos-v2.functions";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/missions/new")({
  component: MissionWizard,
});

type Step = 0 | 1 | 2 | 3 | 4;

function MissionWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [rawIntent, setRawIntent] = useState("");
  const [irisIntent, setIrisIntent] = useState("");
  const [apexStructure, setApexStructure] = useState("");
  const [katanaPlan, setKatanaPlan] = useState("");
  const [sentinelRisk, setSentinelRisk] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [sponsor, setSponsor] = useState<ExecutiveId>("iris");
  const [deliverables, setDeliverables] = useState<string[]>([""]);
  const [risks, setRisks] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  async function callIris() {
    if (rawIntent.trim().length < 5) return toast.error("Give IRIS more to work with.");
    setLoading(true);
    try {
      const t = await wizardIrisIntent({ data: { rawIntent } });
      setIrisIntent(t);
      if (!title) setTitle(rawIntent.slice(0, 80));
      setStep(1);
    } catch (e) { toast.error(e instanceof Error ? e.message : "IRIS failed"); }
    finally { setLoading(false); }
  }
  async function callApex() {
    setLoading(true);
    try { setApexStructure(await wizardApexStructure({ data: { rawIntent, irisIntent } })); setStep(2); }
    catch (e) { toast.error(e instanceof Error ? e.message : "APEX failed"); }
    finally { setLoading(false); }
  }
  async function callKatana() {
    setLoading(true);
    try { setKatanaPlan(await wizardKatanaPlan({ data: { rawIntent, irisIntent, apexStructure } })); setStep(3); }
    catch (e) { toast.error(e instanceof Error ? e.message : "KATANA failed"); }
    finally { setLoading(false); }
  }
  async function callSentinel() {
    setLoading(true);
    try { setSentinelRisk(await wizardSentinelRisk({ data: { rawIntent, irisIntent, apexStructure, katanaPlan } })); setStep(4); }
    catch (e) { toast.error(e instanceof Error ? e.message : "SENTINEL failed"); }
    finally { setLoading(false); }
  }

  async function birth() {
    if (!title.trim()) return toast.error("Name the mission before you birth it.");
    setLoading(true);
    try {
      const row = await birthMission({
        data: {
          title, objective: irisIntent, priority, sponsor,
          charter: { iris_intent: irisIntent, apex_structure: apexStructure, katana_plan: katanaPlan, sentinel_risk: sentinelRisk },
          deliverables: deliverables.map((d) => d.trim()).filter(Boolean),
          risks: risks.map((r) => r.trim()).filter(Boolean),
        },
      });
      toast.success("Mission chartered.");
      // Fire proactive scan — bypasses cooldown so executives react immediately.
      import("@/lib/awareness.functions").then((m) =>
        m.generateObservations({ data: { trigger: "mission_created", force: true } }).catch(() => void 0)
      );
      navigate({ to: `/missions/${row.id}` });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const stages: { id: ExecutiveId; label: string; state: PresenceState }[] = [
    { id: "iris",     label: "Intent",    state: step === 0 ? "listening" : step > 0 ? "reviewing" : "idle" },
    { id: "apex",     label: "Structure", state: step === 1 ? "thinking"  : step > 1 ? "reviewing" : "idle" },
    { id: "katana",   label: "Plan",      state: step === 2 ? "thinking"  : step > 2 ? "reviewing" : "idle" },
    { id: "sentinel", label: "Risk",      state: step === 3 ? "reviewing" : step > 3 ? "reviewing" : "idle" },
  ];

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/missions" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to missions
        </Link>
        <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Executive Council in session</div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Charter a new mission</h1>
        <p className="mt-1 text-sm text-muted-foreground">Each executive contributes in turn. Nothing skips. Nothing is decided without your final word.</p>

        {/* Council row — the four executives visible the whole time */}
        <div className="mt-6 grid grid-cols-4 gap-3">
          {stages.map((s, i) => {
            const e = EXECUTIVES[s.id];
            const done = step > i;
            const active = step === i;
            return (
              <div key={s.id} className={`hq-panel p-3 ${active ? "ring-1 " + (s.id === "iris" ? "ring-iris/60" : s.id === "apex" ? "ring-apex/60" : s.id === "katana" ? "ring-katana/60" : "ring-sentinel/60") : ""}`}>
                <ExecutivePresence executive={s.id} state={s.state} size="bust" />
                <div className="mt-2 text-center">
                  <div className={`text-[10px] font-mono uppercase tracking-[0.25em] ${e.colorClass}`}>{e.name}</div>
                  <div className="text-xs text-muted-foreground">{s.label}{done ? " ✓" : ""}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step body */}
        <div className="mt-8 hq-panel p-6">
          {step === 0 && (
            <div>
              <StageHead exec="iris" question="What are we truly trying to accomplish, and why does it matter?" />
              <textarea
                value={rawIntent}
                onChange={(e) => setRawIntent(e.target.value)}
                placeholder="Speak your intent to IRIS. Rough is fine — IRIS will refine it."
                rows={5}
                className="mt-4 w-full resize-none rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-4 flex justify-end">
                <button onClick={callIris} disabled={loading || rawIntent.length < 5} className="inline-flex items-center gap-1.5 rounded-md bg-iris px-4 py-2 text-sm font-medium text-iris-foreground disabled:opacity-40">
                  {loading ? "IRIS is thinking…" : <>Hand to IRIS <ArrowRight className="h-3 w-3" /></>}
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <ExecStep exec="iris" heading="IRIS defines the mission" body={irisIntent}
              nextLabel="Hand to APEX" onNext={callApex} onBack={() => setStep(0)} loading={loading}
              nextColor="bg-apex text-apex-foreground" />
          )}
          {step === 2 && (
            <ExecStep exec="apex" heading="APEX designs the structure" body={apexStructure}
              nextLabel="Hand to KATANA" onNext={callKatana} onBack={() => setStep(1)} loading={loading}
              nextColor="bg-katana text-katana-foreground" />
          )}
          {step === 3 && (
            <ExecStep exec="katana" heading="KATANA writes the plan" body={katanaPlan}
              nextLabel="Hand to SENTINEL" onNext={callSentinel} onBack={() => setStep(2)} loading={loading}
              nextColor="bg-sentinel text-sentinel-foreground" />
          )}
          {step === 4 && (
            <div>
              <StageHead exec="sentinel" question="What could go wrong — and is there a lower-risk path?" />
              <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-surface p-4 text-sm text-foreground/90">{sentinelRisk}</pre>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Mission title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring">
                    <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Executive sponsor</label>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {Object.values(EXECUTIVES).map((e) => (
                      <button key={e.id} type="button" onClick={() => setSponsor(e.id)}
                        className={`hq-panel p-3 text-left ${sponsor === e.id ? `ring-1 ${e.id === "iris" ? "ring-iris" : e.id === "apex" ? "ring-apex" : e.id === "katana" ? "ring-katana" : "ring-sentinel"}` : "opacity-70"}`}>
                        <div className={`text-[10px] font-mono uppercase tracking-widest ${e.colorClass}`}>{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.title}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <ListField label="Deliverables (from APEX)" values={deliverables} setValues={setDeliverables} placeholder="e.g. Drafted SOP for onboarding" />
                <ListField label="Risks (from SENTINEL)" values={risks} setValues={setRisks} placeholder="e.g. Requires legal review before publish" />
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button onClick={() => setStep(3)} className="text-sm text-muted-foreground hover:text-foreground">← Back to KATANA</button>
                <button onClick={birth} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                  <Sparkles className="h-4 w-4" /> {loading ? "Chartering…" : "Charter the mission"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MosShell>
  );
}

function StageHead({ exec, question }: { exec: ExecutiveId; question: string }) {
  const e = EXECUTIVES[exec];
  return (
    <div>
      <div className={`text-[10px] font-mono uppercase tracking-[0.3em] ${e.colorClass}`}>{e.name} · {e.title}</div>
      <p className="mt-1 font-display text-xl font-semibold">"{question}"</p>
    </div>
  );
}

function ExecStep({ exec, heading, body, nextLabel, onNext, onBack, loading, nextColor }:
  { exec: ExecutiveId; heading: string; body: string; nextLabel: string; onNext: () => void; onBack: () => void; loading: boolean; nextColor: string }) {
  const e = EXECUTIVES[exec];
  return (
    <div>
      <div className={`text-[10px] font-mono uppercase tracking-[0.3em] ${e.colorClass}`}>{e.name} responds</div>
      <h2 className="mt-1 font-display text-xl font-semibold">{heading}</h2>
      <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-surface p-4 text-sm text-foreground/90">{body}</pre>
      <div className="mt-6 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
        <button onClick={onNext} disabled={loading} className={`inline-flex items-center gap-1.5 rounded-md ${nextColor} px-4 py-2 text-sm font-medium disabled:opacity-40`}>
          {loading ? "Working…" : <>{nextLabel} <ArrowRight className="h-3 w-3" /></>}
        </button>
      </div>
    </div>
  );
}

function ListField({ label, values, setValues, placeholder }:
  { label: string; values: string[]; setValues: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="md:col-span-2">
      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="mt-2 space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input value={v} onChange={(e) => { const copy = [...values]; copy[i] = e.target.value; setValues(copy); }}
              placeholder={placeholder}
              className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring" />
            {values.length > 1 && (
              <button type="button" onClick={() => setValues(values.filter((_, j) => j !== i))} className="rounded-md px-2 text-sm text-muted-foreground hover:text-destructive">×</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setValues([...values, ""])} className="text-xs text-muted-foreground hover:text-foreground">+ add another</button>
      </div>
    </div>
  );
}
