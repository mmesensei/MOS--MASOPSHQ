import { KATANA_CATEGORIES } from "@/lib/katana.functions";
import { CheckCircle2, X, ArrowRight } from "lucide-react";

interface Opp {
  id: string;
  category: keyof typeof KATANA_CATEGORIES;
  title: string;
  rationale: string;
  estimated_value_band: string;
  effort_band: string;
  status: string;
}

export function OpportunityCard({
  opp,
  onAccept,
  onDismiss,
}: {
  opp: Opp;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const cat = KATANA_CATEGORIES[opp.category] ?? { label: opp.category, icon: "•" };
  const dismissed = opp.status === "dismissed";
  const accepted = opp.status === "accepted";
  return (
    <div
      className={`rounded-lg border border-border/60 bg-surface/60 p-4 transition ${
        dismissed ? "opacity-40" : "hover:border-katana/40"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-base">{cat.icon}</span>
        <span>{cat.label}</span>
        <span className="ml-auto rounded bg-katana/10 px-1.5 py-0.5 text-[10px] text-katana">
          Value {opp.estimated_value_band} · Effort {opp.effort_band}
        </span>
      </div>
      <div className="font-medium leading-snug">{opp.title}</div>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-3">{opp.rationale}</p>
      {!dismissed && !accepted && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAccept(opp.id)}
            className="inline-flex items-center gap-1 rounded-md bg-katana px-3 py-1.5 text-xs font-medium text-katana-foreground hover:opacity-90"
          >
            Accept <ArrowRight className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDismiss(opp.id)}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            <X className="h-3 w-3" /> Dismiss
          </button>
        </div>
      )}
      {accepted && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" /> Mission created
        </div>
      )}
    </div>
  );
}
