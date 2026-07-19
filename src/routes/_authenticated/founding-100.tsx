import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import {
  listFoundingVips,
  getVipConfig,
  isCurrentUserOwner,
  revokeVip,
  restoreVip,
  setPromotionState,
  flagFraud,
  type VipMember,
} from "@/lib/founding-vip.functions";
import { Shield, Pause, Play, Lock, Download, Flag, Undo2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/founding-100")({
  beforeLoad: async () => {
    const r = await isCurrentUserOwner().catch(() => ({ isOwner: false }));
    if (!r.isOwner) throw redirect({ to: "/hq" });
  },
  component: Founding100Panel,
});

function Founding100Panel() {
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ["foundingVips"], queryFn: () => listFoundingVips() });
  const config = useQuery({ queryKey: ["vipConfig"], queryFn: () => getVipConfig() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["foundingVips"] });
    qc.invalidateQueries({ queryKey: ["vipConfig"] });
  };

  const revoke = useMutation({
    mutationFn: (v: { userId: string; reason: string }) => revokeVip({ data: v }),
    onSuccess: () => { toast.success("VIP revoked"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const restore = useMutation({
    mutationFn: (v: { userId: string }) => restoreVip({ data: v }),
    onSuccess: () => { toast.success("VIP restored"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const promo = useMutation({
    mutationFn: (v: { paused: boolean; closed: boolean }) => setPromotionState({ data: v }),
    onSuccess: () => { toast.success("Promotion updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const fraud = useMutation({
    mutationFn: (v: { userId: string; flag: boolean; note: string }) => flagFraud({ data: v }),
    onSuccess: () => { toast.success("Flag updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cfg = config.data;
  const rows = members.data ?? [];

  function exportCsv() {
    const header = ["number", "user_id", "display_name", "email", "vip_status", "vip_granted_at", "vip_revoked_at", "fraud_flag"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        r.founding_vip_number ?? "",
        r.id,
        JSON.stringify(r.display_name ?? ""),
        JSON.stringify(r.email ?? ""),
        r.vip_status,
        r.vip_granted_at ?? "",
        r.vip_revoked_at ?? "",
        r.fraud_flag ? "1" : "0",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `founding-100-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.3em] text-primary">
              <Shield className="h-3.5 w-3.5" /> Owner Console
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Founding Lifetime VIP · Roster</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Manage the 100 permanent Founding Lifetime entitlements. Positions do not expire and are preserved
              across pricing changes, upgrades, migrations, and future tiers. Revocation is an owner-only
              exceptional action (compromise, deletion request, or legal order) and is written to an immutable
              audit log.
            </p>
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        {cfg && (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Granted" value={`${cfg.granted_count} / ${cfg.max_positions}`} />
            <Stat label="Remaining" value={`${Math.max(0, cfg.max_positions - cfg.granted_count)}`} />
            <Stat label="State" value={cfg.closed ? "Closed" : cfg.paused ? "Paused" : "Open"} />
            <div className="hq-panel flex items-center justify-center gap-2 p-2">
              <button
                onClick={() => promo.mutate({ paused: !cfg.paused, closed: cfg.closed })}
                disabled={cfg.closed}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
              >
                {cfg.paused ? <><Play className="h-3 w-3" /> Resume</> : <><Pause className="h-3 w-3" /> Pause</>}
              </button>
              <button
                onClick={() => {
                  if (confirm("Permanently close the promotion?")) promo.mutate({ paused: false, closed: true });
                }}
                disabled={cfg.closed}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
              >
                <Lock className="h-3 w-3" /> Close
              </button>
            </div>
          </div>
        )}

        <div className="hq-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Granted</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <Row key={r.id} r={r} onRevoke={revoke.mutate} onRestore={restore.mutate} onFlag={fraud.mutate} />)}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No Founding VIPs granted yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MosShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hq-panel p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

function Row({
  r, onRevoke, onRestore, onFlag,
}: {
  r: VipMember;
  onRevoke: (v: { userId: string; reason: string }) => void;
  onRestore: (v: { userId: string }) => void;
  onFlag: (v: { userId: string; flag: boolean; note: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t border-border/50">
        <td className="px-3 py-2 font-mono">#{String(r.founding_vip_number ?? 0).padStart(3, "0")}</td>
        <td className="px-3 py-2">{r.display_name ?? "—"}</td>
        <td className="px-3 py-2 text-muted-foreground">{r.email ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{r.vip_granted_at ? new Date(r.vip_granted_at).toLocaleDateString() : "—"}</td>
        <td className="px-3 py-2">
          <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-widest ${
            r.vip_status === "active" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          }`}>{r.vip_status}</span>
          {r.fraud_flag && <span className="ml-2 rounded bg-destructive/20 px-2 py-0.5 text-[10px] uppercase text-destructive">flagged</span>}
        </td>
        <td className="px-3 py-2 text-right">
          <button onClick={() => setOpen(!open)} className="text-xs text-muted-foreground hover:text-foreground">Manage</button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border/30 bg-surface/40">
          <td colSpan={6} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              {r.vip_status === "active" ? (
                <button
                  onClick={() => {
                    const reason = prompt("Reason for revocation:");
                    if (reason) onRevoke({ userId: r.id, reason });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
                ><X className="h-3 w-3" /> Revoke</button>
              ) : (
                <button
                  onClick={() => onRestore({ userId: r.id })}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
                ><Undo2 className="h-3 w-3" /> Restore</button>
              )}
              <button
                onClick={() => {
                  const note = prompt("Fraud note:", r.owner_notes ?? "") ?? "";
                  onFlag({ userId: r.id, flag: !r.fraud_flag, note });
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
              ><Flag className="h-3 w-3" /> {r.fraud_flag ? "Clear flag" : "Flag fraud"}</button>
              {r.owner_notes && <div className="text-xs text-muted-foreground">Notes: {r.owner_notes}</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
