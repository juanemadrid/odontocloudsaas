#!/usr/bin/env bash
# ==============================================================================
# SCRIPT OFICIAL: INSTALACIÓN CONTROLADA Y VALIDADA DEL PASO 1.2
# Sistema: OdontoCloud (Servicio 2 Coolify)
# Contenedor DB: supabase-db-ueh7xuehxl9thmhre7fpk4xx
# Arquitectura: INSTALACIÓN CERRADA -> PRUEBAS AISLADAS -> ACTIVACIÓN -> VALIDACIÓN DE ROLES
# ==============================================================================
set -euo pipefail

CONTAINER="supabase-db-ueh7xuehxl9thmhre7fpk4xx"
BACKUP_DIR="/data/backups/odontocloud-pre-p12"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pre_p12_backup_${TIMESTAMP}.dump"

echo "=========================================================="
echo " [FASE 1] PREFLIGHT DE SOLO LECTURA (FAIL-CLOSED COMPLETO)"
echo "=========================================================="

docker exec -i "${CONTAINER}" psql -U postgres -d postgres << 'EOF'
\set ON_ERROR_STOP on
\x off

-- 1. Mostrar estado de objetos de catálogo
SELECT 
    'signature_tokens' AS objeto, 
    COALESCE(pg_catalog.to_regclass('public.signature_tokens')::text, 'NO_EXISTE (OK)') AS estado;

SELECT
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'generate_signature_token',
      'verify_signature_token',
      'submit_digital_signature',
      'get_evolution_signatures_batch',
      'protect_signed_evidence'
  );

SELECT 
    n.nspname AS schema_name, 
    p.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_catalog.pg_proc p 
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace 
WHERE p.proname IN ('digest', 'gen_random_bytes')
  AND n.nspname = 'extensions'
ORDER BY p.proname, argumentos;

-- 2. Verificación estricta fail-closed en bloque anónimo
DO $$
DECLARE
    v_tbl regclass;
    v_rpcs INT;
    v_trg INT;
    v_crypto INT;
    v_missing_tbls INT;
    v_missing_cols INT;
BEGIN
    -- 1. signature_tokens NO debe existir
    v_tbl := pg_catalog.to_regclass('public.signature_tokens');
    IF v_tbl IS NOT NULL THEN
        RAISE EXCEPTION 'PREFLIGHT_FAIL: public.signature_tokens ya existe.';
    END IF;

    -- 2. CERO funciones previas del Paso 1.2
    SELECT COUNT(*) INTO v_rpcs
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
          'generate_signature_token',
          'verify_signature_token',
          'submit_digital_signature',
          'get_evolution_signatures_batch',
          'protect_signed_evidence'
      );
    IF v_rpcs > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT_FAIL: Se encontraron % funciones previas en public.', v_rpcs;
    END IF;

    -- 3. CERO triggers previos
    SELECT COUNT(*) INTO v_trg
    FROM pg_catalog.pg_trigger tr
    JOIN pg_catalog.pg_class c ON c.oid = tr.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND tr.tgname = 'trg_protect_signed_evidence';
    IF v_trg > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT_FAIL: trg_protect_signed_evidence ya existe.';
    END IF;

    -- 4. Pgcrypto en extensions con firmas requeridas exactas
    SELECT COUNT(*) INTO v_crypto
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions'
      AND (
          (p.proname = 'digest' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'bytea, text')
          OR
          (p.proname = 'gen_random_bytes' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'integer')
      );
    IF v_crypto < 2 THEN
        RAISE EXCEPTION 'PREFLIGHT_FAIL: extensions.digest(bytea, text) o extensions.gen_random_bytes(integer) no estan disponibles.';
    END IF;

    -- 5. Disponibilidad de pg_options_to_table para auditoría de GUCs
    IF pg_catalog.to_regprocedure('pg_catalog.pg_options_to_table(text[])') IS NULL THEN
        RAISE EXCEPTION 'PREFLIGHT_FAIL: pg_catalog.pg_options_to_table(text[]) no está disponible en este motor PostgreSQL.';
    END IF;

    -- 6. Tablas base requeridas existentes
    SELECT COUNT(*) INTO v_missing_tbls
    FROM (
        VALUES ('public.tenants'), ('public.pacientes'), ('public.profiles'), ('public.evoluciones')
    ) AS req(t)
    WHERE pg_catalog.to_regclass(req.t) IS NULL;

    IF v_missing_tbls > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT_FAIL: Faltan tablas base requeridas.';
    END IF;

    -- 6. Columnas y tipos de datos requeridos compatibles al 100%
    SELECT COUNT(*) INTO v_missing_cols
    FROM (
        VALUES 
            ('tenants', 'id', 'uuid'),
            ('pacientes', 'id', 'uuid'),
            ('pacientes', 'tenant_id', 'uuid'),
            ('pacientes', 'documento', 'text'),
            ('pacientes', 'nombres', 'text'),
            ('profiles', 'id', 'uuid'),
            ('profiles', 'tenant_id', 'uuid'),
            ('profiles', 'full_name', 'text'),
            ('profiles', 'role', 'text'),
            ('profiles', 'activo', 'boolean'),
            ('evoluciones', 'id', 'uuid'),
            ('evoluciones', 'tenant_id', 'uuid'),
            ('evoluciones', 'paciente_id', 'uuid'),
            ('evoluciones', 'profesional_id', 'uuid'),
            ('evoluciones', 'fecha', 'timestamp with time zone'),
            ('evoluciones', 'tratamiento', 'text'),
            ('evoluciones', 'notas', 'text')
    ) AS expected(table_name, column_name, data_type)
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = expected.table_name
     AND c.column_name = expected.column_name
     AND c.data_type = expected.data_type
    WHERE c.column_name IS NULL;

    IF v_missing_cols > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT_FAIL: Faltan % columnas requeridas o sus tipos de datos difieren.', v_missing_cols;
    END IF;

    RAISE NOTICE 'PREFLIGHT_PASS: Todas las condiciones de pre-instalacion son 100%% correctas.';
