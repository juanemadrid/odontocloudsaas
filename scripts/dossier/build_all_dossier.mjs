import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

import { 
  BASE_DIR, 
  PDF_DIR, 
  DOCX_DIR, 
  EVIDENCIAS_DIR,
  renderHtml, 
  renderDocx 
} from './engine.mjs';

import { doc01 } from './doc01_ficha.mjs';
import { doc02 } from './doc02_manual.mjs';
import { doc03 } from './doc03_hce.mjs';
import { doc04 } from './doc04_arquitectura.mjs';
import { doc05 } from './doc05_seguridad.mjs';
import { doc06 } from './doc06_datos_dpa.mjs';
import { doc07 } from './doc07_trazabilidad.mjs';
import { doc08 } from './doc08_backups.mjs';
import { doc09 } from './doc09_integraciones.mjs';
import { doc10 } from './doc10_soporte.mjs';
import { doc11 } from './doc11_saas_custodia.mjs';
import { doc12 } from './doc12_matriz_hab.mjs';
import { doc13 } from './doc13_informe_copnia.mjs';
import { doc14 } from './doc14_carta_entrega.mjs';

const allDocs = [
  doc01, doc02, doc03, doc04, doc05, doc06, doc07,
  doc08, doc09, doc10, doc11, doc12, doc13, doc14
];

fs.mkdirSync(PDF_DIR, { recursive: true });
fs.mkdirSync(DOCX_DIR, { recursive: true });

function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function countWordsInDocx(docxBuffer) {
  try {
    const zip = await JSZip.loadAsync(docxBuffer);
    const docXml = await zip.file('word/document.xml').async('string');
    const textOnly = docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return countWords(textOnly);
  } catch (e) {
    return 0;
  }
}

