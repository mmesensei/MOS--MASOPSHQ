CREATE TABLE public.executive_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  executive text NOT NULL CHECK (executive IN ('iris','apex','katana','sentinel')),
  kind text NOT NULL,
  headline text NOT NULL,
  reasoning text,
  recommended_action text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  score int NOT NULL DEFAULT 2 CHECK (score BETWEEN 1 AND 5),
  hash text NOT NULL,
  trigger text,
  shown_at timestamptz,
  acknowledged_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_observations TO authenticated;
GRANT ALL ON public.executive_observations TO service_role;

ALTER TABLE public.executive_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own observations"
  ON public.executive_observations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX executive_observations_feed
  ON public.executive_observations (user_id, dismissed_at, score DESC, created_at DESC);

CREATE INDEX executive_observations_recent
  ON public.executive_observations (user_id, created_at DESC);