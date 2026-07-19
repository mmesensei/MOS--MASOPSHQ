// Developer-level verification of KATANA task-outcome truth rules.
// Run with: bun run scripts/verify-task-outcomes.ts
// Guards the seven required invariants from the Learning Truth micro-strike.
import {
  classifyTaskOutcome,
  classifyWorkflow,
} from "../src/lib/katana/task-outcomes";

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name}`, detail ?? "");
  }
}

console.log("Task-outcome classification:");
check(
  "1. completed task -> execution_success",
  classifyTaskOutcome({ status: "completed" }) === "execution_success",
);
check(
  "2. blocked transcription (capability_unavailable) is provider_block, not success",
  classifyTaskOutcome({
    status: "blocked",
    error: "capability_unavailable: no provider",
    output: { production_package_ready: true },
  }) === "provider_block",
);
check(
  "3. blocked transcription is NOT execution_failure",
  classifyTaskOutcome({
    status: "blocked",
    error: "capability_unavailable: transcription missing",
  }) !== "execution_failure",
);
check(
  "4. failed task -> execution_failure",
  classifyTaskOutcome({ status: "failed", error: "boom" }) === "execution_failure",
);
{
  const cls = classifyTaskOutcome({ status: "cancelled" });
  check(
    "5. cancelled task -> cancellation (not success/failure)",
    cls === "cancellation" && cls !== ("execution_success" as string) && cls !== ("execution_failure" as string),
    cls,
  );
}
check(
  "completed_with_warnings + provider-unavailable warning -> provider_block",
  classifyTaskOutcome({
    status: "completed_with_warnings",
    output: { production_package_ready: true },
    error: "capability_unavailable: no renderer",
  }) === "provider_block",
);
check(
  "completed_with_warnings after real execution stays execution_success",
  classifyTaskOutcome({
    status: "completed_with_warnings",
    output: { executed: true, warnings: ["slow"] },
  }) === "execution_success",
);

console.log("\nWorkflow classification:");
check(
  "6. completed + blocked -> partially_completed",
  classifyWorkflow([
    { status: "completed" },
    { status: "blocked", error: "capability_unavailable: no provider" },
  ]) === "partially_completed",
);
check(
  "blocked-only workflow -> blocked",
  classifyWorkflow([{ status: "blocked", error: "capability_unavailable" }]) === "blocked",
);
check(
  "7. all completed -> successful",
  classifyWorkflow([{ status: "completed" }, { status: "completed" }]) === "successful",
);
check(
  "in-progress task keeps workflow in_progress",
  classifyWorkflow([{ status: "completed" }, { status: "running" }]) === "in_progress",
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll truth invariants hold.");
