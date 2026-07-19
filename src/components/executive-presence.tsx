// The Executive Presence — a real portrait, alive and watching.
//
// v2 portraits (more realistic JPGs) + full 3D interactive animation:
//   • Card-level CSS perspective tilt tracks the cursor in real time
//   • Image layer translates independently (parallax depth effect)
//   • Slow idle scan when the cursor is far away
//   • Breathing, nodding, blinking, speaking overlays
//   • All heavy motion behind motion-safe via class gating

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ExecutiveId } from "@/lib/executives";

// Portrait-v2 JPGs — more realistic, cinematic look
import irisAsset from "@/assets/exec-iris-portrait-v2.jpg.asset.json";
import apexAsset from "@/assets/exec-apex-portrait-v2.jpg.asset.json";
import katanaAsset from "@/assets/exec-katana-portrait-v2.jpg.asset.json";
import sentinelAsset from "@/assets/exec-sentinel-portrait-v2.jpg.asset.json";

const PORTRAIT: Record<ExecutiveId, string> = {
  iris:     irisAsset.url,
  apex:     apexAsset.url,
  katana:   katanaAsset.url,
  sentinel: sentinelAsset.url,
};

const GLOW: Record<ExecutiveId, string> = {
  iris:     "exec-glow-iris",
  apex:     "exec-glow-apex",
  katana:   "exec-glow-katana",
  sentinel: "exec-glow-sentinel",
};

const RING: Record<ExecutiveId, string> = {
  iris:     "ring-iris/40",
  apex:     "ring-apex/40",
  katana:   "ring-katana/40",
  sentinel: "ring-sentinel/40",
};

export type PresenceState = "idle" | "listening" | "thinking" | "speaking" | "reviewing";

interface Props {
  executive: ExecutiveId;
  state?: PresenceState;
  className?: string;
  size?: "full" | "bust" | "chip";
}

/** Max 3D tilt in degrees — feels holographic without being nauseating */
const MAX_TILT = 10;
/** Max parallax shift on the image layer in px */
const MAX_SHIFT_IMG = 14;

