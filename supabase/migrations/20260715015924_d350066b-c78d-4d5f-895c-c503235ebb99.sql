
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  operator_title TEXT DEFAULT 'Operator',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- executive enum
CREATE TYPE public.executive_id AS ENUM ('iris', 'apex', 'katana', 'sentinel');

-- executive threads (max 10 per exec per user)
CREATE TABLE public.executive_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  executive public.executive_id NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Feed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_threads TO authenticated;
GRANT ALL ON public.executive_threads TO service_role;
ALTER TABLE public.executive_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.executive_threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX threads_user_exec_idx ON public.executive_threads(user_id, executive, updated_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_thread_limit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE current_count INT;
BEGIN
  SELECT COUNT(*) INTO current_count FROM public.executive_threads
    WHERE user_id = NEW.user_id AND executive = NEW.executive;
  IF current_count >= 10 THEN
    RAISE EXCEPTION 'Executive feed limit reached (10). Delete a feed to open a new one.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER thread_limit_check BEFORE INSERT ON public.executive_threads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_thread_limit();

-- messages
CREATE TABLE public.executive_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.executive_threads ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_messages TO authenticated;
GRANT ALL ON public.executive_messages TO service_role;
ALTER TABLE public.executive_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.executive_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX messages_thread_idx ON public.executive_messages(thread_id, created_at ASC);

-- missions
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'Proposed',
  priority TEXT NOT NULL DEFAULT 'Medium',
  sponsor_executive public.executive_id,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own missions" ON public.missions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- institutional documents
CREATE TABLE public.institutional_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  version TEXT DEFAULT 'v1',
  source_filename TEXT,
  content TEXT NOT NULL,
  is_seed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutional_documents TO authenticated;
GRANT ALL ON public.institutional_documents TO service_role;
ALTER TABLE public.institutional_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs" ON public.institutional_documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- council sessions
CREATE TABLE public.council_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  mission_id UUID REFERENCES public.missions ON DELETE SET NULL,
  operator_request TEXT NOT NULL,
  iris_analysis TEXT,
  apex_analysis TEXT,
  katana_analysis TEXT,
  sentinel_analysis TEXT,
  final_recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'convening',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.council_sessions TO authenticated;
GRANT ALL ON public.council_sessions TO service_role;
ALTER TABLE public.council_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own councils" ON public.council_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  action TEXT NOT NULL,
  executive public.executive_id,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audits read" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own audits insert" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER threads_touch BEFORE UPDATE ON public.executive_threads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER missions_touch BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER council_touch BEFORE UPDATE ON public.council_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