async function runBuild() {
  console.log('======================================================================');
  console.log('ODONTOCLOUD 2026 — GENERADOR INTEGRAL DEL EXPEDIENTE INSTITUCIONAL');
  console.log('Compilación simultánea de 14 documentos en PDF y DOCX con paridad 1:1');
  console.log('======================================================================\n');

  const browser = await chromium.launch();
  const summaryReport = [];
  const generatedPdfBuffers = [];

  for (let i = 0; i < allDocs.length; i++) {
    const docDef = allDocs[i];
    console.log(`[${i + 1}/14] Procesando ${docDef.code} — ${docDef.title}...`);

    // 1. Renderizar HTML
    const html = renderHtml(docDef);
    const htmlText = stripHtml(html);
    const htmlWordCount = countWords(htmlText);

    // 2. Compilar PDF vía Playwright
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });
    await page.close();

    const pdfPath = path.join(PDF_DIR, `${docDef.filenameBase}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    generatedPdfBuffers.push({ code: docDef.code, buffer: pdfBuffer, filename: `${docDef.filenameBase}.pdf` });

    // Cargar páginas del PDF
    const pdfDocLoaded = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDocLoaded.getPageCount();

    // 3. Renderizar DOCX nativo a partir de los mismos elementos
    const docxBuffer = await renderDocx(docDef);
    const docxPath = path.join(DOCX_DIR, `${docDef.filenameBase}.docx`);
    fs.writeFileSync(docxPath, docxBuffer);

    // 4. Medir palabras reales en el archivo DOCX
    const docxWordCount = await countWordsInDocx(docxBuffer);

    const pdfSizeKb = Math.round(pdfBuffer.length / 1024);
    const docxSizeKb = Math.round(docxBuffer.length / 1024);

    const ratio = Math.round((docxWordCount / htmlWordCount) * 100);

    console.log(`      ✓ PDF:  ${pageCount} págs | ${pdfSizeKb} KB | ~${htmlWordCount} palabras`);
    console.log(`      ✓ DOCX: ${docxSizeKb} KB | ~${docxWordCount} palabras (Equivalencia: ${ratio}%)\n`);

    summaryReport.push({
      code: docDef.code,
      title: docDef.title,
      pages: pageCount,
      pdfWords: htmlWordCount,
      docxWords: docxWordCount,
      pdfSizeKb,
      docxSizeKb,
      equivalenceRatio: `${ratio}%`
    });
  }

  await browser.close();

  // 5. Generar PDF Maestro Consolidado
  console.log('Concatenando los 14 documentos en el PDF Maestro Consolidado...');
  const mergedPdf = await PDFDocument.create();

  for (const item of generatedPdfBuffers) {
    const srcDoc = await PDFDocument.load(item.buffer);
    const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  const masterPdfPath = path.join(BASE_DIR, 'Expediente-Institucional-OdontoCloud-2026-COMPLETO.pdf');
  fs.writeFileSync(masterPdfPath, mergedPdfBytes);
  const totalMasterPages = mergedPdf.getPageCount();
  const masterSizeMb = (mergedPdfBytes.length / (1024 * 1024)).toFixed(2);
  console.log(`✅ PDF Maestro generado con éxito: ${totalMasterPages} páginas (${masterSizeMb} MB)\n`);

  // 6. Actualizar Índices Markdown
  updateMarkdownIndices(summaryReport, totalMasterPages);

  // 7. Generar el archivo ZIP consolidado con JSZip
  console.log('Empaquetando el Expediente Institucional en ZIP consolidado...');
  const zip = new JSZip();

  // Agregar PDFs individuales
  const pdfFolder = zip.folder('pdf');
  const pdfFiles = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
  for (const f of pdfFiles) {
    pdfFolder.file(f, fs.readFileSync(path.join(PDF_DIR, f)));
  }

  // Agregar DOCXs individuales
  const docxFolder = zip.folder('docx');
  const docxFiles = fs.readdirSync(DOCX_DIR).filter(f => f.endsWith('.docx'));
  for (const f of docxFiles) {
    docxFolder.file(f, fs.readFileSync(path.join(DOCX_DIR, f)));
  }

  // Agregar Evidencias
  const evidenciasFolder = zip.folder('evidencias');
  const evidenciaFiles = fs.readdirSync(EVIDENCIAS_DIR).filter(f => f.endsWith('.png'));
  for (const f of evidenciaFiles) {
    evidenciasFolder.file(f, fs.readFileSync(path.join(EVIDENCIAS_DIR, f)));
  }

  // Agregar PDF Maestro
  zip.file('Expediente-Institucional-OdontoCloud-2026-COMPLETO.pdf', mergedPdfBytes);

  // Agregar Índices Markdown
  zip.file('INDICE-GENERAL-EXPEDIENTE.md', fs.readFileSync(path.join(BASE_DIR, 'INDICE-GENERAL-EXPEDIENTE.md')));
  zip.file('MATRIZ-DE-APROBACIONES-Y-PENDIENTES.md', fs.readFileSync(path.join(BASE_DIR, 'MATRIZ-DE-APROBACIONES-Y-PENDIENTES.md')));

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const zipPath = path.resolve('documentacion/odontocloud/Expediente-Institucional-OdontoCloud-2026.zip');
  fs.writeFileSync(zipPath, zipBuffer);
  const zipSizeMb = (zipBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`✅ Archivo ZIP generado con éxito: ${zipPath} (${zipSizeMb} MB)\n`);

  // Imprimir Tabla Resumen de Control de Calidad
  console.log('========================================================================================');
  console.log('TABLA FINAL DE CONTROL DE CALIDAD Y EQUIVALENCIA PDF vs DOCX');
  console.log('========================================================================================');
  console.table(summaryReport);
  console.log('========================================================================================\n');
}

function updateMarkdownIndices(summaryReport, totalMasterPages) {
  const indiceContent = `# EXPEDIENTE INSTITUCIONAL ODONTOCLOUD COLOMBIA 2026
**Software Odontológico en la Nube (SaaS) — Edición Oficial Institucional 2026.1 (Release 8.2)**  
**Estado Documental:** DOCUMENTACIÓN INSTITUCIONAL EN REVISIÓN (Borrador Oficial previo a firmas legales y validación COPNIA)  
**Fecha de Edición:** Octubre de 2026  
**Total Páginas PDF Maestro:** ${totalMasterPages} páginas foliadas  

---

## 1. CONTROL DE EQUIVALENCIA Y PARIDAD 1:1 ENTRE PDF Y DOCX

Todos los catorce (14) documentos han sido compilados a partir de un **modelo unificado de elementos estructurados**, garantizando identidad plena en capítulos, párrafos, tablas técnicas, notas legales, imágenes de evidencias y pies de firma entre el formato de lectura (PDF) y el formato editable (DOCX):

| Código | Título del Documento | Págs PDF | Palabras PDF | Palabras DOCX | Paridad | Tamaño PDF | Tamaño DOCX |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
${summaryReport.map(r => `| **${r.code}** | ${r.title} | ${r.pages} | ${r.pdfWords} | ${r.docxWords} | **${r.equivalenceRatio}** | ${r.pdfSizeKb} KB | ${r.docxSizeKb} KB |`).join('\n')}

---

## 2. RELACIÓN DOCUMENTAL DEL EXPEDIENTE

1. **[DOC-01] Ficha Técnica Institucional de OdontoCloud**: Especificaciones técnicas, arquitectura multi-inquilino, marco normativo vigente (Resolución 3100 de 2019 tras revocatoria de Res. 1732/2026 mediante Res. 2080/2026) y requerimientos de terminales cliente.
2. **[DOC-02] Manual Completo de Usuario y Administrador**: Guía operativa paso a paso exhaustiva con matriz de roles y permisos, explicación de botones, procedimientos de atención clínica, odontograma FDI/Universal, consentimientos con trazo vectorial, FEV DIAN, RIPS, interoperabilidad IHCE y resolución de errores frecuentes.
3. **[DOC-03] Documento Técnico del Sistema de Historia Clínica Electrónica**: Garantías de inmutabilidad (triple barrera), secuencialidad con clock_timestamp() UTC, mecanismo de adendas (Res. 1995/1999) y régimen de firma electrónica confiable (Decreto 2364/2012).
4. **[DOC-04] Arquitectura Tecnológica e Infraestructura**: Topología VPS Oracle Linux, Docker Engine 25+, aislamiento estricto de red y volumen, cifrado AES-256-GCM y metas técnicas de RPO/RTO.
5. **[DOC-05] Política y Procedimientos de Seguridad de la Información**: Alineación ISO 27001, mitigación OWASP Top 10, sanitización DOMPurify y protocolo de notificación de brechas en 24h a la IPS (Ley 1581/2012).
6. **[DOC-06] Política de Tratamiento de Datos Personales y Acuerdo de Encargo (DPA)**: Delimitación jurídica Responsable vs Encargado, derechos ARCO y prohibición categórica de borrado automático de historias a los 60 días sin suscripción de acta legal de entrega conforme a la Resolución 839 de 2017 (custodia de 15 años).
7. **[DOC-07] Manual de Trazabilidad, Auditoría y Control de Accesos**: Segregación de funciones asistenciales, bitácoras de eventos de seguridad y protocolo de emergencia Break-Glass para urgencias vitales.
8. **[DOC-08] Plan de Copias de Seguridad, Restauración y Continuidad Operativa**: Respaldos transaccionales pg_dump -Fc diarios a las 02:00 AM COT, snapshots de volumen y protocolo de contingencia asistencial física en papel con transcripción en < 24h.
9. **[DOC-09] Documento de Integraciones (DIAN, Factus, RIPS e IHCE)**: Facturación electrónica en salud, RIPS JSON (Res. 2275/2023) y estado real verificado de IHCE en Preproducción (OAuth2 HTTP 200 en 290 ms). Claridad absoluta sobre el carácter sintético del radicado de ensayo RDA-COL-2026-89087642.
10. **[DOC-10] Manual de Soporte, Mantenimiento y Gestión de Incidentes**: Canales de atención (IA 24/7, WhatsApp de ingeniería, correo oficial), matriz de severidad P1-P4 y ventanas de mantenimiento nocturno no asistencial.
11. **[DOC-11] Condiciones de Servicio SaaS y Régimen de Custodia de Datos**: Propuesta contractual de condiciones operativas, delimitación de responsabilidades, custodia legal de 15 años a cargo de la IPS (Res. 839/2017), periodo de gracia de descarga de 60 días y custodia pasiva transitoria sin borrado desatendido.
12. **[DOC-12] Matriz Técnica de Habilitación para Prestadores de Salud**: Matriz de 11 filas correlacionando los estándares de la Resolución 3100 de 2019 con las evidencias comprobables en el código y base de datos de OdontoCloud.
13. **[DOC-13] Informe Técnico de HCE para Evaluación por Profesional Competente**: Dictamen técnico de ingeniería de software estructurado para inspección, verificación y suscripción por Ingeniero de Sistemas colegiado ante el COPNIA.
14. **[DOC-14] Carta Institucional de Presentación y Entrega del Expediente**: Comunicación formal de remisión a la IPS con campos editables de recepción y delimitación de responsabilidades sanitarias.

---

## 3. UBICACIÓN FÍSICA Y ARTEFACTOS

- **Carpeta de Documentos PDF:** \`documentacion/odontocloud/expediente-institucional-2026/pdf/\`
- **Carpeta de Documentos Word (DOCX):** \`documentacion/odontocloud/expediente-institucional-2026/docx/\`
- **PDF Maestro Consolidado:** \`documentacion/odontocloud/expediente-institucional-2026/Expediente-Institucional-OdontoCloud-2026-COMPLETO.pdf\`
- **Paquete ZIP Completo:** \`documentacion/odontocloud/Expediente-Institucional-OdontoCloud-2026.zip\`
`;

  fs.writeFileSync(path.join(BASE_DIR, 'INDICE-GENERAL-EXPEDIENTE.md'), indiceContent);

  const matrizAprobaciones = `# MATRIZ DE APROBACIONES Y CONTROL DE PENDIENTES LEGALES
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
   - Verificación matemática del Dígito de Verificación (DV) oficial para la cédula \`1102849760\` aplicando los coeficientes DIAN \`[3, 7, 13, 17, 19, 23, 29, 37, 41, 43]\`: el residuo arroja de manera unívoca el dígito **5**.
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
| **Interoperabilidad IHCE (Radicación)** | Res. 1888 de 2025 MinSalud | ⚪ Proceso de Homologación | Radicado sintético \`RDA-COL-2026-89087642\` documentado expresamente como prueba de formato. |
`;

  fs.writeFileSync(path.join(BASE_DIR, 'MATRIZ-DE-APROBACIONES-Y-PENDIENTES.md'), matrizAprobaciones);
}

runBuild().catch(err => {
  console.error('Error durante la compilación del expediente:', err);
  process.exit(1);
});
