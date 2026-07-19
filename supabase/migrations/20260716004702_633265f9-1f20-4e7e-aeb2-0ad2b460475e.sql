
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  description TEXT,
  purpose TEXT,
  target_audience TEXT,
  status TEXT NOT NULL DEFAULT 'opportunity',
  priority TEXT NOT NULL DEFAULT 'Medium',
  source_type TEXT,
  source_id UUID,
  scorecard JSONB NOT NULL DEFAULT '{}'::jsonb,
  revenue_model TEXT,
  automation_notes TEXT,
  proposed_by TEXT NOT NULL DEFAULT 'katana',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage own assets" ON public.assets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER assets_touch_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX assets_user_status_idx ON public.assets(user_id, status);
