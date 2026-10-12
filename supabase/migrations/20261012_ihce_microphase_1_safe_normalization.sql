-- =============================================================================
-- ODONTOCLOUD — MIGRACIÓN MICROFASE 1: NORMALIZACIÓN SEGURA PARA IHCE (FHIR R4)
-- Archivo: supabase/migrations/20261012_ihce_microphase_1_safe_normalization.sql
-- =============================================================================
-- PRINCIPIOS DE DISEÑO ESTRICTOS:
-- 1. Cero DEFAULTS clínicos o administrativos inventados. Todas las columnas nuevas
--    son NULLables y solo se poblarán cuando el acto médico o la configuración
--    real lo determine.
-- 2. Preservación absoluta de retrocompatibilidad: las columnas existentes
--    (diagnostico, procedimiento_cups, ciudad) permanecen intactas.
-- 3. Blindaje de integridad y conservación legal (Res. 1995/1999 y 839/2017):
--    Las claves foráneas de pacientes hacia registros clínicos pasan de
--    ON DELETE CASCADE a ON DELETE RESTRICT para evitar destrucción de historias.
-- 4. 100% idempotente y transaccional.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SUCURSALES (Sedes de Prestación REPS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.sucursales
  ADD COLUMN IF NOT EXISTS codigo_habilitacion_reps VARCHAR(12) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS codigo_sede_reps VARCHAR(2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS divipola_municipio VARCHAR(5) DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sucursales_reps_format'
  ) THEN
    ALTER TABLE public.sucursales
      ADD CONSTRAINT chk_sucursales_reps_format
      CHECK (
        (codigo_habilitacion_reps IS NULL OR codigo_habilitacion_reps ~ '^[0-9]{12}$') AND
        (codigo_sede_reps IS NULL OR codigo_sede_reps ~ '^[0-9]{2}$') AND
        (divipola_municipio IS NULL OR divipola_municipio ~ '^[0-9]{5}$')
      );
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 2. PROFESIONALES (Talento Humano en Salud - RETHUS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profesionales
  ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS codigo_rethus VARCHAR(30) DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profesionales_tipo_documento'
  ) THEN
    ALTER TABLE public.profesionales
      ADD CONSTRAINT chk_profesionales_tipo_documento
      CHECK (
        tipo_documento IS NULL OR 
        tipo_documento IN ('CC', 'CE', 'PA', 'PE', 'PT')
      );
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 3. PACIENTES (Demografía e Identificación Nacional)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS pertenencia_etnica_codigo VARCHAR(2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS divipola_municipio VARCHAR(5) DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_pacientes_pertenencia_etnica'
  ) THEN
    ALTER TABLE public.pacientes
      ADD CONSTRAINT chk_pacientes_pertenencia_etnica
      CHECK (
        pertenencia_etnica_codigo IS NULL OR 
        pertenencia_etnica_codigo IN ('1', '2', '3', '4', '5', '6')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_pacientes_divipola'
  ) THEN
    ALTER TABLE public.pacientes
      ADD CONSTRAINT chk_pacientes_divipola
      CHECK (
        divipola_municipio IS NULL OR divipola_municipio ~ '^[0-9]{5}$'
      );
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 4. EVOLUCIONES (Estructuración de Encuentro Clínico RDA - FHIR R4)
-- -----------------------------------------------------------------------------
ALTER TABLE public.evoluciones
  ADD COLUMN IF NOT EXISTS cie10_principal_codigo VARCHAR(5) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cie10_principal_tipo SMALLINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cie10_relacionados JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cups_codigo VARCHAR(6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS modalidad_atencion VARCHAR(2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS causa_externa VARCHAR(2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS finalidad_consulta VARCHAR(2) DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_evoluciones_tipo_diagnostico'
  ) THEN
    ALTER TABLE public.evoluciones
      ADD CONSTRAINT chk_evoluciones_tipo_diagnostico
      CHECK (
        cie10_principal_tipo IS NULL OR cie10_principal_tipo IN (1, 2, 3)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_evoluciones_modalidad_atencion'
  ) THEN
    ALTER TABLE public.evoluciones
      ADD CONSTRAINT chk_evoluciones_modalidad_atencion
      CHECK (
        modalidad_atencion IS NULL OR 
        modalidad_atencion IN ('01', '02', '03', '04', '06', '07', '08', '09')
      );
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 5. BLINDAJE DE INTEGRIDAD: PROTECCIÓN CONTRA ELIMINACIÓN DE EXPEDIENTES
-- -----------------------------------------------------------------------------
-- Las relaciones hacia pacientes dejan de ser destructivas (CASCADE) y pasan a ser
-- estrictas (RESTRICT) para garantizar la retención de 15 años (Res. 1995/1999 y 839/2017).

-- A. Documentos clínicos y consentimientos informados
ALTER TABLE public.documentos_clinicos
  DROP CONSTRAINT IF EXISTS documentos_clinicos_paciente_id_fkey,
  ADD CONSTRAINT documentos_clinicos_paciente_id_fkey
    FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

-- B. Odontogramas
ALTER TABLE public.odontogramas
  DROP CONSTRAINT IF EXISTS odontogramas_paciente_id_fkey,
  ADD CONSTRAINT odontogramas_paciente_id_fkey
    FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

-- C. Planes de tratamiento
ALTER TABLE public.treatment_plans
  DROP CONSTRAINT IF EXISTS treatment_plans_paciente_id_fkey,
  ADD CONSTRAINT treatment_plans_paciente_id_fkey
    FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

-- D. Evoluciones
ALTER TABLE public.evoluciones
  DROP CONSTRAINT IF EXISTS evoluciones_paciente_id_fkey,
  ADD CONSTRAINT evoluciones_paciente_id_fkey
    FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

-- E. Saldos a favor y sesiones
ALTER TABLE public.saldos_favor
  DROP CONSTRAINT IF EXISTS saldos_favor_paciente_id_fkey,
  ADD CONSTRAINT saldos_favor_paciente_id_fkey
    FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

ALTER TABLE public.patient_portal_sessions
  DROP CONSTRAINT IF EXISTS patient_portal_sessions_patient_id_fkey,
  ADD CONSTRAINT patient_portal_sessions_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

COMMIT;
