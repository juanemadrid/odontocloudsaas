-- =======================================================================================
-- MIGRACIÓN CANÓNICA: HARDENING DEFINITIVO DE NOTIFICACIONES Y ANUNCIOS DEL SISTEMA
-- =======================================================================================
-- Timestamp canónico: 20260924154000
-- Garantiza existencia idempotente de estructuras, elimina policies legacy inseguras
-- (all_access_notificaciones, lectura_publica, admin_todo) y establece RLS y grants
-- canónicos estrictos para producción y todos los entornos.

BEGIN;

-- 1. TABLA: public.notificaciones
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  target TEXT NOT NULL DEFAULT 'admin',
  paciente_id UUID,
  title TEXT,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar estado si no existe (usado por confirmación/rechazo de citas en DashboardLayout)
ALTER TABLE public.notificaciones
ADD COLUMN IF NOT EXISTS estado TEXT;

ALTER TABLE public.notificaciones
ADD COLUMN IF NOT EXISTS paciente_nombre TEXT;

-- Habilitar RLS
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Eliminar policies legacy o preexistentes
DROP POLICY IF EXISTS "all_access_notificaciones" ON public.notificaciones;
DROP POLICY IF EXISTS all_access_notificaciones ON public.notificaciones;
DROP POLICY IF EXISTS notificaciones_tenant_select ON public.notificaciones;
DROP POLICY IF EXISTS notificaciones_tenant_insert ON public.notificaciones;
DROP POLICY IF EXISTS notificaciones_tenant_update ON public.notificaciones;
DROP POLICY IF EXISTS notificaciones_tenant_delete ON public.notificaciones;

-- Policies canónicas seguras
CREATE POLICY notificaciones_tenant_select
ON public.notificaciones
FOR SELECT
TO authenticated
USING (
  public.is_active_user()
  AND tenant_id = public.get_user_tenant_id()
  AND target = 'admin'
);

CREATE POLICY notificaciones_tenant_insert
ON public.notificaciones
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_active_user()
  AND tenant_id = public.get_user_tenant_id()
  AND target = 'patient'
);

CREATE POLICY notificaciones_tenant_update
ON public.notificaciones
FOR UPDATE
TO authenticated
USING (
  public.is_active_user()
  AND tenant_id = public.get_user_tenant_id()
  AND target = 'admin'
)
WITH CHECK (
  public.is_active_user()
  AND tenant_id = public.get_user_tenant_id()
  AND target = 'admin'
);

-- Grants explícitos de privilegios mínimos para notificaciones
REVOKE ALL ON TABLE public.notificaciones FROM PUBLIC;
REVOKE ALL ON TABLE public.notificaciones FROM anon;
REVOKE ALL ON TABLE public.notificaciones FROM authenticated;

GRANT SELECT, INSERT ON TABLE public.notificaciones TO authenticated;
GRANT UPDATE (read, estado) ON TABLE public.notificaciones TO authenticated;

GRANT ALL ON TABLE public.notificaciones TO service_role;


-- 2. TABLA: public.anuncios_sistema
CREATE TABLE IF NOT EXISTS public.anuncios_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT,
  tipo TEXT DEFAULT 'info',
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.anuncios_sistema ENABLE ROW LEVEL SECURITY;

-- Eliminar policies legacy o preexistentes
DROP POLICY IF EXISTS "lectura_publica" ON public.anuncios_sistema;
DROP POLICY IF EXISTS lectura_publica ON public.anuncios_sistema;
DROP POLICY IF EXISTS "admin_todo" ON public.anuncios_sistema;
DROP POLICY IF EXISTS admin_todo ON public.anuncios_sistema;
DROP POLICY IF EXISTS anuncios_sistema_authenticated_select ON public.anuncios_sistema;
DROP POLICY IF EXISTS anuncios_sistema_superadmin_insert ON public.anuncios_sistema;
DROP POLICY IF EXISTS anuncios_sistema_superadmin_update ON public.anuncios_sistema;
DROP POLICY IF EXISTS anuncios_sistema_superadmin_delete ON public.anuncios_sistema;

-- Policies canónicas seguras
CREATE POLICY anuncios_sistema_authenticated_select
ON public.anuncios_sistema
FOR SELECT
TO authenticated
USING (public.is_active_user());

CREATE POLICY anuncios_sistema_superadmin_insert
ON public.anuncios_sistema
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_active_user()
  AND public.is_superadmin()
);

CREATE POLICY anuncios_sistema_superadmin_update
ON public.anuncios_sistema
FOR UPDATE
TO authenticated
USING (
  public.is_active_user()
  AND public.is_superadmin()
)
WITH CHECK (
  public.is_active_user()
  AND public.is_superadmin()
);

CREATE POLICY anuncios_sistema_superadmin_delete
ON public.anuncios_sistema
FOR DELETE
TO authenticated
USING (
  public.is_active_user()
  AND public.is_superadmin()
);

-- Grants explícitos para anuncios_sistema
REVOKE ALL ON TABLE public.anuncios_sistema FROM PUBLIC;
REVOKE ALL ON TABLE public.anuncios_sistema FROM anon;
REVOKE ALL ON TABLE public.anuncios_sistema FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.anuncios_sistema
TO authenticated;

GRANT ALL ON TABLE public.anuncios_sistema TO service_role;

COMMIT;
