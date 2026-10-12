-- =============================================================================
-- ODONTOCLOUD — ARQUITECTURA IHCE: COLA TRANSACCIONAL OUTBOX (FHIR R4)
-- Archivo: supabase/migrations/20261012_ihce_transactional_outbox_queue.sql
-- =============================================================================
-- PRINCIPIOS DE INTEGRACIÓN RESILIENTE:
-- 1. Atomicidad con el cierre clínico: La tarea de envío se encola dentro de la
--    misma transacción en la que se sella la evolución. Si el cierre tiene éxito,
--    la tarea de interoperabilidad queda garantizada.
-- 2. Inmutabilidad y Cero Bloqueo: La cola referencia el closed_snapshot y el
--    content_hash ya sellados en la evolución. El odontólogo no experimenta
--    retrasos ni bloqueos ante caídas del servidor nacional.
-- 3. Idempotencia estricta: Se impone restricción UNIQUE sobre idempotency_key
--    (hash determinista de tenant_id, evolution_id y content_hash) para evitar
--    duplicados ante reintentos.
-- 4. Aislamiento Multi-Tenant: Cada radicación está ligada a su tenant_id con RLS.
-- 5. Trazabilidad de ciclo de vida: Registra estados PENDIENTE, EN_PROCESO,
--    ACEPTADO, RECHAZADO, ERROR_REINTENTO, con códigos de respuesta HTTP y
--    el identificador RDA oficial retornado por Minsalud.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS public.ihce_outbox_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  evolution_id UUID NOT NULL REFERENCES public.evoluciones(id) ON DELETE RESTRICT,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  intentos INT NOT NULL DEFAULT 0,
  max_intentos INT NOT NULL DEFAULT 5,
  proximo_intento_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  radicado_rda_id TEXT DEFAULT NULL,
  http_status INT DEFAULT NULL,
  respuesta_minsalud JSONB DEFAULT NULL,
  ultimo_error TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT uq_ihce_queue_idempotency UNIQUE (idempotency_key),
  CONSTRAINT chk_ihce_queue_status CHECK (
    status IN ('PENDIENTE', 'EN_PROCESO', 'ACEPTADO', 'RECHAZADO', 'ERROR_REINTENTO')
  )
);

CREATE INDEX IF NOT EXISTS idx_ihce_queue_worker 
  ON public.ihce_outbox_queue (status, proximo_intento_at)
  WHERE status IN ('PENDIENTE', 'ERROR_REINTENTO');

CREATE INDEX IF NOT EXISTS idx_ihce_queue_tenant_paciente 
  ON public.ihce_outbox_queue (tenant_id, paciente_id);

ALTER TABLE public.ihce_outbox_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ihce_outbox_queue_tenant_select ON public.ihce_outbox_queue;
CREATE POLICY ihce_outbox_queue_tenant_select ON public.ihce_outbox_queue
FOR SELECT TO authenticated
USING (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
);

-- Trigger de encolamiento atómico automático al cerrar la evolución
CREATE OR REPLACE FUNCTION public.trg_enqueue_closed_evolution_for_ihce()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_key TEXT;
BEGIN
  -- Solo se activa cuando la evolución cambia de borrador a cerrada
  IF (OLD.status IS DISTINCT FROM 'cerrada' AND NEW.status = 'cerrada') THEN
    v_idempotency_key := encode(
      sha256(
        (NEW.tenant_id::text || ':' || NEW.id::text || ':' || coalesce(NEW.content_hash, ''))::bytea
      ),
      'hex'
    );

    INSERT INTO public.ihce_outbox_queue (
      tenant_id,
      evolution_id,
      paciente_id,
      idempotency_key,
      snapshot_hash,
      status,
      proximo_intento_at
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.paciente_id,
      v_idempotency_key,
      coalesce(NEW.content_hash, 'unsigned_snapshot'),
      'PENDIENTE',
      clock_timestamp()
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_ihce_on_close ON public.evoluciones;
CREATE TRIGGER trg_enqueue_ihce_on_close
  AFTER UPDATE OF status ON public.evoluciones
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_closed_evolution_for_ihce();

COMMIT;
