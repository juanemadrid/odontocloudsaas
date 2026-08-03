-- Script de Verificación: Comprobar que la solución de registro de usuarios está funcionando
-- Ejecuta este script DESPUÉS de aplicar 20250802_fix_clinic_user_registration.sql
-- Fecha: 2025-08-02

-- =======================================================================================
-- VERIFICACIÓN 1: Funciones RPC existen y tienen las firmas correctas
-- =======================================================================================

DO $$
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE '🔍 VERIFICACIÓN 1: Funciones RPC';
  RAISE NOTICE '==========================================';

  -- Verificar admin_create_clinic_user
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_create_clinic_user';
    
  IF v_count > 0 THEN
    RAISE NOTICE '✅ admin_create_clinic_user existe';
  ELSE
    RAISE WARNING '❌ admin_create_clinic_user NO existe';
  END IF;

  -- Verificar check_user_tenant_active
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'check_user_tenant_active';
    
  IF v_count > 0 THEN
    RAISE NOTICE '✅ check_user_tenant_active existe';
  ELSE
    RAISE WARNING '❌ check_user_tenant_active NO existe';
  END IF;

  -- Verificar check_user_limit_for_tenant
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'check_user_limit_for_tenant';
    
  IF v_count > 0 THEN
    RAISE NOTICE '✅ check_user_limit_for_tenant existe';
  ELSE
    RAISE WARNING '❌ check_user_limit_for_tenant NO existe';
  END IF;

  RAISE NOTICE '';
END $$;

-- =======================================================================================
-- VERIFICACIÓN 2: Columnas necesarias en tablas
-- =======================================================================================

DO $$
DECLARE
  v_has_column boolean;
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE '🔍 VERIFICACIÓN 2: Estructura de Tablas';
  RAISE NOTICE '==========================================';

  -- Verificar profiles.activo
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'activo'
  ) INTO v_has_column;
  
  IF v_has_column THEN
    RAISE NOTICE '✅ profiles.activo existe';
  ELSE
    RAISE WARNING '❌ profiles.activo NO existe';
  END IF;

  -- Verificar profiles.tenant_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'tenant_id'
  ) INTO v_has_column;
  
  IF v_has_column THEN
    RAISE NOTICE '✅ profiles.tenant_id existe';
  ELSE
    RAISE WARNING '❌ profiles.tenant_id NO existe';
  END IF;

  -- Verificar profiles.inquilino
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'inquilino'
  ) INTO v_has_column;
  
  IF v_has_column THEN
    RAISE NOTICE '✅ profiles.inquilino existe';
  ELSE
    RAISE WARNING '⚠️ profiles.inquilino NO existe (opcional)';
  END IF;

  -- Verificar tenants.activo
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'activo'
  ) INTO v_has_column;
  
  IF v_has_column THEN
    RAISE NOTICE '✅ tenants.activo existe';
  ELSE
    RAISE WARNING '❌ tenants.activo NO existe';
  END IF;

  RAISE NOTICE '';
END $$;

-- =======================================================================================
-- VERIFICACIÓN 3: Políticas RLS están configuradas
-- =======================================================================================

DO $$
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE '🔍 VERIFICACIÓN 3: Políticas RLS';
  RAISE NOTICE '==========================================';

  -- Verificar que RLS está habilitado en profiles
  SELECT COUNT(*) INTO v_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND rowsecurity = true;
    
  IF v_count > 0 THEN
    RAISE NOTICE '✅ RLS habilitado en profiles';
  ELSE
    RAISE WARNING '❌ RLS NO habilitado en profiles';
  END IF;

  -- Verificar que RLS está habilitado en tenants
  SELECT COUNT(*) INTO v_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = 'tenants'
    AND rowsecurity = true;
    
  IF v_count > 0 THEN
    RAISE NOTICE '✅ RLS habilitado en tenants';
  ELSE
    RAISE WARNING '❌ RLS NO habilitado en tenants';
  END IF;

  -- Verificar políticas de profiles
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles';
    
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Políticas RLS configuradas en profiles (% políticas)', v_count;
  ELSE
    RAISE WARNING '❌ NO hay políticas RLS en profiles';
  END IF;

  RAISE NOTICE '';
END $$;

-- =======================================================================================
-- VERIFICACIÓN 4: Índices para performance
-- =======================================================================================

