// Message bus — publishes the latest spoken line per executive so the
// boardroom can render a speech bubble above each avatar. The bubble stays
// visible until that executive speaks again (no auto-dismiss).
//
// Also keeps a rolling in-memory transcript of every bubble so the Operator
// can review prior messages via the Transcript panel.
import { useEffect, useState } from "react";
import type { ExecutiveId } from "@/lib/executives";

const EVENT = "mos:exec-message";
const LOG_EVENT = "mos:exec-message-log";
const MAX_ENTRIES = 200;

type Payload = { executive: ExecutiveId; text: string; at: number };
export type TranscriptEntry = { id: string; executive: ExecutiveId; text: string; at: number };

const current: Record<ExecutiveId, Payload | null> = {
  iris: null,
  apex: null,
  katana: null,
  sentinel: null,
};

let transcript: TranscriptEntry[] = [];

function emitLog() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<TranscriptEntry[]>(LOG_EVENT, { detail: transcript }));
  }
}

export function setExecMessage(executive: ExecutiveId, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const payload: Payload = { executive, text: trimmed, at: Date.now() };
  current[executive] = payload;
  const entry: TranscriptEntry = {
    id: `${payload.at}-${executive}-${Math.random().toString(36).slice(2, 7)}`,
    ...payload,
  };
  transcript = [...transcript, entry].slice(-MAX_ENTRIES);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<Payload>(EVENT, { detail: payload }));
  }
  emitLog();
}

export function clearExecMessage(executive: ExecutiveId) {
  current[executive] = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<Payload>(EVENT, { detail: { executive, text: "", at: Date.now() } }),
    );
  }
}

export function clearTranscript() {
  transcript = [];
  emitLog();
}

export function getTranscript(): TranscriptEntry[] {
  return transcript;
}

export function useExecMessage(executive: ExecutiveId): string {
  const [text, setText] = useState<string>(() => current[executive]?.text ?? "");
  useEffect(() => {
    const handler = (ev: Event) => {
      const p = (ev as CustomEvent<Payload>).detail;
      if (p.executive === executive) setText(p.text);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [executive]);
  return text;
}

export function useTranscript(): TranscriptEntry[] {
  const [log, setLog] = useState<TranscriptEntry[]>(() => transcript);
  useEffect(() => {
    const handler = (ev: Event) => {
      setLog((ev as CustomEvent<TranscriptEntry[]>).detail);
    };
    window.addEventListener(LOG_EVENT, handler);
    return () => window.removeEventListener(LOG_EVENT, handler);
  }, []);
  return log;
}
