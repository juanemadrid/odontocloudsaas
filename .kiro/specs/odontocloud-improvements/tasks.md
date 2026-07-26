# Implementation Plan: OdontoCloud Improvements

## Overview

Este plan de implementación traduce el diseño técnico de mejoras de OdontoCloud en tareas ejecutables para un agente de código. Las tareas están organizadas en seis épicas principales que corresponden a las nuevas funcionalidades y correcciones críticas, construidas incrementalmente usando React, Firestore y Firebase Storage.

**Tecnología:** JavaScript/React con Hooks, Firebase/Firestore, Tailwind CSS

**Enfoque:** Implementación incremental con validación temprana mediante tests automáticos

## Tasks

- [ ] 1. Configurar infraestructura base y componentes compartidos
  - [-] 1.1 Crear hook personalizado useSignatureCapture
    - Implementar `src/hooks/useSignatureCapture.js` con lógica de captura de firma usando canvas HTML5
    - Incluir funciones: startDrawing, draw, stopDrawing, clear, getSignatureDataURL
    - Agregar soporte para mouse y touch events
    - _Requirements: 2.3, 3.3_
  
  - [~] 1.2 Crear componente SignatureCapture
    - Implementar `src/components/shared/SignatureCapture.jsx`
    - Integrar hook useSignatureCapture
    - Agregar UI con canvas responsivo, botones de limpiar y guardar
    - Incluir preview de firma antes de guardar
    - Exportar firma como data URL (PNG base64)
    - _Requirements: 2.2, 2.3, 3.2, 3.3_
  
  - [ ]* 1.3 Escribir tests unitarios para useSignatureCapture
    - Testear funciones de dibujo y limpieza
    - Validar exportación de data URL
    - _Requirements: 2.3, 3.3_
  
  - [-] 1.4 Crear hook usePaymentMethods
    - Implementar `src/hooks/usePaymentMethods.js`
    - Cargar métodos de pago dinámicos desde colección `metodos_pago` en Firestore
    - Filtrar por inquilino y estado activo
    - _Requirements: 10.1_
  
  - [ ] 1.5 Crear hook useProcedureStatus
    - Implementar `src/hooks/useProcedureStatus.js`
    - Calcular estado de procedimientos (total, realizados, porcentaje)
    - Calcular deuda total y procedimientos con deuda
    - _Requirements: 4.5, 5.2, 5.3_

- [ ] 2. Implementar funcionalidad de cálculo automático en recetas médicas
  - [~] 2.1 Modificar DocClinicoModal para agregar campos de frecuencia y duración
    - Actualizar estado de `recetaItems` para incluir `frecuenciaDiaria`, `duracionDias`, `cantidadOverride`
    - Agregar inputs numéricos para frecuencia diaria y duración en días
    - Implementar validación con Zod schema (números positivos > 0)
    - _Requirements: 1.1, 1.5_
  
  - [~] 2.2 Implementar lógica de cálculo automático de cantidad
    - Crear función `calcularCantidad(frecuencia, duracion)` que retorne `frecuencia × duracion`
    - Agregar efecto que recalcule cantidad cuando cambian frecuencia o duración
    - Permitir override manual de cantidad mediante flag `cantidadOverride`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 2.3 Escribir test de propiedad para cálculo de cantidad
    - **Property 1: Cálculo automático de cantidad de medicamentos**
    - **Validates: Requirements 1.1**
    - Generar casos con frecuencia y duración aleatorios positivos
    - Verificar que cantidad = frecuencia × duración
  
  - [ ]* 2.4 Escribir test de propiedad para validación de valores
    - **Property 2: Validación de valores positivos en recetas**
    - **Validates: Requirements 1.5**
    - Generar valores positivos, negativos, cero y no numéricos
    - Verificar aceptación solo de números positivos > 0

