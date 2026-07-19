# KATANA Completion Strike — Execution Plan

**Non-goals (explicit):** no 3D, no avatars, no animations, no dashboard reskin, no rebuild of Google/OneDrive/OAuth, no new tables that duplicate existing ones (`katana_assets`, `katana_asset_sources`, `katana_asset_derivatives`, `katana_opportunities`, `katana_agent_tasks`, `katana_learnings`, `katana_scan_log`, `katana_intervention_queue`, `katana_security_events`, `katana_cost_ledger`, `katana_workflow_versions`).

## Audit findings (from existing code)
- `katana_agent_tasks` already has the 15-state lifecycle guard + `previous_status` trigger. Good foundation.
- No server-side **runner**: tasks move states via UI/functions but nothing claims `ready` tasks, executes, records cost, retries, or advances state autonomously.
- No **workflow decomposer**: opportunities → tasks exists partially, but no dependency graph, no parallel/sequential branching, no per-agent assignment logic beyond category hints.
- No **provider adapter layer**: AI calls are inline in `katana.functions.ts` and `committee.functions.ts`. Rendering/transcription/publishing are absent.
- No **learning feedback loop** writing to `katana_learnings` at workflow completion.
- No **cron trigger** to drive the runner without an open browser.
- Dashboard shows counts but not live execution telemetry (running tasks, ETA, bottlenecks).

## Scope — 6 focused deliverables

### 1. Canonical module split (`src/lib/katana/`)
Move existing logic into named modules without behavior change; keep `katana.functions.ts` as a thin re-export/compat shim so nothing else in the app breaks.
- `planner.functions.ts` — opportunity → workflow → tasks decomposition, dependency graph, agent assignment.
- `runner.server.ts` + `runner.functions.ts` — claim, lock, execute, retry, advance state.
- `providers/` — `ai.ts`, `transcription.ts`, `render.ts`, `publish.ts` adapters (capabilities interface; only `ai.ts` wired to Lovable AI now, others expose `{ available: false }` and mark tasks `Production Package Ready`, never fake completion).
- `learning.functions.ts` — post-workflow evaluation writing to `katana_learnings`.
- `telemetry.functions.ts` — live workload, queue, ETA, bottleneck queries.

### 2. Server-side execution runner
- New server function `runNextBatch` invoked by a `/api/public/hooks/katana-runner` cron (pg_cron, every 1 min).
- Claims up to N `ready` tasks using `UPDATE ... WHERE status='ready' RETURNING` with row-level lock (single UPDATE is atomic — no advisory lock table needed).
- Idempotency key = `sha256(task_id || attempt)`, stored in existing task row (add `idempotency_key`, `locked_at`, `locked_by` columns via migration).
- Dependency check: task ready only when all `depends_on` tasks are `completed` / `completed_with_warnings`.
- Executes via provider adapter for the task's assigned agent (IRIS/APEX/KATANA/SENTINEL prompt profiles).
- Records cost to `katana_cost_ledger`, execution time to `katana_agent_tasks.execution_history` jsonb.
- Retry with exponential backoff (max 3), then `failed` + intervention queue entry.
- SENTINEL pre-check hook: any task with `security_classification != 'low'` or `requires_approval` blocks on `waiting_on_operator`.

### 3. Workload orchestration
- `planWorkflow(opportunityId)` — decomposes into typed tasks per agent using an AI call with a strict JSON output schema (small, no `.min/.max` per gateway rules).
- Tasks written with `depends_on: uuid[]`, `assigned_agent`, `estimated_time_ms`, `estimated_cost_cents`, `priority`.
- `balance()` picks next batch by priority × age × dependency-readiness, caps per-agent concurrency.

### 4. Learning loop
- On workflow completion (all tasks terminal), evaluate: success rate, per-agent duration vs estimate, cost vs estimate, retry count, blocking reasons. Store row in `katana_learnings` with structured jsonb.
- Planner reads recent learnings for the same category and adjusts estimates + agent assignment weights.

### 5. Ops telemetry endpoints
- `getOperationalHealth()` — active/queued/running/failed/blocked counts, pending approvals, per-agent workload, avg execution time, top 3 bottlenecks (tasks stuck longest), estimated queue drain time.
- Consumed by existing `KatanaRevenueDashboard` — extend that component in place, no new pages.

### 6. Migration
Single migration adds to `katana_agent_tasks`:
- `idempotency_key text unique`
- `locked_at timestamptz`, `locked_by text`
- `depends_on uuid[] not null default '{}'`
- `assigned_agent text` (if not present)
- `estimated_time_ms int`, `estimated_cost_cents int`
- `execution_history jsonb not null default '[]'`
- `retry_count int not null default 0`, `max_retries int not null default 3`
- `security_classification text not null default 'low'`
- `requires_approval bool not null default false`
Plus indexes on `(status, priority desc, created_at)` and `(assigned_agent, status)`.
GRANTs preserved.

## Files touched (est.)
- New: `src/lib/katana/{planner,runner,learning,telemetry}.functions.ts`, `src/lib/katana/runner.server.ts`, `src/lib/katana/providers/{ai,transcription,render,publish}.ts`, `src/routes/api/public/hooks/katana-runner.ts`, 1 migration.
- Modified in place: `src/lib/katana.functions.ts` (re-export shim), `src/components/katana/revenue-dashboard.tsx` (bind live telemetry), `src/components/katana/intervention-queue.tsx` (surface runner failures).
- Untouched: OAuth, Google/OneDrive, committee, missions, vault, executive threads, SENTINEL security tables.

## Credit discipline
Everything backend/server. Zero UI reskin. Reuses existing tables + AI gateway + cron pattern. No new provider dependencies. Adapters stubbed with honest `{available:false}` so future providers plug in without refactor.

## Confirmation needed before I code
1. **OK to add columns to `katana_agent_tasks`** (non-destructive: all new columns nullable or defaulted)?
2. **OK to install pg_cron trigger** hitting `/api/public/hooks/katana-runner` every 1 min?
3. **Runner concurrency cap** — start at 3 parallel tasks total, 1 per agent? (Cheapest safe default.)
4. Scope trim: if credits force a cut, drop **learning loop (#4)** first, keep runner + orchestration + telemetry. Confirm this priority.
