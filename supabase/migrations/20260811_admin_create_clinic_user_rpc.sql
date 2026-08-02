-- Migration: Automatic clinic user & tenant provisioning RPC
-- Run this in Supabase Dashboard -> SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Función RPC para crear/aprovisionar usuario de la clínica en auth.users y public.profiles
CREATE OR REPLACE FUNCTION public.admin_create_clinic_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'El correo electrónico es requerido.';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
  END IF;

  -- A) Asegurar que la clínica exista en la tabla nativa tenants de PostgreSQL
  INSERT INTO public.tenants (id, nombre, email, plan, activo)
  VALUES (
    p_tenant_id,
    coalesce(p_full_name, 'Clínica Registrada'),
    lower(trim(p_email)),
    'consultorio',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = lower(trim(p_email)),
    activo = true;

  -- B) Buscar si la cuenta de Auth ya existe en auth.users
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email));

  -- C) Si no existe la cuenta en Auth, crearla directamente
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
      aud
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      lower(trim(p_email)),
      crypt(p_password, gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'tenant_id', p_tenant_id, 'role', 'administrador'),
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  ELSE
    -- Si ya existe, actualizar su clave encriptada
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_uid;
  END IF;

  -- D) Crear o actualizar el perfil en public.profiles con tenant_id y activo = true
  INSERT INTO public.profiles (id, email, full_name, role, tenant_id, activo, created_at, updated_at)
  VALUES (
    v_uid,
    lower(trim(p_email)),
    coalesce(p_full_name, 'Administrador de Clínica'),
    'administrador',
    p_tenant_id,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = coalesce(EXCLUDED.full_name, profiles.full_name),
    role = 'administrador',
    tenant_id = EXCLUDED.tenant_id,
    activo = true,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_uid,
    'message', format('Usuario %s y clínica aprovisionados exitosamente.', p_email)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_clinic_user(text, text, text, uuid) TO authenticated, anon;


-- 2. Función RPC para verificar estado previo al inicio de sesión
CREATE OR REPLACE FUNCTION public.check_user_tenant_active(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_role text;
  v_profile_activo boolean;
  v_tenant_id uuid;
  v_tenant_activo boolean;
BEGIN
  IF lower(trim(p_email)) = 'madridsystem@outlook.es' THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  SELECT role, activo, tenant_id
  INTO v_role, v_profile_activo, v_tenant_id
  FROM public.profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;

  -- Si NO existe perfil creado aún (solicitud no aprobada)
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'pending_approval');
  END IF;

  -- Si el perfil existe pero está inactivo
  IF v_profile_activo IS NOT TRUE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'profile_inactive');
  END IF;

  -- Si no tiene clínica asignada
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_tenant');
  END IF;

  SELECT activo
  INTO v_tenant_activo
  FROM public.tenants
  WHERE id = v_tenant_id;

  IF v_tenant_activo IS NOT TRUE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'tenant_inactive');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_tenant_active(text) TO authenticated, anon;


-- 3. Aprovisionar de forma inmediata a ATM centro del dolor para activar su ingreso
SELECT public.admin_create_clinic_user(
  'atmcentrodeldolor@gmail.com',
  'XiomarATM1',
  'Guillermo Rodriguez - ATM centro del dolor',
  '60cd9690-b1ba-46d6-a6e7-1f5cf9f6797f'::uuid
);
