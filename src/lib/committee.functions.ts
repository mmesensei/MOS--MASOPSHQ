// Executive Committee — living governance layer.
// IRIS proposes → APEX reviews → KATANA plans → SENTINEL challenges → consensus + decision.
// Each executive writes its position row sequentially so the client (subscribed to
// Realtime on committee_positions / committee_reviews) sees the boardroom light up live.
// Admin-only. Persistent memory + outcome-based self-correction included.
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { assertAdmin } from "@/lib/admin.functions";

const subjectEnum = z.enum(["opportunity", "mission", "manual", "sop", "system"]);
const execOrder = ["iris", "apex", "katana", "sentinel"] as const;
type Exec = (typeof execOrder)[number];

/** Append an audit_logs row for an admin-scoped committee review event.
 *  Never throws — audit failures must not break the primary action. Every
 *  entry carries user_id + created_at (default now()) automatically. */
async function auditCommittee(
  supabase: unknown,
  userId: string,
  action:
    | "committee.review.create"
    | "committee.review.read"
    | "committee.review.list"
    | "committee.deliberation.run"
    | "committee.outcome.record",
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const client = supabase as {
      from: (t: string) => { insert: (r: Record<string, unknown>) => Promise<{ error: unknown }> };
    };
    await client.from("audit_logs").insert({
      user_id: userId,
      action,
      entity_type: "committee_review",
      entity_id: entityId,
      metadata: { ...metadata, at: new Date().toISOString() },
    });
  } catch {
    // swallow — audit is best-effort
  }
}

const EXEC_ROLE: Record<Exec, { title: string; owns: string; scoreKey: "strategic" | "operational" | "execution" | "risk"; brief: string }> = {
  iris:     { title: "Chief Strategy Officer",  owns: "growth, market fit, long-term value, competitive advantage", scoreKey: "strategic",   brief: "Judge strategic upside and long-horizon value. Be honest about market fit and durability." },
  apex:     { title: "Chief Operations Officer",owns: "resources, capacity, execution readiness, scalability",       scoreKey: "operational", brief: "Judge operational feasibility, resource load, bottlenecks. Cite hours/week and dependencies." },
  katana:   { title: "Chief Execution Officer", owns: "tactical implementation, automation, first actions, velocity",scoreKey: "execution",   brief: "Design the first 72 hours of execution. Automate what can be automated. Ship velocity matters." },
  sentinel: { title: "Chief Risk Officer",      owns: "risk, compliance, assumption validation, failure analysis",   scoreKey: "risk",        brief: "Challenge every assumption. Detect overconfidence. Score risk INVERSELY: 100 = very safe, 0 = catastrophic." },
};

// ---------- CREATE REVIEW ----------

export const createReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    subject_type: string;
    subject_id?: string;
    title: string;
    summary?: string;
    context?: Record<string, unknown>;
  }) => ({
    subject_type: subjectEnum.parse(d.subject_type),
    subject_id: d.subject_id ? z.string().uuid().parse(d.subject_id) : null,
    title: String(d.title).slice(0, 240),
    summary: d.summary ? String(d.summary).slice(0, 3000) : null,
    context: d.context ?? {},
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("committee_reviews")
      .insert({
        user_id: context.userId,
        subject_type: data.subject_type,
        subject_id: data.subject_id,
        title: data.title,
        summary: data.summary,
        context: data.context as unknown as never,
        phase: "proposing",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // If tied to an opportunity, backfill the FK so we can jump straight from board → review.
    if (data.subject_type === "opportunity" && data.subject_id) {
      await context.supabase
        .from("income_opportunities")
        .update({ committee_review_id: row.id })
        .eq("id", data.subject_id);
    }
    await auditCommittee(context.supabase, context.userId, "committee.review.create", row.id as string, {
      subject_type: data.subject_type,
      subject_id: data.subject_id,
      title: data.title,
    });
    return { id: row.id as string };
  });

// ---------- GET / LIST ----------

export const getReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ data: review, error: rErr }, { data: positions, error: pErr }] = await Promise.all([
      context.supabase.from("committee_reviews").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("committee_positions").select("*").eq("review_id", data.id).order("speaking_order"),
    ]);
    if (rErr) throw new Error(rErr.message);
    if (pErr) throw new Error(pErr.message);
    if (!review) throw new Error("Review not found");
    const { data: outcome } = await context.supabase
      .from("committee_outcomes").select("*").eq("review_id", data.id).maybeSingle();
    await auditCommittee(context.supabase, context.userId, "committee.review.read", data.id, {
      phase: review.phase,
      decision: review.decision,
      position_count: positions?.length ?? 0,
    });
    return { review, positions: positions ?? [], outcome };
  });

