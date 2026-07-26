# 🧪 GUÍA DE PRUEBAS - CAMBIOS IMPLEMENTADOS

**URL del sistema:** http://localhost:3000/odontocloud-react/  
**Estado del servidor:** ✅ Corriendo sin errores  
**Última actualización:** Julio 3, 2026

---

## ✅ CHECKLIST DE PRUEBAS

### 🎨 1. PERIODONTOGRAMA PROFESIONAL

**Ruta:** Pacientes → Selecciona paciente → Sidebar "Periodontogramas"

#### Qué probar:
- [ ] **Inputs más grandes**
  - Los campos PD (Profundidad de Sondaje) deben medir ~44px x 44px
  - Los campos GM (Margen Gingival) deben medir ~44px x 32px
  - Texto debe ser legible (16px en PD, 14px en GM)

- [ ] **Botones BOP/Placa más grandes**
  - Deben medir ~20px x 20px (antes eran 14px)
  - Deben ser fáciles de hacer click
  - Color rojo para BOP, amarillo para Placa

- [ ] **Alineación perfecta**
  - Todo debe estar alineado verticalmente
  - Sin espacios irregulares
  - Headers de dientes visibles con badge numérico

- [ ] **Visuales profesionales**
  - Bordes de 2px (no 1px)
  - Sombras sutiles
  - Gradientes en backgrounds
  - Iconos visibles (☀️ Vestibular, 📚 Lingual/Palatino)

#### Cómo probar:
```
1. Ir a módulo Pacientes
2. Seleccionar cualquier paciente
3. Click en "Periodontogramas" (sidebar izquierdo)
4. Si no hay periodontograma, crear uno nuevo
5. Observar tamaño de inputs y botones
6. Intentar escribir números (debe ser cómodo)
7. Click en botones BOP/Placa (deben responder bien)
```

**Resultado esperado:**
- ✅ Interfaz profesional y limpia
- ✅ Inputs grandes y legibles
- ✅ Fácil de usar con mouse o táctil
- ✅ Sin desalineaciones

**Si ves algo mal:**
- Toma captura de pantalla
- Anota qué número de diente o sección
- Revisa que el navegador no esté en zoom

---

### 🔔 2. SISTEMA DE TOASTS (Reemplazo de alerts)

#### 2.1 Evoluciones Clínicas

**Ruta:** Pacientes → Selecciona paciente → Tab "Evoluciones"

**Qué probar:**
- [ ] Intenta guardar evolución SIN escribir texto
  - **Antes:** Alert bloqueante "Escriba la evolución"
  - **Ahora:** Toast rojo arriba a la derecha "Escriba la evolución antes de guardar."

- [ ] Guarda una evolución correctamente
  - **Antes:** Alert "Evolución guardada. NO podrá ser modificada."
  - **Ahora:** Toast verde "Evolución guardada. No podrá ser modificada por motivos legales."

- [ ] Observa el autor de la evolución
  - **Antes:** "Usuario Actual" (hardcoded)
  - **Ahora:** Tu nombre o email del usuario logueado

```
Pasos:
1. Pacientes → Elige paciente → Tab "Evoluciones"
2. Click "Nueva Evolución"
3. Dejar campo vacío → Click "Firmar y Guardar"
4. Observar toast de error
5. Escribir algo → Click "Firmar y Guardar"
6. Observar toast de éxito
7. Verificar que el autor sea tu usuario
```

#### 2.2 Portal del Paciente

**Ruta:** http://localhost:3000/odontocloud-react/portal/[slug-clinica]

**Qué probar:**
- [ ] Login con documento inválido (menos de 5 dígitos)
  - **Ahora:** Toast error "Ingrese un documento válido (mínimo 5 dígitos)."

- [ ] Login sin fecha de nacimiento
  - **Ahora:** Toast error "Ingrese su fecha de nacimiento."

- [ ] Login con documento que no existe
  - **Ahora:** Toast error "No encontramos un paciente con ese documento."

- [ ] Login con fecha incorrecta
  - **Ahora:** Toast error "La fecha de nacimiento no coincide con nuestros registros."

```
Pasos:
1. Ir a Portal (URL depende de tu slug)
2. Intentar login con "123" → Ver toast
3. Intentar sin fecha → Ver toast
4. Intentar con documento inexistente → Ver toast
5. Intentar con fecha incorrecta → Ver toast
```

