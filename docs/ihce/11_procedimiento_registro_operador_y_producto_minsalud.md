# 11. PROCEDIMIENTO ADMINISTRATIVO Y TÉCNICO PARA INTERCAMBIO CON MINSALUD

**Propósito:** Guía de procedimientos administrativos y técnicos verificados para la gestión del intercambio de información ante el Ministerio de Salud y Protección Social de Colombia conforme a la Ley 2015 de 2020, Resolución 866 de 2021, Resolución 1888 de 2025 y Resolución 1799 de 2026.

---

## 1. Canales y Recursos Oficiales de MinSalud

| Canal / Portal | Enlace / Ubicación | Finalidad |
|---|---|---|
| **Portal General IHCE MinSalud** | `https://minsalud.gov.co/ihce/` | Consulta normativa oficial, resoluciones vigentes y anexos técnicos. |
| **Recursos de Apoyo IHCE** | `https://minsalud.gov.co/ihce/Paginas/Recursos-de-Apoyo.aspx` | Manuales operativos (ej. Manual v1.3), especificaciones FHIR R4 y recursos de apoyo. |
| **Entorno de Pruebas Vulcano / Conformidad** | `https://vulcano.ihcecol.gov.co/conformidad` | Pasarela y entorno de validación técnica de interoperabilidad ministerial. |
| **Mesa de Ayuda SISPRO** | `https://soporte.sispro.gov.co/` | Soporte técnico ministerial para prestadores y desarrolladores. |
| **Canales de Notificación Institucional** | Mesa de ayuda SISPRO / Ventanilla Única MinSalud | Canal formal de radicación de solicitudes técnicas y credenciales. |

> [!NOTE]
> La disponibilidad y modalidades de acceso a los formularios de pruebas dependen de los calendarios y convocatorias técnicas que publique el Ministerio de Salud. Toda gestión debe basarse exclusivamente en los canales vigentes anunciados por la entidad.

---

## 2. Naturaleza Jurídica y Responsabilidad del Proveedor

- **Forma Jurídica:** La normativa vigente (Ley 2015/2020, Resoluciones 866/2021 y 1888/2025) regula el intercambio de datos clínicos y no impone un tipo societario específico exclusivo (como S.A.S.). El desarrollador o titular de la plataforma puede actuar como persona jurídica o persona natural debidamente formalizada según el régimen mercantil y tributario colombiano general (RUT con actividad económica TIC correspondiente, ej. CIIU 6201, 6202 o 6311).
- **Protección de Datos en Salud:** En virtud de la Ley 1581 de 2012 (Habeas Data) y el Decreto 1074 de 2015, los datos de salud son sensibles. Todo software que procese o custodie historias clínicas actúa como Encargado del Tratamiento (o Responsable según el caso), debiendo suscribir los acuerdos de confidencialidad, transmisión de datos y seguridad exigidos por las IPS y prestadores independientes.

---

## 3. Documentación Técnica y Administrativa Requerida

1. **Identificación Tributaria y Legal:** RUT vigente y documento de existencia/representación legal o matrícula mercantil según la modalidad de constitución.
2. **Ficha Técnica del Software (OdontoCloud SaaS):**
   - Descripción de arquitectura multi-inquilino con aislamiento de datos por clínica.
   - Especificación de perfiles FHIR R4 implementados: `Bundle-Rda-Consulta-Co`, `Composition-Rda-Consulta-Co`, `Patient-Co`, `Practitioner-Co`, `Encounter-Co`.
   - Servicios asistenciales odontológicos aplicables: REPS 334 (Odontología General) y especialidades odontológicas (335 a 340).
3. **Política de Seguridad y Tratamiento de Información:** Procedimientos de cifrado de secretos en reposo (AES-256), firma electrónica de evoluciones, control de acceso basado en roles (RBAC) y aislamiento estricto de secretos.

---

## 4. Gestión de Credenciales y Pruebas Técnicas

1. **Solicitud de Credenciales:** La solicitud de acceso al banco de pruebas se tramita a través de los canales institucionales habilitados por MinSalud (portal de conformidad / SISPRO).
2. **Ambiente de Pruebas:**
   - MinSalud asigna credenciales de prueba (`client_id`, `client_secret` y clave de pasarela `Ocp-Apim-Subscription-Key`).
   - Dichas credenciales deben registrarse cifradas en la base de datos de OdontoCloud utilizando el modo `PRUEBAS_MINSALUD`.
3. **Ejecución de Casos de Interoperabilidad:** Se ejecutan los intercambios conforme a la guía de interoperabilidad (casos válidos, casos con múltiples diagnósticos, respuesta ante duplicidad 409 y validación sintáctica).

---

## 5. Matriz de Responsabilidades Operativas

| Aspecto | Responsabilidad del Software (OdontoCloud) | Responsabilidad del Prestador de Salud (Clínica / Odontólogo) |
|---|:---:|:---:|
| **Habilitación en Salud** | No aplica (no presta servicios de salud). | Mantener activo su registro de prestador en REPS y sedes habilitadas. |
| **Talento Humano en Salud** | No aplica. | Verificar que los profesionales estén registrados en RETHUS. |
| **Generación FHIR R4 / RDA** | **OdontoCloud:** Generar la estructura técnica conforme a los perfiles oficiales colombianos. | Diligenciar la información clínica veraz y completa de la atención. |
| **Firma Electrónica** | **OdontoCloud:** Proveer autenticación de PIN, sellado criptográfico y trazabilidad inmutable. | Cada odontólogo debe custodiar su PIN personal e intransferible. |
| **Seguridad de Secretos** | **OdontoCloud:** Cifrado autenticado en reposo y custodia fuera del frontend. | Administrar adecuadamente los accesos de usuario a la plataforma. |

---

## 6. Resultado del Proceso de Conformidad

- **Verificación Técnica de Intercambio:** MinSalud o la entidad designada verifica que las transacciones enviadas cumplan los estándares técnicos de comunicación y estructura FHIR R4.
- **Alcance Legal:** La superación de las pruebas técnicas constituye una validación de interoperabilidad técnica entre sistemas, pero **no constituye certificación sanitaria, habilitación asistencial ni aval comercial oficial** del software, responsabilidades que permanecen en el ámbito de cada prestador según la Resolución 3100 de 2019.
