
-- ============== katana_assets ==============
CREATE TABLE public.katana_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('google_drive','onedrive','vault','mission','sop','manual','other')),
  source_ref text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('video','image','audio','doc','text','other')),
  title text NOT NULL,
  mime text,
  size_bytes bigint,
  hash text,
  thumbnail_url text,
  extracted_text text,
  tags text[] NOT NULL DEFAULT '{}',
  categories text[] NOT NULL DEFAULT '{}',
  evaluated_at timestamptz,
  opportunity_score int DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.katana_assets TO authenticated;
GRANT ALL ON public.katana_assets TO service_role;
ALTER TABLE public.katana_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assets" ON public.katana_assets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER katana_assets_touch BEFORE UPDATE ON public.katana_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX katana_assets_user_kind ON public.katana_assets (user_id, kind);

-- ============== katana_asset_derivatives ==============
CREATE TABLE public.katana_asset_derivatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  parent_asset_ids uuid[] NOT NULL DEFAULT '{}',
  kind text NOT NULL,
  title text NOT NULL,
  content text,
  mission_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','published','archived')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.katana_asset_derivatives TO authenticated;
GRANT ALL ON public.katana_asset_derivatives TO service_role;
ALTER TABLE public.katana_asset_derivatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own derivatives" ON public.katana_asset_derivatives FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER katana_derivatives_touch BEFORE UPDATE ON public.katana_asset_derivatives
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== katana_opportunities ==============
CREATE TABLE public.katana_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  rationale text NOT NULL,
  estimated_value_band text NOT NULL DEFAULT 'M' CHECK (estimated_value_band IN ('S','M','L','XL')),
  effort_band text NOT NULL DEFAULT 'M' CHECK (effort_band IN ('S','M','L','XL')),
  source_asset_ids uuid[] NOT NULL DEFAULT '{}',
  recommended_mission jsonb NOT NULL DEFAULT '{}',
  four_questions jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','dismissed','completed')),
  mission_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.katana_opportunities TO authenticated;
GRANT ALL ON public.katana_opportunities TO service_role;
ALTER TABLE public.katana_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own opportunities" ON public.katana_opportunities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER katana_opps_touch BEFORE UPDATE ON public.katana_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX katana_opps_user_status ON public.katana_opportunities (user_id, status, category);

-- ============== katana_trusted_workflows ==============
CREATE TABLE public.katana_trusted_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workflow_signature text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workflow_signature)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.katana_trusted_workflows TO authenticated;
GRANT ALL ON public.katana_trusted_workflows TO service_role;
ALTER TABLE public.katana_trusted_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trusted workflows" ON public.katana_trusted_workflows FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
