# 🚨 APLICAR MIGRACIONES URGENTEMENTE

**IMPORTANTE**: Estos errores impiden que la agenda funcione correctamente.

---

## ❌ Errores Actuales:

1. ❌ Tabla `convenios` no existe (404)
2. ❌ Tabla `audit_logs` no existe (404)  
3. ❌ Tabla `agenda_abierta` con problemas de permisos
4. ❌ Función `assertAppointmentAvailability` no cargada (necesita reload)

---

## ✅ SOLUCIÓN - Sigue estos pasos:

### PASO 1: Aplicar Migración SQL

1. **Abre el SQL Editor de Supabase**:
   ```
   https://supabase.com/dashboard/project/jhdflchyhkwpedtbkusp/sql/new
   ```

2. **Copia TODO el contenido** del archivo:
   ```
   supabase/migrations/20250803_create_missing_tables.sql
   ```

3. **Pega el SQL completo** en el editor

4. **Haz clic en el botón "RUN"** (ejecutar)

5. **Verifica que no haya errores** en la consola de Supabase

---

### PASO 2: Recargar la Aplicación

1. **Ve al navegador** donde tienes abierta la aplicación

2. **Presiona `Ctrl + Shift + R`** (Windows) o `Cmd + Shift + R` (Mac)
   - Esto hace un **hard reload** que limpia la caché

3. **Espera** a que cargue completamente

4. **Prueba crear una cita** nuevamente

---

## 📋 Lo que se creará con la migración:

### Tablas:
- ✅ `convenios` - Convenios institucionales (EPS, ARL, etc.)
- ✅ `convenios_descuentos` - Descuentos por servicio
- ✅ `audit_logs` - Registro de auditoría
- ✅ `agenda_abierta` - Horarios disponibles

### Índices:
- ✅ 14 índices para mejor performance

### Políticas RLS:
- ✅ 8 políticas de seguridad para multi-tenancy

### Triggers:
- ✅ Auto-sync de campos `tenant_id` ↔ `inquilino`

---

## 🔍 Verificar que Funcionó:

Después de aplicar la migración y recargar:

1. **Abre la consola del navegador** (F12)

2. **Ve a la pestaña "Console"**

3. **Intenta crear una cita**

4. **NO deberían aparecer estos errores**:
   - ✅ Ya no: `convenios 404`
   - ✅ Ya no: `audit_logs 404`
   - ✅ Ya no: `assertAppointmentAvailability is not defined`
   - ✅ Ya no: `agenda_abierta 401`

---

## ⚠️ Si Siguen los Errores:

### Error: `assertAppointmentAvailability is not defined`
**Solución**: Haz un **hard reload** presionando `Ctrl + Shift + R`

### Error: `convenios 404` o `audit_logs 404`
**Solución**: Verifica que la migración se ejecutó correctamente:
```sql
-- Ejecuta esto en el SQL Editor:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('convenios', 'audit_logs', 'agenda_abierta');
```

Deberías ver las 3 tablas listadas.

### Error: `JWT issued at future`
**Solución**: Este es un problema de sincronización de hora.
1. Cierra sesión
2. Vuelve a iniciar sesión
3. El token se refrescará automáticamente

---

## 📞 Soporte

Si después de seguir estos pasos siguen los errores, comparte:
1. Screenshot de la consola del navegador
2. Screenshot del resultado de ejecutar la migración en Supabase
3. El mensaje de error completo

---

**RECUERDA**: 
1. ✅ Aplicar migración SQL primero
2. ✅ Hacer hard reload del navegador después
3. ✅ Verificar en consola que no hay más errores 404
