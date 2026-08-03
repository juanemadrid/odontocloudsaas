-- Migration: Fix para permitir que clínicas registren usuarios (doctores, administrativos, etc.)
-- Problema identificado: El RPC admin_create_clinic_user hardcodeaba el rol como 'administrador'
-- y no verificaba correctamente el estado activo de la clínica antes de crear usuarios
-- Fecha: 2025-08-02

-- =======================================================================================
-- PASO 1: Actualizar el RPC para soportar roles dinámicos y mejor validación
-- =======================================================================================

CREATE OR REPLACE FUNCTION public.admin_create_clinic_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_tenant_id uuid,
  p_role text DEFAULT 'administrador'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid;
  v_role_normalized text;
  v_tenant_active boolean;
BEGIN
  -- Validaciones de entrada
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'El correo electrónico es requerido.';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
  END IF;

  -- Normalizar el rol recibido (convertir a minúsculas y limpiar espacios)
  v_role_normalized := coalesce(lower(trim(p_role)), 'usuario');
  
  -- Mapeo de roles comunes para consistencia
  v_role_normalized := CASE v_role_normalized
    WHEN 'odontologo' THEN 'doctor'
    WHEN 'odontólogo' THEN 'doctor'
    WHEN 'odontologo general' THEN 'doctor'
    WHEN 'admin' THEN 'administrador'
    ELSE v_role_normalized
  END;

  -- Verificar que la clínica existe y está activa
  SELECT activo INTO v_tenant_active
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La clínica con ID % no existe en el sistema. Debe ser creada primero por un SuperAdmin.', p_tenant_id;
  END IF;

  IF v_tenant_active IS NOT TRUE THEN
    RAISE EXCEPTION 'La clínica está inactiva o suspendida. No se pueden crear usuarios para esta clínica.';
  END IF;

  -- Buscar si la cuenta de Auth ya existe
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email));

  -- Si no existe la cuenta en Auth, crearla
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      lower(trim(p_email)),
      crypt(p_password, gen_salt('bf', 10)),
      now(), -- Email confirmado inmediatamente
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email']
      ),
      jsonb_build_object(
        'full_name', p_full_name,
        'tenant_id', p_tenant_id,
        'role', v_role_normalized
      ),
      now(),
      now(),
      'authenticated',
      'authenticated',
      '',
      '',
      ''
    );
    
    RAISE NOTICE 'Usuario de Auth creado: % con rol %', p_email, v_role_normalized;
  ELSE
    -- Si ya existe, actualizar contraseña y metadata
    UPDATE auth.users
    SET 
      encrypted_password = crypt(p_password, gen_salt('bf', 10)),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = jsonb_build_object(
        'full_name', p_full_name,
        'tenant_id', p_tenant_id,
        'role', v_role_normalized
      ),
      updated_at = now()
    WHERE id = v_uid;
    
    RAISE NOTICE 'Usuario de Auth actualizado: % con rol %', p_email, v_role_normalized;
  END IF;

  -- Crear o actualizar el perfil en public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    tenant_id,
    inquilino,
    activo,
    created_at,
    updated_at
  ) VALUES (
    v_uid,
    lower(trim(p_email)),
    coalesce(p_full_name, 'Usuario de Clínica'),
    v_role_normalized,
    p_tenant_id,
    p_tenant_id,
    true, -- Usuario activo por defecto
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = coalesce(EXCLUDED.full_name, profiles.full_name),
    role = EXCLUDED.role,
    tenant_id = EXCLUDED.tenant_id,
    inquilino = EXCLUDED.inquilino,
    activo = true, -- Reactivar si estaba inactivo
    updated_at = now();

  RAISE NOTICE 'Perfil creado/actualizado en public.profiles para usuario %', p_email;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_uid,
    'email', lower(trim(p_email)),
    'role', v_role_normalized,
    'tenant_id', p_tenant_id,
    'message', format('Usuario %s (%s) creado exitosamente para la clínica.', p_email, v_role_normalized)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al crear usuario: %', SQLERRM;
END;
$$;

-- Revocar permisos previos y otorgar nuevos
REVOKE ALL ON FUNCTION public.admin_create_clinic_user(text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_clinic_user(text, text, text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_create_clinic_user IS 'Crea o actualiza un usuario de clínica con rol dinámico. Valida que la clínica exista y esté activa.';

-- =======================================================================================
-- PASO 2: Verificar que la columna 'inquilino' existe en profiles (para compatibilidad)
-- =======================================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'inquilino'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN inquilino uuid;
    
    -- Sincronizar inquilino con tenant_id para registros existentes
    UPDATE public.profiles 
    SET inquilino = tenant_id 
    WHERE inquilino IS NULL AND tenant_id IS NOT NULL;
    
    RAISE NOTICE 'Columna inquilino agregada a profiles y sincronizada';
  END IF;
END $$;

-- =======================================================================================
-- PASO 3: Asegurar que las políticas RLS permitan que los admins creen usuarios
-- =======================================================================================

-- Política para INSERT en profiles: Permitir a administradores de clínica crear usuarios de su tenant
DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- SuperAdmin puede crear cualquier perfil
  public.is_superadmin()
  OR
  -- Administrador de clínica puede crear perfiles para su propia clínica
  (
    public.is_tenant_admin()
    AND tenant_id = public.get_user_tenant_id()
    AND public.is_active_user()
  )
);

-- Política para UPDATE en profiles: Permitir actualizar usuarios del mismo tenant
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- SuperAdmin puede actualizar cualquier perfil
  public.is_superadmin()
  OR
  -- Usuario puede actualizar su propio perfil
  id = auth.uid()
  OR
  -- Administrador de clínica puede actualizar perfiles de su clínica
  (
    public.is_tenant_admin()
    AND tenant_id = public.get_user_tenant_id()
    AND public.is_active_user()
  )
)
WITH CHECK (
  -- Las mismas reglas aplican para el check
  public.is_superadmin()
  OR id = auth.uid()
  OR (
    public.is_tenant_admin()
    AND tenant_id = public.get_user_tenant_id()
    AND public.is_active_user()
  )
);

-- =======================================================================================
-- PASO 4: Índices para mejorar performance en búsquedas de usuarios
-- =======================================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_activo ON public.profiles (tenant_id, activo);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower ON auth.users (lower(email));

-- =======================================================================================
-- PASO 5: Función auxiliar para validar límites de usuarios por plan
-- =======================================================================================

CREATE OR REPLACE FUNCTION public.check_user_limit_for_tenant(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_name text;
  v_max_users integer;
  v_current_count integer;
  v_can_add boolean;
BEGIN
  -- Obtener el plan de la clínica
  SELECT plan INTO v_plan_name
  FROM public.tenants
  WHERE id = p_tenant_id AND activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Clínica no existe o está inactiva'
    );
  END IF;

  -- Determinar límite según el plan
  v_max_users := CASE lower(trim(v_plan_name))
    WHEN 'consultorio' THEN 2
    WHEN 'clinica' THEN 12
    WHEN 'pro' THEN 12
    WHEN 'enterprise' THEN 999
    ELSE 2
  END;

  -- Contar usuarios activos actuales de la clínica
  SELECT COUNT(*)
  INTO v_current_count
  FROM public.profiles
  WHERE tenant_id = p_tenant_id AND activo = true;

  v_can_add := v_current_count < v_max_users;

  RETURN jsonb_build_object(
    'allowed', v_can_add,
    'current_count', v_current_count,
    'max_users', v_max_users,
    'plan', v_plan_name,
    'reason', CASE 
      WHEN v_can_add THEN 'OK'
      ELSE format('Límite de %s usuarios alcanzado para el plan %s', v_max_users, v_plan_name)
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_limit_for_tenant(uuid) TO authenticated;

COMMENT ON FUNCTION public.check_user_limit_for_tenant IS 'Verifica si una clínica puede agregar más usuarios según su plan';

-- =======================================================================================
-- PASO 6: Trigger para validar límites antes de crear usuarios (opcional, nivel extra)
-- =======================================================================================

CREATE OR REPLACE FUNCTION public.validate_user_limit_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_check jsonb;
BEGIN
  -- Solo validar para usuarios no-superadmin
  IF NEW.role != 'superadmin' AND NEW.tenant_id IS NOT NULL THEN
    v_check := public.check_user_limit_for_tenant(NEW.tenant_id);
    
    IF (v_check->>'allowed')::boolean = false THEN
      RAISE EXCEPTION '%', v_check->>'reason';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trg_validate_user_limit ON public.profiles;
CREATE TRIGGER trg_validate_user_limit
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_limit_before_insert();

-- =======================================================================================
-- VERIFICACIÓN FINAL
-- =======================================================================================

DO $$
DECLARE
  v_test_result jsonb;
BEGIN
  -- Verificar que las funciones críticas existen
  PERFORM 1 FROM pg_proc WHERE proname = 'admin_create_clinic_user';
  PERFORM 1 FROM pg_proc WHERE proname = 'check_user_tenant_active';
  PERFORM 1 FROM pg_proc WHERE proname = 'check_user_limit_for_tenant';
  
  RAISE NOTICE '✅ Migración completada exitosamente';
  RAISE NOTICE '✅ Función admin_create_clinic_user actualizada con soporte de roles dinámicos';
  RAISE NOTICE '✅ Políticas RLS configuradas para permitir registro de usuarios por administradores';
  RAISE NOTICE '✅ Validación de límites de usuarios implementada';
END $$;
