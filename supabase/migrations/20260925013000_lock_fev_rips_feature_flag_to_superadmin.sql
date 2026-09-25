-- Migration: Lock FEV-RIPS feature flag write operations exclusively to superadmin
-- Asegura que ningún tenant admin, doctor o usuario de clínica pueda activar, modificar
-- o eliminar 'ENABLE_FEV_RIPS_0948' directamente mediante PostgREST / Supabase API.
-- Los usuarios activos del tenant conservan capacidad de SELECT para el gating en interfaz.

BEGIN;

-- 1. Restrictive policy para INSERT
DROP POLICY IF EXISTS tenant_feature_flags_rips_insert_restrictive ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_rips_insert_restrictive
ON public.tenant_feature_flags
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  feature_key <> 'ENABLE_FEV_RIPS_0948'
  OR (SELECT public.is_superadmin())
);

-- 2. Restrictive policy para UPDATE
-- USING previene modificar o renombrar una fila RIPS existente si no es superadmin.
-- WITH CHECK previene mutar otro flag en RIPS si no es superadmin.
DROP POLICY IF EXISTS tenant_feature_flags_rips_update_restrictive ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_rips_update_restrictive
ON public.tenant_feature_flags
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  feature_key <> 'ENABLE_FEV_RIPS_0948'
  OR (SELECT public.is_superadmin())
)
WITH CHECK (
  feature_key <> 'ENABLE_FEV_RIPS_0948'
  OR (SELECT public.is_superadmin())
);

-- 3. Restrictive policy para DELETE
-- USING previene eliminar una fila RIPS existente si no es superadmin.
DROP POLICY IF EXISTS tenant_feature_flags_rips_delete_restrictive ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_rips_delete_restrictive
ON public.tenant_feature_flags
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  feature_key <> 'ENABLE_FEV_RIPS_0948'
  OR (SELECT public.is_superadmin())
);

COMMIT;
