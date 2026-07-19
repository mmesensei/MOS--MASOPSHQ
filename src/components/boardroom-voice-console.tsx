// Boardroom voice console — Operator controls that drive lip-synced speech.
// - Per-exec "Speak" button: sends a canned line through TTS to test voice + mouth.
// - Mic to any exec: record → STT → /api/chat (streamed reply) → TTS lipsync.
import { useState } from "react";
import { EXECUTIVE_LIST, type ExecutiveId } from "@/lib/executives";
import { useExecVoice } from "@/hooks/use-exec-voice";
import { useMicRecorder } from "@/hooks/use-mic-recorder";
import { setExecMessage } from "@/lib/message-bus";
import { Mic, Square, Volume2, Loader2 } from "lucide-react";

const GREETINGS: Record<ExecutiveId, string> = {
  iris: "Operator, I'm here. Let's clarify what actually matters before we act.",
  apex: "Standing by. Give me the workflow and I'll turn it into a system.",
  katana: "Ready to move. Name the objective and I'll build the execution path.",
  sentinel: "Vigilant. State the action and I'll return risk classification.",
};

function ExecRow({ id }: { id: ExecutiveId }) {
  const { speak, stop, state } = useExecVoice(id);
  const exec = EXECUTIVE_LIST.find((e) => e.id === id)!;
  const active = state !== "idle";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-black/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono uppercase tracking-[0.25em] ${exec.colorClass}`}>{exec.name}</span>
        <span className="text-[9px] uppercase text-white/40">{state}</span>
      </div>
      <button
        onClick={() => (active ? stop() : (setExecMessage(id, GREETINGS[id]), void speak(GREETINGS[id])))}
        className="inline-flex items-center gap-1.5 rounded bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-white/80 hover:bg-white/10"
      >
        {state === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : active ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        {active ? "Stop" : "Speak"}
      </button>
    </div>
  );
}

function TalkToExec() {
  const [target, setTarget] = useState<ExecutiveId>("iris");
  const [status, setStatus] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [typed, setTyped] = useState<string>("");
  const mic = useMicRecorder();
  const voice = useExecVoice(target);

  async function sendText(text: string) {
    try {
      setTranscript(text);
      setStatus("Consulting…");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executive: target, messages: [{ role: "user", content: text }] }),
      });
      if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let reply = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        reply += value;
      }
      if (!reply.trim()) { setStatus("No reply."); return; }
      const finalReply = reply.slice(0, 2400);
      setExecMessage(target, finalReply);
      setStatus("Speaking…");
      await voice.speak(finalReply);
      setStatus("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleMic() {
    if (mic.recording) {
      try {
        setStatus("Transcribing…");
        const text = await mic.stopAndTranscribe();
        if (!text) { setStatus("Nothing heard. Try again."); return; }
        await sendText(text);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed");
      }
    } else {
      try {
        setStatus("");
        setTranscript("");
        await mic.start();
      } catch {
        setStatus("Microphone blocked");
      }
    }
  }

  async function handleSendTyped() {
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    await sendText(text);
  }

  const busy = mic.transcribing || voice.state === "loading" || status === "Consulting…" || status === "Speaking…";

  return (
    <div className="rounded-md border border-border/40 bg-black/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/60">Talk to</span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as ExecutiveId)}
          className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] uppercase tracking-widest text-white/90 focus:outline-none"
        >
          {EXECUTIVE_LIST.map((e) => (
            <option key={e.id} value={e.id} className="bg-[#0a0a12]">{e.name}</option>
          ))}
        </select>
        <button
          onClick={handleMic}
          disabled={mic.transcribing || voice.state === "loading"}
          aria-label={mic.recording ? "Stop recording" : "Start voice message"}
          className={`ml-auto inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] uppercase tracking-widest ${
            mic.recording ? "bg-red-500/80 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
          }`}
        >
          {mic.transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : mic.recording ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {mic.recording ? "Stop" : "Speak"}
        </button>
      </div>
      {/* Type-to-exec — accessible alternative to voice */}
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSendTyped(); }}
          placeholder={`Type to ${target.toUpperCase()}…`}
          aria-label={`Type a message to ${target}`}
          disabled={busy}
          className="flex-1 rounded bg-white/5 px-2 py-1 text-[11px] text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        <button
          onClick={handleSendTyped}
          disabled={busy || !typed.trim()}
          className="inline-flex items-center gap-1.5 rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-white/80 hover:bg-white/20 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
        </button>
      </div>
      {transcript && <div className="text-[11px] italic text-white/70">"{transcript}"</div>}
      {status && <div className="mt-1 text-[10px] uppercase tracking-widest text-white/50">{status}</div>}
    </div>
  );
}

export function BoardroomVoiceConsole() {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-1.5">
        {EXECUTIVE_LIST.map((e) => (
          <ExecRow key={e.id} id={e.id} />
        ))}
      </div>
      <TalkToExec />
    </div>
  );
}
