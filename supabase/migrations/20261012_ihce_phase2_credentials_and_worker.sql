-- =============================================================================
-- MIGRACIÓN: FASE 2 INTEROPERABILIDAD IHCE — CONFIGURACIONES, CREDENCIALES,
-- CONCURRENCIA DEL WORKER Y CONTROL AVANZADO DE BREAK-GLASS
-- Fecha: 2026-10-12
-- OdontoCloud SaaS — Cumplimiento Ley 2015/2020 y Resoluciones MinSalud
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TABLA DE CONFIGURACIÓN Y CREDENCIALES POR PRESTADOR (ISOLATED TENANT)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ihce_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  codigo_habilitacion_reps VARCHAR(12),
  codigo_sede_reps VARCHAR(2),
  nombre_prestador TEXT,
  nit TEXT,
  ambiente VARCHAR(20) NOT NULL DEFAULT 'SANDBOX_MOCK', -- 'SANDBOX_MOCK', 'PRUEBAS_MINSALUD', 'PRODUCCION'
  client_id TEXT,
  client_secret_encrypted TEXT, -- Secret cifrado o token de acceso protegido
  token_endpoint TEXT DEFAULT 'https://hercules.sispro.gov.co/auth/realms/minsalud/protocol/openid-connect/token',
  api_fhir_endpoint TEXT DEFAULT 'https://ihce.sispro.gov.co/fhir/r4',
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
  CONSTRAINT chk_reps_length CHECK (codigo_habilitacion_reps IS NULL OR codigo_habilitacion_reps ~ '^[0-9]{12}$'),
  CONSTRAINT chk_sede_length CHECK (codigo_sede_reps IS NULL OR codigo_sede_reps ~ '^[0-9]{2}$')
);

-- Habilitar RLS en configuraciones
ALTER TABLE public.ihce_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ihce_configurations FORCE ROW LEVEL SECURITY;

