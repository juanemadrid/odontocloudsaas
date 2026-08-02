-- Migration: Complete cleanup of orphan tenants, profiles, test users and subscription requests
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Eliminar perfiles de prueba y usuarios huérfanos en public.profiles
-- (Conserva únicamente la cuenta principal del SuperAdmin madridsystem@outlook.es)
DELETE FROM public.profiles
WHERE lower(email) != 'madridsystem@outlook.es';

-- 2. Eliminar usuarios huérfanos de la tabla de autenticación (auth.users)
-- (Conserva únicamente la cuenta principal del SuperAdmin madridsystem@outlook.es)
DELETE FROM auth.users
WHERE lower(email) != 'madridsystem@outlook.es';

-- 3. Eliminar clínicas huérfanas en la tabla de PostgreSQL 'tenants'
-- (Conserva únicamente la Clínica Principal OdontoCloud con ID a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11)
DELETE FROM public.tenants
WHERE id != 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- 4. Limpiar y reiniciar el registro de clínicas y solicitudes en website_config
UPDATE public.website_config
SET config = jsonb_set(
      jsonb_set(config, '{registered_tenants}', '[]'::jsonb),
      '{subscription_requests}', '[]'::jsonb
    ),
    updated_at = now()
WHERE tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- 5. Confirmar que el SuperAdmin madridsystem@outlook.es tenga su perfil y rol activo
INSERT INTO public.profiles (id, email, full_name, role, tenant_id, activo)
SELECT id, email, 'SuperAdmin MadridSystem', 'superadmin', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, true
FROM auth.users
WHERE lower(email) = 'madridsystem@outlook.es'
ON CONFLICT (id) DO UPDATE SET 
  role = 'superadmin', 
  tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 
  activo = true;
