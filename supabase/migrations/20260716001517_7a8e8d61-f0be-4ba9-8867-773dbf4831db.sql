
-- SOPs
CREATE TABLE public.sops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('sop','template','training','scenario','framework','pattern')),
  title text NOT NULL,
  summary text,
  body text NOT NULL,
  source text,
  tags text[] NOT NULL DEFAULT '{}',
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sops TO authenticated;
GRANT ALL ON public.sops TO service_role;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sops" ON public.sops FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER sops_touch BEFORE UPDATE ON public.sops FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Missions: add stage + charter
DO $$ BEGIN
  CREATE TYPE public.mission_stage AS ENUM ('proposed','chartered','active','in_review','completed','held','archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS stage public.mission_stage NOT NULL DEFAULT 'proposed';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS charter jsonb;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS deliverables text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS risks text[] NOT NULL DEFAULT '{}';

-- Mission activity log
CREATE TABLE public.mission_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  actor text NOT NULL,
  event text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mission_activity TO authenticated;
GRANT ALL ON public.mission_activity TO service_role;
ALTER TABLE public.mission_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity read" ON public.mission_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own activity insert" ON public.mission_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Executive growth journal
CREATE TABLE public.executive_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  executive text NOT NULL CHECK (executive IN ('iris','apex','katana','sentinel')),
  kind text NOT NULL CHECK (kind IN ('learned','observed','opportunity','correction','value')),
  content text NOT NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.executive_journal TO authenticated;
GRANT ALL ON public.executive_journal TO service_role;
ALTER TABLE public.executive_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own journal" ON public.executive_journal FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX executive_journal_recent ON public.executive_journal (user_id, executive, created_at DESC);
