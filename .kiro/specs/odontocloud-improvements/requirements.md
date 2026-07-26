# Requirements Document

## Introduction

Este documento especifica los requisitos para las mejoras del sistema de gestión odontológica OdontoCloud. Las mejoras incluyen seis nuevas funcionalidades para optimizar la gestión de recetas médicas, evoluciones, presupuestos y pagos, además de cinco correcciones críticas para resolver problemas existentes en los módulos de radiografías, presupuesto y pagos.

## Glossary

- **Sistema**: El sistema de gestión odontológica OdontoCloud
- **Receta_Medica**: Documento digital que prescribe medicamentos al paciente
- **Evolucion**: Registro inmutable del progreso clínico del paciente
- **Presupuesto**: Documento que detalla los procedimientos odontológicos y sus costos
- **Pago**: Registro de transacción financiera realizada por el paciente
- **Doctor**: Profesional odontólogo que realiza procedimientos clínicos
- **Paciente**: Persona que recibe servicios odontológicos
- **Procedimiento**: Servicio odontológico específico incluido en un presupuesto
- **Saldo_A_Favor**: Monto positivo en la cuenta del paciente disponible para futuros servicios
- **Firma_Digital**: Representación electrónica de la firma del doctor
- **Referencia_Pago**: Número de identificación único de una transacción bancaria

## Requirements

### Requirement 1: Cálculo Automático de Cantidad en Recetas Médicas

**User Story:** Como doctor, quiero que la cantidad de medicamento se calcule automáticamente según la frecuencia y duración, para que no tenga que hacer cálculos manuales.

#### Acceptance Criteria

1. WHEN un doctor ingresa la frecuencia diaria y la duración en días de un medicamento, THE Sistema SHALL calcular automáticamente la cantidad total requerida
2. THE Sistema SHALL mostrar la cantidad calculada en el campo "cantidad" de la Receta_Medica
3. WHEN la frecuencia o duración cambian, THE Sistema SHALL recalcular automáticamente la cantidad
4. THE Sistema SHALL permitir al doctor editar manualmente la cantidad calculada si es necesario
5. THE Sistema SHALL validar que frecuencia y duración sean números positivos mayores a cero antes de calcular

### Requirement 2: Firma Digital del Doctor en Recetas Médicas

**User Story:** Como doctor, quiero agregar mi firma digital a las recetas médicas, para que el documento tenga validez y autenticidad.

#### Acceptance Criteria

1. WHEN un doctor visualiza una Receta_Medica en la columna de acciones, THE Sistema SHALL mostrar un ícono de firma digital
2. WHEN el doctor hace clic en el ícono de firma, THE Sistema SHALL abrir un modal de captura de Firma_Digital
3. THE Sistema SHALL permitir al doctor dibujar su firma usando el mouse o pantalla táctil
4. WHEN el doctor guarda la firma, THE Sistema SHALL almacenar la imagen de la Firma_Digital asociada a la Receta_Medica
5. THE Sistema SHALL mostrar la Firma_Digital en la vista de impresión de la Receta_Medica
6. THE Sistema SHALL registrar la fecha y hora cuando se añade la Firma_Digital

### Requirement 3: Firma Digital del Doctor en Evoluciones

**User Story:** Como doctor, quiero firmar digitalmente mis evoluciones clínicas, para que quede constancia de mi autoría.

#### Acceptance Criteria

1. WHEN un doctor visualiza una Evolucion en la columna de acciones, THE Sistema SHALL mostrar un ícono de firma digital
2. WHEN el doctor hace clic en el ícono de firma, THE Sistema SHALL abrir un modal de captura de Firma_Digital
3. THE Sistema SHALL permitir al doctor dibujar su firma usando el mouse o pantalla táctil
4. WHEN el doctor guarda la firma, THE Sistema SHALL almacenar la imagen de la Firma_Digital asociada a la Evolucion
5. THE Sistema SHALL mantener la inmutabilidad de la Evolucion después de agregar la Firma_Digital
6. THE Sistema SHALL mostrar la Firma_Digital en la vista de impresión de la Evolucion

### Requirement 4: Indicador de Procedimientos Realizados en Presupuesto

**User Story:** Como doctor, quiero ver qué procedimientos ya fueron realizados en el presupuesto, para que pueda hacer seguimiento del tratamiento.

#### Acceptance Criteria

1. WHEN un procedimiento es marcado como realizado en una Evolucion, THE Sistema SHALL actualizar el estado del Procedimiento en el Presupuesto correspondiente
2. THE Sistema SHALL mostrar un indicador visual distintivo para los procedimientos realizados en la lista del Presupuesto
3. THE Sistema SHALL permitir filtrar procedimientos por estado (pendiente/realizado) en el Presupuesto
4. THE Sistema SHALL mostrar la fecha en que el Procedimiento fue marcado como realizado
5. WHEN se visualiza el Presupuesto, THE Sistema SHALL calcular y mostrar el porcentaje de procedimientos realizados versus el total

### Requirement 5: Alerta de Deuda por Procedimientos Realizados No Cancelados

**User Story:** Como administrador, quiero recibir alertas de procedimientos realizados pero no pagados, para que pueda gestionar la cartera de manera eficiente.

#### Acceptance Criteria

1. WHEN un Procedimiento está marcado como realizado pero su estado de pago es "pendiente", THE Sistema SHALL mostrar una alerta visual en el Presupuesto
2. THE Sistema SHALL calcular el monto total de la deuda sumando todos los procedimientos realizados no cancelados
3. THE Sistema SHALL mostrar un indicador de deuda en el perfil del Paciente cuando existan procedimientos realizados sin pagar
4. THE Sistema SHALL permitir generar un reporte de pacientes con deudas por procedimientos realizados
5. WHEN se accede al módulo de pagos desde un Presupuesto con deuda, THE Sistema SHALL pre-seleccionar los procedimientos realizados no cancelados

