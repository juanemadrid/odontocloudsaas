# Instrucciones para Migración de Base de Datos Supabase

## ⚠️ IMPORTANTE - LEER ANTES DE EJECUTAR

Este sistema ahora trabaja **EXCLUSIVAMENTE con Supabase** como base de datos principal. Se ha eliminado toda dependencia de Firestore para datos de pacientes.

## 🎯 Objetivo de la Migración

Expandir la tabla `pacientes` en Supabase para incluir **TODOS** los campos del formulario de pacientes, permitiendo almacenar:

- ✅ Barrio, estrato, zona residencial
- ✅ Estado civil
- ✅ Datos del responsable (nombre, parentesco, teléfonos, email)
- ✅ Datos del acompañante (nombre, teléfono)
- ✅ Alertas médicas
- ✅ Notas del paciente
- ✅ Datos de marketing (campaña, remitido por, asesor comercial)
- ✅ Profesional asignado
- ✅ Foto del paciente
- ✅ Y muchos más campos...

## 📋 Pasos para Ejecutar la Migración

### Opción 1: Desde el Dashboard de Supabase (Recomendado)

1. **Acceder al Dashboard de Supabase**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto de OdontoCloud

2. **Abrir el SQL Editor**
   - En el menú lateral izquierdo, busca "SQL Editor"
   - Haz clic en "New query"

3. **Copiar y Pegar el Script de Migración**
   - Abre el archivo: `supabase/migrations/20250127_add_patient_fields.sql`
   - Copia TODO el contenido del archivo
   - Pega el contenido en el editor SQL

4. **Ejecutar la Migración**
   - Haz clic en el botón "RUN" (esquina inferior derecha)
   - Espera a que la ejecución termine
   - Verifica que aparezca el mensaje: "Success. No rows returned"

5. **Verificar los Cambios**
   - Ve a "Table Editor" en el menú lateral
   - Selecciona la tabla `pacientes`
   - Verifica que aparezcan todas las nuevas columnas

### Opción 2: Usando Supabase CLI (Para desarrolladores avanzados)

```bash
# 1. Asegúrate de tener Supabase CLI instalado
npm install -g supabase

# 2. Navega al directorio del proyecto
cd "e:\copia de seguridad\odontocloud-react"

# 3. Vincula tu proyecto (si no lo has hecho)
supabase link --project-ref TU_PROJECT_REF

# 4. Ejecuta la migración
supabase db push

# 5. Verifica que se aplicó correctamente
supabase db diff
```

## ✅ Verificación Post-Migración

Después de ejecutar la migración, verifica que:

1. **La tabla `pacientes` tiene las nuevas columnas**:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'pacientes' 
   ORDER BY ordinal_position;
   ```

2. **Los índices se crearon correctamente**:
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'pacientes';
   ```

## 🔄 Cambios en el Código

Los siguientes archivos han sido actualizados para trabajar SOLO con Supabase:

### 1. `src/services/patientService.js`
- ❌ **ELIMINADO**: Sincronización con Firestore
- ✅ **ACTUALIZADO**: Payload completo con todos los campos
- ✅ **ACTUALIZADO**: Mapeo completo de campos Supabase ↔ Frontend

### 2. `src/modules/pacientes/components/PatientDetails.jsx`
- ❌ **ELIMINADO**: Carga desde Firestore
- ✅ **ACTUALIZADO**: Carga SOLO desde Supabase
- ✅ **ACTUALIZADO**: Todos los campos usan `isRequired()` dinámicamente

## 📊 Nuevos Campos Agregados

La migración agrega **45+ columnas nuevas** a la tabla `pacientes`:

### Identificación
- `nro_historia`, `fecha_ingreso`, `estado_civil`, `es_extranjero`, `permite_publicidad`, `registro_completo`

### Ubicación
- `pais_nacimiento`, `ciudad_nacimiento`, `pais_domicilio`, `ciudad_domicilio`, `barrio`, `lugar_residencia`, `estrato`, `zona_residencial`

### Contacto
- `prefijo_celular`, `telefono_domicilio`, `telefono_oficina`, `extension`

### EPS y Aseguramiento
- `poliza_salud`, `plan_id`, `plan_nombre`

### Marketing
- `convenio_beneficio`, `convenio_pago`, `como_conocio`, `campania`, `remitido_por_type`, `remitido_por_value`, `asesor_comercial_type`, `asesor_comercial_value`

### Profesional
- `profesional_id`, `profesional_nombre`

### Responsable
- `nombre_responsable`, `parentesco`, `celular_responsable`, `telefono_responsable`, `email_responsable`

### Acompañante
- `nombre_acompanante`, `telefono_acompanante`

### Otros
- `alertas`, `notas`, `foto_url`, `updated_at`

## 🚨 Notas Importantes

1. **Esta migración es NO DESTRUCTIVA**: Solo agrega columnas nuevas, no elimina ni modifica datos existentes.

2. **Los valores por defecto están configurados**: Las columnas nuevas tendrán valores por defecto apropiados para los registros existentes.

3. **Los índices mejoran el rendimiento**: Se crean índices en las columnas más consultadas para optimizar las búsquedas.

4. **Rollback (si es necesario)**: Si algo sale mal, puedes revertir ejecutando:
   ```sql
   -- SOLO EJECUTAR SI NECESITAS REVERTIR
   ALTER TABLE public.pacientes 
   DROP COLUMN IF EXISTS nro_historia,
   DROP COLUMN IF EXISTS fecha_ingreso,
   -- ... (listar todas las columnas agregadas)
   ```

## 📞 Soporte

Si encuentras algún problema durante la migración:
1. Verifica los logs de Supabase en el Dashboard
2. Revisa que tu usuario tenga permisos suficientes
3. Contacta al equipo de desarrollo

## ✨ Resultado Final

Después de esta migración, el sistema:
- ✅ Guarda TODOS los campos en Supabase
- ✅ NO depende de Firestore para datos de pacientes
- ✅ Los asteriscos (*) aparecen dinámicamente según configuración del tenant
- ✅ Todos los datos persisten correctamente después de refrescar (F5)
- ✅ Validación visual muestra campos faltantes en rojo

---

**Fecha de Creación**: 27 de Enero de 2025  
**Versión de Migración**: 20250127_add_patient_fields
