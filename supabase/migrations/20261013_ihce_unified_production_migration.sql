-- =============================================================================
-- MIGRACIÓN UNIFICADA: MÓDULO DE INTEROPERABILIDAD IHCE (MINSALUD COLOMBIA)
-- Archivo: supabase/migrations/20261013_ihce_unified_production_migration.sql
-- =============================================================================
-- OdontoCloud SaaS — Cumplimiento Ley 2015/2020, Res. 866/2021 y Res. 1888/2025
-- Estándar: HL7 FHIR R4 / Perfiles Nacionales Vulcano
-- Cero dependencias externas. Totalmente idempotente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONES Y FUNCIONES DE COMPATIBILIDAD
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función de compatibilidad is_admin() alineada con is_tenant_admin() oficial
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_tenant_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. TABLA: ihce_configurations (Configuración por Clínica / IPS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ihce_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  codigo_habilitacion_reps VARCHAR(12),
  codigo_sede_reps VARCHAR(2) DEFAULT '01',
  codigo_servicio_reps VARCHAR(3) DEFAULT '334', -- 334 = Odontología General
  nombre_prestador TEXT,
  nit TEXT,
  ambiente VARCHAR(20) NOT NULL DEFAULT 'SANDBOX_MOCK', -- 'SANDBOX_MOCK', 'PRUEBAS_MINSALUD', 'PRODUCCION'
  client_id TEXT,
  tenant_id_auth TEXT,
  scope TEXT DEFAULT 'https://sandbox.ihcecol.gov.co/.default',
  client_secret_encrypted TEXT,
  apim_subscription_key_encrypted TEXT,
  token_endpoint TEXT DEFAULT 'https://hercules.sispro.gov.co/auth/realms/minsalud/protocol/openid-connect/token',
  api_fhir_endpoint TEXT DEFAULT 'https://sandbox.ihcecol.gov.co/ihce',
  is_active BOOLEAN DEFAULT false,
  auto_dispatch_enabled BOOLEAN DEFAULT true,
  max_reintentos INTEGER DEFAULT 5,
  ultimo_envio_at TIMESTAMPTZ,
  ultimo_error_at TIMESTAMPTZ,
  ultimo_error_detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  CONSTRAINT uq_ihce_config_tenant UNIQUE (tenant_id),
  CONSTRAINT chk_ihce_ambiente CHECK (ambiente IN ('SANDBOX_MOCK', 'PRUEBAS_MINSALUD', 'PRODUCCION')),
  CONSTRAINT chk_reps_length CHECK (codigo_habilitacion_reps IS NULL OR codigo_habilitacion_reps ~ '^[0-9]{10,12}$'),
  CONSTRAINT chk_sede_length CHECK (codigo_sede_reps IS NULL OR codigo_sede_reps ~ '^[0-9]{2}$')
);

-- Asegurar columnas si la tabla ya existía
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ihce_configurations' AND column_name='apim_subscription_key_encrypted') THEN
    ALTER TABLE public.ihce_configurations ADD COLUMN apim_subscription_key_encrypted TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ihce_configurations' AND column_name='codigo_servicio_reps') THEN
    ALTER TABLE public.ihce_configurations ADD COLUMN codigo_servicio_reps VARCHAR(3) DEFAULT '334';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ihce_configurations' AND column_name='tenant_id_auth') THEN
    ALTER TABLE public.ihce_configurations ADD COLUMN tenant_id_auth TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ihce_configurations' AND column_name='scope') THEN
    ALTER TABLE public.ihce_configurations ADD COLUMN scope TEXT DEFAULT 'https://sandbox.ihcecol.gov.co/.default';
  END IF;
END $$;

ALTER TABLE public.ihce_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ihce_configurations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ihce_config_tenant_select ON public.ihce_configurations;
CREATE POLICY ihce_config_tenant_select ON public.ihce_configurations
FOR SELECT TO authenticated
USING (
  public.is_active_user() AND (
    tenant_id = public.get_user_tenant_id() OR public.is_superadmin()
  )
);

DROP POLICY IF EXISTS ihce_config_tenant_manage ON public.ihce_configurations;
CREATE POLICY ihce_config_tenant_manage ON public.ihce_configurations
FOR ALL TO authenticated
USING (
  public.is_active_user() AND (
    (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin()) OR public.is_superadmin()
  )
)
WITH CHECK (
  public.is_active_user() AND (
    (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin()) OR public.is_superadmin()
  )
);

-- -----------------------------------------------------------------------------
-- 2. VISTA SEGURA: ihce_configurations_secure_view (Secretos Enmascarados)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.ihce_configurations_secure_view CASCADE;
CREATE VIEW public.ihce_configurations_secure_view AS
SELECT 
  id,
  tenant_id,
  codigo_habilitacion_reps,
  codigo_sede_reps,
  codigo_servicio_reps,
  nombre_prestador,
  nit,
  ambiente,
  client_id,
  tenant_id_auth,
  scope,
  CASE 
    WHEN client_secret_encrypted IS NOT NULL AND length(trim(client_secret_encrypted)) > 0 
    THEN '••••••••••••••••' 
    ELSE NULL 
  END AS client_secret,
  (client_secret_encrypted IS NOT NULL AND length(trim(client_secret_encrypted)) > 0) AS has_secret,
  CASE 
    WHEN apim_subscription_key_encrypted IS NOT NULL AND length(trim(apim_subscription_key_encrypted)) > 0 
    THEN '••••••••••••••••' 
    ELSE NULL 
  END AS apim_subscription_key,
  (apim_subscription_key_encrypted IS NOT NULL AND length(trim(apim_subscription_key_encrypted)) > 0) AS has_apim_key,
  token_endpoint,
  api_fhir_endpoint,
  is_active,
  auto_dispatch_enabled,
  max_reintentos,
  ultimo_envio_at,
  ultimo_error_at,
  ultimo_error_detalle,
  created_at,
  updated_at
