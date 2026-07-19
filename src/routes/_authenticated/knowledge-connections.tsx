// Canonical MOS knowledge-connection management page (Strike 1).
// Google Drive → custom MOS OAuth (src/lib/custom-gdrive.functions.ts).
// OneDrive → existing App User Connector (src/lib/onedrive.functions.ts).
// The legacy App User Connector Google Drive flow (google-drive.functions.ts,
// my-google-drive.functions.ts) is deprecated and no longer imported here.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MosShell } from "@/components/mos-shell";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import {
  startCustomGoogleConnect,
  getCustomGoogleStatus,
  disconnectCustomGoogle,
  listCustomDriveFolders,
  listCustomSelectedFolders,
  addCustomSelectedFolder,
  removeCustomSelectedFolder,
  syncCustomGoogleDrive,
  listCustomKnowledgeAudit,
} from "@/lib/custom-gdrive.functions";
import {
  getOneDriveStatus,
  startOneDriveConnect,
  saveOneDriveConnection,
  disconnectOneDrive,
} from "@/lib/onedrive.functions";
import {
  Cloud,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  FolderPlus,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/knowledge-connections")({
  component: KnowledgeConnectionsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Knowledge Connections error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const GATEWAY = "https://connector-gateway.lovable.dev";

function KnowledgeConnectionsPage() {
  return (
    <MosShell>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Knowledge Connections
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Connected Knowledge Sources
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Authorize the drives MOS is allowed to read. Access is least-privilege, server-side,
            per-user, and read-only. Credentials never touch the browser. MOS never modifies or
            deletes files at the source.
          </p>
        </div>

        <GoogleDriveCard />
        <OneDriveCard />
        <AuditLogCard />

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Metadata-only sync · least-privilege scopes · per-user isolation · full audit trail.
        </p>
      </div>
    </MosShell>
  );
}

/* ------------------------------------------------------------------ */
/* Google Drive — canonical custom OAuth                              */
/* ------------------------------------------------------------------ */

function GoogleDriveCard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const status = useQuery({
    queryKey: ["gdrive-custom-status"],
    queryFn: () => getCustomGoogleStatus(),
    retry: false,
  });
  const connected = status.data && "connected" in status.data && status.data.connected;

  const selected = useQuery({
    queryKey: ["gdrive-custom-selected"],
    queryFn: () => listCustomSelectedFolders(),
    enabled: !!connected,
    retry: false,
  });

  const connectM = useMutation({
    mutationFn: async () => {
      const res = await startCustomGoogleConnect({
        data: { redirectTarget: "/knowledge-connections" },
      });
      window.location.href = res.authorizationUrl;
    },
  });
  const disconnectM = useMutation({
    mutationFn: () => disconnectCustomGoogle(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gdrive-custom-status"] });
      qc.invalidateQueries({ queryKey: ["gdrive-custom-selected"] });
      qc.invalidateQueries({ queryKey: ["gdrive-audit"] });
    },
  });
  const syncM = useMutation({
    mutationFn: () => syncCustomGoogleDrive(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gdrive-custom-selected"] });
      qc.invalidateQueries({ queryKey: ["gdrive-audit"] });
      qc.invalidateQueries({ queryKey: ["vault-docs"] });
    },
  });
  const searchM = useMutation({
    mutationFn: (q: string) =>
      listCustomDriveFolders({ data: { query: q || undefined } }),
  });
  const addM = useMutation({
    mutationFn: (input: { folderId: string; folderName: string; driveId?: string }) =>
      addCustomSelectedFolder({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gdrive-custom-selected"] }),
  });
  const removeM = useMutation({
    mutationFn: (folderId: string) => removeCustomSelectedFolder({ data: { folderId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gdrive-custom-selected"] }),
  });

  return (
    <section className="mb-8 rounded-lg border border-iris/40 bg-iris/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-iris" />
            <h2 className="font-display text-lg">Google Drive</h2>
            {connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sentinel/10 px-2 py-0.5 text-xs text-sentinel">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            )}
            {!connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Not connected
              </span>
            )}
          </div>
          <p className="mt-2 max-w-xl text-xs text-muted-foreground">
            Uses the MOS-owned Google OAuth client (PKCE + AES-256-GCM token
            encryption). Only folders you explicitly select are ever read.
            While Google keeps the app in <strong>Testing</strong>, connections
            may need renewal every 7 days — a Google policy, not a MOS bug.
          </p>
          {connected && "accountEmail" in status.data && status.data.accountEmail && (
            <p className="mt-2 text-sm text-muted-foreground">
              {status.data.accountName} ·{" "}
              <span className="font-mono">{status.data.accountEmail}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {!connected ? (
            <button
              onClick={() => connectM.mutate()}
              disabled={connectM.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-iris px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {connectM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              Connect Google Drive
            </button>
          ) : (
            <>
              <button
                onClick={() => syncM.mutate()}
                disabled={syncM.isPending || (selected.data?.length ?? 0) === 0}
                className="inline-flex items-center gap-2 rounded-md bg-katana px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {syncM.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Scan folders
              </button>
              <button
                onClick={() => disconnectM.mutate()}
                disabled={disconnectM.isPending}
                className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Disconnect & revoke
              </button>
            </>
          )}
        </div>
      </div>

      {connected && (
        <div className="mt-5 border-t border-iris/20 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">
                Authorized folders (My Drive + shared drives)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Metadata for files inside these folders is registered to the vault. File
                contents are never copied.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {(selected.data ?? []).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-md border border-border/40 bg-background/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{f.folder_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {f.is_shared_drive ? "Shared drive" : "My Drive"}
                    {typeof f.file_count === "number" && (
                      <> · {f.file_count} files registered</>
                    )}
                    {f.last_sync_at && (
                      <>
                        {" "}
                        · synced{" "}
                        {formatDistanceToNow(new Date(f.last_sync_at), { addSuffix: true })}
                      </>
                    )}
                    {f.last_sync_status && f.last_sync_status !== "ok" && (
                      <span className="ml-2 text-katana">· {f.last_sync_status}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeM.mutate(f.folder_id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Remove folder"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {(selected.data?.length ?? 0) === 0 && (
              <p className="rounded-md border border-dashed border-border/60 p-3 text-center text-[11px] text-muted-foreground">
                No folders authorized yet. Search below and add specific folders.
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders (My Drive + shared)…"
              className="flex-1 rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => searchM.mutate(search)}
              disabled={searchM.isPending}
              className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {searchM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </div>
          {searchM.data && (
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {searchM.data.length === 0 && (
                <p className="text-xs text-muted-foreground">No folders matched.</p>
              )}
              {searchM.data.map((f) => {
                const already = selected.data?.some((s) => s.folder_id === f.id);
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/40"
                  >
                    <span className="truncate text-sm">
                      {f.name}{" "}
                      {f.driveId && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(shared)</span>
                      )}
                    </span>
                    <button
                      disabled={already || addM.isPending}
                      onClick={() =>
                        addM.mutate({
                          folderId: f.id,
                          folderName: f.name,
                          driveId: f.driveId,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-iris/10 px-2 py-1 text-xs text-iris hover:bg-iris/20 disabled:opacity-40"
                    >
                      <FolderPlus className="h-3 w-3" />
                      {already ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {connectM.error && (
        <p className="mt-3 text-xs text-destructive">{(connectM.error as Error).message}</p>
      )}
      {syncM.data && (
        <p className="mt-3 text-xs text-muted-foreground">
          Registered {syncM.data.synced} files across {syncM.data.folders} folder(s)
          {syncM.data.failed ? `, ${syncM.data.failed} failed` : ""}. Metadata only —
          contents were not analyzed.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* OneDrive — existing App User Connector (unchanged)                 */
/* ------------------------------------------------------------------ */

function OneDriveCard() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["onedrive-status"],
    queryFn: () => getOneDriveStatus(),
    retry: false,
  });
  const connected = status.data && "connected" in status.data && status.data.connected;

  const connectM = useMutation({
    mutationFn: async () => {
      const result = await connectAppUser({
        connectorId: "microsoft_onedrive",
        gatewayBaseUrl: GATEWAY,
        start: (origin) => startOneDriveConnect({ data: origin }),
      });
      if (!result.success) throw new Error(result.error ?? "Connection failed");
      if (result.connectionAPIKey) {
        await saveOneDriveConnection({
          data: { connectionAPIKey: result.connectionAPIKey },
        });
      }
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onedrive-status"] }),
  });
  const disconnectM = useMutation({
    mutationFn: () => disconnectOneDrive(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onedrive-status"] }),
  });

  return (
    <section className="mb-8 rounded-lg border border-border/60 bg-surface/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-apex" />
            <h2 className="font-display text-lg">Microsoft OneDrive</h2>
            {connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sentinel/10 px-2 py-0.5 text-xs text-sentinel">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            )}
            {!connected && !status.isLoading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Not connected
              </span>
            )}
          </div>
          <p className="mt-2 max-w-xl text-xs text-muted-foreground">
            Personal, Business, and shared libraries. Files are read on demand — nothing is
            copied without an explicit harvest inside the Vault.
          </p>
          {connected && status.data && "accountLabel" in status.data && (
            <p className="mt-2 text-sm text-muted-foreground">{status.data.accountLabel}</p>
          )}
          {connected &&
            status.data &&
            "healthy" in status.data &&
            !status.data.healthy && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-katana">
                <AlertTriangle className="h-3 w-3" /> Attention needed
              </p>
            )}
        </div>
        <div>
          {!connected ? (
            <button
              onClick={() => connectM.mutate()}
              disabled={connectM.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-apex px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {connectM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4" />
              )}
              Connect OneDrive
            </button>
          ) : (
            <button
              onClick={() => disconnectM.mutate()}
              disabled={disconnectM.isPending}
              className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Manage OneDrive scanning and harvest inside{" "}
        <Link to="/vault" className="underline">
          the Vault
        </Link>
        .
      </p>
      {connectM.error && (
        <p className="mt-3 text-xs text-destructive">{(connectM.error as Error).message}</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Audit log (per user)                                               */
/* ------------------------------------------------------------------ */

function AuditLogCard() {
  const audit = useQuery({
    queryKey: ["gdrive-audit"],
    queryFn: () => listCustomKnowledgeAudit(),
    retry: false,
  });
  return (
    <section className="rounded-lg border border-border/60 bg-surface/50 p-6">
      <h2 className="mb-3 font-display text-lg">Audit log</h2>
      <div className="max-h-72 space-y-1 overflow-y-auto text-xs font-mono">
        {(audit.data ?? []).map((e) => (
          <div
            key={e.id}
            className="flex justify-between gap-4 border-b border-border/20 py-1.5"
          >
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
            </span>
            <span className="flex-1 truncate">{e.action}</span>
            {e.target_ref && (
              <span className="truncate text-muted-foreground">{e.target_ref}</span>
            )}
          </div>
        ))}
        {(audit.data?.length ?? 0) === 0 && (
          <p className="text-muted-foreground">No events yet.</p>
        )}
      </div>
    </section>
  );
}
