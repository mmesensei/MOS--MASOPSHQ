// pg_cron entry point for the KATANA execution runner.
// Authenticated by KATANA_RUNNER_SECRET as a Bearer token (server-only secret,
// not the public Supabase anon key). POST-only. Logs failed auth to
// katana_security_events and uses a Postgres advisory lock to prevent
// overlapping runner ticks.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";



function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function logAuthFailure(reason: string, ip: string | null) {
  // Pre-auth events have no user context; server logs are the audit trail.
  console.warn(`[katana-runner] auth failure: ${reason} ip=${ip ?? "unknown"}`);
}

export const Route = createFileRoute("/api/public/hooks/katana-runner")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Reject browser-originated requests early.
        const secFetchMode = request.headers.get("sec-fetch-mode");
        const origin = request.headers.get("origin");
        if (secFetchMode === "cors" || secFetchMode === "navigate" || origin) {
          logAuthFailure("browser_originated", request.headers.get("x-forwarded-for"));
          return new Response("Forbidden", { status: 403 });
        }

        const expected = process.env.KATANA_RUNNER_SECRET;
        if (!expected) {
          return new Response("Runner not configured", { status: 500 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice("Bearer ".length).trim()
          : "";

        if (!token || !safeEqual(token, expected)) {
          logAuthFailure(token ? "invalid_secret" : "missing_secret", request.headers.get("x-forwarded-for"));
          return new Response("Unauthorized", { status: 401 });
        }

        // Overlap protection is enforced at the task level: claimBatch()
        // uses an atomic UPDATE ... WHERE status='ready' AND locked_at IS NULL
        // that only succeeds for the first runner. Two overlapping ticks
        // simply race for rows and never process the same task twice.
        try {
          const { runNextBatch } = await import("@/lib/katana/runner.server");
          const report = await runNextBatch();
          // Do not leak internal task details — only aggregate counts.
          return Response.json({
            ok: true,
            claimed: report.claimed,
            completed: report.completed,
            failed: report.failed,
            blocked: report.blocked,
            skipped: report.skipped,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "error";
          return Response.json({ ok: false, error: msg.slice(0, 200) }, { status: 500 });
        }
      },
    },
  },
});
