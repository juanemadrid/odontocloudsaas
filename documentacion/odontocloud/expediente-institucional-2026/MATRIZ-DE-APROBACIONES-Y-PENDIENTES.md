# MATRIZ DE APROBACIONES Y CONTROL DE PENDIENTES LEGALES
**Expediente Institucional OdontoCloud Colombia 2026 (Versión 2026.1, Release 8.2)**  
**Clasificación Documental:** DOCUMENTACIÓN INSTITUCIONAL EN REVISIÓN (Borrador Oficial previo a firmas legales y validación COPNIA)  
**Fecha de Actualización:** Octubre de 2026  

---

## 1. IDENTIDAD LEGAL DEL PROVEEDOR TECNOLÓGICO INCORPORADA

En cumplimiento de las instrucciones de formalización institucional como **Persona Natural Comerciante**, se ha incorporado la siguiente información en todos los documentos del expediente:

| Parámetro Legal | Valor Formal Incorporado | Estado de Verificación y Soporte |
| :--- | :--- | :--- |
| **Titular / Razón Social** | **JUAN EDUARDO MADRID REQUENA** | Identificado como persona natural propietaria de OdontoCloud Colombia. |
| **Tipo de Persona** | **Persona Natural con Registro Mercantil** | Matrícula mercantil activa en registro de comerciantes. |
| **Documento de Identidad** | **Cédula de Ciudadanía No. 1102849760** | C.C. terminada en 9760. Sujeta a cotejo con cédula física y RUT. |
| **NIT** | **1102849760-5** | Calculado y validado mediante algoritmo oficial DIAN Módulo 11 (Art. 555-2 E.T.). Sujeto a cotejo con RUT vigente. |
| **Cámara de Comercio** | **Cámara de Comercio de Sincelejo** | Jurisdicción mercantil correspondiente al domicilio principal. |
| **Matrícula Mercantil** | **148131** | Registro mercantil de Sincelejo, estado activo 2026. Sujeto a certificado mercantil vigente. |
| **Actividad Económica (CIIU)** | **6312 — Portales Web y Servicios de Procesamiento de Datos** | Clasificación económica aplicable a software SaaS en la nube. |
| **Domicilio Legal** | **Sincelejo, Sucre, República de Colombia** | Sede principal del proveedor tecnológico. |
| **Nombre Comercial** | **OdontoCloud Colombia** / OdontoCloud SaaS | Nombre comercial de la plataforma y software asistencial. |
| **Sitio Web Oficial** | **https://odontocloudcolombia.com** | Portal web oficial del software. |
| **Correo Electrónico** | **bienvenido@odontocloudcolombia.com** | Canal oficial de notificaciones y soporte. |

---

## 2. FUENTES UTILIZADAS PARA VALIDAR LA IDENTIDAD LEGAL

Para la determinación rigurosa de los datos y evitar cualquier inconsistencia o invención, se consultaron y auditaron las siguientes fuentes:

1. **Expediente de Registro Técnico y RUES (Preproducción MinSalud):**
   - Registros de autenticación y radicación técnica donde figura **MADRID REQUENA JUAN EDUARDO**, Matrícula Mercantil No. **148131** de la Cámara de Comercio de Sincelejo, código CIIU **6312** (Portales web) y C.C. **1102849760**.
2. **Parametrización Fiscal Histórica (Factus / DIAN):**
   - Archivos y parametrización previa del conector de facturación electrónica DIAN bajo la titularidad del software, consignando el NIT **1102849760-5**.
3. **Validación Algorítmica DIAN (Módulo 11):**
   - Verificación matemática del Dígito de Verificación (DV) oficial para la cédula `1102849760` aplicando los coeficientes DIAN `[3, 7, 13, 17, 19, 23, 29, 37, 41, 43]`: el residuo arroja de manera unívoca el dígito **5**.
4. **Auditoría Negativa y Descarte de Homonimias/Terceros (Aislamiento de Clínicas):**
   - Se auditaron expedientes previos pertenecientes a clientes terceros (específicamente la documentación de la profesional Xiomara Cecilia Benitez Steer / ATM Odontología). Se descartó cualquier uso de dichos documentos, garantizando que **ningún dato tributario ni mercantil de clínicas odontológicas o IPS sea atribuido al proveedor del software**.

---

## 3. MATRIZ DE PENDIENTES PREVIOS A LA ENTREGA A CLÍNICAS E IPS

La aprobación final para entregar formalmente este expediente a clínicas, consultorios o evaluadores de habilitación dependerá de completar los siguientes ítems específicos:

| Ítem Pendiente | Documento Afectado | Responsable | Requisito para Cierre Definitivo |
| :--- | :--- | :--- | :--- |
| **Cotejo con RUT Vigente** | Todos (DOC-01 a 14) | Titular del Software | Disponer de copia en PDF del RUT actualizado expedido por la DIAN con fecha de generación reciente y código de verificación QR. |
| **Cotejo con Certificado de Cámara de Comercio** | Todos (DOC-01 a 14) | Titular del Software | Obtener Certificado de Matrícula Mercantil expedido por la Cámara de Comercio de Sincelejo con vigencia no superior a treinta (30) días. |
| **Evaluación y Dictamen COPNIA** | **DOC-13** | Ingeniero de Sistemas Independiente | Designación de un Ingeniero de Sistemas con matrícula profesional COPNIA vigente para realizar la inspección técnica del sistema, diligenciar su número de matrícula y suscribir el informe con su firma y certificado de vigencia. |
| **Firma Protocolaria del Titular** | **DOC-14**, DOC-06, DOC-11 | JUAN EDUARDO MADRID REQUENA | Firma autógrafa o digital certificada de la Carta de Entrega (DOC-14), el Acuerdo de Encargo de Tratamiento (DOC-06) y los Términos del Servicio (DOC-11). |
| **Diligenciamiento de Datos de la IPS Receptora** | **DOC-14** | IPS / Clínica Cliente | Razón social de la IPS, NIT, código de habilitación REPS (12 dígitos), nombre y firma de quien recibe en el prestador de salud. |

---

## 4. ESTADO TÉCNICO DE INTEGRACIONES Y EVIDENCIAS COMPROBADAS

| Módulo / Integración | Marco Normativo | Estado Operativo | Evidencia Documentada en Expediente |
| :--- | :--- | :--- | :--- |
| **Historia Clínica Electrónica** | Res. 1995/1999 & Res. 839/2017 | ✅ 100% Operativo en Producción | Inmutabilidad de folios en PostgreSQL, adendas secuenciales con fecha UTC indeleble. |
| **Facturación Electrónica en Salud** | DIAN / Res. 2275 de 2023 | ✅ 100% Operativo en Producción | Generación de CUFE, QR y XML validado mediante integración con Factus. |
| **RIPS Formato JSON** | Res. 2275 de 2023 MinSalud | ✅ 100% Operativo en Producción | Suite de validación con esquemas JSON de usuarios, consultas y procedimientos. |
| **Interoperabilidad IHCE (OAuth2)** | Res. 1888 de 2025 MinSalud | 🟡 Comprobado en Sandbox | Token Bearer obtenido exitosamente (HTTP 200 en 290 ms). |
| **Interoperabilidad IHCE (Radicación)** | Res. 1888 de 2025 MinSalud | ⚪ Proceso de Homologación | Radicado sintético `RDA-COL-2026-89087642` documentado expresamente como prueba de formato. |
