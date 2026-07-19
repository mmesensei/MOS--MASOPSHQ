// Admin gate — server-truth check for the Operator (admin) role.
// The Opportunity Lab, and any future privileged surface, MUST call
// requireAdmin() before doing anything. RLS is the last line; this is the first.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcClient = {
  rpc: (
    fn: "has_role" | "enforce_engine_quota",
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

/** Server-side helper: throws if the caller is not an admin. */
export async function assertAdmin(supabase: unknown, userId: string): Promise<void> {
  const client = supabase as RpcClient;
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: admin access required");
}

/** Hourly / daily execution caps per engine action. Deliberately tight for a
 * single-operator system; retune here to change every endpoint at once. */
export const ENGINE_QUOTAS = {
  "engine.scan":   { perHour: 8,  perDay: 30 },
  "engine.goal":   { perHour: 20, perDay: 60 },
  "engine.status": { perHour: 60, perDay: 300 },
} as const;
export type EngineAction = keyof typeof ENGINE_QUOTAS;

/** Atomic quota check + audit log. Re-verifies admin server-side, counts recent
 * actions, and inserts a log row — or throws with a rate-limit message. */
export async function enforceEngineQuota(
  supabase: unknown,
  action: EngineAction,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { perHour, perDay } = ENGINE_QUOTAS[action];
  const client = supabase as RpcClient;
  const { error } = await client.rpc("enforce_engine_quota", {
    _action: action,
    _per_hour: perHour,
    _per_day: perDay,
    _metadata: metadata,
  });
  if (error) throw new Error(error.message || "Engine quota check failed");
}

/** Client-callable: returns whether the current user is an admin. Never trust on its own. */
export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { isAdmin: false, error: error.message };
    return { isAdmin: data === true };
  });
