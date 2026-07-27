/**
 * create_admin_rpc.mjs
 * Crea funciones RPC con SECURITY DEFINER en Supabase para que el admin
 * pueda crear/editar/eliminar usuarios y actualizar su contraseña de Auth sin service key.
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// SQL para crear las funciones RPC con SECURITY DEFINER
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
  v_result JSON;
  v_user_id UUID;
  v_exists BOOLEAN;
BEGIN
  v_user_id := p_id;

  -- 1. Verificar si el usuario existe por ID o Email en auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = v_user_id OR email = p_email) INTO v_exists;

  IF NOT v_exists THEN
    -- Si es nuevo usuario y no existe en auth.users, crearlo
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      p_email,
      CASE 
        WHEN p_password IS NOT NULL AND p_password != '' 
        THEN extensions.crypt(p_password, extensions.gen_salt('bf'))
        ELSE extensions.crypt('@NewUser2024', extensions.gen_salt('bf'))
      END,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      json_build_object('full_name', p_full_name, 'role', p_role, 'tenant_id', p_tenant_id)::jsonb,
      NOW(),
      NOW()
    );
  ELSE
    -- Si ya existe en auth.users, obtener su id
    SELECT id INTO v_user_id FROM auth.users WHERE id = p_id OR email = p_email LIMIT 1;

    -- Actualizar contraseña en auth.users si se proporcionó una nueva
    IF p_password IS NOT NULL AND p_password != '' THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
          email = COALESCE(p_email, email),
          updated_at = NOW()
      WHERE id = v_user_id;
    ELSIF p_email IS NOT NULL AND p_email != '' THEN
      UPDATE auth.users
      SET email = p_email,
          updated_at = NOW()
      WHERE id = v_user_id;
    END IF;
  END IF;

  -- 2. Upsert en tabla profiles
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

-- ============================================================
-- Función: admin_toggle_profile_active
-- Activa/desactiva un usuario
-- ============================================================
CREATE OR REPLACE FUNCTION admin_toggle_profile_active(
  p_id UUID,
  p_activo BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET activo = p_activo WHERE id = p_id;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_toggle_profile_active TO authenticated;

-- ============================================================
-- Función: admin_delete_profile
-- Elimina un usuario
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_profile(p_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM profiles WHERE id = p_id AND id != auth.uid();
  DELETE FROM auth.users WHERE id = p_id AND id != auth.uid();
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_profile TO authenticated;

SELECT 'Functions created successfully' AS status;
`;

console.log(SQL_CREATE_FUNCTIONS);
