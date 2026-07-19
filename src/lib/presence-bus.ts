// Presence bus — a tiny pub/sub so every avatar on screen reflects the
// executive's live state (thinking, speaking, idle) in real time, even
// across tabs. No server round trip; pure client signal.
import { useEffect, useState } from "react";
import type { PresenceState } from "@/components/executive-presence";
import type { ExecutiveId } from "@/lib/executives";

const EVENT = "mos:presence";
const CHANNEL = "mos-presence";
const IDLE_AFTER_MS = 30_000; // safety: force-idle if no update in 30s

type PresencePayload = { executive: ExecutiveId; state: PresenceState; at: number };

const current: Record<ExecutiveId, PresenceState> = {
  iris: "idle",
  apex: "idle",
  katana: "idle",
  sentinel: "idle",
};
const lastAt: Record<ExecutiveId, number> = { iris: 0, apex: 0, katana: 0, sentinel: 0 };

let channel: BroadcastChannel | null = null;
function ensureChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (channel) return channel;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev) => {
      const p = ev.data as PresencePayload;
      if (!p || !p.executive) return;
      apply(p, /*rebroadcast*/ false);
    };
  } catch {
    channel = null;
  }
  return channel;
}

function apply(p: PresencePayload, rebroadcast: boolean) {
  current[p.executive] = p.state;
  lastAt[p.executive] = p.at;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<PresencePayload>(EVENT, { detail: p }));
    if (rebroadcast) ensureChannel()?.postMessage(p);
  }
}

/** Publish this executive's live state. Call on thinking/speaking/idle transitions. */
export function setExecPresence(executive: ExecutiveId, state: PresenceState) {
  apply({ executive, state, at: Date.now() }, true);
}

/** Read a single executive's live state, with per-exec default fallback. */
export function useExecPresence(executive: ExecutiveId, fallback: PresenceState = "idle"): PresenceState {
  const [state, setState] = useState<PresenceState>(() => {
    const age = Date.now() - lastAt[executive];
    return age > 0 && age < IDLE_AFTER_MS ? current[executive] : fallback;
  });

  useEffect(() => {
    ensureChannel();
    const handler = (ev: Event) => {
      const p = (ev as CustomEvent<PresencePayload>).detail;
      if (p.executive !== executive) return;
      setState(p.state);
    };
    window.addEventListener(EVENT, handler);

    // Safety sweep: if the exec was set to a working state and no update
    // arrives within IDLE_AFTER_MS, revert to fallback so tiles never look
    // stuck "thinking" after a page reload.
    const sweep = window.setInterval(() => {
      const at = lastAt[executive];
      if (!at) return;
      if (Date.now() - at > IDLE_AFTER_MS && current[executive] !== fallback) {
        apply({ executive, state: fallback, at: Date.now() }, false);
      }
    }, 5_000);

    return () => {
      window.removeEventListener(EVENT, handler);
      window.clearInterval(sweep);
    };
  }, [executive, fallback]);

  return state;
}
