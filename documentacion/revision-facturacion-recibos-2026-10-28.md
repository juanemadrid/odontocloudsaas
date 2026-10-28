# Revisión del flujo recibo → factura, 28 de octubre de 2026

## Conclusión y límites

Hay defectos verificables en el código de OdontoCloud. No está demostrado que la DIAN rechazara el documento FCEV-1346, ni que la caída del VPS originara este caso. La captura de Factus muestra FCEV1343; no es evidencia suficiente para declarar inexistentes todos los demás documentos de la cuenta.

No se accedió a registros privados de producción, logs del servicio ni respuesta original del intento. No se emitieron, borraron, renumeraron o anularon documentos reales. No se modificaron infraestructura ni Edunexus.

## Hallazgos en el código anterior

1. ReciboCajaList consumía el consecutivo local antes de transmitir. Si Factus fallaba, guardaba ese número como si identificara la factura electrónica.
2. Mostraba éxito aunque emitirFacturaDian devolviera success:false.
3. No conservaba referencia, mensaje ni historial del intento. El formulario principal sí tiene un mecanismo de historial.
4. El recibo transmite medios de pago como etiquetas («Efectivo»); sendInvoice los enviaba literalmente al proveedor en payment_method_code.
5. invokeFactusProxy descartaba el código HTTP. normalizeFactusError no reconocía todos los errores de red ni los HTTP 500/503 como técnicos.
6. DianService declaraba aceptación por una respuesta HTTP exitosa, incluso sin CUFE o con validación explícitamente falsa.
7. getFactusCredentialsForTenant convertía errores de conectividad en ausencia de configuración.
8. La vía directa desde recibos omite la preparación de salud SS-CUFE del formulario principal: prestador, cobertura, modalidad, datos clínicos y validación previa.
9. La vinculación de recibos ignoraba los errores devueltos por Supabase.
10. La decisión de reintento confundía cualquier estado RECHAZADA con rechazo formal de la DIAN, incluyendo errores 422 del proveedor.

## Corrección local preparada

- La generación desde recibos guarda un borrador con referencia persistente y abre el formulario principal para revisar y emitir. Es un cambio visible: deja de emitir automáticamente desde la lista sin revisión de datos fiscales y de salud.
- La vía electrónica no consume el consecutivo local. El número oficial se toma de la respuesta de Factus; el identificador provisional lleva BORRADOR-.
- Los medios de pago se normalizan; un texto desconocido produce un error previo en lugar de convertirlo silenciosamente en efectivo.
- Se preserva el HTTP del proxy; caídas y errores del servidor quedan indeterminados y requieren consulta antes de repetir.
- Solo se informa aceptación con CUFE y sin indicador explícito de no validación.
- El formulario conserva múltiples recibos y su estado de pago, y conserva la tabla de origen del recibo.
- Para registros existentes, se guarda estado indeterminado antes de transmitir. Si no se puede guardar el resultado, se bloquea otro envío en esa sesión y se exige consulta.
- Los registros históricos sin detalle de error requieren consultar Factus antes de reintentar. Los borradores se buscan por referencia, sin enviar su identificador provisional como número oficial.

## Manejo del caso de la clínica

1. Conservar el recibo 2076 y el documento local; no volver a cobrar ni cambiar manualmente el consecutivo.
2. Consultar el documento en la cuenta y ambiente correctos de Factus por número y, si existe, su referencia. Comprobar filtros de la lista.
3. Consultar audit_logs de OdontoCloud (FACTUS_ERROR/send_bill) y los logs de factus-proxy en el intervalo del intento. Es posible que el servidor sí conserve el error aunque el recibo no lo haya guardado en detalles.
4. Si Factus confirma validación, reconciliar número y CUFE sin emitir otra factura.
5. Si no hay documento, o hay documento pendiente no validado, corregir con el flujo de verificación/reintento existente, revisando datos fiscales y de salud. La eliminación de un pendiente exige verificar su referencia y ausencia de validación; no es una acción ejecutada en esta revisión.

Hasta publicar y verificar la corrección, usar el formulario principal de Factura de venta para revisar y asociar el recibo existente, después de resolver el estado del intento anterior.

## Verificación y pendientes

- Pruebas aisladas: `node --experimental-vm-modules scripts/test-factus-emission-regressions.mjs`. Incluyen pagos, HTTP 500/502/503/504, error de red, 422/409, respuesta sin validación, aceptación, sandbox y consulta de borrador. Transportes simulados, sin red ni base de datos.
- `npm run build`: compilación correcta.
- `git diff --check`: sin errores de whitespace.
- `npm run test:ci`: controles de seguridad, ayuda, agenda, configuración, odontograma, preparación de producción, facturación y compilación aprobados. Se reemplazó la contraseña fija del diagnóstico local ignorado por una variable de entorno; no se publica ese script.
- Se ejecutaron también las suites previas de recibos (12 casos) y reintentos (16 casos), con dependencias aisladas. Todas aprobadas.

Protecciones adicionales para producción: los recibos se reclaman con actualización condicional factura_id IS NULL y tenant_id. Dos sesiones no pueden sobrescribir la asociación. Si falla una asociación parcial, se intenta deshacer únicamente las reclamaciones de ese borrador y se conserva un registro no emitible. El borrador permanece bloqueado hasta confirmar todos los enlaces. Antes de transmitir un registro existente se relee el estado y se actualiza de forma condicional comparando detalles JSONB: solo una sesión puede iniciar la emisión, incluso si el RPC de lock no está disponible.

Pendiente de comprobación operativa: evidencia real de FCEV-1346 y recorrido con sesión autorizada contra el backend real. No se generó ninguna factura fiscal de prueba. Las pruebas usan transportes simulados y no certifican la disponibilidad del proveedor ni sustituyen la verificación del documento histórico.

Referencia técnica consultada: [campos de factura de Factus](https://www.factusapi-v2.halltec.co/facturas/descripcion-de-campos/).
