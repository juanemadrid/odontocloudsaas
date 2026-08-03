# Fix: Error al Guardar Horarios Predefinidos para Recursos Físicos

## 🐛 Problema Identificado

Al intentar agregar horarios predefinidos a recursos físicos (consultorios) en la gestión de agenda, se presentaban los siguientes errores:

### Error 1: 400 Bad Request al cargar la página

```
GET https://...supabase.co/rest/v1/consultorios?select=*&or=(inquilino.eq.xxx,tenant_id.eq.xxx) 400 (Bad Request)
GET https://...supabase.co/rest/v1/profiles?select=*&or=(inquilino.eq.xxx,tenant_id.eq.xxx) 400 (Bad Request)
```

**Causa:** Las queries estaban usando un campo `inquilino` que no existe en las tablas `consultorios` y `profiles`. El nombre correcto del campo es `tenant_id`.

### Error 2: 409 Conflict al guardar horarios

```
POST https://...supabase.co/rest/v1/horarios_predefinidos 409 (Conflict)
Error: El consultorio no pertenece a la clínica seleccionada.
Code: 23503
```

**Causa:** El sistema cargaba recursos físicos desde **DOS fuentes**:

1. **Tabla `consultorios`** en Supabase (fuente canónica)
2. **`website_config.recursos_fisicos`** (configuración JSON)

Cuando un recurso existía solo en `website_config` pero NO en la tabla `consultorios`, el trigger de seguridad `enforce_schedule_entity_tenant()` rechazaba la operación porque no podía validar que el `consultorio_id` perteneciera al tenant.

### Trigger de Seguridad (supabase/migrations/20260804_agenda_production_guards.sql)

```sql
CREATE OR REPLACE FUNCTION public.enforce_schedule_entity_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Valida que el consultorio pertenezca al tenant
  IF NEW.consultorio_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.consultorios AS room
    WHERE room.id = NEW.consultorio_id
      AND room.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'El consultorio no pertenece a la clínica seleccionada.';
  END IF;
  RETURN NEW;
END;
$$;
```

## ✅ Solución Implementada

### 1. Fix de Queries Incorrectas (Error 400)

**Problema:** Las queries usaban `or(inquilino.eq.xxx,tenant_id.eq.xxx)` pero el campo `inquilino` no existe en las tablas.

**Solución:** Cambiadas todas las queries a usar solo `tenant_id`:

```javascript
// ANTES (❌ Incorrecto)
supabase.from("profiles").select("*").or(`inquilino.eq.${inquilino},tenant_id.eq.${inquilino}`)
supabase.from("consultorios").select("*").or(`inquilino.eq.${inquilino},tenant_id.eq.${inquilino}`)

// DESPUÉS (✅ Correcto)
supabase.from("profiles").select("*").eq("tenant_id", inquilino)
supabase.from("consultorios").select("*").eq("tenant_id", inquilino)
```

**Archivos modificados:**
- Línea 165: Query de `profiles` corregida
- Línea 245: Query de `consultorios` corregida

### 2. Modificaciones en `GestionAgenda.jsx` (Error 409)

Se agregó validación y creación automática de consultorios en **tres funciones**:

#### a) `handleSavePred` (Horarios Predefinidos)
- Verifica si el `consultorio_id` existe en la tabla antes de crear el horario
- Si no existe, lo crea automáticamente con los datos del array `resources`
- También valida que el `usuario_id` exista en la tabla `profiles` para profesionales

#### b) `handleSaveOpen` (Agenda Abierta)
- Aplica la misma lógica de validación y creación
- Asegura que el consultorio exista antes de crear fechas de apertura

#### c) `handleSaveUnavail` (No Disponibles)
- Valida y crea el consultorio si es necesario
- Previene errores al crear bloqueos de horario

### Código Agregado (ejemplo de `handleSavePred`)

```javascript
// CRITICAL FIX: Ensure consultorio exists in database before creating schedule
if (roomId) {
  const { data: existingRoom, error: checkError } = await supabase
    .from("consultorios")
    .select("id")
    .eq("id", roomId)
    .eq("tenant_id", inquilino)
    .maybeSingle();

  if (checkError) throw checkError;

  // If consultorio doesn't exist in database, create it first
  if (!existingRoom) {
    const resourceToCreate = resources.find(r => r.id === roomId);
    if (!resourceToCreate) {
      throw new Error("No se encontró el consultorio seleccionado");
    }

    const { error: createError } = await supabase
      .from("consultorios")
      .insert([{
        id: roomId,
        tenant_id: inquilino,
        nombre: resourceToCreate.nombre || "Consultorio",
        ubicacion: resourceToCreate.ubicacion || resourceToCreate.descripcion || "",
        activo: true,
        created_at: new Date().toISOString()
      }]);

    if (createError) throw createError;
  }
}
```

### 2. Script de Sincronización: `sync_consultorios.js`

Se creó un script para sincronizar consultorios existentes en `website_config` a la tabla `consultorios`.

**Características:**
- Recorre todos los tenants
- Lee `website_config.recursos_fisicos`
- Compara con la tabla `consultorios`
- Crea los consultorios faltantes automáticamente

## 🧪 Cómo Probar

### Opción 1: Prueba Manual en la UI

1. **Accede a la aplicación:**
   ```
   npm run dev
   ```

2. **Navega a:**
   - Administración → Gestión de Agenda
   - Cambia a la pestaña "Recursos Físicos"