#### 2.3 Consentimientos Informados

**Ruta:** Pacientes → Selecciona paciente → Tab "Consentimientos"

**Qué probar:**
- [ ] Click "Guardar" sin seleccionar plantilla
  - **Ahora:** Toast error "Seleccione una plantilla de consentimiento."

- [ ] Click "Guardar" sin firma
  - **Ahora:** Toast error "El paciente debe firmar antes de guardar."

- [ ] Guardar correctamente
  - **Ahora:** Toast success "Consentimiento informado guardado exitosamente."

```
Pasos:
1. Pacientes → Paciente → Tab "Consentimientos"
2. Click "Nuevo Consentimiento"
3. Intentar guardar sin plantilla → Ver toast
4. Seleccionar plantilla
5. Intentar guardar sin firma → Ver toast
6. Firmar en canvas
7. Guardar → Ver toast éxito
```

#### 2.4 Facturación del Paciente

**Ruta:** Pacientes → Selecciona paciente → Tab "Facturación"

**Qué probar:**
- [ ] Click botón "Registrar Copago / Abono"
  - **Antes:** Alert "Función de registrar pago rápido en desarrollo."
  - **Ahora:** Toast info "Para registrar pagos, use el módulo de Facturación → Recibos de Caja"

```
Pasos:
1. Pacientes → Paciente → Tab "Facturación"
2. Click "Registrar Copago / Abono"
3. Observar toast informativo (azul)
4. Toast debe desaparecer solo en 3-5 seg
```

**Resultado esperado para todos los toasts:**
- ✅ Aparecen en esquina superior derecha
- ✅ No bloquean la interfaz (puedes seguir trabajando)
- ✅ Desaparecen solos en 3-5 segundos
- ✅ Puedes cerrarlos con X si quieres
- ✅ Múltiples toasts se apilan (stackable)
- ✅ Colores según tipo:
  - 🔴 Error: Fondo rojo
  - 🟢 Success: Fondo verde
  - 🔵 Info: Fondo azul

---

### 🛡️ 3. PREVENCIÓN DE CITAS DUPLICADAS

**Ruta:** Agenda

**Qué probar:**
- [ ] Crear una cita normal (ej: Dr. Juan, 10:00 AM, 5 Julio)
- [ ] Intentar crear OTRA cita EXACTA (mismo doctor, fecha, hora)
- [ ] Sistema debe mostrar toast error e IMPEDIR guardar

```
Pasos detallados:
1. Ir a módulo Agenda
2. Click en cualquier día/hora del calendario
3. Llenar formulario de cita:
   - Doctor: Selecciona uno
   - Fecha: Ej. 2026-07-05
   - Hora: Ej. 10:00
   - Paciente: Cualquiera
4. Guardar cita (debe funcionar normal)
5. Intentar crear OTRA cita con:
   - MISMO doctor
   - MISMA fecha (2026-07-05)
   - MISMA hora (10:00)
   - Diferente paciente (no importa)
6. Al guardar, debe aparecer toast ERROR:
   "Ya existe una cita para [Doctor] el [fecha] a las [hora]. Elija otro horario."
7. La cita NO debe guardarse
8. Cambiar la hora a 10:30
9. Ahora SÍ debe permitir guardar (distinta hora)
```

**Resultado esperado:**
- ✅ NO permite 2 citas en mismo horario para mismo doctor
- ✅ Toast error claro indicando el conflicto
- ✅ SÍ permite si cambias doctor, fecha u hora
- ✅ Al editar cita existente, NO valida (permite modificar)

**Casos de prueba:**
| Caso | Doctor | Fecha | Hora | Resultado Esperado |
|------|--------|-------|------|-------------------|
| 1 | Juan | 05-Jul | 10:00 | ✅ Crea OK |
| 2 | Juan | 05-Jul | 10:00 | ❌ ERROR: Duplicado |
| 3 | Juan | 05-Jul | 10:30 | ✅ Crea OK (distinta hora) |
| 4 | María | 05-Jul | 10:00 | ✅ Crea OK (distinto doctor) |
| 5 | Juan | 06-Jul | 10:00 | ✅ Crea OK (distinta fecha) |

