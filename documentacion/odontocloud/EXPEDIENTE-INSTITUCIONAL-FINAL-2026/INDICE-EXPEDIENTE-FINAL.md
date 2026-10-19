# EXPEDIENTE INSTITUCIONAL FINAL ODONTOCLOUD COLOMBIA 2026
## SUITE DOCUMENTAL TÉCNICA, OPERATIVA Y JURÍDICA PARA CLÍNICAS E IPS

**Fecha de Edición:** Octubre de 2026  
**Versión del Software:** OdontoCloud Colombia v2026.1 (Release 8.2)  
**Modalidad de Servicio:** Software as a Service (SaaS) en la Nube  
**Identificador del Paquete:** `EXPEDIENTE-INSTITUCIONAL-FINAL-2026`  

---

## 1. FICHA OFICIAL DEL PROVEEDOR TECNOLÓGICO

Conforme a las instrucciones expresas y a la normativa comercial colombiana, el software es provisto y operado bajo la titularidad de:

* **Titular y Proveedor del Software:** JUAN EDUARDO MADRID REQUENA
* **Naturaleza Jurídica:** Persona Natural Comerciante
* **Documento de Identidad:** Cédula de Ciudadanía No. 1102849760 expedida en Sincelejo, Sucre
* **Número de Identificación Tributaria (NIT):** 1102849760-5 *(Sujeto a verificación y cotejo con el Registro Único Tributario — RUT expedido por la DIAN)*
* **Matrícula Mercantil:** 148131 *(Activa 2026 — Cámara de Comercio de Sincelejo, sujeta a certificado mercantil vigente)*
* **Actividad Económica Principal (CIIU):** 6312 — Portales Web y Servicios de Procesamiento de Datos
* **Domicilio y Sede Principal:** Sincelejo, Sucre, República de Colombia
* **Nombre Comercial del Software:** OdontoCloud Colombia
* **Sitio Web Oficial:** [https://odontocloudcolombia.com](https://odontocloudcolombia.com)
* **Correo Institucional y Notificaciones:** `bienvenido@odontocloudcolombia.com`
* **Restricción Expresa:** OdontoCloud **NO** utiliza la denominación social "S.A.S.". Todo documento contractual y tributario se expide a nombre de su titular persona natural comerciante.

---

## 2. COMPARATIVA DE BUENAS PRÁCTICAS: ORALDRIVE vs. ODONTOCLOUD

A partir de la revisión autorizada de los 4 documentos de referencia de *Salud Drive S.A.S. / OralDrive* (`Protocolo de Seguridad`, `Certificación Ingeniero`, `Términos y Condiciones` y `Políticas de Tratamiento`), se identificaron buenas prácticas de organización empresarial que fueron adoptadas, perfeccionadas y superadas en OdontoCloud, **sin copiar textos, marcas, firmas ni identidades ajenas**:

| Criterio / Aspecto | Práctica de Referencia (OralDrive) | Implementación y Mejora OdontoCloud Colombia |
| :--- | :--- | :--- |
| **Identidad Visual y Encabezado** | Logotipo institucional en cabecera superior y foliado estándar. | **Diseño institucional unificado:** Logotipo original de OdontoCloud en proporción 1:1, membrete con título y subtítulo turquesa `#0d9488`, código de documento, badge de estado en color corporativo y bordes azul marino `#0f2942`. |
| **Certificación Técnica Sanitaria** | Certificación expedida por Ingeniero de Sistemas colegiado (Ley 594/2000, Res. 3100/2019). | **CERT-01:** Modelo de certificación técnica propio basado en las características reales del software (RLS, UTC, inmutabilidad, firma digital vectorial, FEV y RIPS). Se mantiene **estrictamente PENDIENTE** la evaluación y firma del Ingeniero COPNIA, sin simular tarjetas profesionales. |
| **Seguridad y Respaldos** | Protocolo de seguridad que enfatiza la responsabilidad del cliente en sus contraseñas y rutinas generales de respaldo. | **PROT-01:** Documento técnico adaptado a nuestra arquitectura real (VPS Oracle Linux, Docker, PostgreSQL RLS, copias transaccionales periódicas `pg_dump .Fc` en el servidor host, TLS 1.3, RBAC y notificación de incidentes en 24 horas). |
| **Disponibilidad y Nivel de Servicio** | SLA comercial con exclusión de mantenimientos y eventos de telecomunicaciones ajenos. | **TERM-01 / CON-01:** Disponibilidad objetivo del 99.5% mensual bajo mejores esfuerzos técnicos, delimitando claramente las exclusiones por cortes de hosting o internet local de la IPS. |
| **Régimen de Custodia de Historias Clínicas** | Alerta al cliente para descargar antes de vencer la suscripción y evitar pérdida de datos. | **Cumplimiento riguroso de la Res. 839/2017:** Se ratifica que la custodia de 15 años es privativa de la IPS. OdontoCloud otorga **60 días calendario de gracia** para descarga completa (PDF foliado, JSON, CSV), suscripción de Acta de Cierre y **prohibición expresa de borrado automático desatendido**. |
| **Tratamiento de Datos Personales (Ley 1581/2012)** | Política general de tratamiento con canales de atención al titular. | **POL-01:** Política integral con **Acuerdo de Encargo de Tratamiento (DPA)** incorporado, delimitando con precisión los roles: la Clínica es el *Responsable* y OdontoCloud es el *Encargado*, con deber de reserva sobre datos sensibles de salud. |

---

## 3. ÍNDICE DE DOCUMENTOS DEL EXPEDIENTE FINAL 2026

Todos los documentos se encuentran generados en formatos gemelos **PDF nativo** y **Word editable (.docx)**, cumpliendo con márgenes uniformes de 2.5 cm, tipografía calibrada (10 a 11 pt), tablas protegidas contra partición (`cantSplit: true`) y encabezados/pies institucionales:

### 1. `CERT-01`: Certificación Técnica del Software OdontoCloud Colombia
* **Título Completo:** Declaración de Cumplimiento Técnico, Autenticidad, Fiabilidad, Integridad y Criterios Sanitarios (Resolución 3100 de 2019 y Ley 594 de 2000).
* **Archivos:** `CERT-01-Certificacion-Tecnica-Software-OdontoCloud.pdf` | `.docx`
* **Páginas Word:** 2 páginas | **Palabras:** 692 | **Tablas:** 4
* **Estado:** **MODELO OFICIAL — PENDIENTE DE DICTAMEN Y FIRMA PROFESIONAL COPNIA**.
* **Descripción:** Certifica las características comprobadas del software (inmutabilidad asistencial, marcas de tiempo `clock_timestamp()` UTC, aislamiento RLS en PostgreSQL, firma electrónica táctil bajo Decreto 2364/2012, facturación DIAN y RIPS Res. 2275/2023). Deja abierta e identificada la casilla para evaluación, matrícula y firma del Ingeniero de Sistemas competente.

### 2. `PROT-01`: Protocolo de Seguridad de la Información, Infraestructura y Respaldo Cloud
* **Título Completo:** Directrices Técnicas de Seguridad Lógica, Cifrado, Respaldos Transaccionales y Continuidad Operativa OdontoCloud SaaS.
* **Archivos:** `PROT-01-Protocolo-Seguridad-Informacion-Respaldo-Cloud.pdf` | `.docx`
* **Páginas Word:** 2 páginas (3 en PDF) | **Palabras:** 775 | **Tablas:** 2
* **Estado:** **DOCUMENTO TÉCNICO OFICIAL DE SEGURIDAD**.
* **Descripción:** Detalla la arquitectura de servidores privados (VPS Oracle Linux), contenedores Docker, canal cifrado HTTPS/TLS 1.3, segregación lógica multi-inquilino RLS, política verificable de respaldos `pg_dump`, control de roles RBAC, bitácoras de auditoría, deber de custodia de contraseñas por la clínica y protocolo de notificación de incidentes en 24 horas.

### 3. `TERM-01`: Términos y Condiciones Generales de Uso del Servicio SaaS
* **Título Completo:** Condiciones Generales de Contratación, Licenciamiento, Nivel de Servicio, Régimen de Custodia y Tratamiento Posterior de Datos.
* **Archivos:** `TERM-01-Terminos-Condiciones-Uso-Servicio-SaaS.pdf` | `.docx`
* **Páginas Word:** 2 páginas (3 en PDF) | **Palabras:** 892 | **Tablas:** 1
* **Estado:** **BORRADOR RECTOR PARA REVISIÓN Y ADHESIÓN COMERCIAL**.
* **Descripción:** Marco contractual de adhesión para usuarios del servicio en la nube. Regula la capacidad, no exclusividad de licencia, propiedad intelectual del proveedor, responsabilidad asistencial privativa de la IPS (el software no ejerce la odontología), disponibilidad del 99.5%, requerimiento de 15 días ante mora antes de suspensión, y el procedimiento de 60 días de gracia para descarga conforme a la Resolución 839 de 2017.

### 4. `POL-01`: Política de Tratamiento de Datos Personales y Acuerdo de Encargo (DPA)
* **Título Completo:** Manual Integral de Protección de Datos Personales, Tratamiento de Datos Sensibles de Salud y Acuerdo de Encargo de Tratamiento.
* **Archivos:** `POL-01-Politica-Tratamiento-Datos-Personales-DPA.docx` | `.pdf`
* **Páginas Word:** 2 páginas | **Palabras:** 728 | **Tablas:** 2
* **Estado:** **DOCUMENTO CONTRACTUAL SUJETO A FIRMA BILATERAL**.
* **Descripción:** Implementa el régimen de la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013. Fija la delimitación legal expresa (Clínica = Responsable / OdontoCloud = Encargado), finalidades exclusivas del tratamiento tecnológico, prohibición de explotación comercial de datos de pacientes, derechos ARCO, canal de atención y acuerdo de encargo para firma bilateral.

### 5. `CON-01`: Contrato de Prestación del Servicio OdontoCloud SaaS
* **Título Completo:** Contrato Marco de Prestación de Servicios de Software Odontológico en la Nube y Soporte Técnico (Modelo diligenciado para VALMA Dental Studio).
* **Archivos:** `CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.pdf` | `.docx`
* **Páginas Word:** 4 páginas | **Palabras:** 2.179 | **Tablas:** 5
* **Estado:** **CONTRATO FINAL APROBADO SUJETO A FIRMA BILATERAL**.
* **Descripción:** Instrumento legal definitivo entre JUAN EDUARDO MADRID REQUENA y la clínica contratante. Contiene 15 cláusulas perfeccionadas: objeto, 8 módulos contratados con especificaciones técnicas, precio y forma de pago, duración de 12 meses prorrogable, soporte técnico por WhatsApp y correo, disponibilidad 99.5%, confidencialidad, régimen de mora garantizando acceso médico, custodia de 15 años de historias clínicas con 60 días de gracia para exportación verificable en formatos estándar, y bloque de firmas con presentación corporativa impecable.

---

## 4. CONTROL DE CALIDAD Y APERTURA EN MICROSOFT WORD 16.0

Se ejecutó un proceso de auditoría y verificación automatizada mediante interoperabilidad COM con Microsoft Word 16.0 sobre los 5 archivos `.docx` generados, confirmando **cero errores de apertura, cero partes corruptas y perfecta integridad estructural**:

| Documento | Formato DOCX | Formato PDF | Páginas Word | Palabras | Tablas | Resultado Validación |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **CERT-01** | Sí | Sí | 2 | 692 | 4 | Apertura OK — 0 errores |
| **PROT-01** | Sí | Sí | 2 | 775 | 2 | Apertura OK — 0 errores |
| **TERM-01** | Sí | Sí | 2 | 892 | 1 | Apertura OK — 0 errores |
| **POL-01** | Sí | Sí | 2 | 728 | 2 | Apertura OK — 0 errores |
| **CON-01** | Sí | Sí | 4 | 2.179 | 5 | Apertura OK — 0 errores |
| **TOTALES** | **5 DOCX** | **5 PDF** | **12 Págs** | **5.266** | **14** | **100% Validado en Word** |

---

## 5. UBICACIÓN FÍSICA Y ARCHIVO COMPRIMIDO ÚNICO

* **Carpeta Raíz del Expediente Final:**  
  `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\EXPEDIENTE-INSTITUCIONAL-FINAL-2026\`
* **Subcarpeta de Documentos Editables (Word):**  
  `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\EXPEDIENTE-INSTITUCIONAL-FINAL-2026\docx\`
* **Subcarpeta de Documentos Finales (PDF):**  
  `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\EXPEDIENTE-INSTITUCIONAL-FINAL-2026\pdf\`
* **Paquete Comprimido ZIP Oficial:**  
  `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\EXPEDIENTE-INSTITUCIONAL-FINAL-2026\OdontoCloud-2026-Expediente-Institucional-Final.zip`
