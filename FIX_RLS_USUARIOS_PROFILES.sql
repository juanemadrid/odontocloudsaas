-- =====================================================
-- FIX COMPLETO: RLS para audit_logs, profiles y usuarios
-- =====================================================
-- Problema: Al cambiar contraseña de un doctor, fallan los UPDATE
-- con error 400 Bad Request en las 3 tablas
-- =====================================================

-- =====================================================
-- 1. FIX AUDIT_LOGS (Error 400 en INSERT)
-- =====================================================

DROP POLICY IF EXISTS "Users can insert audit logs for their tenant" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- =====================================================
-- 2. FIX PROFILES (Error 400 en PATCH/UPDATE)
-- =====================================================

-- Primero ver las políticas actuales
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';

-- Eliminar políticas restrictivas antiguas
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles from their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- Política SELECT (ver perfiles del mismo tenant)
DROP POLICY IF EXISTS "Users can view profiles from their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles from their tenant" ON public.profiles
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Política UPDATE más permisiva (usuarios del mismo tenant)
CREATE POLICY "Users can update profiles from their tenant" ON public.profiles
  FOR UPDATE USING (
    -- El usuario puede actualizar perfiles del mismo tenant
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    -- Después del update, el tenant_id sigue siendo válido
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Política INSERT (para crear nuevos usuarios)
DROP POLICY IF EXISTS "Users can insert profiles for their tenant" ON public.profiles;
CREATE POLICY "Users can insert profiles for their tenant" ON public.profiles
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- =====================================================
-- 3. FIX USUARIOS (Error 400 en PATCH/UPDATE)
-- =====================================================

-- Ver si la tabla usuarios existe y tiene RLS habilitado
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usuarios';

-- Si la tabla existe, aplicar políticas
DO $$
BEGIN
  -- Verificar si la tabla existe
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usuarios') THEN
    
    -- Habilitar RLS si no está habilitado
    ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
    
    -- Eliminar políticas antiguas
    DROP POLICY IF EXISTS "Users can view usuarios from their tenant" ON public.usuarios;
    DROP POLICY IF EXISTS "Users can update usuarios from their tenant" ON public.usuarios;
    DROP POLICY IF EXISTS "Users can insert usuarios for their tenant" ON public.usuarios;
    
    -- Crear política SELECT
    EXECUTE 'CREATE POLICY "Users can view usuarios from their tenant" ON public.usuarios
      FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )';
    
    -- Crear política UPDATE permisiva
    EXECUTE 'CREATE POLICY "Users can update usuarios from their tenant" ON public.usuarios
      FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
      WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )';
    
    -- Crear política INSERT
    EXECUTE 'CREATE POLICY "Users can insert usuarios for their tenant" ON public.usuarios
      FOR INSERT WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )';
    
    RAISE NOTICE 'Políticas RLS aplicadas a tabla usuarios';
  ELSE
    RAISE NOTICE 'Tabla usuarios no existe, políticas omitidas';
  END IF;
END $$;

-- =====================================================
-- 4. VERIFICACIÓN - Ejecutar después del fix
-- =====================================================

-- Ver políticas de audit_logs
SELECT 
    'audit_logs' as tabla,
    policyname,
    cmd as operacion
FROM pg_policies 
WHERE tablename = 'audit_logs'
ORDER BY cmd, policyname;

-- Ver políticas de profiles
SELECT 
    'profiles' as tabla,
    policyname,
    cmd as operacion
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Ver políticas de usuarios (si existe)
SELECT 
    'usuarios' as tabla,
    policyname,
    cmd as operacion
FROM pg_policies 
WHERE tablename = 'usuarios'
ORDER BY cmd, policyname;

-- =====================================================
-- ✅ RESULTADO ESPERADO
-- =====================================================
/*
AUDIT_LOGS:
- Users can view audit logs from their tenant (SELECT)
- Users can insert audit logs (INSERT)

PROFILES:
- Users can view profiles from their tenant (SELECT)
- Users can update profiles from their tenant (UPDATE)
- Users can insert profiles for their tenant (INSERT)

USUARIOS (si existe):
- Users can view usuarios from their tenant (SELECT)
- Users can update usuarios from their tenant (UPDATE)
- Users can insert usuarios for their tenant (INSERT)
*/
