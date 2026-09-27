-- ==============================================================================
-- MIGRACIÓN: 20260925221000_create_rips_catalog_lifecycle_functions.sql
-- MICROFASE 6A.1F-1F-B: Funciones Privilegiadas de Ciclo de Vida de Catálogos RIPS
--
-- Funciones creadas:
--   1. public.mark_rips_catalog_snapshot_ready: Certificación de métricas e integridad (LOADING -> READY).
--   2. public.activate_rips_catalog_snapshot: Activación transaccional con guarda de filas (READY -> ACTIVE).
--   3. public.rollback_rips_catalog_snapshot: Rollback controlado y explícito (SUPERSEDED -> ACTIVE).
--
-- Seguridad:
--   - SECURITY DEFINER con SET search_path = '' y calificación completa de esquemas.
--   - performed_by obligatorio en firmas y eventos append-only.
--   - REVOKE ALL FROM PUBLIC.
--   - GRANT EXECUTE TO service_role exclusivamente.
-- ==============================================================================

-- 1. Función de Certificación: LOADING -> READY
CREATE OR REPLACE FUNCTION public.mark_rips_catalog_snapshot_ready(
  p_catalogo TEXT,
  p_version TEXT,
  p_expected_source_sha TEXT,
  p_expected_norm_sha TEXT,
  p_expected_payload_sha TEXT,
  p_performed_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rec public.rips_catalogo_snapshots%ROWTYPE;
  v_rows INTEGER;
BEGIN
  -- 0. Validación de actor
  IF p_performed_by IS NULL OR pg_catalog.btrim(p_performed_by) = '' THEN
    RAISE EXCEPTION 'PERFORMED_BY_REQUIRED: El parámetro p_performed_by no puede ser nulo o vacío';
  END IF;

  -- 1. Serialización concurrente por catálogo
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('catalog_lifecycle:' || p_catalogo));

  -- 2. Localizar y bloquear snapshot en LOADING
  SELECT * INTO v_rec
  FROM public.rips_catalogo_snapshots
  WHERE catalogo = p_catalogo AND version = p_version
  FOR UPDATE;

  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'SNAPSHOT_NOT_FOUND: Catálogo % versión % no existe', p_catalogo, p_version;
  END IF;

  IF v_rec.status <> 'LOADING' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Estado actual es % (se requiere LOADING)', v_rec.status;
  END IF;

  -- 3. Comprobación estricta de hashes de integridad
  IF v_rec.source_file_sha256 <> p_expected_source_sha OR
     v_rec.normalized_snapshot_sha256 <> p_expected_norm_sha OR
     v_rec.import_payload_sha256 <> p_expected_payload_sha THEN
    RAISE EXCEPTION 'HASH_MISMATCH: Los hashes del snapshot no coinciden con los certificados';
  END IF;

  -- 4. Comprobación de métricas de ingesta y completitud
  IF v_rec.source_row_count <= 0 OR
     v_rec.imported_row_count <> v_rec.source_row_count OR
     v_rec.unique_code_count <> v_rec.source_row_count OR
     v_rec.duplicate_code_count <> 0 OR
     v_rec.empty_code_count <> 0 OR
     v_rec.validation_error_count <> 0 THEN
    RAISE EXCEPTION 'METRIC_VALIDATION_FAILED: Conteo de filas, unicidad o errores de validación no certificados';
  END IF;

  -- 5. Transición a READY
  UPDATE public.rips_catalogo_snapshots
  SET status = 'READY', validated_at = pg_catalog.now()
  WHERE id = v_rec.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'GUARD_FAILED: No se pudo actualizar exactamente 1 fila a READY';
  END IF;

  -- 6. Registro de evento append-only
  INSERT INTO public.rips_catalogo_snapshot_events (
    snapshot_id, catalogo, version, event_type, details, performed_by
  ) VALUES (
    v_rec.id, p_catalogo, p_version, 'READY',
    pg_catalog.jsonb_build_object('rows', v_rec.imported_row_count),
    p_performed_by
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'catalogo', p_catalogo,
    'version', p_version,
    'status', 'READY'
  );
