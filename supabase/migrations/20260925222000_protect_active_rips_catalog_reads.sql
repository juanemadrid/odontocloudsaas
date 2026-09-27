-- ==============================================================================
-- MIGRACIÓN: 20260925222000_protect_active_rips_catalog_reads.sql
-- MICROFASE 6A.1F-1F-C: Protección de Lectura ACTIVE para CUPSRips
--
-- Contenido:
--   1. RPC public.get_active_rips_catalog_version(TEXT):
--      - STABLE, SECURITY DEFINER, search_path = ''.
--      - Valida p_catalogo NOT NULL/NOT EMPTY ('CATALOG_NAME_REQUIRED').
--      - Retorna version ACTIVE o NULL (cero fallback).
--      - REVOKE ALL FROM PUBLIC, anon; GRANT TO authenticated, service_role.
--   2. RLS AS RESTRICTIVE sobre public.rips_catalogos:
--      - rips_catalogos_cupsrips_active_authenticated: Para authenticated, solo
--        permite CUPSRips si activo = true y version = get_active_rips_catalog_version('CUPSRips').
--        Los demás catálogos conservan su comportamiento preexistente.
--      - rips_catalogos_cupsrips_block_anon: Para anon, bloquea el 100% de filas CUPSRips.
--        Los demás catálogos conservan su comportamiento preexistente.
--   3. Cero modificaciones destructivas: NO drop ni alter a políticas existentes.
-- ==============================================================================

-- 1. RPC para Resolver la Versión ACTIVE Oficial de un Catálogo
CREATE OR REPLACE FUNCTION public.get_active_rips_catalog_version(
  p_catalogo TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version TEXT;
BEGIN
  -- Validación de parámetro obligatorio
  IF p_catalogo IS NULL OR pg_catalog.btrim(p_catalogo) = '' THEN
    RAISE EXCEPTION 'CATALOG_NAME_REQUIRED: El parámetro p_catalogo es obligatorio y no puede ser vacío';
  END IF;

  -- Búsqueda estricta de la versión ACTIVE en el manifest
  SELECT version INTO v_version
  FROM public.rips_catalogo_snapshots
  WHERE catalogo = p_catalogo AND status = 'ACTIVE';

  RETURN v_version;
END;
$$;

-- 2. Asignación de Permisos sobre la RPC
REVOKE ALL ON FUNCTION public.get_active_rips_catalog_version(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_rips_catalog_version(TEXT) FROM anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_active_rips_catalog_version(TEXT) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_active_rips_catalog_version(TEXT) TO service_role';
  END IF;
END $$;

-- 3. Política RESTRICTIVE para Usuarios Autenticados (Clínicas / Operacional)
CREATE POLICY rips_catalogos_cupsrips_active_authenticated
ON public.rips_catalogos
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  catalogo <> 'CUPSRips'
  OR (
    catalogo = 'CUPSRips'
    AND activo = true
    AND version = (SELECT public.get_active_rips_catalog_version('CUPSRips'))
  )
);

-- 4. Política RESTRICTIVE para Usuarios Anónimos
CREATE POLICY rips_catalogos_cupsrips_block_anon
ON public.rips_catalogos
AS RESTRICTIVE
FOR SELECT
TO anon
USING (
  catalogo <> 'CUPSRips'
);