export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } = {}) => ({ limit: Math.min(Math.max(d.limit ?? 30, 1), 100) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("committee_reviews")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    await auditCommittee(context.supabase, context.userId, "committee.review.list", null, {
      limit: data.limit,
      returned: rows?.length ?? 0,
    });
    return rows ?? [];
  });

// ---------- RUN DELIBERATION ----------

export const runDeliberation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string }) => ({ reviewId: z.string().uuid().parse(d.reviewId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    // Operator-tunable calibration weights (0..3 each; 1 = default influence).
    const { data: settingsRow } = await context.supabase
      .from("calibration_settings")
      .select("roi_overshoot_weight, risk_underrating_weight, effort_underestimation_weight, accuracy_weight")
      .eq("user_id", context.userId)
      .maybeSingle();
    const W = {
      roi:      Number(settingsRow?.roi_overshoot_weight        ?? 1),
      risk:     Number(settingsRow?.risk_underrating_weight     ?? 1),
      effort:   Number(settingsRow?.effort_underestimation_weight ?? 1),
      accuracy: Number(settingsRow?.accuracy_weight             ?? 1),
    };


    const { data: review, error: rErr } = await context.supabase
      .from("committee_reviews").select("*").eq("id", data.reviewId).maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!review) throw new Error("Review not found");
    if (review.user_id !== context.userId) throw new Error("Forbidden");
    if (review.phase === "decided") return { ok: true, alreadyDecided: true };

    await auditCommittee(context.supabase, context.userId, "committee.deliberation.run", review.id, {
      stage: "start",
      subject_type: review.subject_type,
      title: review.title,
    });

    // ---- MEMORY: past outcomes of same subject_type for this operator ----
    const { data: memoryRows } = await context.supabase
      .from("committee_outcomes")
      .select("outcome, actual_roi_pct, predicted_roi_pct, actual_risk, predicted_risk, actual_effort_hours, predicted_effort_hours, notes, review_id")
      .eq("user_id", context.userId)
      .order("recorded_at", { ascending: false })
      .limit(50);
    const memoryReviewIds = (memoryRows ?? []).map((o) => o.review_id);
    const { data: memoryReviews } = memoryReviewIds.length
      ? await context.supabase.from("committee_reviews")
          .select("id, title, subject_type, decision, alignment_score")
          .in("id", memoryReviewIds)
      : { data: [] as { id: string; title: string; subject_type: string; decision: string | null; alignment_score: number | null }[] };
    const memoryById = new Map((memoryReviews ?? []).map((r) => [r.id, r]));

    // Same-class outcomes drive the calibration; keep the transcript lines short.
    const sameClassOutcomes = (memoryRows ?? []).filter((o) => {
      const r = memoryById.get(o.review_id);
      return r && r.subject_type === review.subject_type;
    });
    const memoryLines = sameClassOutcomes
      .map((o) => {
        const r = memoryById.get(o.review_id)!;
        const roiGap = o.actual_roi_pct != null && o.predicted_roi_pct != null
          ? `predicted ${o.predicted_roi_pct}% / actual ${o.actual_roi_pct}%` : "roi n/a";
        return `- "${r.title}" → outcome=${o.outcome}, ${roiGap}${o.notes ? `, note: ${o.notes.slice(0, 120)}` : ""}`;
      })
      .slice(0, 8);
    const memoryRefs = sameClassOutcomes.slice(0, 8).map((o) => o.review_id);

    // ---- CALIBRATION: per-executive accuracy & prediction bias from history ----
    const sameClassReviewIds = sameClassOutcomes.map((o) => o.review_id);
    const { data: pastPositions } = sameClassReviewIds.length
      ? await context.supabase.from("committee_positions")
          .select("review_id, executive, stance, confidence, scores")
          .in("review_id", sameClassReviewIds)
      : { data: [] as { review_id: string; executive: string; stance: string; confidence: number; scores: Record<string, number> | null }[] };
    const outcomeById = new Map(sameClassOutcomes.map((o) => [o.review_id, o]));
    const calibration: Record<Exec, { samples: number; accuracy: number; roiBias: number; riskBias: number; effortBias: number; note: string }> =
      {} as never;
    for (const exec of execOrder) {
      const rows = (pastPositions ?? []).filter((p) => p.executive === exec);
      let correct = 0, samples = 0;
      let roiSum = 0, roiN = 0, riskSum = 0, riskN = 0, effSum = 0, effN = 0;
      for (const p of rows) {
        const o = outcomeById.get(p.review_id);
        if (!o) continue;
        samples++;
        const positive = p.stance === "agree" || p.stance === "partial";
        const negative = p.stance === "challenge" || p.stance === "escalate";
        const win = o.outcome === "win";
        const bad = o.outcome === "loss" || o.outcome === "abandoned";
        if ((positive && win) || (negative && bad) || (p.stance === "partial" && o.outcome === "partial")) correct++;
        if (o.predicted_roi_pct != null && o.actual_roi_pct != null && positive) {
          roiSum += Number(o.predicted_roi_pct) - Number(o.actual_roi_pct); roiN++;
        }
        if (o.predicted_risk != null && o.actual_risk != null) {
          riskSum += Number(o.actual_risk) - Number(o.predicted_risk); riskN++;
        }
        if (o.predicted_effort_hours != null && o.actual_effort_hours != null) {
          effSum += Number(o.actual_effort_hours) - Number(o.predicted_effort_hours); effN++;
        }
      }
      const accuracy = samples ? correct / samples : 0;
      const roiBias = roiN ? roiSum / roiN : 0;
      const riskBias = riskN ? riskSum / riskN : 0;
      const effortBias = effN ? effSum / effN : 0;
      const parts: string[] = [];
      if (samples >= 2) parts.push(`${Math.round(accuracy * 100)}% historical accuracy over ${samples} calls`);
      if (Math.abs(roiBias) >= 5) parts.push(`ROI ${roiBias > 0 ? "OVER" : "UNDER"}-estimated by ~${Math.abs(Math.round(roiBias))} pts on average`);
      if (Math.abs(riskBias) >= 5) parts.push(`risk ${riskBias > 0 ? "UNDER" : "OVER"}-estimated by ~${Math.abs(Math.round(riskBias))} pts`);
      if (Math.abs(effortBias) >= 3) parts.push(`effort ${effortBias > 0 ? "UNDER" : "OVER"}-estimated by ~${Math.abs(Math.round(effortBias))} hrs`);
      calibration[exec] = {
        samples, accuracy, roiBias, riskBias, effortBias,
        note: parts.length ? parts.join("; ") : "no reliable prior calibration data",
      };
    }

    const gateway = createLovableAiGatewayProvider(key);

    const subjectHeader = `SUBJECT UNDER REVIEW
Type: ${review.subject_type}
Title: ${review.title}
Summary: ${review.summary ?? "(no summary)"}
Context: ${JSON.stringify(review.context ?? {}).slice(0, 2000)}

PAST OUTCOMES (this operator, same subject class — use for calibration, cite when relevant):
${memoryLines.length ? memoryLines.join("\n") : "(no prior outcomes yet — no historical bias)"}`;

    // Move phase → reviewing
    await context.supabase.from("committee_reviews").update({
      phase: "reviewing",
      memory_refs: memoryRefs,
    }).eq("id", review.id);


    const positions: Record<Exec, { stance: string; confidence: number; key_concern: string; rationale: string; recommendation: string; score: number }> = {} as never;

    for (let i = 0; i < execOrder.length; i++) {
      const exec = execOrder[i];
      const role = EXEC_ROLE[exec];

      // Announce speaker
      const nextPhase = i === 0 ? "reviewing" : i === execOrder.length - 1 ? "challenging" : "deliberating";
      await context.supabase.from("committee_reviews").update({
        current_speaker: exec, phase: nextPhase,
      }).eq("id", review.id);

      // Insert "thinking" placeholder so UI shows the seat lighting up
      await context.supabase.from("committee_positions").upsert({
        review_id: review.id,
        user_id: context.userId,
        executive: exec,
        stance: "thinking",
        is_streaming: true,
        speaking_order: i,
      }, { onConflict: "review_id,executive" });

      const priorTranscript = execOrder.slice(0, i).map((e) => {
        const p = positions[e];
        if (!p) return "";
        return `${e.toUpperCase()} (${EXEC_ROLE[e].title}) — stance: ${p.stance}, confidence ${p.confidence}%
  Key concern: ${p.key_concern}
  Recommendation: ${p.recommendation}`;
      }).filter(Boolean).join("\n\n");

      const cal = calibration[exec];
      const calibrationBrief = `YOUR PERSONAL CALIBRATION (from prior outcomes on this subject class — self-correct accordingly):
- ${cal.note}
${cal.samples >= 2 && cal.accuracy < 0.5 ? "- You have been WRONG more often than right on this class. Lower your confidence and demand stronger evidence." : ""}
${cal.roiBias >= 10 && exec !== "sentinel" ? "- You have been overselling ROI. Discount your upside score." : ""}
${cal.riskBias >= 10 && exec === "sentinel" ? "- You have been UNDER-rating risk. Lower your safety score and raise your concern threshold." : ""}
${cal.effortBias >= 5 && exec === "apex" ? "- You have been under-estimating effort. Assume this will cost more hours than it looks." : ""}`.trim();

      const prompt = `You are ${exec.toUpperCase()}, ${role.title} of MOS.
You own: ${role.owns}.
${role.brief}

${subjectHeader}

${calibrationBrief}

${priorTranscript ? `BOARD DISCUSSION SO FAR (do NOT rubber-stamp — challenge, extend, or push back with reasoning):
${priorTranscript}

` : ""}Deliver YOUR position as a member of the executive committee. Be direct, specific, and short. Do not repeat what others said — build on or challenge it.

Return ONLY valid JSON (no prose, no code fence):
{
  "stance": "agree" | "partial" | "challenge" | "escalate" | "abstain",
  "confidence": 0-100,
  "key_concern": "one sentence — the single most important thing YOUR domain cares about here",
  "rationale": "2-3 sentences of reasoning grounded in your domain",
  "recommendation": "one sentence — what you recommend the board do",
  "score": 0-100 (${role.scoreKey === "risk" ? "SAFETY score: 100 = negligible risk, 0 = catastrophic" : `${role.scoreKey} score: 100 = elite, 0 = unacceptable`})
}`;

      let parsed: Record<string, unknown> = {};
      try {
        const { text } = await generateText({ model: gateway(DEFAULT_MODEL), prompt });
        const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
        parsed = JSON.parse(clean);
      } catch (e) {
        parsed = {
          stance: "abstain", confidence: 0, key_concern: "Model call failed",
          rationale: e instanceof Error ? e.message : "unknown error",
          recommendation: "Retry deliberation", score: 0,
        };
      }

      const stance = String(parsed.stance ?? "abstain");
      const okStance = ["agree", "partial", "challenge", "escalate", "abstain"].includes(stance) ? stance : "abstain";
      const rawConfidence = Math.min(100, Math.max(0, Math.round(Number(parsed.confidence) || 0)));
      const rawScore = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 0)));

      // ---- Auto-adjust based on this exec's historical accuracy & prediction bias.
      let confidence = rawConfidence;
      let score = rawScore;
      const adjustments: string[] = [];
      if (cal.samples >= 2) {
        // Accuracy weight scales how aggressively history bends confidence away from 1.0.
        const accSwing = 0.6 * W.accuracy;
        const confMul = Math.max(0.4, Math.min(1.25, (1 - 0.3 * W.accuracy) + cal.accuracy * accSwing));
        const before = confidence;
        confidence = Math.round(Math.min(100, Math.max(0, confidence * confMul)));
        if (before !== confidence) adjustments.push(`confidence ${before}→${confidence} (accuracy ${Math.round(cal.accuracy * 100)}% ×w${W.accuracy})`);
        const scoreDelta = Math.round(Math.max(-20, Math.min(12, (cal.accuracy - 0.5) * 30 * W.accuracy)));
        if (scoreDelta !== 0) {
          const b = score;
          score = Math.min(100, Math.max(0, score + scoreDelta));
          adjustments.push(`score ${b}→${score} (calibration ${scoreDelta >= 0 ? "+" : ""}${scoreDelta})`);
        }
      }
      // Domain-specific bias corrections, each scaled by its configurable weight.
      if (exec !== "sentinel" && cal.roiBias >= 10 && W.roi > 0) {
        const penalty = Math.min(25, Math.round((cal.roiBias / 2) * W.roi));
        const b = score; score = Math.max(0, score - penalty);
        if (b !== score) adjustments.push(`ROI overshoot penalty −${penalty} (w${W.roi}) ${b}→${score}`);
      }
      if (exec === "sentinel" && cal.riskBias >= 10 && W.risk > 0) {
        const penalty = Math.min(30, Math.round(cal.riskBias * W.risk));
        const b = score; score = Math.max(0, score - penalty);
        if (b !== score) adjustments.push(`safety under-rating penalty −${penalty} (w${W.risk}) ${b}→${score}`);
      }
      if (exec === "apex" && cal.effortBias >= 5 && W.effort > 0) {
        const penalty = Math.min(20, Math.round(cal.effortBias * W.effort));
        const b = score; score = Math.max(0, score - penalty);
        if (b !== score) adjustments.push(`effort under-estimation penalty −${penalty} (w${W.effort}) ${b}→${score}`);
      }


      const key_concern = String(parsed.key_concern ?? "").slice(0, 400);
      const rationale = String(parsed.rationale ?? "").slice(0, 1600);
      const recommendation = String(parsed.recommendation ?? "").slice(0, 400);

      positions[exec] = { stance: okStance, confidence, key_concern, rationale, recommendation, score };

      await context.supabase.from("committee_positions").update({
        stance: okStance, confidence, key_concern, rationale, recommendation,
        scores: {
          [role.scoreKey]: score,
          raw_score: rawScore,
          raw_confidence: rawConfidence,
          calibration: {
            samples: cal.samples,
            accuracy: Math.round(cal.accuracy * 100) / 100,
            roi_bias: Math.round(cal.roiBias * 10) / 10,
            risk_bias: Math.round(cal.riskBias * 10) / 10,
            effort_bias: Math.round(cal.effortBias * 10) / 10,
            adjustments,
          },
        },
        is_streaming: false,
      }).eq("review_id", review.id).eq("executive", exec);
    }


    // ---- CONSENSUS ENGINE ----
    const strategic   = positions.iris?.score ?? 0;
    const operational = positions.apex?.score ?? 0;
    const execution   = positions.katana?.score ?? 0;
    const risk        = positions.sentinel?.score ?? 0; // safety score
    const confidence  = Math.round(execOrder.reduce((s, e) => s + (positions[e]?.confidence ?? 0), 0) / execOrder.length);

    const stances = execOrder.map((e) => positions[e]?.stance);
    const stanceWeight: Record<string, number> = { agree: 100, partial: 65, challenge: 35, escalate: 0, abstain: 50 };
    const alignment = Math.round(stances.reduce((s, st) => s + (stanceWeight[st ?? "abstain"] ?? 50), 0) / stances.length);

    let decision: "approve" | "approve_with_conditions" | "run_pilot" | "request_more_data" | "reject" = "request_more_data";
    let rationale = "";
    const hasEscalation = stances.includes("escalate");
    const anyChallenge = stances.includes("challenge");

    if (hasEscalation || risk < 30) {
      decision = "reject";
      rationale = hasEscalation
        ? "One or more executives escalated. Board declines pending Operator review."
        : `SENTINEL rated risk unacceptable (safety score ${risk}/100). Board declines.`;
    } else if (alignment >= 85 && risk >= 60 && (strategic + operational + execution) / 3 >= 65) {
      decision = "approve";
      rationale = "Board consensus — all pillars clear thresholds and no material challenges.";
    } else if (alignment >= 60 && risk >= 50) {
      decision = anyChallenge ? "approve_with_conditions" : "run_pilot";
      rationale = anyChallenge
        ? "Board approves with conditions raised by the challenging seat."
        : "Board recommends a bounded pilot to de-risk before full commitment.";
    } else {
      decision = "request_more_data";
      rationale = "Alignment or risk clarity insufficient. Board requests more data before deciding.";
    }

    const conditions = execOrder
      .filter((e) => positions[e]?.stance === "challenge" || positions[e]?.stance === "partial")
      .map((e) => ({ from: e, condition: positions[e].key_concern, recommendation: positions[e].recommendation }));

    await context.supabase.from("committee_reviews").update({
      phase: "decided",
      current_speaker: null,
      strategic_score: strategic,
      operational_score: operational,
      execution_score: execution,
      risk_score: risk,
      confidence_score: confidence,
      alignment_score: alignment,
      decision,
      decision_rationale: rationale,
      conditions,
      decided_at: new Date().toISOString(),
    }).eq("id", review.id);

    await auditCommittee(context.supabase, context.userId, "committee.deliberation.run", review.id, {
      stage: "decided",
      decision,
      alignment,
      confidence,
      scores: { strategic, operational, execution, risk },
    });

    // Operational memory — decision recorded for future retrieval.
    {
      const { recordEvent } = await import("@/lib/memory/events.server");
      await recordEvent({
        userId: context.userId,
        subsystem: "committee",
        eventType: "board_decision",
        outcomeClass: "decision",
        summary: `Committee ${decision}: ${String(rationale).slice(0, 240)}`,
        severity: risk < 50 || decision === "reject" ? 4 : 3,
        confidence: Math.max(0, Math.min(1, confidence / 100)),
        context: {
          subject_type: review.subject_type,
          subject_ref: review.subject_id,
          decision,
          alignment,
          scores: { strategic, operational, execution, risk },
        },
        refKind: "committee_review",
        refId: review.id,
        dedupeKey: `committee.decision:${review.id}`,
      });
    }

    return { ok: true, decision, alignment, confidence };
  });

