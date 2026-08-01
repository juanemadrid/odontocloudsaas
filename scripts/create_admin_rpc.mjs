/**
 * create_admin_rpc.mjs
 * Crea/actualiza las funciones RPC con SECURITY DEFINER en Supabase para que el admin
 * pueda crear/editar/eliminar usuarios y actualizar su contraseña de Auth sin service key.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';

const SQL_CREATE_FUNCTIONS = `
-- ============================================================
-- Función: admin_upsert_profile (Actualiza auth.users + profiles)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_upsert_profile(
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
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_target_auth_id UUID;
  v_email_exists BOOLEAN;
BEGIN
  v_user_id := p_id;

  -- 1. Buscar si el usuario existe en auth.users por ID primero, luego por email
  SELECT id INTO v_target_auth_id FROM auth.users WHERE id = p_id LIMIT 1;
  
  IF v_target_auth_id IS NULL THEN
    SELECT id INTO v_target_auth_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  END IF;

  -- 2. Si no existe en auth.users, verificar si el email ya está tomado por OTRO usuario
  IF v_target_auth_id IS NULL THEN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)) INTO v_email_exists;
    IF v_email_exists THEN
      RETURN json_build_object('success', false, 'error', 'Este correo electrónico ya está registrado en otra cuenta del sistema.');
    END IF;

    -- Crear nuevo usuario en auth.users
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', p_email,
      CASE 
        WHEN p_password IS NOT NULL AND p_password != '' 
        THEN extensions.crypt(p_password, extensions.gen_salt('bf'))
        ELSE extensions.crypt('@NewUser2024', extensions.gen_salt('bf'))
      END,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      json_build_object('full_name', p_full_name, 'role', p_role, 'tenant_id', p_tenant_id)::jsonb,
      NOW(), NOW()
    );
  ELSE
    -- El usuario existe en auth.users (ID = v_target_auth_id).
    -- Verificar si se está intentando cambiar el email a uno que ya pertenece a OTRO usuario distinto
    IF p_email IS NOT NULL AND p_email != '' THEN
      SELECT EXISTS(
        SELECT 1 FROM auth.users 
        WHERE lower(email) = lower(p_email) 
          AND id != v_target_auth_id
      ) INTO v_email_exists;

      IF v_email_exists THEN
        RETURN json_build_object('success', false, 'error', 'Este correo electrónico ya está registrado en otra cuenta del sistema.');
      END IF;
    END IF;

    -- Actualizar auth.users para v_target_auth_id
    v_user_id := v_target_auth_id;

    IF p_password IS NOT NULL AND p_password != '' THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
          email = COALESCE(p_email, email),
          updated_at = NOW()
      WHERE id = v_target_auth_id;
    ELSIF p_email IS NOT NULL AND p_email != '' THEN
      UPDATE auth.users
      SET email = p_email,
          updated_at = NOW()
      WHERE id = v_target_auth_id;
    END IF;
  END IF;

  -- 3. Upsert en tabla profiles
  INSERT INTO profiles (id, tenant_id, full_name, email, role, especialidad, registro_medico, telefono, activo)
  VALUES (v_user_id, p_tenant_id, p_full_name, p_email, p_role, p_especialidad, p_registro_medico, p_telefono, p_activo)
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

GRANT EXECUTE ON FUNCTION admin_upsert_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_profile TO anon;
`;

console.log("SQL generated for admin_upsert_profile");
