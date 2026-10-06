-- ============================================================================
-- MIGRACIÓN FASE 3B: MODELO DE EVENTOS ODONTOLÓGICOS + OPERACIÓN TRANSACCIONAL E IDEMPOTENTE
-- Archivo: supabase/migrations/20261005_phase3b_odontogram_events_and_rpc.sql
--
-- ADITIVA: no modifica ni destruye odontogramas, evoluciones, treatment_plans.
-- Destino: Servicio 2 OdontoCloud (Coolify, VPS 150.136.210.37). NO toca Edunexus.
-- Compatible con el esquema REAL de producción verificado vía backup 2026-10-05:
--   evoluciones(id, tenant_id, paciente_id, profesional_id, fecha, diagnostico, tratamiento,
--               notas, procedimiento_cups, created_at, titulo, motivo, anamnesis,
--               examen_fisico, plan_manejo, medicamentos, adjuntos, firma_paciente, updated_at)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. IDEMPOTENCIA: clinical_operation_requests
--    Una fila por operación clínica completa (puede generar N eventos).
--    Toda la operación ocurre en una sola transacción: una fila sólo es visible
--    para otras sesiones cuando ya está 'completed'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_operation_requests (
    client_request_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    profesional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
    evolucion_id UUID NULL REFERENCES public.evoluciones(id) ON DELETE RESTRICT,
    response_payload JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_clinical_op_requests_tenant_patient
    ON public.clinical_operation_requests (tenant_id, paciente_id);

-- ----------------------------------------------------------------------------
-- 2. TRATAMIENTOS_PENDIENTES
--    No existía en producción (PGRST205). Se crea con las columnas que ya usa
--    el frontend (Odontograma.jsx / PlanEditor.jsx) + columnas de resolución.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tratamientos_pendientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    odontograma_id UUID NULL REFERENCES public.odontogramas(id) ON DELETE RESTRICT,
    diente TEXT NOT NULL,
    zona TEXT NULL,
    zona_label TEXT NULL,
    tratamiento TEXT NOT NULL,
    color TEXT NULL,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    valor NUMERIC DEFAULT 0,
    creado_por TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tratamientos_pendientes
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS resuelto_en_evolucion_id UUID NULL REFERENCES public.evoluciones(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS resuelto_por_profesional_id UUID NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS resuelto_fecha TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS resuelto_en_plan_item_id TEXT NULL;

-- NOT VALID: valida filas nuevas sin forzar migración de valores históricos.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tratamientos_pendientes_estado') THEN
        ALTER TABLE public.tratamientos_pendientes
            ADD CONSTRAINT chk_tratamientos_pendientes_estado
            CHECK (estado IN ('Pendiente', 'En_Proceso', 'Resuelto', 'Cancelado', 'Reactivado')) NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tratamientos_pendientes_tenant_paciente
    ON public.tratamientos_pendientes (tenant_id, paciente_id, estado);

-- ----------------------------------------------------------------------------
-- 3. ODONTOGRAM_EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.odontogram_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    odontograma_origen_id UUID NULL REFERENCES public.odontogramas(id) ON DELETE RESTRICT,
    tratamiento_pendiente_id UUID NULL REFERENCES public.tratamientos_pendientes(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE RESTRICT,
    plan_item_id TEXT NOT NULL,
    evolucion_id UUID NOT NULL REFERENCES public.evoluciones(id) ON DELETE RESTRICT,
    diente TEXT NOT NULL,
    superficies JSONB NOT NULL DEFAULT '[]'::jsonb,
    hallazgo_anterior TEXT NULL,
    effect_type TEXT NOT NULL,
    estado_nuevo TEXT NULL,
    resolves_finding BOOLEAN NOT NULL DEFAULT false,
    procedimiento_nombre TEXT NOT NULL,
    codigo_cups TEXT NULL,
    profesional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado_evento TEXT NOT NULL DEFAULT 'activo',
    motivo_anulacion TEXT NULL,
    anulado_por UUID NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMPTZ NULL,
    client_request_id UUID NOT NULL REFERENCES public.clinical_operation_requests(client_request_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_odontogram_event_estado CHECK (estado_evento IN ('activo', 'anulado')),
    CONSTRAINT chk_odontogram_event_effect_type CHECK (effect_type IN (
        'RESTORATION_COMPLETED', 'AMALGAM_COMPLETED', 'SEALANT_COMPLETED',
        'CROWN_COMPLETED', 'VENEER_COMPLETED', 'ROOT_CANAL_COMPLETED',
        'EXTRACTION_COMPLETED', 'IMPLANT_COMPLETED', 'PROCEDURE_IN_PROGRESS', 'NO_OP'
    )),
    -- Coherencia effect_type ↔ estado_nuevo también a nivel de tabla
    CONSTRAINT chk_odontogram_event_estado_nuevo CHECK (
        (effect_type = 'RESTORATION_COMPLETED' AND estado_nuevo = 'rest_adaptado') OR
        (effect_type = 'AMALGAM_COMPLETED'     AND estado_nuevo = 'amalgama_ok') OR
        (effect_type = 'SEALANT_COMPLETED'     AND estado_nuevo = 'sellante_bueno') OR
        (effect_type = 'CROWN_COMPLETED'       AND estado_nuevo = 'corona_buena') OR
        (effect_type = 'VENEER_COMPLETED'      AND estado_nuevo = 'carilla_adap') OR
        (effect_type = 'ROOT_CANAL_COMPLETED'  AND estado_nuevo = 'endodoncia_buena') OR
        (effect_type = 'EXTRACTION_COMPLETED'  AND estado_nuevo = 'ausente') OR
        (effect_type = 'IMPLANT_COMPLETED'     AND estado_nuevo = 'implante_bueno') OR
        (effect_type IN ('PROCEDURE_IN_PROGRESS', 'NO_OP') AND estado_nuevo IS NULL)
    ),
    CONSTRAINT chk_odontogram_event_in_progress_no_resolve CHECK (
        NOT (effect_type IN ('PROCEDURE_IN_PROGRESS', 'NO_OP') AND resolves_finding)
    ),
    CONSTRAINT chk_odontogram_event_superficies_array CHECK (jsonb_typeof(superficies) = 'array'),
    CONSTRAINT uq_odontogram_event UNIQUE (client_request_id, plan_item_id)
);

-- uq_odontogram_event ya indexa (client_request_id, plan_item_id) → sirve para client_request_id.
CREATE INDEX IF NOT EXISTS idx_odontogram_events_tenant_paciente_fecha
    ON public.odontogram_events (tenant_id, paciente_id, fecha_evento DESC);
CREATE INDEX IF NOT EXISTS idx_odontogram_events_evolucion
    ON public.odontogram_events (evolucion_id);
CREATE INDEX IF NOT EXISTS idx_odontogram_events_plan
    ON public.odontogram_events (plan_id, plan_item_id);
CREATE INDEX IF NOT EXISTS idx_odontogram_events_tratamiento_pendiente
    ON public.odontogram_events (tratamiento_pendiente_id) WHERE tratamiento_pendiente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_odontogram_events_odontograma_origen
    ON public.odontogram_events (odontograma_origen_id) WHERE odontograma_origen_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. INMUTABILIDAD DE ODONTOGRAM_EVENTS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_protect_odontogram_event_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'IMMUTABLE_EVENT: Los eventos odontologicos no pueden eliminarse.';
    END IF;

    IF (NEW.id, NEW.tenant_id, NEW.paciente_id, NEW.odontograma_origen_id, NEW.tratamiento_pendiente_id,
        NEW.plan_id, NEW.plan_item_id, NEW.evolucion_id, NEW.diente, NEW.superficies,
        NEW.hallazgo_anterior, NEW.effect_type, NEW.estado_nuevo, NEW.resolves_finding,
        NEW.procedimiento_nombre, NEW.codigo_cups, NEW.profesional_id, NEW.fecha_evento,
        NEW.client_request_id, NEW.created_at)
       IS DISTINCT FROM
       (OLD.id, OLD.tenant_id, OLD.paciente_id, OLD.odontograma_origen_id, OLD.tratamiento_pendiente_id,
        OLD.plan_id, OLD.plan_item_id, OLD.evolucion_id, OLD.diente, OLD.superficies,
        OLD.hallazgo_anterior, OLD.effect_type, OLD.estado_nuevo, OLD.resolves_finding,
        OLD.procedimiento_nombre, OLD.codigo_cups, OLD.profesional_id, OLD.fecha_evento,
        OLD.client_request_id, OLD.created_at)
    THEN
        RAISE EXCEPTION 'IMMUTABLE_EVENT: Los datos clinicos de un evento odontologico son inmutables.';
    END IF;

    IF OLD.estado_evento = 'anulado' THEN
        RAISE EXCEPTION 'INVALID_EVENT_STATE: Un evento anulado no admite cambios.';
    END IF;

    IF NEW.estado_evento = 'anulado' THEN
        IF NEW.anulado_por IS NULL OR NULLIF(btrim(NEW.motivo_anulacion), '') IS NULL OR NEW.fecha_anulacion IS NULL THEN
            RAISE EXCEPTION 'ANNULMENT_REQUIRES_REASON: La anulacion requiere anulado_por, motivo_anulacion y fecha_anulacion.';
        END IF;
    ELSIF (NEW.motivo_anulacion, NEW.anulado_por, NEW.fecha_anulacion)
          IS DISTINCT FROM (OLD.motivo_anulacion, OLD.anulado_por, OLD.fecha_anulacion) THEN
        RAISE EXCEPTION 'INVALID_EVENT_STATE: Datos de anulacion solo se registran al anular.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_odontogram_event_immutability ON public.odontogram_events;
CREATE TRIGGER trg_odontogram_event_immutability
BEFORE UPDATE OR DELETE ON public.odontogram_events
FOR EACH ROW EXECUTE FUNCTION public.trg_protect_odontogram_event_immutability();

-- ----------------------------------------------------------------------------
-- 5. RLS (las tablas nuevas NO quedan abiertas vía PostgREST)
--    - odontogram_events / clinical_operation_requests: solo lectura por tenant.
--      Escritura exclusivamente vía RPC SECURITY DEFINER.
--    - tratamientos_pendientes: solo lectura por tenant en 3B. Se omiten a propósito
--      las políticas INSERT/DELETE para que el código existente de Odontograma.jsx
--      (que hoy falla en silencio porque la tabla no existe) siga sin efecto y no
--      cambie el comportamiento aprobado de Fase 1/2. Se habilitarán en 3C.
-- ----------------------------------------------------------------------------
ALTER TABLE public.clinical_operation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogram_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos_pendientes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.clinical_operation_requests FROM anon, authenticated;
REVOKE ALL ON public.odontogram_events FROM anon, authenticated;
REVOKE ALL ON public.tratamientos_pendientes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tratamientos_pendientes FROM authenticated;
GRANT SELECT ON public.clinical_operation_requests TO authenticated;
GRANT SELECT ON public.odontogram_events TO authenticated;
GRANT SELECT ON public.tratamientos_pendientes TO authenticated;

DROP POLICY IF EXISTS p3b_select_tenant ON public.clinical_operation_requests;
CREATE POLICY p3b_select_tenant ON public.clinical_operation_requests
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.activo IS TRUE));

DROP POLICY IF EXISTS p3b_select_tenant ON public.odontogram_events;
CREATE POLICY p3b_select_tenant ON public.odontogram_events
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.activo IS TRUE));

