// Script para crear la función RPC admin_change_password en Supabase PostgreSQL
import fetch from 'node-fetch';

const SUPABASE_URL = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const SERVICE_KEY  = 'sb_secret_Vfz6a1lTTBaDJjoIr1KKhg_AmSkJpLz';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
};

const SQL_RPC = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_change_password(user_email text, new_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id uuid;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(user_email) LIMIT 1;
  
  IF target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No se encontró usuario registrado con ese email.');
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = target_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_change_password(text, text) TO anon, authenticated, service_role;
`;

console.log("SQL para RPC admin_change_password:");
console.log(SQL_RPC);
