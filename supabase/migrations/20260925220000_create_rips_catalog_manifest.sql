-- ==============================================================================
-- MIGRACIÓN: 20260925220000_create_rips_catalog_manifest.sql
-- MICROFASE 6A.1F-1F-A: Manifest y Registro de Eventos de Catálogos RIPS
--
-- Tablas creadas:
--   1. public.rips_catalogo_snapshots: Registro y ciclo de vida de cada snapshot.
--   2. public.rips_catalogo_snapshot_events: Bitácora append-only de transiciones.
--
-- Seguridad:
--   - RLS habilitado inmediatamente (Default DENY).
--   - REVOKE ALL explícito para 'anon' y 'authenticated'.
--   - Índice único parcial para garantizar exactamente 1 snapshot ACTIVE por catálogo.
-- ==============================================================================

-- 1. Tabla de Snapshots de Catálogos RIPS
CREATE TABLE IF NOT EXISTS public.rips_catalogo_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo TEXT NOT NULL,
  version TEXT NOT NULL,

  -- Cadena de Tres Hashes Criptográficos (SHA-256)
  source_file_sha256 TEXT NOT NULL,
  normalized_snapshot_sha256 TEXT NOT NULL,
  import_payload_sha256 TEXT NOT NULL,

  -- Métricas Cuantitativas de Verificación
  source_row_count INTEGER NOT NULL,
  imported_row_count INTEGER NOT NULL DEFAULT 0,
  unique_code_count INTEGER NOT NULL DEFAULT 0,
  duplicate_code_count INTEGER NOT NULL DEFAULT 0,
  empty_code_count INTEGER NOT NULL DEFAULT 0,
  validation_error_count INTEGER NOT NULL DEFAULT 0,
  usage_counts JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Trazabilidad Temporal de la Fuente (SISPRO)
  source_update_raw TEXT NOT NULL,
  source_update_at TIMESTAMP WITHOUT TIME ZONE,
  source_update_min_raw TEXT NOT NULL,
  source_update_max_raw TEXT NOT NULL,
  source_update_distinct_count INTEGER NOT NULL DEFAULT 1,

  -- Atributos Normativos Oficiales
  cups_resolution TEXT NOT NULL,
  cups_vigencia TEXT NOT NULL,
  rips_schema_version TEXT NOT NULL,

  -- Ciclo de Vida y Auditoría
  status TEXT NOT NULL DEFAULT 'LOADING',
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,

  -- Restricciones de Integridad
  CONSTRAINT uq_rips_catalogo_snapshots_version UNIQUE (catalogo, version),
  CONSTRAINT chk_catalogo_not_empty CHECK (btrim(catalogo) <> ''),
  CONSTRAINT chk_version_not_empty CHECK (btrim(version) <> ''),
  CONSTRAINT chk_cups_res_not_empty CHECK (btrim(cups_resolution) <> ''),
  CONSTRAINT chk_cups_vig_not_empty CHECK (btrim(cups_vigencia) <> ''),
  CONSTRAINT chk_rips_schema_not_empty CHECK (btrim(rips_schema_version) <> ''),
  CONSTRAINT chk_source_file_sha256_format CHECK (source_file_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chk_normalized_sha256_format CHECK (normalized_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chk_payload_sha256_format CHECK (import_payload_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chk_source_row_count_positive CHECK (source_row_count >= 0),
  CONSTRAINT chk_imported_row_count_bounds CHECK (imported_row_count >= 0 AND imported_row_count <= source_row_count),
  CONSTRAINT chk_unique_code_count_bounds CHECK (unique_code_count >= 0 AND unique_code_count <= source_row_count),
  CONSTRAINT chk_duplicate_code_count_positive CHECK (duplicate_code_count >= 0),
  CONSTRAINT chk_empty_code_count_positive CHECK (empty_code_count >= 0),
  CONSTRAINT chk_validation_error_positive CHECK (validation_error_count >= 0),
  CONSTRAINT chk_source_distinct_dates_min CHECK (source_update_distinct_count >= 1),
  CONSTRAINT chk_status_valid_values CHECK (status IN ('LOADING', 'READY', 'ACTIVE', 'SUPERSEDED', 'FAILED'))
);

-- 2. Garantía en Base de Datos: Máximo un snapshot ACTIVE por catálogo
CREATE UNIQUE INDEX IF NOT EXISTS uq_rips_catalogo_active_version
ON public.rips_catalogo_snapshots (catalogo)
WHERE status = 'ACTIVE';

-- 3. Tabla de Bitácora de Eventos (Append-Only)
CREATE TABLE IF NOT EXISTS public.rips_catalogo_snapshot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.rips_catalogo_snapshots(id) ON DELETE RESTRICT,
  catalogo TEXT NOT NULL,
  version TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Restricciones de Integridad
  CONSTRAINT chk_event_catalogo_not_empty CHECK (btrim(catalogo) <> ''),
  CONSTRAINT chk_event_version_not_empty CHECK (btrim(version) <> ''),
  CONSTRAINT chk_event_performed_by_not_empty CHECK (btrim(performed_by) <> ''),
  CONSTRAINT chk_event_type_valid CHECK (event_type IN ('CREATED', 'READY', 'ACTIVATED', 'SUPERSEDED', 'FAILED', 'ROLLED_BACK'))
);

-- 4. Habilitación Inmediata de Row Level Security (Default DENY)
ALTER TABLE public.rips_catalogo_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rips_catalogo_snapshot_events ENABLE ROW LEVEL SECURITY;

-- 5. Revocación Explícita de Accesos Públicos y de Clientes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON public.rips_catalogo_snapshots FROM anon';
    EXECUTE 'REVOKE ALL ON public.rips_catalogo_snapshot_events FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON public.rips_catalogo_snapshots FROM authenticated';
    EXECUTE 'REVOKE ALL ON public.rips_catalogo_snapshot_events FROM authenticated';
  END IF;
END $$;
