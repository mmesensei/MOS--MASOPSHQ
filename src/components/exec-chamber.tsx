/**
 * ExecChamber — canonical executive panel for the HQ command grid.
 *
 * One chamber per executive. Self-contained: reads live presence via hook,
 * derives all identity from the shared EXECUTIVES registry, renders the
 * canonical ExecSymbol and ExecutivePresence portrait.
 *
 * Rules:
 *   - Never duplicates executive identity data
 *   - Routes only to valid existing office routes
 *   - Graceful on missing data (neutral state, no crash)
 *   - Respects prefers-reduced-motion via motion-safe: variants
 */

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { Executive, ExecutiveId } from "@/lib/executives";
import { ExecSymbol } from "@/components/exec-symbol";
import { ExecutivePresence, type PresenceState } from "@/components/executive-presence";
import { useExecPresence } from "@/lib/presence-bus";
import { useT } from "@/lib/i18n";

// Canonical default presence per executive (set during design review)
const PRESENCE_DEFAULT: Record<ExecutiveId, PresenceState> = {
  iris: "listening",
  apex: "listening",
  katana: "listening",
  sentinel: "reviewing",
};

// Canonical primary action per executive — only valid existing routes
// Labels are i18n keys; English fallbacks here
const EXEC_ACTION: Record<ExecutiveId, { labelKey: string; labelEn: string; path: string }> = {
  iris:     { labelKey: "exec_action_iris",     labelEn: "View Strategy",    path: "/office/iris" },
  apex:     { labelKey: "exec_action_apex",     labelEn: "Open Systems",     path: "/office/apex" },
  katana:   { labelKey: "exec_action_katana",   labelEn: "View Operations",  path: "/office/katana" },
  sentinel: { labelKey: "exec_action_sentinel", labelEn: "Open Security",    path: "/office/sentinel" },
};

// Static Tailwind class maps — must be literal strings for purge to include them
const BG_CLASS: Record<ExecutiveId, string> = {
  iris:     "bg-iris",
  apex:     "bg-apex",
  katana:   "bg-katana",
  sentinel: "bg-sentinel",
};

const BORDER_CLASS: Record<ExecutiveId, string> = {
  iris:     "border-iris/30",
  apex:     "border-apex/30",
  katana:   "border-katana/30",
  sentinel: "border-sentinel/30",
};

interface ExecChamberProps {
  executive: Executive;
  /** Optional one-line operational focus. Neutral state if omitted. */
  summary?: string;
}

export function ExecChamber({ executive: e, summary }: ExecChamberProps) {
  const live = useExecPresence(e.id, PRESENCE_DEFAULT[e.id]);
  const action = EXEC_ACTION[e.id];
  const isActive = live !== "idle";
  const t = useT();

  return (
    <article
      className={`
        group relative flex flex-col overflow-hidden rounded-xl
        border border-border/60
        bg-gradient-to-b from-surface-raised to-surface
        transition-all duration-300
        motion-safe:hover:-translate-y-0.5
        focus-within:ring-1 focus-within:ring-ring/40
      `}
      style={{ borderTopColor: `var(--${e.id})`, borderTopWidth: "2px" }}
      aria-label={`${e.name} — ${e.title}`}
    >
      {/* Executive tint wash — visible only on hover */}
      <div
        className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 motion-safe:group-hover:opacity-100 ${e.bgTint}`}
        aria-hidden="true"
      />

      {/* ── Header: symbol · codename · live status ───────────────────── */}
      <div className="relative flex items-center gap-2 px-4 pt-4 pb-0">
        <span aria-hidden="true">
          <ExecSymbol
            executive={e.id}
            size={13}
            className={e.colorClass}
            strokeWidth={1.8}
          />
        </span>
        <span className={`text-[10px] font-mono font-semibold uppercase tracking-[0.3em] ${e.colorClass}`}>
          {e.name}
        </span>

        {/* Live status pip + label */}
        <div
          className="ml-auto flex items-center gap-1.5"
          role="status"
          aria-label={`${e.name} status: ${live}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive
                ? `${BG_CLASS[e.id]} motion-safe:status-live`
                : "bg-muted-foreground/40"
            }`}
            aria-hidden="true"
          />
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {live}
          </span>
        </div>
      </div>

      {/* ── Portrait — full animation system from ExecutivePresence ──────── */}
      <div className="relative mt-3 px-4">
        <ExecutivePresence executive={e.id} state={live} size="bust" />
      </div>

      {/* ── Identity block ─────────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col px-4 pt-3 pb-4">
        {/* Signature tagline */}
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
          {e.signature}
        </div>

        {/* Name + role */}
        <div className="mt-1 font-display text-xl font-semibold leading-none">
          {e.name}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{e.title}</div>

        {/* Signature question — the executive's defining inquiry */}
        <blockquote
          className={`mt-3 border-l-2 pl-3 text-[11px] italic leading-relaxed text-muted-foreground ${BORDER_CLASS[e.id]}`}
        >
          {e.question}
        </blockquote>

        {/* Operational summary — live data or canonical neutral */}
        {summary && (
          <div className="mt-2 rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
            {summary}
          </div>
        )}

        {/* ── Primary action ─────────────────────────────────────────── */}
        <Link
          // Pre-existing TanStack Router dynamic route type — works at runtime
          to={action.path as never}
          className={`mt-auto pt-4 inline-flex items-center justify-center gap-1.5 rounded-md border border-current/20 px-3 py-2 text-xs font-medium transition-all duration-200 hover:border-current/40 hover:bg-current/10 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${e.colorClass}`}
          aria-label={`${t(action.labelKey, action.labelEn)} — enter ${e.name}'s ${e.environment}`}
        >
          {t(action.labelKey, action.labelEn)}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
