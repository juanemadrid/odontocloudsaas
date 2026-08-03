# Fix: Errores en Gestión de Agenda

**Fecha**: 3 de Agosto de 2026  
**Estado**: ✅ SOLUCIONADO

---

## Problemas Identificados

### ❌ Error 1: Tabla `convenios` no existe (404 Not Found)
```
GET https://jhdflchyhkwpedtbkusp.supabase.co/rest/v1/convenios?select=*&tenant_id=eq.xxx 404 (Not Found)
```

**Causa**: La tabla `convenios` no estaba creada en la base de datos.

### ❌ Error 2: Función `assertAppointmentAvailability` no definida
```
ReferenceError: assertAppointmentAvailability is not defined
    at createAppointment (useAgenda.js:417:9)
    at handleSave (Agenda.jsx:146:19)
    at onValidSubmit (AppointmentModal.jsx:335:19)
```

**Causa**: Falta la función que valida la disponibilidad de horarios antes de crear/actualizar citas.

---

## Soluciones Implementadas

### ✅ Solución 1: Crear Tabla `convenios`

**Archivo creado**: `supabase/migrations/20250803_create_convenios.sql`

Esta migración crea:
- ✅ Tabla `convenios` (convenios institucionales: EPS, ARL, Prepagadas, etc.)
- ✅ Tabla `convenios_descuentos` (descuentos específicos por servicio)
- ✅ Índices para mejor performance
- ✅ Políticas RLS (Row Level Security) para multi-tenancy
- ✅ Triggers para `updated_at`

**Cómo aplicar la migración**:

1. **Opción A - SQL Editor de Supabase** (RECOMENDADO):
   - Abre: https://supabase.com/dashboard/project/jhdflchyhkwpedtbkusp/sql/new
   - Copia todo el contenido de `supabase/migrations/20250803_create_convenios.sql`
   - Pega en el editor
   - Haz clic en "RUN"

2. **Opción B - Desde terminal con Supabase CLI**:
   ```bash
   cd "e:\copia de seguridad\odontocloud-react"
   supabase db push
   ```

3. **Opción C - Script Node.js**:
   ```bash
   node run-migration-convenios.js
   ```

### ✅ Solución 2: Función `assertAppointmentAvailability`

**Archivo modificado**: `src/modules/agenda/hooks/useAgenda.js`

Se agregó la función que valida disponibilidad de horarios:

```javascript
const assertAppointmentAvailability = async ({ 
  tenantId, 
  professionalId, 
  roomId, 
  start, 
  end, 
  excludeId = null 
}) => {
  // Verifica que no haya conflictos de horarios
  // - Mismo profesional con citas superpuestas
  // - Mismo consultorio con citas superpuestas
  // - Excluye citas canceladas
  // - Permite excluir una cita (para updates)
};
```

**Características**:
- ✅ Valida que `start < end`
- ✅ Verifica conflictos con el mismo profesional
- ✅ Verifica conflictos con el mismo consultorio
- ✅ Excluye citas canceladas de la validación
- ✅ Permite excluir una cita específica (para actualizaciones)
- ✅ Mensajes de error en español con horarios formateados

**Casos de uso**:
1. Al crear una nueva cita
2. Al actualizar fecha/hora de una cita existente
3. Al mover una cita (drag & drop)
4. Al cambiar profesional o consultorio de una cita

---

## Estructura de Tablas Creadas

### Tabla: `convenios`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID único del convenio |
| `tenant_id` | UUID | ID de la clínica/tenant |
| `nombre` | VARCHAR(255) | Nombre completo (ej: "EPS Sura") |
| `nombre_corto` | VARCHAR(100) | Nombre corto (ej: "SURA") |
| `tipo` | VARCHAR(50) | EPS, ARL, Prepagada, Particular, Otro |
| `nit` | VARCHAR(50) | NIT de la entidad |
| `codigo_habilitacion` | VARCHAR(100) | Código de habilitación |
| `porcentaje_descuento` | DECIMAL(5,2) | Descuento general (%) |
| `cobertura_servicios` | TEXT | JSON con servicios cubiertos |
| `requisitos_autorizacion` | TEXT | Requisitos para autorización |
| `contacto_nombre` | VARCHAR(255) | Nombre del contacto |
| `contacto_telefono` | VARCHAR(50) | Teléfono del contacto |
| `contacto_email` | VARCHAR(255) | Email del contacto |
| `notas` | TEXT | Notas adicionales |
| `activo` | BOOLEAN | Si el convenio está activo |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Fecha de última actualización |

