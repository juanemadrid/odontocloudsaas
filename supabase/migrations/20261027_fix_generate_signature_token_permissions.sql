-- ==============================================================================
-- MIGRACIÓN: FIX DEFINITIVO DE PERMISOS Y VERIFICACIÓN EN FIRMA DIGITAL
-- Destino: Servicio 2 OdontoCloud (Coolify, VPS 150.136.210.37). NO toca Edunexus.
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

    -- Solo bloquear perfiles externos tipo paciente o cliente
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

-- Asegurar verify_signature_token resiliente
CREATE OR REPLACE FUNCTION public.verify_signature_token(
    p_raw_token TEXT,
    p_last4 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_token TEXT;
    v_token_hash TEXT;
    v_record RECORD;
    v_doc_num TEXT;
    v_actual_last4 TEXT;
    v_input_last4 TEXT;
    v_first_name TEXT;
BEGIN
    v_clean_token := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_raw_token, '')));

    IF v_clean_token IS NULL OR NOT (v_clean_token ~ '^[0-9a-f]{48}$') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_TOKEN');
    END IF;

    v_input_last4 := pg_catalog.regexp_replace(COALESCE(p_last4, ''), '\D', '', 'g');
    IF pg_catalog.length(v_input_last4) <> 4 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_LAST4_FORMAT');
    END IF;

    v_token_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_clean_token, 'UTF8'), 'sha256'), 'hex');

    SELECT st.*, p.documento, p.nombres
    INTO v_record
    FROM public.signature_tokens st
    LEFT JOIN public.pacientes p ON p.id = st.patient_id
    WHERE st.token_hash = v_token_hash
       OR st.token_hash = pg_catalog.encode(extensions.digest(v_clean_token::bytea, 'sha256'), 'hex')
    FOR UPDATE OF st;

    IF v_record.id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_NOT_FOUND');
    END IF;

    IF v_record.status = 'bloqueado' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_BLOCKED');
    END IF;

    IF v_record.status = 'firmado' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'ALREADY_SIGNED', 'signed_at', v_record.signed_at);
    END IF;

    IF v_record.status <> 'pendiente' OR v_record.expires_at < pg_catalog.timezone('utc'::text, pg_catalog.now()) THEN
        IF v_record.status = 'pendiente' THEN
            UPDATE public.signature_tokens 
            SET status = 'expirado', updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now()) 
            WHERE id = v_record.id;
        END IF;
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_EXPIRED_OR_REVOKED');
    END IF;

    v_doc_num := pg_catalog.regexp_replace(COALESCE(v_record.documento, ''), '\D', '', 'g');
    IF pg_catalog.length(v_doc_num) >= 4 THEN
        v_actual_last4 := pg_catalog.right(v_doc_num, 4);
    ELSE
        v_actual_last4 := pg_catalog.lpad(v_doc_num, 4, '0');
    END IF;

    IF v_input_last4 <> v_actual_last4 THEN
        UPDATE public.signature_tokens
        SET attempts = attempts + 1,
            status = CASE WHEN attempts + 1 >= max_attempts THEN 'bloqueado' ELSE status END,
            updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
        WHERE id = v_record.id;

        IF v_record.attempts + 1 >= v_record.max_attempts THEN
            RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_BLOCKED');
        ELSE
            RETURN pg_catalog.jsonb_build_object(
                'success', false, 
                'error', 'AUTH_FAILED', 
                'remaining_attempts', v_record.max_attempts - (v_record.attempts + 1)
            );
        END IF;
    END IF;

    v_first_name := pg_catalog.split_part(pg_catalog.trim(COALESCE(v_record.nombres, 'Estimado Paciente')), ' ', 1);

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'patient_first_name', v_first_name,
        'document_snapshot', v_record.document_snapshot,
        'document_hash', v_record.document_hash,
        'expires_at', v_record.expires_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_signature_token(TEXT, TEXT) TO anon, authenticated, service_role;

