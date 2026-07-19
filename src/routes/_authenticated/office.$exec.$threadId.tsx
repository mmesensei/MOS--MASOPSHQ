// Engagement conversation — premium executive messaging interface.
// - Chat bubbles with per-agent identity, timestamps, live status.
// - Pinned panel, in-conversation search, copy/regenerate/edit/pin.
// - KATANA execution proposals render as an explicit approval card.
// - Streaming responses appear as bubbles; typing indicator while thinking.
// - Backend, auth, engagements, streaming, and persistence unchanged.
// - Architecture note: voice can later create/read these same bubble
//   records without changing the presentation contract.
import { createFileRoute, useParams, notFound, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MosShell } from "@/components/mos-shell";
import { setExecPresence } from "@/lib/presence-bus";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { listMessages, persistTurn, listThreads } from "@/lib/mos.functions";
import { reflectAndJournal } from "@/lib/mos-v2.functions";
import { ArrowLeft, Send, Search, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MessageBubble, type BubbleData, type CollapsibleSection } from "@/components/conversation/message-bubble";
import { PinnedPanel } from "@/components/conversation/pinned-panel";
import { ExecutionApprovalCard } from "@/components/conversation/execution-approval-card";
import type { BubbleStatus } from "@/components/conversation/status-indicator";
import { StatusIndicator } from "@/components/conversation/status-indicator";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/office/$exec/$threadId")({
  component: EngagementRoom,
});

function isExec(v: string): v is ExecutiveId {
  return v === "iris" || v === "apex" || v === "katana" || v === "sentinel";
}

type StoredMsg = { id?: string; role: string; content: string; created_at?: string };

// --- Section parsing --------------------------------------------------------
// Detects the standard collapsible sections the executives may emit as
// H2/H3 headings (e.g. "## Reasoning", "### Execution Plan"). Sections are
// stripped from the visible body and rendered as collapsibles.
const SECTION_LABELS: CollapsibleSection["label"][] = [
  "Reasoning",
  "Execution Plan",
  "Knowledge Used",
  "References",
  "Risk Assessment",
  "Next Steps",
];

function extractSections(md: string): { body: string; sections: CollapsibleSection[] } {
  const sections: CollapsibleSection[] = [];
  const pattern = new RegExp(
    String.raw`^\s{0,3}#{2,4}\s+(${SECTION_LABELS.map((l) => l.replace(/ /g, "\\s+")).join("|")})\s*$`,
    "gim",
  );
  const matches = [...md.matchAll(pattern)];
  if (matches.length === 0) return { body: md, sections };
  let body = md.slice(0, matches[0].index ?? 0).trim();
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? md.length : md.length;
    const raw = md.slice(start, end).trim();
    const labelKey = m[1].replace(/\s+/g, " ").toLowerCase();
    const label = SECTION_LABELS.find((l) => l.toLowerCase() === labelKey) ?? "Reasoning";
    if (raw) sections.push({ label, content: raw });
  }
  if (!body) body = md.slice(0, matches[0].index ?? 0).trim();
  return { body, sections };
}

// Detects that KATANA has proposed an execution requiring approval.
function detectsApproval(text: string, exec: ExecutiveId): boolean {
  if (exec !== "katana") return false;
  return /approval\s+required|awaiting\s+approval|proceed\?|approve\s+this\s+plan|execution\s+plan/i.test(text);
}

