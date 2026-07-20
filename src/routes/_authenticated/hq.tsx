import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { MosShell } from "@/components/mos-shell";
import { EXECUTIVE_LIST } from "@/lib/executives";
import { ExecutiveAvatar } from "@/components/executive-avatar";
import { getProfile, listCouncilSessions } from "@/lib/mos.functions";
import { listMissionsV2, listJournal, seedSopsIfEmpty } from "@/lib/mos-v2.functions";
import { ExecutiveBriefingFeed, useAwarenessScan } from "@/components/executive-briefing";
import { Boardroom } from "@/components/boardroom";
import { BoardroomVoiceConsole } from "@/components/boardroom-voice-console";
import { SectionBoundary } from "@/components/section-boundary";
import { TranscriptPanel } from "@/components/transcript-panel";
import { FoundingVipBanner } from "@/components/founding-vip-banner";
import { ExecChamber } from "@/components/exec-chamber";
import { ArrowRight, Users, Target, Sparkles, BookOpen, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/hq")({
  component: HQ,
});

function HQ() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const missions = useQuery({ queryKey: ["missions"], queryFn: () => listMissionsV2() });
  const councils = useQuery({ queryKey: ["councils"], queryFn: () => listCouncilSessions() });
  const journal = useQuery({ queryKey: ["journal"], queryFn: () => listJournal({ data: { limit: 8 } }) });

  useEffect(() => { seedSopsIfEmpty().catch(() => void 0); }, []);
  useAwarenessScan("hq_load", "/hq");

  const name = profile.data?.display_name || "Operator";
  const activeMissions = (missions.data ?? []).filter(
    (m) => !["completed", "archived", "held"].includes(m.stage),
  );

  // Current objective: most recent active mission title, else neutral
  const currentObjective = activeMissions[0]?.title ?? null;

  // Session date — computed once on mount, stable for the session
  const sessionDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  return (
    <MosShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <FoundingVipBanner />

        {/* ── Command Header ──────────────────────────────────────────────── */}
        <header className="mb-10" aria-label="Executive Headquarters command header">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Left: greeting + status */}
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-status-success motion-safe:status-live"
                  aria-hidden="true"
                />
                Executive Headquarters · System Operational
              </div>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
                Welcome back, <span className="text-gold">{name}</span>.
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                The Council is standing by. Charter a mission, convene for a decision, or step into any
                executive's office.
              </p>
            </div>

            {/* Right: session date + MASOPS identifier */}
            <div className="hidden sm:flex flex-col items-end gap-1 text-right">
              <div className="text-sm font-medium text-foreground/60">{sessionDate}</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
                MASOPS · Session Active
              </div>
              <div className="mt-2 flex items-center gap-1.5 justify-end">
                <Shield className="h-3 w-3 text-sentinel/70" aria-hidden="true" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  SENTINEL Monitoring
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Living Boardroom — R3F stage reacting to presence bus ───────── */}
        <SectionBoundary label="Executive Boardroom">
          <section className="mb-4" aria-label="Executive Boardroom">
            <Boardroom />
          </section>
          <section className="mb-10 grid gap-4 md:grid-cols-2" aria-label="Boardroom controls">
            <BoardroomVoiceConsole />
            <TranscriptPanel />
          </section>
        </SectionBoundary>

        {/* ── Executive Command Area ──────────────────────────────────────── */}
        <section aria-label="Executive Command">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
                Command · {EXECUTIVE_LIST.length} Executives Active
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                Executive Council
              </h2>
            </div>
            <Link
              to="/council"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring"
            >
              Convene Council <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          {/* Four executive chambers — 4 col desktop · 2×2 tablet · 1 col mobile */}
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            role="list"
            aria-label="Executive chambers"
          >
            {EXECUTIVE_LIST.map((e) => (
              <div key={e.id} role="listitem">
                <ExecChamber executive={e} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Mission Strip ───────────────────────────────────────────────── */}
        <section className="mt-8 mb-10" aria-label="Mission status">
          <div className="hq-panel flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
            {/* Active mission count */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
                Active Missions
              </div>
              <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums">
                {missions.isLoading ? "—" : activeMissions.length}
              </div>
            </div>

            <div className="hidden h-8 w-px bg-border/60 sm:block" aria-hidden="true" />

            {/* Current objective */}
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
                Current Objective
              </div>
              <div className="mt-0.5 truncate text-sm text-foreground/80">
                {missions.isLoading
                  ? "Loading…"
                  : currentObjective ?? "Awaiting briefing"}
              </div>
            </div>

            <div className="hidden h-8 w-px bg-border/60 sm:block" aria-hidden="true" />

            {/* System readiness */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="h-2 w-2 rounded-full bg-status-success motion-safe:status-live"
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">All systems operational</span>
            </div>

            {/* Actions */}
            <div className="ml-auto flex flex-wrap gap-2 shrink-0">
              <Link
                to="/missions/new"
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/25 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                New mission
              </Link>
              <Link
                to="/missions"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                All missions
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Quick Actions ───────────────────────────────────────────────── */}
        <section className="mb-10 grid gap-4 md:grid-cols-3" aria-label="Quick actions">
          <Link
            to="/missions/new"
            className="hq-panel p-5 transition motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.25em] text-gold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> New Mission
            </div>
            <div className="mt-3 font-display text-lg font-semibold">Charter with the Council</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Walk through IRIS → APEX → KATANA → SENTINEL.
            </p>
          </Link>
          <Link
            to="/council"
            className="hq-panel p-5 transition motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.25em] text-iris">
              <Users className="h-3.5 w-3.5" aria-hidden="true" /> Council Room
            </div>
            <div className="mt-3 font-display text-lg font-semibold">Convene for a decision</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {councils.data?.length ?? 0} previous session
              {(councils.data?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </Link>
          <Link
            to="/missions"
            className="hq-panel p-5 transition motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.25em] text-katana">
              <Target className="h-3.5 w-3.5" aria-hidden="true" /> Active Missions
            </div>
            <div className="mt-3 font-display text-lg font-semibold">
              {activeMissions.length} in flight
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Track lifecycle, log activity, capture lessons.
            </p>
          </Link>
        </section>

        {/* ── Executive Briefing Feed ─────────────────────────────────────── */}
        <ExecutiveBriefingFeed />

        {/* ── Growth Journal ──────────────────────────────────────────────── */}
        <section className="mb-10" aria-label="Growth journal">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
                Growth Journal
              </div>
              <h2 className="mt-1 font-display text-xl font-semibold">
                What your executives have learned
              </h2>
            </div>
            <Link
              to="/sops"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" /> Library
            </Link>
          </div>

          {journal.data && journal.data.length > 0 ? (
            <div className="hq-panel divide-y divide-border/50 p-2">
              {journal.data.map((j) => {
                const colorMap: Record<string, string> = {
                  iris: "text-iris",
                  apex: "text-apex",
                  katana: "text-katana",
                  sentinel: "text-sentinel",
                };
                return (
                  <div key={j.id} className="flex items-start gap-3 p-3">
                    <ExecutiveAvatar
                      executive={j.executive as never}
                      state="idle"
                      mode="portrait"
                      portraitSize="chip"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono uppercase tracking-widest ${colorMap[j.executive]}`}
                        >
                          {j.executive}
                        </span>
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                          {j.kind}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-foreground/90">{j.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="hq-panel p-6 text-center text-sm text-muted-foreground">
              The executives haven't written any journal entries yet. They'll start learning as you
              interact with them.
            </div>
          )}
        </section>

        <footer className="mt-16 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          MOS Kernel · Executive Charter enforced · SENTINEL monitoring active
        </footer>
      </div>
    </MosShell>
  );
}
