-- =============================================================================
-- MIGRACIÓN PREPARADA: ESQUEMA MULTIPROFESIONAL Y CUSTODIA CIFRADA IHCE
-- Archivo: supabase/migrations/20261013_ihce_multiprofessional_encrypted_schema.sql
-- =============================================================================
-- IMPORTANTE: ESTE ARCHIVO ES PARA REVISIÓN TÉCNICA Y AUDITORÍA.
-- NO SE EJECUTA AUTOMÁTICAMENTE EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA.
-- =============================================================================
-- Cumplimiento:
-- 1. Eliminación de la limitación UNIQUE(tenant_id).
-- 2. Soporte para múltiples prestadores independientes dentro de una misma clínica.
-- 3. Diferenciación estricta entre profesional tratante, prestador habilitado, REPS, sede y servicio.
-- 4. Almacenamiento exclusivo de secretos en sobres cifrados AES-256-GCM (JSONB envelope).
-- 5. Prohibición de almacenamiento de texto plano en base de datos.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TABLA MULTIPROFESIONAL: ihce_prestadores
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ihce_prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  
  -- Vinculación opcional a un profesional específico en profiles
  -- Si es NULL, representa la habilitación institucional de la clínica (IPS)
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Naturaleza del prestador habilitado
  tipo_prestador VARCHAR(30) NOT NULL DEFAULT 'PROFESIONAL_INDEPENDIENTE',
  
  -- Identificación oficial en REPS (10 dígitos prestador, o 12 con sede)
  codigo_habilitacion_reps VARCHAR(12) NOT NULL,
  codigo_sede_reps VARCHAR(2) NOT NULL DEFAULT '01',
  codigo_servicio_reps VARCHAR(3) NOT NULL DEFAULT '334', -- 334 = Odontología General
  nombre_prestador TEXT NOT NULL,
  nit TEXT,
  
  -- Ambiente de interoperabilidad
  ambiente VARCHAR(20) NOT NULL DEFAULT 'SANDBOX_MOCK',
  
  -- Parámetros OAuth2 MinSalud / Entra ID
  client_id TEXT NOT NULL,
  
  -- Sobres cifrados autenticados AES-256-GCM (formato: { v, alg, kid, iv, ciphertext })
  -- PROHIBIDO TEXTO PLANO
  client_secret_envelope JSONB NOT NULL,
  apim_subscription_key_envelope JSONB,
  
  -- Metadatos de autenticación ministerial
  tenant_id_auth TEXT, -- TenantID del portal de llaves MinSalud
  scope TEXT,          -- Scope asignado por MinSalud
  token_endpoint TEXT, -- URL de token (si aplica)
  api_fhir_endpoint TEXT DEFAULT 'https://vulcano.ihcecol.gov.co/fhir/r4',
  
  -- Banderas operativas
  is_active BOOLEAN DEFAULT false,
  auto_dispatch_enabled BOOLEAN DEFAULT true,
  max_reintentos INTEGER DEFAULT 5,
  ultimo_envio_at TIMESTAMPTZ,
  ultimo_error_at TIMESTAMPTZ,
  ultimo_error_detalle TEXT,
  
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  
  -- Restricciones de integridad y seguridad
  CONSTRAINT chk_prestador_tipo CHECK (tipo_prestador IN ('PROFESIONAL_INDEPENDIENTE', 'IPS')),
  CONSTRAINT chk_prestador_ambiente CHECK (ambiente IN ('SANDBOX_MOCK', 'PRUEBAS_MINSALUD', 'PRODUCCION')),
  CONSTRAINT chk_prestador_reps CHECK (codigo_habilitacion_reps ~ '^[0-9]{10,12}$'),
  CONSTRAINT chk_prestador_sede CHECK (codigo_sede_reps ~ '^[0-9]{2}$'),
  CONSTRAINT chk_prestador_servicio CHECK (codigo_servicio_reps ~ '^[0-9]{3}$'),
  
  -- Aislamiento multiprofesional: Un doctor solo tiene un registro de llaves por clínica
  CONSTRAINT uq_ihce_prestador_doctor UNIQUE (tenant_id, doctor_id),
  
  -- Un código REPS solo puede registrarse una vez por clínica para evitar colisiones
  CONSTRAINT uq_ihce_prestador_reps UNIQUE (tenant_id, codigo_habilitacion_reps)
);

-- -----------------------------------------------------------------------------
-- 2. SEGURIDAD RLS (Row Level Security)
-- -----------------------------------------------------------------------------
ALTER TABLE public.ihce_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ihce_prestadores FORCE ROW LEVEL SECURITY;

