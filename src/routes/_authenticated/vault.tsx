import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MosShell } from "@/components/mos-shell";
import {
  getOneDriveStatus,
  startOneDriveConnect,
  saveOneDriveConnection,
  disconnectOneDrive,
  scanOneDrive,
  harvestBatch,
  harvestDocument,
  listVaultDocuments,
} from "@/lib/onedrive.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { Cloud, Loader2, Sparkles, FileText, Shield, Zap, Compass, Target, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/vault")({
  component: VaultPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Intelligence Vault error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

type VaultDoc = {
  id: string;
  name: string;
  path: string | null;
  mime_type: string | null;
  status: string;
  executive_owner: string | null;
  knowledge_type: string | null;
  department: string | null;
  sensitivity: string | null;
  priority: string | null;
  knowledge_score: number | null;
  snippet: string | null;
  analysis: Record<string, unknown> | null;
  harvested_at: string | null;
  created_at: string;
  modified_at: string | null;
};

const EXEC_META: Record<string, { name: string; color: string; icon: typeof Compass }> = {
  iris: { name: "IRIS", color: "text-iris", icon: Compass },
  apex: { name: "APEX", color: "text-apex", icon: Target },
  katana: { name: "KATANA", color: "text-katana", icon: Zap },
  sentinel: { name: "SENTINEL", color: "text-sentinel", icon: Shield },
};

const GATEWAY = "https://connector-gateway.lovable.dev";

function VaultPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<VaultDoc | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const statusQ = useQuery({ queryKey: ["onedrive-status"], queryFn: () => getOneDriveStatus() });
  const docsQ = useQuery({ queryKey: ["vault-docs"], queryFn: () => listVaultDocuments() });

  const connectM = useMutation({
    mutationFn: async () => {
      const result = await connectAppUser({
        connectorId: "microsoft_onedrive",
        gatewayBaseUrl: GATEWAY,
        start: (targetOrigin) => startOneDriveConnect({ data: targetOrigin }),
      });
      if (!result.success) throw new Error(result.error ?? "Connection failed");
      if (result.connectionAPIKey) {
        await saveOneDriveConnection({ data: { connectionAPIKey: result.connectionAPIKey } });
      }
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onedrive-status"] }),
  });

  const disconnectM = useMutation({
    mutationFn: () => disconnectOneDrive(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onedrive-status"] });
      qc.invalidateQueries({ queryKey: ["vault-docs"] });
    },
  });

  // Google Drive is managed on /knowledge-connections (canonical custom OAuth).

  const scanM = useMutation({
    mutationFn: () => scanOneDrive({ data: { maxFiles: 50 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-docs"] }),
  });

  const harvestBatchM = useMutation({
    mutationFn: () => harvestBatch({ data: { limit: 8 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-docs"] }),
  });

  const docs = (docsQ.data ?? []) as VaultDoc[];
  const filtered = useMemo(() => {
    if (filter === "all") return docs;
    if (filter === "pending") return docs.filter((d) => d.status === "discovered");
    if (filter === "harvested") return docs.filter((d) => d.status === "harvested");
    return docs.filter((d) => d.executive_owner === filter);
  }, [docs, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      total: docs.length,
      pending: 0,
      harvested: 0,
      iris: 0,
      apex: 0,
      katana: 0,
      sentinel: 0,
    };
    for (const d of docs) {
      if (d.status === "discovered") c.pending++;
      if (d.status === "harvested") c.harvested++;
      if (d.executive_owner) c[d.executive_owner] = (c[d.executive_owner] ?? 0) + 1;
    }
    return c;
  }, [docs]);

  const status = statusQ.data;
  const connected = status && "connected" in status && status.connected;

  async function harvestOne(id: string) {
    setBusyId(id);
    try {
      await harvestDocument({ data: { documentId: id } });
      await qc.invalidateQueries({ queryKey: ["vault-docs"] });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <MosShell>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
              <Cloud className="h-3.5 w-3.5" /> Step 10 · OneDrive Intelligence Vault
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              Knowledge Harvesting Engine
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              MOS transforms your accumulated documents into institutional intelligence, executive briefings, SOP
              candidates, and asset opportunities. Nothing valuable remains trapped in files.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!connected ? (
              <button
                onClick={() => connectM.mutate()}
                disabled={connectM.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {connectM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                Connect OneDrive
              </button>
            ) : (
              <>
                <button
                  onClick={() => scanM.mutate()}
                  disabled={scanM.isPending}
                  className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  {scanM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Scan OneDrive
                </button>
                <button
                  onClick={() => harvestBatchM.mutate()}
                  disabled={harvestBatchM.isPending || counts.pending === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-katana px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {harvestBatchM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Harvest {counts.pending > 0 ? `(${counts.pending})` : ""}
                </button>
                <button
                  onClick={() => disconnectM.mutate()}
                  disabled={disconnectM.isPending}
                  className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Disconnect OneDrive
                </button>
              </>
            )}

            {/* Google Drive is managed on the canonical page */}
            <Link
              to="/knowledge-connections"
              className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-accent"
            >
              <Cloud className="h-4 w-4" /> Manage Google Drive
            </Link>
          </div>
        </div>


        {/* Connection status */}
        {connected && (
          <div className="mb-6 rounded-lg border border-border/60 bg-surface/50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-sentinel status-live" />
              <div className="text-sm">
                <span className="font-medium">Connected</span>
                <span className="ml-2 text-muted-foreground">{status.accountLabel}</span>
              </div>
            </div>
          </div>
        )}

        {!connected && !statusQ.isLoading && (
          <div className="mb-6 rounded-lg border border-dashed border-border/60 bg-surface/40 p-6 text-sm text-muted-foreground">
            Connect your OneDrive to let MOS begin harvesting knowledge. Personal, Business, and shared libraries are
            supported. Files are read on demand; nothing is copied without an explicit harvest.
          </div>
        )}

        {/* Executive routing counts */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["iris", "apex", "katana", "sentinel"] as const).map((exec) => {
            const meta = EXEC_META[exec];
            const Icon = meta.icon;
            return (
              <button
                key={exec}
                onClick={() => setFilter((f) => (f === exec ? "all" : exec))}
                className={`rounded-lg border p-4 text-left transition ${
                  filter === exec ? "border-foreground/50 bg-accent" : "border-border/60 bg-surface/50 hover:bg-accent/40"
                }`}
              >
                <div className={`flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] ${meta.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {meta.name}
                </div>
                <div className="mt-2 text-2xl font-semibold">{counts[exec] ?? 0}</div>
                <div className="text-xs text-muted-foreground">routed documents</div>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {[
            { id: "all", label: `All (${counts.total})` },
            { id: "pending", label: `Pending (${counts.pending})` },
            { id: "harvested", label: `Harvested (${counts.harvested})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-full border px-3 py-1 ${
                filter === t.id ? "border-foreground/60 bg-accent" : "border-border/60 hover:bg-accent/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Document list */}
        <div className="grid gap-3 lg:grid-cols-2">
          {docsQ.isLoading && <div className="p-8 text-muted-foreground">Loading vault...</div>}
          {!docsQ.isLoading && filtered.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              {connected ? "No documents match this filter. Try a scan." : "Vault is empty."}
            </div>
          )}
          {filtered.map((doc) => {
            const exec = doc.executive_owner ? EXEC_META[doc.executive_owner] : null;
            const analysis = (doc.analysis ?? {}) as Record<string, unknown>;
            const summary = (analysis.summary as string) ?? doc.snippet ?? "";
            return (
              <div
                key={doc.id}
                className="rounded-lg border border-border/60 bg-surface/50 p-4 transition hover:border-foreground/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="truncate">{doc.path?.replace(/^\/drive\/root:/, "") || "/"}</span>
                    </div>
                    <button
                      onClick={() => setSelected(doc)}
                      className="mt-1 block truncate text-left font-medium hover:underline"
                    >
                      {doc.name}
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {exec && (
                        <span className={`rounded-full bg-accent/60 px-2 py-0.5 font-mono uppercase ${exec.color}`}>
                          {exec.name}
                        </span>
                      )}
                      {doc.knowledge_type && (
                        <span className="rounded-full bg-accent/60 px-2 py-0.5 text-muted-foreground">
                          {doc.knowledge_type}
                        </span>
                      )}
                      {doc.priority && (
                        <span className="rounded-full bg-accent/60 px-2 py-0.5 text-muted-foreground">
                          priority: {doc.priority}
                        </span>
                      )}
                      {doc.knowledge_score != null && (
                        <span className="rounded-full bg-accent/60 px-2 py-0.5 text-muted-foreground">
                          score {doc.knowledge_score}
                        </span>
                      )}
                      <span className="ml-auto text-muted-foreground">
                        {doc.harvested_at
                          ? `harvested ${formatDistanceToNow(new Date(doc.harvested_at), { addSuffix: true })}`
                          : `discovered ${formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}`}
                      </span>
                    </div>
                    {summary && (
                      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{summary}</p>
                    )}
                  </div>
                </div>
                {doc.status === "discovered" && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => harvestOne(doc.id)}
                      disabled={busyId === doc.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      {busyId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Harvest
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail drawer */}
        {selected && (
          <div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <div
              className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-border/60 bg-background p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {selected.path?.replace(/^\/drive\/root:/, "") || "/"}
                  </div>
                  <h2 className="mt-1 font-display text-xl font-semibold">{selected.name}</h2>
                </div>
                <button
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                  onClick={() => setSelected(null)}
                >
                  ✕
                </button>
              </div>
              {(() => {
                const a = (selected.analysis ?? {}) as Record<string, unknown>;
                const list = (k: string) => (Array.isArray(a[k]) ? (a[k] as string[]) : []);
                const section = (title: string, items: string[], accent: string) =>
                  items.length ? (
                    <div className="mt-4">
                      <div className={`text-[11px] font-mono uppercase tracking-[0.2em] ${accent}`}>{title}</div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {items.map((it, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground">›</span>
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null;
                return (
                  <>
                    {a.summary && (
                      <p className="text-sm leading-relaxed text-foreground/90">{a.summary as string}</p>
                    )}
                    {section("Key Insights", list("insights"), "text-iris")}
                    {section("Lessons Learned", list("lessons"), "text-apex")}
                    {section("SOP Opportunities", list("sop_opportunities"), "text-apex")}
                    {section("Training Opportunities", list("training_opportunities"), "text-iris")}
                    {section("Asset Opportunities", list("asset_opportunities"), "text-katana")}
                    {section("Automation Opportunities", list("automation_opportunities"), "text-katana")}
                    {section("Revenue Opportunities", list("revenue_opportunities"), "text-katana")}
                    {section("Risks", list("risks"), "text-sentinel")}
                    {selected.status === "discovered" && (
                      <button
                        onClick={() => harvestOne(selected.id)}
                        disabled={busyId === selected.id}
                        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                      >
                        {busyId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Harvest this document
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </MosShell>
  );
}
