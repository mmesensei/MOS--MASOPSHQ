// Phase 1 — connector source picker for KATANA Revenue Board.
// Non-destructive: mirrors existing Google Drive + OneDrive connect flows.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { HardDrive, Cloud, Upload, FolderOpen, Box } from "lucide-react";
import { listSources, PROVIDER_LABELS } from "@/lib/katana/intake.functions";
import { getCustomGoogleStatus } from "@/lib/custom-gdrive.functions";
import { getOneDriveStatus } from "@/lib/onedrive.functions";

type Provider = "google_drive" | "onedrive" | "dropbox" | "upload" | "local_folder";

const ICON: Record<Provider, typeof HardDrive> = {
  google_drive: HardDrive,
  onedrive: Cloud,
  dropbox: Box,
  upload: Upload,
  local_folder: FolderOpen,
};

const CONNECT_LINK: Partial<Record<Provider, string>> = {
  google_drive: "/knowledge-connections",
  onedrive: "/knowledge-connections",
};


export function KatanaSourcesRail() {
  const listFn = useServerFn(listSources);
  const gdriveFn = useServerFn(getCustomGoogleStatus);
  const oneFn = useServerFn(getOneDriveStatus);

  const sources = useQuery({ queryKey: ["katana", "sources"], queryFn: () => listFn() });
  const gdrive = useQuery({ queryKey: ["katana", "gdrive-status"], queryFn: () => gdriveFn() });
  const onedrive = useQuery({ queryKey: ["katana", "onedrive-status"], queryFn: () => oneFn() });

  const gdriveConnected = gdrive.data && "connected" in gdrive.data && gdrive.data.connected;
  const onedriveConnected = onedrive.data && "connected" in onedrive.data && onedrive.data.connected;

  const providers: Array<{ id: Provider; connected: boolean; note?: string; comingSoon?: boolean }> = [
    { id: "google_drive", connected: !!gdriveConnected },
    { id: "onedrive", connected: !!onedriveConnected },
    { id: "upload", connected: (sources.data ?? []).some((s) => s.provider === "upload" && s.status === "active") },
    { id: "local_folder", connected: (sources.data ?? []).some((s) => s.provider === "local_folder" && s.status === "active") },
    { id: "dropbox", connected: false, comingSoon: true },
  ];

  return (
    <section className="mb-4 rounded-lg border border-border/60 bg-surface/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Authorized Sources</div>
        <div className="text-[11px] text-muted-foreground">
          Nothing is scanned without your explicit connect + approval.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {providers.map((p) => {
          const Icon = ICON[p.id];
          const label = PROVIDER_LABELS[p.id] ?? p.id;
          const link = CONNECT_LINK[p.id];
          const inner = (
            <div
              className={`flex h-full flex-col rounded-md border p-3 text-left transition ${
                p.connected
                  ? "border-katana/60 bg-katana/5"
                  : "border-border/60 hover:bg-accent/40"
              } ${p.comingSoon ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${p.connected ? "text-katana" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                {p.comingSoon ? "Coming soon" : p.connected ? "Connected · authorized" : "Not connected"}
              </div>
            </div>
          );
          if (p.comingSoon) return <div key={p.id}>{inner}</div>;
          if (link) return (
            <Link key={p.id} to={link} className="block">
              {inner}
            </Link>
          );
          return <div key={p.id}>{inner}</div>;
        })}
      </div>
    </section>
  );
}
