
CREATE TABLE public.app_user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  connector_id TEXT NOT NULL,
  connection_key_ciphertext TEXT NOT NULL,
  account_label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO authenticated;
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

-- Operators can see whether they have a connection and delete it, but they cannot read the ciphertext column meaningfully.
CREATE POLICY "Operators manage own connections" ON public.app_user_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER app_user_connections_touch BEFORE UPDATE ON public.app_user_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


CREATE TABLE public.vault_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'onedrive',
  remote_id TEXT NOT NULL,
  path TEXT,
  name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  modified_at TIMESTAMPTZ,
  snippet TEXT,
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'discovered',
  executive_owner TEXT,
  knowledge_type TEXT,
  department TEXT,
  sensitivity TEXT,
  priority TEXT,
  classification JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  knowledge_score NUMERIC,
  harvested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, remote_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_documents TO authenticated;
GRANT ALL ON public.vault_documents TO service_role;
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage own vault docs" ON public.vault_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER vault_documents_touch BEFORE UPDATE ON public.vault_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX vault_documents_user_status_idx ON public.vault_documents(user_id, status);
CREATE INDEX vault_documents_user_owner_idx ON public.vault_documents(user_id, executive_owner);
