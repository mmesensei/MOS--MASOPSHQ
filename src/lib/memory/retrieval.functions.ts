// Phase 6 — Bounded shared-memory retrieval, exposed as an owner-scoped server fn.
// Wraps src/lib/memory/retrieval.server.ts. Never returns restricted-sensitivity
// items unless the caller is the owner (RLS-scoped anyway); enforces a hard cap.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXECUTIVE_IDS } from "@/lib/executives";

const inputSchema = z.object({
  executiveId: z.enum(EXECUTIVE_IDS as unknown as [string, ...string[]]).optional(),
  subjectKey: z.string().max(200).optional(),
  missionId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  subsystem: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(8).optional(),
  crossExecutive: z.boolean().optional(), // include other executives' approved memories
});

export const retrieveSharedMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { retrieveMemoryPacket } = await import("@/lib/memory/retrieval.server");

    // Own-executive packet
    const own = data.executiveId
      ? await retrieveMemoryPacket({
          userId: context.userId,
          executiveId: data.executiveId as never,
          subjectKey: data.subjectKey ?? null,
          missionId: data.missionId ?? null,
          taskId: data.taskId ?? null,
          subsystem: data.subsystem ?? null,
          limit: Math.min(data.limit ?? 5, 8),
          includeRestricted: false,
        })
      : [];

    // Cross-executive: pull broader packet ignoring executive filter, mark source.
    // Confidence and sensitivity are already preserved on each packet.
    let shared: typeof own = [];
    if (data.crossExecutive) {
      const all = await retrieveMemoryPacket({
        userId: context.userId,
        executiveId: null,
        subjectKey: data.subjectKey ?? null,
        missionId: data.missionId ?? null,
        taskId: data.taskId ?? null,
        subsystem: data.subsystem ?? null,
        limit: Math.min(data.limit ?? 5, 8),
        includeRestricted: false,
      });
      const ownIds = new Set(own.map((p) => p.id));
      shared = all.filter((p) => !ownIds.has(p.id) && p.executive_id !== data.executiveId);
    }

    return {
      own,
      shared,
      note: "Shared memory is not automatically trusted. Weigh confidence, recency, sensitivity, and source executive before applying.",
    };
  });
