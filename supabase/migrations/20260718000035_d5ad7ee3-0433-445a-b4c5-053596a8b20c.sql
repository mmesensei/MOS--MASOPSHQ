
ALTER TABLE public.katana_assets DROP CONSTRAINT IF EXISTS katana_assets_kind_check;
ALTER TABLE public.katana_assets DROP CONSTRAINT IF EXISTS katana_assets_source_check;

ALTER TABLE public.katana_assets
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS source_uri text,
  ADD COLUMN IF NOT EXISTS mime_family text,
  ADD COLUMN IF NOT EXISTS business_category text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS execution_category text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority_band text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid REFERENCES public.katana_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorized boolean NOT NULL DEFAULT false;

ALTER TABLE public.katana_assets
  ADD CONSTRAINT katana_assets_kind_check CHECK (
    kind = ANY (ARRAY['video','image','audio','doc','text','presentation','spreadsheet','archive','other'])
  ),
  ADD CONSTRAINT katana_assets_source_check CHECK (
    source = ANY (ARRAY['google_drive','onedrive','dropbox','upload','local_folder','vault','mission','sop','manual','internal','other'])
  ),
  ADD CONSTRAINT katana_assets_priority_band_check CHECK (
    priority_band IS NULL OR priority_band = ANY (ARRAY['critical','high','medium','low'])
  ),
  ADD CONSTRAINT katana_assets_mime_family_check CHECK (
    mime_family IS NULL OR mime_family = ANY (ARRAY['video','image','audio','document','presentation','spreadsheet','archive','other'])
  );

CREATE INDEX IF NOT EXISTS katana_assets_source_provider_idx ON public.katana_assets (user_id, source_provider);
CREATE INDEX IF NOT EXISTS katana_assets_authorized_idx ON public.katana_assets (user_id, authorized);

CREATE TABLE IF NOT EXISTS public.katana_asset_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['google_drive','onedrive','dropbox','upload','local_folder'])),
  account_label text,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'not_configured' CHECK (status = ANY (ARRAY['active','not_configured','revoked','error'])),
  root_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS katana_asset_sources_unique_labeled
  ON public.katana_asset_sources (user_id, provider, account_label)
  WHERE account_label IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS katana_asset_sources_unique_unlabeled
  ON public.katana_asset_sources (user_id, provider)
  WHERE account_label IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.katana_asset_sources TO authenticated;
GRANT ALL ON public.katana_asset_sources TO service_role;
ALTER TABLE public.katana_asset_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own asset sources" ON public.katana_asset_sources
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER katana_asset_sources_touch BEFORE UPDATE ON public.katana_asset_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.katana_scan_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.katana_asset_sources(id) ON DELETE SET NULL,
  provider text NOT NULL,
  files_seen integer NOT NULL DEFAULT 0,
  files_authorized integer NOT NULL DEFAULT 0,
  files_skipped integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.katana_scan_log TO authenticated;
GRANT ALL ON public.katana_scan_log TO service_role;
ALTER TABLE public.katana_scan_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scan log read" ON public.katana_scan_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own scan log insert" ON public.katana_scan_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS katana_scan_log_user_created_idx ON public.katana_scan_log (user_id, created_at DESC);
