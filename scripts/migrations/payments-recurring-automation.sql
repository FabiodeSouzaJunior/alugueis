-- Enable the recurring billing automation infrastructure in Supabase.
-- Schedule: daily at 06:05 UTC (03:05 America/Sao_Paulo).

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.payment_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'scheduled',
  status text NOT NULL DEFAULT 'running',
  tenant_id text NULL,
  processed_tenants integer NOT NULL DEFAULT 0,
  created_payments integer NOT NULL DEFAULT 0,
  created_historical_payments integer NOT NULL DEFAULT 0,
  skipped_tenants integer NOT NULL DEFAULT 0,
  details jsonb NULL,
  error_message text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_automation_runs_status_check
    CHECK (status IN ('running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS payment_automation_runs_started_at_idx
  ON public.payment_automation_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS payment_automation_runs_status_idx
  ON public.payment_automation_runs (status, started_at DESC);

ALTER TABLE public.payment_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.invoke_recurring_payment_automation()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  project_url text;
  service_role_key text;
BEGIN
  SELECT decrypted_secret
    INTO project_url
    FROM vault.decrypted_secrets
   WHERE name = 'payments_automation_project_url'
   ORDER BY updated_at DESC
   LIMIT 1;

  SELECT decrypted_secret
    INTO service_role_key
    FROM vault.decrypted_secrets
   WHERE name = 'payments_automation_service_role_key'
   ORDER BY updated_at DESC
   LIMIT 1;

  IF project_url IS NULL OR project_url = '' THEN
    RAISE EXCEPTION 'Vault secret payments_automation_project_url is not configured.';
  END IF;

  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'Vault secret payments_automation_service_role_key is not configured.';
  END IF;

  request_id := net.http_post(
    url := project_url || '/functions/v1/payments-recurring-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'triggerType', 'scheduled'
    ),
    timeout_milliseconds := 300000
  );

  RETURN request_id;
END;
$$;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
    INTO existing_job_id
    FROM cron.job
   WHERE jobname = 'payments-recurring-automation-daily'
   LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'payments-recurring-automation-daily',
    '5 6 * * *',
    $job$
      SELECT public.invoke_recurring_payment_automation();
    $job$
  );
END;
$$;
