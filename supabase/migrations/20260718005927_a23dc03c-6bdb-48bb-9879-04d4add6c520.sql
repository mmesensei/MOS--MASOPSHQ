
REVOKE EXECUTE ON FUNCTION public.assign_founding_vip(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_verified_grant_vip() FROM PUBLIC, anon, authenticated;
