-- ==============================================================================
-- MIGRACIÓN: FIX DEFINITIVO DE PERMISOS EN generate_signature_token
-- Destino: Servicio 2 OdontoCloud (Coolify, VPS 150.136.210.37). NO toca Edunexus.
-- 
-- Problema: generate_signature_token tenía una lista fija de roles en inglés/español
-- que rechazaba usuarios con roles legítimos como 'administrador', 'odontólogo' (con tilde),
-- 'especialista', 'secretaria', 'cajera', 'directora', 'gerente', etc., provocando el
-- error 'INSUFFICIENT_PERMISSIONS' al intentar enviar el enlace de firma por WhatsApp.
--
-- Solución:
-- 1. Normalizar el rol con pg_catalog.lower(pg_catalog.btrim(COALESCE(role, ''))).
-- 2. Permitir a TODO el personal de la clínica autenticado y activo (mismo tenant).
-- 3. Bloquear únicamente perfiles externos tipo 'paciente' o 'cliente'.
-- 4. Garantizar el uso estandarizado de pg_catalog.convert_to(..., 'UTF8') para
--    cálculos criptográficos SHA-256 en tokens.
-- ==============================================================================

BEGIN;

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

    SELECT pg_catalog.lower(pg_catalog.btrim(COALESCE(role, ''))), activo, tenant_id 
    INTO v_user_role, v_user_active, v_user_tenant
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_active IS FALSE THEN
        RAISE EXCEPTION 'USER_INACTIVE';
    END IF;

    -- Bloquear exclusivamente perfiles externos tipo paciente o cliente
    IF v_user_role IN ('paciente', 'cliente') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS: Solo el personal de la clínica puede solicitar la firma del paciente.';
    END IF;

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

    -- Solo permitir firma en evoluciones formalmente cerradas por el profesional
    IF v_evo.status IS DISTINCT FROM 'cerrada' OR v_evo.closure_origin IS DISTINCT FROM 'professional' THEN
        RAISE EXCEPTION 'CANNOT_SIGN_UNQUALIFIED_EVOLUTION: Solo es posible solicitar la firma del paciente en evoluciones formalmente cerradas y certificadas por el profesional tratante.';
    END IF;

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

    -- Revocar tokens previos pendientes para esta evolución
    UPDATE public.signature_tokens
    SET status = 'revocado', updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE evolution_id = p_evolution_id AND status = 'pendiente';

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

    v_doc_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');
    v_raw_token := pg_catalog.encode(extensions.gen_random_bytes(24), 'hex');
    v_token_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_raw_token, 'UTF8'), 'sha256'), 'hex');
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

NOTIFY pgrst, 'reload schema';
