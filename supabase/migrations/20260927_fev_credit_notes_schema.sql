-- Migration: 20260927_fev_credit_notes_schema.sql
-- Fase P1-FEV3B: Implementación Nota Crédito Electrónica Factus / DIAN
-- Agrega columnas electrónicas a public.notas_credito, índices y RPC de recálculo de saldo.

-- 1. Defaults seguros para compatibilidad hacia atrás
ALTER TABLE public.notas_credito 
  ALTER COLUMN fecha SET DEFAULT CURRENT_DATE,
  ALTER COLUMN monto SET DEFAULT 0,
  ALTER COLUMN concepto SET DEFAULT 'Nota Crédito Electrónica';

-- 2. Columnas electrónicas
ALTER TABLE public.notas_credito
  ADD COLUMN IF NOT EXISTS cude TEXT,
  ADD COLUMN IF NOT EXISTS dian_status TEXT DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS correction_concept_code TEXT,
  ADD COLUMN IF NOT EXISTS customization_id INT DEFAULT 20,
  ADD COLUMN IF NOT EXISTS tipo_nota_credito TEXT DEFAULT 'TOTAL',
  ADD COLUMN IF NOT EXISTS monto_acreditado NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS factus_response JSONB,
  ADD COLUMN IF NOT EXISTS items JSONB,
  ADD COLUMN IF NOT EXISTS detalles JSONB DEFAULT '{}'::jsonb;

-- 3. Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_notas_credito_dian_status'
  ) THEN
    ALTER TABLE public.notas_credito
      ADD CONSTRAINT chk_notas_credito_dian_status
      CHECK (dian_status IN ('DRAFT', 'PENDING', 'INDETERMINATE', 'REJECTED', 'ACCEPTED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_notas_credito_tipo'
  ) THEN
    ALTER TABLE public.notas_credito
      ADD CONSTRAINT chk_notas_credito_tipo
      CHECK (tipo_nota_credito IN ('TOTAL', 'PARCIAL'));
  END IF;
END $$;

-- 4. Índices
CREATE UNIQUE INDEX IF NOT EXISTS uq_notas_credito_reference_code 
  ON public.notas_credito (tenant_id, reference_code) 
  WHERE reference_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notas_credito_cude 
  ON public.notas_credito (cude);

CREATE INDEX IF NOT EXISTS idx_notas_credito_dian_status 
  ON public.notas_credito (dian_status);

-- 5. RPC Atómica para verificación de saldo fiscal acreditable
CREATE OR REPLACE FUNCTION public.get_factura_credited_balance(
  p_tenant_id UUID,
  p_factura_id UUID
)
RETURNS TABLE (
  total_factura NUMERIC,
  total_acreditado NUMERIC,
  saldo_disponible NUMERIC,
  nc_count INT,
  fiscal_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura RECORD;
  v_acreditado NUMERIC := 0;
  v_count INT := 0;
BEGIN
  SELECT total INTO v_factura
  FROM public.facturas
  WHERE id = p_factura_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada para el tenant especificado.';
  END IF;

  SELECT COALESCE(SUM(COALESCE(monto_acreditado, monto, 0)), 0), COUNT(*)
  INTO v_acreditado, v_count
  FROM public.notas_credito
  WHERE factura_id = p_factura_id
    AND tenant_id = p_tenant_id
    AND dian_status = 'ACCEPTED';

  total_factura := COALESCE(v_factura.total, 0);
  total_acreditado := v_acreditado;
  saldo_disponible := GREATEST(0, COALESCE(v_factura.total, 0) - v_acreditado);
  nc_count := v_count;

  IF v_acreditado = 0 THEN
    fiscal_status := 'NONE';
  ELSIF v_acreditado >= COALESCE(v_factura.total, 0) THEN
    fiscal_status := 'FULLY_CREDITED';
  ELSE
    fiscal_status := 'PARTIALLY_CREDITED';
  END IF;

  RETURN NEXT;
END;
$$;

-- Permisos
GRANT ALL ON public.notas_credito TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_factura_credited_balance TO authenticated, service_role, anon;