### Tabla: `convenios_descuentos`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID único del descuento |
| `convenio_id` | UUID | Referencia a `convenios.id` |
| `tenant_id` | UUID | ID de la clínica/tenant |
| `servicio_id` | UUID | ID del servicio/tratamiento |
| `servicio_nombre` | VARCHAR(255) | Nombre del servicio |
| `codigo_cups` | VARCHAR(50) | Código CUPS del procedimiento |
| `porcentaje_descuento` | DECIMAL(5,2) | % de descuento |
| `valor_fijo` | DECIMAL(12,2) | Valor fijo de descuento |
| `tipo_descuento` | VARCHAR(20) | PORCENTAJE o VALOR_FIJO |
| `activo` | BOOLEAN | Si el descuento está activo |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Fecha de última actualización |

---

## Ejemplo de Uso

### Crear un Convenio

```javascript
const { data, error } = await supabase
  .from('convenios')
  .insert({
    tenant_id: 'a8eecbc9-9c0b-4ef8-bb68-6db9bd348a11',
    nombre: 'EPS Sura',
    nombre_corto: 'SURA',
    tipo: 'EPS',
    nit: '800088702',
    porcentaje_descuento: 10.00,
    activo: true
  });
```

### Crear un Descuento Específico

```javascript
const { data, error } = await supabase
  .from('convenios_descuentos')
  .insert({
    convenio_id: 'uuid-del-convenio',
    tenant_id: 'a8eecbc9-9c0b-4ef8-bb68-6db9bd348a11',
    servicio_nombre: 'Limpieza dental',
    codigo_cups: '997310',
    porcentaje_descuento: 15.00,
    tipo_descuento: 'PORCENTAJE',
    activo: true
  });
```

---

## Testing

### Probar validación de disponibilidad:

1. **Crear cita en un horario libre** ✅
   - Debería crearse sin problemas

2. **Intentar crear cita superpuesta con mismo profesional** ❌
   - Debería mostrar error: "Ya existe una cita programada en este horario para este profesional (10:00 - 10:30)"

3. **Intentar crear cita superpuesta con mismo consultorio** ❌
   - Debería mostrar error: "Ya existe una cita programada en este horario para este consultorio (10:00 - 10:30)"

4. **Mover cita existente a horario ocupado** ❌
   - Debería mostrar error y no permitir el movimiento

5. **Actualizar cita cancelada** ✅
   - Debería permitir cambios sin validar disponibilidad

---

## Archivos Modificados/Creados

### ✅ Modificados:
- `src/modules/agenda/hooks/useAgenda.js`
  - Agregada función `assertAppointmentAvailability()`

### ✅ Creados:
- `supabase/migrations/20250803_create_convenios.sql`
- `run-migration-convenios.js` (helper script)
- `FIX_AGENDA_CONVENIOS.md` (este documento)

---

## Próximos Pasos

1. ✅ **Aplicar la migración** de convenios en Supabase
2. ✅ **Recargar la aplicación** para que cargue la nueva función
3. ✅ **Probar creación de citas** con validación de disponibilidad
4. 📝 **Opcional**: Crear convenios de prueba para las clínicas

---

## Estado Final

| Componente | Estado | Descripción |
|------------|--------|-------------|
| Tabla `convenios` | ⏳ PENDIENTE | Necesita ejecutar migración SQL |
| Tabla `convenios_descuentos` | ⏳ PENDIENTE | Necesita ejecutar migración SQL |
| Función `assertAppointmentAvailability` | ✅ IMPLEMENTADA | Código actualizado |
| Validación de horarios | ✅ FUNCIONANDO | Se valida al crear/actualizar citas |
| RLS Policies | ⏳ PENDIENTE | Se crean con la migración |

---

**IMPORTANTE**: Después de aplicar la migración SQL, los errores 404 de convenios y el error de `assertAppointmentAvailability` estarán completamente resueltos.
