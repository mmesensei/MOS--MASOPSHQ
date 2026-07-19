
ALTER TABLE public.katana_agent_tasks
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS execution_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_time_ms integer,
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_katana_tasks_runner
  ON public.katana_agent_tasks (status, created_at)
  WHERE status IN ('ready','running','retrying');

CREATE INDEX IF NOT EXISTS idx_katana_tasks_agent_status
  ON public.katana_agent_tasks (agent, status);

-- Extensions for the runner cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
