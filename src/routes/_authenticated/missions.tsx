import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { listMissionsV2, advanceMissionStage } from "@/lib/mos-v2.functions";
import { createReview, runDeliberation } from "@/lib/committee.functions";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { Plus, Target, ArrowRight, Gavel } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/missions")({
  component: MissionsPage,
});

const STAGES = ["proposed", "chartered", "active", "in_review", "completed", "held", "archived"] as const;

const STAGE_COLOR: Record<string, string> = {
  proposed: "bg-muted text-muted-foreground",
  chartered: "bg-iris/20 text-iris",
  active: "bg-katana/20 text-katana",
  in_review: "bg-apex/20 text-apex",
  completed: "bg-sentinel/20 text-sentinel",
  held: "bg-destructive/20 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

function MissionsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [filter, setFilter] = useState<string>("active-only");
  const missions = useQuery({ queryKey: ["missions"], queryFn: () => listMissionsV2() });

  const advance = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => advanceMissionStage({ data: { id, stage } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missions"] }),
  });

  const sendToCommittee = useMutation({
    mutationFn: async (m: { id: string; title: string; objective?: string | null; priority?: string; stage?: string }) => {
      const res = await createReview({ data: {
        subject_type: "mission", subject_id: m.id,
        title: m.title, summary: m.objective ?? undefined,
        context: { priority: m.priority, stage: m.stage },
      } });
      runDeliberation({ data: { reviewId: res.id } }).catch(() => {});
      return res;
    },
    onSuccess: ({ id }) => { toast.success("Board convened"); navigate({ to: "/committee/$reviewId", params: { reviewId: id } }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = (missions.data ?? []).filter((m) => {
    if (filter === "all") return true;
    if (filter === "active-only") return !["completed", "archived", "held"].includes(m.stage);
    return m.stage === filter;
  });

  return (
    <MosShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-katana">Mission Command</div>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Missions</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Every important thing becomes a mission. The Council charters it. KATANA tracks it. SENTINEL guards it.</p>
          </div>
          <Link to="/missions/new" className="inline-flex items-center gap-1.5 rounded-md bg-katana px-4 py-2 text-sm font-medium text-katana-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Charter new mission
          </Link>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          <FilterChip label="Active only" v="active-only" filter={filter} setFilter={setFilter} />
          <FilterChip label="All" v="all" filter={filter} setFilter={setFilter} />
          {STAGES.map((s) => <FilterChip key={s} label={s.replace("_", " ")} v={s} filter={filter} setFilter={setFilter} />)}
        </div>

        {rows.length === 0 && (
          <div className="hq-panel p-10 text-center">
            <Target className="mx-auto h-8 w-8 text-katana" />
            <h3 className="mt-3 font-display text-xl font-semibold">No missions in view</h3>
            <p className="mt-1 text-sm text-muted-foreground">Charter your first mission with the Council.</p>
            <Link to="/missions/new" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-katana px-4 py-2 text-sm font-medium text-katana-foreground">
              <Plus className="h-4 w-4" /> Charter mission
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {rows.map((m) => {
            const sponsor = m.sponsor_executive ? EXECUTIVES[m.sponsor_executive as ExecutiveId] : null;
            return (
              <div key={m.id} className="hq-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${STAGE_COLOR[m.stage] ?? "bg-muted"}`}>{m.stage.replace("_", " ")}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${
                        m.priority === "Critical" ? "bg-destructive/20 text-destructive" :
                        m.priority === "High" ? "bg-katana/20 text-katana" :
                        m.priority === "Medium" ? "bg-apex/20 text-apex" : "bg-muted text-muted-foreground"
                      }`}>{m.priority}</span>
                      {sponsor && <span className={`text-[10px] font-mono uppercase tracking-widest ${sponsor.colorClass}`}>{sponsor.name}</span>}
                    </div>
                    <Link to={`/missions/${m.id}`} className="mt-1.5 block font-display text-lg font-semibold hover:text-primary">{m.title}</Link>
                    {m.objective && <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.objective}</div>}
                    <div className="mt-2 text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(m.updated_at), { addSuffix: true })}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <select value={m.stage} onChange={(e) => advance.mutate({ id: m.id, stage: e.target.value })}
                      className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                      {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                    <Link to={`/missions/${m.id}`} className="inline-flex items-center gap-1 text-xs text-primary">Open <ArrowRight className="h-3 w-3" /></Link>
                    {isAdmin && (
                      <button
                        onClick={() => sendToCommittee.mutate({ id: m.id, title: m.title, objective: m.objective, priority: m.priority, stage: m.stage })}
                        disabled={sendToCommittee.isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                        title="Send to Executive Committee"
                      ><Gavel className="h-3 w-3" /> Committee</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MosShell>
  );
}

function FilterChip({ label, v, filter, setFilter }: { label: string; v: string; filter: string; setFilter: (v: string) => void }) {
  return (
    <button onClick={() => setFilter(v)}
      className={`rounded-full px-3 py-1 text-xs capitalize ${filter === v ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );
}
