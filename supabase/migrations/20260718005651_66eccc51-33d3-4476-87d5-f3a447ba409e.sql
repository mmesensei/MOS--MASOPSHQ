
-- Update owner auto-promotion trigger to use new founder email
CREATE OR REPLACE FUNCTION public.on_auth_user_verified_grant_vip()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'mmesensei@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  IF NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.assign_founding_vip(NEW.id, NEW.email);
  END IF;

  RETURN NEW;
END;
$function$;

-- Update VIP assignment to skip the new owner email
CREATE OR REPLACE FUNCTION public.assign_founding_vip(_user_id uuid, _email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cfg record;
  _domain text;
  _next int;
  _already_vip boolean;
  _is_internal boolean;
BEGIN
  IF lower(_email) = 'mmesensei@gmail.com' THEN
    RETURN;
  END IF;

  SELECT is_founding_vip, is_internal_account
    INTO _already_vip, _is_internal
    FROM public.profiles WHERE id = _user_id;
  IF _already_vip THEN RETURN; END IF;

  _domain := lower(split_part(_email, '@', 2));
  IF EXISTS (SELECT 1 FROM public.internal_email_domains WHERE domain = _domain) THEN
    UPDATE public.profiles SET is_internal_account = true WHERE id = _user_id;
    RETURN;
  END IF;
  IF _is_internal THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN;
  END IF;

  SELECT * INTO _cfg FROM public.founding_vip_config WHERE id = 1 FOR UPDATE;
  IF _cfg.paused OR _cfg.closed THEN RETURN; END IF;
  IF _cfg.granted_count >= _cfg.max_positions THEN RETURN; END IF;

  _next := _cfg.granted_count + 1;

  UPDATE public.profiles
     SET is_founding_vip = true,
         founding_vip_number = _next,
         vip_granted_at = now(),
         vip_status = 'active',
         subscription_tier = 'founding_vip',
         subscription_price_cents = 0
   WHERE id = _user_id;

  UPDATE public.founding_vip_config
     SET granted_count = _next, updated_at = now()
   WHERE id = 1;

  INSERT INTO public.founding_vip_audit (user_id, actor_id, action, metadata)
  VALUES (_user_id, NULL, 'granted', jsonb_build_object('number', _next, 'email', _email));
END;
$function$;

-- Grant admin role to the new owner if that account already exists
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
  FROM auth.users u
 WHERE lower(u.email) = 'mmesensei@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
