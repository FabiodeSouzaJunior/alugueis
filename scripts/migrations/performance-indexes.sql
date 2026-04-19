CREATE INDEX IF NOT EXISTS tenants_status_property_idx
  ON public.tenants (status, property_id);

CREATE INDEX IF NOT EXISTS tenants_payment_responsible_true_idx
  ON public.tenants (is_payment_responsible)
  WHERE is_payment_responsible = true;

CREATE INDEX IF NOT EXISTS tenants_email_lower_idx
  ON public.tenants (lower(email));

CREATE INDEX IF NOT EXISTS property_units_tenant_id_idx
  ON public.property_units (tenant_id);

CREATE INDEX IF NOT EXISTS property_units_property_id_idx
  ON public.property_units (property_id);

CREATE INDEX IF NOT EXISTS notifications_unread_created_idx
  ON public.notifications (created_at DESC)
  WHERE read_at IS NULL;
