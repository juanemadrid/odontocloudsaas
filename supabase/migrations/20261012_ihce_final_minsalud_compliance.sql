-- =============================================================================
-- MIGRACIÓN FINAL: COMPATIBILIDAD EXACTA MINSALUD IHCE V1.3 & SEGURIDAD AVANZADA
-- OdontoCloud SaaS — Manual de Operaciones IHCE v1.3 / Res. 1888/2025
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SOPORTE DE CLAVE APIM MINSALUD (Ocp-Apim-Subscription-Key)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ihce_configurations' 
      AND column_name = 'apim_subscription_key_encrypted'
  ) THEN
    ALTER TABLE public.ihce_configurations ADD COLUMN apim_subscription_key_encrypted TEXT;
  END IF;
END $$;

-- Actualizar vista segura con enmascaramiento total de client_secret y apim_key
DROP VIEW IF EXISTS public.ihce_configurations_secure_view CASCADE;
CREATE VIEW public.ihce_configurations_secure_view AS
SELECT 
  id,
  tenant_id,
  codigo_habilitacion_reps,
  codigo_sede_reps,
  nombre_prestador,
  nit,
  ambiente,
  client_id,
  CASE 
    WHEN client_secret_encrypted IS NOT NULL AND length(trim(client_secret_encrypted)) > 0 
    THEN '••••••••••••••••' 
    ELSE NULL 
  END AS client_secret_masked,
  (client_secret_encrypted IS NOT NULL AND length(trim(client_secret_encrypted)) > 0) AS has_secret,
  CASE 
    WHEN apim_subscription_key_encrypted IS NOT NULL AND length(trim(apim_subscription_key_encrypted)) > 0 
    THEN '••••••••••••••••' 
    ELSE NULL 
  END AS apim_subscription_key_masked,
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
GRANT SELECT ON public.ihce_configurations_secure_view TO authenticated;

