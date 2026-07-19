// SENTINEL owner controls — read status, manage budgets, toggle kill switch.
// All writes are owner-gated via requireSupabaseAuth + is_owner check.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(supabase: {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
}, userId: string) {
  const { data, error } = await supabase.rpc("is_owner", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: owner only");
}

export const getSentinelStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: rt }, { data: cost }, { data: anomalies }, { data: health }, { data: policies }] = await Promise.all([
      context.supabase.from("sentinel_runtime_state").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("sentinel_cost_ledger").select("cost_micro_usd, provider, capability, executive_id").eq("user_id", context.userId).eq("day", today),
      context.supabase.from("sentinel_anomalies").select("*").eq("user_id", context.userId).eq("status", "open").order("detected_at", { ascending: false }).limit(20),
      context.supabase.from("sentinel_provider_health").select("*").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(50),
      context.supabase.from("sentinel_budget_policies").select("*").eq("user_id", context.userId),
    ]);
    const todayMicro = (cost ?? []).reduce((s, r) => s + Number(r.cost_micro_usd ?? 0), 0);
    return {
      today_cost_micro_usd: todayMicro,
      today_cost_usd: todayMicro / 1_000_000,
      kill_switch_active: !!rt?.kill_switch_active,
      kill_switch_reason: rt?.kill_switch_reason ?? null,
      fail_policy: rt?.fail_policy ?? "closed",
      disabled_bindings: rt?.disabled_bindings ?? [],
      anomalies: anomalies ?? [],
      provider_health: health ?? [],
      budget_policies: policies ?? [],
    };
  });

export const setKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { active: boolean; reason?: string }) =>
    z.object({ active: z.boolean(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("sentinel_runtime_state")
      .upsert({
        user_id: context.userId,
        kill_switch_active: data.active,
        kill_switch_reason: data.reason ?? null,
        kill_switch_actor: context.userId,
        kill_switch_activated_at: data.active ? new Date().toISOString() : null,
      } as never);
    if (error) throw new Error(error.message);
    const { recordEvent } = await import("@/lib/memory/events.server");
    await recordEvent({
      userId: context.userId,
      subsystem: "sentinel",
      eventType: data.active ? "kill_switch.activated" : "kill_switch.recovered",
      outcomeClass: "override",
      severity: data.active ? 5 : 3,
      confidence: 1,
      summary: data.active ? `Kill switch activated: ${data.reason ?? ""}` : "Kill switch recovered",
    });
    return { ok: true };
  });

export const upsertBudgetPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      scope: z.enum(["daily_total", "provider", "capability", "executive", "workflow", "single_execution", "cost_growth"]),
      scope_key: z.string().max(120).nullable().optional(),
      mode: z.enum(["disabled", "monitor", "warn", "throttle", "block"]),
      limit_micro_usd: z.number().int().nonnegative(),
      window_kind: z.enum(["day", "hour", "call"]).default("day"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase as never, context.userId);
    const { error } = await context.supabase.from("sentinel_budget_policies").upsert({
      id: data.id,
      user_id: context.userId,
      scope: data.scope,
      scope_key: data.scope_key ?? null,
      mode: data.mode,
      limit_micro_usd: data.limit_micro_usd,
      window_kind: data.window_kind,
    } as never, { onConflict: "user_id,scope,scope_key,window_kind" } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveAnomaly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("sentinel_anomalies")
      .update({ status: "resolved", resolved_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