- [ ] 3. Implementar firmas digitales en recetas médicas
  - [~] 3.1 Agregar botón de firma en DocClinicoModal
    - Agregar columna de acciones con ícono de firma digital en tabla de recetas
    - Mostrar botón solo para recetas guardadas
    - _Requirements: 2.1_
  
  - [~] 3.2 Integrar SignatureCapture en DocClinicoModal
    - Agregar modal de captura de firma al hacer clic en ícono
    - Pasar datos del doctor (nombre, UID) al componente
    - _Requirements: 2.2_
  
  - [~] 3.3 Guardar firma digital en Firestore
    - Actualizar documento en colección `clinical_documents`
    - Agregar campos: `doctorSignature` (data URL), `signedAt` (ISO timestamp), `signedBy` (UID)
    - Implementar en `onSave` del SignatureCapture
    - _Requirements: 2.4, 2.6_
  
  - [~] 3.4 Mostrar firma en vista de impresión de receta
    - Agregar sección de firma digital en template de impresión
    - Mostrar imagen de firma si existe
    - Incluir fecha y nombre del doctor que firmó
    - _Requirements: 2.5_
  
  - [ ]* 3.5 Escribir test de propiedad para timestamps de firma
    - **Property 3: Presencia de timestamp en firmas digitales**
    - **Validates: Requirements 2.6**
    - Verificar que documentos con firma contengan `signedAt` válido en ISO 8601

- [~] 4. Checkpoint - Validar funcionalidad de recetas
  - Verificar que el cálculo automático funcione correctamente
  - Confirmar que las firmas se guarden y visualicen
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas

- [ ] 5. Implementar firmas digitales en evoluciones clínicas
  - [~] 5.1 Agregar botón de firma en EvolucionesTab
    - Agregar ícono de firma en columna de acciones de lista de evoluciones
    - Mostrar solo para evoluciones sin firma
    - _Requirements: 3.1_
  
  - [~] 5.2 Integrar SignatureCapture en EvolutionModal
    - Agregar modal de firma digital con mismo componente SignatureCapture
    - Configurar para contexto de evoluciones
    - _Requirements: 3.2, 3.3_
  
  - [~] 5.3 Guardar firma en Firestore manteniendo inmutabilidad
    - Actualizar documento en colección `clinical_evolutions`
    - Agregar solo campos: `doctorSignature`, `signedAt`, `signedBy`
    - Validar que no se modifiquen otros campos (mantener inmutabilidad)
    - _Requirements: 3.4, 3.5_
  
  - [~] 5.4 Mostrar firma en vista de impresión de evolución
    - Agregar sección de firma en template de impresión de evolución
    - Mostrar firma con metadata (fecha, doctor)
    - _Requirements: 3.6_

- [ ] 6. Implementar indicadores de procedimientos realizados en presupuestos
  - [~] 6.1 Crear componente ProcedureStatusIndicator
    - Implementar `src/modules/pacientes/components/ProcedureStatusIndicator.jsx`
    - Mostrar estado visual: pendiente (círculo gris) o realizado (círculo verde con checkmark)
    - Incluir fecha de realización cuando aplique
    - _Requirements: 4.2_
  
  - [~] 6.2 Modificar esquema de items en PlanEditor
    - Actualizar estructura de items del plan para incluir: `realizado` (boolean), `fechaRealizado` (ISO string), `marcadoPor` (UID)
    - Agregar checkbox para marcar procedimiento como realizado
    - Registrar fecha y usuario al marcar como realizado
    - _Requirements: 4.1_
  
  - [~] 6.3 Integrar ProcedureStatusIndicator en PlanEditor
    - Mostrar indicador visual para cada item del plan
    - Actualizar UI para incluir estado en lista de procedimientos
    - _Requirements: 4.2_
  
  - [~] 6.4 Implementar filtro por estado de procedimientos
    - Agregar selector de filtro: Todos / Pendientes / Realizados
    - Filtrar items según estado seleccionado
    - _Requirements: 4.3_
  
  - [ ]* 6.5 Escribir test de propiedad para filtrado
    - **Property 4: Filtrado correcto de procedimientos por estado**
    - **Validates: Requirements 4.3**
    - Generar listas de procedimientos con estados aleatorios
    - Verificar que filtro retorna solo items con estado correcto
  
  - [~] 6.6 Calcular y mostrar porcentaje de completitud
    - Crear función que calcule `(realizados / total) × 100`
    - Mostrar barra de progreso con porcentaje
    - Incluir contador: "X de Y procedimientos realizados"
    - _Requirements: 4.5_
  
  - [ ]* 6.7 Escribir test de propiedad para porcentaje de completitud
    - **Property 5: Cálculo de porcentaje de completitud**
    - **Validates: Requirements 4.5**
    - Generar presupuestos con diferentes cantidades de items realizados
    - Verificar cálculo correcto redondeado a 2 decimales

