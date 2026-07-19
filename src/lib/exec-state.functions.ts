// Executive runtime state — per-user presence, focus, mood, active mission.
// Permanent identity (name, doctrine, capabilities) lives in
// `src/lib/executives.ts` (public) and `executives-prompts.server.ts` (server).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXECUTIVE_IDS, type ExecutiveId } from "@/lib/executives";

const PRESENCE = ["available", "focused", "in_meeting", "away", "offline"] as const;
export type ExecutivePresence = (typeof PRESENCE)[number];

const stateSchema = z.object({
  executive_id: z.enum(EXECUTIVE_IDS as unknown as [ExecutiveId, ...ExecutiveId[]]),
  presence: z.enum(PRESENCE).optional(),
  mood: z.string().max(48).optional(),
  current_focus: z.string().max(280).nullable().optional(),
  active_mission_id: z.string().uuid().nullable().optional(),
});

export const listMyExecutiveState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("executive_state")
      .select("executive_id, presence, mood, current_focus, active_mission_id, last_interaction_at, updated_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setMyExecutivePresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => stateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // Users may write only their OWN state row. Doctrine, authority,
    // capabilities and provider config are never accepted from the client.
    const patch = {
      user_id: context.userId,
      executive_id: data.executive_id,
      presence: data.presence ?? "available",
      mood: data.mood ?? "neutral",
      current_focus: data.current_focus ?? null,
      active_mission_id: data.active_mission_id ?? null,
      last_interaction_at: new Date().toISOString(),
    };
    const { data: row, error } = await context.supabase
      .from("executive_state")
      .upsert(patch, { onConflict: "user_id,executive_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const touchExecutiveInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      executive_id: z.enum(EXECUTIVE_IDS as unknown as [ExecutiveId, ...ExecutiveId[]]),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("executive_state")
      .upsert(
        {
          user_id: context.userId,
          executive_id: data.executive_id,
          last_interaction_at: new Date().toISOString(),
        },
        { onConflict: "user_id,executive_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
