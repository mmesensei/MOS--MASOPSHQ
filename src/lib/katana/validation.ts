// KATANA Validation Gates — Phase 5.
// Verified completion, not attempted completion.
// Post-execution checks that a task's outputs meet minimum operational
// integrity before status advances to `completed`. If any gate fails the
// task should route to `completed_with_warnings` or `blocked` — never
// silently `completed`.

import type { AdapterResult } from "./providers/capabilities";

export type ValidationSeverity = "info" | "warning" | "critical";

export interface ValidationIssue {
  gate: string;
  severity: ValidationSeverity;
  message: string;
}

export interface ValidationOutcome {
  passed: boolean;                 // no critical issues
  has_warnings: boolean;
  issues: ValidationIssue[];
  verified_completion: boolean;    // true only when passed AND result.available AND output present
}

export interface ValidationInputs {
  task_kind: string;
  requires_output: boolean;
  expected_output_keys?: string[]; // any missing → critical
  result: AdapterResult;
}

function outputToRecord(o: unknown): Record<string, unknown> | null {
  if (o && typeof o === "object" && !Array.isArray(o)) return o as Record<string, unknown>;
  return null;
}

export function validateExecution(inputs: ValidationInputs): ValidationOutcome {
  const issues: ValidationIssue[] = [];
  const { result } = inputs;

  if (!result.available) {
    issues.push({
      gate: "provider_availability",
      severity: "critical",
      message: `Provider unavailable: ${result.warning ?? "no provider"}`,
    });
  }

  const rec = outputToRecord(result.output);
  if (inputs.requires_output && !rec) {
    issues.push({
      gate: "output_present",
      severity: "critical",
      message: "Task requires structured output but adapter returned none",
    });
  }

  if (rec && inputs.expected_output_keys?.length) {
    for (const key of inputs.expected_output_keys) {
      if (!(key in rec) || rec[key] == null || rec[key] === "") {
        issues.push({
          gate: `expected_field:${key}`,
          severity: "critical",
          message: `Expected output field '${key}' is missing or empty`,
        });
      }
    }
  }

  if (result.warning && result.available) {
    issues.push({
      gate: "adapter_warning",
      severity: "warning",
      message: result.warning,
    });
  }

  if (typeof result.duration_ms === "number" && result.duration_ms > 5 * 60_000) {
    issues.push({
      gate: "latency_budget",
      severity: "warning",
      message: `Execution took ${(result.duration_ms / 1000).toFixed(1)}s`,
    });
  }

  const criticals = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const passed = criticals === 0;

  return {
    passed,
    has_warnings: warnings > 0,
    issues,
    verified_completion: passed && !!result.available && (!inputs.requires_output || !!rec),
  };
}

// Default expected outputs by task_kind — extend as new capabilities are added.
export function defaultExpectations(task_kind: string): { requires_output: boolean; expected_output_keys?: string[] } {
  const k = task_kind.toLowerCase();
  if (k === "workflow_plan" || k.includes("outline")) return { requires_output: true, expected_output_keys: ["text"] };
  if (k.includes("draft") || k.includes("content") || k.includes("caption") || k.includes("hook")) {
    return { requires_output: true, expected_output_keys: ["text"] };
  }
  if (k.includes("review") || k.includes("gate") || k.includes("compliance")) {
    return { requires_output: true, expected_output_keys: ["text"] };
  }
  // Non-text-producing stubbed capabilities: presence check only
  return { requires_output: false };
}
