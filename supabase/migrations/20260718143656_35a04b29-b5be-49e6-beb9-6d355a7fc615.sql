
CREATE TABLE public.executive_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  executive_id text NOT NULL CHECK (executive_id IN ('iris','apex','katana','sentinel')),
  presence text NOT NULL DEFAULT 'available' CHECK (presence IN ('available','focused','in_meeting','away','offline')),
  mood text NOT NULL DEFAULT 'neutral',
  current_focus text,
  active_mission_id uuid,
  last_interaction_at timestamptz,
  memory_pointer_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, executive_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_state TO authenticated;
GRANT ALL ON public.executive_state TO service_role;

ALTER TABLE public.executive_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own executive state"
  ON public.executive_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own executive state"
  ON public.executive_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own executive state"
  ON public.executive_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own executive state"
  ON public.executive_state FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER executive_state_touch
  BEFORE UPDATE ON public.executive_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_executive_state_user ON public.executive_state(user_id);
