// KATANA Phase 3 — Sentinel security, risk scoring, intervention queue,
// state machine helpers, cost tracking, and idempotency utilities.
//
// This module is deliberately small: it centralizes the rules that KATANA,
// APEX and IRIS all invoke so no agent can bypass Sentinel by writing
// straight to the tables. All state mutations go through here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Risk classification ----------

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface RiskInput {
  publishing?: boolean;
  external_services?: string[];
  spending_cents?: number;
  deletes_or_overwrites?: boolean;
  sensitive_data?: boolean;
  reversible?: boolean;
  connected_systems?: number;
  confidence?: number; // 0..1
  previous_failures?: number;
}

export function classifyRisk(i: RiskInput): { level: RiskLevel; score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (i.publishing) { score += 35; reasons.push("public publishing"); }
  if ((i.spending_cents ?? 0) > 0) { score += Math.min(30, (i.spending_cents! / 500)); reasons.push("paid action"); }
  if (i.deletes_or_overwrites) { score += 40; reasons.push("mutates originals"); }
  if (i.sensitive_data) { score += 30; reasons.push("touches sensitive data"); }
  if (i.reversible === false) { score += 20; reasons.push("irreversible"); }
  score += Math.min(15, (i.external_services?.length ?? 0) * 5);
  score += Math.min(10, (i.connected_systems ?? 0) * 2);
  score += Math.min(15, (i.previous_failures ?? 0) * 5);
  if ((i.confidence ?? 1) < 0.5) { score += 15; reasons.push("low confidence"); }

  const level: RiskLevel =
    score >= 75 ? "critical" : score >= 45 ? "high" : score >= 20 ? "moderate" : "low";
  return { level, score: Math.round(score), reasons };
}

// ---------- Retry classification (never retry non-recoverable failures) ----------

export type FailureCode =
  | "permission_denied" | "approval_revoked" | "policy_violation"
  | "ownership_failed" | "destructive_conflict" | "auth_revoked"
  | "unsupported_type" | "invalid_input"
  | "rate_limited" | "timeout" | "network" | "provider_5xx" | "transient";

const NON_RETRYABLE: FailureCode[] = [
  "permission_denied", "approval_revoked", "policy_violation",
  "ownership_failed", "destructive_conflict", "auth_revoked",
  "unsupported_type", "invalid_input",
];

export function isRetryable(code: FailureCode): boolean {
  return !NON_RETRYABLE.includes(code);
}

// ---------- Output validation (pre-completion check) ----------

export interface OutputContext {
  required_deliverables: string[];
  produced_deliverables: string[];
  approved_destinations?: string[];
  destination?: string;
  approved_file_types?: string[];
  file_type?: string;
  source_asset_ids?: string[];
  used_source_asset_ids?: string[];
  contains_sensitive_data?: boolean;
  operator_approved_sensitive?: boolean;
  duplicate_of?: string | null;
  brand_score?: number; // 0..1
  accuracy_score?: number; // 0..1
}

export interface OutputVerdict {
  ok: boolean;
  warnings: string[];
  blockers: string[];
  scores: { accuracy: number; completeness: number; brand: number; security: number };
}

export function validateOutput(c: OutputContext): OutputVerdict {
  const warnings: string[] = [];
  const blockers: string[] = [];

  const missing = c.required_deliverables.filter((d) => !c.produced_deliverables.includes(d));
  if (missing.length) blockers.push(`missing deliverables: ${missing.join(", ")}`);

  if (c.destination && c.approved_destinations && !c.approved_destinations.includes(c.destination)) {
    blockers.push(`destination not approved: ${c.destination}`);
  }
  if (c.file_type && c.approved_file_types && !c.approved_file_types.includes(c.file_type)) {
    warnings.push(`file type ${c.file_type} outside approved set`);
  }
  if (c.source_asset_ids?.length) {
    const used = new Set(c.used_source_asset_ids ?? []);
    const unused = c.source_asset_ids.filter((id) => !used.has(id));
    if (unused.length === c.source_asset_ids.length) {
      warnings.push("no source assets were referenced");
    }
  }
  if (c.contains_sensitive_data && !c.operator_approved_sensitive) {
    blockers.push("sensitive data present without explicit operator approval");
  }
  if (c.duplicate_of) blockers.push(`duplicate of existing output ${c.duplicate_of}`);

  const completeness = c.required_deliverables.length
    ? (c.required_deliverables.length - missing.length) / c.required_deliverables.length
    : 1;
  const security = c.contains_sensitive_data && !c.operator_approved_sensitive ? 0.2 : 1;

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
    scores: {
      accuracy: c.accuracy_score ?? 0.8,
      completeness,
      brand: c.brand_score ?? 0.8,
      security,
    },
  };
}