-- Lectura restringida a usuarios autenticados y activos de la misma clínica
DROP POLICY IF EXISTS ihce_prestadores_tenant_select ON public.ihce_prestadores;
CREATE POLICY ihce_prestadores_tenant_select ON public.ihce_prestadores
FOR SELECT TO authenticated
USING (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
);

-- Escritura restringida exclusivamente a Administradores de la clínica o al mismo profesional
DROP POLICY IF EXISTS ihce_prestadores_tenant_manage ON public.ihce_prestadores;
CREATE POLICY ihce_prestadores_tenant_manage ON public.ihce_prestadores
FOR ALL TO authenticated
USING (
  public.is_active_user() AND 
  tenant_id = public.get_user_tenant_id() AND
  (public.is_admin() OR doctor_id = auth.uid())
)
WITH CHECK (
  public.is_active_user() AND 
  tenant_id = public.get_user_tenant_id() AND
  (public.is_admin() OR doctor_id = auth.uid())
);

-- -----------------------------------------------------------------------------
-- 3. VISTA SEGURA CON ENMASCARAMIENTO TOTAL DE SECRETOS
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.ihce_prestadores_secure_view CASCADE;
CREATE VIEW public.ihce_prestadores_secure_view AS
SELECT 
  p.id,
  p.tenant_id,
  p.doctor_id,
  p.tipo_prestador,
  p.codigo_habilitacion_reps,
  p.codigo_sede_reps,
  p.codigo_servicio_reps,
  p.nombre_prestador,
  p.nit,
  p.ambiente,
  p.client_id,
  (p.client_secret_envelope IS NOT NULL AND p.client_secret_envelope ? 'ciphertext') AS has_secret,
  '••••••••••••••••' AS client_secret_masked,
  (p.apim_subscription_key_envelope IS NOT NULL AND p.apim_subscription_key_envelope ? 'ciphertext') AS has_apim_key,
  '••••••••••••••••' AS apim_subscription_key_masked,
  p.tenant_id_auth,
  p.scope,
  p.api_fhir_endpoint,
  p.token_endpoint,
  p.is_active,
  p.auto_dispatch_enabled,
  p.ultimo_envio_at,
  p.ultimo_error_at,
  p.ultimo_error_detalle,
  p.created_at,
  p.updated_at,
  prof.nombre_completo AS doctor_nombre_completo,
  prof.email AS doctor_email
FROM public.ihce_prestadores p
LEFT JOIN public.profiles prof ON prof.id = p.doctor_id;

