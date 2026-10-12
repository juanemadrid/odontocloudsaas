# 08. INVENTARIO DE TRÁMITES Y DOCUMENTOS POR PRESTADOR (CLÍNICA)

**Propósito:** Guía administrativa y legal de los trámites que cada clínica o consultorio odontológico debe gestionar formalmente ante las entidades del Estado para operar legalmente con IHCE.

---

## 1. Trámites ante Entidades Gubernamentales

### 1. Registro Especial de Prestadores de Servicios de Salud (REPS)
- **Entidad:** Secretaría de Salud Departamental o Distrital.
- **Trámite:** Verificación de la vigencia del código de habilitación de 12 dígitos y de la sede de 2 dígitos para los servicios odontológicos habilitados (código de servicio 328 Odontología General, 329 Especialidades Odontológicas).
- **Documento Obtenido:** Distintivo de Habilitación vigente con fecha de vigencia y código REPS.

### 2. Registro Nacional del Talento Humano en Salud (RETHUS)
- **Entidad:** Colegio Colombiano de Odontólogos / Ministerio de Salud.
- **Trámite:** Validación de que todos los odontólogos que prestan servicios en la clínica estén inscritos y activos en la plataforma RETHUS.
- **Documento Obtenido:** Tarjeta profesional y constancia de inscripción en RETHUS.

### 3. Registro de Sistema de Información ante MinSalud / SISPRO
- **Entidad:** Ministerio de Salud y Protección Social (Mesa de Ayuda SISPRO).
- **Trámite:** Radicación de la solicitud de interoperabilidad indicando a OdontoCloud como el software de historia clínica electrónica utilizado.
- **Documentos Obtenidos:** Credenciales OAuth2 para pruebas (`Client ID` y `Client Secret`).

### 4. Certificación de Conformidad Técnica
- **Entidad:** Dirección de Epidemiología y Demografía de MinSalud.
- **Trámite:** Ejecución de la batería de pruebas en el ambiente oficial y emisión del acta de conformidad.
- **Documento Obtenido:** Certificado Oficial de Conformidad Técnica IHCE para el prestador.

---

## 2. Inventario de Contratos y Anexos Legales (Revisión Jurídica Obligatoria)

En cumplimiento de la Ley 1581 de 2012 (Habeas Data), Decreto 1074 de 2015 y Ley 2015 de 2020, las clínicas y OdontoCloud deben suscribir formalmente los siguientes instrumentos jurídicos:

### A. Contrato de Transmisión de Datos Personales (DPA - Data Processing Agreement)
- **Partes:** OdontoCloud SaaS (Encargado del Tratamiento) y la Clínica Prestadora (Responsable del Tratamiento).
- **Alcance:** Establece las obligaciones de seguridad, confidencialidad, no cesión a terceros y medidas de aislamiento técnico para la información de salud sensible.

### B. Anexo de Consentimiento Informado para Interoperabilidad (Firma del Paciente)
- **Ubicación:** Incorporado en el formulario de ingreso del paciente y consentimientos informados de OdontoCloud.
- **Contenido Legal:** Notificación al paciente de que sus resúmenes de atención serán interoperados con el mecanismo nacional del Ministerio de Salud en virtud de la Ley 2015 de 2020.

### C. Acuerdo de Confidencialidad y Uso de Acceso Excepcional (Break-Glass)
- **Partes:** Personal técnico de soporte de OdontoCloud y la Dirección Médica de la Clínica.
- **Alcance:** Define la responsabilidad penal y civil ante cualquier activación injustificada de acceso a expedientes clínicos.

### D. Acuerdo de Custodia y Retención Documental
- **Compromiso:** Garantizar la disponibilidad y conservación de los expedientes durante el término legal de 15 años (Resolución 1995 de 1999 y Resolución 839 de 2017), incluso en caso de terminación del servicio SaaS mediante entrega de respaldo íntegro descifrado.
