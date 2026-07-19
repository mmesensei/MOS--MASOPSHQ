import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { MosShell } from "@/components/mos-shell";
import { getSop } from "@/lib/mos-v2.functions";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sops/$sopId")({
  component: SopDetail,
});

function SopDetail() {
  const { sopId } = useParams({ from: "/_authenticated/sops/$sopId" });
  const q = useQuery({ queryKey: ["sop", sopId], queryFn: () => getSop({ data: { id: sopId } }) });

  if (q.isLoading) return <MosShell><div className="p-10 text-center text-muted-foreground">Loading…</div></MosShell>;
  if (!q.data) return <MosShell><div className="p-10 text-center">Not found.</div></MosShell>;
  const s = q.data;

  return (
    <MosShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/sops" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Library
        </Link>
        <div className="text-[10px] font-mono uppercase tracking-widest text-apex">{s.category}{s.source ? ` · ${s.source}` : ""}</div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{s.title}</h1>
        {s.summary && <p className="mt-2 text-muted-foreground">{s.summary}</p>}
        {s.tags && s.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {s.tags.map((t: string) => <span key={t} className="rounded bg-surface px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}
          </div>
        )}
        <article className="prose prose-invert prose-sm mt-8 max-w-none prose-headings:font-display prose-strong:text-foreground">
          <ReactMarkdown>{s.body}</ReactMarkdown>
        </article>
      </div>
    </MosShell>
  );
}
