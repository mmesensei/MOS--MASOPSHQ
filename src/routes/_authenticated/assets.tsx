import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MosShell } from "@/components/mos-shell";
import {
  listAssets, discoverAssets, updateAssetStatus, deleteAsset,
  createAssetManual, ASSET_TYPE_LABELS,
} from "@/lib/assets.functions";
import { Sparkles, Plus, Trash2, TrendingUp, Zap, Loader2, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/assets")({
  component: AssetsPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">Asset Factory error: {error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

type Asset = {
  id: string; name: string; asset_type: string; description: string | null;
  purpose: string | null; target_audience: string | null; status: string;
  priority: string; revenue_model: string | null; automation_notes: string | null;
  scorecard: Record<string, number>; proposed_by: string; updated_at: string;
};

const STATUS_TABS = ["opportunity", "reviewing", "approved", "in_build", "launched"] as const;

const STATUS_COLOR: Record<string, string> = {
  opportunity: "bg-katana/20 text-katana",
  reviewing: "bg-iris/20 text-iris",
  approved: "bg-apex/20 text-apex",
  in_build: "bg-primary/20 text-primary",
  launched: "bg-sentinel/20 text-sentinel",
  archived: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/20 text-destructive",
};

function scoreOf(a: Asset) {
  const s = a.scorecard ?? {};
  const pos = (Number(s.strategic_value ?? 0) + Number(s.business_value ?? 0) + Number(s.revenue_potential ?? 0) +
    Number(s.scalability ?? 0) + Number(s.automation_readiness ?? 0) + Number(s.institutional_value ?? 0));
  const neg = (Number(s.complexity ?? 0) + Number(s.risk ?? 0) + Number(s.time_to_launch ?? 0));
  return Math.max(0, Math.round(((pos - neg / 2) / 6) * 10) / 10);
}

function AssetsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("opportunity");
  const [showManual, setShowManual] = useState(false);

  const assetsQ = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const discover = useMutation({
    mutationFn: () => discoverAssets(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateAssetStatus({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteAsset({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });

  const rows = ((assetsQ.data ?? []) as Asset[]).filter((a) => a.status === tab);
  const counts: Record<string, number> = {};
  for (const a of (assetsQ.data ?? []) as Asset[]) counts[a.status] = (counts[a.status] ?? 0) + 1;

  const topOpportunities = ((assetsQ.data ?? []) as Asset[])
    .filter((a) => a.status === "opportunity")
    .sort((a, b) => scoreOf(b) - scoreOf(a))
    .slice(0, 3);

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-katana">KATANA · Asset Factory</div>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Asset Factory</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Nothing valuable remains unused. Nothing repeatable remains manual. Nothing scalable remains small.
              KATANA continuously reviews your missions, SOPs, and lessons — and proposes scalable assets.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowManual((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent">
              <Plus className="h-4 w-4" /> Manual asset
            </button>
            <button
              onClick={() => discover.mutate()}
              disabled={discover.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-katana px-4 py-2 text-sm font-medium text-katana-foreground hover:opacity-90 disabled:opacity-50">
              {discover.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              KATANA scan
            </button>
          </div>
        </header>

        {discover.isError && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {(discover.error as Error).message}
          </div>
        )}

        {topOpportunities.length > 0 && (
          <section className="mb-8 grid gap-3 md:grid-cols-3">
            {topOpportunities.map((a) => (
              <div key={a.id} className="hq-panel p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-katana">
                  <TrendingUp className="h-3 w-3" /> Top opportunity · score {scoreOf(a)}
                </div>
                <div className="mt-1.5 font-display text-base font-semibold">{a.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{ASSET_TYPE_LABELS[a.asset_type] ?? a.asset_type}</div>
                <div className="mt-2 line-clamp-3 text-sm">{a.description}</div>
              </div>
            ))}
          </section>
        )}

        {showManual && (
          <ManualForm onDone={() => { setShowManual(false); qc.invalidateQueries({ queryKey: ["assets"] }); }} />
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`rounded-full px-3 py-1 text-xs capitalize ${tab === s ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
              {s.replace("_", " ")} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>

        {assetsQ.isLoading && <div className="hq-panel p-8 text-center text-muted-foreground">Loading assets…</div>}

        {!assetsQ.isLoading && rows.length === 0 && (
          <div className="hq-panel p-10 text-center">
            <Zap className="mx-auto h-8 w-8 text-katana" />
            <h3 className="mt-3 font-display text-xl font-semibold">No {tab.replace("_", " ")} assets</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "opportunity"
                ? "Run a KATANA scan to convert your knowledge into asset opportunities."
                : "Move opportunities forward as you approve, build, and launch them."}
            </p>
            {tab === "opportunity" && (
              <button onClick={() => discover.mutate()} disabled={discover.isPending}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-katana px-4 py-2 text-sm font-medium text-katana-foreground">
                <Sparkles className="h-4 w-4" /> Run KATANA scan
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {rows.map((a) => (
            <div key={a.id} className="hq-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${STATUS_COLOR[a.status]}`}>{a.status.replace("_", " ")}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{ASSET_TYPE_LABELS[a.asset_type] ?? a.asset_type}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${
                      a.priority === "Critical" ? "bg-destructive/20 text-destructive" :
                      a.priority === "High" ? "bg-katana/20 text-katana" :
                      a.priority === "Medium" ? "bg-apex/20 text-apex" : "bg-muted text-muted-foreground"
                    }`}>{a.priority}</span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      proposed · {a.proposed_by}
                    </span>
                    <span className="ml-2 text-[10px] font-mono text-katana">score {scoreOf(a)}</span>
                  </div>
                  <h3 className="mt-1.5 font-display text-lg font-semibold">{a.name}</h3>
                  {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
                  <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                    {a.purpose && <div><span className="text-muted-foreground">Purpose:</span> {a.purpose}</div>}
                    {a.target_audience && <div><span className="text-muted-foreground">Audience:</span> {a.target_audience}</div>}
                    {a.revenue_model && <div><span className="text-muted-foreground">Revenue:</span> {a.revenue_model}</div>}
                    {a.automation_notes && <div><span className="text-muted-foreground">Automation:</span> {a.automation_notes}</div>}
                  </div>
                  <Scorecard scorecard={a.scorecard} />
                  <div className="mt-2 text-[10px] text-muted-foreground">Updated {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select value={a.status} onChange={(e) => setStatus.mutate({ id: a.id, status: e.target.value })}
                    className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                    {["opportunity", "reviewing", "approved", "in_build", "launched", "archived", "rejected"].map((s) =>
                      <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                  <button onClick={() => del.mutate(a.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" /> delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-10 flex items-start gap-2 rounded-md border border-border/50 bg-surface/50 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentinel" />
          <div>Revenue opportunities are suggestions only. Nothing is acted upon without Operator approval. Move an asset to <span className="text-apex">approved</span> to signal Council-cleared work.</div>
        </footer>
      </div>
    </MosShell>
  );
}

function Scorecard({ scorecard }: { scorecard: Record<string, number> | null }) {
  if (!scorecard || Object.keys(scorecard).length === 0) return null;
  const labels: Record<string, string> = {
    strategic_value: "Strategic", business_value: "Business", revenue_potential: "Revenue",
    complexity: "Complexity", risk: "Risk", scalability: "Scale",
    automation_readiness: "Automation", time_to_launch: "TTL", institutional_value: "Institutional",
  };
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {Object.entries(labels).map(([k, label]) => {
        const v = Number(scorecard[k] ?? 0);
        if (!v) return null;
        const neg = k === "complexity" || k === "risk" || k === "time_to_launch";
        return (
          <span key={k} className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${neg ? "bg-destructive/10 text-destructive" : "bg-katana/10 text-katana"}`}>
            {label} {v}
          </span>
        );
      })}
    </div>
  );
}

function ManualForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("template");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [revenue, setRevenue] = useState("");
  const [priority, setPriority] = useState("Medium");
  const create = useMutation({
    mutationFn: () => createAssetManual({ data: {
      name, asset_type: type, description, target_audience: audience, revenue_model: revenue, priority,
    } }),
    onSuccess: onDone,
  });
  return (
    <div className="hq-panel mb-6 p-5">
      <h3 className="mb-3 font-display text-base font-semibold">Add asset manually</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Asset name"
          className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-border bg-input px-3 py-2 text-sm">
          {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Target audience"
          className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
        <input value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="Revenue model"
          className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}
          className="rounded-md border border-border bg-input px-3 py-2 text-sm">
          {["Low", "Medium", "High", "Critical"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
        placeholder="Description — what is the asset, and why does it matter?"
        className="mt-3 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
      <div className="mt-3 flex gap-2">
        <button onClick={() => create.mutate()} disabled={!name || create.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
          {create.isPending ? "Saving…" : "Save asset"}
        </button>
        <button onClick={onDone} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}
