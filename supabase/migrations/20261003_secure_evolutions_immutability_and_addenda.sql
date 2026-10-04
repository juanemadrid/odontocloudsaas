-- ============================================================================
-- MIGRACIÓN: 20261003_secure_evolutions_immutability_and_addenda.sql
-- PASO 1.3: INMUTABILIDAD DE EVOLUCIONES CLÍNICAS, NOTAS ACLARATORIAS (ADENDAS)
-- Y ACOPLAMIENTO MÍNIMO CON generate_signature_token DEL PASO 1.2
-- ============================================================================

BEGIN;

-- 1. Verificación previa de extensiones requeridas en el esquema extensions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'PREREQUISITE_FAILED: La extension pgcrypto no esta instalada en el catalogo extensions.';
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. FASE 1: AGREGAR COLUMNAS A EVOLUCIONES
-- ----------------------------------------------------------------------------
ALTER TABLE public.evoluciones
    ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('borrador', 'cerrada')),
    ADD COLUMN IF NOT EXISTS closure_origin TEXT CHECK (closure_origin IN ('professional', 'legacy_migration')),
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS closed_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS content_hash TEXT,
    ADD COLUMN IF NOT EXISTS professional_signature_snapshot JSONB;

-- Helper canónico para construir el snapshot clínico certificado
CREATE OR REPLACE FUNCTION public.build_evolution_clinical_snapshot(p_evo public.evoluciones)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'paciente_id', p_evo.paciente_id,
        'profesional_id', p_evo.profesional_id,
        'fecha', p_evo.fecha,
        'diagnostico', p_evo.diagnostico,
        'procedimiento_cups', p_evo.procedimiento_cups,
        'tratamiento', p_evo.tratamiento,
        'notas', p_evo.notas,
        'medicamentos', p_evo.medicamentos,
        'adjuntos', p_evo.adjuntos,
        'titulo', p_evo.titulo,
        'motivo', p_evo.motivo,
        'anamnesis', p_evo.anamnesis,
        'examen_fisico', p_evo.examen_fisico,
        'plan_manejo', p_evo.plan_manejo
    );
$$;

REVOKE ALL ON FUNCTION public.build_evolution_clinical_snapshot(public.evoluciones) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_evolution_clinical_snapshot(public.evoluciones) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. FASE 2: CLASIFICACIÓN HISTÓRICA CON TIMESTAMP FIJO Y GUARD ESTRICTO (7/8/15)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_migration_time TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_cutoff TIMESTAMPTZ := v_migration_time - INTERVAL '72 hours';
    v_count_total INT;
    v_count_old INT;
    v_count_recent INT;
    v_r public.evoluciones%ROWTYPE;
    v_snapshot JSONB;
    v_hash TEXT;
BEGIN
    SELECT COUNT(*) INTO v_count_total FROM public.evoluciones;
    SELECT COUNT(*) INTO v_count_old FROM public.evoluciones WHERE COALESCE(created_at, fecha) < v_cutoff;
    SELECT COUNT(*) INTO v_count_recent FROM public.evoluciones WHERE COALESCE(created_at, fecha) >= v_cutoff;

    IF v_count_old <> 7 OR v_count_recent <> 8 OR v_count_total <> 15 THEN
        RAISE EXCEPTION 'COUNT_MISMATCH: Se esperaban 7 antiguas, 8 recientes y 15 en total. Encontradas: % antiguas, % recientes (Total: %). Abortando migracion.',
            v_count_old, v_count_recent, v_count_total;
    END IF;

    -- A. Clasificar las 7 antiguas (>72h) como históricas protegidas (sin firmas inventadas)
    FOR v_r IN 
        SELECT * FROM public.evoluciones WHERE COALESCE(created_at, fecha) < v_cutoff FOR UPDATE
    LOOP
        v_snapshot := public.build_evolution_clinical_snapshot(v_r);
        v_hash := pg_catalog.encode(extensions.digest(v_snapshot::text::bytea, 'sha256'), 'hex');

        UPDATE public.evoluciones
        SET status = 'cerrada',
            closure_origin = 'legacy_migration',
            closed_at = v_migration_time,
            closed_by = NULL,
            closed_snapshot = v_snapshot,
            content_hash = v_hash,
            professional_signature_snapshot = NULL,
            created_by = NULL
        WHERE id = v_r.id;
    END LOOP;

    -- B. Clasificar las 8 recientes (<=72h) como borradores pendientes
    UPDATE public.evoluciones
    SET status = 'borrador',
        closure_origin = NULL,
        closed_at = NULL,
        closed_by = NULL,
        closed_snapshot = NULL,
        content_hash = NULL,
        professional_signature_snapshot = NULL,
        created_by = NULL
    WHERE COALESCE(created_at, fecha) >= v_cutoff;
