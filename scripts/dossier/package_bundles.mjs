import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const BASE_DIR = path.resolve('documentacion/odontocloud');
const DOSSIER_DIR = path.join(BASE_DIR, 'expediente-institucional-2026');
const PDF_SRC = path.join(DOSSIER_DIR, 'pdf');
const DOCX_SRC = path.join(DOSSIER_DIR, 'docx');

const CLINICAS_DIR = path.join(BASE_DIR, 'PAQUETE-PARA-CLINICAS-2026');
const PENDIENTES_DIR = path.join(BASE_DIR, 'DOCUMENTACION-PENDIENTE-DE-APROBACION');

// 1. Clasificación de Documentos
const CLINICAS_CODES = ['DOC-01', 'DOC-02', 'DOC-03', 'DOC-04', 'DOC-05', 'DOC-07', 'DOC-08', 'DOC-09', 'DOC-10', 'DOC-12'];
const PENDIENTES_CODES = ['DOC-06', 'DOC-11', 'DOC-13', 'DOC-14'];

function prepareDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'pdf'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docx'), { recursive: true });
}

prepareDir(CLINICAS_DIR);
prepareDir(PENDIENTES_DIR);

// Obtener lista de archivos existentes
const allPdfs = fs.readdirSync(PDF_SRC).filter(f => f.endsWith('.pdf'));
const allDocxs = fs.readdirSync(DOCX_SRC).filter(f => f.endsWith('.docx'));

// Copiar a PAQUETE-PARA-CLINICAS-2026
for (const code of CLINICAS_CODES) {
  const pdfFile = allPdfs.find(f => f.startsWith(code));
  const docxFile = allDocxs.find(f => f.startsWith(code));
  if (pdfFile) fs.copyFileSync(path.join(PDF_SRC, pdfFile), path.join(CLINICAS_DIR, 'pdf', pdfFile));
  if (docxFile) fs.copyFileSync(path.join(DOCX_SRC, docxFile), path.join(CLINICAS_DIR, 'docx', docxFile));
}

// Copiar a DOCUMENTACION-PENDIENTE-DE-APROBACION
for (const code of PENDIENTES_CODES) {
  const pdfFile = allPdfs.find(f => f.startsWith(code));
  const docxFile = allDocxs.find(f => f.startsWith(code));
  if (pdfFile) fs.copyFileSync(path.join(PDF_SRC, pdfFile), path.join(PENDIENTES_DIR, 'pdf', pdfFile));
  if (docxFile) fs.copyFileSync(path.join(DOCX_SRC, docxFile), path.join(PENDIENTES_DIR, 'docx', docxFile));
}

// Portada Institucional y Guía para Clínicas
const portadaClinicas = `# ODONTOCLOUD COLOMBIA — PAQUETE DOCUMENTAL PARA CLÍNICAS E IPS 2026
**Documentación Descriptiva, Técnica y Operativa para Procesos de Evaluación y Habilitación**  
**Versión de Plataforma:** 2026.1 (Release 8.2)  
**Fecha de Edición:** Octubre de 2026  

---

## IDENTIFICACIÓN INSTITUCIONAL DEL PROVEEDOR

- **Titular / Proveedor Tecnológico:** JUAN EDUARDO MADRID REQUENA
- **Personería Jurídica:** Persona Natural Comerciante
- **Identificación:** Cédula de Ciudadanía No. 1102849760 (terminada en 9760)
- **NIT:** 1102849760-5 (Sujeto a cotejo con RUT vigente)
- **Cámara de Comercio:** Cámara de Comercio de Sincelejo
- **Matrícula Mercantil:** 148131 (Activa 2026 — Sujeta a cotejo con certificado mercantil vigente)
- **Actividad Económica Principal:** CIIU 6312 — Portales Web y Procesamiento de Datos
- **Domicilio Legal:** Sincelejo, Sucre, Colombia
- **Nombre Comercial del Software:** OdontoCloud Colombia / OdontoCloud SaaS
- **Portal Web Oficial:** https://odontocloudcolombia.com
- **Contacto Oficial:** bienvenido@odontocloudcolombia.com

---

## FINALIDAD DE ESTE PAQUETE

Este paquete contiene la documentación técnica, operativa y funcional que puede ser suministrada a clínicas odontológicas, consultorios e IPS para sustentar el cumplimiento del estándar de Historia Clínica y Registros Asistenciales (Resolución 3100 de 2019 de MinSalud), seguridad de la información y manuales de usuario.

No contiene secretos de arquitectura interna, credenciales operativas de producción, ni certificaciones no otorgadas.

---

## RELACIÓN DE DOCUMENTOS INCLUIDOS (10 DOCUMENTOS)

| Código | Documento | Formatos | Finalidad Institucional |
| :--- | :--- | :---: | :--- |
| **DOC-01** | Ficha Técnica Institucional de OdontoCloud | PDF y DOCX | Ficha descriptiva, arquitectura multi-inquilino y requerimientos cliente. |
| **DOC-02** | Manual Completo de Usuario y Administrador | PDF y DOCX | Guía operativa paso a paso con capturas reales y catálogo de funciones. |
| **DOC-03** | Documento Técnico de Historia Clínica Electrónica | PDF y DOCX | Inmutabilidad de folios, secuencialidad, adendas y régimen de firma electrónica. |
| **DOC-04** | Arquitectura Tecnológica e Infraestructura | PDF y DOCX | Topología en nube, aislamiento RLS multi-tenant y cifrado de datos en reposo/tránsito. |
| **DOC-05** | Política y Procedimientos de Seguridad de la Información | PDF y DOCX | Controles alineados a ISO 27001, mitigación OWASP y notificación de incidentes. |
| **DOC-07** | Manual de Trazabilidad, Auditoría y Control de Accesos | PDF y DOCX | Control RBAC por perfiles asistenciales, bitácoras y protocolo Break-Glass. |
| **DOC-08** | Plan de Copias de Seguridad y Continuidad Operativa | PDF y DOCX | Respaldos diarios automáticos, RPO/RTO y contingencia asistencial en papel. |
| **DOC-09** | Documento de Integraciones (DIAN, Factus, RIPS e IHCE) | PDF y DOCX | Facturación electrónica en salud, RIPS JSON y estado preproducción IHCE. |
| **DOC-10** | Manual de Soporte, Mantenimiento y Gestión de Incidentes | PDF y DOCX | Canales de atención (IA 24/7, WhatsApp, correo) y niveles de severidad. |
| **DOC-12** | Matriz Técnica de Habilitación para Prestadores de Salud | PDF y DOCX | Correlación de 11 filas con el estándar de habilitación de la Res. 3100/2019. |
`;