// ---------- Dependency resolver ----------

export interface DependencyTask { id: string; status: string; depends_on?: string[] | null }

/** Returns tasks that are queued/waiting AND whose required deps are all completed. */
export function resolveReady(tasks: DependencyTask[]): DependencyTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const terminalOk = (s: string) => s === "completed" || s === "completed_with_warnings";
  return tasks.filter((t) => {
    if (t.status !== "queued" && t.status !== "waiting_on_dependency") return false;
    const deps = t.depends_on ?? [];
    return deps.every((id) => {
      const d = byId.get(id);
      return d && terminalOk(d.status);
    });
  });
}


// ---------- Idempotency ----------

export function idempotencyKey(parts: Array<string | number | null | undefined>): string {
  const h = createHash("sha256");
  h.update(parts.map((p) => String(p ?? "")).join("|"));
  return h.digest("hex").slice(0, 40);
}

// ---------- Guardrails: actions that always need explicit approval ----------

export const HIGH_IMPACT_ACTIONS = new Set<string>([
  "publish", "send_email", "send_dm", "spend_money", "purchase",
  "subscribe", "delete_asset", "replace_original", "transfer_sensitive",
  "change_permissions", "connect_service", "share_external",
  "submit_legal", "submit_financial", "submit_regulatory",
]);

// ---------- Server functions ----------

const RecordEventSchema = z.object({
  mission_id: z.string().uuid().nullable().optional(),
  task_id: z.string().uuid().nullable().optional(),
  stage: z.string().min(1).max(80),
  action: z.string().min(1).max(120),
  decision: z.enum(["allow", "allow_with_confirmation", "deny", "pause", "escalate"]),
  risk_level: z.enum(["low", "moderate", "high", "critical"]).default("low"),
  severity: z.enum(["info", "warning", "high", "critical"]).default("info"),
  rationale: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const recordSecurityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof RecordEventSchema>) => RecordEventSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("katana_security_events").insert({
      user_id: context.userId,
      mission_id: data.mission_id ?? null,
      task_id: data.task_id ?? null,
      stage: data.stage,
      action: data.action,
      decision: data.decision,
      risk_level: data.risk_level,
      severity: data.severity,
      rationale: data.rationale ?? null,
      metadata: data.metadata as never,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSecurityEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("katana_security_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Intervention queue ----------

const OpenInterventionSchema = z.object({
  mission_id: z.string().uuid().nullable().optional(),
  task_id: z.string().uuid().nullable().optional(),
  kind: z.string().min(1).max(60),
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(2000),
  risk_level: z.enum(["low", "moderate", "high", "critical"]).default("moderate"),
  estimated_cost_cents: z.number().int().nonnegative().default(0),
  recommended_action: z.string().max(120).optional(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).default([]),
});

export const openIntervention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof OpenInterventionSchema>) => OpenInterventionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("katana_intervention_queue")
      .insert({
        user_id: context.userId,
        mission_id: data.mission_id ?? null,
        task_id: data.task_id ?? null,
        kind: data.kind,
        title: data.title,
        reason: data.reason,
        risk_level: data.risk_level,
        estimated_cost_cents: data.estimated_cost_cents,
        recommended_action: data.recommended_action ?? null,
        options: data.options as never,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const listInterventions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("katana_intervention_queue")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ResolveSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approve", "reject", "modify", "retry", "skip", "pause", "cancel", "rollback", "escalate"]),
  note: z.string().max(2000).optional(),
});

export const resolveIntervention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof ResolveSchema>) => ResolveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("katana_intervention_queue")
      .update({
        status: "resolved",
        resolution: { decision: data.decision, note: data.note ?? null, at: new Date().toISOString() } as never,
      } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    // Immutable Sentinel record of the operator decision.
    await context.supabase.from("katana_security_events").insert({
      user_id: context.userId,
      stage: "operator_intervention",
      action: `intervention:${data.decision}`,
      decision: data.decision === "reject" || data.decision === "cancel" ? "deny" : "allow",
      risk_level: "moderate",
      severity: "info",
      rationale: data.note ?? null,
      metadata: { intervention_id: data.id } as never,
    } as never);

    return { ok: true };
  });

// ---------- State machine + retry helper ----------

const TransitionSchema = z.object({
  task_id: z.string().uuid(),
  to: z.enum([
    "draft","pending_security_review","queued","ready","running",
    "waiting_on_dependency","waiting_on_operator","blocked","retrying",
    "completed","completed_with_warnings","failed","cancelled","rolled_back","archived",
  ]),
  reason: z.string().max(500).optional(),
  error_text: z.string().max(2000).optional(),
});

export const transitionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof TransitionSchema>) => TransitionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.to, reason: data.reason ?? null };
    if (data.to === "running") patch.started_at = new Date().toISOString();
    if (["completed","completed_with_warnings","failed","cancelled","rolled_back"].includes(data.to)) {
      patch.completed_at = new Date().toISOString();
    }
    if (data.to === "retrying") {
      // increment attempt count via read-modify-write; the DB trigger validates the transition
      const { data: t } = await context.supabase
        .from("katana_agent_tasks").select("attempt_count, max_attempts")
        .eq("id", data.task_id).single();
      const attempt = ((t as { attempt_count: number } | null)?.attempt_count ?? 0) + 1;
      const max = (t as { max_attempts: number } | null)?.max_attempts ?? 3;
      if (attempt > max) {
        patch.status = "failed";
        patch.error = data.error_text ?? "retry limit exceeded";
      } else {
        patch.attempt_count = attempt;
        // exponential backoff, bounded
        const delaySec = Math.min(300, Math.pow(2, attempt) * 5);
        patch.next_retry_at = new Date(Date.now() + delaySec * 1000).toISOString();
      }
    }
    if (data.error_text) patch.error = data.error_text;

    const { error } = await context.supabase
      .from("katana_agent_tasks")
      .update(patch as never)
      .eq("id", data.task_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message); // trigger raises on invalid transitions

    await context.supabase.from("katana_security_events").insert({
      user_id: context.userId,
      task_id: data.task_id,
      stage: "state_transition",
      action: `task:${data.to}`,
      decision: "allow",
      risk_level: "low",
      severity: "info",
      rationale: data.reason ?? null,
      metadata: {} as never,
    } as never);
    return { ok: true };
  });