FROM public.ihce_configurations;

REVOKE ALL ON public.ihce_configurations_secure_view FROM PUBLIC, anon;
GRANT SELECT ON public.ihce_configurations_secure_view TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. TABLA: ihce_outbox_queue (Cola Transaccional de Despacho RDA)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ihce_outbox_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  evolution_id UUID NOT NULL REFERENCES public.evoluciones(id) ON DELETE RESTRICT,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  radicado_oficial TEXT,
  ultimo_http_status INTEGER,
  intentos INTEGER DEFAULT 0,
  max_intentos INTEGER DEFAULT 5,
  ultimo_error TEXT,
  ultimo_intento_at TIMESTAMPTZ,
  proximo_intento_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  payload_bundle JSONB,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  CONSTRAINT chk_ihce_outbox_status CHECK (
    status IN ('PENDIENTE', 'PROCESANDO', 'ACEPTADO', 'RECHAZADO', 'ERROR_RED', 'PENDIENTE_CONCILIACION')
  ),
  CONSTRAINT uq_ihce_outbox_evolution UNIQUE (evolution_id)
);

ALTER TABLE public.ihce_outbox_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ihce_outbox_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ihce_outbox_tenant_select ON public.ihce_outbox_queue;
CREATE POLICY ihce_outbox_tenant_select ON public.ihce_outbox_queue
FOR SELECT TO authenticated
USING (
  public.is_active_user() AND (
    tenant_id = public.get_user_tenant_id() OR public.is_superadmin()
  )
);

DROP POLICY IF EXISTS ihce_outbox_tenant_manage ON public.ihce_outbox_queue;
CREATE POLICY ihce_outbox_tenant_manage ON public.ihce_outbox_queue
FOR ALL TO authenticated
USING (
  public.is_active_user() AND (
    (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin()) OR public.is_superadmin()
  )
)
WITH CHECK (
  public.is_active_user() AND (
    (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin()) OR public.is_superadmin()
  )
);

-- -----------------------------------------------------------------------------
-- 4. TABLA: clinical_signature_attempts (Protección Fuerza Bruta en Firma)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_signature_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  success BOOLEAN DEFAULT false,
  ip_address TEXT
);

ALTER TABLE public.clinical_signature_attempts ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. TABLA: ihce_prestadores (Soporte Multiprofesional Independiente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ihce_prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tipo_prestador VARCHAR(30) NOT NULL DEFAULT 'PROFESIONAL_INDEPENDIENTE',
  codigo_habilitacion_reps VARCHAR(12) NOT NULL,
  codigo_sede_reps VARCHAR(2) NOT NULL DEFAULT '01',
  codigo_servicio_reps VARCHAR(3) NOT NULL DEFAULT '334',
  nombre_prestador TEXT NOT NULL,
  nit TEXT,
  ambiente VARCHAR(20) NOT NULL DEFAULT 'SANDBOX_MOCK',
  client_id TEXT NOT NULL,
  client_secret_envelope JSONB NOT NULL,
  apim_subscription_key_envelope JSONB,
  tenant_id_auth TEXT,
  scope TEXT,
  token_endpoint TEXT,
  api_fhir_endpoint TEXT DEFAULT 'https://sandbox.ihcecol.gov.co/ihce',
  is_active BOOLEAN DEFAULT false,
  auto_dispatch_enabled BOOLEAN DEFAULT true,
  max_reintentos INTEGER DEFAULT 5,
  ultimo_envio_at TIMESTAMPTZ,
  ultimo_error_at TIMESTAMPTZ,
  ultimo_error_detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  CONSTRAINT uq_ihce_prestador_doctor UNIQUE (tenant_id, doctor_id)
);

ALTER TABLE public.ihce_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ihce_prestadores FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ihce_prestadores_select ON public.ihce_prestadores;
CREATE POLICY ihce_prestadores_select ON public.ihce_prestadores
FOR SELECT TO authenticated
USING (
  public.is_active_user() AND (
    tenant_id = public.get_user_tenant_id() OR public.is_superadmin()
  )
);

DROP POLICY IF EXISTS ihce_prestadores_manage ON public.ihce_prestadores;
CREATE POLICY ihce_prestadores_manage ON public.ihce_prestadores
FOR ALL TO authenticated
USING (
  public.is_active_user() AND (
    (tenant_id = public.get_user_tenant_id() AND (public.is_tenant_admin() OR doctor_id = auth.uid())) 
    OR public.is_superadmin()
  )
)
WITH CHECK (
  public.is_active_user() AND (
    (tenant_id = public.get_user_tenant_id() AND (public.is_tenant_admin() OR doctor_id = auth.uid())) 
    OR public.is_superadmin()
  )
);

COMMIT;
