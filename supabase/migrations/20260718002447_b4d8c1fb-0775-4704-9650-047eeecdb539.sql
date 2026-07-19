-- Replace hardcoded-email owner check with role-based check.
-- The founder email is still auto-granted the 'admin' role by the existing
-- on_auth_user_verified_grant_vip trigger, so behavior is preserved while
-- owner privilege no longer depends on a hardcoded email string at check time.
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  );
$function$;