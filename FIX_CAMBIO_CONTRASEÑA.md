# 🔴 FIX: Errores 400 al cambiar contraseña de usuarios

## ❌ PROBLEMA

Cuando cambias la contraseña de un doctor (o cualquier usuario), aparecen estos errores en la consola:

```
POST .../audit_logs 400 (Bad Request)
PATCH .../profiles 400 (Bad Request)
PATCH .../usuarios 400 (Bad Request)
POST .../functions/v1/admin-users net::ERR_FAILED (CORS)
```

**Comportamiento actual:**
- ✅ La contraseña SÍ se cambia correctamente
- ❌ Fallan los logs de auditoría (audit_logs)
- ❌ Falla el update de perfil (profiles)
- ❌ Falla el update de usuario (usuarios)
- ❌ Error de CORS en función Edge (secundario)

---

## 🔍 CAUSA DEL PROBLEMA

### Error 1: audit_logs (400 en INSERT)
La política RLS estaba validando que el `tenant_id` ya existiera en `profiles` al momento del INSERT, lo cual puede fallar por timing.

**Política problemática:**
```sql
CREATE POLICY "Users can insert audit logs for their tenant" ON public.audit_logs
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
```

### Error 2: profiles (400 en UPDATE)
La política RLS de UPDATE podría ser muy restrictiva o estar mal configurada.

### Error 3: usuarios (400 en UPDATE)
Similar a profiles, las políticas RLS pueden estar bloqueando los updates legítimos.

---

## ✅ SOLUCIÓN

### Ejecutar SQL para arreglar las 3 tablas

1. **Abre Supabase SQL Editor**:
   https://supabase.com/dashboard/project/jhdflchyhkwpedtbkusp/sql/new

2. **Copia y pega este SQL completo**:

```sql
-- =====================================================
-- FIX COMPLETO: audit_logs, profiles y usuarios
-- =====================================================

-- 1. FIX AUDIT_LOGS (Error 400 en INSERT)
DROP POLICY IF EXISTS "Users can insert audit logs for their tenant" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 2. FIX PROFILES (Error 400 en UPDATE)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
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

-- 3. FIX USUARIOS (Error 400 en UPDATE)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usuarios') THEN
    ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view usuarios from their tenant" ON public.usuarios;
    DROP POLICY IF EXISTS "Users can update usuarios from their tenant" ON public.usuarios;
    
    EXECUTE 'CREATE POLICY "Users can view usuarios from their tenant" ON public.usuarios
      FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )';
    
    EXECUTE 'CREATE POLICY "Users can update usuarios from their tenant" ON public.usuarios
      FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
      WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )';
  END IF;
END $$;

-- Verificar políticas creadas
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE tablename IN ('audit_logs', 'profiles', 'usuarios')
ORDER BY tablename, cmd;
```

3. **Ejecuta** (botón "Run" o Ctrl+Enter)

4. **Recarga la aplicación** con `Ctrl+Shift+R`

5. **Prueba cambiar una contraseña**

---

## 🧪 VERIFICACIÓN

### Test 1: Cambiar contraseña de un doctor

1. Ve a **Configuración > Usuarios**
2. Selecciona un usuario (doctor o cualquiera)
3. Cambia su contraseña
4. Guarda cambios
5. **Abre la consola del navegador (F12)**

**Resultado esperado:**
- ✅ Contraseña cambiada exitosamente
- ✅ NO aparece: `POST .../audit_logs 400`
- ✅ NO aparece: `PATCH .../profiles 400`
- ✅ NO aparece: `PATCH .../usuarios 400`
- ⚠️ Puede aparecer: Error de CORS (es otro tema)

### Test 2: Crear una cita

1. Ve a **Agenda**
2. Crea una cita nueva
3. **Revisa la consola**

**Resultado esperado:**
- ✅ Cita creada
- ✅ NO aparece: `POST .../audit_logs 400`

---

## 📊 POLÍTICAS RLS CORRECTAS

### audit_logs
```sql
-- SELECT: Solo del mismo tenant
CREATE POLICY "Users can view audit logs from their tenant" ON public.audit_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR inquilino IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- INSERT: Cualquier usuario autenticado
CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );
```

### profiles
```sql
-- SELECT: Solo del mismo tenant
CREATE POLICY "Users can view profiles from their tenant" ON public.profiles
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- UPDATE: Del mismo tenant
CREATE POLICY "Users can update profiles from their tenant" ON public.profiles
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
```

### usuarios
```sql
-- SELECT: Solo del mismo tenant
CREATE POLICY "Users can view usuarios from their tenant" ON public.usuarios
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- UPDATE: Del mismo tenant
CREATE POLICY "Users can update usuarios from their tenant" ON public.usuarios
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
```

---

## ⚠️ NOTA SOBRE EL ERROR DE CORS

El error:
```
Access to fetch at 'https://...supabase.co/functions/v1/admin-users' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Causa:**
La función Edge `admin-users` de Supabase no tiene configurado CORS correctamente para `localhost:3000`.

**Impacto:**
- NO afecta el cambio de contraseña (la contraseña SÍ se cambia)
- Es un error visual/de log solamente

**Solución (opcional):**
Configurar CORS en la función Edge de Supabase. Esto requiere:
1. Ir a Edge Functions en Supabase Dashboard
2. Editar la función `admin-users`
3. Agregar headers de CORS:
   ```javascript
   return new Response(JSON.stringify(data), {
     headers: {
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*',
       'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
     },
   })
   ```

---

## 📁 ARCHIVOS RELACIONADOS

- `FIX_RLS_USUARIOS_PROFILES.sql` - SQL completo del fix
- `EJECUTAR_ESTE_SQL.sql` - Incluye este fix y otros
- `INSTRUCCIONES_RAPIDAS.md` - Guía rápida actualizada
- `src/services/userAdminService.js` - Servicio que llama a las APIs

---

## 📈 IMPACTO DEL FIX

### ANTES:
- ❌ 3 errores 400 en cada cambio de contraseña
- ❌ 1 error 400 en cada creación de cita
- ⚠️ Logs de auditoría no se guardan
- ⚠️ Updates de usuarios fallan silenciosamente

### DESPUÉS:
- ✅ Sin errores 400
- ✅ Logs de auditoría se guardan correctamente
- ✅ Updates de usuarios funcionan
- ✅ Cambios de contraseña limpios
- ⚠️ Solo queda error de CORS (cosmético)

---

**Fecha**: 3 de agosto de 2026  
**Estado**: Solución preparada, pendiente de aplicar  
**Prioridad**: Media (funcionalidad trabaja, pero con errores en consola)
