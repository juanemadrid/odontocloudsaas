-- =============================================================================
-- MIGRACIÓN DE SECURIZACIÓN INTEGRAL Y CIERRE DE VULNERABILIDADES IHCE
-- OdontoCloud SaaS — Corrección Definitiva de Seguridad y Cumplimiento MinSalud
-- Archivo: supabase/migrations/20261012_ihce_security_hardening_and_compliance_fix.sql
-- =============================================================================

BEGIN;

-- 1. EXTENSIÓN CRIPTOGRÁFICA
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. FUNCIÓN DE OBTENCIÓN DE CLAVE MAESTRA INTERNA (SIN VALORES POR DEFECTO CONOCIDOS)
CREATE OR REPLACE FUNCTION public.get_ihce_internal_master_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_custom_key TEXT;
BEGIN
  v_custom_key := nullif(current_setting('app.settings.ihce_master_key', true), '');
  IF v_custom_key IS NOT NULL AND length(v_custom_key) >= 16 THEN
    RETURN v_custom_key;
  END IF;

  -- REGLA DE SEGURIDAD CRÍTICA: Prohibido hardcodear claves predeterminadas
  RAISE EXCEPTION 'IHCE_VAULT_ERROR: Clave maestra de cifrado no configurada en app.settings.ihce_master_key o longitud menor a 16 caracteres. Se prohíbe cualquier valor predeterminado.';
END;
$$;

REVOKE ALL ON FUNCTION public.get_ihce_internal_master_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ihce_internal_master_key() TO service_role;

-- 3. VERIFICACIÓN DE ROL ADMINISTRADOR DE CLÍNICA (EXCLUYE SUPERADMIN TÉCNICO)
CREATE OR REPLACE FUNCTION public.is_clinic_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id()
      AND lower(trim(coalesce(p.role, ''))) IN ('admin', 'administrador', 'propietario')
      AND p.activo IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_clinic_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clinic_admin() TO authenticated, service_role;

-- 4. CIFRADO AUTENTICADO REAL EN REPOSO PARA SECRETOS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ihce_configurations' 
      AND column_name = 'client_secret_ciphertext'
  ) THEN
    ALTER TABLE public.ihce_configurations ADD COLUMN client_secret_ciphertext BYTEA;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ihce_configurations' 
      AND column_name = 'apim_subscription_key_ciphertext'
  ) THEN
    ALTER TABLE public.ihce_configurations ADD COLUMN apim_subscription_key_ciphertext BYTEA;
  END IF;
END $$;

-- 5. BLOQUEO TOTAL DE ACCESO DIRECTO A LA TABLA BASE DE CONFIGURACIONES
REVOKE ALL ON public.ihce_configurations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ihce_configurations TO service_role;

-- 6. RPC DE GUARDADO DE CONFIGURACIÓN CON CONTROL ADMINISTRATIVO Y CIFRADO REAL
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
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID := public.get_user_tenant_id();
  v_master_key TEXT;
  v_existing RECORD;
  v_secret_cipher BYTEA;
  v_apim_cipher BYTEA;
