// KATANA Recovery Intelligence — Phase 5.
// Deterministic error-to-recovery mapping. Given a failure, decide whether
// to retry (with backoff), try an alternate provider, defer until a
// prerequisite settles, escalate to the operator, or gracefully terminate.
//
// Every decision includes a reason string so the runner can persist it on
// the task and the learning layer can attribute future outcomes.

export type RecoveryAction =
  | "retry_backoff"
  | "retry_alternate_provider"
  | "defer_dependency"
  | "escalate_operator"
  | "graceful_terminate"
  | "hard_fail";

export type ErrorKind =
  | "timeout"
  | "auth"
  | "quota"
  | "5xx"
  | "malformed"
  | "unsupported"
  | "validation"
  | "sentinel_block"
  | "dependency_missing"
  | "unknown";

export interface RecoveryDecision {
  action: RecoveryAction;
  reason: string;
  backoff_ms: number | null;
  requeue_status: "retrying" | "waiting_on_dependency" | "waiting_on_operator" | "blocked" | "failed" | "cancelled";
  next_provider_hint?: string;
}

export interface RecoveryInputs {
  error_kind: ErrorKind;
  message: string;
  attempt_count: number;
  max_attempts: number;
  provider_consecutive_failures: number | null;
  had_partial_output: boolean;
  is_critical_workflow_step: boolean;
}

export function classifyErrorKind(message: string): ErrorKind {
  const m = (message ?? "").toLowerCase();
  if (m.includes("timeout") || m.includes("etimedout") || m.includes("timed out")) return "timeout";
  if (m.includes("401") || m.includes("unauthor") || m.includes("forbidden") || m.includes("403")) return "auth";
  if (m.includes("429") || m.includes("quota") || m.includes("rate limit")) return "quota";
  if (m.includes("500") || m.includes("502") || m.includes("503") || m.includes("504") || m.includes("bad gateway")) return "5xx";
  if (m.includes("json") || m.includes("parse") || m.includes("unexpected token")) return "malformed";
  if (m.includes("sentinel_block") || m.includes("kill switch")) return "sentinel_block";
  if (m.includes("dependency") || m.includes("depends_on")) return "dependency_missing";
  if (m.includes("no provider") || m.includes("capability_unavailable") || m.includes("unsupported")) return "unsupported";
  if (m.includes("validation") || m.includes("invalid")) return "validation";
  return "unknown";
}

export function decideRecovery(inputs: RecoveryInputs): RecoveryDecision {
  const canRetry = inputs.attempt_count < inputs.max_attempts;
  const backoff = (n: number) => Math.min(60_000 * 2 ** Math.max(0, inputs.attempt_count - 1), 30 * 60_000) * n;

  switch (inputs.error_kind) {
    case "sentinel_block":
      return {
        action: "hard_fail",
        reason: "SENTINEL denied execution — routing to blocked; requires operator/SENTINEL clearance.",
        backoff_ms: null,
        requeue_status: "blocked",
      };

    case "auth":
      return {
        action: "escalate_operator",
        reason: "Provider auth failure — credentials likely invalid; retry will not help.",
        backoff_ms: null,
        requeue_status: "waiting_on_operator",
      };

    case "quota":
      return canRetry
        ? { action: "retry_backoff", reason: "Provider quota hit — retry with longer backoff.", backoff_ms: backoff(3), requeue_status: "retrying" }
        : { action: "escalate_operator", reason: "Quota exhausted after max attempts.", backoff_ms: null, requeue_status: "waiting_on_operator" };

    case "timeout":
    case "5xx":
      return canRetry
        ? { action: "retry_backoff", reason: `${inputs.error_kind} — transient; retrying with backoff.`, backoff_ms: backoff(1), requeue_status: "retrying" }
        : { action: "escalate_operator", reason: `${inputs.error_kind} persisted after max attempts.`, backoff_ms: null, requeue_status: "waiting_on_operator" };

    case "malformed":
      return canRetry
        ? { action: "retry_backoff", reason: "Malformed provider response — retrying.", backoff_ms: backoff(1), requeue_status: "retrying" }
        : { action: "escalate_operator", reason: "Provider returned malformed output repeatedly.", backoff_ms: null, requeue_status: "waiting_on_operator" };

    case "unsupported":
      return {
        action: "graceful_terminate",
        reason: "Capability unavailable — no provider configured. Task routed to blocked, production package preserved.",
        backoff_ms: null,
        requeue_status: "blocked",
      };

    case "dependency_missing":
      return {
        action: "defer_dependency",
        reason: "Dependency not yet satisfied — deferring until upstream completes.",
        backoff_ms: null,
        requeue_status: "waiting_on_dependency",
      };

    case "validation":
      return {
        action: inputs.is_critical_workflow_step ? "escalate_operator" : "graceful_terminate",
        reason: "Output failed validation gates — completion not verified.",
        backoff_ms: null,
        requeue_status: inputs.is_critical_workflow_step ? "waiting_on_operator" : "blocked",
      };

    default:
      // Unknown: prefer retry once, then alternate provider if we have failure streak, else escalate.
      if (canRetry && (inputs.provider_consecutive_failures ?? 0) < 3) {
        return { action: "retry_backoff", reason: "Unknown error — one guarded retry.", backoff_ms: backoff(1), requeue_status: "retrying" };
      }
      if ((inputs.provider_consecutive_failures ?? 0) >= 3) {
        return {
          action: "retry_alternate_provider",
          reason: "Provider unstable (≥3 consecutive failures) — request alternate binding.",
          backoff_ms: backoff(1),
          requeue_status: "retrying",
          next_provider_hint: "alternate",
        };
      }
      return {
        action: "escalate_operator",
        reason: "Unknown error and no safe automatic recovery — escalating.",
        backoff_ms: null,
        requeue_status: "waiting_on_operator",
      };
  }
}