-- Asegurar submit_digital_signature resiliente
CREATE OR REPLACE FUNCTION public.submit_digital_signature(
    p_raw_token TEXT,
    p_last4 TEXT,
    p_signature_base64 TEXT,
    p_device_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_token TEXT;
    v_token_hash TEXT;
    v_record RECORD;
    v_doc_num TEXT;
    v_actual_last4 TEXT;
    v_input_last4 TEXT;
    v_raw_base64 TEXT;
    v_decoded_bytes BYTEA;
    v_decoded_len INT;
    v_now TIMESTAMPTZ;
BEGIN
    v_clean_token := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_raw_token, '')));

    IF v_clean_token IS NULL OR NOT (v_clean_token ~ '^[0-9a-f]{48}$') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_TOKEN');
    END IF;

    IF p_signature_base64 IS NULL OR pg_catalog.length(p_signature_base64) > 200000 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'PAYLOAD_TOO_LARGE');
    END IF;

    IF NOT (p_signature_base64 LIKE 'data:image/png;base64,%') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_IMAGE_FORMAT');
    END IF;

    v_input_last4 := pg_catalog.regexp_replace(COALESCE(p_last4, ''), '\D', '', 'g');
    IF pg_catalog.length(v_input_last4) <> 4 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_LAST4_FORMAT');
    END IF;

    BEGIN
        v_raw_base64 := pg_catalog.split_part(p_signature_base64, ',', 2);
        v_decoded_bytes := pg_catalog.decode(v_raw_base64, 'base64');
        v_decoded_len := pg_catalog.octet_length(v_decoded_bytes);

        IF v_decoded_len < 200 OR v_decoded_len > 150000 THEN
            RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'CORRUPTED_OR_EMPTY_IMAGE');
        END IF;

        IF pg_catalog.substring(v_decoded_bytes, 1, 8) <> '\x89504e470d0a1a0a'::bytea THEN
            RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_PNG_MAGIC_BYTES');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_BASE64_DATA');
    END;

    v_token_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_clean_token, 'UTF8'), 'sha256'), 'hex');

    SELECT st.*, p.documento
    INTO v_record
    FROM public.signature_tokens st
    LEFT JOIN public.pacientes p ON p.id = st.patient_id
    WHERE st.token_hash = v_token_hash
       OR st.token_hash = pg_catalog.encode(extensions.digest(v_clean_token::bytea, 'sha256'), 'hex')
    FOR UPDATE OF st;

    IF v_record.id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_NOT_FOUND');
    END IF;

    IF v_record.status = 'bloqueado' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_BLOCKED');
    END IF;

    IF v_record.status = 'firmado' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'ALREADY_SIGNED');
    END IF;

    IF v_record.status <> 'pendiente' OR v_record.expires_at < pg_catalog.timezone('utc'::text, pg_catalog.now()) THEN
        IF v_record.status = 'pendiente' THEN
            UPDATE public.signature_tokens 
            SET status = 'expirado', updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now()) 
            WHERE id = v_record.id;
        END IF;
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_EXPIRED_OR_REVOKED');
    END IF;

    v_doc_num := pg_catalog.regexp_replace(COALESCE(v_record.documento, ''), '\D', '', 'g');
    IF pg_catalog.length(v_doc_num) >= 4 THEN
        v_actual_last4 := pg_catalog.right(v_doc_num, 4);
    ELSE
        v_actual_last4 := pg_catalog.lpad(v_doc_num, 4, '0');
    END IF;

    IF v_input_last4 <> v_actual_last4 THEN
        UPDATE public.signature_tokens
        SET attempts = attempts + 1,
            status = CASE WHEN attempts + 1 >= max_attempts THEN 'bloqueado' ELSE status END,
            updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
        WHERE id = v_record.id;

        IF v_record.attempts + 1 >= v_record.max_attempts THEN
            RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_BLOCKED');
        ELSE
            RETURN pg_catalog.jsonb_build_object(
                'success', false, 
                'error', 'AUTH_FAILED', 
                'remaining_attempts', v_record.max_attempts - (v_record.attempts + 1)
            );
        END IF;
    END IF;

    v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

    UPDATE public.signature_tokens
    SET status = 'firmado',
        signed_at = v_now,
        signature_base64 = p_signature_base64,
        device_metadata = COALESCE(p_device_metadata, '{}'::jsonb),
        updated_at = v_now
    WHERE id = v_record.id;

    UPDATE public.evoluciones
    SET patient_signature = p_signature_base64,
        patient_signed_at = v_now,
        updated_at = v_now
    WHERE id = v_record.evolution_id AND tenant_id = v_record.tenant_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'signed_at', v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_digital_signature(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