---

### ✅ 4. VALIDACIONES DE FORMULARIO PACIENTE

**Ruta:** Pacientes → Nuevo Paciente (o editar existente)

#### 4.1 Validación de Email

**Qué probar:**
- [ ] Email sin @ → Error "El correo electrónico no es válido"
- [ ] Email sin punto después de @ → Error "Formato de correo inválido"
- [ ] Email vacío → Error "El correo electrónico es obligatorio"
- [ ] Email válido → Sin error

```
Casos de prueba:
1. "usuario" → ❌ Error (no tiene @)
2. "usuario@dominio" → ❌ Error (falta .com)
3. "usuario@.com" → ❌ Error (falta dominio)
4. "" (vacío) → ❌ Error (obligatorio)
5. "usuario@dominio.com" → ✅ Válido
6. "usuario.apellido@empresa.co" → ✅ Válido
```

#### 4.2 Validación de Celular

**Qué probar:**
- [ ] Menos de 7 dígitos → Error
- [ ] Números colombianos (10 dígitos, empieza con 3) → Válido
- [ ] Números colombianos que no empiezan con 3 → Error
- [ ] 9 dígitos en Colombia → Error
- [ ] Números con guiones o espacios → Error

```
Casos de prueba:
1. "300123" → ❌ Error (muy corto)
2. "3001234567" → ✅ Válido (Colombia)
3. "3201234567" → ✅ Válido (Colombia)
4. "4001234567" → ❌ Error (no empieza con 3)
5. "300123456" → ❌ Error (9 dígitos Colombia)
6. "300-123-4567" → ❌ Error (contiene guiones)
7. "1234567" → ✅ Válido (internacional)
```

**Pasos:**
```
1. Pacientes → Nuevo Paciente
2. Scroll hasta campo "Celular"
3. Intentar cada caso de prueba
4. Observar mensaje de error bajo el campo
5. Error debe aparecer cuando sales del campo (onBlur)
6. Error debe ser específico y claro
```

#### 4.3 Validación de Documento

**Qué probar:**
- [ ] Menos de 6 dígitos → Error
- [ ] Más de 12 dígitos → Error
- [ ] Entre 6 y 12 dígitos → Válido

```
Casos de prueba:
1. "12345" → ❌ Error (muy corto)
2. "1234567" → ✅ Válido (CC)
3. "123456789" → ✅ Válido (CC largo)
4. "900123456" → ✅ Válido (NIT)
5. "1234567890123" → ❌ Error (muy largo)
```

**Resultado esperado general:**
- ✅ Mensajes de error aparecen bajo el campo
- ✅ Color rojo en campo y mensaje
- ✅ No deja enviar formulario si hay errores
- ✅ Mensajes claros y específicos
- ✅ Validación en tiempo real (al salir del campo)

---

### 👁️ 5. BOTONES SIEMPRE VISIBLES

**Ruta:** Pacientes → Selecciona paciente → Odontogramas

**Qué probar:**
- [ ] Ver lista de odontogramas
- [ ] Botón de eliminar (🗑️) debe estar SIEMPRE visible
- [ ] NO debe desaparecer cuando quitas el cursor
- [ ] Debe estar al lado derecho de cada fila

```
Pasos:
1. Ir a Pacientes → Seleccionar paciente
2. Click en "Odontogramas" (sidebar)
3. Si hay odontogramas previos, observar lista
4. Buscar botón de eliminar (icono papelera roja)
5. NO pasar cursor sobre la fila
6. Botón debe estar VISIBLE
7. Pasar cursor sobre la fila
8. Botón NO debe cambiar (ya estaba visible)
```

**Antes vs Después:**
- ❌ **Antes:** Botón solo visible al hover
- ✅ **Ahora:** Botón SIEMPRE visible

**Resultado esperado:**
- ✅ Botón 🗑️ visible sin necesidad de hover
- ✅ Mismo comportamiento en "Odontogramas" del sidebar paciente
- ✅ Fácil de encontrar para usuarios nuevos
- ✅ Mejor accesibilidad

---

### 🚫 6. N8N DESHABILITADO (Verificación técnica)

