// ExecutionApprovalCard — professional approval affordance beneath a KATANA
// execution proposal. No action executes automatically; every path is an
// explicit Operator choice, matching MOS execution doctrine.
import { CheckCircle2, PencilLine, HelpCircle, XCircle } from "lucide-react";

interface Props {
  onApprove?: () => void;
  onModify?: () => void;
  onAsk?: () => void;
  onCancel?: () => void;
  title?: string;
  summary?: string;
}

export function ExecutionApprovalCard({
  onApprove,
  onModify,
  onAsk,
  onCancel,
  title = "Execution proposed",
  summary = "KATANA has drafted an execution plan. Nothing runs until you approve.",
}: Props) {
  return (
    <div className="mt-3 animate-fade-in overflow-hidden rounded-xl border border-katana/30 bg-katana/[0.06] shadow-sm">
      <div className="border-b border-katana/20 bg-katana/[0.08] px-4 py-2">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-katana">Approval Required</div>
        <div className="mt-0.5 text-sm font-medium text-foreground">{title}</div>
      </div>
      <div className="px-4 py-3 text-xs text-muted-foreground">{summary}</div>
      <div className="flex flex-wrap gap-2 border-t border-katana/20 bg-black/20 px-3 py-2">
        <button
          onClick={onApprove}
          className="inline-flex items-center gap-1.5 rounded-md bg-katana px-3 py-1.5 text-xs font-medium text-katana-foreground hover:opacity-90"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          onClick={onModify}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface/80"
        >
          <PencilLine className="h-3.5 w-3.5" /> Modify Plan
        </button>
        <button
          onClick={onAsk}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface/80"
        >
          <HelpCircle className="h-3.5 w-3.5" /> Ask Questions
        </button>
        <button
          onClick={onCancel}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
        >
          <XCircle className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}
