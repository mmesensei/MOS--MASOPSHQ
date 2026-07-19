DROP POLICY IF EXISTS "Anyone signed in can read settings" ON public.knowledge_settings;
CREATE POLICY "Owner can read knowledge settings" ON public.knowledge_settings
  FOR SELECT TO authenticated USING (public.current_user_is_owner());