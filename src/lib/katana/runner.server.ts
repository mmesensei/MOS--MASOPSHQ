// KATANA execution runner — server-only. Claims ready tasks, runs them
// through the appropriate provider adapter, records cost + history, and
// advances state per the 15-state lifecycle guard.
//
// Never import from client-reachable modules at their top level; load
// supabaseAdmin inside functions.

import { aiTextAdapter } from "./providers/ai";
import { STUB_ADAPTERS, type AdapterResult, type Capability } from "./providers/capabilities";
import { recordEvent } from "@/lib/memory/events.server";
import { upsertLearnedPattern } from "@/lib/memory/patterns.server";
import { evaluateGuard, recordCost, observeProviderCall } from "@/lib/sentinel/runtime.server";
import { computeConfidence, type ConfidenceResult } from "./confidence";
import { collectSignals } from "./signals.server";
import { defaultExpectations, validateExecution, type ValidationOutcome } from "./validation";
import { classifyErrorKind, decideRecovery } from "./recovery";

const RUNNER_ID = `runner-${Math.random().toString(36).slice(2, 8)}`;
const MAX_BATCH = 3;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

interface Task {
  id: string;
  user_id: string;
  mission_id: string | null;
  opportunity_id: string | null;
  agent: "iris" | "apex" | "katana" | "sentinel";
  task_kind: string;
  status: string;
  input: Record<string, unknown>;
  depends_on: string[];
  attempt_count: number;
  max_attempts: number;
  estimated_cost_cents: number;
  requires_approval: boolean;
  risk_level: string;
  execution_history: unknown[];
}

// Route task_kind to a capability. Everything not explicitly mapped falls
// back to ai_text (safe, cheap default).
function capabilityFor(task_kind: string): Capability {
  const k = task_kind.toLowerCase();
  if (k.includes("transcri")) return "transcription";
  if (k.includes("render") || k.includes("video_export")) return "render";
  if (k.includes("publish") || k.includes("post_to_")) return "publish";
  if (k.includes("caption")) return "caption_generation";
  if (k.includes("scene")) return "scene_detection";
  if (k.includes("image_analy")) return "image_analysis";
  if (k.includes("video_analy")) return "video_analysis";
  if (k.includes("translate")) return "translation";
  return "ai_text";
}

async function runAdapter(
  task: Task,
  cap: Capability,
): Promise<AdapterResult> {
  const excluded = ((task.input as Record<string, unknown>)._exclude_providers as string[] | undefined) ?? [];

  if (cap === "ai_text") {
    // Phase 6 — request-scoped provider exclusion for alternate-provider recovery.
    // If the only configured ai_text provider is excluded, truthfully report
    // capability_unavailable so the runner routes to blocked (no fake fallback).
    if (excluded.includes(aiTextAdapter.provider)) {
      return {
        available: false,
        provider: aiTextAdapter.provider,
        warning: `no_alternate_provider_available: ${aiTextAdapter.provider} excluded and no alternate configured`,
      };
    }
    const promptSource =
      (task.input.prompt as string | undefined) ??
      (task.input.brief as string | undefined) ??
      JSON.stringify(task.input);
    return aiTextAdapter.run(
      {
        agent: task.agent,
        task_kind: task.task_kind,
        prompt: promptSource,
        context: task.input.context as string | undefined,
      },
      { userId: task.user_id },
    );
  }
  return STUB_ADAPTERS[cap].run(task.input, { userId: task.user_id });
}

async function releaseStaleLocks() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();
  await supabaseAdmin
    .from("katana_agent_tasks")
    .update({ locked_at: null, locked_by: null, status: "ready" })
    .eq("status", "running")
    .lt("locked_at", cutoff);
}

