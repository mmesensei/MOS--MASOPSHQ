// Voice bus — publishes real-time mouth-open amplitude (0..1) per executive
// while their TTS audio is playing. The R3F boardroom subscribes and drives
// each avatar's mouth mesh from this signal, so mouths move ONLY when their
// executive is actually speaking.
import { useEffect, useState } from "react";
import type { ExecutiveId } from "@/lib/executives";

const EVENT = "mos:voice-amplitude";

type Payload = { executive: ExecutiveId; amp: number };

const current: Record<ExecutiveId, number> = { iris: 0, apex: 0, katana: 0, sentinel: 0 };

export function setMouthAmp(executive: ExecutiveId, amp: number) {
  current[executive] = amp;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<Payload>(EVENT, { detail: { executive, amp } }));
  }
}

export function getMouthAmp(executive: ExecutiveId): number {
  return current[executive] ?? 0;
}

export function useMouthAmp(executive: ExecutiveId): number {
  const [amp, setAmp] = useState(() => current[executive] ?? 0);
  useEffect(() => {
    const handler = (ev: Event) => {
      const p = (ev as CustomEvent<Payload>).detail;
      if (p.executive === executive) setAmp(p.amp);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [executive]);
  return amp;
}
