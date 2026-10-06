-- ============================================================================
-- ROLLBACK CONTROLADO FASE 3B
-- Archivo: supabase/migrations/20261005_phase3b_rollback.sql
--
-- NO se ejecuta automáticamente. Solo bajo orden expresa.
-- NO toca: evoluciones (incluidas las creadas por el RPC, que son historia clínica),
--          odontogramas, treatment_plans, ni datos de Fase 1/2.
-- Nota: los ítems de treatment_plans.detalles.items modificados por el RPC conservan
--       sus claves (status, realizado, evolucion_id, resolucion_odontograma). No se
--       revierten porque forman parte del plan clínico vigente.
-- ============================================================================

BEGIN;

-- 1. RPC
DROP FUNCTION IF EXISTS public.complete_clinical_procedure(UUID, UUID, UUID, UUID, JSONB, JSONB);

-- 2. Eventos (orden explícito, sin CASCADE)
DROP TRIGGER IF EXISTS trg_odontogram_event_immutability ON public.odontogram_events;
DROP TABLE IF EXISTS public.odontogram_events;
DROP FUNCTION IF EXISTS public.trg_protect_odontogram_event_immutability();

-- 3. Idempotencia
DROP TABLE IF EXISTS public.clinical_operation_requests;

-- 4. tratamientos_pendientes: quitar columnas/políticas de 3B.
--    La tabla no existía antes de 3B; solo se elimina si está vacía.
DO $$
DECLARE v_count BIGINT;
BEGIN
    IF to_regclass('public.tratamientos_pendientes') IS NULL THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS p3b_select_tenant ON public.tratamientos_pendientes;
    ALTER TABLE public.tratamientos_pendientes
        DROP CONSTRAINT IF EXISTS chk_tratamientos_pendientes_estado,
        DROP COLUMN IF EXISTS resuelto_en_evolucion_id,
        DROP COLUMN IF EXISTS resuelto_por_profesional_id,
        DROP COLUMN IF EXISTS resuelto_fecha,
        DROP COLUMN IF EXISTS resuelto_en_plan_item_id;

    SELECT count(*) INTO v_count FROM public.tratamientos_pendientes;
    IF v_count = 0 THEN
        DROP TABLE public.tratamientos_pendientes;
        RAISE NOTICE 'tratamientos_pendientes vacia: eliminada (no existia antes de 3B).';
    ELSE
        RAISE NOTICE 'tratamientos_pendientes tiene % filas: se conserva la tabla (solo se quitaron columnas 3B).', v_count;
    END IF;
END $$;

COMMIT;

-- Recargar esquema de PostgREST tras el rollback:
-- NOTIFY pgrst, 'reload schema';
