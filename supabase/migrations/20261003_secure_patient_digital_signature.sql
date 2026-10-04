-- ============================================================================
-- MIGRACIÓN AISLADA PASO 1.2: FIRMA DIGITAL REMOTA DEL PACIENTE
-- Archivo: supabase/migrations/20261003_secure_patient_digital_signature.sql
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- 1. TABLA DE TOKENS Y EVIDENCIAS DE FIRMA (Limpia sin IF NOT EXISTS)
CREATE TABLE public.signature_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    evolution_id UUID NOT NULL REFERENCES public.evoluciones(id) ON DELETE RESTRICT,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pendiente' 
        CHECK (status IN ('pendiente', 'firmado', 'expirado', 'revocado', 'bloqueado')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    document_snapshot JSONB NOT NULL,
    document_hash TEXT NOT NULL,
    signature_data TEXT,
    signed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now())
);

-- 2. ÍNDICES DE ALTO RENDIMIENTO (Sin redundancia sobre token_hash ya cubierto por UNIQUE)
CREATE INDEX idx_signature_tokens_evolution_id ON public.signature_tokens(evolution_id);
CREATE INDEX idx_signature_tokens_tenant_id ON public.signature_tokens(tenant_id);

-- Índice parcial: Garantiza una única solicitud activa (pendiente) por evolución clínica
CREATE UNIQUE INDEX uq_signature_tokens_pending_evolution 
ON public.signature_tokens(evolution_id) 
WHERE status = 'pendiente';

-- 3. POLÍTICA DE PRIVILEGIOS Y RLS: MÍNIMO PRIVILEGIO ESTRICTO ABSOLUTO
REVOKE ALL ON TABLE public.signature_tokens FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.signature_tokens ENABLE ROW LEVEL SECURITY;

-- 4. TRIGGER: INMUTABILIDAD ESTRICTA Y BLINDAJE DE TRANSICIÓN (CREATE FUNCTION puro)
CREATE FUNCTION public.protect_signed_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Prohibición absoluta de borrado de evidencias selladas
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'firmado' THEN
            RAISE EXCEPTION 'CANNOT_DELETE_SIGNED_EVIDENCE: Las evidencias de firma clinica son inmutables.';
        END IF;
        RETURN OLD;
    END IF;

    -- Prohibición absoluta de modificación de registros ya sellados
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'firmado' THEN
            RAISE EXCEPTION 'CANNOT_MODIFY_SIGNED_EVIDENCE: Registro sellado e inalterable.';
        END IF;
        
        -- Transición a firmado: Solo desde 'pendiente'
        IF NEW.status = 'firmado' THEN
            IF OLD.status <> 'pendiente' THEN
                RAISE EXCEPTION 'INVALID_STATUS_TRANSITION: Solo un token pendiente puede ser firmado.';
            END IF;
            
            -- Blindaje adicional: En la transición a 'firmado', los datos esenciales NO pueden mutar
            IF NEW.id <> OLD.id
               OR NEW.tenant_id <> OLD.tenant_id
               OR NEW.patient_id <> OLD.patient_id
               OR NEW.evolution_id <> OLD.evolution_id
               OR NEW.token_hash <> OLD.token_hash
               OR NEW.document_snapshot <> OLD.document_snapshot
               OR NEW.document_hash <> OLD.document_hash
               OR NEW.created_by IS DISTINCT FROM OLD.created_by
               OR NEW.created_at <> OLD.created_at
               OR NEW.max_attempts <> OLD.max_attempts
            THEN
                RAISE EXCEPTION 'CANNOT_ALTER_CORE_EVIDENCE_DURING_SIGNING: Los datos esenciales de la evidencia no pueden modificarse durante el sellado.';
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_signed_evidence
BEFORE UPDATE OR DELETE ON public.signature_tokens
FOR EACH ROW EXECUTE FUNCTION public.protect_signed_evidence();