- [ ] 7. Implementar alertas de deuda por procedimientos realizados
  - [~] 7.1 Crear componente DebtAlertBanner
    - Implementar `src/modules/pacientes/components/DebtAlertBanner.jsx`
    - Mostrar alerta visual con monto de deuda y cantidad de procedimientos
    - Incluir botón para ir a módulo de pagos
    - _Requirements: 5.1_
  
  - [~] 7.2 Implementar lógica de cálculo de deuda
    - Crear función que identifique procedimientos realizados no cancelados
    - Calcular deuda: suma de `max(0, costoTotal - montoPagado)` por cada procedimiento
    - _Requirements: 5.1, 5.2_
  
  - [ ]* 7.3 Escribir tests de propiedad para deuda
    - **Property 6: Identificación de procedimientos con deuda**
    - **Validates: Requirements 5.1**
    - Verificar clasificación correcta de procedimientos con deuda
    - **Property 7: Cálculo de deuda total**
    - **Validates: Requirements 5.2**
    - Verificar suma correcta de deudas
  
  - [~] 7.4 Integrar DebtAlertBanner en PlanEditor
    - Mostrar banner cuando existan procedimientos con deuda
    - Pasar datos calculados: totalDeuda, cantidad de procedimientos
    - _Requirements: 5.1_
  
  - [~] 7.5 Agregar indicador de deuda en perfil de paciente
    - Modificar vista de perfil para mostrar badge de deuda
    - Mostrar solo si existen procedimientos realizados sin pagar completamente
    - _Requirements: 5.3_
  
  - [ ]* 7.6 Escribir test de propiedad para indicador de deuda
    - **Property 8: Indicador de deuda en perfil de paciente**
    - **Validates: Requirements 5.3**
    - Verificar visibilidad condicional del indicador
  
  - [~] 7.7 Implementar reporte de pacientes con deudas
    - Crear query de Firestore para filtrar pacientes con deuda
    - Generar lista con datos: nombre, monto adeudado, procedimientos pendientes
    - Agregar opción de exportar reporte
    - _Requirements: 5.4_
  
  - [ ]* 7.8 Escribir test de propiedad para reporte de deudas
    - **Property 9: Reporte de pacientes con deudas**
    - **Validates: Requirements 5.4**
    - Verificar que reporte incluya solo pacientes con deuda

- [~] 8. Checkpoint - Validar funcionalidad de presupuestos y deudas
  - Verificar que los indicadores de estado funcionen
  - Confirmar cálculos de deuda correctos
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas

- [ ] 9. Implementar pre-selección de procedimientos en módulo de pagos
  - [~] 9.1 Modificar PagoTab para pre-seleccionar procedimientos con deuda
    - Al acceder desde un presupuesto con deuda, identificar procedimientos realizados no cancelados
    - Pre-seleccionar automáticamente estos procedimientos en el formulario de pago
    - Mantener opción de modificar selección manualmente
    - _Requirements: 5.5_
  
  - [ ]* 9.2 Escribir test de propiedad para pre-selección
    - **Property 10: Pre-selección de procedimientos realizados no cancelados**
    - **Validates: Requirements 5.5**
    - Verificar que solo procedimientos con deuda sean pre-seleccionados

