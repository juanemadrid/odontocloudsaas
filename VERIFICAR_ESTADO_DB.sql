-- =====================================================
-- SCRIPT DE VERIFICACIÓN - Estado de la Base de Datos
-- =====================================================
-- Ejecuta este script en Supabase SQL Editor para verificar
-- que todas las tablas, funciones y políticas están correctas
-- =====================================================

-- 1. Verificar que las tablas existen
-- =====================================================
SELECT 
    'TABLAS' as tipo,
    schemaname,
    tablename,
    CASE 
        WHEN tablename IN ('convenios', 'convenios_descuentos', 'audit_logs', 'agenda_abierta', 'citas') 
        THEN '✅ OK'
        ELSE '⚠️ NO ESPERADA'
    END as estado
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('convenios', 'convenios_descuentos', 'audit_logs', 'agenda_abierta', 'citas')
ORDER BY tablename;

-- =====================================================
-- 2. Verificar políticas RLS de audit_logs
-- =====================================================
SELECT 
    'POLÍTICAS RLS' as tipo,
    tablename,
    policyname,
    cmd as operacion,
    CASE 
        WHEN policyname = 'Users can insert audit logs' AND cmd = 'INSERT' 
        THEN '✅ OK - Política correcta'
        WHEN policyname = 'Users can insert audit logs for their tenant' AND cmd = 'INSERT'
        THEN '🔴 ERROR - Política antigua (causa error 400)'
        ELSE '✅ OK'
    END as estado
FROM pg_policies 
WHERE tablename = 'audit_logs'
ORDER BY cmd, policyname;

-- =====================================================
-- 3. Verificar estructura de audit_logs
-- =====================================================
SELECT 
    'COLUMNAS AUDIT_LOGS' as tipo,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('id', 'tenant_id', 'inquilino', 'patient_id', 'performed_by', 'action', 'details', 'device_info', 'ip_address', 'created_at')
        THEN '✅ OK'
        ELSE '⚠️ EXTRA'
    END as estado
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'audit_logs'
ORDER BY ordinal_position;

-- =====================================================
-- 4. Verificar función check_appointment_availability
-- =====================================================
SELECT 
    'FUNCIONES' as tipo,
    routine_name as nombre_funcion,
    routine_type as tipo_funcion,
    CASE 
        WHEN routine_name = 'check_appointment_availability' 
        THEN '✅ OK - Función existe'
        ELSE '✅ OK'
    END as estado
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('check_appointment_availability', 'sync_inquilino_field')
ORDER BY routine_name;

-- =====================================================
-- 5. Verificar triggers activos en citas
-- =====================================================
SELECT 
    'TRIGGERS' as tipo,
    trigger_name,
    event_manipulation as evento,
    event_object_table as tabla,
    CASE 
        WHEN trigger_name = 'citas_enforce_availability' 
        THEN '🔴 ERROR - Este trigger debe estar ELIMINADO'
        ELSE '✅ OK'
    END as estado
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
  AND event_object_table = 'citas'
ORDER BY trigger_name;

-- =====================================================
-- 6. Verificar trigger en audit_logs
-- =====================================================
SELECT 
    'TRIGGERS' as tipo,
    trigger_name,
    event_manipulation as evento,
    event_object_table as tabla,
    CASE 
        WHEN trigger_name = 'trigger_sync_inquilino' 
        THEN '✅ OK - Sincroniza tenant_id e inquilino'
        ELSE '⚠️ VERIFICAR'
    END as estado
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
  AND event_object_table = 'audit_logs'
ORDER BY trigger_name;

-- =====================================================
-- 7. Contar registros en tablas principales
-- =====================================================
SELECT 
    'CONTEO DATOS' as tipo,
    'convenios' as tabla,
    COUNT(*) as registros
FROM public.convenios

UNION ALL

SELECT 
    'CONTEO DATOS' as tipo,
    'convenios_descuentos' as tabla,
    COUNT(*) as registros
FROM public.convenios_descuentos

UNION ALL

SELECT 
    'CONTEO DATOS' as tipo,
    'audit_logs' as tabla,
    COUNT(*) as registros
FROM public.audit_logs

UNION ALL

SELECT 
    'CONTEO DATOS' as tipo,
    'agenda_abierta' as tabla,
    COUNT(*) as registros
FROM public.agenda_abierta

UNION ALL

SELECT 
    'CONTEO DATOS' as tipo,
    'citas' as tabla,
    COUNT(*) as registros
FROM public.citas;

-- =====================================================
-- 8. Verificar últimas citas creadas
-- =====================================================
SELECT 
    'ÚLTIMAS CITAS' as tipo,
    id,
    fecha_inicio,
    estado,
    motivo,
    created_at
FROM public.citas
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- 9. Verificar últimos audit_logs
-- =====================================================
SELECT 
    'ÚLTIMOS AUDIT LOGS' as tipo,
    id,
    action,
    patient_id,
    created_at,
    details->>'citaId' as cita_id
FROM public.audit_logs
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- INTERPRETACIÓN DE RESULTADOS
-- =====================================================
/*
✅ TODO CORRECTO SI VES:

1. TABLAS: 5 tablas listadas con "✅ OK"
2. POLÍTICAS RLS: 
   - "Users can insert audit logs" con operacion=INSERT y estado "✅ OK - Política correcta"
   - NO debe aparecer "Users can insert audit logs for their tenant"
3. COLUMNAS AUDIT_LOGS: 10 columnas con "✅ OK"
4. FUNCIONES: check_appointment_availability existe
5. TRIGGERS (citas): NO debe aparecer ninguna fila (trigger eliminado)
6. TRIGGERS (audit_logs): trigger_sync_inquilino existe
7. CONTEO DATOS: Números >= 0 (puede ser 0 si no hay datos aún)
8. ÚLTIMAS CITAS: Si hay citas, aparecen las más recientes
9. ÚLTIMOS AUDIT LOGS: Si hay logs, aparecen los más recientes

🔴 HAY PROBLEMA SI VES:
- Política "Users can insert audit logs for their tenant" con estado "ERROR"
- Trigger "citas_enforce_availability" en la tabla citas
- Tablas faltantes
- Función check_appointment_availability no existe
*/
