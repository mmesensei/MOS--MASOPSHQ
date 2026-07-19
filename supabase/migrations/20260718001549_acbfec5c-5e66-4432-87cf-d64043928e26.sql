
-- Extend katana_agent_tasks with reliability + risk + cost + idempotency fields
ALTER TABLE public.katana_agent_tasks
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','moderate','high','critical')),
  ADD COLUMN IF NOT EXISTS previous_status text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS depends_on uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_cost_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accuracy_score numeric,
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS reason text;

-- Widen allowed statuses to full state machine
ALTER TABLE public.katana_agent_tasks
  DROP CONSTRAINT IF EXISTS katana_agent_tasks_status_check;
ALTER TABLE public.katana_agent_tasks
  ADD CONSTRAINT katana_agent_tasks_status_check CHECK (status IN (
    'draft','pending_security_review','queued','ready','running',
    'waiting_on_dependency','waiting_on_operator','blocked','retrying',
    'completed','completed_with_warnings','failed','cancelled','rolled_back','archived'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_katana_agent_tasks_idem
  ON public.katana_agent_tasks(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Extend missions with risk + cost + policy fields
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','moderate','high','critical')),
  ADD COLUMN IF NOT EXISTS cost_ceiling_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_scope text NOT NULL DEFAULT 'once'
    CHECK (approval_scope IN ('once','always','revoked')),
  ADD COLUMN IF NOT EXISTS approval_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Learning promotion state
ALTER TABLE public.katana_learnings
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'candidate'
    CHECK (state IN ('candidate','observed','verified','promoted','deprecated')),
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz;

-- Sentinel security events (append-only for app users)
CREATE TABLE IF NOT EXISTS public.katana_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.katana_agent_tasks(id) ON DELETE SET NULL,
  stage text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','high','critical')),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','moderate','high','critical')),
  action text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('allow','allow_with_confirmation','deny','pause','escalate')),
  rationale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.katana_security_events TO authenticated;
GRANT ALL ON public.katana_security_events TO service_role;
ALTER TABLE public.katana_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sentinel events owner read" ON public.katana_security_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sentinel events owner insert" ON public.katana_security_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE/DELETE policies → append-only for authenticated users.
CREATE INDEX IF NOT EXISTS idx_sentinel_events_user_created
  ON public.katana_security_events(user_id, created_at DESC);

-- Operator intervention queue
CREATE TABLE IF NOT EXISTS public.katana_intervention_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.katana_agent_tasks(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  reason text NOT NULL,
  risk_level text NOT NULL DEFAULT 'moderate' CHECK (risk_level IN ('low','moderate','high','critical')),
  estimated_cost_cents integer NOT NULL DEFAULT 0,
  recommended_action text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed','expired')),
  resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.katana_intervention_queue TO authenticated;
GRANT ALL ON public.katana_intervention_queue TO service_role;
ALTER TABLE public.katana_intervention_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intervention owner all" ON public.katana_intervention_queue
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_intervention BEFORE UPDATE ON public.katana_intervention_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_intervention_user_status
  ON public.katana_intervention_queue(user_id, status, created_at DESC);

-- Workflow versions (approved automation policies)
CREATE TABLE IF NOT EXISTS public.katana_workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','deprecated','revoked')),
  allowed_actions text[] NOT NULL DEFAULT '{}',
  prohibited_actions text[] NOT NULL DEFAULT '{}',
  approved_services text[] NOT NULL DEFAULT '{}',
  approved_destinations text[] NOT NULL DEFAULT '{}',
  cost_ceiling_cents integer NOT NULL DEFAULT 0,
  time_window_minutes integer,
  publishing_allowed boolean NOT NULL DEFAULT false,
  required_checkpoints text[] NOT NULL DEFAULT '{}',
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at timestamptz,
  success_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workflow_key, version)
);
GRANT SELECT, INSERT, UPDATE ON public.katana_workflow_versions TO authenticated;
GRANT ALL ON public.katana_workflow_versions TO service_role;
ALTER TABLE public.katana_workflow_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow versions owner all" ON public.katana_workflow_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_workflow_versions BEFORE UPDATE ON public.katana_workflow_versions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Cost ledger
CREATE TABLE IF NOT EXISTS public.katana_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.katana_agent_tasks(id) ON DELETE SET NULL,
  provider text,
  kind text NOT NULL,
  estimated_cents integer NOT NULL DEFAULT 0,
  actual_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.katana_cost_ledger TO authenticated;
GRANT ALL ON public.katana_cost_ledger TO service_role;
ALTER TABLE public.katana_cost_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost ledger owner read" ON public.katana_cost_ledger
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cost ledger owner insert" ON public.katana_cost_ledger
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_user_created
  ON public.katana_cost_ledger(user_id, created_at DESC);

-- Task state transition guard
CREATE OR REPLACE FUNCTION public.katana_task_state_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  valid boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.previous_status := NULL;
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Terminal states cannot transition (except archived from terminals)
  IF OLD.status IN ('completed','failed','cancelled','rolled_back') AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'Invalid task state transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  -- Allowed forward paths
  valid := CASE OLD.status
    WHEN 'draft' THEN NEW.status IN ('pending_security_review','queued','cancelled')
    WHEN 'pending_security_review' THEN NEW.status IN ('queued','blocked','cancelled','waiting_on_operator')
    WHEN 'queued' THEN NEW.status IN ('ready','waiting_on_dependency','cancelled','blocked')
    WHEN 'waiting_on_dependency' THEN NEW.status IN ('ready','cancelled','blocked')
    WHEN 'ready' THEN NEW.status IN ('running','cancelled','blocked')
    WHEN 'running' THEN NEW.status IN ('completed','completed_with_warnings','failed','retrying','waiting_on_operator','blocked','cancelled')
    WHEN 'retrying' THEN NEW.status IN ('running','failed','cancelled')
    WHEN 'waiting_on_operator' THEN NEW.status IN ('queued','ready','cancelled','rolled_back')
    WHEN 'blocked' THEN NEW.status IN ('queued','cancelled','rolled_back')
    WHEN 'completed' THEN NEW.status IN ('archived')
    WHEN 'completed_with_warnings' THEN NEW.status IN ('rolled_back','archived','completed')
    WHEN 'failed' THEN NEW.status IN ('retrying','archived','rolled_back')
    WHEN 'cancelled' THEN NEW.status IN ('archived')
    WHEN 'rolled_back' THEN NEW.status IN ('archived')
    ELSE false
  END;

  IF NOT valid THEN
    RAISE EXCEPTION 'Invalid task state transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  NEW.previous_status := OLD.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS katana_task_state_guard_trg ON public.katana_agent_tasks;
CREATE TRIGGER katana_task_state_guard_trg
  BEFORE INSERT OR UPDATE ON public.katana_agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.katana_task_state_guard();
