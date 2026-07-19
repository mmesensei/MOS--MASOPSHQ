// Transcript panel — a scrollable log of every executive bubble in this
// session. Auto-scrolls to the newest entry; filterable per exec; clearable.
import { useEffect, useMemo, useRef, useState } from "react";
import { EXECUTIVE_LIST, type ExecutiveId } from "@/lib/executives";
import { clearTranscript, useTranscript } from "@/lib/message-bus";
import { Trash2 } from "lucide-react";

const EXEC_COLORS: Record<ExecutiveId, string> = {
  iris: "#8b5cf6",
  apex: "#22d3ee",
  katana: "#ef4444",
  sentinel: "#10b981",
};

type Filter = "all" | ExecutiveId;

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function TranscriptPanel() {
  const entries = useTranscript();
  const [filter, setFilter] = useState<Filter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.executive === filter)),
    [entries, filter],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length]);

  return (
    <div className="flex h-[360px] flex-col rounded-md border border-border/40 bg-black/30">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/70">
          Transcript
        </span>
        <span className="text-[10px] uppercase tracking-widest text-white/40">
          {filtered.length}/{entries.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${
              filter === "all" ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/5"
            }`}
          >
            All
          </button>
          {EXECUTIVE_LIST.map((e) => (
            <button
              key={e.id}
              onClick={() => setFilter(e.id)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest ${
                filter === e.id ? "bg-white/15" : "hover:bg-white/5"
              }`}
              style={{ color: EXEC_COLORS[e.id] }}
            >
              {e.name}
            </button>
          ))}
          <button
            onClick={clearTranscript}
            aria-label="Clear transcript"
            className="ml-1 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white/80"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-widest text-white/30">
            No messages yet
          </div>
        ) : (
          filtered.map((entry) => {
            const color = EXEC_COLORS[entry.executive];
            const exec = EXECUTIVE_LIST.find((e) => e.id === entry.executive);
            return (
              <div
                key={entry.id}
                className="rounded border border-white/5 bg-white/[0.02] px-2.5 py-1.5"
                style={{ borderLeft: `2px solid ${color}` }}
              >
                <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-[0.25em]">
                  <span style={{ color }}>{exec?.name ?? entry.executive}</span>
                  <span className="text-white/30">{formatTime(entry.at)}</span>
                </div>
                <div className="whitespace-pre-wrap break-words text-[11px] leading-snug text-white/85">
                  {entry.text}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
