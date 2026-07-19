
-- 1) Restrict founding_vip_config reads to owner only
DROP POLICY IF EXISTS "vip_config_read" ON public.founding_vip_config;
DROP POLICY IF EXISTS "vip_config_owner_read" ON public.founding_vip_config;
CREATE POLICY "vip_config_owner_read"
  ON public.founding_vip_config
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_owner());

-- 2) Revoke EXECUTE from anon and PUBLIC on all SECURITY DEFINER functions in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon;',
                   r.proname, r.args);
  END LOOP;
END $$;
