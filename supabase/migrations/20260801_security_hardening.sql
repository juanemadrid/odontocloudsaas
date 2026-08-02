-- Security hardening: authoritative roles, tenant isolation and public config sanitization.
-- Apply this migration before deploying the updated frontend.

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.tenant_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
    AND p.activo IS TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.activo IS TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.activo IS TRUE
      AND lower(trim(p.role)) = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.activo IS TRUE
      AND lower(trim(p.role)) IN ('admin', 'administrador', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_config_key(config_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_superadmin()
    OR (
      public.is_active_user()
      AND (
        config_key = public.get_user_tenant_id()::text
        OR config_key LIKE public.get_user_tenant_id()::text || '\_%' ESCAPE '\'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tenant_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_config_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_config_key(text) TO anon, authenticated;

-- Disable legacy SECURITY DEFINER endpoints that accepted arbitrary targets.
DO $$
DECLARE
  routine record;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'admin_change_password',
        'admin_upsert_profile',
        'admin_toggle_profile_active',
        'admin_delete_profile'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      routine.signature
    );
  END LOOP;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_config ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'tenants', 'website_config')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

CREATE POLICY profiles_select_secure
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_active_user()
  AND (
    id = auth.uid()
    OR tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin()
  )
);

CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() AND public.is_active_user())
WITH CHECK (
  id = auth.uid()
  AND tenant_id = public.get_user_tenant_id()
  AND public.is_active_user()
);

REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, email, especialidad, registro_medico, telefono)
  ON public.profiles TO authenticated;

CREATE POLICY tenants_select_secure
ON public.tenants
FOR SELECT
TO authenticated
USING (
  public.is_active_user()
  AND (id = public.get_user_tenant_id() OR public.is_superadmin())
);

CREATE POLICY tenants_update_admin
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  public.is_active_user()
  AND (
    (id = public.get_user_tenant_id() AND public.is_tenant_admin())
    OR public.is_superadmin()
  )
)
WITH CHECK (
  public.is_active_user()
  AND (
    (id = public.get_user_tenant_id() AND public.is_tenant_admin())
    OR public.is_superadmin()
  )
);

CREATE POLICY tenants_insert_superadmin
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());

CREATE POLICY tenants_delete_superadmin
ON public.tenants
FOR DELETE
TO authenticated
USING (public.is_superadmin());

REVOKE ALL ON public.tenants FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;

CREATE POLICY website_config_select_secure
ON public.website_config
FOR SELECT
TO authenticated
USING (public.can_access_config_key(tenant_id::text));

CREATE POLICY website_config_insert_secure
ON public.website_config
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_config_key(tenant_id::text));

CREATE POLICY website_config_update_secure
ON public.website_config
FOR UPDATE
TO authenticated
USING (public.can_access_config_key(tenant_id::text))
WITH CHECK (public.can_access_config_key(tenant_id::text));

CREATE POLICY website_config_delete_secure
ON public.website_config
FOR DELETE
TO authenticated
USING (public.can_access_config_key(tenant_id::text));

REVOKE ALL ON public.website_config FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_config TO authenticated;

-- Rebuild tenant policies for every current table that actually has tenant_id.
DO $$
DECLARE
  table_record record;
  policy_record record;
BEGIN
  FOR table_record IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns AS c
    JOIN pg_tables AS t
      ON t.schemaname = c.table_schema
     AND t.tablename = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND c.table_name NOT IN ('profiles', 'tenants', 'website_config')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.table_name);

    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_record.table_name
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        policy_record.policyname,
        table_record.table_name
      );
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING
       (public.is_active_user() AND
        (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin()))',
      table_record.table_name || '_tenant_select',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK
       (public.is_active_user() AND
        (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin()))',
      table_record.table_name || '_tenant_insert',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING
       (public.is_active_user() AND
        (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin()))
       WITH CHECK
       (public.is_active_user() AND
        (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin()))',
      table_record.table_name || '_tenant_update',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING
       (public.is_active_user() AND
        (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin()))',
      table_record.table_name || '_tenant_delete',
      table_record.table_name
    );
  END LOOP;
END;
$$;