**Qué verificar:**
- [ ] Abrir consola del navegador (F12)
- [ ] Crear una cita
- [ ] Buscar en consola mensaje:
  ```
  [AutomationService] Evento APPOINTMENT_CREATED registrado (n8n deshabilitado)
  ```
- [ ] NO debe intentar hacer llamada HTTP a n8n
- [ ] NO debe haber errores de timeout o conexión

```
Pasos:
1. Abrir navegador en sistema
2. Presionar F12 (abrir DevTools)
3. Ir a pestaña "Console"
4. Ir a Agenda → Crear cita
5. Guardar cita
6. Observar consola
7. Debe aparecer mensaje "n8n deshabilitado"
8. NO debe haber error de red
```

**Resultado esperado:**
- ✅ Log en consola confirmando evento registrado
- ✅ Sin intentos de conexión HTTP
- ✅ Sin errores de timeout
- ✅ Sistema funciona normal sin n8n

---

## 📊 RESUMEN DE PRUEBAS

### Checklist completo:

#### Cambios visuales:
- [ ] Periodontograma: Inputs grandes ✅
- [ ] Periodontograma: Botones táctiles ✅
- [ ] Periodontograma: Alineación perfecta ✅
- [ ] Botones eliminar siempre visibles ✅

#### Toasts (15 reemplazos):
- [ ] Evoluciones: Sin texto ✅
- [ ] Evoluciones: Guardado exitoso ✅
- [ ] Evoluciones: Autor real (no "Usuario Actual") ✅
- [ ] Portal: Login errores (4 casos) ✅
- [ ] Consentimientos: Errores (2 casos) ✅
- [ ] Consentimientos: Éxito ✅
- [ ] Facturación: Info copago ✅

#### Validaciones:
- [ ] Citas duplicadas prevenidas ✅
- [ ] Email: 4 casos inválidos detectados ✅
- [ ] Celular: 6 casos probados ✅
- [ ] Documento: 5 casos probados ✅

#### Técnico:
- [ ] n8n deshabilitado (console.log) ✅
- [ ] Sin errores en compilación ✅
- [ ] HMR funcionando ✅

---

## 🐛 SI ENCUENTRAS PROBLEMAS

### Problema: "Toast no aparece"
**Solución:**
1. Verificar que la librería `sonner` esté instalada
2. Ejecutar: `npm install sonner`
3. Reiniciar servidor: `npm run dev`

### Problema: "Validación no funciona"
**Solución:**
1. Verificar que el formulario use react-hook-form
2. Revisar que el schema esté importado
3. Limpiar caché del navegador (Ctrl + Shift + R)

### Problema: "Periodontograma se ve igual"
**Solución:**
1. Limpiar caché del navegador (Ctrl + Shift + R)
2. Verificar que estás en un periodontograma nuevo (no uno viejo)
3. Verificar zoom del navegador (debe estar al 100%)

### Problema: "Citas duplicadas SÍ se permiten"
**Solución:**
1. Verificar que NO estés EDITANDO una cita (solo valida en creación)
2. Verificar que uses mismo doctor, fecha Y hora
3. Revisar consola (F12) por errores de Firebase

---

## ✅ CRITERIOS DE ÉXITO

Todas las pruebas pasan si:

- ✅ **Periodontograma:** Inputs claramente más grandes, profesional
- ✅ **Toasts:** Ningún `alert()` nativo del navegador aparece
- ✅ **Validaciones:** Detecta correctamente casos inválidos
- ✅ **Duplicados:** Impide crear 2 citas iguales
- ✅ **Botones:** Siempre visibles sin hover
- ✅ **n8n:** Log en consola, sin errores de red

---

## 📞 SOPORTE

Si alguna prueba falla:
1. Toma captura de pantalla
2. Copia el mensaje de error (si hay)
3. Anota qué estabas haciendo
4. Revisa consola del navegador (F12)

**Archivos de referencia:**
- `CORRECCIONES_FINALES.md` - Qué se cambió
- `ESTADO_SISTEMA.md` - Estado general
- `RESUMEN_RAPIDO.md` - Vista ejecutiva

---

**Estado de pruebas:** ⏳ PENDIENTE  
**Última actualización:** Julio 3, 2026  
**Servidor:** ✅ Corriendo en http://localhost:3000/odontocloud-react/