async function promoteQueuedToReady() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: queued } = await supabaseAdmin
    .from("katana_agent_tasks")
    .select("id, depends_on, requires_approval")
    .in("status", ["queued", "waiting_on_dependency"])
    .limit(50);
  if (!queued?.length) return;

  for (const t of queued) {
    if (t.requires_approval) continue;
    const deps = (t.depends_on as string[]) ?? [];
    if (deps.length) {
      const { data: pending } = await supabaseAdmin
        .from("katana_agent_tasks")
        .select("id, status")
        .in("id", deps);
      const unresolved = (pending ?? []).some(
        (d) => !["completed", "completed_with_warnings"].includes(d.status),
      );
      if (unresolved) continue;
    }
    await supabaseAdmin
      .from("katana_agent_tasks")
      .update({ status: "ready" })
      .eq("id", t.id)
      .in("status", ["queued", "waiting_on_dependency"]);
  }
}

async function claimBatch(): Promise<Task[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: candidates } = await supabaseAdmin
    .from("katana_agent_tasks")
    .select("id")
    .eq("status", "ready")
    .is("locked_at", null)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);
  if (!candidates?.length) return [];

  const claimed: Task[] = [];
  for (const c of candidates) {
    const { data } = await supabaseAdmin
      .from("katana_agent_tasks")
      .update({
        status: "running",
        locked_at: new Date().toISOString(),
        locked_by: RUNNER_ID,
        started_at: new Date().toISOString(),
        attempt_count: 1, // trigger sees the row after update; we compute below
      })
      .eq("id", c.id)
      .eq("status", "ready")
      .is("locked_at", null)
      .select("*")
      .maybeSingle();
    if (data) claimed.push(data as unknown as Task);
  }
  return claimed;
}

async function completeTask(
  task: Task,
  result: AdapterResult,
  validation: ValidationOutcome,
  confidence: ConfidenceResult,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const finalStatus: "completed" | "completed_with_warnings" =
    validation.has_warnings ? "completed_with_warnings" : "completed";

  const history = [
    ...(task.execution_history ?? []),
    {
      at: new Date().toISOString(),
      runner: RUNNER_ID,
      attempt: task.attempt_count,
      duration_ms: result.duration_ms ?? null,
      provider: result.provider ?? null,
      available: result.available,
      warning: result.warning ?? null,
      confidence_score: confidence.score,
      confidence_label: confidence.label,
      confidence_factors: confidence.factors,
      validation: {
        passed: validation.passed,
        verified_completion: validation.verified_completion,
        issues: validation.issues,
      },
      final_status: finalStatus,
    },
  ];

  await supabaseAdmin
    .from("katana_agent_tasks")
    .update({
      status: finalStatus,
      output: (result.output as never) ?? { note: "ok" },
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      actual_cost_cents: (task as unknown as { actual_cost_cents: number }).actual_cost_cents +
        (result.cost_cents ?? 0),
      execution_history: history as never,
    })
    .eq("id", task.id)
    .eq("user_id", task.user_id); // defence-in-depth ownership guard

  // Cost is recorded exclusively through sentinel_cost_ledger further down
  // the pipeline (via recordCost with a dedupeKey). Legacy katana_cost_ledger
  // writes were removed during V1.1 Phase 7 consolidation to prevent
  // double-counting. Historical rows in katana_cost_ledger are preserved
  // read-only for audit; new writes go to sentinel_cost_ledger only.


  await recordEvent({
    userId: task.user_id,
    executiveId: task.agent,
    subsystem: "katana.runner",
    eventType: validation.has_warnings ? "execution_success_with_warnings" : "execution_success",
    outcomeClass: "success",
    summary: `${task.agent}/${task.task_kind} ${finalStatus} via ${result.provider ?? "unknown"} (conf ${confidence.score.toFixed(2)})`,
    severity: 2,
    confidence: confidence.score,
    context: {
      task_kind: task.task_kind,
      attempt: task.attempt_count,
      confidence_label: confidence.label,
      validation_warnings: validation.issues.filter((i) => i.severity === "warning").length,
    },
    providerBinding: { capability: "ai_text", provider: result.provider ?? undefined },
    costMicroUsd: result.cost_cents != null ? result.cost_cents * 10_000 : null,
    latencyMs: result.duration_ms ?? null,
    missionId: task.mission_id,
    taskId: task.id,
    refKind: "opportunity",
    refId: task.opportunity_id ?? null,
    dedupeKey: `katana.exec.success:${task.id}:${task.attempt_count}`,
  });

  // Strengthen learned pattern on verified completion
  if (validation.verified_completion) {
    await upsertLearnedPattern({
      userId: task.user_id,
      executiveId: task.agent,
      subjectKey: `task_kind:${task.task_kind}`,
      patternType: "verified_execution",
      summary: `Task '${task.task_kind}' completes reliably via ${result.provider ?? "provider"}.`,
      evidenceEventIds: [],
      outcomeDelta: "success",
      observationConfidence: Math.max(0.5, confidence.score),
    });
  }
}

