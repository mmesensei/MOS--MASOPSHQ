import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { listDocuments, addDocument, seedDoctrineIfEmpty } from "@/lib/mos.functions";
import { BookOpen, Plus, FileText, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("v1");
  const [content, setContent] = useState("");

  const docs = useQuery({ queryKey: ["docs"], queryFn: () => listDocuments() });

  useEffect(() => {
    seedDoctrineIfEmpty()
      .then(() => qc.invalidateQueries({ queryKey: ["docs"] }))
      .catch(() => void 0);
  }, [qc]);

  const add = useMutation({
    mutationFn: () => addDocument({ data: { title, content, version } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs"] });
      setTitle(""); setVersion("v1"); setContent(""); setShowForm(false);
      toast.success("Document added to institutional memory");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const active = docs.data?.find((d) => d.id === open);

  return (
    <MosShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-sentinel">Institutional Memory</div>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Library</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Constitution, doctrine, SOPs, frameworks, and long-term knowledge. What the executives consult when
              reasoning about your operation.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add document
          </button>
        </header>

        {showForm && (
          <form onSubmit={(e) => { e.preventDefault(); if (!title || !content) return toast.error("Title and content required"); add.mutate(); }} className="hq-panel mb-8 space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1" className="rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Paste markdown or plain text content…" className="w-full resize-y rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring font-mono" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-md px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={add.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {add.isPending ? "Storing…" : "Store in memory"}
              </button>
            </div>
          </form>
        )}

        {docs.data && docs.data.length === 0 && (
          <div className="hq-panel p-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-sentinel" />
            <h3 className="mt-3 font-display text-xl font-semibold">Library initializing</h3>
            <p className="mt-1 text-sm text-muted-foreground">MOS V1 doctrine seeds automatically on first sign-in.</p>
          </div>
        )}

        <div className="grid gap-3">
          {docs.data?.map((d) => (
            <button key={d.id} onClick={() => setOpen(d.id)} className="hq-panel flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sentinel/10">
                <FileText className="h-4 w-4 text-sentinel" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {d.version} · {d.source_filename || "manual"} · added {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                </div>
              </div>
              {d.is_seed && (
                <span className="rounded-full bg-sentinel/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-sentinel">
                  Seed
                </span>
              )}
            </button>
          ))}
        </div>

        {active && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setOpen(null)}>
            <div className="hq-panel relative max-h-[90vh] w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border/60 p-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-sentinel">
                    Institutional Memory · {active.version}
                  </div>
                  <div className="mt-1 font-display text-lg font-semibold">{active.title}</div>
                </div>
                <button onClick={() => setOpen(null)} className="rounded-md p-2 hover:bg-accent"><X className="h-4 w-4" /></button>
              </div>
              <div className="prose prose-sm prose-invert max-w-none overflow-y-auto p-6 max-h-[calc(90vh-6rem)]">
                <ReactMarkdown>{active.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </MosShell>
  );
}
