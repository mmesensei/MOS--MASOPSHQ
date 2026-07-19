// Opportunity Lab — IRIS business-opportunity researcher and planning-goal manager. Planning only — MOS never receives, holds, invests, trades, or transfers funds.
// IRIS proposes low-risk / high-gain income plays against the Operator's
// capital goal. Plays are staged as "proposed"; the Operator approves or
// kills. Tiered autonomy is enforced client-side + server-side by
// autonomy_threshold_usd.
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { assertAdmin, enforceEngineQuota } from "@/lib/admin.functions";

const channelEnum = z.enum(["digital", "ecom", "affiliate", "brokerage"]);
const statusEnum = z.enum(["proposed", "approved", "active", "completed", "killed", "rejected"]);

// ---------- GOAL ----------

export const getActiveGoal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("compounding_goals")
      .select("*")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    starting_capital: number;
    current_capital?: number;
    target_capital: number;
    timeframe_days: number;
    risk_tolerance: number;
    autonomy_threshold_usd: number;
    notes?: string;
  }) => ({
    id: d.id ? z.string().uuid().parse(d.id) : undefined,
    starting_capital: Math.max(0, Number(d.starting_capital)),
    current_capital: d.current_capital != null ? Math.max(0, Number(d.current_capital)) : Math.max(0, Number(d.starting_capital)),
    target_capital: Math.max(1, Number(d.target_capital)),
    timeframe_days: Math.max(1, Math.round(Number(d.timeframe_days))),
    risk_tolerance: Math.min(5, Math.max(1, Math.round(Number(d.risk_tolerance)))),
    autonomy_threshold_usd: Math.max(0, Number(d.autonomy_threshold_usd)),
    notes: d.notes?.slice(0, 2000) ?? null,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await enforceEngineQuota(context.supabase, "engine.goal", { id: data.id ?? null });
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("compounding_goals")
        .update({
          starting_capital: data.starting_capital,
          current_capital: data.current_capital,
          target_capital: data.target_capital,
          timeframe_days: data.timeframe_days,
          risk_tolerance: data.risk_tolerance,
          autonomy_threshold_usd: data.autonomy_threshold_usd,
          notes: data.notes,
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    // Deactivate any prior active goals.
    await context.supabase
      .from("compounding_goals")
      .update({ status: "paused" })
      .eq("user_id", context.userId)
      .eq("status", "active");
    const { data: row, error } = await context.supabase
      .from("compounding_goals")
      .insert({
        user_id: context.userId,
        starting_capital: data.starting_capital,
        current_capital: data.current_capital,
        target_capital: data.target_capital,
        timeframe_days: data.timeframe_days,
        risk_tolerance: data.risk_tolerance,
        autonomy_threshold_usd: data.autonomy_threshold_usd,
        notes: data.notes,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- OPPORTUNITIES ----------

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { goalId?: string; status?: string; limit?: number } = {}) => ({
    goalId: d.goalId ? z.string().uuid().parse(d.goalId) : undefined,
    status: d.status ? statusEnum.parse(d.status) : undefined,
    limit: Math.min(Math.max(d.limit ?? 40, 1), 100),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("income_opportunities")
      .select("*")
      .eq("user_id", context.userId)
      .order("confidence", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.goalId) q = q.eq("goal_id", data.goalId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setOpportunityStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string; kill_reason?: string; actual_return_usd?: number }) => ({
    id: z.string().uuid().parse(d.id),
    status: statusEnum.parse(d.status),
    kill_reason: d.kill_reason?.slice(0, 500) ?? null,
    actual_return_usd: d.actual_return_usd != null ? Number(d.actual_return_usd) : null,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await enforceEngineQuota(context.supabase, "engine.status", { id: data.id, status: data.status });
    const patch: {
      status: typeof data.status;
      kill_reason?: string;
      actual_return_usd?: number;
    } = { status: data.status };
    if (data.kill_reason) patch.kill_reason = data.kill_reason;
    if (data.actual_return_usd != null) patch.actual_return_usd = data.actual_return_usd;
    const { data: row, error } = await context.supabase
      .from("income_opportunities")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // If completed with a return, roll it into current_capital.
    if (data.status === "completed" && data.actual_return_usd != null && row?.goal_id) {
      const { data: goal } = await context.supabase
        .from("compounding_goals")
        .select("id,current_capital")
        .eq("id", row.goal_id)
        .maybeSingle();
      if (goal) {
        await context.supabase
          .from("compounding_goals")
          .update({ current_capital: Number(goal.current_capital) + Number(data.actual_return_usd) })
          .eq("id", goal.id);
      }
    }
    return row;
  });

// ---------- SCAN (IRIS) ----------

const CHANNEL_GUIDE = `
CHANNEL DEFINITIONS (only pick from the ones the Operator allowed):
- digital: digital products, templates, prompts, guides, newsletters, courses, notion assets. Low capital, high margin, needs distribution.
- ecom: e-commerce, arbitrage, retail arbitrage, print-on-demand, Shopify listings. Inventory + logistics risk.
- affiliate: affiliate marketing, ad stacks, paid traffic + affiliate offers, content-to-affiliate funnels. Ad spend risk.
- brokerage: dividend stocks, yield strategies, index/ETF DCA, cash-yielding accounts. KYC required. Legal — never options/margin/crypto leverage.
`;

export const scanOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { goalId: string; channels?: string[]; count?: number } = { goalId: "" }) => ({
    goalId: z.string().uuid().parse(d.goalId),
    channels: (d.channels ?? ["digital", "ecom", "affiliate", "brokerage"])
      .map((c) => channelEnum.safeParse(c))
      .filter((r) => r.success)
      .map((r) => (r as { success: true; data: z.infer<typeof channelEnum> }).data),
    count: Math.min(Math.max(d.count ?? 6, 3), 10),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await enforceEngineQuota(context.supabase, "engine.scan", { goalId: data.goalId, count: data.count });
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const { data: goal, error: goalErr } = await context.supabase
      .from("compounding_goals")
      .select("*")
      .eq("id", data.goalId)
      .maybeSingle();
    if (goalErr) throw new Error(goalErr.message);
    if (!goal) throw new Error("Goal not found");

    // Pull existing plays so IRIS doesn't repeat.
    const { data: existing } = await context.supabase
      .from("income_opportunities")
      .select("title,channel,thesis")
      .eq("goal_id", goal.id)
      .in("status", ["proposed", "approved", "active"])
      .limit(30);

    const daysRemaining = goal.timeframe_days;
    const capital = Number(goal.current_capital);
    const target = Number(goal.target_capital);
    const multiplier = target / Math.max(capital, 1);
    const requiredDailyGrowth = multiplier > 1 ? (Math.pow(multiplier, 1 / Math.max(daysRemaining, 1)) - 1) * 100 : 0;

    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `You are IRIS, Chief Executive Strategist of MOS. You are researching realistic business opportunities the Operator can evaluate. This is an advisory / planning exercise — MOS never receives, holds, invests, trades, or transfers funds. Any real-world action happens in the Operator's own regulated accounts, after their own decision, and requires their explicit approval.

OPERATOR PLANNING GOAL (context — not a promise):
- Working capital reference: $${capital.toFixed(2)}
- Target reference: $${target.toFixed(2)} in ${daysRemaining} days (${multiplier.toFixed(2)}x, ~${requiredDailyGrowth.toFixed(2)}% implied daily growth to hit target)
- Risk tolerance: ${goal.risk_tolerance}/5 (1 = capital preservation, 5 = aggressive growth)
- Approval threshold: MOS may prepare/stage steps under $${Number(goal.autonomy_threshold_usd).toFixed(2)}; ANY external, financial, or publishing action still requires the Operator's explicit approval and runs in their own accounts
- Allowed channels: ${data.channels.join(", ")}
- Operator notes: ${goal.notes ?? "(none)"}

${CHANNEL_GUIDE}

ALREADY STAGED (do NOT repeat by title or thesis):
${(existing ?? []).map((e) => `- [${e.channel}] ${e.title}`).join("\n") || "(none yet)"}

HARD RULES:
- Every opportunity must be legal, ethical, and executable by a solo operator with the stated working capital.
- NEVER propose gambling, crypto leverage, options, margin, MLMs, get-rich-quick schemes, pyramid or referral chains, or anything requiring credentials the Operator does not have.
- Never use phrases like "guaranteed income", "safe gains", "risk-free", "automatic profits", "passive income guaranteed", or "make money while you sleep". Frame every opportunity with honest downside, effort, and uncertainty. Results always depend on the Operator's own execution.
- If the target multiplier is unrealistic for the timeframe, propose the BEST honest options anyway with honest projected_return_usd — do not inflate numbers to hit the target.
- capital_required must fit inside the working capital reference of $${capital.toFixed(2)} (or partial allocation of it).
- risk_score: 1 = near-zero risk of loss (yield-style holdings, dollar-cost averaging in the Operator's own regulated account), 5 = high risk of loss (unproven ads, speculative arbitrage). Prefer 1–3 for tolerance ≤ 3.
- confidence: honest 0–100 based on evidence + operator fit.


Return ONLY valid JSON (no prose, no code fence) in this exact shape:
{
  "opportunities": [
    {
      "title": "short specific title <= 90 chars",
      "thesis": "2-3 sentences: WHY this is a real business opportunity, what makes it lower-risk than alternatives, why it fits this Operator's working capital and timeframe. Include a plain-English caveat about what could go wrong.",
      "channel": "digital | ecom | affiliate | brokerage",
      "capital_required": number (USD),
      "projected_return_usd": number (realistic USD net return),
      "projected_roi_pct": number (net ROI % over timeframe_days),
      "timeframe_days": number (days to realize return),
      "risk_score": 1 | 2 | 3 | 4 | 5,
      "effort_score": 1 | 2 | 3 | 4 | 5,
      "confidence": 0-100,
      "evidence": "1-2 sentences citing real market patterns, benchmarks, or reasoning",
      "playbook": [
        { "step": 1, "action": "concrete first action", "owner": "iris|apex|katana|sentinel|operator", "requires_approval": true|false }
      ]
    }
  ]
}

Produce ${data.count} opportunities, ranked BEST-FIT FIRST. Spread across allowed channels when it makes sense. Prefer risk_score ≤ ${goal.risk_tolerance}.`;

    let parsed: { opportunities?: unknown[] } = {};
    try {
      const { text } = await generateText({ model: gateway(DEFAULT_MODEL), prompt });
      const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
      parsed = JSON.parse(clean);
    } catch (e) {
      throw new Error(`IRIS scan failed: ${e instanceof Error ? e.message : "unknown"}`);
    }

    const raw = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    const allowedChannels = new Set(data.channels);
    type Json = string | number | boolean | null | { [k: string]: Json } | Json[];
    type Row = {
      user_id: string; goal_id: string; title: string; thesis: string;
      channel: z.infer<typeof channelEnum>; capital_required: number;
      projected_return_usd: number; projected_roi_pct: number; timeframe_days: number;
      risk_score: number; effort_score: number; confidence: number;
      playbook: Json; evidence: string | null; staged_by_exec: string;
    };
    const rows: Row[] = [];

    for (const o of raw.slice(0, data.count)) {
      const p = o as Record<string, unknown>;
      const title = typeof p.title === "string" ? p.title.trim().slice(0, 200) : "";
      const thesis = typeof p.thesis === "string" ? p.thesis.trim().slice(0, 2000) : "";
      const channel = typeof p.channel === "string" ? p.channel.trim() : "";
      if (!title || !thesis || !allowedChannels.has(channel as z.infer<typeof channelEnum>)) continue;
      const capital_required = Math.max(0, Number(p.capital_required) || 0);
      const projected_return_usd = Math.max(0, Number(p.projected_return_usd) || 0);
      const projected_roi_pct = Number(p.projected_roi_pct) || 0;
      const timeframe_days = Math.max(1, Math.round(Number(p.timeframe_days) || goal.timeframe_days));
      const risk_score = Math.min(5, Math.max(1, Math.round(Number(p.risk_score) || 3)));
      const effort_score = Math.min(5, Math.max(1, Math.round(Number(p.effort_score) || 3)));
      const confidence = Math.min(100, Math.max(0, Math.round(Number(p.confidence) || 50)));
      const evidence = typeof p.evidence === "string" ? p.evidence.slice(0, 1000) : null;
      const playbook = (Array.isArray(p.playbook) ? p.playbook.slice(0, 20) : []) as Json;
      rows.push({
        user_id: context.userId,
        goal_id: goal.id,
        title, thesis,
        channel: channel as z.infer<typeof channelEnum>,
        capital_required, projected_return_usd, projected_roi_pct, timeframe_days,
        risk_score, effort_score, confidence,
        playbook, evidence,
        staged_by_exec: "iris",
      });
    }

    if (rows.length === 0) return { inserted: 0 as const };

    const { data: inserted, error } = await context.supabase
      .from("income_opportunities")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    return { inserted: inserted?.length ?? 0 };
  });
