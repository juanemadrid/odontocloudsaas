-- Migration: Add missing columns to recibos_caja, movimientos_caja, and cajas
-- Run in Supabase Dashboard -> SQL Editor or directly in terminal

-- 1. Asegurar columnas completas y relajación de NOT NULL en recibos_caja
ALTER TABLE public.recibos_caja 
  ALTER COLUMN numero DROP NOT NULL,
  ALTER COLUMN monto DROP NOT NULL;

ALTER TABLE public.recibos_caja 
  ADD COLUMN IF NOT EXISTS inquilino TEXT,
  ADD COLUMN IF NOT EXISTS "nroConsecutivo" TEXT,
  ADD COLUMN IF NOT EXISTS nro_consecutivo TEXT,
  ADD COLUMN IF NOT EXISTS "profesionalId" UUID,
  ADD COLUMN IF NOT EXISTS profesional_id UUID,
  ADD COLUMN IF NOT EXISTS "profesionalNombre" TEXT,
  ADD COLUMN IF NOT EXISTS profesional_nombre TEXT,
  ADD COLUMN IF NOT EXISTS "pacienteId" UUID,
  ADD COLUMN IF NOT EXISTS "pacienteNombre" TEXT,
  ADD COLUMN IF NOT EXISTS paciente_nombre TEXT,
  ADD COLUMN IF NOT EXISTS "condicionPago" TEXT DEFAULT 'Contado',
  ADD COLUMN IF NOT EXISTS condicion_pago TEXT DEFAULT 'Contado',
  ADD COLUMN IF NOT EXISTS "medioPago" TEXT DEFAULT 'Efectivo',
  ADD COLUMN IF NOT EXISTS medio_pago TEXT DEFAULT 'Efectivo',
  ADD COLUMN IF NOT EXISTS conceptos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "descuentoTotal" NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_total NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS "cajaId" UUID,
  ADD COLUMN IF NOT EXISTS caja_id UUID,
  ADD COLUMN IF NOT EXISTS "creadoPor" TEXT,
  ADD COLUMN IF NOT EXISTS creado_por TEXT,
  ADD COLUMN IF NOT EXISTS factura_id UUID,
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo',
  ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
  ADD COLUMN IF NOT EXISTS "anuladoPor" TEXT,
  ADD COLUMN IF NOT EXISTS anulado_por TEXT,
  ADD COLUMN IF NOT EXISTS "fechaAnulacion" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMPTZ;

-- Asegurar columnas de anulación en pagos
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';

-- 2. Asegurar columnas completas en movimientos_caja
ALTER TABLE public.movimientos_caja
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS paciente_id UUID,
  ADD COLUMN IF NOT EXISTS paciente_nombre TEXT,
  ADD COLUMN IF NOT EXISTS recibo_id UUID;

-- 3. Asegurar columnas completas en cajas
ALTER TABLE public.cajas
  ADD COLUMN IF NOT EXISTS saldo_actual NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ingresos NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_egresos NUMERIC(12,2) DEFAULT 0;

-- 4. Notificar a PostgREST para recargar el esquema en caliente inmediatamente
NOTIFY pgrst, 'reload schema';
