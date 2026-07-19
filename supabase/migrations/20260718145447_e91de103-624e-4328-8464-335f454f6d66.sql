
CREATE TABLE public.sentinel_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  provider text NOT NULL,
  model text,
  capability text NOT NULL,
  executive_id text,
  subsystem text NOT NULL,
  workflow_id uuid,
  task_id uuid,
  mission_id uuid,
  cost_micro_usd bigint NOT NULL DEFAULT 0,
  estimated_micro_usd bigint,
  latency_ms integer,
  outcome text NOT NULL DEFAULT 'success',
  event_id uuid,
  dedupe_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sentinel_cost_ledger_dedupe ON public.sentinel_cost_ledger(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX sentinel_cost_ledger_user_day ON public.sentinel_cost_ledger(user_id, day DESC);
CREATE INDEX sentinel_cost_ledger_user_provider_day ON public.sentinel_cost_ledger(user_id, provider, day DESC);
CREATE INDEX sentinel_cost_ledger_user_capability_day ON public.sentinel_cost_ledger(user_id, capability, day DESC);
CREATE INDEX sentinel_cost_ledger_user_executive_day ON public.sentinel_cost_ledger(user_id, executive_id, day DESC);
GRANT SELECT ON public.sentinel_cost_ledger TO authenticated;
GRANT ALL ON public.sentinel_cost_ledger TO service_role;
ALTER TABLE public.sentinel_cost_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own cost ledger" ON public.sentinel_cost_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.sentinel_budget_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  scope_key text,
  mode text NOT NULL DEFAULT 'monitor',
  limit_micro_usd bigint NOT NULL,
  window_kind text NOT NULL DEFAULT 'day',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, scope, scope_key, window_kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentinel_budget_policies TO authenticated;
GRANT ALL ON public.sentinel_budget_policies TO service_role;
ALTER TABLE public.sentinel_budget_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages own budget policies" ON public.sentinel_budget_policies FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_owner(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_owner(auth.uid()));
CREATE TRIGGER sentinel_budget_policies_touch BEFORE UPDATE ON public.sentinel_budget_policies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sentinel_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  capability text NOT NULL,
  availability numeric NOT NULL DEFAULT 1.0,
  error_rate numeric NOT NULL DEFAULT 0.0,
  timeout_rate numeric NOT NULL DEFAULT 0.0,
  avg_latency_ms integer NOT NULL DEFAULT 0,
  p95_latency_ms integer NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  sample_count integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  administratively_disabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, capability)
);
GRANT SELECT ON public.sentinel_provider_health TO authenticated;
GRANT UPDATE(administratively_disabled) ON public.sentinel_provider_health TO authenticated;
GRANT ALL ON public.sentinel_provider_health TO service_role;
ALTER TABLE public.sentinel_provider_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own provider health" ON public.sentinel_provider_health FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner toggles provider disable" ON public.sentinel_provider_health FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_owner(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_owner(auth.uid()));

CREATE TABLE public.sentinel_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anomaly_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  confidence numeric NOT NULL DEFAULT 0.5,
  observed_value numeric,
  baseline_value numeric,
  provider text,
  capability text,
  executive_id text,
  workflow_id uuid,
  task_id uuid,
  subsystem text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_response text,
  status text NOT NULL DEFAULT 'open',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  dedupe_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX sentinel_anomalies_dedupe ON public.sentinel_anomalies(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'open';
CREATE INDEX sentinel_anomalies_user_status ON public.sentinel_anomalies(user_id, status, detected_at DESC);
GRANT SELECT, UPDATE ON public.sentinel_anomalies TO authenticated;
GRANT ALL ON public.sentinel_anomalies TO service_role;
ALTER TABLE public.sentinel_anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own anomalies" ON public.sentinel_anomalies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner resolves own anomalies" ON public.sentinel_anomalies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_owner(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_owner(auth.uid()));

CREATE TABLE public.sentinel_runtime_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kill_switch_active boolean NOT NULL DEFAULT false,
  kill_switch_reason text,
  kill_switch_actor uuid,
  kill_switch_activated_at timestamptz,
  disabled_bindings jsonb NOT NULL DEFAULT '[]'::jsonb,
  fail_policy text NOT NULL DEFAULT 'closed',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sentinel_runtime_state TO authenticated;
GRANT ALL ON public.sentinel_runtime_state TO service_role;
ALTER TABLE public.sentinel_runtime_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own runtime state" ON public.sentinel_runtime_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner writes own runtime state" ON public.sentinel_runtime_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_owner(auth.uid()));
CREATE POLICY "owner updates own runtime state" ON public.sentinel_runtime_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_owner(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_owner(auth.uid()));
CREATE TRIGGER sentinel_runtime_state_touch BEFORE UPDATE ON public.sentinel_runtime_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