END $$;
EOF

echo "✅ Preflight exitoso. Procediendo con el Backup Obligatorio."

echo ""
echo "=========================================================="
echo " [FASE 2] BACKUP OBLIGATORIO PREVIO A LA INSTALACIÓN"
echo "=========================================================="

mkdir -p "${BACKUP_DIR}"
docker exec -i "${CONTAINER}" pg_dump -U postgres -d postgres \
    -t public.evoluciones \
    -t public.pacientes \
    -t public.profiles \
    -Fc > "${BACKUP_FILE}"

if [ ! -s "${BACKUP_FILE}" ]; then
    echo "❌ ERROR: El archivo de backup está vacío o no se generó."
    exit 1
fi

echo "✅ Backup exitoso generado:"
echo "   Ruta: ${BACKUP_FILE}"
echo "   Tamaño: $(du -h "${BACKUP_FILE}" | cut -f1)"
echo "   Timestamp: ${TIMESTAMP}"

echo ""
echo "=========================================================="
echo " [FASE 3] INSTALACIÓN DEL PASO 1.2 (CERRADA Y FAIL-CLOSED)"
echo "=========================================================="

docker exec -i "${CONTAINER}" psql -U postgres -d postgres << 'EOF'
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

-- 2. ÍNDICES DE ALTO RENDIMIENTO
CREATE INDEX idx_signature_tokens_evolution_id ON public.signature_tokens(evolution_id);
CREATE INDEX idx_signature_tokens_tenant_id ON public.signature_tokens(tenant_id);

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
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'firmado' THEN
            RAISE EXCEPTION 'CANNOT_DELETE_SIGNED_EVIDENCE: Las evidencias de firma clinica son inmutables.';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'firmado' THEN
            RAISE EXCEPTION 'CANNOT_MODIFY_SIGNED_EVIDENCE: Registro sellado e inalterable.';
        END IF;
        
        IF NEW.status = 'firmado' THEN
            IF OLD.status <> 'pendiente' THEN
                RAISE EXCEPTION 'INVALID_STATUS_TRANSITION: Solo un token pendiente puede ser firmado.';
            END IF;
            
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
    IF p_raw_token IS NULL OR NOT (p_raw_token ~ '^[0-9a-fA-F]{48}$') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_TOKEN');
    END IF;

    v_input_last4 := pg_catalog.regexp_replace(COALESCE(p_last4, ''), '\D', '', 'g');
    IF pg_catalog.length(v_input_last4) <> 4 THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_LAST4_FORMAT');
    END IF;

    v_token_hash := pg_catalog.encode(extensions.digest(p_raw_token::bytea, 'sha256'), 'hex');

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
    IF p_raw_token IS NULL OR NOT (p_raw_token ~ '^[0-9a-fA-F]{48}$') THEN
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

        IF pg_catalog.substring(v_decoded_bytes from 1 for 8) <> '\x89504e470d0a1a0a'::bytea THEN
            RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_PNG_MAGIC_BYTES');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_BASE64_DATA');
    END;

    v_token_hash := pg_catalog.encode(extensions.digest(p_raw_token::bytea, 'sha256'), 'hex');

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
-- Los permisos permanecen totalmente revocados hasta pasar las pruebas funcionales.
REVOKE ALL ON FUNCTION public.protect_signed_evidence() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.generate_signature_token(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_signature_token(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_digital_signature(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_evolution_signatures_batch(UUID[]) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
EOF

echo "✅ Migración del Paso 1.2 completada en modo CERRADO."

echo ""
echo "=========================================================="
echo " [FASE 4, 5 Y 6] VALIDACIÓN ESTRUCTURAL EN FRÍO (FAIL-CLOSED)"
echo "=========================================================="

docker exec -i "${CONTAINER}" psql -U postgres -d postgres << 'EOF'
\set ON_ERROR_STOP on
\x off

-- 1. Muestreo informativo para bitácora
SELECT pg_catalog.to_regclass('public.signature_tokens') AS tabla_signature_tokens;

SELECT
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos,
    p.oid
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'generate_signature_token',
      'verify_signature_token',
      'submit_digital_signature',
      'get_evolution_signatures_batch',
      'protect_signed_evidence'
  )
ORDER BY p.proname, argumentos;

-- 2. ASERCIONES ESTRICTAS FAIL-CLOSED POST-INSTALACIÓN
DO $$
DECLARE
    v_tbl regclass;
    v_fn_count INT;
    v_bad_submit INT;
    v_trg_count INT;
    v_rls BOOLEAN;
    v_idx_hash INT;
    v_idx_evo INT;
    v_idx_tenant INT;
    v_idx_uq_pending INT;
    v_tokens_count INT;
    v_direct_anon_sel BOOLEAN;
    v_direct_auth_sel BOOLEAN;
BEGIN
    -- A. public.signature_tokens EXISTE
    v_tbl := pg_catalog.to_regclass('public.signature_tokens');
    IF v_tbl IS NULL THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: public.signature_tokens NO existe.';
    END IF;

    -- B. Existen exactamente las 5 funciones con sus firmas exactas
    SELECT COUNT(*) INTO v_fn_count
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
          (p.proname = 'protect_signed_evidence' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = '')
          OR
          (p.proname = 'generate_signature_token' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid')
          OR
          (p.proname = 'verify_signature_token' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'text, text')
          OR
          (p.proname = 'submit_digital_signature' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'text, text, text')
          OR
          (p.proname = 'get_evolution_signatures_batch' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid[]')
      );

    IF v_fn_count <> 5 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: Se esperaban exactamente 5 funciones del Paso 1.2 pero se encontraron %.', v_fn_count;
    END IF;

    -- C. NO existe submit_digital_signature(TEXT, TEXT)
    SELECT COUNT(*) INTO v_bad_submit
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'submit_digital_signature'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'text, text';

    IF v_bad_submit > 0 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: Existe versión obsoleta submit_digital_signature(text, text). Abortando.';
    END IF;

    -- D. Existe exactamente trg_protect_signed_evidence sobre public.signature_tokens
    SELECT COUNT(*) INTO v_trg_count
    FROM pg_catalog.pg_trigger tr
    JOIN pg_catalog.pg_class c ON c.oid = tr.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'signature_tokens'
      AND tr.tgname = 'trg_protect_signed_evidence'
      AND NOT tr.tgisinternal;

    IF v_trg_count <> 1 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: El trigger trg_protect_signed_evidence no está instalado en signature_tokens.';
    END IF;

    -- E. RLS está habilitado realmente: pg_class.relrowsecurity = true
    SELECT c.relrowsecurity INTO v_rls
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'signature_tokens';

    IF v_rls IS NOT TRUE THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: RLS no está habilitado en public.signature_tokens.';
    END IF;

    -- F. Índices esperados
    SELECT COUNT(*) INTO v_idx_hash
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public' AND tablename = 'signature_tokens'
      AND indexdef LIKE '%UNIQUE%token_hash%';
    IF v_idx_hash = 0 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: Falta índice UNIQUE para token_hash.';
    END IF;

    SELECT COUNT(*) INTO v_idx_evo
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public' AND tablename = 'signature_tokens'
      AND indexname = 'idx_signature_tokens_evolution_id';
    IF v_idx_evo = 0 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: Falta índice idx_signature_tokens_evolution_id.';
    END IF;

    SELECT COUNT(*) INTO v_idx_tenant
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public' AND tablename = 'signature_tokens'
      AND indexname = 'idx_signature_tokens_tenant_id';
    IF v_idx_tenant = 0 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: Falta índice idx_signature_tokens_tenant_id.';
    END IF;

    SELECT COUNT(*) INTO v_idx_uq_pending
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public' AND tablename = 'signature_tokens'
      AND indexname = 'uq_signature_tokens_pending_evolution'
      AND indexdef LIKE '%status%pendiente%';
    IF v_idx_uq_pending = 0 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: Falta índice uq_signature_tokens_pending_evolution con filtro status = ''pendiente''.';
    END IF;

    -- G. signature_tokens está vacía: COUNT(*) = 0
    SELECT COUNT(*) INTO v_tokens_count FROM public.signature_tokens;
    IF v_tokens_count <> 0 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: signature_tokens contiene % filas (debe ser 0).', v_tokens_count;
    END IF;

    -- H. Confirmar modo CERRADO inicial (cero privilegios directos)
    v_direct_anon_sel := has_table_privilege('anon', 'public.signature_tokens', 'select');
    v_direct_auth_sel := has_table_privilege('authenticated', 'public.signature_tokens', 'select');
    IF v_direct_anon_sel OR v_direct_auth_sel THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: La tabla tiene permisos directos no revocados.';
    END IF;

    -- I. Confirmar que protect_signed_evidence no tiene EXECUTE para nadie
    IF has_function_privilege('anon', 'public.protect_signed_evidence()', 'execute')
       OR has_function_privilege('authenticated', 'public.protect_signed_evidence()', 'execute')
       OR has_function_privilege('service_role', 'public.protect_signed_evidence()', 'execute')
    THEN
        RAISE EXCEPTION 'ASSERT_FAIL [POST-INSTALL]: protect_signed_evidence tiene permiso EXECUTE no revocado.';
    END IF;

    RAISE NOTICE 'ASSERT_PASS [POST-INSTALL]: Validación estructural fail-closed 100%% superada.';
END $$;
EOF

echo "✅ Validación estructural completada y aprobada."

echo ""
echo "=========================================================="
echo " [FASE 7] VALIDACIONES SEGURAS DE PRODUCCIÓN (CERO INSERTS)"
echo "=========================================================="

docker exec -i "${CONTAINER}" psql -U postgres -d postgres << 'EOF'
\set ON_ERROR_STOP on

-- Validación de integridad estática, lógica criptográfica y constraints
-- CERO escrituras, CERO fixtures, CERO lectura de historias clínicas.
DO $$
DECLARE
    v_def_verify TEXT;
    v_def_submit TEXT;
    v_def_gen    TEXT;
    v_def_batch  TEXT;
    v_secdef_count INT;
    v_searchpath_count INT;
    v_chk_status INT;
    v_fk_count INT;
BEGIN
    -- 1. Verificar definición estática de verify_signature_token
    SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_def_verify
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'verify_signature_token';

    IF v_def_verify NOT LIKE '%^[0-9a-fA-F]{48}$%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: verify_signature_token no contiene regex de 48 hex.';
    END IF;
    IF v_def_verify NOT LIKE '%AUTH_FAILED%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: verify_signature_token no contiene control AUTH_FAILED.';
    END IF;
    IF v_def_verify NOT LIKE '%bloqueado%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: verify_signature_token no contiene control de bloqueo.';
    END IF;

    -- 2. Verificar definición estática de submit_digital_signature
    SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_def_submit
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'submit_digital_signature';

    IF v_def_submit NOT LIKE '%data:image/png;base64,%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: submit_digital_signature no exige Data URL PNG.';
    END IF;
    IF v_def_submit NOT LIKE '%\x89504e470d0a1a0a%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: submit_digital_signature no valida Magic Bytes PNG.';
    END IF;
    IF v_def_submit NOT LIKE '%CORRUPTED_OR_EMPTY_IMAGE%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: submit_digital_signature no valida longitud de payload.';
    END IF;

    -- 3. Verificar definición estática de generate_signature_token
    SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_def_gen
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_signature_token';

    IF v_def_gen NOT LIKE '%extensions.digest%' OR v_def_gen NOT LIKE '%extensions.gen_random_bytes(24)%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: generate_signature_token no utiliza extensions.digest o gen_random_bytes(24).';
    END IF;
    IF v_def_gen NOT LIKE '%status = ''revocado''%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: generate_signature_token no revoca tokens previos pendientes.';
    END IF;

    -- 4. Verificar definición estática de get_evolution_signatures_batch
    SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_def_batch
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_evolution_signatures_batch';

    IF v_def_batch NOT LIKE '%BATCH_LIMIT_EXCEEDED%' THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: get_evolution_signatures_batch no tiene límite de lote.';
    END IF;

    -- 5. Verificar SECURITY DEFINER en las 5 funciones
    SELECT COUNT(*) INTO v_secdef_count
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
          'protect_signed_evidence',
          'generate_signature_token',
          'verify_signature_token',
          'submit_digital_signature',
          'get_evolution_signatures_batch'
      )
      AND p.prosecdef = true;

    IF v_secdef_count <> 5 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: Se esperaban 5 funciones con SECURITY DEFINER pero se encontraron %.', v_secdef_count;
    END IF;

    -- 6. Comprobación SEMÁNTICA Y ROBUSTA de search_path vacío en las 5 funciones exactas
    SELECT COUNT(*)
    INTO v_searchpath_count
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n
      ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
           (p.proname = 'protect_signed_evidence'
            AND pg_catalog.pg_get_function_identity_arguments(p.oid) = '')
        OR (p.proname = 'generate_signature_token'
            AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid')
        OR (p.proname = 'verify_signature_token'
            AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'text, text')
        OR (p.proname = 'submit_digital_signature'
            AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'text, text, text')
        OR (p.proname = 'get_evolution_signatures_batch'
            AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid[]')
      )
      AND EXISTS (
          SELECT 1
          FROM pg_catalog.pg_options_to_table(p.proconfig) cfg
          WHERE cfg.option_name = 'search_path'
            AND cfg.option_value = ''
      );

    IF v_searchpath_count <> 5 THEN
        RAISE EXCEPTION
        'ASSERT_FAIL [SECURITY_CHECK]: No todas las funciones tienen search_path vacío. Encontradas conformes: %/5.',
        v_searchpath_count;
    END IF;

    -- 7. Verificar constraints de CHECK en status
    SELECT COUNT(*) INTO v_chk_status
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'signature_tokens'
      AND c.contype = 'c'
      AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%pendiente%'
      AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%firmado%'
      AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%bloqueado%';

    IF v_chk_status = 0 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: Falta restriccion CHECK de status en signature_tokens.';
    END IF;

    -- 8. Verificar Foreign Keys con ON DELETE RESTRICT
    SELECT COUNT(*) INTO v_fk_count
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'signature_tokens'
      AND c.contype = 'f'
      AND c.confdeltype = 'r'; -- 'r' = RESTRICT

    IF v_fk_count < 3 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SECURITY_CHECK]: Las Foreign Keys de tenants/pacientes/evoluciones deben ser ON DELETE RESTRICT.';
    END IF;

    RAISE NOTICE 'VALIDACIONES_SEGURAS_PASS: Lógica criptográfica, seguridad perimetral y constraints 100%% confirmadas sin escribir datos.';
END $$;
EOF

echo "✅ Validaciones seguras de producción superadas sin escrituras."

echo ""
echo "=========================================================="
echo " [FASE 8 Y 9] ACTIVACIÓN Y VALIDACIÓN ATÓMICA DE PRIVILEGIOS"
echo "=========================================================="

docker exec -i "${CONTAINER}" psql -U postgres -d postgres << 'EOF'
\set ON_ERROR_STOP on
\x off

BEGIN;

-- 1. Otorgar permisos finales autorizados
GRANT EXECUTE ON FUNCTION public.generate_signature_token(UUID)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.verify_signature_token(TEXT, TEXT)
TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.submit_digital_signature(TEXT, TEXT, TEXT)
TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_evolution_signatures_batch(UUID[])
TO authenticated, service_role;

-- 2. ASERCIONES FAIL-CLOSED DENTRO DE LA MISMA TRANSACCIÓN (ANTES DEL COMMIT)
DO $$
DECLARE
    -- authenticated
    v_auth_gen     BOOLEAN;
    v_auth_batch   BOOLEAN;
    v_auth_protect BOOLEAN;
    v_auth_sel     BOOLEAN;
    v_auth_ins     BOOLEAN;
    v_auth_upd     BOOLEAN;
    v_auth_del     BOOLEAN;

    -- anon
    v_anon_ver     BOOLEAN;
    v_anon_sub     BOOLEAN;
    v_anon_gen     BOOLEAN;
    v_anon_batch   BOOLEAN;
    v_anon_protect BOOLEAN;
    v_anon_sel     BOOLEAN;
    v_anon_ins     BOOLEAN;
    v_anon_upd     BOOLEAN;
    v_anon_del     BOOLEAN;

    -- service_role
    v_sr_gen       BOOLEAN;
    v_sr_ver       BOOLEAN;
    v_sr_sub       BOOLEAN;
    v_sr_batch     BOOLEAN;
    v_sr_protect   BOOLEAN;
    v_sr_sel       BOOLEAN;
    v_sr_ins       BOOLEAN;
    v_sr_upd       BOOLEAN;
    v_sr_del       BOOLEAN;

    v_final_count  INT;
BEGIN
    -- A. AUTHENTICATED
    v_auth_gen     := has_function_privilege('authenticated', 'public.generate_signature_token(uuid)', 'execute');
    v_auth_batch   := has_function_privilege('authenticated', 'public.get_evolution_signatures_batch(uuid[])', 'execute');
    v_auth_protect := has_function_privilege('authenticated', 'public.protect_signed_evidence()', 'execute');
    v_auth_sel     := has_table_privilege('authenticated', 'public.signature_tokens', 'select');
    v_auth_ins     := has_table_privilege('authenticated', 'public.signature_tokens', 'insert');
    v_auth_upd     := has_table_privilege('authenticated', 'public.signature_tokens', 'update');
    v_auth_del     := has_table_privilege('authenticated', 'public.signature_tokens', 'delete');

    IF NOT (v_auth_gen AND v_auth_batch) THEN
        RAISE EXCEPTION 'ASSERT_FAIL [AUTHENTICATED]: Falta permiso EXECUTE en generate_signature_token o get_evolution_signatures_batch.';
    END IF;

    IF v_auth_protect THEN
        RAISE EXCEPTION 'ASSERT_FAIL [AUTHENTICATED]: authenticated tiene permiso EXECUTE indebido en protect_signed_evidence.';
    END IF;

    IF v_auth_sel OR v_auth_ins OR v_auth_upd OR v_auth_del THEN
        RAISE EXCEPTION 'ASSERT_FAIL [AUTHENTICATED]: authenticated tiene acceso directo a signature_tokens (sel=%, ins=%, upd=%, del=%).',
            v_auth_sel, v_auth_ins, v_auth_upd, v_auth_del;
    END IF;

    -- B. ANON
    v_anon_ver     := has_function_privilege('anon', 'public.verify_signature_token(text, text)', 'execute');
    v_anon_sub     := has_function_privilege('anon', 'public.submit_digital_signature(text, text, text)', 'execute');
    v_anon_gen     := has_function_privilege('anon', 'public.generate_signature_token(uuid)', 'execute');
    v_anon_batch   := has_function_privilege('anon', 'public.get_evolution_signatures_batch(uuid[])', 'execute');
    v_anon_protect := has_function_privilege('anon', 'public.protect_signed_evidence()', 'execute');
    v_anon_sel     := has_table_privilege('anon', 'public.signature_tokens', 'select');
    v_anon_ins     := has_table_privilege('anon', 'public.signature_tokens', 'insert');
    v_anon_upd     := has_table_privilege('anon', 'public.signature_tokens', 'update');
    v_anon_del     := has_table_privilege('anon', 'public.signature_tokens', 'delete');

    IF NOT (v_anon_ver AND v_anon_sub) THEN
        RAISE EXCEPTION 'ASSERT_FAIL [ANON]: Falta permiso EXECUTE en verify_signature_token o submit_digital_signature.';
    END IF;

    IF v_anon_gen OR v_anon_batch OR v_anon_protect THEN
        RAISE EXCEPTION 'ASSERT_FAIL [ANON]: anon tiene permisos indebidos EXECUTE (gen=%, batch=%, protect=%).',
            v_anon_gen, v_anon_batch, v_anon_protect;
    END IF;

    IF v_anon_sel OR v_anon_ins OR v_anon_upd OR v_anon_del THEN
        RAISE EXCEPTION 'ASSERT_FAIL [ANON]: anon tiene acceso directo a signature_tokens (sel=%, ins=%, upd=%, del=%).',
            v_anon_sel, v_anon_ins, v_anon_upd, v_anon_del;
    END IF;

    -- C. SERVICE_ROLE
    v_sr_gen     := has_function_privilege('service_role', 'public.generate_signature_token(uuid)', 'execute');
    v_sr_ver     := has_function_privilege('service_role', 'public.verify_signature_token(text, text)', 'execute');
    v_sr_sub     := has_function_privilege('service_role', 'public.submit_digital_signature(text, text, text)', 'execute');
    v_sr_batch   := has_function_privilege('service_role', 'public.get_evolution_signatures_batch(uuid[])', 'execute');
    v_sr_protect := has_function_privilege('service_role', 'public.protect_signed_evidence()', 'execute');
    v_sr_sel     := has_table_privilege('service_role', 'public.signature_tokens', 'select');
    v_sr_ins     := has_table_privilege('service_role', 'public.signature_tokens', 'insert');
    v_sr_upd     := has_table_privilege('service_role', 'public.signature_tokens', 'update');
    v_sr_del     := has_table_privilege('service_role', 'public.signature_tokens', 'delete');

    IF NOT (v_sr_gen AND v_sr_ver AND v_sr_sub AND v_sr_batch) THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SERVICE_ROLE]: Falta permiso EXECUTE en RPCs autorizadas para service_role.';
    END IF;

    IF v_sr_protect THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SERVICE_ROLE]: service_role tiene permiso EXECUTE indebido en protect_signed_evidence.';
    END IF;

    IF v_sr_sel OR v_sr_ins OR v_sr_upd OR v_sr_del THEN
        RAISE EXCEPTION 'ASSERT_FAIL [SERVICE_ROLE]: service_role tiene acceso SQL directo a signature_tokens (sel=%, ins=%, upd=%, del=%).',
            v_sr_sel, v_sr_ins, v_sr_upd, v_sr_del;
    END IF;

    -- D. CONTEO FINAL ESTRICTO DENTRO DE LA MISMA TRANSACCIÓN
    SELECT COUNT(*) INTO v_final_count FROM public.signature_tokens;
    IF v_final_count <> 0 THEN
        RAISE EXCEPTION 'ASSERT_FAIL [FINAL_COUNT]: signature_tokens tiene % registros (debe ser exactamente 0).', v_final_count;
    END IF;

    RAISE NOTICE 'ASSERT_PASS [ATOMIC_ACTIVATION]: Todos los privilegios y el conteo cero fueron validados con éxito dentro de la transacción.';