END;
$$;

-- 2. Función de Activación Transaccional: READY -> ACTIVE
CREATE OR REPLACE FUNCTION public.activate_rips_catalog_snapshot(
  p_catalogo TEXT,
  p_version TEXT,
  p_performed_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target public.rips_catalogo_snapshots%ROWTYPE;
  v_prev_active public.rips_catalogo_snapshots%ROWTYPE;
  v_rows INTEGER;
BEGIN
  -- 0. Validación de actor
  IF p_performed_by IS NULL OR pg_catalog.btrim(p_performed_by) = '' THEN
    RAISE EXCEPTION 'PERFORMED_BY_REQUIRED: El parámetro p_performed_by no puede ser nulo o vacío';
  END IF;

  -- 1. Serialización concurrente por catálogo
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('catalog_lifecycle:' || p_catalogo));

  -- 2. Localizar y bloquear target
  SELECT * INTO v_target
  FROM public.rips_catalogo_snapshots
  WHERE catalogo = p_catalogo AND version = p_version
  FOR UPDATE;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND: Catálogo % versión % no existe', p_catalogo, p_version;
  END IF;

  IF v_target.status <> 'READY' THEN
    RAISE EXCEPTION 'TARGET_NOT_READY: Catálogo % versión % tiene estado % (se requiere READY)', p_catalogo, p_version, v_target.status;
  END IF;

  -- 3. Verificación de invariantes críticas
  IF v_target.source_row_count <= 0 OR
     v_target.imported_row_count <> v_target.source_row_count OR
     v_target.unique_code_count <> v_target.source_row_count OR
     v_target.duplicate_code_count <> 0 OR
     v_target.empty_code_count <> 0 OR
     v_target.validation_error_count <> 0 THEN
    RAISE EXCEPTION 'TARGET_INTEGRITY_COMPROMISED: Métricas no coinciden con certificación';
  END IF;

  -- 4. Localizar ACTIVE anterior (si existe)
  SELECT * INTO v_prev_active
  FROM public.rips_catalogo_snapshots
  WHERE catalogo = p_catalogo AND status = 'ACTIVE'
  FOR UPDATE;

  IF v_prev_active.id IS NOT NULL THEN
    UPDATE public.rips_catalogo_snapshots
    SET status = 'SUPERSEDED', superseded_at = pg_catalog.now()
    WHERE id = v_prev_active.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'PREV_ACTIVE_GUARD_FAILED: No se pudo degradar la versión activa anterior a SUPERSEDED';
    END IF;

    INSERT INTO public.rips_catalogo_snapshot_events (
      snapshot_id, catalogo, version, event_type, details, performed_by
    ) VALUES (
      v_prev_active.id, p_catalogo, v_prev_active.version, 'SUPERSEDED',
      pg_catalog.jsonb_build_object('replaced_by', p_version),
      p_performed_by
    );
  END IF;

  -- 5. Promover target a ACTIVE
  UPDATE public.rips_catalogo_snapshots
  SET status = 'ACTIVE', activated_at = pg_catalog.now()
  WHERE id = v_target.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'TARGET_ACTIVATION_GUARD_FAILED: No se pudo activar la versión target';
  END IF;

  INSERT INTO public.rips_catalogo_snapshot_events (
    snapshot_id, catalogo, version, event_type, details, performed_by
  ) VALUES (
    v_target.id, p_catalogo, p_version, 'ACTIVATED',
    pg_catalog.jsonb_build_object('previous_active', v_prev_active.version),
    p_performed_by
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'catalogo', p_catalogo,
    'activated_version', p_version,
    'previous_active_version', v_prev_active.version,
    'status', 'ACTIVE'
  );
END;
$$;