export function ExecutivePresence({ executive, state = "idle", className, size = "full" }: Props) {
  const src = PORTRAIT[executive];
  const active = state !== "idle";
  const speaking = state === "speaking";
  const isSentinel = executive === "sentinel";
  const isChip = size === "chip";

  const dims =
    size === "full"
      ? "aspect-[7/12] w-full max-w-[420px]"
      : size === "bust"
        ? "aspect-square w-full max-w-[220px]"
        : "h-16 w-16";

  const accent: Record<ExecutiveId, string> = {
    iris: "bg-iris", apex: "bg-apex", katana: "bg-katana", sentinel: "bg-sentinel",
  };
  const accentGlow: Record<ExecutiveId, string> = {
    iris:     "shadow-[0_0_12px_2px_hsl(var(--iris)/0.9)]",
    apex:     "shadow-[0_0_12px_2px_hsl(var(--apex)/0.9)]",
    katana:   "shadow-[0_0_12px_2px_hsl(var(--katana)/0.9)]",
    sentinel: "shadow-[0_0_16px_3px_hsl(var(--sentinel)/0.9)]",
  };

  // ── Refs ────────────────────────────────────────────────────────────────
  const cardRef  = useRef<HTMLDivElement | null>(null);
  const imgRef   = useRef<HTMLImageElement | null>(null);
  const rafRef   = useRef<number | null>(null);
  const [hovering, setHovering] = useState(false);

  // Current interpolated values (not state — no re-renders)
  const cur = useRef({ tiltX: 0, tiltY: 0, px: 0, py: 0 });
  const tgt = useRef({ tiltX: 0, tiltY: 0, px: 0, py: 0 });

  // ── 3D perspective + parallax via rAF ────────────────────────────────────
  useEffect(() => {
    if (isChip) return;
    const card = cardRef.current;
    const img  = imgRef.current;
    if (!card || !img) return;

    // Prefer reduced motion: skip tilt, keep only subtle translate
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tiltScale = noMotion ? 0 : 1;
    const imgScale  = noMotion ? 3 : MAX_SHIFT_IMG;

    const tick = () => {
      rafRef.current = null;
      const c = cur.current;
      const t = tgt.current;
      const ease = 0.1;
      c.tiltX += (t.tiltX - c.tiltX) * ease;
      c.tiltY += (t.tiltY - c.tiltY) * ease;
      c.px    += (t.px - c.px) * ease;
      c.py    += (t.py - c.py) * ease;

      // Card 3D tilt
      card.style.transform = `perspective(900px) rotateX(${(c.tiltX * tiltScale).toFixed(2)}deg) rotateY(${(c.tiltY * tiltScale).toFixed(2)}deg)`;
      // Image moves in opposite direction for depth illusion
      img.style.transform  = `translate3d(${(c.px * imgScale / MAX_SHIFT_IMG).toFixed(2)}px, ${(c.py * imgScale / MAX_SHIFT_IMG).toFixed(2)}px, 0) scale(1.04)`;

      const moving =
        Math.abs(t.tiltX - c.tiltX) > 0.01 ||
        Math.abs(t.tiltY - c.tiltY) > 0.01 ||
        Math.abs(t.px - c.px) > 0.05 ||
        Math.abs(t.py - c.py) > 0.05;
      if (moving) rafRef.current = requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      // Normalize -1 … +1 relative to card center
      const nx = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
      const ny = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
      tgt.current.tiltY =  nx * MAX_TILT;   // left→right  = rotateY
      tgt.current.tiltX = -ny * MAX_TILT;   // up→down     = rotateX (inverted)
      tgt.current.px    = -nx;              // image shifts opposite
      tgt.current.py    = -ny;
      schedule();
    };

    const onLeave = () => {
      tgt.current = { tiltX: 0, tiltY: 0, px: 0, py: 0 };
      schedule();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    card.addEventListener("mouseleave", onLeave, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      card.removeEventListener("mouseleave", onLeave);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      // Reset transforms on unmount
      card.style.transform = "";
      img.style.transform  = "";
    };
  }, [isChip]);

  // ── Reactive pulse on state change ───────────────────────────────────────
  const [pulse, setPulse] = useState<null | "nod" | "react">(null);
  const prevState = useRef<PresenceState>(state);
  useEffect(() => {
    if (prevState.current === state) return;
    if (state === "speaking") setPulse("nod");
    else if (state === "thinking" || state === "reviewing") setPulse("react");
    prevState.current = state;
    if (pulse) {
      const t = setTimeout(() => setPulse(null), 900);
      return () => clearTimeout(t);
    }
  }, [state, pulse]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative overflow-hidden rounded-2xl ring-1",
        RING[executive],
        active && GLOW[executive],
        "bg-gradient-to-b from-transparent to-background/60",
        dims,
        // Subtle idle float on the whole card
        !isChip && "presence-float",
        className,
      )}
      style={{ willChange: "transform", transformStyle: "preserve-3d" }}
      aria-label={`${executive.toUpperCase()} — ${state}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Portrait with idle scan + reactive animations */}
      <div
        className={cn(
          "absolute inset-0 will-change-transform",
          !isChip && "presence-idle-scan",
          pulse === "nod"   && "presence-nod",
          pulse === "react" && "presence-react",
        )}
      >
        <img
          ref={imgRef}
          src={src}
          alt={executive.toUpperCase()}
          loading="lazy"
          draggable={false}
          className={cn(
            "h-full w-full select-none object-cover object-top",
            "presence-breath",
            state === "thinking" && "presence-tilt",
            speaking && "presence-speak",
          )}
          // transform set dynamically by rAF; scale(1.04) ensures no gap at edges during tilt
          style={{ transform: "scale(1.04)" }}
        />

        {/* Blink veil */}
        {!isChip && (
          <div
            className="pointer-events-none absolute inset-x-[8%] top-[28%] h-[8%] rounded-[40%] bg-background/70 blur-[2px] presence-blink"
            aria-hidden
          />
        )}
      </div>

      {/* Speaking signal */}
      {speaking && !isChip && (
        <>
          {isSentinel ? (
            <div className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2" aria-hidden>
              <div className="flex items-center gap-3">
                <span className={cn("h-2 w-3 rounded-full", accent.sentinel, accentGlow.sentinel, "mask-glow")} />
                <span className={cn("h-2 w-3 rounded-full", accent.sentinel, accentGlow.sentinel, "mask-glow")} style={{ animationDelay: "0.15s" }} />
              </div>
            </div>
          ) : (
            <div className="pointer-events-none absolute left-1/2 top-[34%] flex -translate-x-1/2 items-end gap-[3px]" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn("w-[3px] rounded-full voice-bar", accent[executive], accentGlow[executive], size === "bust" ? "h-3" : "h-4")}
                  style={{ animationDelay: `${i * 0.09}s` }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Hover tint */}
      {hovering && !isChip && (
        <div
          className={cn("pointer-events-none absolute inset-0 opacity-30 mix-blend-soft-light transition-opacity", accent[executive])}
          aria-hidden
        />
      )}

      {/* Edge highlight that appears on hover — adds 3D depth feel */}
      {hovering && !isChip && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
          aria-hidden
        />
      )}

      {/* Bottom vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />

      {/* Status pip */}
      {!isChip && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 backdrop-blur-sm">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              state === "idle"      && "bg-muted-foreground/60",
              state === "listening" && "bg-sentinel status-live",
              state === "thinking"  && "bg-primary status-live",
              speaking              && "bg-primary status-live",
              state === "reviewing" && "bg-apex status-live",
            )}
          />
          <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            {state}
          </span>
        </div>
      )}
    </div>
  );
}