-- 5. RPC 1: GENERAR ENLACE DE FIRMA (CREATE FUNCTION puro - VERSIÓN PURA PASO 1.2)
CREATE FUNCTION public.generate_signature_token(
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

    -- Bloqueo FOR UPDATE con columnas físicas reales del Paso 1.2 (sin acoplamiento con Paso 1.3)
    SELECT e.id, e.tenant_id, e.paciente_id, e.fecha, e.tratamiento, e.notas, 
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

    -- Validar paciente y concordancia estricta de tenant_id
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

    -- Revocar únicamente token pendiente anterior (los firmados jamás se tocan)
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

    -- Snapshot clínico del documento a firmar (NO incluye documento completo, teléfono ni email)
    v_snapshot := pg_catalog.jsonb_build_object(
        'fecha', v_evo.fecha,
        'doctor_name', v_doctor_name,
        'procedure', v_procedure,
        'description', v_description,
        'snapshot_version', 1
    );

    v_doc_hash := pg_catalog.encode(extensions.digest(v_snapshot::text::bytea, 'sha256'), 'hex');

    -- Generación criptográfica: 192 bits (24 bytes) = 48 caracteres hexadecimales
    v_raw_token := pg_catalog.encode(extensions.gen_random_bytes(24), 'hex');
    v_token_hash := pg_catalog.encode(extensions.digest(v_raw_token::bytea, 'sha256'), 'hex');
    v_expires_at := pg_catalog.timezone('utc'::text, pg_catalog.now()) + interval '24 hours';

    -- Se almacena EXCLUSIVAMENTE el hash (nunca el token en claro)
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

    -- Retorna el token en claro únicamente en esta respuesta al solicitante autorizado
    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'raw_token', v_raw_token,
        'expires_at', v_expires_at
    );
END;
$$;


-- 6. RPC 2: VERIFICAR TOKEN PÚBLICO (CREATE FUNCTION puro - ACCESO POR ANON)
CREATE FUNCTION public.verify_signature_token(
    p_raw_token TEXT,
    p_last4 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_hash TEXT;
    v_record RECORD;
    v_doc_num TEXT;
    v_actual_last4 TEXT;
    v_input_last4 TEXT;
    v_first_name TEXT;
BEGIN
    -- Validación estricta de formato del token: exactamente 48 caracteres hexadecimales
    IF p_raw_token IS NULL OR NOT (p_raw_token ~ '^[0-9a-fA-F]{48}$') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_TOKEN');
    END IF;

    -- Normalización y validación estricta de 4 dígitos
    v_input_last4 := pg_catalog.regexp_replace(COALESCE(p_last4, ''), '\D', '', 'g');
    IF pg_catalog.length(v_input_last4) <> 4 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_LAST4_FORMAT');
    END IF;

    v_token_hash := pg_catalog.encode(extensions.digest(p_raw_token::bytea, 'sha256'), 'hex');

    -- Join defensivo validando integridad tenant_id
    SELECT st.*, p.documento, p.nombres
    INTO v_record
    FROM public.signature_tokens st
    JOIN public.pacientes p ON p.id = st.patient_id AND p.tenant_id = st.tenant_id
    WHERE st.token_hash = v_token_hash
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

    -- Extraer últimos 4 dígitos reales del paciente
    v_doc_num := pg_catalog.regexp_replace(COALESCE(v_record.documento, ''), '\D', '', 'g');
    IF pg_catalog.length(v_doc_num) >= 4 THEN
        v_actual_last4 := pg_catalog.substring(v_doc_num from pg_catalog.length(v_doc_num) - 3 for 4);
    ELSE
        v_actual_last4 := pg_catalog.lpad(v_doc_num, 4, '0');
    END IF;

    -- Verificación del challenge
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

    -- Solo devuelve el primer nombre (privacidad del paciente)
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


-- 7. RPC 3: REGISTRAR FIRMA DIGITAL (CREATE FUNCTION puro - EXACTAMENTE 3 PARÁMETROS)
CREATE FUNCTION public.submit_digital_signature(
    p_raw_token TEXT,
    p_last4 TEXT,
    p_signature_base64 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
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
    -- 1. Validación estricta del token: exactamente 48 caracteres hexadecimales
    IF p_raw_token IS NULL OR NOT (p_raw_token ~ '^[0-9a-fA-F]{48}$') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_TOKEN');
    END IF;

    -- 2. Validación estricta de tamaño máximo del payload
    IF p_signature_base64 IS NULL OR pg_catalog.length(p_signature_base64) > 200000 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'PAYLOAD_TOO_LARGE');
    END IF;

    -- 3. Prefijo Data URL obligatorio
    IF NOT (p_signature_base64 LIKE 'data:image/png;base64,%') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_IMAGE_FORMAT');
    END IF;

    -- 4. Normalización y validación estricta de 4 dígitos
    v_input_last4 := pg_catalog.regexp_replace(COALESCE(p_last4, ''), '\D', '', 'g');
    IF pg_catalog.length(v_input_last4) <> 4 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_LAST4_FORMAT');
    END IF;

    -- 5. Decodificación Base64, rango de bytes y comprobación de Magic Bytes PNG (\x89504E470D0A1A0A)
    BEGIN
        v_raw_base64 := pg_catalog.split_part(p_signature_base64, ',', 2);
        v_decoded_bytes := pg_catalog.decode(v_raw_base64, 'base64');
        v_decoded_len := pg_catalog.octet_length(v_decoded_bytes);

        IF v_decoded_len < 200 OR v_decoded_len > 150000 THEN
            RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'CORRUPTED_OR_EMPTY_IMAGE');
        END IF;

        IF pg_catalog.substring(v_decoded_bytes from 1 for 8) <> '\x89504e470d0a1a0a'::bytea THEN
            RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_PNG_MAGIC_BYTES');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_BASE64_DATA');
    END;

    v_token_hash := pg_catalog.encode(extensions.digest(p_raw_token::bytea, 'sha256'), 'hex');

    -- 6. Bloqueo FOR UPDATE defensivo validando tenant_id
    SELECT st.*, p.documento
    INTO v_record
    FROM public.signature_tokens st
    JOIN public.pacientes p ON p.id = st.patient_id AND p.tenant_id = st.tenant_id
    WHERE st.token_hash = v_token_hash
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

    -- Consistencia de expiración en submit: Si está pendiente y expirado, actualizar atómicamente a 'expirado'
    IF v_record.status <> 'pendiente' OR v_record.expires_at < pg_catalog.timezone('utc'::text, pg_catalog.now()) THEN
        IF v_record.status = 'pendiente' THEN
            UPDATE public.signature_tokens 
            SET status = 'expirado', updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now()) 
            WHERE id = v_record.id;
        END IF;
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'TOKEN_EXPIRED_OR_REVOKED');
    END IF;

    -- 7. Validación del challenge de 4 dígitos
    v_doc_num := pg_catalog.regexp_replace(COALESCE(v_record.documento, ''), '\D', '', 'g');
    IF pg_catalog.length(v_doc_num) >= 4 THEN
        v_actual_last4 := pg_catalog.substring(v_doc_num from pg_catalog.length(v_doc_num) - 3 for 4);
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

    -- 8. Sellado definitivo atómico con timestamp único
    v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

    UPDATE public.signature_tokens
    SET status = 'firmado',
        signature_data = p_signature_base64,
        signed_at = v_now,
        updated_at = v_now
    WHERE id = v_record.id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'signed_at', v_now,
        'document_hash', v_record.document_hash
    );
