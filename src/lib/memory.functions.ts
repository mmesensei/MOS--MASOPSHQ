// Public memory read surface. Writes are server-side only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXECUTIVE_IDS, type ExecutiveId } from "@/lib/executives";

const scopeSchema = z.object({
  executive_id: z.enum(EXECUTIVE_IDS as unknown as [ExecutiveId, ...ExecutiveId[]]).optional(),
  subject_key: z.string().max(200).optional(),
  mission_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  subsystem: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(8).optional(),
});

/** Owner-scoped bounded retrieval — safe to call from client. */
export const getRelevantMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => scopeSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { retrieveMemoryPacket } = await import("@/lib/memory/retrieval.server");
    return retrieveMemoryPacket({
      userId: context.userId,
      executiveId: data.executive_id ?? null,
      subjectKey: data.subject_key ?? null,
      missionId: data.mission_id ?? null,
      taskId: data.task_id ?? null,
      subsystem: data.subsystem ?? null,
      limit: data.limit ?? 5,
      includeRestricted: false,
    });
  });

/** Recent operational events for the current user (RLS-scoped). */
export const listRecentOperationalEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        executive_id: z.enum(EXECUTIVE_IDS as unknown as [ExecutiveId, ...ExecutiveId[]]).optional(),
        subsystem: z.string().max(80).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("operational_events")
      .select("id, executive_id, subsystem, event_type, outcome_class, severity, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (data.executive_id) q = q.eq("executive_id", data.executive_id);
    if (data.subsystem) q = q.eq("subsystem", data.subsystem);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Active learned patterns for the current user. */
export const listMyLearnedPatterns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        executive_id: z.enum(EXECUTIVE_IDS as unknown as [ExecutiveId, ...ExecutiveId[]]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("learned_patterns")
      .select("id, executive_id, subject_key, pattern_type, summary, confidence, success_count, failure_count, usefulness, status, last_observed_at")
      .eq("status", "active")
      .order("last_observed_at", { ascending: false })
      .limit(data.limit ?? 30);
    if (data.executive_id) q = q.eq("executive_id", data.executive_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
