-- Migración para solucionar el error: Could not find the 'activo' column of 'agenda_abierta' in the schema cache
-- Esta migración asegura que la tabla agenda_abierta y demás tablas de agenda contengan la columna `activo` y demás campos necesarios.

BEGIN;

-- 1. TABLA agenda_abierta
ALTER TABLE public.agenda_abierta
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS usuario_id UUID,
  ADD COLUMN IF NOT EXISTS consultorio_id UUID,
  ADD COLUMN IF NOT EXISTS fecha DATE,
  ADD COLUMN IF NOT EXISTS hora_inicio TIME,
  ADD COLUMN IF NOT EXISTS hora_fin TIME,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Si existen columnas heredadas (ej. profesional_id o disponible), sincronizar datos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agenda_abierta' AND column_name = 'profesional_id'
  ) THEN
    UPDATE public.agenda_abierta SET usuario_id = profesional_id WHERE usuario_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agenda_abierta' AND column_name = 'disponible'
  ) THEN
    UPDATE public.agenda_abierta SET activo = disponible WHERE activo IS NULL;
  END IF;
END $$;

-- 2. TABLA horarios_predefinidos
ALTER TABLE public.horarios_predefinidos
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS usuario_id UUID,
  ADD COLUMN IF NOT EXISTS consultorio_id UUID,
  ADD COLUMN IF NOT EXISTS dia TEXT,
  ADD COLUMN IF NOT EXISTS recurso_nombre TEXT,
  ADD COLUMN IF NOT EXISTS hora_inicio TIME,
  ADD COLUMN IF NOT EXISTS hora_fin TIME,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. TABLA no_disponibles
ALTER TABLE public.no_disponibles
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS usuario_id UUID,
  ADD COLUMN IF NOT EXISTS consultorio_id UUID,
  ADD COLUMN IF NOT EXISTS fecha DATE,
  ADD COLUMN IF NOT EXISTS hora_inicio TIME,
  ADD COLUMN IF NOT EXISTS hora_fin TIME,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMIT;

-- 4. Notificar a PostgREST para recargar la caché del esquema inmediatamente
NOTIFY pgrst, 'reload schema';
