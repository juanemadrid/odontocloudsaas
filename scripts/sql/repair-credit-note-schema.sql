-- Target: OdontoCloud self-hosted database. No invoices or credit notes are emitted.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF to_regclass('public.facturas') IS NULL OR to_regclass('public.notas_credito') IS NULL THEN
    RAISE EXCEPTION 'Expected OdontoCloud billing tables are missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('public.facturas'::regclass, 'public.notas_credito'::regclass) AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'Billing RLS must already be enabled; refusing to bypass clinic isolation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notas_credito' AND cmd IN ('ALL','SELECT')) THEN
    RAISE EXCEPTION 'Credit note RLS read policy is missing; inspect database policies first';
  END IF;
END $$;

ALTER TABLE public.notas_credito
  ADD COLUMN IF NOT EXISTS paciente_id UUID,
  ADD COLUMN IF NOT EXISTS concepto TEXT,
  ADD COLUMN IF NOT EXISTS cude TEXT,
  ADD COLUMN IF NOT EXISTS dian_status TEXT DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS correction_concept_code TEXT,
  ADD COLUMN IF NOT EXISTS customization_id INT DEFAULT 20,
  ADD COLUMN IF NOT EXISTS tipo_nota_credito TEXT DEFAULT 'TOTAL',
  ADD COLUMN IF NOT EXISTS monto_acreditado NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS factus_response JSONB,
  ADD COLUMN IF NOT EXISTS items JSONB,
  ADD COLUMN IF NOT EXISTS detalles JSONB DEFAULT '{}'::jsonb;

-- A local draft has no fiscal number yet. Keep NOT NULL and use an explicit draft label.
ALTER TABLE public.notas_credito
  ALTER COLUMN numero SET DEFAULT ('BORRADOR-NC-' || gen_random_uuid()::text),
  ALTER COLUMN monto SET DEFAULT 0,
  ALTER COLUMN concepto SET DEFAULT 'Nota Crédito Electrónica';

CREATE UNIQUE INDEX IF NOT EXISTS uq_notas_credito_reference_code
  ON public.notas_credito (tenant_id, reference_code) WHERE reference_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notas_credito_balance
  ON public.notas_credito (tenant_id, factura_id) WHERE dian_status = 'ACCEPTED';

CREATE OR REPLACE FUNCTION public.get_factura_credited_balance(p_tenant_id UUID, p_factura_id UUID)
RETURNS TABLE(total_factura NUMERIC, total_acreditado NUMERIC, saldo_disponible NUMERIC, nc_count INT, fiscal_status TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_credited NUMERIC;
  v_count INT;
BEGIN
  -- SECURITY INVOKER retains the caller's existing tenant RLS on both tables.
  SELECT f.total INTO v_total FROM public.facturas f
    WHERE f.id=p_factura_id AND f.tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada para la clínica autorizada'; END IF;
  IF v_total IS NULL OR v_total < 0 THEN RAISE EXCEPTION 'Total fiscal inválido'; END IF;

  SELECT COALESCE(SUM(COALESCE(n.monto_acreditado,n.monto,0)),0), COUNT(*)::INT
    INTO v_credited,v_count FROM public.notas_credito n
    WHERE n.factura_id=p_factura_id AND n.tenant_id=p_tenant_id AND n.dian_status='ACCEPTED';
  RETURN QUERY SELECT v_total,v_credited,GREATEST(0::NUMERIC,v_total-v_credited),v_count,
    CASE WHEN v_credited=0 THEN 'NONE' WHEN v_credited>=v_total THEN 'FULLY_CREDITED' ELSE 'PARTIALLY_CREDITED' END;
END $$;

REVOKE ALL ON FUNCTION public.get_factura_credited_balance(UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_factura_credited_balance(UUID,UUID) TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.notas_credito TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
