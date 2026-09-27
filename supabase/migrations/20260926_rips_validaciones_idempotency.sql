-- ============================================================================
-- ODONTOCLOUD — MIGRACIÓN ATÓMICA DE IDEMPOTENCIA Y PROTECCIÓN DE CONCURRENCIA MUV
-- Archivo: 20260926_rips_validaciones_idempotency.sql
-- Fase: P0-A2B1
-- ============================================================================

-- 1. Agregar columna idempotency_key para adquisición atómica de envíos MUV
ALTER TABLE public.rips_validaciones 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Índice UNIQUE parcial para garantizar idempotencia por tenant y payload
-- Impide que dos solicitudes simultáneas con la misma clave de idempotencia se procesen concurrentemente
DROP INDEX IF EXISTS public.uq_rips_validaciones_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rips_validaciones_idempotency
ON public.rips_validaciones (tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 3. Índice UNIQUE parcial para impedir retransmisión de facturas formalmente aceptadas con CUV
-- Utiliza los estados reales confirmados en el esquema/datos ('VALIDADO' y 'valido')
DROP INDEX IF EXISTS public.uq_rips_validaciones_factura_cuv;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rips_validaciones_factura_cuv
ON public.rips_validaciones (tenant_id, factura_id)
WHERE estado IN ('VALIDADO', 'valido') 
  AND factura_id IS NOT NULL 
  AND cuv IS NOT NULL;

COMMENT ON COLUMN public.rips_validaciones.idempotency_key IS 
'Clave SHA-256 calculada exclusivamente en backend: SHA256(tenant_id || :: || factura_id || :: || cufe || :: || payload_hash)';