-- 3. Función de Rollback Controlado: SUPERSEDED -> ACTIVE
CREATE OR REPLACE FUNCTION public.rollback_rips_catalog_snapshot(
  p_catalogo TEXT,
  p_target_superseded_version TEXT,
  p_reason TEXT,
  p_performed_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_active public.rips_catalogo_snapshots%ROWTYPE;
  v_target public.rips_catalogo_snapshots%ROWTYPE;
  v_rows INTEGER;
BEGIN
  -- 0. Validaciones de parámetros
  IF p_performed_by IS NULL OR pg_catalog.btrim(p_performed_by) = '' THEN
    RAISE EXCEPTION 'PERFORMED_BY_REQUIRED: El parámetro p_performed_by no puede ser nulo o vacío';
  END IF;

  IF p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Debe indicarse un motivo válido para ejecutar rollback';
  END IF;

  -- 1. Serialización concurrente por catálogo
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('catalog_lifecycle:' || p_catalogo));

  -- 2. Localizar y bloquear versión ACTIVE actual
  SELECT * INTO v_current_active
  FROM public.rips_catalogo_snapshots
  WHERE catalogo = p_catalogo AND status = 'ACTIVE'
  FOR UPDATE;

  IF v_current_active.id IS NULL THEN
    RAISE EXCEPTION 'NO_CURRENT_ACTIVE_FOUND: No existe versión ACTIVE para catálogo %', p_catalogo;
  END IF;

  -- 3. Localizar y bloquear target SUPERSEDED
  SELECT * INTO v_target
  FROM public.rips_catalogo_snapshots
  WHERE catalogo = p_catalogo AND version = p_target_superseded_version
  FOR UPDATE;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_TARGET_NOT_FOUND: Versión % no existe en catálogo %', p_target_superseded_version, p_catalogo;
  END IF;

  IF v_target.status <> 'SUPERSEDED' THEN
    RAISE EXCEPTION 'INVALID_ROLLBACK_TARGET_STATUS: Estado es % (se requiere SUPERSEDED)', v_target.status;
  END IF;

  IF v_target.source_row_count <= 0 OR
     v_target.imported_row_count <> v_target.source_row_count OR
     v_target.validation_error_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK_TARGET_INTEGRITY_FAIL: Versión histórica no cuenta con métricas íntegras';
  END IF;

  -- 4. Degradar ACTIVE defectuoso a FAILED
  UPDATE public.rips_catalogo_snapshots
  SET status = 'FAILED', error_details = 'Rolled back: ' || p_reason
  WHERE id = v_current_active.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ACTIVE_DEGRADE_GUARD_FAILED: No se pudo degradar la versión activa actual a FAILED';
  END IF;

  INSERT INTO public.rips_catalogo_snapshot_events (
    snapshot_id, catalogo, version, event_type, details, performed_by
  ) VALUES (
    v_current_active.id, p_catalogo, v_current_active.version, 'FAILED',
    pg_catalog.jsonb_build_object('reason', p_reason),
    p_performed_by
  );

  -- 5. Reactivar target histórico a ACTIVE
  UPDATE public.rips_catalogo_snapshots
  SET status = 'ACTIVE', rolled_back_at = pg_catalog.now()
  WHERE id = v_target.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'TARGET_REACTIVATION_GUARD_FAILED: No se pudo reactivar la versión histórica';
  END IF;

  INSERT INTO public.rips_catalogo_snapshot_events (
    snapshot_id, catalogo, version, event_type, details, performed_by
  ) VALUES (
    v_target.id, p_catalogo, v_target.version, 'ROLLED_BACK',
    pg_catalog.jsonb_build_object('reason', p_reason),
    p_performed_by
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'catalogo', p_catalogo,
    'restored_version', p_target_superseded_version,
    'failed_version', v_current_active.version,
    'status', 'ACTIVE'
  );
END;
$$;

-- 4. Revocación Universal y Asignación de Privilegios
REVOKE ALL ON FUNCTION public.mark_rips_catalog_snapshot_ready(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_rips_catalog_snapshot(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_rips_catalog_snapshot(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_rips_catalog_snapshot_ready(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.activate_rips_catalog_snapshot(TEXT, TEXT, TEXT) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.rollback_rips_catalog_snapshot(TEXT, TEXT, TEXT, TEXT) TO service_role';
  END IF;
END $$;