-- Public pages receive an allow-listed view of each website configuration.
CREATE OR REPLACE FUNCTION public.get_public_website_configs()
RETURNS TABLE (tenant_id text, config jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    wc.tenant_id::text,
    coalesce((
      SELECT jsonb_object_agg(entry.key, entry.value)
      FROM jsonb_each(coalesce(wc.config, '{}'::jsonb)) AS entry
      WHERE entry.key = ANY (ARRAY[
        'accentColor', 'address', 'city', 'contactPhone', 'ctaBtnLink',
        'ctaBtnText', 'ctaText', 'ctaTitle', 'doctors', 'email',
        'empresa_datos', 'faq', 'faqs', 'fontFamily', 'heroBadgeText',
        'heroBtn1Link', 'heroBtn1Text', 'heroBtn2Link', 'heroBtn2Text',
        'heroSubtitle', 'heroTitle', 'heroVideoUrl', 'identityHeroImage',
        'identityMission', 'identitySubtitle', 'identityTitle',
        'identityValues', 'identityVision', 'logo', 'mission', 'name',
        'phone', 'plans', 'primaryColor', 'seoDesc', 'seoTitle',
        'services', 'servicesSectionBadge', 'servicesSectionDesc',
        'servicesSectionTitle', 'slides', 'slug', 'testimonials',
        'testimonialsTitle', 'vision'
      ]::text[])
    ), '{}'::jsonb)
  FROM public.website_config AS wc;
$$;
REVOKE ALL ON FUNCTION public.get_public_website_configs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_website_configs() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.patient_portal_sessions (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_portal_sessions_expiry_idx
  ON public.patient_portal_sessions (expires_at);

ALTER TABLE public.patient_portal_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_portal_sessions FROM PUBLIC, anon, authenticated;

DELETE FROM public.patient_portal_sessions
WHERE expires_at < now();
CREATE TABLE IF NOT EXISTS public.registration_attempts (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  request_hash text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_attempts_hash_time_idx
  ON public.registration_attempts (request_hash, attempted_at DESC);

ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_attempts FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.tenant_secrets (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  gemini_api_key text,
  factus_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_secrets FROM PUBLIC, anon, authenticated;

-- Move legacy Gemini keys out of website_config when the key belongs to a UUID tenant.
INSERT INTO public.tenant_secrets (tenant_id, gemini_api_key, updated_at)
SELECT
  wc.tenant_id::text::uuid,
  coalesce(
    nullif(wc.config ->> 'geminiApiKey', ''),
    nullif(wc.config ->> 'gemini_api_key', '')
  ),
  now()
FROM public.website_config AS wc
WHERE wc.tenant_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    nullif(wc.config ->> 'geminiApiKey', '') IS NOT NULL
    OR nullif(wc.config ->> 'gemini_api_key', '') IS NOT NULL
  )
ON CONFLICT (tenant_id) DO UPDATE
SET gemini_api_key = excluded.gemini_api_key,
    updated_at = excluded.updated_at;

UPDATE public.website_config
SET config = config - ARRAY['geminiApiKey', 'gemini_api_key']::text[],
    updated_at = now()
WHERE config ? 'geminiApiKey'
   OR config ? 'gemini_api_key';

-- Move tenant-specific Factus credentials to the private secrets table.
INSERT INTO public.tenant_secrets (tenant_id, factus_config, updated_at)
SELECT
  wc.tenant_id::text::uuid,
  coalesce(wc.config -> 'facturacion', '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'factusClientId', nullif(wc.config ->> 'factusClientId', ''),
      'factusClientSecret', nullif(wc.config ->> 'factusClientSecret', ''),
      'factusUsername', nullif(wc.config ->> 'factusUsername', ''),
      'factusPassword', nullif(wc.config ->> 'factusPassword', ''),
      'factusNumberingRangeId', nullif(wc.config ->> 'factusNumberingRangeId', '')
    )),
  now()
FROM public.website_config AS wc
WHERE wc.tenant_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    wc.config ? 'facturacion'
    OR wc.config ? 'factusClientId'
    OR wc.config ? 'factusClientSecret'
  )
ON CONFLICT (tenant_id) DO UPDATE
SET factus_config = public.tenant_secrets.factus_config || excluded.factus_config,
    updated_at = excluded.updated_at;

WITH tenant_entries AS (
  SELECT entry
  FROM public.website_config AS wc
  CROSS JOIN LATERAL jsonb_array_elements(wc.config -> 'registered_tenants') AS entry
  WHERE jsonb_typeof(wc.config -> 'registered_tenants') = 'array'
)
INSERT INTO public.tenant_secrets (tenant_id, factus_config, updated_at)
SELECT
  (entry ->> 'id')::uuid,
  jsonb_strip_nulls(jsonb_build_object(
    'factusClientId', nullif(entry ->> 'factusClientId', ''),
    'factusClientSecret', nullif(entry ->> 'factusClientSecret', ''),
    'factusUsername', nullif(entry ->> 'factusUsername', ''),
    'factusPassword', nullif(entry ->> 'factusPassword', ''),
    'factusNumberingRangeId', nullif(entry ->> 'factusNumberingRangeId', ''),
    'factusTestMode', coalesce(nullif(entry ->> 'factusTestMode', '')::boolean, true),
    'facturacionCuota', coalesce(nullif(entry ->> 'facturacionCuota', '')::integer, 0),
    'facturacionUsadas', coalesce(nullif(entry ->> 'facturacionUsadas', '')::integer, 0)
  )),
  now()
FROM tenant_entries
WHERE entry ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tenants AS tenant
    WHERE tenant.id = (entry ->> 'id')::uuid
  )
