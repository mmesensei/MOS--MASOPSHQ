// Mic recorder → WAV → /api/voice/stt. Uses Web Audio (not MediaRecorder)
// so every clip is a complete, decodable WAV file regardless of browser.
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const flat = new Float32Array(length);
  let o = 0;
  for (const c of chunks) { flat.set(c, o); o += c.length; }
  // Downsample to 16kHz mono to shrink upload
  const targetRate = 16000;
  const ratio = sampleRate / targetRate;
  const outLen = Math.floor(flat.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = flat[Math.floor(i * ratio)] ?? 0;
    out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + out.byteLength);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + out.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, out.byteLength, true);
  new Int16Array(buffer, 44).set(out);
  return new Blob([buffer], { type: "audio/wav" });
}

export function useMicRecorder() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const start = useCallback(async () => {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    srcRef.current = src;
    const node = ctx.createScriptProcessor(4096, 1, 1);
    nodeRef.current = node;
    node.onaudioprocess = (e) => {
      chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    src.connect(node);
    node.connect(ctx.destination);
    setRecording(true);
  }, []);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    setRecording(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    nodeRef.current?.disconnect();
    srcRef.current?.disconnect();
    const ctx = ctxRef.current;
    const rate = ctx?.sampleRate ?? 44100;
    await ctx?.close().catch(() => {});
    ctxRef.current = null;
    const blob = encodeWav(chunksRef.current, rate);
    if (blob.size < 2048) return "";
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "recording.wav");
      const { data: sessionData } = await supabase.auth.getSession();
      const bearer = sessionData.session?.access_token;
      const res = await fetch("/api/voice/stt", {
        method: "POST",
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(`STT ${res.status}`);
      const json = (await res.json()) as { text?: string };
      return (json.text ?? "").trim();
    } finally {
      setTranscribing(false);
    }
  }, []);

  return { start, stopAndTranscribe, recording, transcribing };
}
