
-- 1. Restrict founding_vip_config SELECT to owner only
DROP POLICY IF EXISTS "Authenticated can read config" ON public.founding_vip_config;
DROP POLICY IF EXISTS "Anyone can read vip config" ON public.founding_vip_config;
DROP POLICY IF EXISTS "read config" ON public.founding_vip_config;

CREATE POLICY "Owner reads vip config"
  ON public.founding_vip_config
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_owner());

-- 2. Revoke public/anon EXECUTE on privileged SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_is_owner() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owner_set_promotion(boolean, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owner_manual_grant_vip(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owner_flag_fraud(uuid, boolean, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owner_revoke_vip(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owner_restore_vip(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_founding_vip(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_engine_quota(text, integer, integer, jsonb) FROM anon, PUBLIC;

-- Re-grant to authenticated where callable by signed-in users
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_set_promotion(boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_manual_grant_vip(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_flag_fraud(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_revoke_vip(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_restore_vip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_engine_quota(text, integer, integer, jsonb) TO authenticated;
-- assign_founding_vip is called only by the auth.users trigger under SECURITY DEFINER;
-- no role needs direct EXECUTE. Grant to service_role for admin/maintenance only.
GRANT EXECUTE ON FUNCTION public.assign_founding_vip(uuid, text) TO service_role;