ON CONFLICT (tenant_id) DO UPDATE
SET factus_config = public.tenant_secrets.factus_config || excluded.factus_config,
    updated_at = excluded.updated_at;

UPDATE public.website_config AS wc
SET config = jsonb_set(
  wc.config,
  '{registered_tenants}',
  coalesce((
    SELECT jsonb_agg(entry - ARRAY[
      'factusClientId', 'factusClientSecret', 'factusUsername', 'factusPassword'
    ]::text[])
    FROM jsonb_array_elements(wc.config -> 'registered_tenants') AS entry
  ), '[]'::jsonb)
)
WHERE jsonb_typeof(wc.config -> 'registered_tenants') = 'array';

UPDATE public.website_config
SET config = config - ARRAY[
  'facturacion', 'factusClientId', 'factusClientSecret',
  'factusUsername', 'factusPassword', 'factusNumberingRangeId'
]::text[],
updated_at = now();

DELETE FROM public.registration_attempts
WHERE attempted_at < now() - interval '7 days';



CREATE TABLE IF NOT EXISTS public.outbound_message_log (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  recipient_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbound_message_log_rate_idx
  ON public.outbound_message_log (tenant_id, user_id, created_at DESC);

ALTER TABLE public.outbound_message_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outbound_message_log FROM PUBLIC, anon, authenticated;

DELETE FROM public.outbound_message_log
WHERE created_at < now() - interval '30 days';
-- Private clinical attachments and explicitly public branding assets.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('adjuntos', 'adjuntos', false),
  ('clinical-files', 'clinical-files', true),
  ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public;

CREATE OR REPLACE FUNCTION public.can_access_private_attachment(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_superadmin()
    OR (
      public.is_active_user()
      AND (
        split_part(object_name, '/', 1) = public.get_user_tenant_id()::text
        OR (
          split_part(object_name, '/', 1) = 'pacientes'
          AND (
            split_part(object_name, '/', 2) = public.get_user_tenant_id()::text
            OR EXISTS (
              SELECT 1
              FROM public.pacientes AS patient
              WHERE patient.id::text = split_part(object_name, '/', 2)
                AND patient.tenant_id::text = public.get_user_tenant_id()::text
            )
          )
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_private_attachment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_private_attachment(text) TO authenticated;


CREATE OR REPLACE FUNCTION public.can_manage_public_asset(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_superadmin()
    OR (
      public.is_active_user()
      AND (
        split_part(object_name, '/', 1) = public.get_user_tenant_id()::text
        OR (
          split_part(object_name, '/', 1) IN (
            'inventario', 'productos', 'esterilizacion', 'tenants'
          )
          AND split_part(object_name, '/', 2)
            LIKE public.get_user_tenant_id()::text || '\_%' ESCAPE '\'
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_public_asset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_public_asset(text) TO authenticated;
DROP POLICY IF EXISTS "Public Access clinical-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload clinical-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update clinical-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete clinical-files" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Storage clinical-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Storage clinical-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Storage clinical-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Storage clinical-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant read private attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant insert private attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant update private attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant delete private attachments" ON storage.objects;
DROP POLICY IF EXISTS "Superadmin manages public assets" ON storage.objects;

DROP POLICY IF EXISTS "Public read clinical files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert clinical files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update clinical files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete clinical files" ON storage.objects;
CREATE POLICY "Public read clinical files"
ON storage.objects FOR SELECT
USING (bucket_id = 'clinical-files');

CREATE POLICY "Authenticated insert clinical files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clinical-files'
  AND public.can_manage_public_asset(name)
);

CREATE POLICY "Authenticated update clinical files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'clinical-files'
  AND public.can_manage_public_asset(name)
)
WITH CHECK (
  bucket_id = 'clinical-files'
  AND public.can_manage_public_asset(name)
);

CREATE POLICY "Authenticated delete clinical files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clinical-files'
  AND public.can_manage_public_asset(name)
);

CREATE POLICY "Tenant read private attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'adjuntos'
  AND public.can_access_private_attachment(name)
);

CREATE POLICY "Tenant insert private attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'adjuntos'
  AND public.can_access_private_attachment(name)
);

CREATE POLICY "Tenant update private attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'adjuntos'
  AND public.can_access_private_attachment(name)
)
WITH CHECK (
  bucket_id = 'adjuntos'
  AND public.can_access_private_attachment(name)
);

CREATE POLICY "Tenant delete private attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'adjuntos'
  AND public.can_access_private_attachment(name)
);

CREATE POLICY "Superadmin manages public assets"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'public-assets'
  AND public.is_superadmin()
)
WITH CHECK (
  bucket_id = 'public-assets'
  AND public.is_superadmin()
);