END $$;


-- ----------------------------------------------------------------------------
-- 4. FASE 3: VERIFICACIÓN DE CONSISTENCIA (CERO NULOS EN STATUS)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.evoluciones WHERE status IS NULL) THEN
        RAISE EXCEPTION 'INTEGRITY_CHECK_FAILED: Existen registros con status NULL tras la clasificacion. Abortando.';
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 5. FASE 4: CONSTRAINT DE COHERENCIA Y NOT NULL
-- ----------------------------------------------------------------------------
ALTER TABLE public.evoluciones
    DROP CONSTRAINT IF EXISTS evoluciones_status_closure_origin_check;

ALTER TABLE public.evoluciones
    ADD CONSTRAINT evoluciones_status_closure_origin_check
    CHECK (
        (status = 'borrador' AND closure_origin IS NULL)
        OR
        (status = 'cerrada' AND closure_origin IN ('professional', 'legacy_migration'))
    );

ALTER TABLE public.evoluciones 
    ALTER COLUMN status SET DEFAULT 'borrador',
    ALTER COLUMN status SET NOT NULL;


-- ----------------------------------------------------------------------------
-- 6. FASE 5: TRIGGER DE PROTECCIÓN DE INTEGRIDAD Y AUDITORÍA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_protect_evolution_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- INSERCION: Todo nuevo registro entra forzado como borrador limpio y con autoria auditada
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL THEN
            NEW.created_by := auth.uid();
        END IF;
        NEW.status := 'borrador';
        NEW.closure_origin := NULL;
        NEW.closed_by := NULL;
        NEW.closed_at := NULL;
        NEW.closed_snapshot := NULL;
        NEW.content_hash := NULL;
        NEW.professional_signature_snapshot := NULL;
        RETURN NEW;
    END IF;

    -- ELIMINACION: Prohibido borrar evoluciones cerradas
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'cerrada' THEN
            RAISE EXCEPTION 'EVOLUTION_IS_IMMUTABLE: No es posible eliminar una evolucion clinica cerrada.';
        END IF;
        RETURN OLD;
    END IF;

    -- ACTUALIZACION:
    IF TG_OP = 'UPDATE' THEN
        -- 1. Inmutabilidad de autoria original (created_by)
        IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'CANNOT_MODIFY_CREATED_BY: La autoria original (created_by) no puede ser modificada.';
        END IF;

        -- 2. Inmutabilidad total de evoluciones cerradas (tanto professional como legacy_migration)
        IF OLD.status = 'cerrada' THEN
            RAISE EXCEPTION 'EVOLUTION_IS_IMMUTABLE: Esta evolucion clinica esta cerrada y protegida. No admite modificaciones.';
        END IF;

        -- 3. Prohibido revertir borrador a NULL
        IF OLD.status = 'borrador' AND NEW.status IS NULL THEN
            RAISE EXCEPTION 'CANNOT_SET_STATUS_TO_NULL: El estado de un borrador no puede revertirse a nulo.';
        END IF;

        -- 4. Transicion borrador -> cerrada: SOLO permitida desde close_evolution()
        IF OLD.status = 'borrador' AND NEW.status = 'cerrada' THEN
            IF pg_catalog.current_setting('odontocloud.in_close_evolution', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'CANNOT_CLOSE_DIRECTLY_VIA_UPDATE: El cierre clinico solo puede realizarse mediante close_evolution().';
            END IF;

            IF public.build_evolution_clinical_snapshot(OLD) IS DISTINCT FROM public.build_evolution_clinical_snapshot(NEW) THEN
                RAISE EXCEPTION 'CANNOT_ALTER_CLINICAL_DATA_DURING_CLOSURE: No se permite modificar datos clinicos durante el cierre.';
            END IF;
        END IF;

        -- 5. Si permanece en borrador, proteger metadatos de cierre y closure_origin
        IF OLD.status = 'borrador' AND NEW.status = 'borrador' THEN
            IF (NEW.closure_origin IS DISTINCT FROM OLD.closure_origin) OR
               (NEW.closed_by IS DISTINCT FROM OLD.closed_by) OR
               (NEW.closed_at IS DISTINCT FROM OLD.closed_at) OR
               (NEW.content_hash IS DISTINCT FROM OLD.content_hash) OR
               (NEW.closed_snapshot IS DISTINCT FROM OLD.closed_snapshot) OR
               (NEW.professional_signature_snapshot IS DISTINCT FROM OLD.professional_signature_snapshot) THEN
                RAISE EXCEPTION 'CANNOT_MODIFY_CLOSURE_METADATA_ON_DRAFT: No esta permitido modificar metadatos de cierre en un borrador.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evoluciones_protect_integrity ON public.evoluciones;
CREATE TRIGGER trg_evoluciones_protect_integrity
BEFORE INSERT OR UPDATE OR DELETE ON public.evoluciones
FOR EACH ROW EXECUTE FUNCTION public.trg_protect_evolution_integrity();


-- ----------------------------------------------------------------------------
-- 7. FASE 6: RPC PARA CIERRE CLÍNICO PROFESIONAL (close_evolution)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_evolution(p_evolution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_evo public.evoluciones%ROWTYPE;
    v_profile public.profiles%ROWTYPE;
    v_snapshot JSONB;
    v_hash TEXT;
    v_sig_snapshot JSONB;
    v_normalized_role TEXT;
    v_closed_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED: Sesion requerida para certificar la evolucion.';
    END IF;

    SELECT * INTO v_evo
    FROM public.evoluciones
    WHERE id = p_evolution_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'EVOLUTION_NOT_FOUND: Evolucion no encontrada.';
    END IF;

    IF v_evo.status = 'cerrada' THEN
        RAISE EXCEPTION 'EVOLUTION_ALREADY_CLOSED: La evolucion ya se encuentra cerrada.';
    END IF;

    IF v_evo.status <> 'borrador' THEN
        RAISE EXCEPTION 'INVALID_EVOLUTION_STATUS: Solo es posible cerrar evoluciones en estado borrador.';
    END IF;

    IF v_evo.profesional_id IS NULL THEN
        RAISE EXCEPTION 'PROFESSIONAL_REQUIRED_FOR_CLOSURE: La evolucion debe tener un profesional tratante asignado.';
    END IF;

    IF v_evo.profesional_id <> v_user_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_NOT_TREATING_DOCTOR: Solo el profesional tratante asignado puede certificar y cerrar esta evolucion.';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'PROFILE_NOT_ACTIVE: El perfil del profesional tratante no se encuentra activo.';
    END IF;

    IF v_profile.tenant_id <> v_evo.tenant_id THEN
        RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Conflicto de pertenencia de clinica.';
    END IF;

    v_normalized_role := pg_catalog.lower(pg_catalog.trim(COALESCE(v_profile.role, '')));
    IF v_normalized_role NOT IN ('odontologo', 'doctor', 'profesional') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_CLINICAL_ROLE_REQUIRED: Se requiere un rol clinico habilitado para certificar evoluciones.';
    END IF;

    IF v_profile.firma IS NULL OR pg_catalog.length(pg_catalog.trim(v_profile.firma)) = 0 THEN
        RAISE EXCEPTION 'PROFESSIONAL_SIGNATURE_REQUIRED: El profesional debe registrar su firma en su perfil antes de cerrar la evolucion.';
    END IF;

    v_closed_at := pg_catalog.clock_timestamp();
    v_snapshot := public.build_evolution_clinical_snapshot(v_evo);
    v_hash := pg_catalog.encode(extensions.digest(v_snapshot::text::bytea, 'sha256'), 'hex');

    v_sig_snapshot := jsonb_build_object(
        'signature_image', v_profile.firma,
        'signer_id', v_user_id,
        'signer_name', v_profile.full_name,
        'signer_role', v_normalized_role,
        'registro_medico', v_profile.registro_medico,
        'signed_at', v_closed_at
    );

    PERFORM pg_catalog.set_config('odontocloud.in_close_evolution', 'true', true);

    UPDATE public.evoluciones
    SET status = 'cerrada',
        closure_origin = 'professional',
        closed_by = v_user_id,
        closed_at = v_closed_at,
        closed_snapshot = v_snapshot,
        content_hash = v_hash,
        professional_signature_snapshot = v_sig_snapshot
    WHERE id = p_evolution_id;

    RETURN jsonb_build_object(
        'success', true,
        'evolution_id', p_evolution_id,
        'status', 'cerrada',
        'closure_origin', 'professional',
        'content_hash', v_hash,
        'closed_at', v_closed_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.close_evolution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_evolution(UUID) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 8. FASE 7: TABLA DE NOTAS ACLARATORIAS (ADENDAS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evolution_addenda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_id UUID NOT NULL REFERENCES public.evoluciones(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    author_snapshot JSONB NOT NULL,
    addendum_snapshot JSONB NOT NULL,
    comentario TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.evolution_addenda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.evolution_addenda FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_protect_evolution_addenda_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        RAISE EXCEPTION 'ADDENDA_IS_IMMUTABLE: Las notas aclaratorias son inmutables y no admiten modificaciones ni eliminacion.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evolution_addenda_immutable ON public.evolution_addenda;
CREATE TRIGGER trg_evolution_addenda_immutable
BEFORE UPDATE OR DELETE ON public.evolution_addenda
FOR EACH ROW EXECUTE FUNCTION public.trg_protect_evolution_addenda_integrity();

CREATE OR REPLACE FUNCTION public.create_evolution_addendum(
    p_evolution_id UUID,
    p_comentario TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_evo public.evoluciones%ROWTYPE;
    v_profile public.profiles%ROWTYPE;
    v_author_snapshot JSONB;
    v_addendum_snapshot JSONB;
    v_content_hash TEXT;
    v_clean_comment TEXT;
    v_addendum_id UUID;
    v_normalized_role TEXT;
    v_created_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED: Sesion requerida para registrar una nota aclaratoria.';
    END IF;

    v_clean_comment := pg_catalog.trim(pg_catalog.coalesce(p_comentario, ''));
    IF pg_catalog.length(v_clean_comment) < 5 OR pg_catalog.length(v_clean_comment) > 5000 THEN
        RAISE EXCEPTION 'INVALID_ADDENDUM_LENGTH: La nota aclaratoria debe contener entre 5 y 5000 caracteres.';
    END IF;

    SELECT * INTO v_evo FROM public.evoluciones WHERE id = p_evolution_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'EVOLUTION_NOT_FOUND: Evolucion no encontrada.';
    END IF;

    -- Se permite adenda sobre CUALQUIER evolucion cerrada (tanto professional como legacy_migration)
    IF v_evo.status IS DISTINCT FROM 'cerrada' THEN
        RAISE EXCEPTION 'CANNOT_ADD_ADDENDUM_TO_NON_CLOSED: Solo es posible redactar notas aclaratorias sobre evoluciones formalmente cerradas.';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'PROFILE_NOT_ACTIVE: El perfil del autor no se encuentra activo.';
    END IF;

    IF v_profile.tenant_id <> v_evo.tenant_id THEN
        RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Conflicto de pertenencia de clinica.';
    END IF;

    v_normalized_role := pg_catalog.lower(pg_catalog.trim(COALESCE(v_profile.role, '')));
    IF v_normalized_role NOT IN ('odontologo', 'doctor', 'profesional') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_CLINICAL_ROLE_REQUIRED: Solo profesionales clinicos habilitados pueden redactar notas aclaratorias.';
    END IF;

    v_author_snapshot := jsonb_build_object(
        'author_id', v_user_id,
        'author_name', v_profile.full_name,
        'author_role', v_normalized_role,
        'registro_medico', v_profile.registro_medico,
        'especialidad', v_profile.especialidad
    );

    v_created_at := pg_catalog.clock_timestamp();

    v_addendum_snapshot := jsonb_build_object(
        'evolution_id', p_evolution_id,
        'tenant_id', v_evo.tenant_id,
        'author_id', v_user_id,
        'author_snapshot', v_author_snapshot,
        'comentario', v_clean_comment,
        'created_at', v_created_at
    );

    v_content_hash := pg_catalog.encode(extensions.digest(v_addendum_snapshot::text::bytea, 'sha256'), 'hex');

    INSERT INTO public.evolution_addenda (
        evolution_id,
        tenant_id,
        author_id,
        author_snapshot,
        addendum_snapshot,
        comentario,
        content_hash,
        created_at
    ) VALUES (
        p_evolution_id,
        v_evo.tenant_id,
        v_user_id,
        v_author_snapshot,
        v_addendum_snapshot,
        v_clean_comment,
        v_content_hash,
        v_created_at
    )
    RETURNING id INTO v_addendum_id;

    RETURN jsonb_build_object(
        'success', true,
        'addendum_id', v_addendum_id,
        'evolution_id', p_evolution_id,
        'created_at', v_created_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_evolution_addendum(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_evolution_addendum(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_evolution_addenda_batch(p_evolution_ids UUID[])
RETURNS TABLE (
    id UUID,
    evolution_id UUID,
    author_id UUID,
    author_snapshot JSONB,
    addendum_snapshot JSONB,
    comentario TEXT,
    content_hash TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_profile public.profiles%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED: Sesion requerida.';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'PROFILE_NOT_ACTIVE: Perfil inactivo o inexistente.';
    END IF;

    IF pg_catalog.cardinality(p_evolution_ids) > 100 THEN
        RAISE EXCEPTION 'BATCH_SIZE_EXCEEDED: Se permite consultar un maximo de 100 evoluciones por lote.';
    END IF;

    RETURN QUERY
    SELECT 
        a.id,
        a.evolution_id,
        a.author_id,
        a.author_snapshot,
        a.addendum_snapshot,
        a.comentario,
        a.content_hash,
        a.created_at
    FROM public.evolution_addenda a
    WHERE a.evolution_id = ANY(p_evolution_ids)
      AND a.tenant_id = v_profile.tenant_id
    ORDER BY a.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_evolution_addenda_batch(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evolution_addenda_batch(UUID[]) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 9. FASE 8: MODIFICACIÓN QUIRÚRGICA DE generate_signature_token (PASO 1.2)
-- Único objeto del Paso 1.2 tocado: preserva idéntico todo su cuerpo,
-- agregando en el SELECT: e.status, e.closure_origin y el guard de estado cerrado.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_signature_token(
    p_evolution_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_user_active BOOLEAN;
    v_user_tenant UUID;
    v_evo RECORD;
    v_paciente_doc TEXT;
    v_clean_doc TEXT;
    v_tratamiento_json JSONB;
    v_doctor_name TEXT;
    v_procedure TEXT;
    v_description TEXT;
    v_snapshot JSONB;
    v_doc_hash TEXT;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    SELECT lower(role), activo, tenant_id INTO v_user_role, v_user_active, v_user_tenant
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_active IS NOT TRUE THEN
        RAISE EXCEPTION 'USER_INACTIVE';
    END IF;

    IF v_user_role NOT IN ('admin', 'odontologo', 'doctor', 'profesional', 'recepcionista', 'asistente', 'auxiliar', 'superadmin') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS';
    END IF;

    -- Bloqueo FOR UPDATE con columnas físicas reales de evoluciones (incluyendo status y closure_origin)
    SELECT e.id, e.tenant_id, e.paciente_id, e.fecha, e.tratamiento, e.notas, 
           e.status, e.closure_origin, 
           pr.full_name AS doctor_profile_name
    INTO v_evo
    FROM public.evoluciones e
    LEFT JOIN public.profiles pr ON pr.id = e.profesional_id
    WHERE e.id = p_evolution_id
    FOR UPDATE OF e;

    IF v_evo.id IS NULL THEN
        RAISE EXCEPTION 'EVOLUTION_NOT_FOUND';
    END IF;

    IF v_user_role <> 'superadmin' AND v_user_tenant IS DISTINCT FROM v_evo.tenant_id THEN
        RAISE EXCEPTION 'FORBIDDEN_CROSS_TENANT';
    END IF;

    -- Acoplamiento Paso 1.3: El paciente solo firma evoluciones formalmente cerradas por un profesional
    IF v_evo.status IS DISTINCT FROM 'cerrada' OR v_evo.closure_origin IS DISTINCT FROM 'professional' THEN
        RAISE EXCEPTION 'CANNOT_SIGN_UNQUALIFIED_EVOLUTION: Solo es posible solicitar la firma del paciente en evoluciones formalmente cerradas y certificadas por el profesional tratante.';
    END IF;

    -- Validar paciente y concordancia de tenant_id
    SELECT documento INTO v_paciente_doc
    FROM public.pacientes
    WHERE id = v_evo.paciente_id AND tenant_id = v_evo.tenant_id;

    IF v_paciente_doc IS NULL THEN
        RAISE EXCEPTION 'PATIENT_TENANT_MISMATCH_OR_NOT_FOUND';
    END IF;

    v_clean_doc := pg_catalog.regexp_replace(COALESCE(v_paciente_doc, ''), '\D', '', 'g');
    IF pg_catalog.length(v_clean_doc) < 4 THEN
        RAISE EXCEPTION 'PATIENT_DOCUMENT_REQUIRED';
    END IF;

    UPDATE public.signature_tokens
    SET status = 'revocado', updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE evolution_id = p_evolution_id AND status = 'pendiente';

    -- Parseo seguro de tratamiento TEXT -> JSONB
    BEGIN
        IF v_evo.tratamiento IS NOT NULL AND v_evo.tratamiento LIKE '{%' THEN
            v_tratamiento_json := v_evo.tratamiento::jsonb;
        ELSE
            v_tratamiento_json := '{}'::jsonb;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_tratamiento_json := '{}'::jsonb;
    END;

    v_doctor_name := COALESCE(
        v_tratamiento_json->>'profesional',
        v_evo.doctor_profile_name,
        'Profesional Tratante'
    );
    v_procedure := COALESCE(
        v_tratamiento_json->>'treatment',
        v_tratamiento_json->>'procedimiento',
        'Procedimiento Clínico Odontológico'
    );
    v_description := COALESCE(
        v_tratamiento_json->>'description',
        v_tratamiento_json->>'comentario',
        v_evo.notas,
        'Sin descripción'
    );

    v_snapshot := pg_catalog.jsonb_build_object(
        'fecha', v_evo.fecha,
        'doctor_name', v_doctor_name,
        'procedure', v_procedure,
        'description', v_description,
        'snapshot_version', 1
    );

    v_doc_hash := pg_catalog.encode(extensions.digest(v_snapshot::text::bytea, 'sha256'), 'hex');

    v_raw_token := pg_catalog.encode(extensions.gen_random_bytes(24), 'hex');
    v_token_hash := pg_catalog.encode(extensions.digest(v_raw_token::bytea, 'sha256'), 'hex');
    v_expires_at := pg_catalog.timezone('utc'::text, pg_catalog.now()) + interval '24 hours';

    INSERT INTO public.signature_tokens (
        tenant_id,
        patient_id,
        evolution_id,
        token_hash,
        status,
        expires_at,
        document_snapshot,
        document_hash,
        created_by
    ) VALUES (
        v_evo.tenant_id,
        v_evo.paciente_id,
        v_evo.id,
        v_token_hash,
        'pendiente',
        v_expires_at,
        v_snapshot,
        v_doc_hash,
        v_user_id
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'raw_token', v_raw_token,
        'expires_at', v_expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_signature_token(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_signature_token(UUID) TO authenticated, service_role;

COMMIT;
