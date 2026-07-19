// Client-side speech engine: stream TTS PCM from /api/voice/tts, play it via
// WebAudio, and publish real-time amplitude to the voice bus for lip sync.
// While an executive is speaking, we set their presence to "speaking"; on end
// we restore "listening" (or "idle") — mouths never move on silence.
import { useCallback, useRef, useState } from "react";
import { setMouthAmp } from "@/lib/voice-bus";
import { setExecPresence } from "@/lib/presence-bus";
import { supabase } from "@/integrations/supabase/client";
import type { ExecutiveId } from "@/lib/executives";

type SpeakState = "idle" | "loading" | "speaking";

// Base64 -> Uint8Array
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function useExecVoice(executive: ExecutiveId) {
  const [state, setState] = useState<SpeakState>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setMouthAmp(executive, 0);
    setExecPresence(executive, "listening");
    setState("idle");
  }, [executive]);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    stop();
    const ac = new AbortController();
    abortRef.current = ac;
    setState("loading");
    setExecPresence(executive, "thinking");

    let res: Response;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const bearer = sessionData.session?.access_token;
      res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({ executive, text }),
        signal: ac.signal,
      });
    } catch (e) {
      setState("idle");
      setExecPresence(executive, "listening");
      throw e;
    }
    if (!res.ok || !res.body) {
      setState("idle");
      setExecPresence(executive, "listening");
      const msg = await res.text().catch(() => "");
      throw new Error(`TTS failed: ${res.status} ${msg}`);
    }

    const ctx = new AudioContext({ sampleRate: 24000 });
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    gain.connect(analyser);
    analyser.connect(ctx.destination);

    let playhead = 0;
    let pending = new Uint8Array(0);
    let started = false;
    let scheduledEndAt = 0;

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      // Focus on speech-band energy (roughly 200Hz-3kHz at 24kHz sample rate);
      // avoids low-freq rumble dominating the amplitude.
      let sum = 0;
      const lo = Math.floor(buf.length * 0.05);
      const hi = Math.floor(buf.length * 0.55);
      for (let i = lo; i < hi; i++) sum += buf[i];
      const avg = sum / (hi - lo) / 255; // 0..1
      // Shape into mouth-open value with a soft curve + floor gate
      const gated = avg < 0.06 ? 0 : Math.min(1, (avg - 0.06) * 2.2);
      setMouthAmp(executive, gated);
      rafId = requestAnimationFrame(tick);
    };

    const stopMouth = () => {
      cancelAnimationFrame(rafId);
      setMouthAmp(executive, 0);
    };

    const playChunk = (incoming: Uint8Array) => {
      const bytes = new Uint8Array(pending.length + incoming.length);
      bytes.set(pending);
      bytes.set(incoming, pending.length);
      const usable = bytes.length - (bytes.length % 2);
      pending = bytes.slice(usable);
      if (usable === 0) return;
      const samples = new Int16Array(bytes.buffer, 0, usable / 2);
      const floats = Float32Array.from(samples, (s) => s / 32768);
      const buffer = ctx.createBuffer(1, floats.length, 24000);
      buffer.copyToChannel(floats, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      if (playhead === 0) playhead = ctx.currentTime + 0.05;
      else playhead = Math.max(playhead, ctx.currentTime);
      source.start(playhead);
      playhead += buffer.duration;
      scheduledEndAt = playhead;
      if (!started) {
        started = true;
        setState("speaking");
        setExecPresence(executive, "speaking");
        tick();
      }
    };

    try {
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let bufStr = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bufStr += value;
        // Parse SSE frames separated by \n\n
        let idx: number;
        while ((idx = bufStr.indexOf("\n\n")) !== -1) {
          const frame = bufStr.slice(0, idx);
          bufStr = bufStr.slice(idx + 2);
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const payload = JSON.parse(data) as { type: string; audio?: string };
              if (payload.type === "speech.audio.delta" && payload.audio) {
                playChunk(b64ToBytes(payload.audio));
              }
            } catch {
              // ignore malformed frames
            }
          }
        }
      }
    } catch (e) {
      stopMouth();
      stop();
      throw e;
    }

    // Wait for scheduled audio to finish, then release.
    const remaining = Math.max(0, scheduledEndAt - ctx.currentTime);
    window.setTimeout(() => {
      stopMouth();
      setState("idle");
      setExecPresence(executive, "listening");
      ctx.close().catch(() => {});
      if (ctxRef.current === ctx) ctxRef.current = null;
    }, remaining * 1000 + 120);
  }, [executive, stop]);

  return { speak, stop, state };
}
