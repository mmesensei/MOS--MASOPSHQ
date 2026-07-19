-- Phase 2: Revenue Discovery + Execution Intelligence

ALTER TABLE public.katana_opportunities
  ADD COLUMN IF NOT EXISTS opportunity_type text,
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS revenue_category text,
  ADD COLUMN IF NOT EXISTS estimated_value_cents bigint,
  ADD COLUMN IF NOT EXISTS estimated_time_minutes integer,
  ADD COLUMN IF NOT EXISTS estimated_roi numeric,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS complexity text,
  ADD COLUMN IF NOT EXISTS automation_readiness text,
  ADD COLUMN IF NOT EXISTS priority_rank integer,
  ADD COLUMN IF NOT EXISTS deliverables jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required_agents text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS automation_ready boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_katana_opps_priority
  ON public.katana_opportunities (user_id, priority_rank DESC NULLS LAST, created_at DESC);

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS business_goal text,
  ADD COLUMN IF NOT EXISTS success_metrics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_path jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dependencies text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS risks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completion_criteria jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lessons_learned text,
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS estimated_roi numeric,
  ADD COLUMN IF NOT EXISTS estimated_completion_minutes integer,
  ADD COLUMN IF NOT EXISTS required_agents text[] DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.katana_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.katana_opportunities(id) ON DELETE SET NULL,
  agent text NOT NULL CHECK (agent IN ('katana','apex','iris','sentinel')),
  task_kind text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','skipped')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.katana_agent_tasks TO authenticated;
GRANT ALL ON public.katana_agent_tasks TO service_role;
ALTER TABLE public.katana_agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "katana_agent_tasks_owner_all"
  ON public.katana_agent_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_katana_agent_tasks_mission
  ON public.katana_agent_tasks (mission_id, agent, status);

CREATE TRIGGER touch_katana_agent_tasks
  BEFORE UPDATE ON public.katana_agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.katana_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight numeric NOT NULL DEFAULT 1,
  source_mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.katana_learnings TO authenticated;
GRANT ALL ON public.katana_learnings TO service_role;
ALTER TABLE public.katana_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "katana_learnings_owner_all"
  ON public.katana_learnings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER touch_katana_learnings
  BEFORE UPDATE ON public.katana_learnings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