END;
$$;


-- 8. RPC 4: CONSULTA POR LOTE PARA EvolutionList (CREATE FUNCTION puro - PERSONAL AUTENTICADO)
CREATE FUNCTION public.get_evolution_signatures_batch(
    p_evolution_ids UUID[]
)
RETURNS TABLE (
    evolution_id UUID,
    status TEXT,
    signed_at TIMESTAMPTZ,
    signature_data TEXT,
    document_hash TEXT,
    document_snapshot JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_user_tenant UUID;
    v_user_active BOOLEAN;
    v_is_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    IF p_evolution_ids IS NULL OR pg_catalog.array_length(p_evolution_ids, 1) > 100 THEN
        RAISE EXCEPTION 'BATCH_LIMIT_EXCEEDED: Máximo 100 registros por consulta.';
    END IF;

    SELECT tenant_id, activo, (lower(role) = 'superadmin')
    INTO v_user_tenant, v_user_active, v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_active IS NOT TRUE OR (v_user_tenant IS NULL AND NOT v_is_admin) THEN
        RAISE EXCEPTION 'FORBIDDEN_USER_CONTEXT';
    END IF;

    RETURN QUERY
    SELECT 
        st.evolution_id,
        st.status,
        st.signed_at,
        st.signature_data,
        st.document_hash,
        st.document_snapshot
    FROM public.signature_tokens st
    WHERE st.evolution_id = ANY(p_evolution_ids)
      AND st.status = 'firmado'
      AND (v_is_admin OR st.tenant_id = v_user_tenant);
END;
$$;


-- 9. GESTIÓN INICIAL DE PERMISOS: INSTALACIÓN CERRADA
-- Durante la instalación los permisos quedan estrictamente revocados.
-- La activación formal mediante GRANT EXECUTE se ejecuta en una transacción separada
-- únicamente DESPUÉS de que la suite de pruebas funcionales pase al 100%.
REVOKE ALL ON FUNCTION public.protect_signed_evidence() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.generate_signature_token(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_signature_token(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_digital_signature(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_evolution_signatures_batch(UUID[]) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
