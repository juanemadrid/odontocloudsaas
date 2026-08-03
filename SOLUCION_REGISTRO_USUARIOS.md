# 🔧 Solución: Registro de Usuarios por Clínicas

## 📋 Problema Identificado

Cuando una clínica registra un nuevo usuario (doctor, administrativo, recepcionista, etc.), el usuario no puede iniciar sesión y recibe el mensaje:

> **"🚫 Esta clínica o cuenta ha sido eliminada o suspendida del sistema."**

### Causas del Problema

1. **Rol hardcodeado**: El RPC `admin_create_clinic_user` estaba forzando el rol como `'administrador'` para todos los usuarios, ignorando el rol real (doctor, recepcionista, etc.)

2. **Parámetro faltante**: El servicio `userAdminService.js` no estaba pasando el parámetro `p_role` al RPC

3. **Normalización inconsistente**: Los roles podían venir con diferentes formatos ("Doctor", "Odontologo", "doctor", etc.) causando inconsistencias

4. **Validación de clínica**: La función intentaba crear la clínica en lugar de solo validar que existe y está activa

## ✅ Solución Implementada

### 1. **Actualización del RPC `admin_create_clinic_user`**

**Archivo**: `supabase/migrations/20260811_admin_create_clinic_user_rpc.sql`

**Cambios**:
- ✅ Agregado parámetro `p_role` con valor por defecto `'administrador'`
- ✅ Normalización automática de roles comunes:
  - `odontologo`, `odontólogo`, `odontologo general` → `doctor`
  - `admin` → `administrador`
- ✅ Validación de que la clínica existe y está activa ANTES de crear usuarios
- ✅ Actualización del `raw_user_meta_data` en `auth.users` con el rol correcto
- ✅ El perfil en `public.profiles` ahora se crea con el rol dinámico recibido

### 2. **Actualización del Servicio Frontend**

**Archivo**: `src/services/userAdminService.js`

**Cambios**:
- ✅ Extracción del rol del objeto `user` pasado como parámetro
- ✅ Envío del parámetro `p_role` al RPC
- ✅ Mejor manejo de errores con throw explícito para debugging

### 3. **Normalización en el Componente UI**

**Archivo**: `src/modules/config/EmpresaUsuarios.jsx`

**Cambios**:
- ✅ Normalización de roles antes de enviar al servicio
- ✅ Mapeo de roles comunes para consistencia
- ✅ Protección de roles de administrador al editar

### 4. **Nueva Migración Completa**

**Archivo**: `supabase/migrations/20250802_fix_clinic_user_registration.sql`

**Características**:
- ✅ RPC actualizado con validaciones robustas
- ✅ Políticas RLS que permiten a administradores crear usuarios de su clínica
- ✅ Función auxiliar `check_user_limit_for_tenant` para validar límites por plan
- ✅ Trigger automático para prevenir exceder límites de usuarios
- ✅ Índices optimizados para búsquedas de usuarios
- ✅ Sincronización de columna `inquilino` con `tenant_id`

## 🚀 Instrucciones de Aplicación

### Opción A: Supabase Dashboard (Recomendado)

