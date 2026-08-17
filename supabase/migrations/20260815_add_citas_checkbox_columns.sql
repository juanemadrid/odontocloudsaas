-- Migración: Agregar columnas valoracion, control y enviar_correo a la tabla public.citas

BEGIN;

ALTER TABLE public.citas
  ADD COLUMN IF NOT EXISTS valoracion BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS control BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enviar_correo BOOLEAN DEFAULT true;

COMMIT;

NOTIFY pgrst, 'reload schema';
