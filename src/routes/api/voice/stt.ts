// Speech-to-text via the provider facade.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/voice/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAuth } = await import("@/lib/route-auth.server");
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.includes("multipart/form-data")) {
          return new Response("Expected multipart/form-data", { status: 400 });
        }
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size < 512) return new Response("Empty audio", { status: 400 });
        if (file.size > 20 * 1024 * 1024) return new Response("Audio too large", { status: 413 });

        const { providers } = await import("@/lib/providers/index.server");
        try {
          const result = await providers.stt(
            { callerSubsystem: "voice.stt" },
            { file, filename: file.name || "recording.wav" },
          );
          return Response.json({ text: result.text });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "STT failed";
          const status = (err as { status?: number }).status ?? 502;
          return new Response(msg, { status });
        }
      },
    },
  },
});
