-- Migración: Crear tablas documentos_clinicos, notas_debito, notas_credito y agregar columnas faltantes a pagos

BEGIN;

-- 1. TABLA DOCUMENTOS_CLINICOS
CREATE TABLE IF NOT EXISTS public.documentos_clinicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo TEXT,
  titulo TEXT,
  contenido TEXT,
  receta_items JSONB,
  firmado BOOLEAN DEFAULT false,
  firma_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA NOTAS_DEBITO
CREATE TABLE IF NOT EXISTS public.notas_debito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  paciente_id UUID,
  factura_id UUID,
  monto NUMERIC(12,2) DEFAULT 0,
  estado TEXT DEFAULT 'Activo',
  referencia TEXT,
  notas TEXT,
  nro_consecutivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA NOTAS_CREDITO
CREATE TABLE IF NOT EXISTS public.notas_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  paciente_id UUID,
  factura_id UUID,
  monto NUMERIC(12,2) DEFAULT 0,
  estado TEXT DEFAULT 'Activo',
  referencia TEXT,
  notas TEXT,
  nro_consecutivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. AGREGAR COLUMNAS FALTANTES A PAGOS
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
  ADD COLUMN IF NOT EXISTS anulado_por TEXT,
  ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nro_consecutivo TEXT,
  ADD COLUMN IF NOT EXISTS consecutivo TEXT,
  ADD COLUMN IF NOT EXISTS registrado_por TEXT,
  ADD COLUMN IF NOT EXISTS usuario_nombre TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMIT;

NOTIFY pgrst, 'reload schema';
