// MessageBubble — the atomic unit of the MOS conversation.
// Renders a chat bubble with executive identity, timestamp, status,
// copy + regenerate actions, and collapsible detail sections.
// Architecture note: designed so a future voice layer can create/read the
// same bubble records without changing this component's contract.
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, RotateCcw, ChevronDown, Check, Pin, PinOff } from "lucide-react";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { ExecutivePresence } from "@/components/executive-presence";
import { cn } from "@/lib/utils";
import { StatusIndicator, type BubbleStatus } from "./status-indicator";

export interface CollapsibleSection {
  label: "Reasoning" | "Execution Plan" | "Knowledge Used" | "References" | "Risk Assessment" | "Next Steps";
  content: string;
}

export interface BubbleData {
  id: string;
  role: "user" | "assistant";
  executive?: ExecutiveId; // required for assistant
  content: string;
  createdAt: number;
  status?: BubbleStatus;
  sections?: CollapsibleSection[];
  pinned?: boolean;
}

interface Props {
  bubble: BubbleData;
  operatorName?: string;
  streaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onPin?: () => void;
  showRegenerate?: boolean;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function BorderClass(exec?: ExecutiveId): string {
  if (!exec) return "";
  return {
    iris: "border-iris/30",
    apex: "border-apex/30",
    katana: "border-katana/30",
    sentinel: "border-sentinel/30",
  }[exec];
}

function TintClass(exec?: ExecutiveId): string {
  if (!exec) return "";
  return {
    iris: "bg-iris/[0.04]",
    apex: "bg-apex/[0.04]",
    katana: "bg-katana/[0.04]",
    sentinel: "bg-sentinel/[0.04]",
  }[exec];
}

export function MessageBubble({
  bubble,
  operatorName = "Operator",
  streaming,
  onCopy,
  onRegenerate,
  onPin,
  showRegenerate,
}: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = bubble.role === "user";
  const exec = bubble.executive ? EXECUTIVES[bubble.executive] : null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bubble.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      onCopy?.();
    } catch { /* ignore */ }
  }

  if (isUser) {
    return (
      <div className="flex animate-fade-in justify-end">
        <div className="max-w-[85%] md:max-w-[72%]">
          <div className="mb-1 flex items-center justify-end gap-2 pr-1 text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            <span>{operatorName}</span>
            <span className="opacity-60">{formatTime(bubble.createdAt)}</span>
          </div>
          <div className="rounded-2xl rounded-tr-md bg-primary/90 px-4 py-3 text-sm text-primary-foreground shadow-lg shadow-primary/10">
            <div className="whitespace-pre-wrap leading-relaxed">{bubble.content}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in gap-3">
      {/* Avatar */}
      <div className="mt-1 hidden shrink-0 sm:block">
        <div className={cn("h-10 w-10 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-background", exec && `ring-${exec.id}/40`)}>
          <ExecutivePresence
            executive={bubble.executive!}
            state={streaming ? "speaking" : "listening"}
            size="chip"
            className="!h-10 !w-10"
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {/* Header row */}
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono uppercase tracking-[0.25em]">
          <span className={cn("font-semibold", exec?.colorClass)}>{exec?.name}</span>
          <span className="text-muted-foreground/70 normal-case tracking-normal text-[11px]">{exec?.title}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground/70">{formatTime(bubble.createdAt)}</span>
          {bubble.status && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <StatusIndicator status={bubble.status} />
            </>
          )}
        </div>

        {/* Bubble body */}
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm backdrop-blur-sm",
            BorderClass(bubble.executive),
            TintClass(bubble.executive),
          )}
        >
          {bubble.content ? (
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1.5 prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-black/40 prose-pre:border prose-pre:border-border/60 prose-a:text-primary">
              <ReactMarkdown>{bubble.content}</ReactMarkdown>
            </div>
          ) : (
            <TypingDots exec={bubble.executive} />
          )}

          {/* Collapsible sections */}
          {bubble.sections && bubble.sections.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
              {bubble.sections.map((s, i) => (
                <CollapsibleRow key={i} label={s.label} content={s.content} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {bubble.content && !streaming && (
          <div className="mt-1.5 flex items-center gap-1 pl-1 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100 focus-within:opacity-100 sm:opacity-60">
            <ActionButton onClick={handleCopy} label={copied ? "Copied" : "Copy"}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </ActionButton>
            {showRegenerate && onRegenerate && (
              <ActionButton onClick={onRegenerate} label="Regenerate">
                <RotateCcw className="h-3 w-3" />
              </ActionButton>
            )}
            {onPin && (
              <ActionButton onClick={onPin} label={bubble.pinned ? "Unpin" : "Pin"}>
                {bubble.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </ActionButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function CollapsibleRow({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        {label}
      </button>
      {open && (
        <div className="mt-1 animate-fade-in rounded-md bg-black/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function TypingDots({ exec }: { exec?: ExecutiveId }) {
  const color = exec ? { iris: "bg-iris", apex: "bg-apex", katana: "bg-katana", sentinel: "bg-sentinel" }[exec] : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className={cn("h-1.5 w-1.5 animate-pulse rounded-full", color)}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
