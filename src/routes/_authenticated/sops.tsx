import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { listSops, seedSopsIfEmpty, draftSopWithApex, createSop, deleteSop } from "@/lib/mos-v2.functions";
import { BookOpen, Plus, Sparkles, Trash2, FileText, Layout, GraduationCap, Puzzle, Layers, Repeat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sops")({
  component: SopLibrary,
});

const CATS = [
  { id: "sop", label: "SOPs", icon: FileText },
  { id: "template", label: "Templates", icon: Layout },
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "scenario", label: "Scenarios", icon: Puzzle },
  { id: "framework", label: "Frameworks", icon: Layers },
  { id: "pattern", label: "Patterns", icon: Repeat },
] as const;

function SopLibrary() {
  const qc = useQueryClient();
  const sops = useQuery({ queryKey: ["sops"], queryFn: () => listSops() });
  const [filter, setFilter] = useState<string>("all");
  const [drafting, setDrafting] = useState(false);
  const [topic, setTopic] = useState("");

  useEffect(() => { seedSopsIfEmpty().catch(() => void 0); }, []);

  const draft = useMutation({
    mutationFn: () => draftSopWithApex({ data: { topic, category: "sop" } }),
    onSuccess: async (r) => {
      await createSop({ data: { category: r.category, title: r.title, summary: r.summary, body: r.body, source: "Drafted with APEX", tags: ["ai-drafted"] } });
      qc.invalidateQueries({ queryKey: ["sops"] });
      setTopic(""); setDrafting(false);
      toast.success("APEX drafted a new SOP");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteSop({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sops"] }); toast.success("SOP removed"); },
  });

  const filtered = (sops.data ?? []).filter((s) => filter === "all" || s.category === filter);

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-apex">Institutional Library</div>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">SOPs, Templates & Frameworks</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Everything repeatable becomes an SOP. APEX drafts, you approve, KATANA runs.</p>
          </div>
          <button onClick={() => setDrafting(!drafting)} className="inline-flex items-center gap-1.5 rounded-md bg-apex px-4 py-2 text-sm font-medium text-apex-foreground">
            <Plus className="h-4 w-4" /> Draft with APEX
          </button>
        </header>

        {drafting && (
          <div className="hq-panel mb-6 p-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-apex">APEX · SOP Drafting</div>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3}
              placeholder="Describe the process, activity, or scenario APEX should turn into an SOP."
              className="mt-3 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setDrafting(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={() => draft.mutate()} disabled={draft.isPending || topic.length < 5}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40">
                <Sparkles className="h-3 w-3" /> {draft.isPending ? "APEX drafting…" : "Draft SOP"}
              </button>
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => setFilter("all")} className={`rounded-full px-3 py-1 text-xs ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
            <BookOpen className="mr-1 inline h-3 w-3" /> All ({sops.data?.length ?? 0})
          </button>
          {CATS.map((c) => {
            const Icon = c.icon;
            const count = (sops.data ?? []).filter((s) => s.category === c.id).length;
            return (
              <button key={c.id} onClick={() => setFilter(c.id)}
                className={`rounded-full px-3 py-1 text-xs ${filter === c.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                <Icon className="mr-1 inline h-3 w-3" /> {c.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((s) => (
            <div key={s.id} className="hq-panel group p-5 transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.category} {s.source ? `· ${s.source}` : ""}</div>
                  <Link to={`/sops/${s.id}`} className="mt-1 block font-display text-lg font-semibold hover:text-primary">{s.title}</Link>
                  {s.summary && <p className="mt-1 text-sm text-muted-foreground">{s.summary}</p>}
                  {s.tags && s.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.tags.slice(0, 6).map((t: string) => (
                        <span key={t} className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                {!s.is_seed && (
                  <button onClick={() => confirm("Delete this SOP?") && del.mutate(s.id)}
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </MosShell>
  );
}
