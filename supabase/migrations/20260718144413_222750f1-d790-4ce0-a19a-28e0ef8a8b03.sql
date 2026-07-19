
-- =============================================================
-- Phase 3: Unified Operational Memory
-- =============================================================

-- 1) OPERATIONAL EVENTS -----------------------------------------
CREATE TABLE public.operational_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  executive_id TEXT CHECK (executive_id IS NULL OR executive_id IN ('iris','apex','katana','sentinel')),
  subsystem TEXT NOT NULL,                       -- e.g. 'katana.runner', 'committee', 'calibration', 'mission', 'opportunity'
  event_type TEXT NOT NULL,                      -- e.g. 'execution_success', 'execution_failure', 'blocked_provider', 'operator_override', 'recommendation_rejected'
  outcome_class TEXT NOT NULL CHECK (outcome_class IN (
    'success','failure','blocked','override','anomaly','decision','degradation','neutral'
  )),
  severity SMALLINT NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  summary TEXT NOT NULL CHECK (char_length(summary) <= 1000),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,    -- structured context (no secrets, no raw prompts)
  provider_binding JSONB,                        -- Phase 1 ProviderBinding snapshot when applicable
  cost_micro_usd BIGINT,                         -- micro-usd for high precision
  latency_ms INTEGER,
  mission_id UUID,
  task_id UUID,
  workflow_id UUID,
  asset_id UUID,
  ref_kind TEXT,                                 -- free-form additional ref kind
  ref_id TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'internal' CHECK (sensitivity IN ('public','internal','private','restricted')),
  retention TEXT NOT NULL DEFAULT 'standard' CHECK (retention IN ('short','standard','long','permanent')),
  dedupe_key TEXT,                               -- optional idempotency key, unique per user
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX operational_events_dedupe
  ON public.operational_events(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX idx_op_events_user_created ON public.operational_events(user_id, created_at DESC);
CREATE INDEX idx_op_events_user_exec ON public.operational_events(user_id, executive_id, created_at DESC);
CREATE INDEX idx_op_events_user_subsys ON public.operational_events(user_id, subsystem, event_type, created_at DESC);
CREATE INDEX idx_op_events_user_mission ON public.operational_events(user_id, mission_id) WHERE mission_id IS NOT NULL;
CREATE INDEX idx_op_events_user_task ON public.operational_events(user_id, task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_op_events_outcome ON public.operational_events(user_id, outcome_class, created_at DESC);

GRANT SELECT ON public.operational_events TO authenticated;
GRANT ALL ON public.operational_events TO service_role;

ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;

-- Read-own only; writes go through server functions using service_role or
-- authenticated context. Client INSERT/UPDATE/DELETE is denied by default
-- because we grant no INSERT/UPDATE/DELETE to authenticated.
CREATE POLICY "Users read own operational events"
  ON public.operational_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND sensitivity <> 'restricted');

CREATE POLICY "Owners read restricted events"
  ON public.operational_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND sensitivity = 'restricted' AND public.is_owner(auth.uid()));


-- 2) LEARNED PATTERNS -------------------------------------------
CREATE TABLE public.learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  executive_id TEXT CHECK (executive_id IS NULL OR executive_id IN ('iris','apex','katana','sentinel')),
  subject_key TEXT NOT NULL,                     -- workflow key, capability, subsystem topic
  pattern_type TEXT NOT NULL,                    -- 'recurring_failure','provider_preference','capability_gap','calibration_bias','operator_correction','decision_heuristic', ...
  summary TEXT NOT NULL CHECK (char_length(summary) <= 800),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_event_ids UUID[] NOT NULL DEFAULT '{}',
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.4 CHECK (confidence >= 0 AND confidence <= 1),
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  applied_count INTEGER NOT NULL DEFAULT 0,
  usefulness NUMERIC(4,3) NOT NULL DEFAULT 0.0 CHECK (usefulness >= -1 AND usefulness <= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','rejected','draft')),
  supersedes UUID REFERENCES public.learned_patterns(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sensitivity TEXT NOT NULL DEFAULT 'internal' CHECK (sensitivity IN ('public','internal','private','restricted')),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX learned_patterns_owner_scope
  ON public.learned_patterns(user_id, executive_id, subject_key, pattern_type)
  WHERE status = 'active';

CREATE INDEX idx_learned_patterns_user ON public.learned_patterns(user_id, status);
CREATE INDEX idx_learned_patterns_user_exec ON public.learned_patterns(user_id, executive_id, status);
CREATE INDEX idx_learned_patterns_subject ON public.learned_patterns(user_id, subject_key, status);

GRANT SELECT ON public.learned_patterns TO authenticated;
GRANT ALL ON public.learned_patterns TO service_role;

ALTER TABLE public.learned_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own learned patterns"
  ON public.learned_patterns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND sensitivity <> 'restricted');

CREATE POLICY "Owners read restricted patterns"
  ON public.learned_patterns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND sensitivity = 'restricted' AND public.is_owner(auth.uid()));

CREATE TRIGGER touch_learned_patterns
  BEFORE UPDATE ON public.learned_patterns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- 3) BOUNDED MEMORY POINTERS ------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_memory_pointer_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  arr jsonb;
BEGIN
  arr := COALESCE(NEW.memory_pointer_ids, '[]'::jsonb);
  IF jsonb_typeof(arr) <> 'array' THEN
    NEW.memory_pointer_ids := '[]'::jsonb;
  ELSIF jsonb_array_length(arr) > 32 THEN
    -- keep the most recent 32 (assume caller appends)
    NEW.memory_pointer_ids := (
      SELECT jsonb_agg(v)
      FROM (
        SELECT v FROM jsonb_array_elements(arr) WITH ORDINALITY t(v, ord)
        ORDER BY ord DESC LIMIT 32
      ) s
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cap_memory_pointers ON public.executive_state;
CREATE TRIGGER cap_memory_pointers
  BEFORE INSERT OR UPDATE ON public.executive_state
  FOR EACH ROW EXECUTE FUNCTION public.enforce_memory_pointer_cap();
