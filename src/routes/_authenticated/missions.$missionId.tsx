import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { ExecutivePresence } from "@/components/executive-presence";
import { getMission, advanceMissionStage } from "@/lib/mos-v2.functions";
import { ArrowLeft, Shield, Compass, Hexagon, Swords } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/missions/$missionId")({
  component: MissionDetail,
});

const STAGES = ["proposed", "chartered", "active", "in_review", "completed", "held", "archived"] as const;

function MissionDetail() {
  const { missionId } = useParams({ from: "/_authenticated/missions/$missionId" });
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mission", missionId], queryFn: () => getMission({ data: { id: missionId } }) });

  const advance = useMutation({
    mutationFn: (stage: string) => advanceMissionStage({ data: { id: missionId, stage } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mission", missionId] }); toast.success("Stage advanced"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (q.isLoading) return <MosShell><div className="p-10 text-center text-muted-foreground">Loading mission…</div></MosShell>;
  if (!q.data || !q.data.mission) return <MosShell><div className="p-10 text-center">Mission not found.</div></MosShell>;
  const { mission, activity } = q.data;
  const charter = (mission.charter ?? {}) as { iris_intent?: string; apex_structure?: string; katana_plan?: string; sentinel_risk?: string };
  const sponsor = mission.sponsor_executive ? EXECUTIVES[mission.sponsor_executive as ExecutiveId] : null;

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/missions" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All missions
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-katana">Mission · {mission.stage}</div>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{mission.title}</h1>
            {sponsor && <div className={`mt-1 text-xs font-mono uppercase tracking-widest ${sponsor.colorClass}`}>Sponsored by {sponsor.name}</div>}
          </div>
          <div className="flex items-center gap-2">
            <select value={mission.stage} onChange={(e) => advance.mutate(e.target.value)}
              className="rounded-md border border-border bg-input px-3 py-1.5 text-xs">
              {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">{mission.objective}</p>

        {/* Council contributions */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <CharterCard exec="iris" icon={<Compass className="h-4 w-4" />} label="Intent" body={charter.iris_intent} />
          <CharterCard exec="apex" icon={<Hexagon className="h-4 w-4" />} label="Structure" body={charter.apex_structure} />
          <CharterCard exec="katana" icon={<Swords className="h-4 w-4" />} label="Plan" body={charter.katana_plan} />
          <CharterCard exec="sentinel" icon={<Shield className="h-4 w-4" />} label="Risk" body={charter.sentinel_risk} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ListCard title="Deliverables" items={mission.deliverables ?? []} />
          <ListCard title="Risks" items={mission.risks ?? []} />
        </div>

        {/* Activity log */}
        <div className="hq-panel mt-8 p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Activity log</div>
          <div className="mt-3 space-y-2">
            {activity.length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
            {activity.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-none">
                <div>
                  <div className="text-sm font-medium">{a.event}</div>
                  {a.detail && <div className="text-xs text-muted-foreground">{a.detail}</div>}
                </div>
                <div className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MosShell>
  );
}

function CharterCard({ exec, icon, label, body }: { exec: ExecutiveId; icon: React.ReactNode; label: string; body?: string }) {
  const e = EXECUTIVES[exec];
  return (
    <div className="hq-panel p-5">
      <div className="flex items-center gap-3">
        <ExecutivePresence executive={exec} state="reviewing" size="chip" />
        <div>
          <div className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest ${e.colorClass}`}>
            {icon} {e.name} · {label}
          </div>
          <div className="text-xs text-muted-foreground">{e.title}</div>
        </div>
      </div>
      <pre className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{body || "—"}</pre>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="hq-panel p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{title}</div>
      {items.length === 0 ? <div className="mt-2 text-sm text-muted-foreground">None recorded.</div> : (
        <ul className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
