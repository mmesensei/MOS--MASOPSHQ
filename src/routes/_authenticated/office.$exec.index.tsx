import { createFileRoute, Link, useNavigate, useParams, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { lazy, Suspense } from "react";
import { MosShell } from "@/components/mos-shell";
import { ExecutivePresence } from "@/components/executive-presence";
import { useAwarenessScan } from "@/components/executive-briefing";

import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { createThread, deleteThread, listThreads } from "@/lib/mos.functions";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// R3F is browser-only; lazy-load so the office route stays SSR-safe.
const ExecutiveLivingScene = lazy(() => import("@/components/executive-living-scene"));

export const Route = createFileRoute("/_authenticated/office/$exec/")({
  component: Office,
});

function isExec(v: string): v is ExecutiveId {
  return v === "iris" || v === "apex" || v === "katana" || v === "sentinel";
}

function Office() {
  const { exec } = useParams({ from: "/_authenticated/office/$exec" });
  if (!isExec(exec)) throw notFound();
  const e = EXECUTIVES[exec];
  const qc = useQueryClient();
  const navigate = useNavigate();
  useAwarenessScan("office_load", `/office/${exec}`);

  const threads = useQuery({ queryKey: ["threads", exec], queryFn: () => listThreads({ data: { executive: exec } }) });

  const create = useMutation({
    mutationFn: () => createThread({ data: { executive: exec } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads", exec] });
      navigate({ to: "/office/$exec/$threadId", params: { exec, threadId: t.id } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });


  const del = useMutation({
    mutationFn: (id: string) => deleteThread({ data: { threadId: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["threads", exec] }); toast.success("Engagement closed"); },
  });

  const count = threads.data?.length ?? 0;
  const atLimit = count >= 10;

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,340px)_1fr]">
          {/* Presence column */}
          <div>
            <Suspense
              fallback={<ExecutivePresence executive={exec} state="listening" size="full" />}
            >
              <ExecutiveLivingScene executive={exec} />
            </Suspense>
            <div className="mt-4">
              <div className={`text-[10px] font-mono uppercase tracking-[0.3em] ${e.colorClass}`}>{e.signature}</div>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{e.name}</h1>
              <div className="text-sm text-muted-foreground">{e.title}</div>
              <p className="mt-3 italic text-muted-foreground">"{e.question}"</p>
              <div className="mt-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Responsibilities</div>
              <ul className="mt-2 space-y-1 text-sm text-foreground/85">
                {e.responsibilities.map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${e.id === "iris" ? "bg-iris" : e.id === "apex" ? "bg-apex" : e.id === "katana" ? "bg-katana" : "bg-sentinel"}`} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Engagements column */}
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Active engagements</div>
                <h2 className="mt-1 font-display text-2xl font-semibold">What {e.name} is working on with you</h2>
                <p className="mt-1 text-sm text-muted-foreground">Each engagement is a live line of work. {count} / 10 open.</p>
              </div>
              <button onClick={() => create.mutate()} disabled={atLimit || create.isPending}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md ${e.accentClass} px-4 py-2 text-sm font-medium disabled:opacity-40`}>
                <Plus className="h-4 w-4" /> {create.isPending ? "Opening…" : atLimit ? "Limit reached" : "Begin engagement"}
              </button>
            </div>

            {threads.data && threads.data.length === 0 && (
              <div className="hq-panel p-8 text-center">
                <h3 className="font-display text-lg font-semibold">Standing by.</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Begin your first engagement with {e.name}. They will remember what you bring them.
                </p>
                <button onClick={() => create.mutate()} className={`mt-4 inline-flex items-center gap-1.5 rounded-md ${e.accentClass} px-4 py-2 text-sm font-medium`}>
                  <Plus className="h-4 w-4" /> Begin engagement
                </button>
              </div>
            )}

            <div className="space-y-3">
              {threads.data?.map((t) => (
                <div key={t.id} className="hq-panel group flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
                  <Link to="/office/$exec/$threadId" params={{ exec, threadId: t.id }} className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</div>
                  </Link>
                  <Link to="/office/$exec/$threadId" params={{ exec, threadId: t.id }} className={`inline-flex items-center gap-1 text-xs font-medium ${e.colorClass}`}>Enter <ArrowRight className="h-3 w-3" /></Link>
                  <button onClick={() => { if (confirm("Close this engagement? Its record will be deleted.")) del.mutate(t.id); }}
                    className="rounded-md p-2 text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:opacity-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MosShell>
  );
}
