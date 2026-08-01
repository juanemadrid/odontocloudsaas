// Script para crear la función RPC admin_change_password en Supabase PostgreSQL
import fetch from 'node-fetch';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

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
    RETURN jsonb_build_object('success', false, 'message', 'No se encontró ningún usuario registrado con ese email.');
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      updated_at = now()
  WHERE id = target_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_change_password(text, text) TO anon, authenticated, service_role;
`;

console.log("Copiar y pegar este SQL en Supabase SQL Editor si no existe aún:");
console.log("-".repeat(60));
console.log(SQL_RPC);
console.log("-".repeat(60));