DO $$
DECLARE
  v_has_index boolean;
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE '🔍 VERIFICACIÓN 4: Índices de Performance';
  RAISE NOTICE '==========================================';

  -- Verificar índice en profiles email
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND indexname LIKE '%email%'
  ) INTO v_has_index;
  
  IF v_has_index THEN
    RAISE NOTICE '✅ Índice en profiles.email existe';
  ELSE
    RAISE NOTICE '⚠️ Índice en profiles.email NO existe (puede afectar performance)';
  END IF;

  -- Verificar índice en profiles tenant_id
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND indexname LIKE '%tenant%'
  ) INTO v_has_index;
  
  IF v_has_index THEN
    RAISE NOTICE '✅ Índice en profiles.tenant_id existe';
  ELSE
    RAISE NOTICE '⚠️ Índice en profiles.tenant_id NO existe (puede afectar performance)';
  END IF;

  RAISE NOTICE '';
END $$;

-- =======================================================================================
-- VERIFICACIÓN 5: Test de creación de usuario (solo si hay clínicas activas)
-- =======================================================================================

DO $$
DECLARE
  v_test_tenant_id uuid;
  v_test_result jsonb;
  v_test_email text := 'test_verification_' || floor(random() * 10000)::text || '@odontocloud.test';
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE '🔍 VERIFICACIÓN 5: Test de Creación de Usuario';
  RAISE NOTICE '==========================================';

  -- Buscar una clínica activa para testing
  SELECT id INTO v_test_tenant_id
  FROM public.tenants
  WHERE activo = true
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠️ No hay clínicas activas para testing';
    RAISE NOTICE '   Crea una clínica primero para probar la función';
  ELSE
    RAISE NOTICE 'ℹ️ Usando clínica de prueba: %', v_test_tenant_id;
    
    -- Intentar crear un usuario de prueba
    BEGIN
      v_test_result := public.admin_create_clinic_user(
        v_test_email,
        'TestPassword123',
        'Usuario de Verificación',
        v_test_tenant_id,
        'doctor'
      );
      
      IF (v_test_result->>'success')::boolean = true THEN
        RAISE NOTICE '✅ Test de creación de usuario EXITOSO';
        RAISE NOTICE '   User ID: %', v_test_result->>'user_id';
        RAISE NOTICE '   Email: %', v_test_result->>'email';
        RAISE NOTICE '   Rol: %', v_test_result->>'role';
        
        -- Limpiar usuario de prueba
        DELETE FROM public.profiles WHERE email = v_test_email;
        DELETE FROM auth.users WHERE email = v_test_email;
        RAISE NOTICE '   Usuario de prueba eliminado';
      ELSE
        RAISE WARNING '❌ Test de creación FALLÓ';
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Error al crear usuario de prueba: %', SQLERRM;
    END;
  END IF;

  RAISE NOTICE '';
END $$;

-- =======================================================================================
-- VERIFICACIÓN 6: Test de validación de límites
-- =======================================================================================

DO $$
DECLARE
  v_test_tenant_id uuid;
  v_limit_result jsonb;
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE '🔍 VERIFICACIÓN 6: Test de Límites de Usuario';
  RAISE NOTICE '==========================================';

  -- Buscar una clínica activa para testing
  SELECT id INTO v_test_tenant_id
  FROM public.tenants
  WHERE activo = true
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠️ No hay clínicas activas para testing';
  ELSE
    v_limit_result := public.check_user_limit_for_tenant(v_test_tenant_id);
    
    RAISE NOTICE '✅ Validación de límites funciona:';
    RAISE NOTICE '   Plan: %', v_limit_result->>'plan';
    RAISE NOTICE '   Usuarios actuales: %', v_limit_result->>'current_count';
    RAISE NOTICE '   Límite máximo: %', v_limit_result->>'max_users';
    RAISE NOTICE '   ¿Puede agregar?: %', v_limit_result->>'allowed';
  END IF;

  RAISE NOTICE '';
END $$;

-- =======================================================================================
-- RESUMEN FINAL
-- =======================================================================================

DO $$
DECLARE
  v_total_tenants integer;
  v_active_tenants integer;
  v_total_profiles integer;
  v_active_profiles integer;
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE '📊 RESUMEN DEL SISTEMA';
  RAISE NOTICE '==========================================';

  SELECT COUNT(*) INTO v_total_tenants FROM public.tenants;
  SELECT COUNT(*) INTO v_active_tenants FROM public.tenants WHERE activo = true;
  SELECT COUNT(*) INTO v_total_profiles FROM public.profiles;
  SELECT COUNT(*) INTO v_active_profiles FROM public.profiles WHERE activo = true;

  RAISE NOTICE 'Clínicas totales: % (% activas)', v_total_tenants, v_active_tenants;
  RAISE NOTICE 'Usuarios totales: % (% activos)', v_total_profiles, v_active_profiles;
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '✅ VERIFICACIÓN COMPLETADA';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Si todas las verificaciones muestran ✅, el sistema está listo.';
  RAISE NOTICE 'Si hay ❌, revisa la migración 20250802_fix_clinic_user_registration.sql';
  RAISE NOTICE '';
END $$;
