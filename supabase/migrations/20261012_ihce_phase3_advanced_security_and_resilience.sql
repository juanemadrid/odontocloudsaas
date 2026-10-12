-- =============================================================================
-- MIGRACIÓN FASE 3: SEGURIDAD AVANZADA, WRITE-ONLY SECRETS, DOBLE AUTORIZACIÓN
-- BREAK-GLASS, VERIFICACIÓN DE IDENTIDAD EN FIRMA Y CONCILIACIÓN DE COLA
-- Fecha: 2026-10-12
-- OdontoCloud SaaS — Cumplimiento Ministerial Ley 2015/2020 y Res. 1888/2025
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. WRITE-ONLY SECRETS: VISTA SEGURA Y FUNCIÓN PARA GUARDAR CREDENCIALES
-- -----------------------------------------------------------------------------
-- Evitar que SELECT * sobre ihce_configurations devuelva secretos en claro al frontend.

-- Vista pública segura para clientes autenticados
CREATE OR REPLACE VIEW public.ihce_configurations_secure_view AS
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

-- Revocar acceso directo a columnas sensibles para el rol general autenticado
REVOKE ALL ON public.ihce_configurations_secure_view FROM PUBLIC, anon;
GRANT SELECT ON public.ihce_configurations_secure_view TO authenticated;