async function blockTaskProviderUnavailable(task: Task, result: AdapterResult) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const history = [
    ...(task.execution_history ?? []),
    {
      at: new Date().toISOString(),
      runner: RUNNER_ID,
      attempt: task.attempt_count,
      blocked: "capability_unavailable",
      capability: result.provider ?? null,
      note: result.warning ?? null,
    },
  ];
  await supabaseAdmin
    .from("katana_agent_tasks")
    .update({
      status: "blocked",
      error: `capability_unavailable: ${result.warning ?? "no provider"}`,
      output: { production_package_ready: true, note: result.warning ?? "no provider" } as never,
      locked_at: null,
      locked_by: null,
      execution_history: history as never,
    })
    .eq("id", task.id)
    .eq("user_id", task.user_id);

  await supabaseAdmin.from("katana_intervention_queue").insert({
    user_id: task.user_id,
    task_id: task.id,
    mission_id: task.mission_id,
    kind: "capability_unavailable",
    title: `${task.agent}/${task.task_kind} needs a provider`,
    reason: (result.warning ?? "No provider configured for this capability").slice(0, 500),
    risk_level: "medium",
    recommended_action: "Connect a provider for this capability, or approve the production package as-is.",
  });

  const eventId = await recordEvent({
    userId: task.user_id,
    executiveId: task.agent,
    subsystem: "katana.runner",
    eventType: "blocked_capability_unavailable",
    outcomeClass: "blocked",
    summary: `${task.agent}/${task.task_kind} blocked: ${(result.warning ?? "no provider").slice(0, 200)}`,
    severity: 3,
    confidence: 0.9,
    context: { task_kind: task.task_kind, capability: capabilityFor(task.task_kind) },
    providerBinding: { capability: capabilityFor(task.task_kind) },
    missionId: task.mission_id,
    taskId: task.id,
    dedupeKey: `katana.exec.blocked:${task.id}`,
  });

  await upsertLearnedPattern({
    userId: task.user_id,
    executiveId: task.agent,
    subjectKey: `capability:${capabilityFor(task.task_kind)}`,
    patternType: "capability_gap",
    summary: `No provider currently available for capability '${capabilityFor(task.task_kind)}'. Connect a provider to unblock '${task.task_kind}'.`,
    detail: { last_task_kind: task.task_kind },
    evidenceEventIds: eventId ? [eventId] : [],
    outcomeDelta: "neutral",
    observationConfidence: 0.85,
  });
}

