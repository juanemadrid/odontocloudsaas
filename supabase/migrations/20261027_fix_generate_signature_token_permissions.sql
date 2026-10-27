-- ==============================================================================
-- MIGRACIÓN DEFINITIVA Y EXACTA: CORRECCIÓN QUIRÚRGICA DE COLUMNAS REALES
-- Destino: Servicio 2 OdontoCloud (Coolify, VPS 150.136.210.37). NO toca Edunexus.
-- ==============================================================================

BEGIN;

-- 1. Helper público para obtener logo y nombre de la clínica en la pantalla de verificación
CREATE OR REPLACE FUNCTION public.get_signature_clinic_info(
    p_raw_token TEXT
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
BEGIN
    v_clean_token := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_raw_token, '')));
    IF v_clean_token IS NULL OR NOT (v_clean_token ~ '^[0-9a-f]{48}$') THEN
        RETURN pg_catalog.jsonb_build_object('success', false);
    END IF;

    v_token_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_clean_token, 'UTF8'), 'sha256'), 'hex');

    SELECT 
        COALESCE(t.nombre, 'OdontoCloud') AS clinic_name,
        COALESCE(t.logo_url, '') AS logo_url,
        COALESCE(t.nit, '') AS nit,
        COALESCE(t.direccion, '') AS direccion,
        COALESCE(t.telefono, '') AS telefono
    INTO v_record
    FROM public.signature_tokens st
    JOIN public.tenants t ON t.id = st.tenant_id
    WHERE st.token_hash = v_token_hash
    LIMIT 1;

    IF v_record.clinic_name IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('success', false);
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'clinic_name', v_record.clinic_name,
        'logo_url', v_record.logo_url,
        'nit', v_record.nit,
        'direccion', v_record.direccion,
        'telefono', v_record.telefono
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_signature_clinic_info(TEXT) TO anon, authenticated, service_role;

-- 2. Verify signature token enriquecido usando ÚNICAMENTE columnas reales comprobadas
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
    v_full_name TEXT;
    v_clinic_info JSONB;
    v_doctor_info JSONB;
    v_patient_info JSONB;
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

    SELECT st.*, 
           p.documento, p.nombres, p.apellidos,
           t.nombre AS tenant_nombre,
           t.logo_url AS tenant_logo_url,
           t.nit AS tenant_nit, 
           t.direccion AS tenant_direccion, 
           t.telefono AS tenant_telefono,
           dr.full_name AS doctor_name, 
           dr.firma AS doctor_signature,
           dr.registro_medico AS doctor_reg, 
           dr.especialidad AS doctor_esp
    INTO v_record
    FROM public.signature_tokens st
    LEFT JOIN public.pacientes p ON p.id = st.patient_id
    LEFT JOIN public.tenants t ON t.id = st.tenant_id
    LEFT JOIN public.evoluciones e ON e.id = st.evolution_id
    LEFT JOIN public.profiles dr ON dr.id = e.profesional_id
    WHERE st.token_hash = v_token_hash;

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

    v_first_name := pg_catalog.split_part(pg_catalog.btrim(COALESCE(v_record.nombres, 'Estimado Paciente')), ' ', 1);
    v_full_name := pg_catalog.btrim(COALESCE(v_record.nombres, '') || ' ' || COALESCE(v_record.apellidos, ''));
    IF pg_catalog.length(v_full_name) = 0 THEN
        v_full_name := 'Estimado Paciente';
    END IF;

    v_clinic_info := pg_catalog.jsonb_build_object(
        'name', COALESCE(v_record.tenant_nombre, 'Clínica Odontológica'),
        'logo', COALESCE(v_record.tenant_logo_url, ''),
        'nit', COALESCE(v_record.tenant_nit, ''),
        'address', COALESCE(v_record.tenant_direccion, ''),
        'phone', COALESCE(v_record.tenant_telefono, '')
    );

    v_patient_info := pg_catalog.jsonb_build_object(
        'name', v_full_name,
        'documento', COALESCE(v_record.documento, '')
    );

    v_doctor_info := pg_catalog.jsonb_build_object(
        'name', COALESCE(v_record.doctor_name, 'Profesional Tratante'),
        'signature', COALESCE(v_record.doctor_signature, ''),
        'reg_medico', CASE WHEN v_record.doctor_reg ~* '[0-9a-f]{8}-[0-9a-f]{4}' THEN '' ELSE COALESCE(v_record.doctor_reg, '') END,
        'especialidad', CASE WHEN v_record.doctor_esp ~* '[0-9a-f]{8}-[0-9a-f]{4}' THEN 'Odontología General' ELSE COALESCE(v_record.doctor_esp, 'Odontología General') END
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'patient_first_name', v_first_name,
        'document_snapshot', v_record.document_snapshot,
        'document_hash', v_record.document_hash,
        'expires_at', v_record.expires_at,
        'clinic_info', v_clinic_info,
        'patient_info', v_patient_info,
        'doctor_info', v_doctor_info
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_signature_token(TEXT, TEXT) TO anon, authenticated, service_role;

-- 3. Submit digital signature limpio y robusto (solo actualiza signature_data en signature_tokens)
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
    v_now TIMESTAMPTZ;
BEGIN
    v_clean_token := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_raw_token, '')));

    IF v_clean_token IS NULL OR NOT (v_clean_token ~ '^[0-9a-f]{48}$') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_TOKEN');
    END IF;

    IF p_signature_base64 IS NULL OR pg_catalog.length(p_signature_base64) > 300000 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'PAYLOAD_TOO_LARGE');
    END IF;

    IF NOT (p_signature_base64 LIKE 'data:image/png;base64,%') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_IMAGE_FORMAT');
    END IF;

    v_input_last4 := pg_catalog.regexp_replace(COALESCE(p_last4, ''), '\D', '', 'g');
    IF pg_catalog.length(v_input_last4) <> 4 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_LAST4_FORMAT');
    END IF;

    v_token_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_clean_token, 'UTF8'), 'sha256'), 'hex');

    SELECT st.*, p.documento
    INTO v_record
    FROM public.signature_tokens st
    LEFT JOIN public.pacientes p ON p.id = st.patient_id
    WHERE st.token_hash = v_token_hash;

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

    -- Guardar la firma de forma limpia en signature_data
    UPDATE public.signature_tokens
    SET status = 'firmado',
        signature_data = p_signature_base64,
        signed_at = v_now,
        updated_at = v_now
    WHERE id = v_record.id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'signed_at', v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_digital_signature(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

UPDATE public.signature_tokens 
SET attempts = 0 
WHERE status = 'pendiente';

COMMIT;

NOTIFY pgrst, 'reload schema';
