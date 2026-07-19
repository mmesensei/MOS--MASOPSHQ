import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { convokeCouncil, listCouncilSessions } from "@/lib/mos.functions";
import { EXECUTIVES } from "@/lib/executives";
import { Users, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/council")({
  component: CouncilPage,
});

function CouncilPage() {
  const qc = useQueryClient();
  const [request, setRequest] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const sessions = useQuery({ queryKey: ["councils"], queryFn: () => listCouncilSessions() });

  const convoke = useMutation({
    mutationFn: (r: string) => convokeCouncil({ data: { request: r } }),
    onSuccess: (id) => {
      setRequest("");
      setExpanded(id as unknown as string);
      qc.invalidateQueries({ queryKey: ["councils"] });
      toast.success("Executive Council recommendation ready");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Council failed"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (request.trim().length < 10) {
      toast.error("Give the Council a substantive brief (at least a full sentence)");
      return;
    }
    convoke.mutate(request.trim());
  }

  return (
    <MosShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-iris">Executive Council</div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Convene the full team</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            IRIS defines the objective. APEX designs the system. KATANA plans execution. SENTINEL reviews risk. IRIS
            delivers the unified recommendation. Use for strategic, cross-functional, or irreversible calls.
          </p>
        </header>

        <form onSubmit={submit} className="hq-panel exec-glow-iris mb-10 p-5">
          <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            Operator Request
          </label>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={4}
            placeholder="Describe the decision, opportunity, or problem you want the Council to review. Be specific."
            className="mt-2 w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <div className="flex -space-x-2">
              {Object.values(EXECUTIVES).map((e) => (
                <div
                  key={e.id}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-background ${e.bgTint}`}
                  title={e.name}
                >
                  <span className={`text-[10px] font-bold ${e.colorClass}`}>{e.name.charAt(0)}</span>
                </div>
              ))}
              <div className="ml-3 self-center text-xs text-muted-foreground">All four executives will review</div>
            </div>
            <button
              type="submit"
              disabled={convoke.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              {convoke.isPending ? "Council in session…" : "Convene Council"}
            </button>
          </div>
        </form>

        <section>
          <div className="mb-3 text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">Past Sessions</div>
          {sessions.data?.length === 0 && (
            <div className="hq-panel p-6 text-sm text-muted-foreground">No council sessions yet.</div>
          )}
          <div className="space-y-3">
            {sessions.data?.map((s) => (
              <div key={s.id} className="hq-panel">
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  {expanded === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.operator_request}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })} · {s.status}
                    </div>
                  </div>
                </button>

                {expanded === s.id && (
                  <div className="border-t border-border/60 p-5">
                    {s.final_recommendation && (
                      <section className="mb-6 rounded-md border border-primary/30 bg-primary/5 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary">
                          Council Recommendation
                        </div>
                        <div className="prose prose-sm prose-invert mt-2 max-w-none">
                          <ReactMarkdown>{s.final_recommendation}</ReactMarkdown>
                        </div>
                      </section>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      <AnalysisBlock exec="iris" text={s.iris_analysis} label="Strategy" />
                      <AnalysisBlock exec="apex" text={s.apex_analysis} label="Systems" />
                      <AnalysisBlock exec="katana" text={s.katana_analysis} label="Execution" />
                      <AnalysisBlock exec="sentinel" text={s.sentinel_analysis} label="Risk & Security" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </MosShell>
  );
}

function AnalysisBlock({ exec, text, label }: { exec: keyof typeof EXECUTIVES; text: string | null; label: string }) {
  const e = EXECUTIVES[exec];
  return (
    <div className={`rounded-md border border-border/60 p-4 ${e.bgTint}/30`}>
      <div className={`text-[10px] font-mono uppercase tracking-[0.25em] ${e.colorClass}`}>
        {e.name} · {label}
      </div>
      <div className="prose prose-sm prose-invert mt-2 max-w-none prose-p:my-1.5">
        {text ? <ReactMarkdown>{text}</ReactMarkdown> : <em className="text-muted-foreground">Pending…</em>}
      </div>
    </div>
  );
}
