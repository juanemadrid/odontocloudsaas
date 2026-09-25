-- ============================================================================
-- CANONICAL HARDENING — PUBLIC.ESPECIALIDADES
-- Elimina policy legacy permisiva y aplica aislamiento multitenant.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.especialidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;

-- Eliminar policy manual legacy insegura
DROP POLICY IF EXISTS "all_access_especialidades"
ON public.especialidades;

-- Eliminar policies canónicas previas para permitir replay idempotente
DROP POLICY IF EXISTS "especialidades_select_policy"
ON public.especialidades;

DROP POLICY IF EXISTS "especialidades_insert_policy"
ON public.especialidades;

DROP POLICY IF EXISTS "especialidades_update_policy"
ON public.especialidades;

DROP POLICY IF EXISTS "especialidades_delete_policy"
ON public.especialidades;

-- Lectura:
-- usuario activo del mismo tenant o superadmin
CREATE POLICY "especialidades_select_policy"
ON public.especialidades
FOR SELECT
TO authenticated
USING (
  public.is_active_user()
  AND (
    tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin()
  )
);

-- Inserción:
-- tenant admin de su propio tenant o superadmin
CREATE POLICY "especialidades_insert_policy"
ON public.especialidades
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_active_user()
  AND (
    (
      tenant_id = public.get_user_tenant_id()
      AND public.is_tenant_admin()
    )
    OR public.is_superadmin()
  )
);

-- Actualización:
-- tenant admin de su propio tenant o superadmin
CREATE POLICY "especialidades_update_policy"
ON public.especialidades
FOR UPDATE
TO authenticated
USING (
  public.is_active_user()
  AND (
    (
      tenant_id = public.get_user_tenant_id()
      AND public.is_tenant_admin()
    )
    OR public.is_superadmin()
  )
)
WITH CHECK (
  public.is_active_user()
  AND (
    (
      tenant_id = public.get_user_tenant_id()
      AND public.is_tenant_admin()
    )
    OR public.is_superadmin()
  )
);

-- Eliminación:
-- tenant admin de su propio tenant o superadmin
CREATE POLICY "especialidades_delete_policy"
ON public.especialidades
FOR DELETE
TO authenticated
USING (
  public.is_active_user()
  AND (
    (
      tenant_id = public.get_user_tenant_id()
      AND public.is_tenant_admin()
    )
    OR public.is_superadmin()
  )
);

CREATE INDEX IF NOT EXISTS idx_especialidades_tenant
ON public.especialidades (tenant_id);

-- Privilegios explícitos y mínimos
REVOKE ALL ON TABLE public.especialidades FROM PUBLIC;
REVOKE ALL ON TABLE public.especialidades FROM anon;
REVOKE ALL ON TABLE public.especialidades FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.especialidades
TO authenticated;

GRANT ALL
ON TABLE public.especialidades
TO service_role;

COMMIT;
