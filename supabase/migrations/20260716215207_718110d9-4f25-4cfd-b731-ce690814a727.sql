
CREATE OR REPLACE FUNCTION public.enforce_engine_quota(
  _action text,
  _per_hour int,
  _per_day int,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hour_count int;
  _day_count int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _hour_count
    FROM public.engine_action_log
   WHERE user_id = _uid AND action = _action
     AND created_at > now() - interval '1 hour';
  IF _hour_count >= _per_hour THEN
    RAISE EXCEPTION 'Rate limit: % per hour exceeded for %', _per_hour, _action
      USING ERRCODE = '54000';
  END IF;

  SELECT count(*) INTO _day_count
    FROM public.engine_action_log
   WHERE user_id = _uid AND action = _action
     AND created_at > now() - interval '24 hours';
  IF _day_count >= _per_day THEN
    RAISE EXCEPTION 'Quota: % per day exceeded for %', _per_day, _action
      USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.engine_action_log (user_id, action, metadata)
  VALUES (_uid, _action, COALESCE(_metadata, '{}'::jsonb));
END;
$$;
