// Phase 6 — Executive coordination hooks.
// Structured, bounded handoffs between IRIS / APEX / KATANA / SENTINEL.
// Not conversations. Server-controlled. Owner-scoped. Depth-capped.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EXECS = ["iris", "apex", "katana", "sentinel", "operator", "system"] as const;
const TO_EXECS = ["iris", "apex", "katana", "sentinel", "operator"] as const;
export const MAX_HANDOFF_DEPTH = 3;

const createSchema = z.object({
  fromExecutive: z.enum(EXECS),
  toExecutive: z.enum(TO_EXECS),
  purpose: z.string().min(3).max(280),
  taskId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional(),
  context: z.record(z.unknown()).optional(),
  requiredResponse: z.enum(["ack", "decision", "analysis", "approval", "none"]).default("ack"),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  parentHandoffId: z.string().uuid().optional(),
  expiresInHours: z.number().int().min(1).max(168).default(24),
});

export const createHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.fromExecutive === data.toExecutive) {
      throw new Error("Handoff must cross executive boundaries.");
    }

    // Depth enforcement — walk parent chain, cap at MAX_HANDOFF_DEPTH, block loops.
    let depth = 0;
    if (data.parentHandoffId) {
      const { data: parent } = await context.supabase
        .from("executive_handoffs")
        .select("id, depth, from_executive, to_executive")
        .eq("id", data.parentHandoffId)
        .maybeSingle();
      if (!parent) throw new Error("Parent handoff not found.");
      depth = (parent.depth ?? 0) + 1;
      if (depth > MAX_HANDOFF_DEPTH) {
        throw new Error(`Handoff depth cap (${MAX_HANDOFF_DEPTH}) exceeded — escalate to operator instead.`);
      }
      // Loop guard: no A→B→A→B echo within the same chain
      if (parent.from_executive === data.toExecutive && parent.to_executive === data.fromExecutive) {
        throw new Error("Recursive handoff loop detected — escalate to operator instead.");
      }
    }

    const expires_at = new Date(Date.now() + data.expiresInHours * 3_600_000).toISOString();

    const { data: row, error } = await context.supabase
      .from("executive_handoffs")
      .insert({
        user_id: context.userId,
        from_executive: data.fromExecutive,
        to_executive: data.toExecutive,
        purpose: data.purpose,
        task_id: data.taskId ?? null,
        mission_id: data.missionId ?? null,
        context: (data.context ?? {}) as never,
        required_response: data.requiredResponse,
        priority: data.priority,
        depth,
        parent_handoff_id: data.parentHandoffId ?? null,
        expires_at,
      })
      .select("id, depth, expires_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listOpenHandoffs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toExecutive?: string } | undefined) => ({
    toExecutive: d?.toExecutive && (TO_EXECS as readonly string[]).includes(d.toExecutive) ? d.toExecutive : undefined,
  }))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("executive_handoffs")
      .select("*")
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);
    if (data.toExecutive) q = q.eq("to_executive", data.toExecutive);
    const { data: rows } = await q;
    return rows ?? [];
  });

const respondSchema = z.object({
  handoffId: z.string().uuid(),
  outcome: z.record(z.unknown()),
  status: z.enum(["responded", "cancelled"]).default("responded"),
});

export const respondToHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => respondSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("executive_handoffs")
      .update({
        status: data.status,
        outcome: data.outcome as never,
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.handoffId)
      .eq("status", "open");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
