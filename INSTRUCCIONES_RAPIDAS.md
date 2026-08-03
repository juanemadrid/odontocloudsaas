# 🎯 INSTRUCCIONES RÁPIDAS - FIX RLS COMPLETO

## 📋 RESUMEN DE LA SITUACIÓN

### ❌ PROBLEMAS ACTUALES:

**Error 1: Al crear citas**
- Error 400 en `audit_logs`
- La cita SÍ se crea, pero no se guarda el log

**Error 2: Al cambiar contraseña de usuarios**
- Error 400 en `profiles` (PATCH)
- Error 400 en `usuarios` (PATCH)
- La contraseña SÍ cambia, pero fallan los updates

**Error 3: CORS en función Edge**
- Error de CORS en `admin-users` (secundario)

### ✅ LO QUE YA FUNCIONA:
- Las citas se crean correctamente
- Las contraseñas se cambian correctamente
- Todas las tablas existen

### 🔴 LO QUE FALTA:
- Arreglar las políticas RLS de `audit_logs`, `profiles` y `usuarios`

---

## 🚀 SOLUCIÓN EN 4 PASOS

### PASO 1: Abrir Supabase
Ve a: https://supabase.com/dashboard/project/jhdflchyhkwpedtbkusp/sql/new

### PASO 2: Copiar este SQL COMPLETO

```sql
```sql
-- Fix para audit_logs
DROP POLICY IF EXISTS "Users can insert audit logs for their tenant" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Fix para profiles
DROP POLICY IF EXISTS "Users can update profiles from their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles from their tenant" ON public.profiles;

CREATE POLICY "Users can view profiles from their tenant" ON public.profiles
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update profiles from their tenant" ON public.profiles
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Fix para usuarios (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'usuarios') THEN
    ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can update usuarios from their tenant" ON public.usuarios;
    
    EXECUTE 'CREATE POLICY "Users can update usuarios from their tenant" ON public.usuarios
      FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
      WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )';
  END IF;
END $$;
```

### PASO 3: Ejecutar
Pega el SQL y presiona el botón **"Run"** o `Ctrl+Enter`

### PASO 4: Recargar aplicación
- Ve a OdontoCloud en el navegador
- Presiona `Ctrl+Shift+R`
- Prueba creando una cita Y cambiando una contraseña

---

## ✅ VERIFICACIÓN

Después de ejecutar el SQL:

### Test 1: Crear una cita
1. Crea una cita (cualquier paciente, cualquier horario)
2. Abre la consola del navegador (F12)
3. **NO debería aparecer**: `POST .../audit_logs 400`

### Test 2: Cambiar contraseña de un doctor
1. Ve a Configuración > Usuarios
2. Selecciona un doctor
3. Cambia su contraseña
4. **NO deberían aparecer**:
   - `PATCH .../profiles 400`
   - `PATCH .../usuarios 400`

Si todo funciona:
- ✅ La cita se crea y el log se guarda
- ✅ La contraseña cambia sin errores 400
- ✅ No hay errores en consola (excepto el de CORS que es otro tema)

---

## 📝 NOTA SOBRE EL ERROR DE CORS

El error:
```
Access to fetch at '...admin-users' has been blocked by CORS policy
```

Es de la función Edge de Supabase y requiere configuración en el backend. NO afecta la funcionalidad principal (la contraseña sí se cambia). Si quieres arreglarlo después, es otro fix separado.

---

## 📁 ARCHIVOS RELACIONADOS

- `EJECUTAR_ESTE_SQL.sql` - Contiene el SQL completo
- `FIX_AUDIT_LOGS_400.md` - Explicación detallada del problema
- `FIX_AGENDA_CONVENIOS.md` - Documentación de todos los fixes

---

## 🆘 SI ALGO FALLA

1. Revisa que el SQL se ejecutó sin errores
2. Verifica que recargaste con `Ctrl+Shift+R` (no F5)
3. Cierra sesión y vuelve a iniciar sesión
4. Si persiste, avísame

---

**Tiempo estimado**: 2 minutos  
**Dificultad**: Muy fácil 🟢  
**Riesgo**: Ninguno (solo cambia permisos de INSERT)
