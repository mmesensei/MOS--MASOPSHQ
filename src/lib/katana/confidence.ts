// KATANA Confidence Model — Phase 5.
// Deterministic, explainable confidence assessment used to inform (never
// replace) execution decisions. All inputs are numeric or booleans derived
// from operational signals; there is no LLM in this path.
//
// Scale: 0.0 (do not run) .. 1.0 (very high confidence).
// A confidence result is composed of (score, factors[]) so operators and the
// dashboard can see WHY a task is confident or shaky.

export interface ConfidenceFactor {
  key: string;
  delta: number;         // signed contribution to score (roughly -0.3..+0.2 range)
  reason: string;        // one short human-readable line
}

export interface ConfidenceResult {
  score: number;                // clamped 0..1
  label: "very_low" | "low" | "moderate" | "high" | "very_high";
  factors: ConfidenceFactor[];
  should_defer: boolean;        // score < 0.25 AND recoverable signal
  should_block: boolean;        // score == 0 (kill switch / hard block)
}

export interface ConfidenceInputs {
  // Task readiness
  workflow_complete: boolean;           // required inputs present
  dependencies_all_completed: boolean;  // depends_on resolved
  attempt_count: number;                // 1 = first try
  max_attempts: number;
  risk_level: "low" | "moderate" | "high" | "critical" | string;
  requires_approval: boolean;

  // External signals
  provider_availability: number | null; // 0..1, null when unknown
  provider_consecutive_failures: number | null;
  sentinel_allowed: boolean;
  sentinel_action?: "allow" | "warn" | "throttle" | "block";

  // Historical / memory
  historical_success_rate: number | null; // 0..1 for same task_kind, null when no data
  historical_sample_size: number;         // number of prior observations
  similar_pattern_confidence: number | null; // 0..1 from learned_patterns, null when none
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function computeConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const factors: ConfidenceFactor[] = [];
  let score = 0.6; // neutral starting prior

  if (!inputs.sentinel_allowed || inputs.sentinel_action === "block") {
    factors.push({ key: "sentinel_block", delta: -0.6, reason: "SENTINEL denies execution" });
    return {
      score: 0,
      label: "very_low",
      factors,
      should_defer: false,
      should_block: true,
    };
  }
  if (inputs.sentinel_action === "throttle") {
    factors.push({ key: "sentinel_throttle", delta: -0.15, reason: "SENTINEL throttling in effect" });
    score -= 0.15;
  } else if (inputs.sentinel_action === "warn") {
    factors.push({ key: "sentinel_warn", delta: -0.05, reason: "SENTINEL warning active" });
    score -= 0.05;
  }

  if (inputs.workflow_complete) {
    factors.push({ key: "inputs_ready", delta: 0.05, reason: "Required inputs present" });
    score += 0.05;
  } else {
    factors.push({ key: "inputs_missing", delta: -0.25, reason: "Required inputs missing" });
    score -= 0.25;
  }

  if (inputs.dependencies_all_completed) {
    factors.push({ key: "deps_ready", delta: 0.05, reason: "All dependencies completed" });
    score += 0.05;
  } else {
    factors.push({ key: "deps_pending", delta: -0.2, reason: "Dependencies not yet completed" });
    score -= 0.2;
  }

  // Retry penalty grows with each attempt
  if (inputs.attempt_count > 1) {
    const penalty = Math.min(0.05 * (inputs.attempt_count - 1), 0.2);
    factors.push({
      key: "retry_penalty",
      delta: -penalty,
      reason: `Attempt ${inputs.attempt_count}/${inputs.max_attempts} — degrading confidence`,
    });
    score -= penalty;
  }

  // Risk shading
  const riskDelta = inputs.risk_level === "critical" ? -0.15
    : inputs.risk_level === "high" ? -0.08
    : inputs.risk_level === "moderate" ? -0.03
    : 0;
  if (riskDelta) {
    factors.push({ key: `risk_${inputs.risk_level}`, delta: riskDelta, reason: `Risk level = ${inputs.risk_level}` });
    score += riskDelta;
  }

  // Provider health
  if (inputs.provider_availability != null) {
    const avail = inputs.provider_availability;
    if (avail >= 0.9) {
      factors.push({ key: "provider_healthy", delta: 0.1, reason: `Provider availability ${(avail * 100).toFixed(0)}%` });
      score += 0.1;
    } else if (avail >= 0.6) {
      factors.push({ key: "provider_degraded", delta: -0.05, reason: `Provider availability ${(avail * 100).toFixed(0)}%` });
      score -= 0.05;
    } else {
      factors.push({ key: "provider_unhealthy", delta: -0.2, reason: `Provider availability ${(avail * 100).toFixed(0)}%` });
      score -= 0.2;
    }
  }
  if ((inputs.provider_consecutive_failures ?? 0) >= 3) {
    factors.push({
      key: "provider_streak_failures",
      delta: -0.1,
      reason: `${inputs.provider_consecutive_failures} consecutive provider failures`,
    });
    score -= 0.1;
  }

  // Historical success rate (require ≥3 samples to weight fully)
  if (inputs.historical_success_rate != null && inputs.historical_sample_size >= 3) {
    const hs = inputs.historical_success_rate;
    const weight = Math.min(inputs.historical_sample_size / 20, 1); // grows to 1 at n=20
    const delta = (hs - 0.5) * 0.3 * weight; // ±0.15 max
    factors.push({
      key: "history",
      delta,
      reason: `Historical success ${(hs * 100).toFixed(0)}% over ${inputs.historical_sample_size} runs`,
    });
    score += delta;
  } else if (inputs.historical_sample_size > 0) {
    factors.push({
      key: "history_low_signal",
      delta: -0.02,
      reason: `Insufficient historical data (n=${inputs.historical_sample_size})`,
    });
    score -= 0.02;
  }

  // Learned pattern nudge
  if (inputs.similar_pattern_confidence != null) {
    const delta = (inputs.similar_pattern_confidence - 0.5) * 0.1;
    factors.push({
      key: "learned_pattern",
      delta,
      reason: `Similar pattern confidence ${(inputs.similar_pattern_confidence * 100).toFixed(0)}%`,
    });
    score += delta;
  }

  score = clamp01(score);
  const label: ConfidenceResult["label"] =
    score >= 0.85 ? "very_high"
    : score >= 0.65 ? "high"
    : score >= 0.4  ? "moderate"
    : score >= 0.2  ? "low"
    : "very_low";

  return {
    score,
    label,
    factors,
    should_defer: score > 0 && score < 0.25 && (inputs.workflow_complete === false || inputs.dependencies_all_completed === false),
    should_block: score === 0,
  };
}
