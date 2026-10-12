-- =============================================================================
-- ODONTOCLOUD — ESTRATEGIA DE REVERSIÓN SEGURA (SAFE DOWNGRADE) MICROFASE 1
-- Archivo: supabase/migrations/20261012_ihce_microphase_1_safe_downgrade.sql
-- =============================================================================
-- PRINCIPIOS DE SEGURIDAD:
-- 1. NO restaura ON DELETE CASCADE: La protección contra destrucción de historias
--    clínicas se mantiene irrevocable (Resolución 839 de 2017).
-- 2. NO ejecuta DROP COLUMN destructivo sobre datos clínicos capturados.
-- 3. Si la aplicación requiere hacer rollback de versión de software, las columnas
--    nuevas permanecen inactivas/compatibles en BD sin generar fallos en el código
--    anterior, permitiendo un downgrade 100% no destructivo.
-- 4. Si se requiere retirar restricciones para compatibilidad con versiones previas,
--    se eliminan únicamente los CHECK constraints específicos de validación.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Relajar validaciones CHECK para permitir que versiones anteriores de software
-- no fallen ante formatos heterogéneos:
ALTER TABLE public.sucursales
  DROP CONSTRAINT IF EXISTS chk_sucursales_reps_format;

ALTER TABLE public.profesionales
  DROP CONSTRAINT IF EXISTS chk_profesionales_tipo_documento;

ALTER TABLE public.pacientes
  DROP CONSTRAINT IF EXISTS chk_pacientes_pertenencia_etnica,
  DROP CONSTRAINT IF EXISTS chk_pacientes_divipola;

ALTER TABLE public.evoluciones
  DROP CONSTRAINT IF EXISTS chk_evoluciones_tipo_diagnostico,
  DROP CONSTRAINT IF EXISTS chk_evoluciones_modalidad_atencion;

-- 2. NOTA TÉCNICA DE INTEGRIDAD:
-- Las restricciones FOREIGN KEY ... ON DELETE RESTRICT en:
--   - documentos_clinicos
--   - odontogramas
--   - treatment_plans
--   - evoluciones
--   - saldos_favor
--   - patient_portal_sessions
-- SE CONSERVAN EN RESTRICT. Bajo ninguna circunstancia se restituye ON DELETE CASCADE,
-- salvaguardando la retención legal de 15 a 20 años de los expedientes clínicos.

-- 3. Las columnas añadidas (cie10_principal_codigo, divipola_municipio, etc.)
-- SE PRESERVAN. Al tener DEFAULT NULL, no interfieren con el código de versiones
-- anteriores y no se destruyen los datos que ya hayan sido capturados.

COMMIT;