BEGIN
  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuario no autenticado en una clínica válida.';
  END IF;

  -- CONTROL DE ACCESO ESTRICTO: Solo el administrador local de la clínica puede guardar credenciales
  IF NOT public.is_clinic_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: Solo el administrador de la clínica titular está autorizado para configurar credenciales de interoperabilidad.';
  END IF;

  v_master_key := public.get_ihce_internal_master_key();

  SELECT * INTO v_existing FROM public.ihce_configurations WHERE tenant_id = v_tenant_id;

  -- 1. Procesar client_secret con AES-256
  IF p_client_secret IS NOT NULL AND p_client_secret != '' AND NOT p_client_secret LIKE '••%' THEN
    v_secret_cipher := pgp_sym_encrypt(
      p_client_secret, 
      v_master_key, 
      'compress-algo=1, cipher-algo=aes256'
    );
  ELSE
    v_secret_cipher := v_existing.client_secret_ciphertext;
  END IF;

  -- 2. Procesar apim_subscription_key con AES-256
  IF p_apim_subscription_key IS NOT NULL AND p_apim_subscription_key != '' AND NOT p_apim_subscription_key LIKE '••%' THEN
    v_apim_cipher := pgp_sym_encrypt(
      p_apim_subscription_key, 
      v_master_key, 
      'compress-algo=1, cipher-algo=aes256'
    );
  ELSE
    v_apim_cipher := v_existing.apim_subscription_key_ciphertext;
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
    client_secret_ciphertext,
    apim_subscription_key_ciphertext,
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
    NULL,
    NULL,
    v_secret_cipher,
    v_apim_cipher,
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
      client_secret_encrypted = NULL,
      apim_subscription_key_encrypted = NULL,
      client_secret_ciphertext = coalesce(v_secret_cipher, public.ihce_configurations.client_secret_ciphertext),
      apim_subscription_key_ciphertext = coalesce(v_apim_cipher, public.ihce_configurations.apim_subscription_key_ciphertext),
      is_active = EXCLUDED.is_active,
      auto_dispatch_enabled = EXCLUDED.auto_dispatch_enabled,
      updated_at = clock_timestamp();

  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, target_type, target_id, details, created_at
  ) VALUES (
    v_tenant_id, v_user_id, 'IHCE_CONFIGURATION_ENCRYPTED_SAVED', 'ihce_configurations', v_tenant_id::text,
    jsonb_build_object(
      'reps_code', p_reps_code,
      'ambiente', p_ambiente,
      'is_active', p_is_active,
      'secret_encrypted', (v_secret_cipher IS NOT NULL),
      'apim_key_encrypted', (v_apim_cipher IS NOT NULL)
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object('success', true, 'tenant_id', v_tenant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_clinic_ihce_configuration(VARCHAR, VARCHAR, TEXT, TEXT, VARCHAR, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_clinic_ihce_configuration(VARCHAR, VARCHAR, TEXT, TEXT, VARCHAR, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;

-- 7. VISTA SEGURA: NUNCA EXPONE SECRETOS, SOLO METADATOS Y MÁSCARAS
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
    WHEN client_secret_ciphertext IS NOT NULL 
    THEN '••••••••••••••••' 
    ELSE NULL 
  END AS client_secret_masked,
  (client_secret_ciphertext IS NOT NULL) AS has_secret,
  CASE 
    WHEN apim_subscription_key_ciphertext IS NOT NULL 
    THEN '••••••••••••••••' 
    ELSE NULL 
  END AS apim_subscription_key_masked,
  (apim_subscription_key_ciphertext IS NOT NULL) AS has_apim_key,
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
FROM public.ihce_configurations
WHERE tenant_id = public.get_user_tenant_id();

REVOKE ALL ON public.ihce_configurations_secure_view FROM PUBLIC, anon;
GRANT SELECT ON public.ihce_configurations_secure_view TO authenticated, service_role;

-- 8. RPC EXCLUSIVO DE BACKEND/SERVICE_ROLE PARA DESCIFRAR CREDENCIALES
CREATE OR REPLACE FUNCTION public.get_clinic_ihce_decrypted_credentials(p_tenant_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  reps_code VARCHAR(12),
  sede_code VARCHAR(2),
  client_id TEXT,
  client_secret TEXT,
  apim_subscription_key TEXT,
  ambiente VARCHAR(20),
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_master_key TEXT;
  v_conf RECORD;
  v_decrypted_secret TEXT := NULL;
  v_decrypted_apim TEXT := NULL;
BEGIN
  v_master_key := public.get_ihce_internal_master_key();

  SELECT * INTO v_conf FROM public.ihce_configurations WHERE public.ihce_configurations.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_conf.client_secret_ciphertext IS NOT NULL THEN
    BEGIN
      v_decrypted_secret := pgp_sym_decrypt(v_conf.client_secret_ciphertext, v_master_key);
    EXCEPTION WHEN OTHERS THEN
      v_decrypted_secret := NULL;
    END;
  END IF;

  IF v_conf.apim_subscription_key_ciphertext IS NOT NULL THEN
    BEGIN
      v_decrypted_apim := pgp_sym_decrypt(v_conf.apim_subscription_key_ciphertext, v_master_key);
    EXCEPTION WHEN OTHERS THEN
      v_decrypted_apim := NULL;
    END;
  END IF;

  RETURN QUERY SELECT 
    v_conf.tenant_id,
    v_conf.codigo_habilitacion_reps,
    v_conf.codigo_sede_reps,
    v_conf.client_id,
    v_decrypted_secret,
    v_decrypted_apim,
    v_conf.ambiente,
    v_conf.is_active;
END;
$$;

REVOKE ALL ON FUNCTION public.get_clinic_ihce_decrypted_credentials(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_ihce_decrypted_credentials(UUID) TO service_role;

-- 9. VERIFICACIÓN REAL DE IDENTIDAD Y FIRMA CLÍNICA (BCRYPT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'signature_pin_hash'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN signature_pin_hash TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_clinical_signature_pin(p_new_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesión requerida.';
  END IF;

  IF p_new_pin IS NULL OR length(trim(p_new_pin)) < 4 THEN
    RAISE EXCEPTION 'INVALID_PIN: El PIN de firma debe contener al menos 4 caracteres.';
  END IF;

  UPDATE public.profiles
  SET signature_pin_hash = crypt(p_new_pin, gen_salt('bf', 10))
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'PIN de firma clínica configurado exitosamente.');
END;
$$;

REVOKE ALL ON FUNCTION public.set_clinical_signature_pin(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_clinical_signature_pin(TEXT) TO authenticated, service_role;

-- Función de verificación real con verificación de profesional titular y protección de concurrencia
CREATE OR REPLACE FUNCTION public.verify_and_close_evolution(
  p_evolution_id UUID,
  p_pin_or_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
  v_valid_credential BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuario no autenticado.';
  END IF;

  -- 1. Chequeo de bloqueo temporal por fuerza bruta
  SELECT * INTO v_attempt FROM public.clinical_signature_attempts WHERE user_id = v_user_id;
  IF FOUND AND v_attempt.bloqueado_hasta IS NOT NULL AND v_attempt.bloqueado_hasta > clock_timestamp() THEN
    RAISE EXCEPTION 'SIGNATURE_LOCKED: Demasiados intentos fallidos. Firma bloqueada temporalmente por seguridad hasta %', v_attempt.bloqueado_hasta;
  END IF;

  -- 2. Validación de rol asistencial facultado
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
    RAISE EXCEPTION 'INACTIVE_USER: El usuario no se encuentra activo.';
  END IF;

  IF lower(trim(coalesce(v_profile.role, ''))) NOT IN ('odontologo', 'doctor', 'especialista', 'odontologa', 'higienista', 'cirujano') THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el personal de salud clínico facultado puede firmar evoluciones.';
  END IF;

  -- 3. VERIFICACIÓN REAL DE IDENTIDAD DEL FIRMANTE CON BCRYPT
  IF v_profile.signature_pin_hash IS NULL OR length(v_profile.signature_pin_hash) = 0 THEN
    RAISE EXCEPTION 'SIGNATURE_PIN_NOT_CONFIGURED: El profesional no ha configurado su PIN de firma digital.';
  END IF;

  IF p_pin_or_password IS NOT NULL AND length(trim(p_pin_or_password)) >= 4 THEN
    v_valid_credential := (v_profile.signature_pin_hash = crypt(p_pin_or_password, v_profile.signature_pin_hash));
  END IF;

  IF NOT v_valid_credential THEN
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
      'message', 'Credencial o PIN de firma incorrecto. La identidad del firmante no pudo ser comprobada.'
    );
  END IF;

  -- 4. Validación de la evolución CON BLOQUEO CONCURRENTE FOR UPDATE
  SELECT * INTO v_evo FROM public.evoluciones WHERE id = p_evolution_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVOLUTION_NOT_FOUND: Evolución no existe.';
  END IF;

  IF v_evo.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_FORBIDDEN: Acceso no autorizado a expedientes de otra clínica.';
  END IF;

  -- VERIFICACIÓN ESTRICTA: Solo el profesional titular asignado puede firmar la atención
  IF v_evo.profesional_id IS NOT NULL AND v_evo.profesional_id != v_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PRACTITIONER: Solo el profesional clínico titular asignado a la evolución está autorizado para firmarla.';
  END IF;

  IF v_evo.status = 'cerrada' THEN
    RAISE EXCEPTION 'EVOLUTION_ALREADY_CLOSED: La evolución ya fue cerrada previamente.';
  END IF;

  -- 5. Limpiar contador de intentos fallidos
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
GRANT EXECUTE ON FUNCTION public.verify_and_close_evolution(UUID, TEXT) TO authenticated, service_role;

-- 10. ELIMINACIÓN DEFINITIVA DE LA FUNCIÓN HEREDADA DE BREAK-GLASS SIN APROBACIÓN
DROP FUNCTION IF EXISTS public.request_break_glass_access(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.request_break_glass_access(UUID, TEXT) CASCADE;

-- 11. ENDURECIMIENTO DE APROBACIÓN BREAK-GLASS: EXCLUSIÓN DE SUPERADMIN Y AUTOAPROBACIÓN
CREATE OR REPLACE FUNCTION public.approve_break_glass_request(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_admin_tenant UUID := public.get_user_tenant_id();
  v_session RECORD;
  v_new_expires TIMESTAMPTZ := clock_timestamp() + interval '30 minutes';
BEGIN
  IF v_admin_id IS NULL OR v_admin_tenant IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sesión requerida.';
  END IF;

  -- Solo el administrador o propietario local de la clínica puede aprobar (Superadmin excluido)
  IF NOT public.is_clinic_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: Solo un administrador o propietario de la clínica titular puede aprobar solicitudes Break-Glass. El superadmin técnico de plataforma no está facultado.';
  END IF;

  SELECT * INTO v_session FROM public.clinical_break_glass_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Solicitud no encontrada.';
  END IF;

  IF v_session.tenant_id != v_admin_tenant THEN
    RAISE EXCEPTION 'UNAUTHORIZED: La solicitud pertenece a otra clínica.';
  END IF;

  -- PROHIBICIÓN TOTAL DE AUTOAPROBACIÓN
  IF v_session.user_id = v_admin_id THEN
    RAISE EXCEPTION 'SELF_APPROVAL_FORBIDDEN: El usuario solicitante no puede autoaprobar su propio acceso.';
  END IF;

  IF v_session.estado != 'PENDIENTE_APROBACION' THEN
    RAISE EXCEPTION 'INVALID_STATE: La solicitud no se encuentra en estado pendiente de aprobación.';
  END IF;

  UPDATE public.clinical_break_glass_sessions
  SET estado = 'ACTIVA',
      aprobado_por = v_admin_id,
      aprobado_at = clock_timestamp(),
      valido_hasta = v_new_expires
  WHERE id = p_session_id;

  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, target_type, target_id, details, created_at
  ) VALUES (
    v_session.tenant_id, v_admin_id, 'BREAK_GLASS_REQUEST_APPROVED', 'clinical_break_glass_sessions', p_session_id::text,
    jsonb_build_object(
      'aprobado_por', v_admin_id,
      'usuario_beneficiario', v_session.user_id,
      'valido_hasta', v_new_expires
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'status', 'ACTIVA',
    'valido_hasta', v_new_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_break_glass_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_break_glass_request(UUID) TO authenticated, service_role;

-- 12. ACTUALIZACIÓN DE COLUMNA STATUS Y CONSTRAINT CHECK EN COLA OUTBOX
ALTER TABLE public.ihce_outbox_queue ALTER COLUMN status TYPE VARCHAR(50);
ALTER TABLE public.ihce_outbox_queue DROP CONSTRAINT IF EXISTS chk_ihce_queue_status;
ALTER TABLE public.ihce_outbox_queue ADD CONSTRAINT chk_ihce_queue_status CHECK (
  status IN ('PENDIENTE', 'EN_PROCESO', 'PROCESANDO', 'ACEPTADO', 'RECHAZADO', 'ERROR_REINTENTO', 'ERROR_DEFINITIVO', 'PENDIENTE_CONCILIACION', 'BLOQUEADO_SALVAGUARDA')
);

-- 13. RESTRICCIÓN DE PRIVILEGIOS DE FUNCIONES DEL WORKER (SOLO SERVICE_ROLE)
-- Eliminar explícitamente cualquier versión anterior para evitar conflictos de tipo de retorno
DROP FUNCTION IF EXISTS public.claim_ihce_outbox_batch(INTEGER, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.claim_ihce_outbox_batch(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.claim_ihce_outbox_batch() CASCADE;

CREATE OR REPLACE FUNCTION public.claim_ihce_outbox_batch(
  p_batch_size INTEGER DEFAULT 10,
  p_worker_id TEXT DEFAULT 'worker-1',
  p_lock_timeout_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  queue_id UUID,
  tenant_id UUID,
  evolution_id UUID,
  paciente_id UUID,
  idempotency_key TEXT,
  snapshot_hash TEXT,
  intentos INTEGER,
  max_intentos INTEGER,
  status VARCHAR(30)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_stale_lock_boundary TIMESTAMPTZ := v_now - (p_lock_timeout_seconds || ' seconds')::interval;
BEGIN
  RETURN QUERY
  WITH available_jobs AS (
    SELECT q.id
    FROM public.ihce_outbox_queue q
    WHERE (
      (q.status IN ('PENDIENTE', 'ERROR_REINTENTO') AND q.proximo_intento_at <= v_now AND (q.locked_at IS NULL OR q.locked_at < v_stale_lock_boundary))
    )
    ORDER BY q.proximo_intento_at ASC, q.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed_jobs AS (
    UPDATE public.ihce_outbox_queue u
    SET locked_by = p_worker_id,
        locked_at = v_now,
        status = 'PROCESANDO'
    FROM available_jobs a
    WHERE u.id = a.id
    RETURNING u.id, u.tenant_id, u.evolution_id, u.paciente_id, u.idempotency_key, u.bundle_hash, u.intentos, u.max_intentos, u.status
  )
  SELECT c.id, c.tenant_id, c.evolution_id, c.paciente_id, c.idempotency_key::text, c.bundle_hash::text, c.intentos, c.max_intentos, c.status
  FROM claimed_jobs c;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ihce_outbox_batch(INTEGER, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ihce_outbox_batch(INTEGER, TEXT, INTEGER) TO service_role;

-- Eliminar explícitamente todas las sobrecargas de update_ihce_outbox_result
DROP FUNCTION IF EXISTS public.update_ihce_outbox_result(UUID, VARCHAR, INTEGER, TEXT, TEXT, JSONB, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_ihce_outbox_result(UUID, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.update_ihce_outbox_result(UUID, VARCHAR) CASCADE;

CREATE OR REPLACE FUNCTION public.update_ihce_outbox_result(
  p_queue_id UUID,
  p_status VARCHAR(30),
  p_http_status INTEGER DEFAULT NULL,
  p_radicado TEXT DEFAULT NULL,
  p_response_fhir_id TEXT DEFAULT NULL,
  p_detalle_respuesta JSONB DEFAULT NULL,
  p_proximo_intento_segundos INTEGER DEFAULT 60,
  p_error_mensaje TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_queue RECORD;
  v_new_intentos INTEGER;
  v_next_retry TIMESTAMPTZ := NULL;
  v_final_status VARCHAR(30) := p_status;
BEGIN
  SELECT * INTO v_queue FROM public.ihce_outbox_queue WHERE id = p_queue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_ITEM_NOT_FOUND: Registro de cola no existe.';
  END IF;

  v_new_intentos := v_queue.intentos + 1;

  IF p_status = 'ERROR_REINTENTO' THEN
    IF v_new_intentos >= v_queue.max_intentos THEN
      v_final_status := 'ERROR_DEFINITIVO';
      v_next_retry := NULL;
    ELSE
      v_next_retry := v_now + (coalesce(p_proximo_intento_segundos, 60) || ' seconds')::interval;
    END IF;
  END IF;

  UPDATE public.ihce_outbox_queue
  SET status = v_final_status,
      intentos = v_new_intentos,
      ultimo_http_status = p_http_status,
      radicado_oficial = coalesce(p_radicado, radicado_oficial),
      response_fhir_id = coalesce(p_response_fhir_id, response_fhir_id),
      detalle_respuesta = coalesce(p_detalle_respuesta, detalle_respuesta),
      ultimo_error = coalesce(p_error_mensaje, ultimo_error),
      proximo_intento_at = coalesce(v_next_retry, proximo_intento_at),
      locked_by = NULL,
      locked_at = NULL,
      updated_at = v_now
  WHERE id = p_queue_id;

  UPDATE public.ihce_configurations
  SET ultimo_envio_at = v_now,
      ultimo_error_at = CASE WHEN v_final_status IN ('ERROR_REINTENTO', 'ERROR_DEFINITIVO', 'RECHAZADO') THEN v_now ELSE ultimo_error_at END,
      ultimo_error_detalle = CASE WHEN v_final_status IN ('ERROR_REINTENTO', 'ERROR_DEFINITIVO', 'RECHAZADO') THEN to_jsonb(coalesce(p_error_mensaje, '')) ELSE ultimo_error_detalle END
  WHERE tenant_id = v_queue.tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'queue_id', p_queue_id,
    'status', v_final_status,
    'intentos', v_new_intentos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_ihce_outbox_result(UUID, VARCHAR, INTEGER, TEXT, TEXT, JSONB, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_ihce_outbox_result(UUID, VARCHAR, INTEGER, TEXT, TEXT, JSONB, INTEGER, TEXT) TO service_role;

-- Wrapper de 7 argumentos para compatibilidad, revocado de authenticated y otorgado solo a service_role
CREATE OR REPLACE FUNCTION public.update_ihce_outbox_result(
  p_item_id UUID,
  p_status VARCHAR(30),
  p_radicado VARCHAR(100),
  p_response_fhir_id VARCHAR(100),
  p_http_status INTEGER,
  p_error TEXT,
  p_detalle JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.update_ihce_outbox_result(p_item_id, p_status, p_http_status, p_radicado::text, p_response_fhir_id::text, p_detalle, 60, p_error);
$$;

REVOKE ALL ON FUNCTION public.update_ihce_outbox_result(UUID, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_ihce_outbox_result(UUID, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, JSONB) TO service_role;

-- 14. POLÍTICAS DE ACCESO EXCLUSIVO SERVICE_ROLE PARA TODAS LAS TABLAS DEL ESQUEMA
DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY['pacientes', 'evoluciones', 'odontogramas', 'documentos_clinicos', 'ihce_outbox_queue', 'ihce_configurations', 'clinical_break_glass_sessions'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_role_all_%I ON public.%I;', v_table, v_table);
    EXECUTE format('CREATE POLICY service_role_all_%I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', v_table, v_table);
  END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
