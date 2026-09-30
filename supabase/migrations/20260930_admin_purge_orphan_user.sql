-- Migration: Allow SuperAdmin to purge orphan auth users and avoid duplicate email blocks
-- Run in Supabase Dashboard -> SQL Editor

CREATE OR REPLACE FUNCTION public.admin_purge_orphan_user(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid;
  v_caller_email text;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'El correo electrónico es requerido.';
  END IF;

  -- 1. Validar que quien invoca sea SuperAdmin
  SELECT lower(trim(email)) INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_caller_email != 'madridsystem@outlook.es' AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acceso denegado. Solo el SuperAdmin puede purgar usuarios huérfanos.';
  END IF;

  -- 2. Buscar si existe el usuario en auth.users
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email));

  IF v_uid IS NOT NULL THEN
    -- Purgar perfil asociado si existe
    DELETE FROM public.profiles WHERE id = v_uid;
    -- Purgar usuario de auth
    DELETE FROM auth.users WHERE id = v_uid;

    RETURN jsonb_build_object(
      'success', true,
      'purged', true,
      'email', lower(trim(p_email)),
      'message', format('Usuario %s purgado exitosamente de auth.users.', p_email)
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'purged', false,
      'email', lower(trim(p_email)),
      'message', 'No se encontró ninguna cuenta con ese correo.'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_orphan_user(text) TO authenticated;