// ---------- OUTCOME (self-correction loop) ----------

export const recordOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    reviewId: string;
    outcome: string;
    predicted_roi_pct?: number;
    actual_roi_pct?: number;
    predicted_effort_hours?: number;
    actual_effort_hours?: number;
    predicted_risk?: number;
    actual_risk?: number;
    notes?: string;
  }) => ({
    reviewId: z.string().uuid().parse(d.reviewId),
    outcome: z.enum(["win", "loss", "partial", "abandoned", "pending"]).parse(d.outcome),
    predicted_roi_pct:      d.predicted_roi_pct      ?? null,
    actual_roi_pct:         d.actual_roi_pct         ?? null,
    predicted_effort_hours: d.predicted_effort_hours ?? null,
    actual_effort_hours:    d.actual_effort_hours    ?? null,
    predicted_risk:         d.predicted_risk         ?? null,
    actual_risk:            d.actual_risk            ?? null,
    notes: d.notes ? String(d.notes).slice(0, 2000) : null,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("committee_outcomes")
      .upsert({
        review_id: data.reviewId,
        user_id: context.userId,
        outcome: data.outcome,
        predicted_roi_pct: data.predicted_roi_pct,
        actual_roi_pct: data.actual_roi_pct,
        predicted_effort_hours: data.predicted_effort_hours,
        actual_effort_hours: data.actual_effort_hours,
        predicted_risk: data.predicted_risk,
        actual_risk: data.actual_risk,
        notes: data.notes,
      }, { onConflict: "review_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await auditCommittee(context.supabase, context.userId, "committee.outcome.record", data.reviewId, {
      outcome: data.outcome,
      predicted_roi_pct: data.predicted_roi_pct,
      actual_roi_pct: data.actual_roi_pct,
      predicted_effort_hours: data.predicted_effort_hours,
      actual_effort_hours: data.actual_effort_hours,
      predicted_risk: data.predicted_risk,
      actual_risk: data.actual_risk,
    });

    // Operational memory + calibration-bias learned pattern.
    {
      const { recordEvent } = await import("@/lib/memory/events.server");
      const { upsertLearnedPattern } = await import("@/lib/memory/patterns.server");
      const outcomeClass =
        data.outcome === "win" ? "success" :
        data.outcome === "loss" || data.outcome === "abandoned" ? "failure" :
        "neutral";
      const eventId = await recordEvent({
        userId: context.userId,
        subsystem: "committee",
        eventType: "outcome_recorded",
        outcomeClass,
        summary: `Committee outcome '${data.outcome}' recorded for review ${data.reviewId.slice(0, 8)}`,
        severity: outcomeClass === "failure" ? 4 : 2,
        confidence: 0.9,
        context: {
          predicted: { roi: data.predicted_roi_pct, effort: data.predicted_effort_hours, risk: data.predicted_risk },
          actual: { roi: data.actual_roi_pct, effort: data.actual_effort_hours, risk: data.actual_risk },
        },
        refKind: "committee_review",
        refId: data.reviewId,
        dedupeKey: `committee.outcome:${data.reviewId}`,
      });

      // Only record calibration bias when we have both sides of a metric.
      const roiBias = data.predicted_roi_pct != null && data.actual_roi_pct != null
        ? data.predicted_roi_pct - data.actual_roi_pct : null;
      const effortBias = data.predicted_effort_hours != null && data.actual_effort_hours != null
        ? data.actual_effort_hours - data.predicted_effort_hours : null;
      const riskBias = data.predicted_risk != null && data.actual_risk != null
        ? data.actual_risk - data.predicted_risk : null;

      if (roiBias != null || effortBias != null || riskBias != null) {
        await upsertLearnedPattern({
          userId: context.userId,
          subjectKey: "committee.forecast",
          patternType: "calibration_bias",
          summary: `Prediction vs actual: ROI Δ=${roiBias ?? "?"}%, effort Δ=${effortBias ?? "?"}h, risk Δ=${riskBias ?? "?"}.`,
          detail: { roi_bias: roiBias, effort_bias: effortBias, risk_bias: riskBias, review_id: data.reviewId },
          evidenceEventIds: eventId ? [eventId] : [],
          outcomeDelta: outcomeClass === "success" ? "success" : outcomeClass === "failure" ? "failure" : "neutral",
          observationConfidence: 0.7,
        });
      }
    }
    return row;
  });
