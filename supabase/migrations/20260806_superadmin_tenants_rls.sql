-- Migration: Unblock profiles, tenants, and website_config RLS permissions for SuperAdmin & clinic creation
-- Run this in Supabase Dashboard -> SQL Editor to resolve HTTP 403 Forbidden errors.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_config TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated, anon;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
CREATE POLICY "Public access profiles"
ON public.profiles FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public access website_config" ON public.website_config;
CREATE POLICY "Public access website_config"
ON public.website_config FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public access tenants" ON public.tenants;
CREATE POLICY "Public access tenants"
ON public.tenants FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);
