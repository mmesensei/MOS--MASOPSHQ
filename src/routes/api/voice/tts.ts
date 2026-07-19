// Executive text-to-speech. Streams audio from the provider facade.
// The provider layer selects the best speech.tts adapter per policy.
import { createFileRoute } from "@tanstack/react-router";
import { EXEC_VOICES } from "@/lib/exec-voices";
import type { ExecutiveId } from "@/lib/executives";

type Body = { executive: ExecutiveId; text: string };

export const Route = createFileRoute("/api/voice/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAuth } = await import("@/lib/route-auth.server");
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        let body: Body;
        try { body = (await request.json()) as Body; } catch { return new Response("Bad JSON", { status: 400 }); }
        const voiceCfg = EXEC_VOICES[body.executive];
        if (!voiceCfg) return new Response("Unknown executive", { status: 400 });
        const text = (body.text ?? "").toString().trim();
        if (!text) return new Response("Missing text", { status: 400 });
        if (text.length > 3000) return new Response("Text too long", { status: 400 });

        const { providers } = await import("@/lib/providers/index.server");
        try {
          const upstream = await providers.tts(
            { callerExecutiveId: body.executive, callerSubsystem: "voice.tts" },
            { text, voice: voiceCfg.voice, instructions: voiceCfg.instructions, format: "pcm", stream: true },
          );
          if (!upstream.body) return new Response("TTS empty", { status: 502 });
          return new Response(upstream.body, { headers: { "Content-Type": "text/event-stream" } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "TTS failed";
          const status = (err as { status?: number }).status ?? 502;
          return new Response(msg, { status });
        }
      },
    },
  },
});
