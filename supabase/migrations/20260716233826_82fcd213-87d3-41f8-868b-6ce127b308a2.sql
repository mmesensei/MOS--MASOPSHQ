-- Lock admin_config reads to admins only (paypal_handle is sensitive).
DROP POLICY IF EXISTS "Authenticated read admin_config" ON public.admin_config;

-- Scope committee_* admin policies to ownership on both USING and WITH CHECK,
-- so an admin cannot read/update/delete another operator's committee rows.
DROP POLICY IF EXISTS "committee_reviews admin all" ON public.committee_reviews;
CREATE POLICY "committee_reviews admin owner all" ON public.committee_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

DROP POLICY IF EXISTS "committee_positions admin all" ON public.committee_positions;
CREATE POLICY "committee_positions admin owner all" ON public.committee_positions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

DROP POLICY IF EXISTS "committee_outcomes admin all" ON public.committee_outcomes;
CREATE POLICY "committee_outcomes admin owner all" ON public.committee_outcomes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

-- Harden has_role: revoke broad EXECUTE, grant only to authenticated (needed by RLS
-- policy evaluation and server middleware) and service_role. Anon and PUBLIC cannot call it.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;