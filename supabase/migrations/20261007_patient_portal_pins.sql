-- Migración para soporte de PIN de seguridad en el Portal del Paciente (Ley 1581 de 2012)
BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_portal_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_portal_pins_tenant_patient_uniq UNIQUE (tenant_id, patient_id)
);

CREATE INDEX IF NOT EXISTS patient_portal_pins_tenant_idx ON public.patient_portal_pins (tenant_id);
CREATE INDEX IF NOT EXISTS patient_portal_pins_patient_idx ON public.patient_portal_pins (patient_id);

ALTER TABLE public.patient_portal_pins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.patient_portal_pins FROM anon, authenticated;
GRANT ALL ON public.patient_portal_pins TO service_role;

COMMIT;