1. **Abrir Supabase Dashboard**
   - Ve a tu proyecto en [Supabase](https://app.supabase.com)
   - Navega a: **SQL Editor** en el menú lateral

2. **Ejecutar la Migración**
   - Crea una nueva query
   - Copia y pega el contenido completo de:
     ```
     supabase/migrations/20250802_fix_clinic_user_registration.sql
     ```
   - Haz clic en **RUN** o presiona `Ctrl + Enter`

3. **Verificar la Ejecución**
   - Deberías ver mensajes de éxito:
     ```
     ✅ Migración completada exitosamente
     ✅ Función admin_create_clinic_user actualizada con soporte de roles dinámicos
     ✅ Políticas RLS configuradas para permitir registro de usuarios por administradores
     ✅ Validación de límites de usuarios implementada
     ```

### Opción B: Supabase CLI

```bash
# En la raíz del proyecto
npx supabase db push
```

### Opción C: Ejecución Manual (Desarrollo Local)

```bash
# Si estás usando Supabase local
npx supabase db reset
npx supabase db push
```

## 🧪 Cómo Probar la Solución

### 1. Registrar un Doctor

1. Inicia sesión como **Administrador de Clínica**
2. Ve a: **Configuración → Usuarios y Talento Humano**
3. Haz clic en **+ Nuevo Usuario**
4. Completa los datos:
   - **Nombre**: Juan
   - **Apellido**: Pérez
   - **Email**: juan.perez@clinica.com
   - **Contraseña**: MiPassword123 (mínimo 8 caracteres)
   - **Perfil**: Doctor
   - **Especialidades**: Ortodoncia
   - **Sucursales**: Selecciona al menos una
5. Haz clic en **Guardar**
6. Deberías ver: ✅ **"Usuario creado con éxito"**

### 2. Iniciar Sesión como el Doctor

1. Cierra sesión del administrador
2. Ve a la página de login
3. Ingresa:
   - **Email**: juan.perez@clinica.com
   - **Contraseña**: MiPassword123
4. Haz clic en **Iniciar Sesión**
5. **Resultado Esperado**: ✅ El doctor inicia sesión correctamente y es redirigido a `/dashboard_doctor`

### 3. Verificar Otros Roles

Repite el proceso para:
- ✅ **Recepcionista**
- ✅ **Auxiliar**
- ✅ **Administrativo**

Todos deberían poder iniciar sesión sin problemas.

## 🔍 Validaciones Implementadas

### Pre-Login (RPC `check_user_tenant_active`)

```javascript
// Verifica ANTES de permitir login:
1. ¿Existe el perfil del usuario?
2. ¿El perfil está activo? (activo = true)
3. ¿Tiene una clínica asignada? (tenant_id IS NOT NULL)
4. ¿La clínica está activa? (tenant.activo = true)
```

### Al Crear Usuario (RPC `admin_create_clinic_user`)

```javascript
// Valida ANTES de crear el usuario:
1. ¿El email es válido?
2. ¿La contraseña tiene mínimo 6 caracteres?
3. ¿La clínica existe en la base de datos?
4. ¿La clínica está activa?
5. ¿Se respeta el límite de usuarios del plan?
```

### Límites por Plan

| Plan         | Máximo Usuarios |
|--------------|----------------|
| Consultorio  | 2              |
| Clínica/Pro  | 12             |
| Enterprise   | Ilimitado      |

## 🛠️ Funciones RPC Disponibles

### `admin_create_clinic_user`
Crea o actualiza un usuario de clínica con rol dinámico.

```sql
SELECT public.admin_create_clinic_user(
  'doctor@clinica.com',    -- p_email
  'Password123',            -- p_password
  'Dr. Juan Pérez',        -- p_full_name
  'uuid-de-la-clinica',    -- p_tenant_id
  'doctor'                  -- p_role (opcional, default: 'administrador')
);
```

### `check_user_tenant_active`
Verifica si un usuario puede iniciar sesión.

```sql
SELECT public.check_user_tenant_active('usuario@email.com');

-- Retorna:
-- { "allowed": true } 
-- o
-- { "allowed": false, "reason": "profile_inactive" }
```

### `check_user_limit_for_tenant`
Verifica si una clínica puede agregar más usuarios.

```sql
SELECT public.check_user_limit_for_tenant('uuid-de-la-clinica');

-- Retorna:
-- {
--   "allowed": true,
--   "current_count": 3,
--   "max_users": 12,
--   "plan": "clinica"
-- }
```

## 📊 Mapeo de Roles

El sistema normaliza automáticamente estos roles:

```javascript
'odontologo'        → 'doctor'
'odontólogo'        → 'doctor'
'odontologo general'→ 'doctor'
'admin'             → 'administrador'
'recepcionista'     → 'recepcionista'
'auxiliar'          → 'auxiliar'
```

## 🔐 Políticas de Seguridad (RLS)

### Profiles - INSERT
✅ SuperAdmin puede crear cualquier perfil
✅ Administrador de clínica puede crear perfiles para su propia clínica

### Profiles - UPDATE
✅ SuperAdmin puede actualizar cualquier perfil
✅ Usuario puede actualizar su propio perfil
✅ Administrador de clínica puede actualizar perfiles de su clínica

### Profiles - SELECT
✅ Usuario puede ver su propio perfil
✅ Usuario puede ver perfiles de su misma clínica
✅ SuperAdmin puede ver todos los perfiles

## ❌ Errores Comunes y Soluciones

### Error: "Esta clínica o cuenta ha sido eliminada o suspendida"

**Causa**: El usuario o la clínica están marcados como inactivos

**Solución**:
```sql
-- Activar la clínica
UPDATE public.tenants 
SET activo = true 
WHERE id = 'uuid-de-la-clinica';

-- Activar el usuario
UPDATE public.profiles 
SET activo = true 
WHERE email = 'usuario@email.com';
```

### Error: "La clínica con ID % no existe en el sistema"

**Causa**: El `tenant_id` no corresponde a ninguna clínica en la tabla `tenants`

**Solución**: Asegúrate de que la clínica fue creada correctamente por el SuperAdmin

### Error: "Límite de X usuarios alcanzado"

**Causa**: La clínica alcanzó el límite de usuarios de su plan

**Solución**: Actualiza el plan de la clínica o elimina usuarios inactivos

## 📞 Soporte

Si el problema persiste después de aplicar esta solución:

1. **Revisa los logs de Supabase**:
   - Dashboard → Logs → Database Logs

2. **Verifica en la consola del navegador** (F12):
   - Busca errores en la pestaña Console
   - Revisa las respuestas del Network tab

3. **Prueba manualmente el RPC**:
   ```sql
   SELECT public.admin_create_clinic_user(
     'test@test.com',
     'Test1234',
     'Usuario Test',
     (SELECT id FROM tenants WHERE activo = true LIMIT 1),
     'doctor'
   );
   ```

## ✨ Resultado Final

Después de aplicar esta solución:

✅ Las clínicas pueden registrar usuarios con cualquier rol
✅ Los usuarios pueden iniciar sesión correctamente
✅ El sistema valida automáticamente estados activos
✅ Se respetan los límites de usuarios por plan
✅ Los roles se normalizan automáticamente
✅ La seguridad multi-tenant está garantizada

---

**Fecha de Solución**: 2025-08-02
**Versión**: 1.0.0
**Estado**: ✅ Lista para Producción
