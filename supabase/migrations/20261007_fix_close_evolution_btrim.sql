-- ============================================================================
-- FIX DEFINITIVO Y QUIRÚRGICO DE ROLES Y FIRMA EN close_evolution
-- 1. Permite cualquier rol clínico/médico o administrador asignado a la evolución.
-- 2. Solo bloquea roles no clínicos (recepción, auxiliar, secretaría, caja).
-- 3. btrim nativo de pg_catalog asegurado.
-- ============================================================================

BEGIN;

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
    v_signature TEXT;
    v_snapshot JSONB;
    v_hash TEXT;
    v_sig_snapshot JSONB;
    v_normalized_role TEXT;
    v_closed_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED: Sesión requerida para certificar la evolución.';
    END IF;

    SELECT * INTO v_evo
    FROM public.evoluciones
    WHERE id = p_evolution_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'EVOLUTION_NOT_FOUND: Evolución no encontrada.';
    END IF;

    IF v_evo.status = 'cerrada' THEN
        RAISE EXCEPTION 'EVOLUTION_ALREADY_CLOSED: La evolución ya se encuentra cerrada.';
    END IF;

    IF v_evo.status <> 'borrador' THEN
        RAISE EXCEPTION 'INVALID_EVOLUTION_STATUS: Solo es posible cerrar evoluciones en estado borrador.';
    END IF;

    IF v_evo.profesional_id IS NULL THEN
        RAISE EXCEPTION 'PROFESSIONAL_REQUIRED_FOR_CLOSURE: La evolución debe tener un profesional tratante asignado.';
    END IF;

    -- Validar que el usuario sea el profesional tratante asignado
    IF v_evo.profesional_id <> v_user_id THEN
        RAISE EXCEPTION 'ONLY_TREATING_DOCTOR_CAN_CLOSE: Solo el profesional tratante asignado puede certificar y cerrar esta evolución.';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'PROFILE_NOT_ACTIVE: El perfil del profesional tratante no se encuentra activo.';
    END IF;

    IF v_profile.tenant_id <> v_evo.tenant_id THEN
        RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Conflicto de pertenencia de clínica.';
    END IF;

    v_normalized_role := pg_catalog.lower(pg_catalog.btrim(COALESCE(v_profile.role, '')));
    
    -- Solo bloquear perfiles estrictamente no clínicos
    IF v_normalized_role IN ('recepcionista', 'recepcion', 'auxiliar', 'secretaria', 'secretario', 'cajero', 'cajera') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_CLINICAL_ROLE_REQUIRED: Se requiere un rol clínico habilitado para certificar evoluciones.';
    END IF;

    -- Resolución inteligente de la firma digital:
    -- 1) Intentar desde profiles.firma
    v_signature := v_profile.firma;

    -- 2) Si no está en profiles, consultar en website_config -> user_details -> user_id
    IF v_signature IS NULL OR pg_catalog.length(pg_catalog.btrim(v_signature)) = 0 THEN
        SELECT COALESCE(
            wc.config -> 'user_details' -> (v_user_id::text) ->> 'firma',
            wc.config -> 'user_details' -> (v_user_id::text) ->> 'firmaElectronica',
            wc.config -> 'user_details' -> (v_user_id::text) ->> 'firma_url'
        ) INTO v_signature
        FROM public.website_config wc
        WHERE wc.tenant_id = v_profile.tenant_id
        LIMIT 1;

        -- Sincronizar en profiles.firma para alta eficiencia en consultas posteriores
        IF v_signature IS NOT NULL AND pg_catalog.length(pg_catalog.btrim(v_signature)) > 0 THEN
            UPDATE public.profiles
            SET firma = v_signature
            WHERE id = v_user_id;
        END IF;
    END IF;

    -- Validar presencia de firma digital
    IF v_signature IS NULL OR pg_catalog.length(pg_catalog.btrim(v_signature)) = 0 THEN
        RAISE EXCEPTION 'DOCTOR_SIGNATURE_REQUIRED: El profesional debe registrar su firma en su perfil antes de cerrar la evolución.';
    END IF;

    v_closed_at := pg_catalog.clock_timestamp();
    v_snapshot := public.build_evolution_clinical_snapshot(v_evo);
    v_hash := pg_catalog.encode(extensions.digest(v_snapshot::text::bytea, 'sha256'), 'hex');

    v_sig_snapshot := jsonb_build_object(
        'signature_image', v_signature,
        'signer_id', v_user_id,
        'signer_name', v_profile.full_name,
        'signer_role', COALESCE(NULLIF(v_normalized_role, ''), 'odontologo'),
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
        RAISE EXCEPTION 'NOT_AUTHENTICATED: Sesión requerida para registrar una nota aclaratoria.';
    END IF;

    v_clean_comment := pg_catalog.btrim(pg_catalog.coalesce(p_comentario, ''));
    IF pg_catalog.length(v_clean_comment) < 5 OR pg_catalog.length(v_clean_comment) > 5000 THEN
        RAISE EXCEPTION 'INVALID_ADDENDUM_LENGTH: La nota aclaratoria debe contener entre 5 y 5000 caracteres.';
    END IF;

    SELECT * INTO v_evo FROM public.evoluciones WHERE id = p_evolution_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'EVOLUTION_NOT_FOUND: Evolución no encontrada.';
    END IF;

    IF v_evo.status IS DISTINCT FROM 'cerrada' THEN
        RAISE EXCEPTION 'CANNOT_ADD_ADDENDUM_TO_NON_CLOSED: Solo es posible redactar notas aclaratorias sobre evoluciones formalmente cerradas.';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'PROFILE_NOT_ACTIVE: El perfil del autor no se encuentra activo.';
    END IF;

    IF v_profile.tenant_id <> v_evo.tenant_id THEN
        RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Conflicto de pertenencia de clínica.';
    END IF;

    v_normalized_role := pg_catalog.lower(pg_catalog.btrim(COALESCE(v_profile.role, '')));
    IF v_normalized_role IN ('recepcionista', 'recepcion', 'auxiliar', 'secretaria', 'secretario', 'cajero', 'cajera') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_CLINICAL_ROLE_REQUIRED: Solo profesionales clínicos habilitados pueden redactar notas aclaratorias.';
    END IF;

    v_author_snapshot := jsonb_build_object(
        'author_id', v_user_id,
        'author_name', v_profile.full_name,
        'author_role', COALESCE(NULLIF(v_normalized_role, ''), 'odontologo'),
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

COMMIT;

NOTIFY pgrst, 'reload schema';
