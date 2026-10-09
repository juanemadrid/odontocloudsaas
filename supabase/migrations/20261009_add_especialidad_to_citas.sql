-- OdontoCloud SaaS — Migración: Agregar columna especialidad a la tabla public.citas
-- Destino: Servicio 2 OdontoCloud (Coolify, VPS 150.136.210.37). NO toca Edunexus.

BEGIN;

ALTER TABLE public.citas
  ADD COLUMN IF NOT EXISTS especialidad TEXT;

COMMIT;

NOTIFY pgrst, 'reload schema';
