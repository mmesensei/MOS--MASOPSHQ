// StatusIndicator — small live status pill shown on bubbles and executive rows.
// Design note: architected so any future voice or automation layer can
// broadcast the same status vocabulary through the shared bubble contract.
import { cn } from "@/lib/utils";

export type BubbleStatus =
  | "available"
  | "thinking"
  | "researching"
  | "reviewing"
  | "planning"
  | "executing"
  | "waiting_approval"
  | "completed"
  | "paused"
  | "sentinel_blocked";

const LABEL: Record<BubbleStatus, string> = {
  available: "Available",
  thinking: "Thinking",
  researching: "Researching",
  reviewing: "Reviewing",
  planning: "Planning",
  executing: "Executing",
  waiting_approval: "Waiting for Approval",
  completed: "Completed",
  paused: "Paused",
  sentinel_blocked: "SENTINEL Blocked",
};

const TONE: Record<BubbleStatus, string> = {
  available: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  thinking: "bg-primary/15 text-primary border-primary/30 animate-pulse",
  researching: "bg-apex/15 text-apex border-apex/30 animate-pulse",
  reviewing: "bg-sentinel/15 text-sentinel border-sentinel/30",
  planning: "bg-iris/15 text-iris border-iris/30 animate-pulse",
  executing: "bg-katana/15 text-katana border-katana/30 animate-pulse",
  waiting_approval: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  paused: "bg-muted text-muted-foreground border-border",
  sentinel_blocked: "bg-destructive/20 text-destructive border-destructive/30",
};

export function StatusIndicator({ status, className }: { status: BubbleStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest",
        TONE[status],
        className,
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current" />
      {LABEL[status]}
    </span>
  );
}