async function failTask(task: Task, err: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const message = err instanceof Error ? err.message : String(err);
  const errorKind = classifyErrorKind(message);

  // Pull consecutive failure count for recovery decision
  const cap = capabilityFor(task.task_kind);
  const { data: health } = await supabaseAdmin
    .from("sentinel_provider_health")
    .select("consecutive_failures")
    .eq("user_id", task.user_id)
    .eq("capability", cap)
    .order("updated_at", { ascending: false })
    .limit(1);
  const consec = health?.[0]?.consecutive_failures ?? null;

  const decision = decideRecovery({
    error_kind: errorKind,
    message,
    attempt_count: task.attempt_count,
    max_attempts: task.max_attempts,
    provider_consecutive_failures: consec,
    had_partial_output: false,
    is_critical_workflow_step: task.risk_level === "high" || task.risk_level === "critical",
  });

  const history = [
    ...(task.execution_history ?? []),
    {
      at: new Date().toISOString(),
      runner: RUNNER_ID,
      attempt: task.attempt_count,
      error: message.slice(0, 500),
      error_kind: errorKind,
      recovery: {
        action: decision.action,
        reason: decision.reason,
        requeue_status: decision.requeue_status,
        backoff_ms: decision.backoff_ms,
      },
    },
  ];

  const nextAttempt = decision.requeue_status === "retrying" ? task.attempt_count + 1 : task.attempt_count;
  const nextRetry = decision.backoff_ms ? new Date(Date.now() + decision.backoff_ms).toISOString() : null;

  // Phase 6 — request-scoped provider exclusion for alternate-provider recovery.
  // Append the failing binding to task.input._exclude_providers so the next
  // attempt asks the router for a different binding (never permanent).
  const currentInput = (task.input ?? {}) as Record<string, unknown>;
  let nextInput = currentInput;
  if (decision.action === "retry_alternate_provider") {
    const lastHistoryEntry = (task.execution_history ?? []).slice(-1)[0] as { provider?: string } | undefined;
    const failedProvider = lastHistoryEntry?.provider ?? aiTextAdapter.provider;
    const prev = (currentInput._exclude_providers as string[] | undefined) ?? [];
    nextInput = { ...currentInput, _exclude_providers: Array.from(new Set([...prev, failedProvider])) };
  }

  await supabaseAdmin
    .from("katana_agent_tasks")
    .update({
      status: decision.requeue_status,
      error: `${errorKind}: ${message.slice(0, 400)}`,
      attempt_count: nextAttempt,
      next_retry_at: nextRetry,
      locked_at: null,
      locked_by: null,
      input: nextInput as never,
      completed_at: ["failed", "blocked", "cancelled"].includes(decision.requeue_status)
        ? new Date().toISOString() : null,
      execution_history: history as never,
    })
    .eq("id", task.id)
    .eq("user_id", task.user_id);

  // Terminal-ish states → intervention queue + event + learning
  if (["failed", "blocked", "waiting_on_operator"].includes(decision.requeue_status)) {
    await supabaseAdmin.from("katana_intervention_queue").insert({
      user_id: task.user_id,
      task_id: task.id,
      mission_id: task.mission_id,
      kind: decision.requeue_status === "blocked" ? "capability_unavailable" : "task_failed",
      title: `${task.agent}/${task.task_kind} recovery: ${decision.action}`,
      reason: `${decision.reason} — ${message.slice(0, 300)}`,
      risk_level: task.risk_level === "critical" ? "high" : "medium",
      recommended_action: decision.action === "escalate_operator"
        ? "Review error, adjust inputs or credentials, then requeue."
        : decision.action === "graceful_terminate"
        ? "Capability unavailable — connect provider or approve as-is."
        : "Review recovery decision.",
    });

    const outcomeClass = decision.requeue_status === "blocked" ? "blocked" as const : "failure" as const;
    const eventId = await recordEvent({
      userId: task.user_id,
      executiveId: task.agent,
      subsystem: "katana.runner",
      eventType: `recovery_${decision.action}`,
      outcomeClass,
      summary: `${task.agent}/${task.task_kind} → ${decision.action} (${errorKind}): ${message.slice(0, 160)}`,
      severity: outcomeClass === "failure" ? 4 : 3,
      confidence: 0.85,
      context: { task_kind: task.task_kind, attempts: task.attempt_count, error_kind: errorKind, action: decision.action },
      missionId: task.mission_id,
      taskId: task.id,
      dedupeKey: `katana.exec.${outcomeClass}:${task.id}`,
    });

    if (outcomeClass === "failure") {
      await upsertLearnedPattern({
        userId: task.user_id,
        executiveId: task.agent,
        subjectKey: `task_kind:${task.task_kind}`,
        patternType: "recurring_failure",
        summary: `Task '${task.task_kind}' fails with ${errorKind}. Recovery: ${decision.action}.`,
        evidenceEventIds: eventId ? [eventId] : [],
        outcomeDelta: "failure",
        observationConfidence: 0.6,
      });
    }
  }
}

async function promoteRetrying() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("katana_agent_tasks")
    .update({ status: "ready" })
    .eq("status", "retrying")
    .lt("next_retry_at", now);
}

export interface RunReport {
  claimed: number;
  completed: number;
  failed: number;
  blocked: number;
  skipped: number;
  runner_id: string;
}

