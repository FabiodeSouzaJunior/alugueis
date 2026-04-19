-- Hardening for recurring payments automation infrastructure.
-- Note: pg_net schema placement is platform-managed in this project.

DROP POLICY IF EXISTS payment_automation_runs_service_role_all
  ON public.payment_automation_runs;

CREATE POLICY payment_automation_runs_service_role_all
  ON public.payment_automation_runs
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING ((auth.role()) = 'service_role')
  WITH CHECK ((auth.role()) = 'service_role');
