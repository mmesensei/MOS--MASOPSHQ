// Server-function wrappers around the runner.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Manual runner trigger — admin/owner only, bounded by engine quota.
export const runnerTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { runNextBatch } = await import("./runner.server");
    return runNextBatch();
  });

// Operator approves a task waiting for approval → back to queued so the
// runner picks it up on the next tick.
export const approveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("katana_agent_tasks")
      .update({ status: "queued", requires_approval: false })
      .eq("id", data.id)
      .eq("status", "waiting_on_operator");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("katana_agent_tasks")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
