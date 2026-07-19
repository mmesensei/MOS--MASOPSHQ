// PinnedPanel — collapsible strip above the conversation showing pinned
// messages so critical guidance stays one click away.
import { useState } from "react";
import { ChevronDown, Pin, X } from "lucide-react";
import { EXECUTIVES } from "@/lib/executives";
import { cn } from "@/lib/utils";
import type { BubbleData } from "./message-bubble";

interface Props {
  pinned: BubbleData[];
  onUnpin?: (id: string) => void;
  onJump?: (id: string) => void;
}

export function PinnedPanel({ pinned, onUnpin, onJump }: Props) {
  const [open, setOpen] = useState(true);
  if (pinned.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-border/60 bg-surface/40">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
      >
        <Pin className="h-3 w-3" />
        Pinned · {pinned.length}
        <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="divide-y divide-border/50 border-t border-border/50">
          {pinned.map((b) => {
            const exec = b.executive ? EXECUTIVES[b.executive] : null;
            return (
              <div key={b.id} className="flex items-start gap-2 px-3 py-2">
                <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", exec ? { iris: "bg-iris", apex: "bg-apex", katana: "bg-katana", sentinel: "bg-sentinel" }[exec.id] : "bg-primary")} />
                <button
                  onClick={() => onJump?.(b.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{exec?.name ?? "Operator"}</div>
                  <div className="line-clamp-2 text-xs text-foreground/90">{b.content}</div>
                </button>
                {onUnpin && (
                  <button
                    onClick={() => onUnpin(b.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                    title="Unpin"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