### Requirement 6: Justificación de Anulación de Pagos en Histórico

**User Story:** Como administrador, quiero documentar el motivo de cada anulación de pago, para que exista trazabilidad de las operaciones financieras.

#### Acceptance Criteria

1. WHEN un usuario intenta eliminar un Pago del histórico, THE Sistema SHALL mostrar una ventana emergente modal
2. THE Sistema SHALL requerir que el usuario ingrese un motivo de anulación con mínimo 10 caracteres
3. THE Sistema SHALL impedir la eliminación del Pago si no se proporciona un motivo válido
4. WHEN se confirma la anulación, THE Sistema SHALL almacenar el motivo junto con la fecha, hora y usuario que realizó la anulación
5. THE Sistema SHALL mantener un registro histórico de pagos anulados con sus respectivos motivos
6. THE Sistema SHALL permitir consultar el motivo de anulación en el histórico de transacciones

### Requirement 7: Edición de Imágenes de Radiografías

**User Story:** Como doctor, quiero poder editar las imágenes de radiografías después de subirlas, para que pueda corregir o reemplazar imágenes incorrectas.

#### Acceptance Criteria

1. WHEN se visualiza una imagen de radiografía previamente cargada, THE Sistema SHALL mostrar una opción de editar en las acciones
2. WHEN el doctor selecciona editar, THE Sistema SHALL permitir reemplazar la imagen actual por una nueva
3. THE Sistema SHALL mantener un historial de versiones de la imagen de radiografía
4. WHEN se edita una imagen, THE Sistema SHALL registrar la fecha, hora y usuario que realizó el cambio
5. THE Sistema SHALL permitir restaurar una versión anterior de la imagen si es necesario

### Requirement 8: Funcionalidad de Guardado de Presupuesto

**User Story:** Como doctor, quiero que el botón de guardar presupuesto funcione correctamente, para que pueda almacenar la información sin pérdida de datos.

#### Acceptance Criteria

1. WHEN el doctor hace clic en el botón "Guardar" del Presupuesto, THE Sistema SHALL validar que todos los campos requeridos estén completos
2. WHEN la validación es exitosa, THE Sistema SHALL almacenar el Presupuesto en la base de datos
3. WHEN el guardado es exitoso, THE Sistema SHALL mostrar un mensaje de confirmación al usuario
4. IF ocurre un error durante el guardado, THEN THE Sistema SHALL mostrar un mensaje de error descriptivo y mantener los datos en el formulario
5. THE Sistema SHALL deshabilitar el botón de guardar durante el proceso de guardado para prevenir duplicados

### Requirement 9: Validación de Descuentos en Presupuesto

**User Story:** Como administrador, quiero que el sistema valide los descuentos aplicados, para que no se excedan los montos permitidos después de cargar los ítems.

#### Acceptance Criteria

1. WHEN se intenta aplicar un descuento en un Presupuesto, THE Sistema SHALL verificar que el monto del descuento no exceda el monto máximo permitido
2. THE Sistema SHALL calcular el descuento máximo permitido basado en el total de los ítems cargados
3. IF el descuento ingresado excede el límite permitido, THEN THE Sistema SHALL mostrar un mensaje de error y no aplicar el descuento
4. THE Sistema SHALL mostrar el porcentaje de descuento aplicado en relación al total
5. WHEN se modifican los ítems del Presupuesto, THE Sistema SHALL revalidar los descuentos existentes

### Requirement 10: Campo de Referencia en Pagos según Medio de Pago

**User Story:** Como cajero, quiero que el campo de referencia se muestre automáticamente cuando el medio de pago lo requiere, para que pueda registrar la información completa de la transacción.

#### Acceptance Criteria

1. WHEN se selecciona un medio de pago que requiere referencia (transferencia, tarjeta), THE Sistema SHALL mostrar automáticamente el campo Referencia_Pago
2. WHEN se selecciona un medio de pago que no requiere referencia (efectivo), THE Sistema SHALL ocultar el campo Referencia_Pago
3. THE Sistema SHALL validar que el campo Referencia_Pago esté completo antes de guardar cuando el medio de pago lo requiera
4. THE Sistema SHALL permitir caracteres alfanuméricos en el campo Referencia_Pago con un máximo de 50 caracteres
5. THE Sistema SHALL prevenir el guardado del Pago si falta la Referencia_Pago requerida

### Requirement 11: Aplicación Correcta de Saldo a Favor en Pagos

**User Story:** Como cajero, quiero que el sistema aplique correctamente el saldo a favor, para que solo se descuente el monto necesario y no el saldo completo cuando excede el valor de los procedimientos.

#### Acceptance Criteria

1. WHEN el Saldo_A_Favor del Paciente es mayor que el valor total de los procedimientos seleccionados, THE Sistema SHALL aplicar únicamente el monto equivalente al valor de los procedimientos
2. THE Sistema SHALL calcular el nuevo Saldo_A_Favor restando solo el monto aplicado al pago
3. THE Sistema SHALL mostrar claramente el monto de Saldo_A_Favor aplicado y el saldo restante después del pago
4. WHEN el Saldo_A_Favor es menor o igual al valor de los procedimientos, THE Sistema SHALL aplicar el Saldo_A_Favor completo
5. THE Sistema SHALL registrar en el histórico de transacciones el monto exacto de Saldo_A_Favor aplicado en cada pago