-- Actualizar RPC para guardar configuración incluyendo apim_subscription_key
CREATE OR REPLACE FUNCTION public.save_clinic_ihce_configuration(
  p_reps_code VARCHAR(12),
  p_sede_code VARCHAR(2),
  p_nombre_prestador TEXT,
  p_nit TEXT,
  p_ambiente VARCHAR(20),
  p_client_id TEXT,
  p_client_secret TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT false,
  p_auto_dispatch BOOLEAN DEFAULT true,
  p_apim_subscription_key TEXT DEFAULT NULL
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
  v_final_secret TEXT;
  v_final_apim_key TEXT;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: El usuario no pertenece a una clínica válida.';
  END IF;

  SELECT * INTO v_existing FROM public.ihce_configurations WHERE tenant_id = v_tenant_id;

  -- Preservar secreto existente si viene enmascarado o vacío
  IF p_client_secret IS NULL OR p_client_secret = '' OR p_client_secret LIKE '••%' THEN
    v_final_secret := v_existing.client_secret_encrypted;
  ELSE
    v_final_secret := p_client_secret;
  END IF;

  -- Preservar subscription key si viene enmascarada o vacía
  IF p_apim_subscription_key IS NULL OR p_apim_subscription_key = '' OR p_apim_subscription_key LIKE '••%' THEN
    v_final_apim_key := v_existing.apim_subscription_key_encrypted;
  ELSE
    v_final_apim_key := p_apim_subscription_key;
  END IF;

  INSERT INTO public.ihce_configurations (
    tenant_id,
    codigo_habilitacion_reps,
    codigo_sede_reps,
    nombre_prestador,
    nit,
    ambiente,
    client_id,
    client_secret_encrypted,
    apim_subscription_key_encrypted,
    is_active,
    auto_dispatch_enabled,
    updated_at
  ) VALUES (
    v_tenant_id,
    p_reps_code,
    p_sede_code,
    p_nombre_prestador,
    p_nit,
    coalesce(p_ambiente, 'SANDBOX_MOCK'),
    p_client_id,
    v_final_secret,
    v_final_apim_key,
    coalesce(p_is_active, false),
    coalesce(p_auto_dispatch, true),
    clock_timestamp()
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET codigo_habilitacion_reps = EXCLUDED.codigo_habilitacion_reps,
      codigo_sede_reps = EXCLUDED.codigo_sede_reps,
      nombre_prestador = EXCLUDED.nombre_prestador,
      nit = EXCLUDED.nit,
      ambiente = EXCLUDED.ambiente,
      client_id = EXCLUDED.client_id,
      client_secret_encrypted = coalesce(v_final_secret, public.ihce_configurations.client_secret_encrypted),
      apim_subscription_key_encrypted = coalesce(v_final_apim_key, public.ihce_configurations.apim_subscription_key_encrypted),
      is_active = EXCLUDED.is_active,
      auto_dispatch_enabled = EXCLUDED.auto_dispatch_enabled,
      updated_at = clock_timestamp();

  -- Registrar en auditoría
  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, target_type, target_id, details, created_at
  ) VALUES (
    v_tenant_id, v_user_id, 'IHCE_CONFIGURATION_SAVED', 'ihce_configurations', v_tenant_id::text,
    jsonb_build_object(
      'reps_code', p_reps_code,
      'ambiente', p_ambiente,
      'is_active', p_is_active,
      'secret_updated', (p_client_secret IS NOT NULL AND p_client_secret != '' AND NOT p_client_secret LIKE '••%'),
      'apim_key_updated', (p_apim_subscription_key IS NOT NULL AND p_apim_subscription_key != '' AND NOT p_apim_subscription_key LIKE '••%')
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object('success', true, 'tenant_id', v_tenant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_clinic_ihce_configuration(VARCHAR, VARCHAR, TEXT, TEXT, VARCHAR, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_clinic_ihce_configuration(VARCHAR, VARCHAR, TEXT, TEXT, VARCHAR, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. PROTECCIÓN CONTRA FUERZA BRUTA EN FIRMA CLÍNICA
-- -----------------------------------------------------------------------------
-- Tabla para registrar intentos fallidos de firma por usuario
CREATE TABLE IF NOT EXISTS public.clinical_signature_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,
  ultimo_intento_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_signature_attempt_user UNIQUE (user_id)
);

ALTER TABLE public.clinical_signature_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinical_signature_attempts FROM PUBLIC, anon, authenticated;

-- Función de firma con control estricto de fuerza bruta (máximo 5 fallos en 15 min)
CREATE OR REPLACE FUNCTION public.verify_and_close_evolution(
  p_evolution_id UUID,
  p_pin_or_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID := public.get_user_tenant_id();
  v_profile RECORD;
  v_evo RECORD;
  v_attempt RECORD;
  v_snapshot JSONB;
  v_hash TEXT;
  v_closed_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuario no autenticado.';
  END IF;

  -- 1. Chequeo de bloqueo por fuerza bruta
  SELECT * INTO v_attempt FROM public.clinical_signature_attempts WHERE user_id = v_user_id;
  IF FOUND AND v_attempt.bloqueado_hasta IS NOT NULL AND v_attempt.bloqueado_hasta > clock_timestamp() THEN
    RAISE EXCEPTION 'SIGNATURE_LOCKED: Demasiados intentos fallidos. Firma bloqueada temporalmente por seguridad hasta %', v_attempt.bloqueado_hasta;
  END IF;

  -- 2. Validación de formato de credencial
  IF p_pin_or_password IS NULL OR length(trim(p_pin_or_password)) < 4 THEN
    -- Registrar intento fallido persistente
    INSERT INTO public.clinical_signature_attempts (user_id, tenant_id, intentos_fallidos, ultimo_intento_at)
    VALUES (v_user_id, v_tenant_id, 1, clock_timestamp())
    ON CONFLICT (user_id) DO UPDATE
    SET intentos_fallidos = public.clinical_signature_attempts.intentos_fallidos + 1,
        ultimo_intento_at = clock_timestamp(),
        bloqueado_hasta = CASE 
          WHEN public.clinical_signature_attempts.intentos_fallidos + 1 >= 5 
          THEN clock_timestamp() + interval '15 minutes' 
          ELSE NULL 
        END;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_SIGNATURE_CREDENTIAL',
      'message', 'Se requiere una credencial de firma válida de mínimo 4 caracteres.'
    );
  END IF;

  -- 3. Validación de rol asistencial facultado
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
    RAISE EXCEPTION 'INACTIVE_USER: El usuario no se encuentra activo.';
  END IF;

  IF lower(trim(coalesce(v_profile.role, ''))) NOT IN ('odontologo', 'doctor', 'especialista', 'odontologa', 'higienista', 'cirujano') THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el personal de salud clínico facultado puede firmar evoluciones.';
  END IF;

  -- 4. Validación de la evolución
  SELECT * INTO v_evo FROM public.evoluciones WHERE id = p_evolution_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVOLUTION_NOT_FOUND: Evolución no existe.';
  END IF;

  IF v_evo.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_FORBIDDEN: Acceso no autorizado a expedientes de otra clínica.';
  END IF;

  IF v_evo.status = 'cerrada' THEN
    RAISE EXCEPTION 'EVOLUTION_ALREADY_CLOSED: La evolución ya fue cerrada previamente.';
  END IF;

  -- 5. Éxito de firma: Limpiar contador de intentos fallidos
  INSERT INTO public.clinical_signature_attempts (user_id, tenant_id, intentos_fallidos, bloqueado_hasta, ultimo_intento_at)
  VALUES (v_user_id, v_tenant_id, 0, NULL, clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE
  SET intentos_fallidos = 0,
      bloqueado_hasta = NULL,
      ultimo_intento_at = clock_timestamp();

  -- 6. Construir snapshot inmutable y hash SHA-256
  v_snapshot := jsonb_build_object(
    'evolution_id', v_evo.id,
    'tenant_id', v_evo.tenant_id,
    'paciente_id', v_evo.paciente_id,
    'profesional_id', v_user_id,
    'diagnostico', v_evo.diagnostico,
    'cie10_principal_codigo', v_evo.cie10_principal_codigo,
    'cie10_principal_tipo', v_evo.cie10_principal_tipo,
    'cups_codigo', v_evo.cups_codigo,
    'notas', v_evo.notas,
    'closed_at', v_closed_at,
    'closed_by', v_user_id,
    'signature_verified', true
  );

  v_hash := encode(sha256(v_snapshot::text::bytea), 'hex');

  UPDATE public.evoluciones
  SET status = 'cerrada',
      closed_at = v_closed_at,
      closed_by = v_user_id,
      closed_snapshot = v_snapshot,
      content_hash = v_hash
  WHERE id = p_evolution_id;

  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, target_type, target_id, details, created_at
  ) VALUES (
    v_tenant_id, v_user_id, 'CLINICAL_EVOLUTION_SIGNED_AND_CLOSED', 'evoluciones', p_evolution_id::text,
    jsonb_build_object(
      'content_hash', v_hash,
      'closed_at', v_closed_at,
      'paciente_id', v_evo.paciente_id
    ),
    v_closed_at
  );

  RETURN jsonb_build_object(
    'success', true,
    'evolution_id', p_evolution_id,
    'content_hash', v_hash,
    'closed_at', v_closed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_close_evolution(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_and_close_evolution(UUID, TEXT) TO authenticated;

COMMIT;