- [ ] 10. Implementar justificación de anulación de pagos
  - [~] 10.1 Crear componente PaymentDeletionModal
    - Implementar `src/modules/pacientes/components/PaymentDeletionModal.jsx`
    - Incluir textarea para motivo de anulación
    - Validar mínimo 10 caracteres con Zod schema
    - Mostrar datos del pago a anular
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 10.2 Escribir test de propiedad para validación de motivo
    - **Property 11: Validación de longitud de motivo de anulación**
    - **Validates: Requirements 6.2**
    - Generar strings de diferentes longitudes
    - Verificar aceptación solo de strings con >= 10 caracteres
  
  - [~] 10.3 Integrar PaymentDeletionModal en PagoTab
    - Reemplazar confirmación simple por modal con justificación
    - Capturar input del usuario antes de anular
    - _Requirements: 6.1_
  
  - [~] 10.4 Actualizar lógica de anulación en Firestore
    - Modificar documento de pago para agregar estado 'Anulado'
    - Agregar campos: `anuladoEn` (Timestamp), `anuladoPor` (UID), `motivoAnulacion` (string)
    - Mantener registro histórico sin eliminar documento
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [ ]* 10.5 Escribir tests de propiedad para auditoría
    - **Property 12: Auditoría de operaciones críticas**
    - **Validates: Requirements 6.4**
    - Verificar presencia de campos de auditoría en operaciones críticas
    - **Property 13: Consulta de pagos anulados**
    - **Validates: Requirements 6.5**
    - Verificar filtros de consulta de pagos anulados
  
  - [~] 10.6 Actualizar vista de histórico de pagos
    - Mostrar pagos anulados con estilo distintivo (tachado, color rojo)
    - Agregar tooltip con motivo de anulación
    - Permitir filtrar por estado: Todos / Completados / Anulados
    - _Requirements: 6.5_

- [ ] 11. Implementar edición de imágenes de radiografías
  - [~] 11.1 Crear componente ImageEditor
    - Implementar `src/modules/pacientes/components/ImageEditor.jsx`
    - Permitir selección de nueva imagen desde dispositivo
    - Incluir preview de imagen actual y nueva
    - Agregar botones: Cancelar, Guardar cambios
    - _Requirements: 7.1, 7.2_
  
  - [~] 11.2 Agregar botón de edición en PatientRxTab
    - Agregar ícono de editar en acciones de cada imagen
    - Abrir ImageEditor al hacer clic
    - _Requirements: 7.1_
  
  - [~] 11.3 Implementar lógica de reemplazo de imagen
    - Subir nueva imagen a Firebase Storage
    - Mover imagen anterior a carpeta de versiones
    - Actualizar documento del paciente con nueva URL
    - _Requirements: 7.2_
  
  - [~] 11.4 Implementar historial de versiones
    - Agregar array `versiones` en schema de imagen
    - Registrar: URL anterior, path, timestamp, usuario editor, número de versión
    - Agregar campo `ultimaEdicion` con fecha y usuario
    - _Requirements: 7.3, 7.4_
  
  - [ ]* 11.5 Escribir test de propiedad para versionado
    - **Property 14: Historial de versiones incremental**
    - **Validates: Requirements 7.3**
    - Verificar secuencia correcta de números de versión
  
  - [~] 11.6 Agregar opción de restaurar versión anterior
    - Mostrar lista de versiones en modal
    - Permitir visualizar versiones anteriores
    - Implementar restauración de versión seleccionada
    - _Requirements: 7.5_

- [ ] 12. Corrección: Funcionalidad de guardado de presupuesto
  - [~] 12.1 Validar campos requeridos antes de guardar
    - Implementar validación Zod para campos obligatorios: `title`, `items[]`
    - Validar cada item: `desc` no vacío, `amount > 0`
    - Mostrar mensajes de error específicos por campo
    - _Requirements: 8.1_
  
  - [ ]* 12.2 Escribir test de propiedad para validación
    - **Property 15: Validación de campos requeridos en presupuesto**
    - **Validates: Requirements 8.1**
    - Verificar rechazo de presupuestos con campos inválidos
  
  - [~] 12.3 Mejorar manejo de estados del botón guardar
    - Deshabilitar botón durante guardado para prevenir duplicados
    - Mostrar spinner y texto "Guardando..." durante proceso
    - Habilitar de nuevo después de éxito o error
    - _Requirements: 8.5_
  
  - [~] 12.4 Implementar manejo de errores robusto
    - Categorizar errores de Firestore (permission-denied, unavailable, etc.)
    - Mostrar mensajes de error descriptivos con toast
    - Mantener datos en formulario si falla guardado
    - _Requirements: 8.3, 8.4_
  
  - [~] 12.5 Agregar mensaje de confirmación exitosa
    - Mostrar toast de éxito al guardar
    - Actualizar lista de presupuestos sin recargar página
    - _Requirements: 8.2_

