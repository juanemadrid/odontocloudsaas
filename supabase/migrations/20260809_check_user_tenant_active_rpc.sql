-- Migration: RPC function to check user and tenant active status prior to login
-- Run this in Supabase Dashboard -> SQL Editor

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

  -- Si NO existe ningún perfil registrado para este correo (solicitud aún pendiente o no existente)
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'pending_approval');
  END IF;

  -- Si el perfil existe pero está inactivo
  IF v_profile_activo IS NOT TRUE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'profile_inactive');
  END IF;

  -- Si el usuario no tiene una clínica asignada
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_tenant');
  END IF;

  SELECT activo
  INTO v_tenant_activo
  FROM public.tenants
  WHERE id = v_tenant_id;

  -- Si la clínica no existe en la tabla tenants o está inactiva
  IF v_tenant_activo IS NOT TRUE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'tenant_inactive');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_tenant_active(text) TO authenticated, anon;