fs.writeFileSync(path.join(CLINICAS_DIR, 'PORTADA-Y-GUIA-INSTITUCIONAL.md'), portadaClinicas);

// Portada Institucional y Matriz de Pendientes
const portadaPendientes = `# ODONTOCLOUD COLOMBIA — DOCUMENTACIÓN PENDIENTE DE APROBACIÓN Y FIRMA 2026
**Borradores Contractuales, Evaluación COPNIA y Formalización de Entrega**  
**Versión de Plataforma:** 2026.1 (Release 8.2)  
**Estado:** PENDIENTE DE REVISIÓN LEGAL, DICTAMEN COPNIA Y FORMALIZACIÓN  
**Fecha de Edición:** Octubre de 2026  

---

## IDENTIFICACIÓN INSTITUCIONAL DEL PROVEEDOR

- **Titular / Proveedor Tecnológico:** JUAN EDUARDO MADRID REQUENA
- **Personería Jurídica:** Persona Natural Comerciante
- **Identificación:** Cédula de Ciudadanía No. 1102849760 (terminada en 9760)
- **NIT:** 1102849760-5 (Sujeto a cotejo con RUT vigente)
- **Cámara de Comercio:** Cámara de Comercio de Sincelejo
- **Matrícula Mercantil:** 148131 (Activa 2026 — Sujeta a cotejo con certificado mercantil vigente)
- **Actividad Económica Principal:** CIIU 6312 — Portales Web y Procesamiento de Datos
- **Domicilio Legal:** Sincelejo, Sucre, Colombia
- **Nombre Comercial del Software:** OdontoCloud Colombia / OdontoCloud SaaS
- **Portal Web Oficial:** https://odontocloudcolombia.com
- **Contacto Oficial:** bienvenido@odontocloudcolombia.com

---

## ADVERTENCIA Y RÉGIMEN DE RESERVA

Los documentos agrupados en esta carpeta son **BORRADORES DE TRABAJO Y PROTOCOLOS PENDIENTES DE CIERRE**. No deben ser distribuidos como contratos perfeccionados ni como certificaciones técnicas vigentes hasta que se cumplan las firmas de las partes y el peritaje profesional exigible.

---

## RELACIÓN DE DOCUMENTOS PENDIENTES (4 DOCUMENTOS)

| Código | Documento | Formatos | Requisito Pendiente para Aprobación |
| :--- | :--- | :---: | :--- |
| **DOC-06** | Política de Tratamiento de Datos Personales y Acuerdo de Encargo (DPA) | PDF y DOCX | **Revisión y Firma Contractual:** Mantener como borrador legal hasta la firma bilateral del Acuerdo de Encargo de Tratamiento entre el titular de OdontoCloud y el Representante Legal de la IPS. |
| **DOC-11** | Condiciones de Servicio SaaS y Régimen de Custodia de Datos | PDF y DOCX | **Formalización de Términos:** Mantener como borrador contractual de adhesión hasta la contratación formal del servicio por parte de la clínica. |
| **DOC-13** | Informe Técnico de HCE para Evaluación por Profesional Competente | PDF y DOCX | **Evaluación y Dictamen COPNIA:** Inspección, verificación y firma por Ingeniero de Sistemas independiente debidamente matriculado ante el COPNIA, con certificado de vigencia de matrícula. |
| **DOC-14** | Carta Institucional de Presentación y Entrega del Expediente | PDF y DOCX | **Diligenciamiento y Recepción:** Completar datos de la clínica cliente (Nombre, NIT, Código REPS de 12 dígitos) y firma de recepción formal por el prestador. |

---

## MATRIZ DE COTEJO Y ACCIONES DE CIERRE

1. **Cotejo Documental:**
   - NIT 1102849760-5 sujeto a cotejo con el RUT original expedido por la DIAN.
   - Matrícula Mercantil 148131 sujeta a cotejo con el certificado vigente de la Cámara de Comercio de Sincelejo.
2. **Evaluación de Ingeniería:**
   - Designación del profesional competente con tarjeta COPNIA para el dictamen del DOC-13.
3. **Firmas Bilaterales:**
   - Formalización de DOC-06, DOC-11 y DOC-14 una vez acordadas las condiciones con cada cliente institucional.
`;

