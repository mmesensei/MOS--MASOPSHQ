// Voice + tone mapping per executive. Each executive gets a distinct OpenAI
// TTS voice and instruction so IRIS never sounds like KATANA.
import type { ExecutiveId } from "@/lib/executives";

export const EXEC_VOICES: Record<ExecutiveId, { voice: string; instructions: string }> = {
  iris: {
    voice: "sage",
    instructions: "Speak with calm executive presence. Unhurried, warm, wise. Short pauses between sentences.",
  },
  apex: {
    voice: "alloy",
    instructions: "Speak precisely and structurally. Neutral, intelligent, measured pacing. No filler.",
  },
  katana: {
    voice: "ash",
    instructions: "Speak with disciplined momentum. Focused, action-forward, taut. Slightly faster pace.",
  },
  sentinel: {
    voice: "onyx",
    instructions: "Speak with calm authority and vigilance. Evidence-first, restrained, measured.",
  },
};