DROP POLICY IF EXISTS p3b_select_tenant ON public.tratamientos_pendientes;
CREATE POLICY p3b_select_tenant ON public.tratamientos_pendientes
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.activo IS TRUE));

-- ----------------------------------------------------------------------------
-- 6. RPC complete_clinical_procedure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_clinical_procedure(
    p_client_request_id UUID,
    p_tenant_id UUID,
    p_paciente_id UUID,
    p_plan_id UUID,
    p_evolucion_data JSONB,
    p_events_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_uid UUID;
    v_profile public.profiles%ROWTYPE;
    v_plan public.treatment_plans%ROWTYPE;
    v_req public.clinical_operation_requests%ROWTYPE;
    v_claimed BOOLEAN;
    v_now TIMESTAMPTZ := now();
    v_now_txt TEXT;
    v_evolucion_id UUID;
    v_evolucion_fecha TIMESTAMPTZ;
    v_evolucion_tratamiento TEXT;
    v_items JSONB;
    v_item JSONB;
    v_idx INT;
    v_ev JSONB;
    v_ev_norm JSONB;
    v_norm_events JSONB := '[]'::jsonb;
    v_event_id UUID;
    v_event_ids UUID[] := ARRAY[]::UUID[];
    v_plan_item_id TEXT;
    v_seen_items TEXT[] := ARRAY[]::TEXT[];
    v_diente TEXT;
    v_superficies JSONB;
    v_surf TEXT;
    v_effect_type TEXT;
    v_estado_input TEXT;
    v_estado_nuevo TEXT;
    v_resolves BOOLEAN;
    v_proc_nombre TEXT;
    v_codigo_cups TEXT;
    v_pend_id UUID;
    v_odo_id UUID;
    v_item_status TEXT;
    v_payload JSONB;
BEGIN
    -- A. Argumentos
    IF p_client_request_id IS NULL OR p_tenant_id IS NULL OR p_paciente_id IS NULL OR p_plan_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: client_request_id, tenant_id, paciente_id y plan_id son obligatorios.';
    END IF;
    IF p_evolucion_data IS NULL OR jsonb_typeof(p_evolucion_data) <> 'object' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: evolucion_data debe ser un objeto JSON.';
    END IF;
    IF p_events_data IS NULL OR jsonb_typeof(p_events_data) <> 'array' OR jsonb_array_length(p_events_data) = 0 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: events_data debe ser un array no vacio.';
    END IF;

    -- B. Sesión / profesional / tenant (no se confía en p_tenant_id)
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Sesion no autenticada.';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_auth_uid;
    IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'PROFILE_NOT_ACTIVE: Profesional inexistente o inactivo.';
    END IF;
    IF v_profile.tenant_id IS DISTINCT FROM p_tenant_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_TENANT: El usuario autenticado no pertenece al tenant indicado.';
    END IF;
    IF lower(btrim(COALESCE(v_profile.role, ''))) NOT IN ('odontologo', 'doctor', 'profesional', 'administrador', 'admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_CLINICAL_ROLE: Rol % no habilitado para registrar procedimientos.', v_profile.role;
    END IF;

    -- C. Idempotencia: reclamar la clave. Si otra transacción la tiene, el INSERT
    --    espera a que termine (índice PK). Si ya existe, se devuelve el resultado previo.
    INSERT INTO public.clinical_operation_requests
        (client_request_id, tenant_id, paciente_id, profesional_id, plan_id, status, created_at)
    VALUES
        (p_client_request_id, p_tenant_id, p_paciente_id, v_auth_uid, p_plan_id, 'processing', v_now)
    ON CONFLICT (client_request_id) DO NOTHING
    RETURNING true INTO v_claimed;

    IF v_claimed IS NULL THEN
        SELECT * INTO v_req FROM public.clinical_operation_requests WHERE client_request_id = p_client_request_id;
        IF v_req.tenant_id IS DISTINCT FROM p_tenant_id
           OR v_req.paciente_id IS DISTINCT FROM p_paciente_id
           OR v_req.plan_id IS DISTINCT FROM p_plan_id THEN
            RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED: client_request_id ya fue usado para otra operacion.';
        END IF;
        IF v_req.status <> 'completed' THEN
            RAISE EXCEPTION 'OPERATION_IN_PROGRESS: La operacion % sigue en proceso.', p_client_request_id;
        END IF;
        RETURN v_req.response_payload || jsonb_build_object('already_processed', true, 'status', 'ALREADY_PROCESSED');
    END IF;

    -- D. Paciente del tenant
    PERFORM 1 FROM public.pacientes WHERE id = p_paciente_id AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PATIENT_NOT_FOUND: El paciente no pertenece al tenant.';
    END IF;

    -- E. Bloqueo del plan (serializa operaciones concurrentes sobre el mismo JSON)
    SELECT * INTO v_plan FROM public.treatment_plans
    WHERE id = p_plan_id AND tenant_id = p_tenant_id AND paciente_id = p_paciente_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PLAN_NOT_FOUND: El plan no pertenece al paciente o tenant.';
    END IF;
    v_items := COALESCE(v_plan.detalles->'items', '[]'::jsonb);
    IF jsonb_typeof(v_items) <> 'array' THEN
        RAISE EXCEPTION 'PLAN_ITEMS_INVALID: detalles.items no es un array.';
    END IF;

    -- F. Validación y normalización de TODOS los eventos antes de escribir nada clínico
    FOR v_ev IN SELECT value FROM jsonb_array_elements(p_events_data)
    LOOP
        v_plan_item_id := NULLIF(btrim(v_ev->>'plan_item_id'), '');
        v_diente       := NULLIF(btrim(v_ev->>'diente'), '');
        v_proc_nombre  := NULLIF(btrim(v_ev->>'procedimiento_nombre'), '');
        v_effect_type  := v_ev->>'effect_type';
        v_estado_input := NULLIF(btrim(v_ev->>'estado_nuevo'), '');
        v_superficies  := COALESCE(v_ev->'superficies', '[]'::jsonb);
        v_codigo_cups  := NULLIF(btrim(v_ev->>'codigo_cups'), '');
        v_resolves     := COALESCE((v_ev->>'resolves_finding')::boolean, false);
        v_pend_id      := NULLIF(v_ev->>'tratamiento_pendiente_id', '')::uuid;
        v_odo_id       := NULLIF(v_ev->>'odontograma_origen_id', '')::uuid;

        IF v_plan_item_id IS NULL OR v_diente IS NULL OR v_proc_nombre IS NULL THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: Cada evento requiere plan_item_id, diente y procedimiento_nombre.';
        END IF;
        IF v_plan_item_id = ANY(v_seen_items) THEN
            RAISE EXCEPTION 'DUPLICATE_PLAN_ITEM: El item % aparece repetido en la operacion.', v_plan_item_id;
        END IF;
        v_seen_items := array_append(v_seen_items, v_plan_item_id);

        -- Ítem existe y no está ya realizado
        SELECT value INTO v_item FROM jsonb_array_elements(v_items) WHERE value->>'id' = v_plan_item_id LIMIT 1;
        IF v_item IS NULL THEN
            RAISE EXCEPTION 'PLAN_ITEM_NOT_FOUND: El item % no existe en el plan.', v_plan_item_id;
        END IF;
        v_item_status := COALESCE(v_item->>'status', '');
        IF v_item_status = 'completed' OR COALESCE((v_item->>'realizado')::boolean, false) THEN
            RAISE EXCEPTION 'PLAN_ITEM_ALREADY_COMPLETED: El item % ya fue realizado.', v_plan_item_id;
        END IF;
        IF v_item_status IN ('cancelled', 'canceled', 'anulado') THEN
            RAISE EXCEPTION 'PLAN_ITEM_CANCELLED: El item % esta cancelado.', v_plan_item_id;
        END IF;

        -- effect_type permitido + estado_nuevo derivado en backend
        v_estado_nuevo := CASE v_effect_type
            WHEN 'RESTORATION_COMPLETED' THEN 'rest_adaptado'
            WHEN 'AMALGAM_COMPLETED'     THEN 'amalgama_ok'
            WHEN 'SEALANT_COMPLETED'     THEN 'sellante_bueno'
            WHEN 'CROWN_COMPLETED'       THEN 'corona_buena'
            WHEN 'VENEER_COMPLETED'      THEN 'carilla_adap'
            WHEN 'ROOT_CANAL_COMPLETED'  THEN 'endodoncia_buena'
            WHEN 'EXTRACTION_COMPLETED'  THEN 'ausente'
            WHEN 'IMPLANT_COMPLETED'     THEN 'implante_bueno'
            WHEN 'PROCEDURE_IN_PROGRESS' THEN NULL
            WHEN 'NO_OP'                 THEN NULL
            ELSE '__INVALID__'
        END;
        IF v_estado_nuevo = '__INVALID__' OR v_effect_type IS NULL THEN
            RAISE EXCEPTION 'INVALID_EFFECT_TYPE: Tipo de efecto % no permitido.', v_effect_type;
        END IF;
        IF v_estado_input IS NOT NULL AND v_estado_input IS DISTINCT FROM v_estado_nuevo THEN
            RAISE EXCEPTION 'INCOMPATIBLE_NEW_STATE: estado_nuevo % incompatible con %.', v_estado_input, v_effect_type;
        END IF;

        -- Superficies
        IF jsonb_typeof(v_superficies) <> 'array' THEN
            RAISE EXCEPTION 'INVALID_SURFACE: superficies debe ser un array.';
        END IF;
        FOR v_surf IN SELECT value FROM jsonb_array_elements_text(v_superficies)
        LOOP
            IF v_surf NOT IN ('center', 'top', 'bottom', 'left', 'right', 'Completo') THEN
                RAISE EXCEPTION 'INVALID_SURFACE: Superficie % no valida.', v_surf;
            END IF;
        END LOOP;
        IF v_effect_type IN ('RESTORATION_COMPLETED', 'AMALGAM_COMPLETED', 'SEALANT_COMPLETED')
           AND jsonb_array_length(v_superficies) = 0 THEN
            RAISE EXCEPTION 'MISSING_SURFACE: % requiere al menos una superficie.', v_effect_type;
        END IF;
        IF v_effect_type IN ('EXTRACTION_COMPLETED', 'IMPLANT_COMPLETED', 'ROOT_CANAL_COMPLETED', 'CROWN_COMPLETED') THEN
            v_superficies := '["Completo"]'::jsonb;   -- alcance de pieza completa forzado
        END IF;

        -- PROCEDURE_IN_PROGRESS / NO_OP nunca resuelven hallazgo
        IF v_effect_type IN ('PROCEDURE_IN_PROGRESS', 'NO_OP') THEN
            v_resolves := false;
        END IF;

        -- Pertenencia de pendiente y odontograma
        IF v_pend_id IS NOT NULL THEN
            PERFORM 1 FROM public.tratamientos_pendientes
            WHERE id = v_pend_id AND tenant_id = p_tenant_id AND paciente_id = p_paciente_id
            FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'PENDING_TREATMENT_MISMATCH: Tratamiento pendiente % no pertenece al paciente/tenant.', v_pend_id;
            END IF;
        END IF;
        IF v_odo_id IS NOT NULL THEN
            PERFORM 1 FROM public.odontogramas
            WHERE id = v_odo_id AND tenant_id = p_tenant_id AND paciente_id = p_paciente_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'ODONTOGRAM_ORIGIN_MISMATCH: Odontograma % no pertenece al paciente/tenant.', v_odo_id;
            END IF;
        END IF;

        v_norm_events := v_norm_events || jsonb_build_array(jsonb_build_object(
            'plan_item_id', v_plan_item_id, 'diente', v_diente, 'superficies', v_superficies,
            'effect_type', v_effect_type, 'estado_nuevo', v_estado_nuevo, 'resolves_finding', v_resolves,
            'procedimiento_nombre', v_proc_nombre, 'codigo_cups', v_codigo_cups,
            'tratamiento_pendiente_id', v_pend_id, 'odontograma_origen_id', v_odo_id,
            'hallazgo_anterior', NULLIF(btrim(v_ev->>'hallazgo_anterior'), '')
        ));
    END LOOP;

    -- G. Evolución (solo columnas existentes en producción; NO se fuerza cierre:
    --    el cierre/firma sigue siendo responsabilidad del flujo de Paso 1.3)
    v_evolucion_id := gen_random_uuid();
    v_evolucion_fecha := COALESCE(NULLIF(p_evolucion_data->>'fecha', '')::timestamptz, v_now);
    IF jsonb_typeof(p_evolucion_data->'tratamiento') = 'object' THEN
        v_evolucion_tratamiento := (p_evolucion_data->'tratamiento')::text;
    ELSE
        v_evolucion_tratamiento := COALESCE(p_evolucion_data->>'tratamiento', 'Procedimiento registrado desde plan de tratamiento');
    END IF;

    INSERT INTO public.evoluciones (
        id, tenant_id, paciente_id, profesional_id, fecha, diagnostico, tratamiento, notas,
        procedimiento_cups, titulo, motivo, anamnesis, examen_fisico, plan_manejo,
        medicamentos, adjuntos, created_at, updated_at
    ) VALUES (
        v_evolucion_id, p_tenant_id, p_paciente_id, v_auth_uid, v_evolucion_fecha,
        p_evolucion_data->>'diagnostico', v_evolucion_tratamiento, p_evolucion_data->>'notas',
        p_evolucion_data->>'procedimiento_cups', p_evolucion_data->>'titulo', p_evolucion_data->>'motivo',
        p_evolucion_data->>'anamnesis', p_evolucion_data->>'examen_fisico', p_evolucion_data->>'plan_manejo',
        COALESCE(p_evolucion_data->'medicamentos', '[]'::jsonb),
        COALESCE(p_evolucion_data->'adjuntos', '[]'::jsonb),
        v_now, v_now
    );

    -- H. Eventos + pendientes
    FOR v_ev_norm IN SELECT value FROM jsonb_array_elements(v_norm_events)
    LOOP
        v_event_id := gen_random_uuid();
        INSERT INTO public.odontogram_events (
            id, tenant_id, paciente_id, odontograma_origen_id, tratamiento_pendiente_id,
            plan_id, plan_item_id, evolucion_id, diente, superficies, hallazgo_anterior,
            effect_type, estado_nuevo, resolves_finding, procedimiento_nombre, codigo_cups,
            profesional_id, fecha_evento, estado_evento, client_request_id, created_at
        ) VALUES (
            v_event_id, p_tenant_id, p_paciente_id,
            NULLIF(v_ev_norm->>'odontograma_origen_id', '')::uuid,
            NULLIF(v_ev_norm->>'tratamiento_pendiente_id', '')::uuid,
            p_plan_id, v_ev_norm->>'plan_item_id', v_evolucion_id, v_ev_norm->>'diente',
            v_ev_norm->'superficies', v_ev_norm->>'hallazgo_anterior',
            v_ev_norm->>'effect_type', v_ev_norm->>'estado_nuevo',
            (v_ev_norm->>'resolves_finding')::boolean,
            v_ev_norm->>'procedimiento_nombre', v_ev_norm->>'codigo_cups',
            v_auth_uid, v_evolucion_fecha, 'activo', p_client_request_id, v_now
        );
        v_event_ids := array_append(v_event_ids, v_event_id);

        v_pend_id := NULLIF(v_ev_norm->>'tratamiento_pendiente_id', '')::uuid;
        IF v_pend_id IS NOT NULL THEN
            IF (v_ev_norm->>'resolves_finding')::boolean THEN
                UPDATE public.tratamientos_pendientes
                SET estado = 'Resuelto',
                    resuelto_en_evolucion_id = v_evolucion_id,
                    resuelto_por_profesional_id = v_auth_uid,
                    resuelto_fecha = v_now,
                    resuelto_en_plan_item_id = v_ev_norm->>'plan_item_id',
                    updated_at = v_now
                WHERE id = v_pend_id AND estado <> 'Resuelto';
            ELSIF v_ev_norm->>'effect_type' = 'PROCEDURE_IN_PROGRESS' THEN
                UPDATE public.tratamientos_pendientes
                SET estado = 'En_Proceso', updated_at = v_now
                WHERE id = v_pend_id AND estado IN ('Pendiente', 'Reactivado', 'En_Proceso');
            END IF;
        END IF;
    END LOOP;

    -- I. Actualizar ítems del plan (estructura JSON existente, sin normalizar)
    v_now_txt := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    FOR v_ev_norm IN SELECT value FROM jsonb_array_elements(v_norm_events)
    LOOP
        SELECT (ord - 1)::int INTO v_idx
        FROM jsonb_array_elements(v_items) WITH ORDINALITY AS t(value, ord)
        WHERE value->>'id' = v_ev_norm->>'plan_item_id' LIMIT 1;

        v_item := v_items->v_idx;
        v_item := v_item || jsonb_build_object(
            'evolucion_id', v_evolucion_id,
            'fechaUltimaEvolucion', v_now_txt,
            'evoluciones_ids', COALESCE(v_item->'evoluciones_ids', '[]'::jsonb) || to_jsonb(v_evolucion_id)
        );
        IF v_ev_norm->>'effect_type' = 'PROCEDURE_IN_PROGRESS' THEN
            v_item := v_item || jsonb_build_object('status', 'in_progress', 'realizado', false);
        ELSE
            v_item := v_item || jsonb_build_object(
                'status', 'completed',
                'realizado', true,
                'fechaRealizado', v_now_txt,
                'resolucion_odontograma', jsonb_build_object(
                    'effect_type', v_ev_norm->>'effect_type',
                    'estado_nuevo', v_ev_norm->'estado_nuevo',
                    'diente', v_ev_norm->>'diente',
                    'superficies', v_ev_norm->'superficies',
                    'resolves_finding', (v_ev_norm->>'resolves_finding')::boolean,
                    'client_request_id', p_client_request_id
                )
            );
        END IF;
        v_items := jsonb_set(v_items, ARRAY[v_idx::text], v_item);
    END LOOP;

    UPDATE public.treatment_plans
    SET detalles = jsonb_set(COALESCE(detalles, '{}'::jsonb), '{items}', v_items)
    WHERE id = p_plan_id;

    -- J. Cierre de la operación idempotente
    v_payload := jsonb_build_object(
        'success', true,
        'status', 'COMPLETED',
        'client_request_id', p_client_request_id,
        'evolucion_id', v_evolucion_id,
        'event_ids', to_jsonb(v_event_ids),
        'plan_id', p_plan_id,
        'plan_item_ids', to_jsonb(v_seen_items),
        'already_processed', false
    );

    UPDATE public.clinical_operation_requests
    SET status = 'completed', evolucion_id = v_evolucion_id, completed_at = v_now, response_payload = v_payload
    WHERE client_request_id = p_client_request_id;

    RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_clinical_procedure(UUID, UUID, UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_clinical_procedure(UUID, UUID, UUID, UUID, JSONB, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.trg_protect_odontogram_event_immutability() FROM PUBLIC, anon, authenticated;

COMMIT;
