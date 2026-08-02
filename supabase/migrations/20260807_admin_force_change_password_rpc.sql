-- Migration: Self-healing SuperAdmin password change RPC preserving clinic tenant_id
-- Run this in Supabase Dashboard -> SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_force_change_password(p_email text, p_new_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid;
  v_caller_email text;
  v_tenant_id uuid;
BEGIN
  SELECT lower(trim(email)) INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Auto-reparar perfil de SuperAdmin si falta en public.profiles
  IF v_caller_email = 'madridsystem@outlook.es' OR public.is_superadmin() THEN
    INSERT INTO public.profiles (id, email, full_name, role, tenant_id, activo)
    VALUES (auth.uid(), coalesce(v_caller_email, 'madridsystem@outlook.es'), 'SuperAdmin MadridSystem', 'superadmin', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, true)
    ON CONFLICT (id) DO UPDATE SET role = 'superadmin', activo = true;
  ELSE
    RAISE EXCEPTION 'Acceso denegado. Solo el SuperAdmin puede cambiar contraseñas.';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'La nueva contraseña debe tener al menos 8 caracteres.';
  END IF;

  -- Buscar la cuenta de Auth del usuario de la clínica
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email));

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No se encontró ninguna cuenta registrada con el email %', p_email;
  END IF;

  -- Obtener el tenant_id existente de profiles
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = v_uid;

  IF v_tenant_id IS NULL OR v_tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid THEN
    SELECT id INTO v_tenant_id
    FROM public.tenants
    WHERE id != 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Actualizar la contraseña encriptada directamente en auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = v_uid;

  -- Sincronizar o crear su perfil en profiles conservando el tenant_id específico de la clínica
  INSERT INTO public.profiles (id, email, full_name, role, tenant_id, activo)
  VALUES (v_uid, lower(trim(p_email)), 'Administrador de Clínica', 'administrador', coalesce(v_tenant_id, '937c5446-8135-4373-96b5-7b7179ea510f'::uuid), true)
  ON CONFLICT (id) DO UPDATE SET activo = true, tenant_id = coalesce(EXCLUDED.tenant_id, profiles.tenant_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Contraseña para %s actualizada exitosamente.', p_email)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_force_change_password(text, text) TO authenticated, anon;