// ---------- Cost recording ----------

const CostSchema = z.object({
  mission_id: z.string().uuid().nullable().optional(),
  task_id: z.string().uuid().nullable().optional(),
  provider: z.string().max(80).optional(),
  kind: z.string().min(1).max(80),
  estimated_cents: z.number().int().nonnegative().default(0),
  actual_cents: z.number().int().nonnegative().default(0),
  metadata: z.record(z.unknown()).default({}),
});

export const recordCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof CostSchema>) => CostSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Phase 7 consolidation: route through the canonical SENTINEL ledger.
    const { recordCost: sentinelRecordCost } = await import("@/lib/sentinel/runtime.server");
    await sentinelRecordCost({
      userId: context.userId,
      provider: data.provider ?? "unknown",
      capability: data.kind,
      subsystem: "katana.manual",
      taskId: data.task_id ?? null,
      missionId: data.mission_id ?? null,
      costMicroUsd: (data.actual_cents ?? 0) * 10_000,
      estimatedMicroUsd: (data.estimated_cents ?? 0) * 10_000,
      outcome: "success",
      metadata: data.metadata,
    });
    return { ok: true };
  });


// ---------- Mission Attention summary ----------

export const missionAttention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [tasks, alerts, interventions] = await Promise.all([
      context.supabase
        .from("katana_agent_tasks")
        .select("id, mission_id, agent, task_kind, status, risk_level, updated_at, next_retry_at, attempt_count, max_attempts")
        .in("status", ["running","waiting_on_dependency","waiting_on_operator","blocked","retrying","failed"])
        .order("updated_at", { ascending: false })
        .limit(60),
      context.supabase
        .from("katana_security_events")
        .select("id, action, severity, risk_level, decision, rationale, created_at, mission_id, task_id")
        .in("severity", ["warning","high","critical"])
        .order("created_at", { ascending: false })
        .limit(20),
      context.supabase
        .from("katana_intervention_queue")
        .select("id")
        .eq("status", "open"),
    ]);
    return {
      tasks: tasks.data ?? [],
      alerts: alerts.data ?? [],
      open_interventions: interventions.data?.length ?? 0,
    };
  });