function EngagementRoom() {
  const { exec, threadId } = useParams({ from: "/_authenticated/office/$exec/$threadId" });
  if (!isExec(exec)) throw notFound();
  const e = EXECUTIVES[exec];
  const qc = useQueryClient();

  const stored = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listMessages({ data: { threadId } }),
  });
  const threads = useQuery({
    queryKey: ["threads", exec],
    queryFn: () => listThreads({ data: { executive: exec } }),
  });
  const engagement = threads.data?.find((t) => t.id === threadId);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState<string>(""); // live assistant text
  const [status, setStatus] = useState<BubbleStatus>("available");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Pinned bubble IDs — persisted per-thread in localStorage.
  const pinKey = `mos:pinned:${threadId}`;
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(pinKey);
      setPinnedIds(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch { setPinnedIds(new Set()); }
  }, [pinKey]);
  function togglePin(id: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { window.localStorage.setItem(pinKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  // Build bubble list from stored messages.
  const bubbles: BubbleData[] = useMemo(() => {
    const rows = (stored.data ?? []) as StoredMsg[];
    return rows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m, i) => {
        const id = m.id ?? `${threadId}-${i}`;
        const createdAt = m.created_at ? new Date(m.created_at).getTime() : Date.now() - (rows.length - i) * 1000;
        if (m.role === "user") {
          return { id, role: "user", content: m.content, createdAt, pinned: pinnedIds.has(id) } as BubbleData;
        }
        const { body, sections } = extractSections(m.content);
        return {
          id,
          role: "assistant",
          executive: exec,
          content: body,
          sections,
          createdAt,
          status: "completed" as BubbleStatus,
          pinned: pinnedIds.has(id),
        } as BubbleData;
      });
  }, [stored.data, threadId, exec, pinnedIds]);

  const filteredBubbles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bubbles;
    return bubbles.filter((b) => b.content.toLowerCase().includes(q));
  }, [bubbles, search]);

  const pinnedBubbles = bubbles.filter((b) => pinnedIds.has(b.id));

  // Focus + scroll
  useEffect(() => { inputRef.current?.focus(); }, [threadId, sending]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles.length, streaming]);

  useEffect(() => { setExecPresence(exec, status === "thinking" ? "thinking" : status === "executing" ? "speaking" : "listening"); }, [exec, status]);
  useEffect(() => () => { setExecPresence(exec, "idle"); }, [exec]);

  async function send(text: string, opts?: { replaceLastUserAt?: number }) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    setStatus("thinking");
    setStreaming("");

    const priorHistory = bubbles.slice(0, opts?.replaceLastUserAt != null ? opts.replaceLastUserAt : bubbles.length);
    const modelHistory = priorHistory.map((b) => ({
      role: b.role,
      content: b.role === "assistant" && b.sections?.length
        ? [b.content, ...b.sections.map((s) => `## ${s.label}\n${s.content}`)].join("\n\n")
        : b.content,
    }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const bearer = sessionData.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({ executive: exec, messages: [...modelHistory, { role: "user", content: trimmed }] }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      setStatus(exec === "sentinel" ? "reviewing" : exec === "katana" ? "planning" : exec === "apex" ? "researching" : "thinking");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreaming(full);
      }

      await persistTurn({ data: { threadId, userText: trimmed, assistantText: full || "(no response)" } });
      reflectAndJournal({ data: { executive: exec, userText: trimmed, assistantText: full } })
        .then((r) => { if (r && "ok" in r) qc.invalidateQueries({ queryKey: ["journal"] }); })
        .catch(() => void 0);
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
      qc.invalidateQueries({ queryKey: ["threads", exec] });
      setStatus(detectsApproval(full, exec) ? "waiting_approval" : "completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat failed");
      setStatus("available");
    } finally {
      setStreaming("");
      setSending(false);
      setTimeout(() => setStatus("available"), 4000);
    }
  }

  function regenerate() {
    // Re-send the last user message as a fresh prompt.
    const lastUser = [...bubbles].reverse().find((b) => b.role === "user");
    if (lastUser) send(lastUser.content);
  }

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditText(bubbles[idx].content);
  }
  function saveEdit() {
    if (editingIdx == null) return;
    const text = editText.trim();
    setEditingIdx(null);
    if (!text) return;
    send(text, { replaceLastUserAt: editingIdx });
  }

  const liveAssistantBubble: BubbleData | null = sending
    ? {
        id: "__streaming",
        role: "assistant",
        executive: exec,
        content: streaming,
        createdAt: Date.now(),
        status,
      }
    : null;

  return (
    <MosShell>
      <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-5xl flex-col px-3 py-3 sm:px-6 sm:py-4">
        {/* Engagement header */}
        <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/40 pb-3">
          <div className="min-w-0">
            <Link
              to={`/office/${exec}`}
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> {e.name}'s office
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-lg font-semibold sm:text-xl">
                {engagement?.title ?? "Engagement"}
              </h1>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest", `${e.colorClass} bg-white/5`)}>
                with {e.name}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusIndicator status={status} />
            <button
              onClick={() => setShowSearch((v) => !v)}
              className="rounded-md p-2 text-muted-foreground hover:bg-surface hover:text-foreground"
              title="Search conversation"
              aria-label="Search conversation"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </header>

        {showSearch && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              placeholder="Search this conversation…"
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <PinnedPanel
          pinned={pinnedBubbles}
          onUnpin={togglePin}
          onJump={(id) => document.getElementById(`bubble-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
        />

        {/* Message stream */}
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto pb-4 pr-1 sm:pr-2">
          {bubbles.length === 0 && !sending && (
            <div className="mx-auto mt-8 max-w-md text-center">
              <div className={cn("text-[10px] font-mono uppercase tracking-[0.3em]", e.colorClass)}>{e.name} is present.</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Open the conversation.</h2>
              <p className="mt-2 text-sm text-muted-foreground">"{e.question}"</p>
            </div>
          )}

          {filteredBubbles.map((b, i) => {
            const isLastAssistant =
              b.role === "assistant" && i === filteredBubbles.length - 1 && !sending;
            const isEditingThis = editingIdx === bubbles.indexOf(b);
            return (
              <div id={`bubble-${b.id}`} key={b.id} className="group">
                {isEditingThis ? (
                  <div className="flex justify-end">
                    <div className="w-full max-w-[85%] rounded-2xl border border-primary/40 bg-primary/5 p-3 md:max-w-[72%]">
                      <textarea
                        value={editText}
                        onChange={(ev) => setEditText(ev.target.value)}
                        rows={3}
                        className="w-full resize-none rounded bg-transparent text-sm focus:outline-none"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setEditingIdx(null)}
                          className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                        >
                          Save & resend
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <MessageBubble
                      bubble={b}
                      streaming={false}
                      onCopy={() => toast.success("Copied")}
                      onRegenerate={isLastAssistant ? regenerate : undefined}
                      showRegenerate={isLastAssistant}
                      onPin={() => togglePin(b.id)}
                    />
                    {b.role === "user" && !sending && (
                      <button
                        onClick={() => startEdit(bubbles.indexOf(b))}
                        className="absolute right-1 top-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-surface hover:text-foreground group-hover:opacity-100"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {b.role === "assistant" && b.executive === "katana" && detectsApproval(b.content, "katana") && (
                      <div className="mt-2 sm:ml-[3.25rem]">
                        <ExecutionApprovalCard
                          onApprove={() => toast.success("Marked approved — execution will engage in a future release.")}
                          onModify={() => { setInput("Please modify the plan: "); inputRef.current?.focus(); }}
                          onAsk={() => { setInput("Question about this plan: "); inputRef.current?.focus(); }}
                          onCancel={() => toast.message("Plan cancelled")}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {liveAssistantBubble && (
            <MessageBubble bubble={liveAssistantBubble} streaming />
          )}

          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="mt-auto border-t border-border/50 pt-3">
          <div className="rounded-2xl border border-border/60 bg-surface/40 p-2 shadow-lg backdrop-blur">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && !ev.shiftKey) {
                  ev.preventDefault();
                  send(input);
                }
              }}
              placeholder={`Message ${e.name} — Enter to send · Shift+Enter for new line`}
              rows={2}
              disabled={sending}
              className="w-full resize-none bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                {e.name} · {status.replace(/_/g, " ")}
              </div>
              <button
                onClick={() => send(input)}
                disabled={sending || !input.trim()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition disabled:opacity-40",
                  e.accentClass,
                )}
              >
                <Send className="h-3.5 w-3.5" /> Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </MosShell>
  );
}
