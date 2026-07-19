
CREATE TABLE public.calibration_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  roi_overshoot_weight numeric NOT NULL DEFAULT 1.0 CHECK (roi_overshoot_weight >= 0 AND roi_overshoot_weight <= 3),
  risk_underrating_weight numeric NOT NULL DEFAULT 1.0 CHECK (risk_underrating_weight >= 0 AND risk_underrating_weight <= 3),
  effort_underestimation_weight numeric NOT NULL DEFAULT 1.0 CHECK (effort_underestimation_weight >= 0 AND effort_underestimation_weight <= 3),
  accuracy_weight numeric NOT NULL DEFAULT 1.0 CHECK (accuracy_weight >= 0 AND accuracy_weight <= 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calibration_settings TO authenticated;
GRANT ALL ON public.calibration_settings TO service_role;

ALTER TABLE public.calibration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage their own calibration settings"
  ON public.calibration_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_calibration_settings_updated_at
  BEFORE UPDATE ON public.calibration_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
