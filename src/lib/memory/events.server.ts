// Operational Events writer — server-only.
// Append-oriented log of meaningful operational events. Never store secrets,
// raw credentials, or full system prompts. Use dedupe_key for idempotency.
//
// Import only from *.server.ts or inside handler bodies of *.functions.ts.

import type { ExecutiveId } from "@/lib/executives";

export type OutcomeClass =
  | "success"
  | "failure"
  | "blocked"
  | "override"
  | "anomaly"
  | "decision"
  | "degradation"
  | "neutral";

export type Sensitivity = "public" | "internal" | "private" | "restricted";
export type Retention = "short" | "standard" | "long" | "permanent";

export interface ProviderBindingSnapshot {
  capability?: string;
  provider?: string;
  model?: string;
  fallback?: boolean;
}

export interface RecordEventInput {
  userId: string;
  executiveId?: ExecutiveId | null;
  subsystem: string;
  eventType: string;
  outcomeClass: OutcomeClass;
  summary: string;
  severity?: 1 | 2 | 3 | 4 | 5;
  confidence?: number; // 0..1
  context?: Record<string, unknown>;
  providerBinding?: ProviderBindingSnapshot | null;
  costMicroUsd?: number | null;
  latencyMs?: number | null;
  missionId?: string | null;
  taskId?: string | null;
  workflowId?: string | null;
  assetId?: string | null;
  refKind?: string | null;
  refId?: string | null;
  sensitivity?: Sensitivity;
  retention?: Retention;
  dedupeKey?: string | null;
}

// Fields that must never be persisted, even if a caller passes them in
// `context` by accident. Filtered defensively.
const FORBIDDEN_CONTEXT_KEYS = new Set([
  "api_key",
  "apiKey",
  "authorization",
  "password",
  "secret",
  "access_token",
  "refresh_token",
  "system_prompt",
  "systemPrompt",
  "prompt_raw",
]);

function sanitizeContext(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) return {};
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (FORBIDDEN_CONTEXT_KEYS.has(k)) continue;
    if (typeof v === "string" && v.length > 2000) {
      clean[k] = v.slice(0, 2000);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Record an operational event. Safe to call from any server-side context.
 * Failure is swallowed and logged — memory writes must never break the
 * caller's primary workflow.
 */
export async function recordEvent(input: RecordEventInput): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      user_id: input.userId,
      executive_id: input.executiveId ?? null,
      subsystem: input.subsystem,
      event_type: input.eventType,
      outcome_class: input.outcomeClass,
      severity: input.severity ?? 3,
      confidence: Math.max(0, Math.min(1, input.confidence ?? 0.5)),
      summary: input.summary.slice(0, 1000),
      context: sanitizeContext(input.context),
      provider_binding: input.providerBinding ?? null,
      cost_micro_usd: input.costMicroUsd ?? null,
      latency_ms: input.latencyMs ?? null,
      mission_id: input.missionId ?? null,
      task_id: input.taskId ?? null,
      workflow_id: input.workflowId ?? null,
      asset_id: input.assetId ?? null,
      ref_kind: input.refKind ?? null,
      ref_id: input.refId ?? null,
      sensitivity: input.sensitivity ?? "internal",
      retention: input.retention ?? "standard",
      dedupe_key: input.dedupeKey ?? null,
    };
    const { data, error } = await supabaseAdmin
      .from("operational_events")
      .upsert(row as never, {
        onConflict: input.dedupeKey ? "user_id,dedupe_key" : undefined,
        ignoreDuplicates: !!input.dedupeKey,
      } as never)
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[memory.events] insert failed:", error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.warn("[memory.events] threw:", err instanceof Error ? err.message : err);
    return null;
  }
}
