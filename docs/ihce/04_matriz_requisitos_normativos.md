# 04. MATRIZ DE REQUISITOS NORMATIVOS Y EVIDENCIAS DE CUMPLIMIENTO IHCE

**Normas Evaluadas:**
- Ley 2015 de 2020 (Creación de la Interoperabilidad de Historia Clínica Electrónica).
- Resolución 866 de 2021 (Conjunto de datos y Anexo Técnico).
- Resolución 1888 de 2025 (Mecanismo tecnológico nacional).
- Resolución 1799 de 2026 (Modificaciones y directrices de implementación).
- Ley 1581 de 2012 y Decreto 1074 de 2015 (Protección de Datos Personales / Habeas Data).
- Resoluciones 1995 de 1999 y 839 de 2017 (Conservación, custodia e inmutabilidad de historias clínicas).
- Ley 527 de 1999 y Decreto 2364 de 2012 (Mensajes de datos y firma electrónica confiable).

---

| # | Requisito Normativo | Artículo / Norma | Implementación Técnica en OdontoCloud | Estado | Evidencia de Verificación |
|---|---|---|---|:---:|---|
| 1 | Estándar de Intercambio HL7 FHIR R4 | Res. 866/2021 y Res. 1888/2025 | Generador `IhceBundleBuilder.js` con Bundle `type = "document"` | **CUMPLIDO** | Test FHIR R4: Composición, Paciente, Consulta, Profesional, IPS, Diagnóstico, Procedimiento. |
| 2 | Retención obligatoria mínima (15 años) | Res. 1995/1999 y Res. 839/2017 | Sustitución de `CASCADE` por `ON DELETE RESTRICT` en tablas clínicas | **CUMPLIDO** | Intento de `DELETE` sobre paciente con consentimientos/evoluciones rechazado por motor PostgreSQL. |
| 3 | Inmutabilidad de la evolución cerrada | Res. 1995/1999 Art. 5 | Cierre atómico con snapshot JSONB, hash SHA-256 y trigger `trg_protect_evolution_integrity` | **CUMPLIDO** | Motor rechaza `UPDATE` o `DELETE` sobre evoluciones cerradas con excepción `EVOLUTION_IS_IMMUTABLE`. |
| 4 | Firma electrónica confiable | Ley 527/1999 y Dto. 2364/2012 | Reautenticación por contraseña/PIN en `ClinicalSignatureModal` y sellado con hash | **CUMPLIDO** | Registro de `closed_by`, `closed_at`, hash de contenido y firma auditable. |
| 5 | Aislamiento estricto multi-tenant | Ley 1581/2012 Art. 4 | Políticas RLS V2 con `FORCE ROW LEVEL SECURITY` por `tenant_id` | **CUMPLIDO** | Doctor Boreal no puede leer historias ni credenciales de Clínica Apolo (conteo = 0). |
| 6 | Principio de menor privilegio (Least Privilege) | Res. 1888/2025 Seguridad | Rol `superadmin` bloqueado de leer historias clínicas; restringido a personal de salud | **CUMPLIDO** | Superadmin bloqueado de leer pacientes directamente (conteo = 0). |
| 7 | Protocolo de contingencia Break-Glass | Res. 1888/2025 y Ley 1581 | Función `request_break_glass_access()` con justificación legal, ticket y 30 min | **CUMPLIDO** | Registro inmutable en `audit_logs` y opción de revocación en tiempo real por el prestador. |
| 8 | Codificación clínica oficial (REPS, DIVIPOLA, CIE, CUPS) | Res. 866/2021 Anexo Técnico | Columnas normalizadas en base de datos con validaciones CHECK sin defaults inventados | **CUMPLIDO** | Validaciones `^[0-9]{12}$` para REPS, `^[0-9]{5}$` para DIVIPOLA y etnias 1–6. |
| 9 | Idempotencia en transmisión | Res. 1888/2025 Anexo Técnico | Clave única `idempotency_key` (SHA-256) y restricción `uq_ihce_queue_idempotency` | **CUMPLIDO** | Duplicidad de encolamiento rechazada automáticamente por clave foránea única. |
| 10 | Manejo asíncrono y desacoplado | Res. 1888/2025 | Transactional Outbox Worker con reserva concurrente `FOR UPDATE SKIP LOCKED` | **CUMPLIDO** | Múltiples workers procesan en paralelo sin bloqueos ni caídas locales. |