- [ ] 13. Corrección: Validación de descuentos en presupuesto
  - [~] 13.1 Implementar función de cálculo de descuento máximo
    - Calcular subtotal de items: `Σ(amount × qty - descuento_item)`
    - Definir descuento máximo permitido = subtotal
    - _Requirements: 9.2_
  
  - [~] 13.2 Validar descuento al ingresar
    - Agregar validación en tiempo real en campo de descuento
    - Mostrar error si descuento > subtotal
    - Prevenir guardado con descuento inválido
    - _Requirements: 9.1, 9.3_
  
  - [ ]* 13.3 Escribir tests de propiedad para descuentos
    - **Property 16: Validación de descuento máximo**
    - **Validates: Requirements 9.1**
    - Verificar aceptación solo de descuentos válidos (0 <= D <= subtotal)
    - **Property 17: Cálculo de descuento máximo permitido**
    - **Validates: Requirements 9.2**
    - Verificar cálculo correcto del máximo permitido
  
  - [~] 13.4 Revalidar descuentos al modificar items
    - Agregar efecto que recalcule subtotal cuando cambian items
    - Revalidar descuento existente contra nuevo subtotal
    - Ajustar descuento automáticamente si excede nuevo máximo
    - _Requirements: 9.5_
  
  - [~] 13.5 Mostrar porcentaje de descuento
    - Calcular: `(descuento / subtotal) × 100`
    - Mostrar porcentaje junto al campo de descuento
    - Actualizar en tiempo real
    - _Requirements: 9.4_
  
  - [ ]* 13.6 Escribir test de propiedad para porcentaje
    - **Property 18: Cálculo de porcentaje de descuento**
    - **Validates: Requirements 9.4**
    - Verificar cálculo correcto redondeado a 2 decimales

- [ ] 14. Corrección: Campo de referencia condicional en pagos
  - [~] 14.1 Implementar lógica de visibilidad condicional
    - Definir lista de medios que requieren referencia: Transferencia, Tarjeta, Cheque, Consignación, Nequi, Daviplata, PSE
    - Mostrar campo `referencia` solo cuando medio de pago está en lista
    - Ocultar cuando medio es Efectivo u otro que no requiere
    - _Requirements: 10.1, 10.2_
  
  - [ ]* 14.2 Escribir test de propiedad para visibilidad
    - **Property 19: Visibilidad condicional de campo referencia**
    - **Validates: Requirements 10.1, 10.2**
    - Verificar visibilidad correcta según medio de pago
  
  - [~] 14.3 Implementar validación condicional
    - Agregar validación Zod condicional: si medio requiere referencia, campo es obligatorio
    - Validar formato alfanumérico, máximo 50 caracteres
    - Mostrar error si falta referencia requerida
    - _Requirements: 10.3, 10.4_
  
  - [ ]* 14.4 Escribir test de propiedad para validación
    - **Property 20: Validación condicional de referencia**
    - **Validates: Requirements 10.3, 10.4**
    - Verificar validación correcta según medio de pago
  
  - [~] 14.5 Actualizar schema de pagos en Firestore
    - Modificar campo `referencia` de obligatorio a nullable
    - Agregar validación en Security Rules según medio de pago
    - _Requirements: 10.5_

