// Executive Avatar Framework — extension-point hooks.
//
// These are lightweight bridges between the running avatar and the rest of
// MOS (voice pipeline, presence bus, future gesture/motion systems). They
// stay intentionally thin — full features live in dedicated subsystems.
import { useEffect, useRef, useState } from "react";
import type { ExecutiveId } from "@/lib/executives";
import { useMouthAmp } from "@/lib/voice-bus";
import type { AvatarState, SpatialConfig } from "./types";
import { getAvatarConfig } from "./config";

/** Subscribe to real-time mouth amplitude for lip-sync. Returns 0..1. */
export function useLipSyncAmp(executive: ExecutiveId): number {
  return useMouthAmp(executive);
}

/** Placeholder — future: bind gesture triggers ("nod", "point"). */
export function useGestureBus(_executive: ExecutiveId) {
  return { trigger: (_name: string) => {} };
}

/**
 * Return the executive's canonical spatial slot for the shared HQ scene.
 * Placeholder scenes today; HQ implementation lands in a later phase.
 */
export function useSpatialSlot(executive: ExecutiveId): SpatialConfig | null {
  return getAvatarConfig(executive).spatial ?? null;
}

/**
 * Presence tick — drives subtle, always-on aliveness cues (breathing pace,
 * blink cadence, occasional micro-posture shift). Returns per-frame values
 * consumed by both the placeholder and future 3D rigs.
 *
 * Intentionally deterministic and cheap; runs off requestAnimationFrame so
 * offscreen tabs pause automatically.
 */
export interface PresenceTick {
  /** Breath phase 0..1. */
  breath: number;
  /** True on the frame a blink should fire. */
  blink: boolean;
  /** Micro-posture drift, ~-1..1. */
  drift: number;
}

export function usePresenceTick(active = true): PresenceTick {
  const [tick, setTick] = useState<PresenceTick>({ breath: 0, blink: false, drift: 0 });
  const raf = useRef<number | null>(null);
  const nextBlinkAt = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    const start = performance.now();
    nextBlinkAt.current = start + 2500 + Math.random() * 3500;

    const loop = (now: number) => {
      if (!mounted) return;
      const t = (now - start) / 1000;
      const breath = 0.5 + Math.sin(t * 1.4) * 0.5;
      const drift = Math.sin(t * 0.23) * 0.6 + Math.sin(t * 0.11) * 0.4;
      let blink = false;
      if (now >= nextBlinkAt.current) {
        blink = true;
        nextBlinkAt.current = now + 2800 + Math.random() * 4200;
      }
      setTick({ breath, blink, drift });
      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [active]);

  return tick;
}

/**
 * Track the user's cursor as an attention target. Future 3D rigs will turn
 * the head toward this point; the placeholder ignores it.
 */
export function useAttentionTarget(enabled = true): { x: number; y: number } | null {
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: MouseEvent) => setTarget({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [enabled]);
  return target;
}

/** Derive an idle emotion hint from the operational state (safe default). */
export function stateToClipKey(
  state: AvatarState,
):
  | "idle"
  | "speaking"
  | "thinking"
  | "listening"
  | "reviewing"
  | "warning"
  | "working"
  | "celebrating"
  | "offline" {
  return state === "idle" ? "idle" : state;
}
