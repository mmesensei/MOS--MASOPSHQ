CREATE TABLE IF NOT EXISTS public.executive_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_executive text NOT NULL CHECK (from_executive IN ('iris','apex','katana','sentinel','operator','system')),
  to_executive   text NOT NULL CHECK (to_executive   IN ('iris','apex','katana','sentinel','operator')),
  purpose text NOT NULL,
  task_id uuid REFERENCES public.katana_agent_tasks(id) ON DELETE SET NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_response text NOT NULL DEFAULT 'ack' CHECK (required_response IN ('ack','decision','analysis','approval','none')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  depth smallint NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 3),
  parent_handoff_id uuid REFERENCES public.executive_handoffs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','responded','expired','cancelled')),
  outcome jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_executive <> to_executive)
);
CREATE INDEX IF NOT EXISTS idx_handoffs_user_status ON public.executive_handoffs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoffs_to_open ON public.executive_handoffs(user_id, to_executive, status) WHERE status = 'open';
GRANT SELECT, INSERT, UPDATE ON public.executive_handoffs TO authenticated;
GRANT ALL ON public.executive_handoffs TO service_role;
ALTER TABLE public.executive_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "handoffs_owner_all" ON public.executive_handoffs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_handoffs BEFORE UPDATE ON public.executive_handoffs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();