- [ ] 15. Corrección: Aplicación correcta de saldo a favor
  - [~] 15.1 Implementar función de cálculo de saldo a aplicar
    - Crear función: `calcularSaldoAAplicar(saldoDisponible, valorProcedimientos)`
    - Retornar: `Math.min(saldoDisponible, valorProcedimientos)`
    - _Requirements: 11.1_
  
  - [ ]* 15.2 Escribir test de propiedad para aplicación de saldo
    - **Property 21: Aplicación correcta de saldo a favor**
    - **Validates: Requirements 11.1, 11.4**
    - Generar casos con diferentes valores de saldo y procedimientos
    - Verificar que monto aplicado = min(saldo, total)
  
  - [~] 15.3 Actualizar lógica de pago en PagoTab
    - Usar función de cálculo de saldo a aplicar
    - Calcular nuevo saldo: `saldoOriginal - montoAplicado`
    - Prevenir aplicación de más saldo del necesario
    - _Requirements: 11.1, 11.2_
  
  - [ ]* 15.4 Escribir tests de propiedad para cálculo de saldo
    - **Property 22: Cálculo de nuevo saldo**
    - **Validates: Requirements 11.2**
    - Verificar: nuevoSaldo = saldoOriginal - montoAplicado
    - **Property 23: Registro de saldo aplicado**
    - **Validates: Requirements 11.5**
    - Verificar campo `monto` en documento de pago
  
  - [~] 15.5 Mejorar UI de aplicación de saldo
    - Mostrar claramente: saldo disponible, monto a aplicar, saldo restante
    - Agregar confirmación visual antes de aplicar
    - Incluir preview de cálculos
    - _Requirements: 11.3_
  
  - [~] 15.6 Registrar transacción de saldo en histórico
    - Crear documento de pago con concepto "SALDO A FAVOR"
    - Incluir campo `monto` con valor exacto aplicado
    - Vincular con plan y procedimientos pagados
    - _Requirements: 11.5_

- [~] 16. Checkpoint final - Validación integral
  - Ejecutar todos los tests (unitarios y de propiedades)
  - Verificar integración de todos los módulos
  - Confirmar correcciones funcionando correctamente
  - Validar que no hay regresiones en funcionalidad existente
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas

## Notes

- Las tareas marcadas con `*` son opcionales (tests) y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad completa
- Los checkpoints permiten validación incremental del progreso
- Las pruebas de propiedad validan correctitud universal de la lógica
- Los tests unitarios validan casos específicos y edge cases
- La implementación es incremental: cada épica construye sobre las anteriores
- Todas las operaciones críticas incluyen auditoría (timestamp, usuario, motivo cuando aplica)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4", "1.5"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "6.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "3.2", "6.2"] },
    { "id": 4, "tasks": ["3.3", "5.1", "6.3", "6.4"] },
    { "id": 5, "tasks": ["3.4", "3.5", "5.2", "6.5", "6.6"] },
    { "id": 6, "tasks": ["5.3", "6.7", "7.1", "7.2"] },
    { "id": 7, "tasks": ["5.4", "7.3", "7.4", "9.1"] },
    { "id": 8, "tasks": ["7.5", "7.6", "9.2", "10.1"] },
    { "id": 9, "tasks": ["7.7", "7.8", "10.2", "10.3"] },
    { "id": 10, "tasks": ["10.4", "10.5", "11.1", "11.2"] },
    { "id": 11, "tasks": ["10.6", "11.3", "12.1"] },
    { "id": 12, "tasks": ["11.4", "11.5", "12.2", "12.3"] },
    { "id": 13, "tasks": ["11.6", "12.4", "13.1"] },
    { "id": 14, "tasks": ["12.5", "13.2", "13.3"] },
    { "id": 15, "tasks": ["13.4", "13.5", "14.1"] },
    { "id": 16, "tasks": ["13.6", "14.2", "14.3"] },
    { "id": 17, "tasks": ["14.4", "14.5", "15.1"] },
    { "id": 18, "tasks": ["15.2", "15.3", "15.4"] },
    { "id": 19, "tasks": ["15.5", "15.6"] }
  ]
}
```
