# Requerimientos: Persistencia de Datos de Pacientes

## Problema Original
Los datos de pacientes no persistían después de guardar y refrescar la página. Los campos se guardaban momentáneamente pero al hacer F5 volvían a aparecer vacíos.

## Análisis Realizado
- El sistema usa **arquitectura dual**: Supabase (PostgreSQL) + Firestore
- **Supabase**: Base de datos principal con esquema limitado (solo campos básicos)
- **Firestore**: Base de datos secundaria para sincronización con esquema completo
- El problema era que el frontend cargaba desde Firestore pero guardaba solo en Supabase

## Solución Implementada

### 1. Guardado Dual
**Archivo**: `src/services/patientService.js`
- **Supabase**: Guarda solo campos básicos que existen en el esquema de la tabla
- **Firestore**: Guarda TODOS los campos detallados (60+ campos)

```javascript
// Payload de Supabase (campos básicos solamente)
const payload = {
    tenant_id, tipo_documento, documento, nombres, apellidos,
    fecha_nacimiento, genero, telefono, email, direccion, ciudad,
    ocupacion, eps, tipo_afiliacion, historial_medico, contacto_emergencia, activo
};

// Payload de Firestore (TODOS los campos)
const firestorePayload = {
    ...todosLosCamposDelFormulario,
    barrio, estrato, zona_residencial, estado_civil, prefijoCelular,
    telDomicilio, telOficina, extension, paisNacimiento, ciudadNacimiento,
    paisDomicilio, ciudadDomicilio, esExtranjero, permitePublicidad,
    nombreResponsable, parentesco, celularResponsable, telefonoResponsable,
    emailResponsable, nombreAcompanante, telefonoAcompanante,
    remitidoPorType, remitidoPorValue, asesorComercialType, asesorComercialValue,
    notas, alertas, fotoUrl, polizaSalud, planId, planNombre,
    convenioBeneficio, convenioPago, comoConocio, campania,
    profesionalId, profesionalNombre, fechaIngreso
};
```

### 2. Carga Priorizada
**Archivo**: `src/modules/pacientes/components/PatientDetails.jsx`
- **Prioridad 1**: Cargar desde Firestore (tiene todos los campos)
- **Fallback**: Cargar desde Supabase si Firestore está vacío

### 3. Prevención de Sobrescritura
- Eliminado polling automático que causaba loop infinito
- Eliminada recarga automática después de guardar
- Los datos guardados se mantienen en el estado local sin recargar de BD

### 4. Mapeo Completo de Campos
**Archivo**: `src/services/patientService.js` - función `getPatientById`
- Mapeo bidireccional entre nombres de campos de Supabase ↔ Frontend
- Ejemplo: `pais_nacimiento` ↔ `paisNacimiento`

## Campos Completos Soportados

### Datos de Identificación
- tipoDocumento, nroDocumento, nombres, apellidos, nombreCompleto
- fechaNacimiento, sexo, estadoCivil, fechaIngreso

### Datos de Contacto
- celular, prefijoCelular, telDomicilio, telOficina, extension, email

### Datos de Ubicación
- paisNacimiento, ciudadNacimiento
- paisDomicilio, ciudadDomicilio, barrio, lugarResidencia
- zonaResidencial, estrato

### Datos de Salud
- nombreEps, tipoVinculacion, polizaSalud
- alertas, notas, ocupacion

### Datos Comerciales
- planId, planNombre, convenioBeneficio, convenioPago
- comoConocio, campania
- remitidoPorType, remitidoPorValue
- asesorComercialType, asesorComercialValue
- profesionalId, profesionalNombre

### Datos de Responsable
- nombreResponsable, parentesco
- celularResponsable, telefonoResponsable, emailResponsable

### Datos de Acompañante
- nombreAcompanante, telefonoAcompanante

### Otros
- esExtranjero, permitePublicidad
- fotoUrl, registroCompleto

## Archivos Modificados

1. **`src/services/patientService.js`**
   - `createOrUpdatePatient()`: Guardado dual Supabase + Firestore
   - `getPatientById()`: Mapeo completo de campos

2. **`src/modules/pacientes/components/PatientDetails.jsx`**
   - `useEffect` de carga: Prioridad Firestore → Supabase
   - `submitForm()`: Sin recarga automática
   - `handlePartialSave()`: Sin recarga automática

3. **`src/modules/agenda/components/AppointmentModal.jsx`**
   - Fix: Input controlado `value={term || ""}`

## Pruebas Necesarias

- [ ] Guardar datos básicos y verificar persistencia (F5)
- [ ] Guardar barrio y verificar persistencia
- [ ] Guardar estrato y verificar persistencia
- [ ] Guardar estado civil y verificar persistencia
- [ ] Guardar datos de responsable y verificar persistencia
- [ ] Guardar datos de acompañante y verificar persistencia
- [ ] Guardar alertas médicas y verificar persistencia
- [ ] Subir foto y verificar persistencia
- [ ] Guardar desde tab "Datos Personales"
- [ ] Guardar desde tab "EPS"
- [ ] Guardar desde tab "Marketing"

## Logs de Diagnóstico

El sistema ahora muestra logs claros:
- `🔥 Cargando desde Firestore (fuente completa)...`
- `✅ Datos cargados desde Firestore`
- `💾 createOrUpdatePatient - Iniciando guardado`
- `✅ Paciente actualizado en Supabase`
- `✅ Paciente sincronizado exitosamente en Firestore con TODOS los campos`
