-- Migración urgente: Corregir recursión infinita en políticas RLS de profiles y tenants
-- PostgreSQL 15+ requiere 'SET row_security = off' en funciones SECURITY DEFINER que consultan tablas con RLS.

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p.tenant_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
    AND p.activo IS TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.activo IS TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.activo IS TRUE
      AND lower(trim(p.role)) = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.activo IS TRUE
      AND lower(trim(p.role)) IN ('admin', 'administrador', 'superadmin')
  );
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO anon, authenticated;

-- Asegurar políticas de profiles sin recursión
DROP POLICY IF EXISTS profiles_select_secure ON public.profiles;

CREATE POLICY profiles_select_secure
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR tenant_id = public.get_user_tenant_id()
  OR public.is_superadmin()
);