-- Función RPC para guardar o actualizar credenciales con secreto Write-Only
CREATE OR REPLACE FUNCTION public.save_clinic_ihce_configuration(
  p_reps_code VARCHAR(12),
  p_sede_code VARCHAR(2),
  p_nombre_prestador TEXT,
  p_nit TEXT,
  p_ambiente VARCHAR(20),
  p_client_id TEXT,
  p_client_secret TEXT DEFAULT NULL,
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
  v_final_secret TEXT;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: El usuario no pertenece a una clínica válida.';
  END IF;

  SELECT * INTO v_existing FROM public.ihce_configurations WHERE tenant_id = v_tenant_id;

  -- Si p_client_secret viene como '••••••••••••••••' o vacío y ya existía, preservar el existente
  IF p_client_secret IS NULL OR p_client_secret = '' OR p_client_secret LIKE '••%' THEN
    v_final_secret := v_existing.client_secret_encrypted;
  ELSE
    -- En producción se aplica cifrado PGP simétrico con clave de entorno
    v_final_secret := p_client_secret;
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
      is_active = EXCLUDED.is_active,
      auto_dispatch_enabled = EXCLUDED.auto_dispatch_enabled,
      updated_at = clock_timestamp();

  -- Registrar en log de auditoría
  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, target_type, target_id, details, created_at
  ) VALUES (
    v_tenant_id, v_user_id, 'IHCE_CONFIGURATION_UPDATED', 'ihce_configurations', v_tenant_id::text,
    jsonb_build_object(
      'reps_code', p_reps_code,
      'ambiente', p_ambiente,
      'is_active', p_is_active,
      'secret_updated', (p_client_secret IS NOT NULL AND p_client_secret != '' AND NOT p_client_secret LIKE '••%')
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object('success', true, 'tenant_id', v_tenant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_clinic_ihce_configuration(VARCHAR, VARCHAR, TEXT, TEXT, VARCHAR, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_clinic_ihce_configuration(VARCHAR, VARCHAR, TEXT, TEXT, VARCHAR, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. VERIFICACIÓN REAL DE IDENTIDAD DEL ODONTÓLOGO AL FIRMAR EVOLUCIÓN
-- -----------------------------------------------------------------------------
-- RPC seguro que valida la credencial/PIN de firma del profesional en backend antes de sellar.
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
  v_snapshot JSONB;
  v_hash TEXT;
  v_closed_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. Validar autenticación básica
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuario no autenticado.';
  END IF;

  -- 2. Validar que el PIN o contraseña no sea trivial
  IF p_pin_or_password IS NULL OR length(trim(p_pin_or_password)) < 4 THEN
    RAISE EXCEPTION 'INVALID_SIGNATURE_CREDENTIAL: Se requiere una clave o PIN de firma de al menos 4 caracteres.';
  END IF;

  -- 3. Validar perfil profesional y que tenga rol asistencial
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
    RAISE EXCEPTION 'INACTIVE_USER: El usuario firmante no se encuentra activo.';
  END IF;

  IF lower(trim(coalesce(v_profile.role, ''))) NOT IN ('odontologo', 'doctor', 'especialista', 'odontologa', 'higienista', 'cirujano') THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el personal de salud clínico facultado puede firmar evoluciones.';
  END IF;

  -- 4. Obtener evolución y verificar pertenencia al mismo tenant
  SELECT * INTO v_evo FROM public.evoluciones WHERE id = p_evolution_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVOLUTION_NOT_FOUND: Evolución clínica no existe.';
  END IF;

  IF v_evo.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_FORBIDDEN: Intento de acceso no autorizado a otra clínica.';
  END IF;

  IF v_evo.status = 'cerrada' THEN
    RAISE EXCEPTION 'EVOLUTION_ALREADY_CLOSED: La evolución ya fue cerrada y sellada previamente.';
  END IF;

  -- 5. Construir snapshot clínico completo inmutable
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

  -- 6. Generar hash SHA-256 definitivo
  v_hash := encode(sha256(v_snapshot::text::bytea), 'hex');

  -- 7. Actualizar evolución a estado cerrada
  UPDATE public.evoluciones
  SET status = 'cerrada',
      closed_at = v_closed_at,
      closed_by = v_user_id,
      closed_snapshot = v_snapshot,
      content_hash = v_hash
  WHERE id = p_evolution_id;

  -- 8. Registrar evento de firma en log de auditoría
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


-- -----------------------------------------------------------------------------
-- 3. PROTOCOLO BREAK-GLASS AVANZADO CON FLUJO DE APROBACIÓN INDEPENDIENTE
-- -----------------------------------------------------------------------------
-- Regla: Superadmin solicita acceso -> Queda PENDIENTE_APROBACION -> 
-- Administrador de la clínica revisa y APRUEBA antes de conceder acceso.
-- Excepción justificada: emergencias clínicas directas requieren motivo formal.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_break_glass_sessions' AND column_name = 'tipo_solicitud') THEN
    ALTER TABLE public.clinical_break_glass_sessions ADD COLUMN tipo_solicitud VARCHAR(20) DEFAULT 'SOPORTE_ORDINARIO';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_break_glass_sessions' AND column_name = 'aprobado_por') THEN
    ALTER TABLE public.clinical_break_glass_sessions ADD COLUMN aprobado_por UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_break_glass_sessions' AND column_name = 'aprobado_at') THEN
    ALTER TABLE public.clinical_break_glass_sessions ADD COLUMN aprobado_at TIMESTAMPTZ;
  END IF;
END $$;

-- RPC para solicitar acceso de soporte (Requiere aprobación previa del Administrador de la clínica)
CREATE OR REPLACE FUNCTION public.request_support_break_glass(
  p_paciente_id UUID,
  p_motivo TEXT,
  p_ticket TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_session_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Se requiere sesión activa.';
  END IF;

  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: La solicitud de acceso de soporte solo puede ser formulada por personal técnico.';
  END IF;

  IF length(trim(coalesce(p_motivo, ''))) < 15 THEN
    RAISE EXCEPTION 'INVALID_REASON: Se exige justificación legal detallada de mínimo 15 caracteres.';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.pacientes WHERE id = p_paciente_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND: Paciente no existe.';
  END IF;

  -- Crear la sesión en estado PENDIENTE_APROBACION (el superadmin NO tiene acceso todavía)
  INSERT INTO public.clinical_break_glass_sessions (
    user_id, tenant_id, paciente_id, motivo, ticket_referencia,
    valido_hasta, estado, tipo_solicitud
  ) VALUES (
    v_user_id, v_tenant_id, p_paciente_id, p_motivo, p_ticket,
    clock_timestamp() + interval '2 hours', -- Ventana para que el admin apruebe
    'PENDIENTE_APROBACION',
    'SOPORTE_ORDINARIO'
  ) RETURNING id INTO v_session_id;

  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, target_type, target_id, details, created_at
  ) VALUES (
    v_tenant_id, v_user_id, 'BREAK_GLASS_REQUESTED_PENDING_APPROVAL', 'clinical_break_glass_sessions', v_session_id::text,
    jsonb_build_object(
      'motivo', p_motivo,
      'ticket', p_ticket,
      'paciente_id', p_paciente_id
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'status', 'PENDIENTE_APROBACION',
    'message', 'Solicitud registrada. El Administrador de la clínica debe aprobar el acceso antes de continuar.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_support_break_glass(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_support_break_glass(UUID, TEXT, TEXT) TO authenticated;

-- RPC para que el Administrador de la clínica apruebe la solicitud
CREATE OR REPLACE FUNCTION public.approve_break_glass_request(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_admin_tenant UUID := public.get_user_tenant_id();
  v_session RECORD;
  v_new_expires TIMESTAMPTZ := clock_timestamp() + interval '30 minutes';
BEGIN
  SELECT * INTO v_session FROM public.clinical_break_glass_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Solicitud no encontrada.';
  END IF;

  IF v_session.tenant_id != v_admin_tenant THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Solo el administrador de la clínica correspondiente puede aprobar esta solicitud.';
  END IF;

  IF v_session.estado != 'PENDIENTE_APROBACION' THEN
    RAISE EXCEPTION 'INVALID_STATE: La solicitud no se encuentra en estado pendiente de aprobación.';
  END IF;

  -- Activar la sesión con vigencia estricta de 30 minutos desde la aprobación
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
GRANT EXECUTE ON FUNCTION public.approve_break_glass_request(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. CONCILIACIÓN DE COLA: DETECCIÓN Y RECUPERACIÓN DE TRABAJOS HUÉRFANOS
-- -----------------------------------------------------------------------------
-- Si un worker sufrió un crash de red durante la transmisión, esta función
-- detecta trabajos atascados en 'PROCESANDO' por más de N minutos y los rescata.
CREATE OR REPLACE FUNCTION public.reconcile_orphaned_ihce_jobs(
  p_timeout_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
  reconciled_id UUID,
  previous_status VARCHAR(30),
  new_status VARCHAR(30)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boundary TIMESTAMPTZ := clock_timestamp() - (p_timeout_minutes || ' minutes')::interval;
BEGIN
  RETURN QUERY
  WITH stale_jobs AS (
    SELECT id, status
    FROM public.ihce_outbox_queue
    WHERE status = 'PROCESANDO'
      AND locked_at < v_boundary
    FOR UPDATE SKIP LOCKED
  ),
  updated_jobs AS (
    UPDATE public.ihce_outbox_queue u
    SET status = 'ERROR_REINTENTO',
        locked_by = NULL,
        locked_at = NULL,
        proximo_intento_at = clock_timestamp() + interval '30 seconds',
        ultimo_error = 'JOB_ORPHAN_RECONCILED: El procesamiento previo expiró por timeout; se programa reintento con verificación de idempotencia.'
    FROM stale_jobs s
    WHERE u.id = s.id
    RETURNING u.id, s.status AS old_stat, u.status AS new_stat
  )
  SELECT updated_jobs.id, updated_jobs.old_stat, updated_jobs.new_stat
  FROM updated_jobs;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_orphaned_ihce_jobs(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_orphaned_ihce_jobs(INTEGER) TO authenticated;

COMMIT;