export async function runNextBatch(): Promise<RunReport> {
  await releaseStaleLocks();
  await promoteRetrying();
  await promoteQueuedToReady();

  const batch = await claimBatch();
  let completed = 0;
  let failed = 0;
  let blocked = 0;

  for (const task of batch) {
    try {
      if (task.requires_approval) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("katana_agent_tasks")
          .update({
            status: "waiting_on_operator",
            locked_at: null,
            locked_by: null,
          })
          .eq("id", task.id)
          .eq("user_id", task.user_id);
        continue;
      }
      const cap = capabilityFor(task.task_kind);

      // SENTINEL guard — kill switch, budget, provider health
      const guard = await evaluateGuard({
        userId: task.user_id,
        capability: cap,
        executiveId: task.agent,
        estimatedMicroUsd: (task.estimated_cost_cents ?? 0) * 10_000,
      });

      // Confidence assessment (deterministic, explainable)
      const depsCompleted = !task.depends_on?.length; // promoteQueuedToReady only advances when deps met
      const workflowComplete = task.input != null && Object.keys(task.input ?? {}).length > 0;
      const signals = await collectSignals({
        userId: task.user_id,
        taskKind: task.task_kind,
        agent: task.agent,
        capability: cap,
        attemptCount: task.attempt_count,
        maxAttempts: task.max_attempts,
        riskLevel: task.risk_level,
        requiresApproval: task.requires_approval,
        workflowComplete,
        dependenciesAllCompleted: depsCompleted,
        sentinelAllowed: guard.allow,
        sentinelAction: (guard.action ?? (guard.allow ? "allow" : "block")) as "allow" | "warn" | "throttle" | "block",
      });
      const confidence = computeConfidence(signals);

      if (!guard.allow || confidence.should_block) {
        await blockTaskProviderUnavailable(task, {
          available: false,
          provider: "sentinel",
          warning: `sentinel_block: ${guard.reasons.join(",")}`,
        } as AdapterResult);
        blocked++;
        continue;
      }

      const started = Date.now();
      const result = await runAdapter(task, cap);
      const latencyMs = Date.now() - started;
      const providerName = result.provider ?? "unknown";

      await observeProviderCall({
        userId: task.user_id,
        provider: providerName,
        capability: cap,
        success: !!result.available,
        latencyMs,
        errorKind: result.available ? undefined : "unsupported",
        errorMessage: result.warning ?? undefined,
      });

      if (!result.available) {
        await blockTaskProviderUnavailable(task, result);
        blocked++;
      } else {
        // Validation gate — verified completion, not attempted completion
        const expectations = defaultExpectations(task.task_kind);
        const validation = validateExecution({
          task_kind: task.task_kind,
          requires_output: expectations.requires_output,
          expected_output_keys: expectations.expected_output_keys,
          result,
        });

        if (!validation.passed) {
          // Route validation failure through recovery classifier
          throw new Error(
            `validation: ${validation.issues.filter((i) => i.severity === "critical").map((i) => i.message).join("; ")}`,
          );
        }

        await completeTask(task, result, validation, confidence);
        await recordCost({
          userId: task.user_id,
          provider: providerName,
          capability: cap,
          executiveId: task.agent,
          subsystem: "katana.runner",
          taskId: task.id,
          missionId: task.mission_id,
          costMicroUsd: (result.cost_cents ?? 0) * 10_000,
          estimatedMicroUsd: (task.estimated_cost_cents ?? 0) * 10_000,
          latencyMs,
          outcome: "success",
          dedupeKey: `katana.cost:${task.id}:${task.attempt_count}`,
          metadata: { task_kind: task.task_kind, confidence: confidence.score, verified: validation.verified_completion },
        });
        completed++;
      }
    } catch (err) {
      await observeProviderCall({
        userId: task.user_id,
        provider: "unknown",
        capability: capabilityFor(task.task_kind),
        success: false,
        errorKind: "other",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      await failTask(task, err);
      failed++;
    }
  }

  return {
    claimed: batch.length,
    completed,
    failed,
    blocked,
    skipped: batch.length - completed - failed - blocked,
    runner_id: RUNNER_ID,
  };
}
