// Founding 100 VIP server functions.
// All privileged operations verify the caller is the owner via RPC, then the
// SECURITY DEFINER database functions re-verify. Defense in depth.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VipConfig = {
  max_positions: number;
  paused: boolean;
  closed: boolean;
  granted_count: number;
};

export type VipMember = {
  id: string;
  display_name: string | null;
  founding_vip_number: number | null;
  vip_status: string;
  vip_granted_at: string | null;
  vip_revoked_at: string | null;
  vip_revocation_reason: string | null;
  fraud_flag: boolean;
  owner_notes: string | null;
  email: string | null;
  email_confirmed_at: string | null;
  created_at: string;
};

export type MyVipStatus = {
  is_founding_vip: boolean;
  founding_vip_number: number | null;
  vip_status: string;
  subscription_tier: string;
  subscription_price_cents: number;
};

/** Public: current user's own VIP status. */
export const getMyVipStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyVipStatus | null> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "is_founding_vip, founding_vip_number, vip_status, subscription_tier, subscription_price_cents",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as MyVipStatus | null) ?? null;
  });

/** Public: current config (read-only for all authenticated users). */
export const getVipConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VipConfig> => {
    const { data, error } = await context.supabase
      .from("founding_vip_config")
      .select("max_positions, paused, closed, granted_count")
      .eq("id", 1)
      .single();
    if (error) throw new Error(error.message);
    return data as VipConfig;
  });

async function requireOwner(supabase: unknown, userId: string): Promise<void> {
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("is_owner", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: owner access required");
}

/** Owner: full VIP roster with auth.users email joined via admin client. */
export const listFoundingVips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VipMember[]> => {
    await requireOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, display_name, founding_vip_number, vip_status, vip_granted_at, vip_revoked_at, vip_revocation_reason, fraud_flag, owner_notes, created_at",
      )
      .eq("is_founding_vip", true)
      .order("founding_vip_number", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (profiles ?? []) as Array<Omit<VipMember, "email" | "email_confirmed_at">>;
    const enriched: VipMember[] = [];
    for (const row of rows) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(row.id);
      enriched.push({
        ...row,
        email: userData?.user?.email ?? null,
        email_confirmed_at: userData?.user?.email_confirmed_at ?? null,
      });
    }
    return enriched;
  });

const rpcCall = async (
  supabase: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<void> => {
  const client = supabase as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
};

export const revokeVip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; reason: string }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    await rpcCall(context.supabase, "owner_revoke_vip", { _user_id: data.userId, _reason: data.reason });
    return { ok: true };
  });

export const restoreVip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    await rpcCall(context.supabase, "owner_restore_vip", { _user_id: data.userId });
    return { ok: true };
  });

export const setPromotionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paused: boolean; closed: boolean }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    await rpcCall(context.supabase, "owner_set_promotion", { _paused: data.paused, _closed: data.closed });
    return { ok: true };
  });

export const flagFraud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; flag: boolean; note: string }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    await rpcCall(context.supabase, "owner_flag_fraud", { _user_id: data.userId, _flag: data.flag, _note: data.note });
    return { ok: true };
  });

export const manualGrantVip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; number: number }) => d)
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    await rpcCall(context.supabase, "owner_manual_grant_vip", { _user_id: data.userId, _number: data.number });
    return { ok: true };
  });

/** Client-safe: is the current user the owner? */
export const isCurrentUserOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await client.rpc("is_owner", { _user_id: context.userId });
    if (error) return { isOwner: false };
    return { isOwner: data === true };
  });
