// Calibration dashboard + weight controls — admin-only.
// Aggregates prediction accuracy and systematic bias per executive × subject_type
// from committee_outcomes + committee_positions, and exposes tuneable weights that
// runDeliberation uses to scale historical influence on confidence/score.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

export const EXECS = ["iris", "apex", "katana", "sentinel"] as const;
export type Exec = (typeof EXECS)[number];
export const SUBJECT_TYPES = ["opportunity", "mission", "manual", "sop", "system"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export type CalibrationWeights = {
  roi_overshoot_weight: number;
  risk_underrating_weight: number;
  effort_underestimation_weight: number;
  accuracy_weight: number;
};
export const DEFAULT_WEIGHTS: CalibrationWeights = {
  roi_overshoot_weight: 1,
  risk_underrating_weight: 1,
  effort_underestimation_weight: 1,
  accuracy_weight: 1,
};

export type CalibrationCell = {
  executive: Exec;
  subject_type: SubjectType;
  samples: number;
  accuracy: number;         // 0..1
  roi_bias: number;         // + = ROI overestimated
  risk_bias: number;        // + = risk underestimated (SENTINEL blind spot)
  effort_bias: number;      // + = effort underestimated (APEX blind spot)
  avg_confidence: number;   // 0..100
  overconfidence: number;   // avg_confidence - accuracy*100 (positive = overconfident)
  systematic_flags: string[];
};

// --- Weights ---

export const getCalibrationWeights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CalibrationWeights> => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("calibration_settings")
      .select("roi_overshoot_weight, risk_underrating_weight, effort_underestimation_weight, accuracy_weight")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ...DEFAULT_WEIGHTS };
    return {
      roi_overshoot_weight: Number(data.roi_overshoot_weight),
      risk_underrating_weight: Number(data.risk_underrating_weight),
      effort_underestimation_weight: Number(data.effort_underestimation_weight),
      accuracy_weight: Number(data.accuracy_weight),
    };
  });

const weightSchema = z.object({
  roi_overshoot_weight: z.number().min(0).max(3),
  risk_underrating_weight: z.number().min(0).max(3),
  effort_underestimation_weight: z.number().min(0).max(3),
  accuracy_weight: z.number().min(0).max(3),
});

export const updateCalibrationWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CalibrationWeights) => weightSchema.parse(d))
  .handler(async ({ data, context }): Promise<CalibrationWeights> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("calibration_settings")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    // Operator correction — record as memory so future deliberations see it.
    const { recordEvent } = await import("@/lib/memory/events.server");
    await recordEvent({
      userId: context.userId,
      subsystem: "calibration",
      eventType: "weights_updated",
      outcomeClass: "override",
      summary: `Operator adjusted calibration weights (ROI ${data.roi_overshoot_weight}, risk ${data.risk_underrating_weight}, effort ${data.effort_underestimation_weight}, acc ${data.accuracy_weight}).`,
      severity: 2,
      confidence: 1,
      context: data as unknown as Record<string, unknown>,
    });
    return data;
  });

// --- Summary ---

export const getCalibrationSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: outcomes, error: oErr } = await context.supabase
      .from("committee_outcomes")
      .select("review_id, outcome, actual_roi_pct, predicted_roi_pct, actual_risk, predicted_risk, actual_effort_hours, predicted_effort_hours")
      .eq("user_id", context.userId);
    if (oErr) throw new Error(oErr.message);
    if (!outcomes || outcomes.length === 0) {
      return { cells: [] as CalibrationCell[], totals: { outcomes: 0 } };
    }

    const reviewIds = outcomes.map((o) => o.review_id);
    const [{ data: reviews, error: rErr }, { data: positions, error: pErr }] = await Promise.all([
      context.supabase.from("committee_reviews").select("id, subject_type").in("id", reviewIds),
      context.supabase.from("committee_positions").select("review_id, executive, stance, confidence, scores").in("review_id", reviewIds),
    ]);
    if (rErr) throw new Error(rErr.message);
    if (pErr) throw new Error(pErr.message);

    const subjectByReview = new Map((reviews ?? []).map((r) => [r.id as string, r.subject_type as string]));
    const outcomeByReview = new Map(outcomes.map((o) => [o.review_id as string, o]));

    // Aggregate per (exec, subject_type)
    type Acc = {
      samples: number; correct: number; confSum: number;
      roiSum: number; roiN: number;
      riskSum: number; riskN: number;
      effSum: number; effN: number;
    };
    const key = (e: string, s: string) => `${e}::${s}`;
    const map = new Map<string, Acc>();

    for (const p of positions ?? []) {
      const subject = subjectByReview.get(p.review_id as string);
      if (!subject || !SUBJECT_TYPES.includes(subject as SubjectType)) continue;
      if (!EXECS.includes(p.executive as Exec)) continue;
      const o = outcomeByReview.get(p.review_id as string);
      if (!o) continue;
      const k = key(p.executive as string, subject);
      const a = map.get(k) ?? { samples: 0, correct: 0, confSum: 0, roiSum: 0, roiN: 0, riskSum: 0, riskN: 0, effSum: 0, effN: 0 };
      a.samples++;
      a.confSum += Number(p.confidence) || 0;
      const positive = p.stance === "agree" || p.stance === "partial";
      const negative = p.stance === "challenge" || p.stance === "escalate";
      const win = o.outcome === "win";
      const bad = o.outcome === "loss" || o.outcome === "abandoned";
      if ((positive && win) || (negative && bad) || (p.stance === "partial" && o.outcome === "partial")) a.correct++;
      if (o.predicted_roi_pct != null && o.actual_roi_pct != null && positive) {
        a.roiSum += Number(o.predicted_roi_pct) - Number(o.actual_roi_pct); a.roiN++;
      }
      if (o.predicted_risk != null && o.actual_risk != null) {
        a.riskSum += Number(o.actual_risk) - Number(o.predicted_risk); a.riskN++;
      }
      if (o.predicted_effort_hours != null && o.actual_effort_hours != null) {
        a.effSum += Number(o.actual_effort_hours) - Number(o.predicted_effort_hours); a.effN++;
      }
      map.set(k, a);
    }

    const cells: CalibrationCell[] = [];
    for (const [k, a] of map.entries()) {
      const [exec, subject] = k.split("::") as [Exec, SubjectType];
      const accuracy = a.samples ? a.correct / a.samples : 0;
      const avgConf = a.samples ? a.confSum / a.samples : 0;
      const roi = a.roiN ? a.roiSum / a.roiN : 0;
      const risk = a.riskN ? a.riskSum / a.riskN : 0;
      const eff = a.effN ? a.effSum / a.effN : 0;
      const flags: string[] = [];
      if (a.samples >= 3 && accuracy < 0.45) flags.push("low-accuracy");
      if (avgConf - accuracy * 100 >= 20 && a.samples >= 3) flags.push("overconfident");
      if (roi >= 10 && exec !== "sentinel") flags.push("roi-overshoot");
      if (risk >= 10 && exec === "sentinel") flags.push("risk-underrating");
      if (eff >= 5 && exec === "apex") flags.push("effort-underestimation");
      cells.push({
        executive: exec,
        subject_type: subject,
        samples: a.samples,
        accuracy: Math.round(accuracy * 1000) / 1000,
        roi_bias: Math.round(roi * 10) / 10,
        risk_bias: Math.round(risk * 10) / 10,
        effort_bias: Math.round(eff * 10) / 10,
        avg_confidence: Math.round(avgConf),
        overconfidence: Math.round(avgConf - accuracy * 100),
        systematic_flags: flags,
      });
    }

    return { cells, totals: { outcomes: outcomes.length } };
  });
