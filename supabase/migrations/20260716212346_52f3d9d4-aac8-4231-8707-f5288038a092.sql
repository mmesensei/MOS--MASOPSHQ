-- Channel enum for income opportunities
CREATE TYPE public.income_channel AS ENUM ('digital', 'ecom', 'affiliate', 'brokerage');
CREATE TYPE public.opportunity_status AS ENUM ('proposed', 'approved', 'active', 'completed', 'killed', 'rejected');
CREATE TYPE public.goal_status AS ENUM ('active', 'paused', 'completed', 'abandoned');

-- Compounding goals: capital, target, autonomy
CREATE TABLE public.compounding_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starting_capital numeric(12,2) NOT NULL CHECK (starting_capital >= 0),
  current_capital numeric(12,2) NOT NULL DEFAULT 0 CHECK (current_capital >= 0),
  target_capital numeric(12,2) NOT NULL CHECK (target_capital > 0),
  timeframe_days integer NOT NULL CHECK (timeframe_days > 0),
  risk_tolerance smallint NOT NULL DEFAULT 3 CHECK (risk_tolerance BETWEEN 1 AND 5),
  autonomy_threshold_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK (autonomy_threshold_usd >= 0),
  status public.goal_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compounding_goals TO authenticated;
GRANT ALL ON public.compounding_goals TO service_role;
ALTER TABLE public.compounding_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own goals"
  ON public.compounding_goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER touch_compounding_goals BEFORE UPDATE ON public.compounding_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_compounding_goals_user_status ON public.compounding_goals(user_id, status);

-- Income opportunities: IRIS-surfaced plays
CREATE TABLE public.income_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.compounding_goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  thesis text NOT NULL,
  channel public.income_channel NOT NULL,
  capital_required numeric(12,2) NOT NULL CHECK (capital_required >= 0),
  projected_return_usd numeric(12,2) NOT NULL DEFAULT 0,
  projected_roi_pct numeric(8,2) NOT NULL DEFAULT 0,
  timeframe_days integer NOT NULL CHECK (timeframe_days > 0),
  risk_score smallint NOT NULL CHECK (risk_score BETWEEN 1 AND 5),
  effort_score smallint NOT NULL CHECK (effort_score BETWEEN 1 AND 5),
  confidence smallint NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  playbook jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence text,
  status public.opportunity_status NOT NULL DEFAULT 'proposed',
  staged_by_exec text NOT NULL DEFAULT 'iris',
  kill_reason text,
  actual_return_usd numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_opportunities TO authenticated;
GRANT ALL ON public.income_opportunities TO service_role;
ALTER TABLE public.income_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own opportunities"
  ON public.income_opportunities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER touch_income_opportunities BEFORE UPDATE ON public.income_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_income_opportunities_user_status ON public.income_opportunities(user_id, status);
CREATE INDEX idx_income_opportunities_goal ON public.income_opportunities(goal_id);