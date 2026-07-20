import { createFileRoute, Link } from "@tanstack/react-router";
import { EXECUTIVE_LIST } from "@/lib/executives";
import { ExecutiveAvatar, type AvatarState } from "@/components/executive-avatar";
import { ArrowRight } from "lucide-react";
import heroAsset from "@/assets/masops-team.png.asset.json";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "MOS — Mastermind Operations System" },
      {
        name: "description",
        content:
          "MOS is a private Executive Headquarters. Four permanent executives — IRIS, APEX, KATANA, SENTINEL — run strategy, systems, execution, and protection for the Operator.",
      },
      { property: "og:title", content: "MOS — Executive Headquarters" },
      {
        property: "og:description",
        content:
          "One mission. One system. Unlimited impact. Enter your permanent executive leadership team.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

const AVATAR_STATES: Record<string, AvatarState> = {
  iris: "listening",
  apex: "thinking",
  katana: "reviewing",
  sentinel: "reviewing",
};

function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient headquarters lighting */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-iris/10 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] bg-gradient-to-t from-sentinel/10 via-transparent to-transparent" />

      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-iris via-apex to-sentinel" />
          <span className="font-display text-lg font-semibold tracking-tight">MOS</span>
          <span className="ml-2 hidden text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground sm:inline">
            Mastermind Operations System
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Enter HQ <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      <section className="relative mx-auto max-w-5xl px-6 pt-16 pb-10 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs font-mono uppercase tracking-[0.25em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-sentinel status-live" /> Executive Council online · Sentinel monitoring active
        </div>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          The Executive Operating System for{" "}
          <span className="bg-gradient-to-r from-iris via-primary to-apex bg-clip-text text-transparent">
            the mission you're actually running.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          MOS is not software. It is a private executive headquarters — four permanent leaders operating together on your
          strategy, systems, execution, and protection. You are the Operator. They are already on shift.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Take command <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-muted-foreground">
            One mission · One system · Unlimited impact
          </div>
        </div>
      </section>

      {/* Council portrait */}
      <section className="relative mx-auto max-w-6xl px-6 pb-6">
        <div className="hq-panel relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
          <img
            src={heroAsset.url}
            alt="The MASOPS executive council — IRIS, APEX, KATANA, and SENTINEL standing in the headquarters."
            className="relative w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-background/60 px-5 py-3 backdrop-blur">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
              The Executive Council · standing by
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.25em]">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-iris status-live" /> IRIS</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-apex status-live" /> APEX</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-katana status-live" /> KATANA</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sentinel status-live" /> SENTINEL</span>
            </div>
          </div>
        </div>
      </section>

      {/* Executive presence cards */}
      <section className="relative mx-auto grid max-w-6xl gap-4 px-6 pt-10 pb-24 md:grid-cols-2 lg:grid-cols-4">
        {EXECUTIVE_LIST.map((e) => (
          <div key={e.id} className="hq-panel p-6 transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
              <ExecutiveAvatar executive={e.id} state={AVATAR_STATES[e.id]} mode="portrait" portraitSize="chip" />
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
                On duty
              </div>
            </div>
            <div className={`mt-5 font-mono text-[10px] uppercase tracking-[0.3em] ${e.colorClass}`}>
              {e.signature}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">{e.name}</div>
            <div className="text-sm text-muted-foreground">{e.title}</div>
            <p className="mt-4 text-sm italic text-muted-foreground">"{e.question}"</p>
          </div>
        ))}
      </section>

      <footer className="relative border-t border-border py-8 text-center text-xs text-muted-foreground">
        MOS · MASOPS Foundation · The Operator has final authority.
      </footer>
    </main>
  );
}
