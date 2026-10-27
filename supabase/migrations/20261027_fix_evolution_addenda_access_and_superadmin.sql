-- ============================================================================
-- FIX DEFINITIVO: ACCESO, VISUALIZACIÓN Y COMPATIBILIDAD SUPERADMIN EN NOTAS ACLARATORIAS (ADENDAS)
-- 1. Permite a usuarios de la clínica y superadmin consultar las adendas en get_evolution_addenda_batch.
-- 2. Habilita política RLS SELECT en evolution_addenda para respaldo directo.
-- 3. Asegura permisos GRANT EXECUTE a roles authenticated y service_role.
-- 4. Exime a superadmin de CROSS_TENANT_VIOLATION en create_evolution_addendum.
-- ============================================================================

BEGIN;

-- 1. REPARAR RPC get_evolution_addenda_batch
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
    v_is_superadmin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED: Sesión requerida.';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND OR v_profile.activo IS NOT TRUE THEN
        RAISE EXCEPTION 'PROFILE_NOT_ACTIVE: Perfil inactivo o inexistente.';
    END IF;

    v_is_superadmin := (lower(COALESCE(v_profile.role, '')) = 'superadmin');

    IF COALESCE(pg_catalog.cardinality(p_evolution_ids), 0) > 100 THEN
        RAISE EXCEPTION 'BATCH_SIZE_EXCEEDED: Se permite consultar un máximo de 100 evoluciones por lote.';
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
      AND (v_is_superadmin OR a.tenant_id = v_profile.tenant_id)
    ORDER BY a.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_evolution_addenda_batch(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evolution_addenda_batch(UUID[]) TO authenticated, service_role;

-- 2. REPARAR RPC create_evolution_addendum CON SOPORTE SUPERADMIN Y COALESCE NATIVO
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
    v_is_superadmin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED: Sesión requerida para registrar una nota aclaratoria.';
    END IF;

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

    v_normalized_role := pg_catalog.lower(pg_catalog.btrim(COALESCE(v_profile.role, '')));
    v_is_superadmin := (v_normalized_role = 'superadmin');

    -- Validar pertenencia de clínica salvo para superadmin
    IF NOT v_is_superadmin AND v_profile.tenant_id <> v_evo.tenant_id THEN
        RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Conflicto de pertenencia de clínica.';
    END IF;

    IF NOT v_is_superadmin AND v_normalized_role IN ('recepcionista', 'recepcion', 'auxiliar', 'secretaria', 'secretario', 'cajero', 'cajera') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_CLINICAL_ROLE_REQUIRED: Solo profesionales clínicos habilitados pueden redactar notas aclaratorias.';
    END IF;

    v_author_snapshot := pg_catalog.jsonb_build_object(
        'author_id', v_user_id,
        'author_name', COALESCE(v_profile.full_name, 'Profesional'),
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

-- 3. PERMISOS Y POLÍTICA RLS PARA LECTURA DIRECTA DE evolution_addenda
GRANT SELECT ON TABLE public.evolution_addenda TO authenticated, service_role;

DROP POLICY IF EXISTS evolution_addenda_select_policy ON public.evolution_addenda;
CREATE POLICY evolution_addenda_select_policy ON public.evolution_addenda
FOR SELECT TO authenticated
USING (
    tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.activo IS TRUE
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.activo IS TRUE AND lower(COALESCE(p.role, '')) = 'superadmin'
    )
);

COMMIT;
