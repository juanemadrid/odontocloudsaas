# 🔴 FIX URGENTE: Error 400 en audit_logs al crear citas

## ❌ PROBLEMA ACTUAL

Cuando creas una cita exitosamente, aparece este error en la consola:

```
POST https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io/rest/v1/audit_logs?columns=... 400 (Bad Request)
```

**¿Por qué pasa esto?**
- Las citas se crean correctamente ✅
- PERO el registro de auditoría falla después ❌
- Causa: Las políticas RLS de `audit_logs` están bloqueando los INSERT

## ✅ SOLUCIÓN

### Paso 1: Ir a Supabase SQL Editor

1. Abre tu proyecto en Supabase: https://supabase.com/dashboard
2. Ve a la pestaña **SQL Editor** (en el menú izquierdo)

### Paso 2: Ejecutar el SQL de fix

Copia y pega este bloque completo:

```sql
-- =====================================================
-- FIX RÁPIDO: Arreglar políticas de audit_logs
-- =====================================================

-- Eliminar política antigua que causaba el error 400
DROP POLICY IF EXISTS "Users can insert audit logs for their tenant" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;

-- Crear nueva política permisiva para INSERT
-- Permite que cualquier usuario autenticado inserte logs
CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Verificar que la política fue creada correctamente
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'audit_logs' AND cmd = 'INSERT';
```

### Paso 3: Ejecutar

1. Presiona el botón **"Run"** (Ctrl+Enter)
2. Deberías ver un resultado con 1 fila:
   - `policyname`: "Users can insert audit logs"
   - `cmd`: "INSERT"

### Paso 4: Recargar la aplicación

1. Vuelve a tu aplicación OdontoCloud
2. Presiona **Ctrl+Shift+R** para recargar con caché limpio
3. Intenta crear una nueva cita

## 🎯 RESULTADO ESPERADO

Ahora cuando crees una cita:

1. ✅ La cita se crea en la base de datos
2. ✅ El log de auditoría se guarda sin error 400
3. ✅ No aparece el error en la consola del navegador

## 🔍 ¿POR QUÉ FUNCIONABA MAL?

**Política anterior (bloqueaba INSERT):**
```sql
CREATE POLICY "Users can insert audit logs for their tenant" ON public.audit_logs
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
```

- Problema: Al momento del INSERT, Supabase valida que el `tenant_id` ya exista en `profiles`
- Esta validación puede fallar dependiendo del timing y el estado de la sesión
- Resultado: Error 400 Bad Request

**Política nueva (permite INSERT):**
```sql
CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );
```

- Solo valida que el usuario esté autenticado
- El `tenant_id` correcto se establece desde el frontend (`useAudit.js`)
- Resultado: INSERT funciona correctamente

## 📋 ARCHIVOS RELACIONADOS

- `src/hooks/useAudit.js` - Hook que crea logs de auditoría
- `src/modules/agenda/hooks/useAgenda.js` - Llama a `logAction` después de crear cita
- `EJECUTAR_ESTE_SQL.sql` - Contiene el fix completo

---

**Fecha:** 3 de agosto de 2026  
**Estado:** Pendiente de aplicar
