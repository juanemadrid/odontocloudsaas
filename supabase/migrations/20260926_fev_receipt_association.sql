-- ==============================================================================
-- Migration: 20260926_fev_receipt_association.sql
-- Module: Facturación Electrónica (FEV) & Recibos de Caja (P1-FEV1)
-- Description: Asociación persistente entre recibos_caja y facturas (FEV).
-- ==============================================================================

-- 1. Relación relacional 1:N / N:1 (recibos_caja -> facturas)
ALTER TABLE public.recibos_caja 
  ADD COLUMN IF NOT EXISTS factura_id UUID REFERENCES public.facturas(id) ON DELETE SET NULL;

-- 2. Índice de alto rendimiento para búsquedas por factura
CREATE INDEX IF NOT EXISTS idx_recibos_caja_factura_id 
  ON public.recibos_caja (factura_id);

-- 3. Comentario explicativo
COMMENT ON COLUMN public.recibos_caja.factura_id IS 'Identificador de la factura (FEV) asociada a este recibo de caja.';
