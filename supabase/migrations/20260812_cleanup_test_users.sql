-- Script SQL para eliminar usuarios de prueba y conservar solo la cuenta principal de la clínica
-- Ejecutar en Supabase Dashboard -> SQL Editor

-- 1. Eliminar perfiles de prueba de la tabla public.profiles para la clínica ATM Centro del dolor
DELETE FROM public.profiles
WHERE (tenant_id = '60cd9690-b1ba-46d6-a6e7-1f5cf9f6797f' OR inquilino = '60cd9690-b1ba-46d6-a6e7-1f5cf9f6797f')
  AND lower(email) != 'atmcentrodeldolor@gmail.com';

-- 2. Eliminar usuarios de prueba de la tabla auth.users
DELETE FROM auth.users
WHERE lower(email) != 'atmcentrodeldolor@gmail.com'
  AND (
    raw_user_meta_data->>'tenant_id' = '60cd9690-b1ba-46d6-a6e7-1f5cf9f6797f'
    OR lower(email) LIKE '%doctor%'
    OR lower(email) LIKE '%test%'
    OR lower(email) LIKE '%pruebas%'
  );

-- 3. Limpiar los usuarios y detalles en website_config para la clínica
UPDATE public.website_config
SET config = jsonb_set(
  jsonb_set(config, '{user_details}', '{}'::jsonb),
  '{usuarios}',
  '[]'::jsonb
)
WHERE tenant_id = '60cd9690-b1ba-46d6-a6e7-1f5cf9f6797f';
