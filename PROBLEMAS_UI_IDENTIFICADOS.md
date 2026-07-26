# 🐛 Problemas UI/UX Identificados

## 1. ✅ **Sucursales - Validación de Campos Obligatorios**

**Archivo:** `src/modules/config/EmpresaSucursales.jsx`

**Problema:** Permite guardar aunque campos con asterisco (*) estén vacíos

**Campos que deben validarse:**
- ✅ Nombre (ya validado)
- ❌ Teléfono fijo *
- ❌ Celular *
- ❌ Ciudad *
- ❌ Dirección *
- ❌ Correo electrónico *
- ❌ Consecutivo *
- ❌ Lista de precios *
- ❌ Almacenes * (mínimo 1)

**Solución:** Agregar validaciones completas en `handleSave()` línea 89-103

---

## 2. ❌ **Consecutivos - No Guarda Datos**

**Archivos:**
- `src/modules/config/ConfigConsecutivos.jsx`
- `src/modules/config/ConfigConsecutivosForm.jsx`

**Problemas:**
1. `handleSubmit()` solo hace `console.log` - NO guarda en Firebase (línea 56-60)
2. Botones de Editar/Eliminar NO tienen funcionalidad (línea 125-131)
3. Los datos en tabla son estáticos (mock data)

**Solución:**
- Implementar guardado con Firebase (addDoc/updateDoc)
- Conectar botones de acciones
- Cargar datos reales desde Firebase

---

## 3. ❌ **Doctores - Falta Campo Especialidad**

**Archivo:** `src/modules/config/ConfigUsuarios.jsx`

**Problema:** Al crear doctor NO hay campo para seleccionar especialidades

**Estado actual:**
- ✅ Checkbox "¿Es doctor?"
- ❌ NO hay selector de especialidades

**Solución:** Agregar multi-select de especialidades (línea 224-260)

---

## 4. ⚠️ **Pestañas Clínicas - Verificar Plantillas**

**Archivo:** `src/modules/config/ConfigPestanasMedicas.jsx`

**Estado:** El módulo SÍ está implementado correctamente

**Verificar:**
- Que existan plantillas en: `tenants/{inquilino}/plantillas_clinicas`
- Si no hay plantillas, crear algunas de ejemplo

---

## 5. ⚠️ **Agenda - Doctores y Consultorio**

**Archivo:** `src/modules/agenda/components/AppointmentModal.jsx`

**Problemas:**
1. Doctores NO aparecen si no tienen campo `especialidades[]` poblado
2. Campo "Servicio / Procedimiento" debe ELIMINARSE (línea 505-511)
3. Consultorios no se filtran por sucursal

**Solución:**
- Asegurar que doctores tengan campo `especialidades`
- Eliminar campo "Servicio / Procedimiento"
- Filtrar consultorios por contexto actual

---

## 6. ❌ **Pacientes - Múltiples Problemas UX**

**Archivo:** `src/modules/pacientes/components/PatientForm.jsx`

**Problemas:**

### A. Letras en Mayúsculas Forzadas
- **nombreEps** (línea 633): clase CSS `uppercase`
- **nombreCompleto** (línea 445): `.toUpperCase()` en JavaScript
- **Otros campos:** Revisar todos los inputs con clase `uppercase`

### B. Ciudad sin Dropdown
- **ciudadNacimiento** (línea 463): input texto libre
- **ciudadDomicilio** (línea 483): input texto libre
- **Solución:** Cambiar a `<select>` con `CIUDADES_COLOMBIA`

### C. Campo "Remitido Por" Incompleto
- Debe permitir: "Libre" (texto) o "Seleccionar" (usuario/paciente)
- Actualmente no visible en código

---

## 🎯 Prioridad de Correcciones

### Alta Prioridad:
1. ✅ Sucursales - Validaciones
2. ❌ Consecutivos - Guardar datos
3. ❌ Doctores - Campo especialidad
4. ❌ Pacientes - Mayúsculas y ciudades

### Media Prioridad:
5. ⚠️ Agenda - Eliminar campo servicio
6. ⚠️ Agenda - Filtrar doctores/consultorios

### Baja Prioridad:
7. ⚠️ Pestañas - Verificar plantillas

---

## 📝 Notas Técnicas

### Arrays de Datos Existentes:
- `CIUDADES_COLOMBIA` - Ya existe en `EmpresaSucursales.jsx` (líneas 8-19)
- `SEXOS`, `PAISES` - Ya existen en `PatientForm.jsx`

### Colecciones Firebase:
- `sucursales` - Sedes físicas
- `consecutivos` - Numeración documentos
- `users` - Usuarios/doctores
- `especialidades` - Especialidades médicas
- `tenants/{inquilino}/pestanas_medicas` - Pestañas clínicas
- `tenants/{inquilino}/plantillas_clinicas` - Plantillas
- `agenda` - Citas
- `pacientes` - Pacientes

---

**Fecha identificación:** 2026-07-04  
**Estado:** ✅ Documentado - Listo para corrección
