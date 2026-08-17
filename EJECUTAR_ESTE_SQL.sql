-- ================================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Cambia servicio_id de UUID a TEXT en convenios_descuentos
-- para soportar IDs de items que no son UUIDs
-- ================================================================

ALTER TABLE public.convenios_descuentos
  ALTER COLUMN servicio_id TYPE TEXT USING servicio_id::TEXT;
