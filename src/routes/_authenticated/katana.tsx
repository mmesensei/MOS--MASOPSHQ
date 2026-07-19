import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Sparkles, ScanLine, Loader2 } from "lucide-react";

import { MosShell } from "@/components/mos-shell";
import { OpportunityCard } from "@/components/katana/opportunity-card";
import { KatanaExecutionAgreement } from "@/components/katana/execution-agreement";
import { KatanaSourcesRail } from "@/components/katana/sources-rail";
import { KatanaRevenueDashboard } from "@/components/katana/revenue-dashboard";
import { KatanaInterventionQueue } from "@/components/katana/intervention-queue";
import { MissionAttentionPanel } from "@/components/katana/mission-attention";

import {
  KATANA_CATEGORIES,
  listOpportunities,
  evaluate,
  scanConnectedSources,
  dismissOpportunity,
  listAssets,
} from "@/lib/katana.functions";

export const Route = createFileRoute("/_authenticated/katana")({
  head: () => ({
    meta: [
      { title: "KATANA — Revenue Board · MOS" },
      { name: "description", content: "What can we build from what you already own? KATANA turns your assets into missions." },
    ],
  }),
  component: KatanaBoard,
  errorComponent: ({ error, reset }) => (
    <MosShell>
      <div className="p-8">
        <div className="text-sm text-destructive">{error.message}</div>
        <button className="mt-3 rounded border px-3 py-1.5 text-sm" onClick={() => reset()}>Retry</button>
      </div>
    </MosShell>
  ),
});

function KatanaBoard() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const listOppsFn = useServerFn(listOpportunities);
  const listAssetsFn = useServerFn(listAssets);
  const evaluateFn = useServerFn(evaluate);
  const scanFn = useServerFn(scanConnectedSources);
  const dismissFn = useServerFn(dismissOpportunity);

  const opps = useQuery({ queryKey: ["katana", "opportunities"], queryFn: () => listOppsFn() });
  const assets = useQuery({ queryKey: ["katana", "assets"], queryFn: () => listAssetsFn() });

  const scanMut = useMutation({
    mutationFn: () => scanFn(),
    onSuccess: (r) => {
      toast.success(`Scanned. ${r.discovered} assets indexed.`);
      qc.invalidateQueries({ queryKey: ["katana", "assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const evalMut = useMutation({
    mutationFn: () => evaluateFn(),
    onSuccess: (r) => {
      toast.success(`${r.discovered} opportunities`);
      qc.invalidateQueries({ queryKey: ["katana", "opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["katana", "opportunities"] }),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof opps.data>();
    for (const key of Object.keys(KATANA_CATEGORIES)) map.set(key, []);
    for (const o of opps.data ?? []) {
      if (o.status === "dismissed") continue;
      const arr = map.get(o.category) ?? [];
      arr.push(o);
      map.set(o.category, arr);
    }
    return map;
  }, [opps.data]);

  const totalOpen = (opps.data ?? []).filter((o) => o.status === "open").length;

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-6">
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-katana">KATANA · Revenue Board</div>
          <h1 className="mt-1 font-display text-2xl md:text-3xl font-semibold tracking-tight">
            What can we build from what you already own?
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            KATANA continuously evaluates your assets, missions, and SOPs against the Ten Questions and surfaces
            leverage — never publishes without approval, never destroys the original.
          </p>
        </header>

        <KatanaRevenueDashboard />
        <KatanaInterventionQueue />
        <MissionAttentionPanel />
        <KatanaSourcesRail />


        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-surface/50 p-3">
          <div className="text-xs">
            <div className="text-muted-foreground">Assets indexed</div>
            <div className="text-lg font-semibold">{assets.data?.length ?? 0}</div>
          </div>
          <div className="text-xs">
            <div className="text-muted-foreground">Open opportunities</div>
            <div className="text-lg font-semibold">{totalOpen}</div>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => scanMut.mutate()}
              disabled={scanMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              {scanMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
              Scan sources
            </button>
            <button
              onClick={() => evalMut.mutate()}
              disabled={evalMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-katana px-3 py-1.5 text-sm font-medium text-katana-foreground hover:opacity-90 disabled:opacity-50"
            >
              {evalMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Evaluate
            </button>
          </div>
        </div>

        {opps.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading opportunities…</div>
        ) : totalOpen === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
            <div className="text-sm text-muted-foreground">
              No open opportunities yet. Scan your sources, then run <span className="text-katana">Evaluate</span>.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries())
              .filter(([, list]) => (list?.length ?? 0) > 0)
              .map(([cat, list]) => {
                const meta = KATANA_CATEGORIES[cat as keyof typeof KATANA_CATEGORIES];
                return (
                  <section key={cat}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">({list?.length ?? 0})</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {list?.map((o) => (
                        <OpportunityCard
                          key={o.id}
                          opp={o as never}
                          onAccept={setSelected}
                          onDismiss={(id) => dismissMut.mutate(id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
          </div>
        )}

        {selected && (
          <KatanaExecutionAgreement opportunityId={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </MosShell>
  );
}
