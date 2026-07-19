
-- ============ profile columns ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founding_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_vip_number integer UNIQUE,
  ADD COLUMN IF NOT EXISTS vip_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS vip_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS vip_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS vip_revocation_reason text,
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_internal_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_notes text,
  ADD COLUMN IF NOT EXISTS fraud_flag boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD CONSTRAINT founding_vip_number_range CHECK (founding_vip_number IS NULL OR (founding_vip_number BETWEEN 1 AND 100));

-- ============ founding_vip_config (singleton) ============
CREATE TABLE IF NOT EXISTS public.founding_vip_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_positions integer NOT NULL DEFAULT 100,
  paused boolean NOT NULL DEFAULT false,
  closed boolean NOT NULL DEFAULT false,
  granted_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.founding_vip_config (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.founding_vip_config TO authenticated;
GRANT ALL ON public.founding_vip_config TO service_role;
ALTER TABLE public.founding_vip_config ENABLE ROW LEVEL SECURITY;

-- ============ internal_email_domains ============
CREATE TABLE IF NOT EXISTS public.internal_email_domains (
  domain text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_email_domains TO authenticated;
GRANT ALL ON public.internal_email_domains TO service_role;
ALTER TABLE public.internal_email_domains ENABLE ROW LEVEL SECURITY;

-- ============ founding_vip_audit ============
CREATE TABLE IF NOT EXISTS public.founding_vip_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.founding_vip_audit TO authenticated;
GRANT ALL ON public.founding_vip_audit TO service_role;
ALTER TABLE public.founding_vip_audit ENABLE ROW LEVEL SECURITY;

-- audit is append-only: block UPDATE/DELETE via lack of policy + explicit revoke
REVOKE UPDATE, DELETE ON public.founding_vip_audit FROM authenticated;

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) = 'senseithaguy@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner(auth.uid());
$$;

-- ============ RLS policies ============

-- founding_vip_config: authenticated read, owner-only write
DROP POLICY IF EXISTS "vip_config_read" ON public.founding_vip_config;
CREATE POLICY "vip_config_read" ON public.founding_vip_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "vip_config_owner_write" ON public.founding_vip_config;
CREATE POLICY "vip_config_owner_write" ON public.founding_vip_config
  FOR UPDATE TO authenticated
  USING (public.current_user_is_owner())
  WITH CHECK (public.current_user_is_owner());

-- internal_email_domains: owner only
DROP POLICY IF EXISTS "internal_domains_owner" ON public.internal_email_domains;
CREATE POLICY "internal_domains_owner" ON public.internal_email_domains
  FOR ALL TO authenticated
  USING (public.current_user_is_owner())
  WITH CHECK (public.current_user_is_owner());

-- audit: owner reads all; users can see their own audit rows
DROP POLICY IF EXISTS "audit_owner_read" ON public.founding_vip_audit;
CREATE POLICY "audit_owner_read" ON public.founding_vip_audit
  FOR SELECT TO authenticated
  USING (public.current_user_is_owner() OR user_id = auth.uid());
-- no INSERT policy: writes flow through SECURITY DEFINER functions

-- profiles: owner can read all
DROP POLICY IF EXISTS "owner_read_all_profiles" ON public.profiles;
CREATE POLICY "owner_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.current_user_is_owner());

-- ============ profile column protection ============
-- Users cannot self-modify VIP / subscription / internal / fraud / notes fields.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_owner(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.is_founding_vip         := OLD.is_founding_vip;
  NEW.founding_vip_number     := OLD.founding_vip_number;
  NEW.vip_granted_at          := OLD.vip_granted_at;
  NEW.vip_status              := OLD.vip_status;
  NEW.vip_revoked_at          := OLD.vip_revoked_at;
  NEW.vip_revocation_reason   := OLD.vip_revocation_reason;
  NEW.subscription_tier       := OLD.subscription_tier;
  NEW.subscription_price_cents:= OLD.subscription_price_cents;
  NEW.is_internal_account     := OLD.is_internal_account;
  NEW.owner_notes             := OLD.owner_notes;
  NEW.fraud_flag              := OLD.fraud_flag;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileged ON public.profiles;
CREATE TRIGGER profiles_protect_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ============ atomic VIP assignment ============
CREATE OR REPLACE FUNCTION public.assign_founding_vip(_user_id uuid, _email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg record;
  _domain text;
  _next int;
  _already_vip boolean;
  _is_internal boolean;
BEGIN
  -- Skip owner
  IF lower(_email) = 'senseithaguy@gmail.com' THEN
    RETURN;
  END IF;

  -- Skip if already flagged internal or already VIP
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

  -- Skip if user has admin role
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN;
  END IF;

  -- Atomic slot allocation: lock config row
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
$$;

-- ============ auth.users trigger ============
CREATE OR REPLACE FUNCTION public.on_auth_user_verified_grant_vip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure profile row exists (handle_new_user should already create it)
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  -- Owner auto-promotion
  IF lower(NEW.email) = 'senseithaguy@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  -- VIP grant only after email verification
  IF NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.assign_founding_vip(NEW.id, NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_verified_grant_vip_ins ON auth.users;
CREATE TRIGGER on_auth_user_verified_grant_vip_ins
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_verified_grant_vip();

DROP TRIGGER IF EXISTS on_auth_user_verified_grant_vip_upd ON auth.users;
CREATE TRIGGER on_auth_user_verified_grant_vip_upd
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.on_auth_user_verified_grant_vip();

-- ============ owner action functions ============
CREATE OR REPLACE FUNCTION public.owner_revoke_vip(_user_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_owner() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles
     SET vip_status = 'revoked',
         vip_revoked_at = now(),
         vip_revocation_reason = _reason,
         subscription_tier = 'free',
         subscription_price_cents = 0
   WHERE id = _user_id;
  INSERT INTO public.founding_vip_audit (user_id, actor_id, action, metadata)
  VALUES (_user_id, auth.uid(), 'revoked', jsonb_build_object('reason', _reason));
END; $$;

CREATE OR REPLACE FUNCTION public.owner_restore_vip(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_owner() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles
     SET vip_status = 'active',
         vip_revoked_at = NULL,
         vip_revocation_reason = NULL,
         subscription_tier = 'founding_vip',
         subscription_price_cents = 0
   WHERE id = _user_id AND is_founding_vip = true;
  INSERT INTO public.founding_vip_audit (user_id, actor_id, action, metadata)
  VALUES (_user_id, auth.uid(), 'restored', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_set_promotion(_paused boolean, _closed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_owner() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.founding_vip_config
     SET paused = _paused, closed = _closed, updated_at = now()
   WHERE id = 1;
  INSERT INTO public.founding_vip_audit (user_id, actor_id, action, metadata)
  VALUES (NULL, auth.uid(), 'promotion_state_changed',
          jsonb_build_object('paused', _paused, 'closed', _closed));
END; $$;

CREATE OR REPLACE FUNCTION public.owner_manual_grant_vip(_user_id uuid, _number int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_owner() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _number < 1 OR _number > 100 THEN RAISE EXCEPTION 'number out of range'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE founding_vip_number = _number)
    THEN RAISE EXCEPTION 'position % already assigned', _number; END IF;
  UPDATE public.profiles
     SET is_founding_vip = true,
         founding_vip_number = _number,
         vip_granted_at = now(),
         vip_status = 'active',
         subscription_tier = 'founding_vip',
         subscription_price_cents = 0
   WHERE id = _user_id;
  UPDATE public.founding_vip_config
     SET granted_count = GREATEST(granted_count, _number), updated_at = now()
   WHERE id = 1;
  INSERT INTO public.founding_vip_audit (user_id, actor_id, action, metadata)
  VALUES (_user_id, auth.uid(), 'manual_grant', jsonb_build_object('number', _number));
END; $$;

CREATE OR REPLACE FUNCTION public.owner_flag_fraud(_user_id uuid, _flag boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_owner() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET fraud_flag = _flag,
    owner_notes = COALESCE(_note, owner_notes) WHERE id = _user_id;
  INSERT INTO public.founding_vip_audit (user_id, actor_id, action, metadata)
  VALUES (_user_id, auth.uid(), 'fraud_flag', jsonb_build_object('flag', _flag, 'note', _note));
END; $$;
