// Canonical KATANA task-outcome classification.
// Single source of truth for "did this task actually execute successfully?"
// Used by the learning engine, telemetry, revenue dashboard, and workflow
// outcome logic. Do NOT inline these string checks anywhere else — import
// from this module so blocked/unavailable states never masquerade as success.

export type TaskOutcomeClass =
  | "execution_success"       // capability actually ran and produced output
  | "execution_failure"       // capability ran and failed
  | "provider_block"          // capability_unavailable / no provider
  | "operator_block"          // waiting_on_operator / intervention_required
  | "infrastructure_block"    // generic blocked (dependency, security)
  | "cancellation"            // operator cancelled
  | "in_progress"             // not yet terminal
  | "unknown";

export function classifyTaskOutcome(task: {
  status: string;
  error?: string | null;
  output?: unknown;
}): TaskOutcomeClass {
  const s = (task.status ?? "").toLowerCase();
  const err = (task.error ?? "").toLowerCase();

  if (s === "completed") return "execution_success";
  if (s === "completed_with_warnings") {
    // Only counts as success when the capability actually executed.
    // Provider-unavailable warnings must NOT be treated as success.
    if (err.startsWith("capability_unavailable") || err.includes("no provider")) {
      return "provider_block";
    }
    const out = task.output as { production_package_ready?: boolean; executed?: boolean } | null | undefined;
    if (out && out.production_package_ready === true && out.executed !== true) {
      return "provider_block";
    }
    return "execution_success";
  }
  if (s === "blocked") {
    if (err.startsWith("capability_unavailable") || err.includes("no provider")) {
      return "provider_block";
    }
    return "infrastructure_block";
  }
  if (s === "waiting_on_operator" || s === "intervention_required") return "operator_block";
  if (s === "failed") return "execution_failure";
  if (s === "cancelled" || s === "rolled_back") return "cancellation";
  if (["draft", "pending_security_review", "queued", "ready", "waiting_on_dependency", "running", "retrying", "waiting_for_provider"].includes(s)) {
    return "in_progress";
  }
  return "unknown";
}

export const TERMINAL_STATUSES = [
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled",
  "rolled_back",
  "blocked", // blocked is terminal for workflow-outcome purposes (needs operator to unblock)
] as const;

export function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isExecutionSuccess(cls: TaskOutcomeClass): boolean {
  return cls === "execution_success";
}
export function isExecutionFailure(cls: TaskOutcomeClass): boolean {
  return cls === "execution_failure";
}
export function isBlock(cls: TaskOutcomeClass): boolean {
  return cls === "provider_block" || cls === "operator_block" || cls === "infrastructure_block";
}

export type WorkflowOutcome =
  | "successful"
  | "successful_with_warnings"
  | "partially_completed"
  | "blocked"
  | "failed"
  | "cancelled"
  | "in_progress";

export function classifyWorkflow(tasks: Array<{ status: string; error?: string | null; output?: unknown }>): WorkflowOutcome {
  if (!tasks.length) return "in_progress";
  const classes = tasks.map(classifyTaskOutcome);
  if (classes.some((c) => c === "in_progress")) return "in_progress";

  const successes = classes.filter(isExecutionSuccess).length;
  const failures = classes.filter(isExecutionFailure).length;
  const blocks = classes.filter(isBlock).length;
  const cancels = classes.filter((c) => c === "cancellation").length;
  const total = classes.length;

  if (blocks > 0 && successes > 0) return "partially_completed";
  if (blocks > 0) return "blocked";
  if (failures > 0 && successes > 0) return "partially_completed";
  if (failures > 0) return "failed";
  if (cancels === total) return "cancelled";
  if (successes + cancels === total && successes > 0) {
    // if any completed_with_warnings existed, callers may downgrade — keep simple here
    return "successful";
  }
  return "in_progress";
}