END $$;

-- 3. COMMIT SOLO SI TODAS LAS ASERCIONES FUERON EXITOSAS
COMMIT;

-- 4. Muestreo informativo final para bitácora
SELECT 
    'authenticated' AS rol,
    has_function_privilege('authenticated', 'public.generate_signature_token(UUID)', 'execute') AS can_generate_rpc,
    has_function_privilege('authenticated', 'public.get_evolution_signatures_batch(UUID[])', 'execute') AS can_batch_rpc,
    has_table_privilege('authenticated', 'public.signature_tokens', 'select') AS can_direct_select_table;

SELECT 
    'anon' AS rol,
    has_function_privilege('anon', 'public.verify_signature_token(TEXT, TEXT)', 'execute') AS can_verify_rpc,
    has_function_privilege('anon', 'public.submit_digital_signature(TEXT, TEXT, TEXT)', 'execute') AS can_submit_rpc,
    has_function_privilege('anon', 'public.generate_signature_token(UUID)', 'execute') AS can_generate_rpc,
    has_table_privilege('anon', 'public.signature_tokens', 'select') AS can_direct_select_table;

SELECT 
    'service_role' AS rol,
    has_function_privilege('service_role', 'public.generate_signature_token(UUID)', 'execute') AS can_generate_rpc,
    has_table_privilege('service_role', 'public.signature_tokens', 'select') AS can_direct_select_table;

SELECT COUNT(*) AS total_filas_finales_signature_tokens FROM public.signature_tokens;
EOF

echo ""
echo "=========================================================="
echo " ✅ INSTALACIÓN, VALIDACIONES Y ACTIVACIÓN DEL PASO 1.2 COMPLETADAS EXITOSAMENTE"
echo "=========================================================="
