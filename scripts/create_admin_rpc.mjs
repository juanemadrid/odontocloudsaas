import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const SQL_RPC = `
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_upsert_profile(
  p_id UUID,
  p_tenant_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_especialidad TEXT DEFAULT NULL,
  p_registro_medico TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL,
  p_activo BOOLEAN DEFAULT TRUE,
  p_password TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_target_auth_id UUID;
  v_clean_email TEXT;
BEGIN
  v_clean_email := lower(trim(p_email));

  -- 1. Buscar SIEMPRE primero por email en auth.users para evitar violaciones de clave única
  SELECT id INTO v_target_auth_id FROM auth.users WHERE lower(trim(email)) = v_clean_email LIMIT 1;

  -- 2. Si no se encontró por email pero se pasó un p_id, verificar por p_id
  IF v_target_auth_id IS NULL AND p_id IS NOT NULL THEN
    SELECT id INTO v_target_auth_id FROM auth.users WHERE id = p_id LIMIT 1;
  END IF;

  IF v_target_auth_id IS NOT NULL THEN
    -- Usuario existente: Usar su ID real de auth.users
    v_user_id := v_target_auth_id;

    IF p_password IS NOT NULL AND p_password != '' THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
          email = v_clean_email,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
          raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
          updated_at = NOW()
      WHERE id = v_target_auth_id;
    ELSE
      UPDATE auth.users
      SET email = v_clean_email,
          updated_at = NOW()
      WHERE id = v_target_auth_id;
    END IF;
  ELSE
    -- Nuevo usuario: usar p_id o generar un UUID nuevo si p_id es null
    v_user_id := COALESCE(p_id, gen_random_uuid());

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_clean_email,
      CASE 
        WHEN p_password IS NOT NULL AND p_password != '' 
        THEN extensions.crypt(p_password, extensions.gen_salt('bf', 10))
        ELSE extensions.crypt('@NewUser2024', extensions.gen_salt('bf', 10))
      END,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      json_build_object('full_name', p_full_name, 'role', p_role, 'tenant_id', p_tenant_id)::jsonb,
      false, false, NOW(), NOW()
    );
  END IF;

  -- 3. Limpiar cualquier perfil desincronizado previa con el mismo email que tenga ID diferente
  DELETE FROM public.profiles WHERE lower(trim(email)) = v_clean_email AND id != v_user_id;

  -- 4. Guardar en la tabla public.profiles asegurando coincidencia de ID de autenticación
  INSERT INTO public.profiles (id, tenant_id, full_name, email, role, especialidad, registro_medico, telefono, activo)
  VALUES (v_user_id, p_tenant_id, p_full_name, v_clean_email, p_role, p_especialidad, p_registro_medico, p_telefono, p_activo)
  ON CONFLICT (id) DO UPDATE SET
    full_name       = EXCLUDED.full_name,
    email           = EXCLUDED.email,
    role            = EXCLUDED.role,
    especialidad    = EXCLUDED.especialidad,
    registro_medico  = EXCLUDED.registro_medico,
    telefono        = EXCLUDED.telefono,
    activo          = EXCLUDED.activo,
    tenant_id       = EXCLUDED.tenant_id;

  RETURN json_build_object('success', true, 'id', v_user_id::text);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_profile TO anon;
`;

console.log("SQL generated for admin_upsert_profile");
