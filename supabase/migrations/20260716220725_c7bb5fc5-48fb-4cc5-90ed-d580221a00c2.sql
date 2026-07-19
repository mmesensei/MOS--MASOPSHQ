
-- ============ COMMITTEE REVIEWS ============
CREATE TABLE public.committee_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('opportunity','mission','manual','sop','system')),
  subject_id UUID,
  title TEXT NOT NULL,
  summary TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  phase TEXT NOT NULL DEFAULT 'proposing'
    CHECK (phase IN ('proposing','reviewing','challenging','deliberating','decided','error')),
  current_speaker TEXT,
  strategic_score INT,
  operational_score INT,
  execution_score INT,
  risk_score INT,
  confidence_score INT,
  alignment_score INT,
  decision TEXT CHECK (decision IN ('approve','approve_with_conditions','run_pilot','request_more_data','reject')),
  decision_rationale TEXT,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  memory_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_reviews TO authenticated;
GRANT ALL ON public.committee_reviews TO service_role;
ALTER TABLE public.committee_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "committee_reviews admin all"
  ON public.committee_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

CREATE INDEX committee_reviews_subject_idx ON public.committee_reviews(subject_type, subject_id);
CREATE INDEX committee_reviews_user_created_idx ON public.committee_reviews(user_id, created_at DESC);

CREATE TRIGGER committee_reviews_touch
  BEFORE UPDATE ON public.committee_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COMMITTEE POSITIONS ============
CREATE TABLE public.committee_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.committee_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  executive TEXT NOT NULL CHECK (executive IN ('iris','apex','katana','sentinel')),
  stance TEXT NOT NULL DEFAULT 'thinking'
    CHECK (stance IN ('thinking','agree','partial','challenge','escalate','abstain')),
  confidence INT CHECK (confidence BETWEEN 0 AND 100),
  key_concern TEXT,
  rationale TEXT,
  recommendation TEXT,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  speaking_order INT NOT NULL DEFAULT 0,
  is_streaming BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, executive)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_positions TO authenticated;
GRANT ALL ON public.committee_positions TO service_role;
ALTER TABLE public.committee_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "committee_positions admin all"
  ON public.committee_positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

CREATE INDEX committee_positions_review_idx ON public.committee_positions(review_id, speaking_order);

CREATE TRIGGER committee_positions_touch
  BEFORE UPDATE ON public.committee_positions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COMMITTEE OUTCOMES ============
CREATE TABLE public.committee_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.committee_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('win','loss','partial','abandoned','pending')),
  predicted_roi_pct NUMERIC,
  actual_roi_pct NUMERIC,
  predicted_effort_hours NUMERIC,
  actual_effort_hours NUMERIC,
  predicted_risk INT,
  actual_risk INT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_outcomes TO authenticated;
GRANT ALL ON public.committee_outcomes TO service_role;
ALTER TABLE public.committee_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "committee_outcomes admin all"
  ON public.committee_outcomes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

CREATE INDEX committee_outcomes_user_recorded_idx ON public.committee_outcomes(user_id, recorded_at DESC);

CREATE TRIGGER committee_outcomes_touch
  BEFORE UPDATE ON public.committee_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ REALTIME (for live boardroom streaming) ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.committee_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.committee_positions;

-- ============ LINK OPPORTUNITY -> REVIEW (optional, for engine wiring) ============
ALTER TABLE public.income_opportunities
  ADD COLUMN IF NOT EXISTS committee_review_id UUID
  REFERENCES public.committee_reviews(id) ON DELETE SET NULL;