3. **Selecciona un recurso físico**

4. **Intenta agregar un horario predefinido:**
   - Selecciona días de la semana
   - Define horario (ej: 08:00 - 17:00)
   - Haz clic en "Guardar"

5. **Resultado esperado:**
   - ✅ El horario se guarda exitosamente
   - ✅ NO aparece el error 409
   - ✅ El consultorio se crea automáticamente en la base de datos si no existía

### Opción 2: Ejecutar Script de Sincronización

Si tienes consultorios huérfanos existentes:

```bash
node sync_consultorios.js
```

**Salida esperada:**
```
🔍 Buscando consultorios en website_config...
📋 Encontrados 3 tenants

🏥 Procesando tenant: Clínica Demo (uuid-xxx)
  📦 Encontrados 5 recursos en configuración
  🗄️  Consultorios existentes en DB: 2
  🔧 Creando 3 consultorios faltantes...
  ✅ Sincronizados 3 consultorios

✨ Sincronización completada. Total sincronizados: 3
✅ Script completado exitosamente
```

## 🔍 Verificación en Base de Datos

### Verificar que los consultorios fueron creados:

```sql
SELECT 
  c.id,
  c.nombre,
  c.ubicacion,
  c.tenant_id,
  t.nombre as tenant_name,
  c.activo,
  c.created_at
FROM consultorios c
JOIN tenants t ON c.tenant_id = t.id
ORDER BY c.created_at DESC;
```

### Verificar horarios predefinidos con sus consultorios:

```sql
SELECT 
  hp.id,
  hp.dia,
  hp.hora_inicio,
  hp.hora_fin,
  hp.recurso_nombre,
  c.nombre as consultorio_nombre,
  c.id as consultorio_id,
  hp.tenant_id
FROM horarios_predefinidos hp
LEFT JOIN consultorios c ON hp.consultorio_id = c.id
WHERE hp.consultorio_id IS NOT NULL
ORDER BY hp.created_at DESC;
```

## 🛡️ Garantías de Seguridad

### ✅ No se dañó funcionalidad existente

- La lógica para **profesionales** permanece intacta
- La validación de horarios sigue funcionando
- Los triggers de seguridad siguen activos

### ✅ Se mantiene la integridad referencial

- Todos los `consultorio_id` ahora apuntan a registros reales en `consultorios`
- El trigger `enforce_schedule_entity_tenant()` sigue validando ownership

### ✅ Se previenen errores futuros

- La creación automática es transparente para el usuario
- Los consultorios se crean con el `tenant_id` correcto
- Se preservan nombres y ubicaciones del recurso original

## 📊 Impacto

### Antes del Fix:
- ❌ Error 400 al cargar la página de Gestión de Agenda
- ❌ No se mostraban profesionales ni recursos físicos
- ❌ Error 409 al guardar horarios de recursos físicos
- ❌ Inconsistencia entre `website_config` y tabla `consultorios`
- ❌ Usuarios no podían configurar horarios para algunos recursos

### Después del Fix:
- ✅ La página carga correctamente sin errores 400
- ✅ Se muestran todos los profesionales y recursos físicos
- ✅ Horarios se guardan exitosamente sin error 409
- ✅ Consultorios se crean automáticamente si no existen
- ✅ Sincronización transparente entre ambas fuentes
- ✅ UX fluida sin errores inesperados

## 🔄 Flujo de Trabajo Actualizado

```
Usuario selecciona recurso físico
        ↓
Intenta guardar horario predefinido
        ↓
handleSavePred() verifica si consultorio existe en DB
        ↓
    ┌───────────────────┐
    │ ¿Existe?          │
    └────┬──────────┬───┘
         NO        SI
         ↓         ↓
    Crear consultorio  Continuar
    en DB con datos    ↓
    del array resources│
         ↓              │
         └──────┬───────┘
                ↓
        Guardar horario en
        horarios_predefinidos
                ↓
        Trigger valida ownership
                ↓
            ✅ ÉXITO
```

## 📝 Archivos Modificados

1. **src/modules/administracion/views/GestionAgenda.jsx**
   - **Línea 165:** Query de `profiles` corregida (eliminado campo `inquilino`)
   - **Línea 245:** Query de `consultorios` corregida (eliminado campo `inquilino`)
   - **Líneas ~476-560:** `handleSavePred()` con validación y creación automática
   - **Líneas ~562-620:** `handleSaveOpen()` con validación y creación automática
   - **Líneas ~622-680:** `handleSaveUnavail()` con validación y creación automática

2. **sync_consultorios.js** (NUEVO)
   - Script de sincronización batch

3. **FIX_HORARIOS_RECURSOS.md** (NUEVO)
   - Esta documentación

## 🎯 Conclusión

El fix resuelve completamente los errores al:

1. ✅ **Corregir queries incorrectas** que usaban campo `inquilino` inexistente
2. ✅ **Permitir carga correcta** de profesionales y recursos físicos
3. ✅ **Validar la existencia** del consultorio antes de crear horarios
4. ✅ **Crear automáticamente** consultorios faltantes
5. ✅ **Mantener la integridad** referencial
6. ✅ **Preservar la seguridad** con los triggers existentes
7. ✅ **No afectar funcionalidad** de profesionales

**El sistema ahora funciona correctamente tanto para profesionales como para recursos físicos.**