fs.writeFileSync(path.join(PENDIENTES_DIR, 'PORTADA-Y-MATRIZ-DE-PENDIENTES.md'), portadaPendientes);

// Crear los 2 archivos ZIP independientes
async function generateZips() {
  // ZIP 1: PAQUETE-PARA-CLINICAS-2026
  console.log('Generando ZIP 1: OdontoCloud-2026-Paquete-Para-Clinicas.zip...');
  const zipClinicas = new JSZip();
  const clinicasPdfFolder = zipClinicas.folder('pdf');
  const clinicasDocxFolder = zipClinicas.folder('docx');

  for (const f of fs.readdirSync(path.join(CLINICAS_DIR, 'pdf'))) {
    clinicasPdfFolder.file(f, fs.readFileSync(path.join(CLINICAS_DIR, 'pdf', f)));
  }
  for (const f of fs.readdirSync(path.join(CLINICAS_DIR, 'docx'))) {
    clinicasDocxFolder.file(f, fs.readFileSync(path.join(CLINICAS_DIR, 'docx', f)));
  }
  zipClinicas.file('PORTADA-Y-GUIA-INSTITUCIONAL.md', fs.readFileSync(path.join(CLINICAS_DIR, 'PORTADA-Y-GUIA-INSTITUCIONAL.md')));

  const bufClinicas = await zipClinicas.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const zipPathClinicas = path.join(BASE_DIR, 'OdontoCloud-2026-Paquete-Para-Clinicas.zip');
  fs.writeFileSync(zipPathClinicas, bufClinicas);
  console.log(`✓ Creado: ${zipPathClinicas} (${(bufClinicas.length / (1024 * 1024)).toFixed(2)} MB)`);

  // ZIP 2: DOCUMENTACION-PENDIENTE-DE-APROBACION
  console.log('Generando ZIP 2: OdontoCloud-2026-Documentacion-Pendiente-Aprobacion.zip...');
  const zipPendientes = new JSZip();
  const pendientesPdfFolder = zipPendientes.folder('pdf');
  const pendientesDocxFolder = zipPendientes.folder('docx');

  for (const f of fs.readdirSync(path.join(PENDIENTES_DIR, 'pdf'))) {
    pendientesPdfFolder.file(f, fs.readFileSync(path.join(PENDIENTES_DIR, 'pdf', f)));
  }
  for (const f of fs.readdirSync(path.join(PENDIENTES_DIR, 'docx'))) {
    pendientesDocxFolder.file(f, fs.readFileSync(path.join(PENDIENTES_DIR, 'docx', f)));
  }
  zipPendientes.file('PORTADA-Y-MATRIZ-DE-PENDIENTES.md', fs.readFileSync(path.join(PENDIENTES_DIR, 'PORTADA-Y-MATRIZ-DE-PENDIENTES.md')));

  const bufPendientes = await zipPendientes.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const zipPathPendientes = path.join(BASE_DIR, 'OdontoCloud-2026-Documentacion-Pendiente-Aprobacion.zip');
  fs.writeFileSync(zipPathPendientes, bufPendientes);
  console.log(`✓ Creado: ${zipPathPendientes} (${(bufPendientes.length / (1024 * 1024)).toFixed(2)} MB)`);
}

generateZips().catch(err => {
  console.error('Error generando los paquetes:', err);
  process.exit(1);
});
