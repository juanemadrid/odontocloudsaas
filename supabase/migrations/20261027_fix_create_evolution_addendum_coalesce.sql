-- ============================================================================
-- FIX CRÍTICO: CORREGIR pg_catalog.coalesce EN create_evolution_addendum
-- En PostgreSQL, COALESCE es una construcción de lenguaje SQL (palabra clave),
-- no una función residente en pg_catalog. La invocación como 'pg_catalog.coalesce'
-- genera el error: 'function pg_catalog.coalesce(text, unknown) does not exist'.
-- ============================================================================

BEGIN;

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

    -- Usar COALESCE estándar de PostgreSQL (sin prefijo de esquema)
    v_clean_comment := pg_catalog.btrim(COALESCE(p_comentario, ''));
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

    v_author_snapshot := pg_catalog.jsonb_build_object(
        'author_id', v_user_id,
        'author_name', v_profile.full_name,
        'author_role', COALESCE(NULLIF(v_normalized_role, ''), 'odontologo'),
        'registro_medico', v_profile.registro_medico,
        'especialidad', v_profile.especialidad
    );

    v_created_at := pg_catalog.clock_timestamp();

    v_addendum_snapshot := pg_catalog.jsonb_build_object(
        'evolution_id', p_evolution_id,
        'tenant_id', v_evo.tenant_id,
        'author_id', v_user_id,
        'author_snapshot', v_author_snapshot,
        'comentario', v_clean_comment,
        'created_at', v_created_at
    );

    v_content_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_addendum_snapshot::text, 'UTF8'), 'sha256'), 'hex');

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

    RETURN pg_catalog.jsonb_build_object(
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
