/**
 * test_sql_auth_rpc.mjs
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SQL_CREATE_FULL_RPC = `
CREATE OR REPLACE FUNCTION admin_upsert_profile_v2(
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
  v_exists BOOLEAN;
BEGIN
  -- 1. Verificar si el usuario existe en auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_id OR email = p_email) INTO v_exists;

  IF NOT v_exists THEN
    -- Crear nuevo usuario en auth.users directamente
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
      p_id,
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
    -- Si existe y viene una nueva contraseña o email, actualizar auth.users
    IF p_password IS NOT NULL AND p_password != '' THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
          email = COALESCE(p_email, email),
          updated_at = NOW()
      WHERE id = p_id OR email = p_email;
    ELSIF p_email IS NOT NULL AND p_email != '' THEN
      UPDATE auth.users
      SET email = p_email,
          updated_at = NOW()
      WHERE id = p_id;
    END IF;
  END IF;

  -- 2. Upsert en profiles
  INSERT INTO profiles (id, tenant_id, full_name, email, role, especialidad, registro_medico, telefono, activo)
  VALUES (p_id, p_tenant_id, p_full_name, p_email, p_role, p_especialidad, p_registro_medico, p_telefono, p_activo)
  ON CONFLICT (id) DO UPDATE SET
    full_name       = EXCLUDED.full_name,
    email           = EXCLUDED.email,
    role            = EXCLUDED.role,
    especialidad    = EXCLUDED.especialidad,
    registro_medico  = EXCLUDED.registro_medico,
    telefono        = EXCLUDED.telefono,
    activo          = EXCLUDED.activo,
    tenant_id       = EXCLUDED.tenant_id;

  RETURN json_build_object('success', true, 'id', p_id::text);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_profile_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_profile_v2 TO anon;
`;

console.log(SQL_CREATE_FULL_RPC);