REVOKE ALL ON public.ihce_prestadores_secure_view FROM PUBLIC, anon;
GRANT SELECT ON public.ihce_prestadores_secure_view TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. RPC SEGURO WRITE-ONLY: GUARDAR CREDENCIALES CIFRADAS (ENVELOPE ONLY)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_doctor_ihce_credentials(
  p_doctor_id UUID,
  p_reps_code VARCHAR(12),
  p_sede_code VARCHAR(2),
  p_servicio_code VARCHAR(3),
  p_tipo_prestador VARCHAR(30),
  p_nombre_prestador TEXT,
  p_nit TEXT,
  p_ambiente VARCHAR(20),
  p_client_id TEXT,
  p_client_secret_envelope JSONB,
  p_apim_key_envelope JSONB DEFAULT NULL,
  p_tenant_id_auth TEXT DEFAULT NULL,
  p_scope TEXT DEFAULT NULL,
  p_api_endpoint TEXT DEFAULT 'https://vulcano.ihcecol.gov.co/fhir/r4',
  p_token_endpoint TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT false,
  p_auto_dispatch BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID := public.get_user_tenant_id();
  v_existing RECORD;
  v_final_secret_envelope JSONB;
  v_final_apim_envelope JSONB;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: El usuario no pertenece a una clínica válida.';
  END IF;

  -- Solo administradores de clínica o el mismo profesional pueden configurar sus llaves
  IF NOT (public.is_admin() OR (p_doctor_id IS NOT NULL AND p_doctor_id = v_user_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN: No tienes privilegios para gestionar credenciales de este prestador.';
  END IF;

  -- Buscar registro existente por doctor
  SELECT * INTO v_existing 
  FROM public.ihce_prestadores 
  WHERE tenant_id = v_tenant_id 
    AND (
      (p_doctor_id IS NOT NULL AND doctor_id = p_doctor_id) OR
      (p_doctor_id IS NULL AND doctor_id IS NULL AND codigo_habilitacion_reps = p_reps_code)
    );

  -- VALIDACIÓN CRIPTOGRÁFICA DE ENVELOPE: Prohibir texto plano
  IF p_client_secret_envelope IS NOT NULL AND p_client_secret_envelope ? 'ciphertext' THEN
    IF NOT (p_client_secret_envelope ? 'iv' AND p_client_secret_envelope ? 'alg') THEN
      RAISE EXCEPTION 'INVALID_ENVELOPE: El secreto suministrado no cumple con la estructura requerida AES-256-GCM.';
    END IF;
    v_final_secret_envelope := p_client_secret_envelope;
  ELSE
    -- Preservar envelope existente
    v_final_secret_envelope := v_existing.client_secret_envelope;
  END IF;

  IF v_final_secret_envelope IS NULL THEN
    RAISE EXCEPTION 'SECRET_REQUIRED: Se requiere un sobre cifrado válido para el client_secret.';
  END IF;

  IF p_apim_key_envelope IS NOT NULL AND p_apim_key_envelope ? 'ciphertext' THEN
    v_final_apim_envelope := p_apim_key_envelope;
  ELSE
    v_final_apim_envelope := v_existing.apim_subscription_key_envelope;
  END IF;

  -- Upsert multiprofesional
  INSERT INTO public.ihce_prestadores (
    tenant_id,
    doctor_id,
    tipo_prestador,
    codigo_habilitacion_reps,
    codigo_sede_reps,
    codigo_servicio_reps,
    nombre_prestador,
    nit,
    ambiente,
    client_id,
    client_secret_envelope,
    apim_subscription_key_envelope,
    tenant_id_auth,
    scope,
    api_fhir_endpoint,
    token_endpoint,
    is_active,
    auto_dispatch_enabled,
    updated_at
  ) VALUES (
    v_tenant_id,
    p_doctor_id,
    coalesce(p_tipo_prestador, 'PROFESIONAL_INDEPENDIENTE'),
    p_reps_code,
    coalesce(p_sede_code, '01'),
    coalesce(p_servicio_code, '334'),
    p_nombre_prestador,
    p_nit,
    coalesce(p_ambiente, 'SANDBOX_MOCK'),
    p_client_id,
    v_final_secret_envelope,
    v_final_apim_envelope,
    p_tenant_id_auth,
    p_scope,
    coalesce(p_api_endpoint, 'https://vulcano.ihcecol.gov.co/fhir/r4'),
    p_token_endpoint,
    coalesce(p_is_active, false),
    coalesce(p_auto_dispatch, true),
    clock_timestamp()
  )
  ON CONFLICT (tenant_id, doctor_id) DO UPDATE
  SET tipo_prestador = EXCLUDED.tipo_prestador,
      codigo_habilitacion_reps = EXCLUDED.codigo_habilitacion_reps,
      codigo_sede_reps = EXCLUDED.codigo_sede_reps,
      codigo_servicio_reps = EXCLUDED.codigo_servicio_reps,
      nombre_prestador = EXCLUDED.nombre_prestador,
      nit = EXCLUDED.nit,
      ambiente = EXCLUDED.ambiente,
      client_id = EXCLUDED.client_id,
      client_secret_envelope = v_final_secret_envelope,
      apim_subscription_key_envelope = v_final_apim_envelope,
      tenant_id_auth = EXCLUDED.tenant_id_auth,
      scope = EXCLUDED.scope,
      api_fhir_endpoint = EXCLUDED.api_fhir_endpoint,
      token_endpoint = EXCLUDED.token_endpoint,
      is_active = EXCLUDED.is_active,
      auto_dispatch_enabled = EXCLUDED.auto_dispatch_enabled,
      updated_at = clock_timestamp();

  -- Registro en bitácora de auditoría sin exponer secretos
  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, target_type, target_id, details, created_at
  ) VALUES (
    v_tenant_id, v_user_id, 'IHCE_DOCTOR_CREDENTIALS_CONFIGURED', 'ihce_prestadores',
    p_doctor_id::text,
    jsonb_build_object(
      'reps_code', p_reps_code,
      'sede_code', p_sede_code,
      'servicio_code', coalesce(p_servicio_code, '334'),
      'ambiente', p_ambiente,
      'client_id', p_client_id,
      'doctor_id', p_doctor_id,
      'encrypted', true
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Credenciales del prestador guardadas y cifradas exitosamente.',
    'doctor_id', p_doctor_id,
    'reps_code', p_reps_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_doctor_ihce_credentials FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_doctor_ihce_credentials TO authenticated;

COMMIT;
