
CREATE TABLE public.google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_sub text NOT NULL,
  account_email text,
  account_name text,
  scopes text[] NOT NULL DEFAULT '{}',
  access_token_ciphertext text,
  access_token_expires_at timestamptz,
  refresh_token_ciphertext text,
  last_refreshed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_sub)
);
GRANT ALL ON public.google_connections TO service_role;
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.google_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  nonce text NOT NULL,
  redirect_target text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz
);
GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE INDEX google_oauth_states_expires_idx ON public.google_oauth_states (expires_at);

CREATE TABLE public.google_oauth_rate_limits (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);
GRANT ALL ON public.google_oauth_rate_limits TO service_role;
ALTER TABLE public.google_oauth_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX google_oauth_rate_limits_window_idx ON public.google_oauth_rate_limits (window_start);

CREATE TABLE public.google_selected_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id text NOT NULL,
  folder_name text NOT NULL,
  drive_id text,
  is_shared_drive boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  file_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, folder_id)
);
GRANT ALL ON public.google_selected_folders TO service_role;
ALTER TABLE public.google_selected_folders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_google_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_google_connections_updated BEFORE UPDATE ON public.google_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_google_updated_at();
CREATE TRIGGER trg_google_selected_folders_updated BEFORE UPDATE ON public.google_selected_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_google_updated_at();
