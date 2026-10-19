# EXPEDIENTE INSTITUCIONAL ODONTOCLOUD COLOMBIA 2026
## ENTREGA DEFINITIVA DE LA SUITE DOCUMENTAL TÉCNICA Y LEGAL PARA CLÍNICAS E IPS

**Fecha de Cierre y Emisión:** Octubre de 2026  
**Versión del Software:** OdontoCloud Colombia v2026.1 (Release 8.2)  
**Modalidad Tecnológica:** Software as a Service (SaaS) en la Nube  
**Directorio Oficial de Entrega:** `documentacion/odontocloud/ENTREGA-DEFINITIVA-EXPEDIENTE-2026/`  

---

## 1. FICHA INSTITUCIONAL OFICIAL DEL PROVEEDOR TECNOLÓGICO

El software OdontoCloud Colombia es provisto y operado formalmente por su creador, titular y desarrollador:

* **Titular y Proveedor Tecnológico:** JUAN EDUARDO MADRID REQUENA
* **Naturaleza Jurídica:** Persona Natural Comerciante
* **Documento de Identificación:** Cédula de Ciudadanía No. 1102849760 expedida en Sincelejo, Sucre
* **Número de Identificación Tributaria (NIT):** 1102849760-5 *(Sujeto a verificación y cotejo con el Registro Único Tributario — RUT expedido por la DIAN)*
* **Matrícula Mercantil:** 148131 *(Activa 2026 — Cámara de Comercio de Sincelejo, sujeta a certificado mercantil vigente)*
* **Actividad Económica Principal (CIIU):** 6312 — Portales Web y Servicios de Procesamiento de Datos
* **Domicilio Principal:** Sincelejo, Sucre, República de Colombia
* **Nombre Comercial del Software:** OdontoCloud Colombia
* **Sitio Web Oficial:** [https://odontocloudcolombia.com](https://odontocloudcolombia.com)
* **Correo Institucional y Notificaciones:** `bienvenido@odontocloudcolombia.com`
* **Restricción Legal Expresa:** OdontoCloud **NO** utiliza la sigla social "S.A.S.". Toda contratación y facturación se realiza a nombre de su titular persona natural comerciante.

---

## 2. RESUMEN DE CORRECCIONES OBLIGATORIAS APLICADAS

En cumplimiento estricto de las instrucciones de cierre definitivo, se realizaron las siguientes optimizaciones de fondo y forma:

1. **Eliminación de Páginas Huérfanas y Paginación Idéntica:**
   * **PROT-01:** Se eliminó la tercera página casi vacía. El documento ahora cuenta con exactamente **2 páginas en Word y 2 páginas en PDF**, con el bloque de responsable técnico perfectamente integrado en la segunda página.
   * **TERM-01:** Se corrigió el desborde final. Las 7 secciones contractuales se redistribuyeron de forma armónica en exactamente **2 páginas en Word y 2 páginas en PDF**, cerrando con el sello institucional.
   * **CON-01:** Se preservó el contrato de VALMA Dental Studio en exactamente **4 páginas en Word y 4 páginas en PDF**, con el bloque de firmas bilaterales agrupado en la página 4.
   * **CERT-01 y POL-01:** Calibrados a exactamente **2 páginas en Word y 2 páginas en PDF** cada uno.
   * **Total de la Suite:** Exactamente 12 páginas en Word y 12 páginas en PDF (100% de paridad visual).

2. **CERT-01 — Informe Técnico Honesto (Pendiente COPNIA):**
   * Se identificó de manera inequívoca como: `INFORME TÉCNICO DE ARQUITECTURA Y CUMPLIMIENTO SANITARIO — PENDIENTE DE EVALUACIÓN Y FIRMA COPNIA`.
   * **No afirma que el software ya cuente con certificación profesional emitida.**
   * No incorpora matrículas COPNIA simuladas ni firmas ficticias. Deja claramente delimitada la casilla para evaluación, matrícula profesional y firma del Ingeniero de Sistemas independiente.
   * Incorpora callout obligatorio advirtiendo que este informe técnico **no sustituye la habilitación sanitaria REPS (Res. 3100/2019)**, trámite que compete única y privativamente a la IPS prestadora.

3. **PROT-01 — Auditoría Técnica y Realismo Operativo:**
   * **Controles Comprobados:** Despliegue en VPS (Oracle Linux empresarial), orquestación Docker en redes internas aisladas, cifrado obligatorio en tránsito mediante proxy inverso Kong con certificados TLS 1.3, segregación lógica multi-inquilino en PostgreSQL con Row Level Security (RLS), y rutinas de volcado lógico transaccional `pg_dump` en formato comprimido (.Fc).
   * **Aclaración Realista sobre Break-Glass:** Se aclara de manera transparente que no existe un módulo automatizado de Break-Glass en la interfaz de usuario; cualquier contingencia asistencial extraordinaria se gestiona mediante procedimiento administrativo con soporte técnico y registro manual en bitácora.
   * **Aclaración sobre Respaldos:** Se especifica que los respaldos lógicos residen en el sistema de almacenamiento del servidor host asignado y que no se cuenta con replicación geográfica multi-nube redundante en tiempo real, reforzando la corresponsabilidad de la IPS de realizar sus propias descargas locales periódicas.
   * **Notificación en 24 Horas:** Se ratifica el compromiso formal de notificar cualquier brecha de seguridad sobre datos personales o de salud dentro de las veinticuatro (24) horas siguientes a su confirmación técnica (Ley 1581 de 2012).

4. **TERM-01 y CON-01 — Custodia Legal (Res. 839/2017) y Prohibición de Borrado Automático:**
   * Se eliminó cualquier alusión ambigua a "retirada de contenedores" que pudiera sugerir pérdida intempestiva de información asistencial.
   * Se ratifica que la custodia legal de 15 años corresponde privativamente a la IPS.
   * Se garantiza un periodo de gracia improrrogable de **sesenta (60) días calendario** para la descarga completa de historias clínicas en formatos abiertos estándar (PDF foliado por paciente, JSON y CSV) y suscripción del Acta de Cierre.
   * **Prohibición Expresa:** Se estipula que bajo ninguna circunstancia OdontoCloud ejecutará eliminación automática, unilateral o desatendida de información clínica. Si vencido el plazo la clínica no ha retirado los datos, se agotará un preaviso formal certificado no inferior a treinta (30) días calendario para entregar formalmente los archivos de volcado o pactar un esquema de custodia transitoria tarifada conforme a las directrices de MinSalud.

5. **POL-01 — Delimitación Estricta de Roles y Prohibición Comercial:**
   * Se ratifica que la Clínica/IPS es el **RESPONSABLE DEL TRATAMIENTO** y OdontoCloud es el **ENCARGADO DEL TRATAMIENTO**.
   * Se prohíbe de manera absoluta la comercialización, venta, cesión o monetización de datos personales y sensibles de salud de los pacientes, restringiendo el uso única y privativamente a la operación técnica del software contratado.

---

## 3. MATRIZ DE CONTROL DE CALIDAD (WORD 16.0 COM vs. PDF)

Auditoría ejecutada mediante automatización COM directa en Microsoft Word 16.0 y validación de páginas en PDF mediante `pdf-lib`:

| Código | Documento Institucional | Páginas Word | Páginas PDF | Palabras | Tablas | Estado de Integridad |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **CERT-01** | Informe Técnico de Arquitectura y Cumplimiento Sanitario | 2 | 2 | 743 | 4 | [OK] Apertura Limpia — Pendiente COPNIA |
| **PROT-01** | Protocolo de Seguridad de la Información y Respaldo Cloud | 2 | 2 | 565 | 3 | [OK] Apertura Limpia — Oficial Seguridad |
| **TERM-01** | Términos y Condiciones Generales de Uso del Servicio SaaS | 2 | 2 | 590 | 2 | [OK] Apertura Limpia — Rector Comercial |
| **POL-01** | Política de Tratamiento de Datos Personales y DPA | 2 | 2 | 477 | 3 | [OK] Apertura Limpia — Firma Bilateral |
| **CON-01** | Contrato de Prestación del Servicio SaaS (VALMA Dental Studio) | 4 | 4 | 2.254 | 5 | [OK] Apertura Limpia — Modelo Definitivo |
| **TOTALES** | **5 Documentos Rectores de la Suite Institucional** | **12 Págs** | **12 Págs** | **4.629** | **17** | **100% Validado — Paridad Exacta** |

---

## 4. CLASIFICACIÓN Y ESTADO DE LOS DOCUMENTOS

* **DOCUMENTOS APROBADOS PARA USO COMERCIAL E INFORMATIVO:**
  * `PROT-01`: Protocolo oficial de seguridad y respaldo técnico para anexar a propuestas y contratos.
  * `TERM-01`: Términos generales de contratación SaaS aplicables a todas las clínicas contratantes.

* **DOCUMENTOS CONTRACTUALES SUJETOS A FIRMA BILATERAL CON CADA CLIENTE:**
  * `CON-01`: Contrato marco de prestación de servicios (modelo perfeccionado para VALMA Dental Studio, editable en sus campos de fecha y código REPS de la clínica).
  * `POL-01`: Política de Tratamiento de Datos Personales y Acuerdo de Encargo (DPA), anexo obligatorio a firmar bilateralmente entre el Representante Legal de la IPS y el titular de OdontoCloud.

* **DOCUMENTO EN ESTADO DE REVISIÓN / EVALUACIÓN PROFESIONAL:**
  * `CERT-01`: Informe técnico emitido por el desarrollador que debe ser sometido a revisión, verificación e inspección por un Ingeniero de Sistemas matriculado ante el COPNIA para emitir la certificación pericial definitiva.

---

## 5. RUTAS ABSOLUTAS EN EL SISTEMA

### Carpeta Principal de Entrega:
`E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\`

### Documentos Finales en Formato PDF:
* `CERT-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\pdf\CERT-01-Certificacion-Tecnica-Software-OdontoCloud.pdf`
* `PROT-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\pdf\PROT-01-Protocolo-Seguridad-Informacion-Respaldo-Cloud.pdf`
* `TERM-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\pdf\TERM-01-Terminos-Condiciones-Uso-Servicio-SaaS.pdf`
* `POL-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\pdf\POL-01-Politica-Tratamiento-Datos-Personales-DPA.pdf`
* `CON-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\pdf\CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.pdf`

### Documentos Editables en Formato Word (.docx):
* `CERT-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\docx\CERT-01-Certificacion-Tecnica-Software-OdontoCloud.docx`
* `PROT-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\docx\PROT-01-Protocolo-Seguridad-Informacion-Respaldo-Cloud.docx`
* `TERM-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\docx\TERM-01-Terminos-Condiciones-Uso-Servicio-SaaS.docx`
* `POL-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\docx\POL-01-Politica-Tratamiento-Datos-Personales-DPA.docx`
* `CON-01`: `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\docx\CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.docx`

### Archivo Comprimido Oficial (ZIP Único):
* `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\ENTREGA-DEFINITIVA-EXPEDIENTE-2026\OdontoCloud-2026-Expediente-Definitivo.zip`
* Copia directa en la raíz documental:  
  `E:\copia de seguridad\odontocloud-react\documentacion\odontocloud\OdontoCloud-2026-Expediente-Definitivo.zip`
