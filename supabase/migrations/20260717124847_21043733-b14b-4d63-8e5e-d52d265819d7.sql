
-- 1. Authorized Google Drive folders
CREATE TABLE public.google_drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  folder_id text NOT NULL,
  folder_name text NOT NULL,
  folder_path text,
  access_mode text NOT NULL DEFAULT 'read',
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  file_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, folder_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_drive_folders TO authenticated;
GRANT ALL ON public.google_drive_folders TO service_role;
ALTER TABLE public.google_drive_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages drive folders"
  ON public.google_drive_folders FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND public.current_user_is_owner())
  WITH CHECK (user_id = auth.uid() AND public.current_user_is_owner());

-- 2. Knowledge audit log (immutable append-only)
CREATE TABLE public.knowledge_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  target_user_id uuid,
  source text NOT NULL,
  action text NOT NULL,
  target_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_audit_log TO authenticated;
GRANT ALL ON public.knowledge_audit_log TO service_role;
ALTER TABLE public.knowledge_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads knowledge audit"
  ON public.knowledge_audit_log FOR SELECT
  TO authenticated
  USING (public.current_user_is_owner());
-- No INSERT/UPDATE/DELETE policies: only service_role writes (immutable to app users).

-- 3. Global knowledge settings
CREATE TABLE public.knowledge_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  multi_user_drive_enabled boolean NOT NULL DEFAULT false,
  auto_sync_enabled boolean NOT NULL DEFAULT true,
  auto_sync_interval_minutes integer NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_settings TO authenticated;
GRANT ALL ON public.knowledge_settings TO service_role;
ALTER TABLE public.knowledge_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read settings"
  ON public.knowledge_settings FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Owner updates settings"
  ON public.knowledge_settings FOR UPDATE
  TO authenticated
  USING (public.current_user_is_owner())
  WITH CHECK (public.current_user_is_owner());
INSERT INTO public.knowledge_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 4. Update triggers
CREATE TRIGGER trg_google_drive_folders_updated
  BEFORE UPDATE ON public.google_drive_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_knowledge_settings_updated
  BEFORE UPDATE ON public.knowledge_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