-- Solo los administradores de la respectiva clínica pueden ver o editar su configuración
DROP POLICY IF EXISTS ihce_config_tenant_select ON public.ihce_configurations;
CREATE POLICY ihce_config_tenant_select ON public.ihce_configurations
FOR SELECT TO authenticated
USING (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS ihce_config_tenant_insert ON public.ihce_configurations;
CREATE POLICY ihce_config_tenant_insert ON public.ihce_configurations
FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS ihce_config_tenant_update ON public.ihce_configurations;
CREATE POLICY ihce_config_tenant_update ON public.ihce_configurations
FOR UPDATE TO authenticated
USING (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
);

-- Eliminación restringida
DROP POLICY IF EXISTS ihce_config_tenant_delete ON public.ihce_configurations;


-- -----------------------------------------------------------------------------
-- 2. AMPLIACIÓN DE COLA ihce_outbox_queue PARA CONTROL DE CONCURRENCIA
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Columna para control de bloqueo transaccional por workers concurrentes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ihce_outbox_queue' AND column_name = 'locked_by') THEN
    ALTER TABLE public.ihce_outbox_queue ADD COLUMN locked_by TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ihce_outbox_queue' AND column_name = 'locked_at') THEN
    ALTER TABLE public.ihce_outbox_queue ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ihce_outbox_queue' AND column_name = 'radicado_oficial') THEN
    ALTER TABLE public.ihce_outbox_queue ADD COLUMN radicado_oficial TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ihce_outbox_queue' AND column_name = 'response_fhir_id') THEN
    ALTER TABLE public.ihce_outbox_queue ADD COLUMN response_fhir_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ihce_outbox_queue' AND column_name = 'ultimo_http_status') THEN
    ALTER TABLE public.ihce_outbox_queue ADD COLUMN ultimo_http_status INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ihce_outbox_queue' AND column_name = 'detalle_respuesta') THEN
    ALTER TABLE public.ihce_outbox_queue ADD COLUMN detalle_respuesta JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ihce_outbox_queue' AND column_name = 'bundle_hash') THEN
    ALTER TABLE public.ihce_outbox_queue ADD COLUMN bundle_hash TEXT;
  END IF;

  -- Actualizar el tipo de columna y check constraint para admitir los estados del worker y conciliación
  ALTER TABLE public.ihce_outbox_queue ALTER COLUMN status TYPE VARCHAR(50);
  ALTER TABLE public.ihce_outbox_queue DROP CONSTRAINT IF EXISTS chk_ihce_queue_status;
  ALTER TABLE public.ihce_outbox_queue ADD CONSTRAINT chk_ihce_queue_status CHECK (
    status IN ('PENDIENTE', 'EN_PROCESO', 'PROCESANDO', 'ACEPTADO', 'RECHAZADO', 'ERROR_REINTENTO', 'ERROR_DEFINITIVO', 'PENDIENTE_CONCILIACION', 'BLOQUEADO_SALVAGUARDA')
  );
END $$;

-- Índice para optimizar reserva concurrente
CREATE INDEX IF NOT EXISTS idx_ihce_queue_claim 
  ON public.ihce_outbox_queue (status, proximo_intento_at, locked_at)
  WHERE status IN ('PENDIENTE', 'ERROR_REINTENTO');


-- -----------------------------------------------------------------------------
-- 3. FUNCIÓN DE RESERVA SEGURA DE BATCH CONCURRENTE (FOR UPDATE SKIP LOCKED)
-- -----------------------------------------------------------------------------
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
SET search_path = public
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
      -- Tareas listas para procesar
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
    RETURNING u.id, u.tenant_id, u.evolution_id, u.paciente_id, u.idempotency_key, u.snapshot_hash, u.intentos, u.max_intentos, u.status
  )
  SELECT c.id, c.tenant_id, c.evolution_id, c.paciente_id, c.idempotency_key, c.snapshot_hash, c.intentos, c.max_intentos, c.status
  FROM claimed_jobs c;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ihce_outbox_batch(INTEGER, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ihce_outbox_batch(INTEGER, TEXT, INTEGER) TO service_role;


-- -----------------------------------------------------------------------------
-- 4. FUNCIÓN PARA ACTUALIZACIÓN ATÓMICA DEL RESULTADO DE TRANSMISIÓN
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_ihce_outbox_result(
  p_queue_id UUID,
  p_status VARCHAR(30),
  p_http_status INTEGER,
  p_radicado TEXT DEFAULT NULL,
  p_response_fhir_id TEXT DEFAULT NULL,
  p_detalle_respuesta JSONB DEFAULT NULL,
  p_proximo_intento_segundos INTEGER DEFAULT NULL,
  p_error_mensaje TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      detalle_respuesta = p_detalle_respuesta,
      ultimo_error = p_error_mensaje,
      proximo_intento_at = coalesce(v_next_retry, proximo_intento_at),
      locked_by = NULL,
      locked_at = NULL,
      updated_at = v_now
  WHERE id = p_queue_id;

  -- Actualizar timestamp en la configuración del prestador
  UPDATE public.ihce_configurations
  SET ultimo_envio_at = v_now,
      ultimo_error_at = CASE WHEN v_final_status IN ('ERROR_REINTENTO', 'ERROR_DEFINITIVO', 'RECHAZADO') THEN v_now ELSE ultimo_error_at END,
      ultimo_error_detalle = CASE WHEN v_final_status IN ('ERROR_REINTENTO', 'ERROR_DEFINITIVO', 'RECHAZADO') THEN p_error_mensaje ELSE ultimo_error_detalle END
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


-- -----------------------------------------------------------------------------
-- 5. MEJORAS DE CONTROL Y REVOCACIÓN EN PROTOCOLO BREAK-GLASS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_break_glass_sessions' AND column_name = 'estado') THEN
    ALTER TABLE public.clinical_break_glass_sessions ADD COLUMN estado VARCHAR(20) DEFAULT 'ACTIVA';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_break_glass_sessions' AND column_name = 'revocado_por') THEN
    ALTER TABLE public.clinical_break_glass_sessions ADD COLUMN revocado_por UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_break_glass_sessions' AND column_name = 'revocado_at') THEN
    ALTER TABLE public.clinical_break_glass_sessions ADD COLUMN revocado_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_break_glass_sessions' AND column_name = 'motivo_revocacion') THEN
    ALTER TABLE public.clinical_break_glass_sessions ADD COLUMN motivo_revocacion TEXT;
  END IF;
END $$;

-- Permitir a usuarios activos del tenant consultar las sesiones de su clínica para auditoría
DROP POLICY IF EXISTS clinical_break_glass_sessions_tenant_select ON public.clinical_break_glass_sessions;
CREATE POLICY clinical_break_glass_sessions_tenant_select ON public.clinical_break_glass_sessions
FOR SELECT TO authenticated
USING (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
);
GRANT SELECT ON public.clinical_break_glass_sessions TO authenticated;

-- Función de verificación de sesión break-glass activa (actualizada con chequeo de revocación)
CREATE OR REPLACE FUNCTION public.is_active_break_glass_user(p_paciente_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinical_break_glass_sessions s
    WHERE s.user_id = auth.uid()
      AND s.paciente_id = p_paciente_id
      AND coalesce(s.estado, 'ACTIVA') = 'ACTIVA'
      AND s.valido_hasta > clock_timestamp()
      AND s.revocado_at IS NULL
  );
$$;

-- Función para que un administrador de la clínica pueda revocar inmediatamente una sesión break-glass
CREATE OR REPLACE FUNCTION public.revoke_break_glass_session(
  p_session_id UUID,
  p_motivo_revocacion TEXT DEFAULT 'Revocación por el Administrador de la Clínica'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_session RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  SELECT * INTO v_session FROM public.clinical_break_glass_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Sesión de acceso excepcional no existe.';
  END IF;

  -- Comprobar que el usuario que revoca pertenece a la misma clínica
  IF v_session.tenant_id != public.get_user_tenant_id() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Solo el administrador de la clínica afectada puede revocar esta sesión.';
  END IF;

  UPDATE public.clinical_break_glass_sessions
  SET estado = 'REVOCADA',
      revocado_por = v_admin_id,
      revocado_at = v_now,
      motivo_revocacion = p_motivo_revocacion
  WHERE id = p_session_id;

  -- Registrar en log de auditoría
  INSERT INTO public.audit_logs (
    tenant_id, user_id, action, target_type, target_id, details, created_at
  ) VALUES (
    v_session.tenant_id, v_admin_id, 'BREAK_GLASS_ACCESS_REVOKED', 'clinical_break_glass_sessions', p_session_id::text,
    jsonb_build_object(
      'motivo_revocacion', p_motivo_revocacion,
      'paciente_id', v_session.paciente_id,
      'usuario_intervenido', v_session.user_id
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'estado', 'REVOCADA',
    'revocado_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_break_glass_session(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_break_glass_session(UUID, TEXT) TO authenticated;

COMMIT;
