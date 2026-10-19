import fs from 'fs';
import path from 'path';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  HeadingLevel, 
  AlignmentType, 
  WidthType, 
  Header, 
  Footer,
  ImageRun,
  ShadingType
} from 'docx';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const BASE_OUT_DIR = path.resolve('documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026');
const PDF_OUT_DIR = path.join(BASE_OUT_DIR, 'pdf');
const DOCX_OUT_DIR = path.join(BASE_OUT_DIR, 'docx');

fs.mkdirSync(PDF_OUT_DIR, { recursive: true });
fs.mkdirSync(DOCX_OUT_DIR, { recursive: true });

const LOGO_PATH = path.resolve('public/assets/logo.png');
const logoBuffer = fs.readFileSync(LOGO_PATH);
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

export const INSTITUTIONAL_META = {
  softwareName: 'OdontoCloud Colombia',
  version: '2026.1 (Release 8.2)',
  editionDate: 'Octubre de 2026',
  dossierStatus: 'BORRADOR PARA REVISIÓN JURÍDICA Y FIRMA',
  
  // Proveedor Tecnológico (Persona Natural Comerciante)
  legalEntity: 'JUAN EDUARDO MADRID REQUENA',
  personType: 'Persona Natural Comerciante',
  idType: 'Cédula de Ciudadanía',
  idNumber: '1102849760',
  nit: '1102849760-5 (Sujeto a cotejo con RUT vigente)',
  camaraComercio: 'Cámara de Comercio de Sincelejo',
  matriculaMercantil: '148131 (Activa 2026 — Sujeta a cotejo con certificado mercantil vigente)',
  ciiu: '6312 — Portales Web y Servicios de Procesamiento de Datos',
  city: 'Sincelejo, Sucre, Colombia',
  contactEmail: 'bienvenido@odontocloudcolombia.com',
  website: 'https://odontocloudcolombia.com'
};

// Renderizador HTML para PDF
function renderLegalHtml(docDef) {
  let contentHtml = '';

  for (const item of docDef.elements) {
    if (item.type === 'h1') {
      contentHtml += `<h1>${item.text}</h1>\n`;
    } else if (item.type === 'h2') {
      contentHtml += `<h2>${item.text}</h2>\n`;
    } else if (item.type === 'h3') {
      contentHtml += `<h3>${item.text}</h3>\n`;
    } else if (item.type === 'p') {
      contentHtml += `<p>${item.text}</p>\n`;
    } else if (item.type === 'list') {
      contentHtml += `<ul>\n`;
      for (const li of item.items) {
        contentHtml += `  <li>${li}</li>\n`;
      }
      contentHtml += `</ul>\n`;
    } else if (item.type === 'ordered_list') {
      contentHtml += `<ol>\n`;
      for (const li of item.items) {
        contentHtml += `  <li>${li}</li>\n`;
      }
      contentHtml += `</ol>\n`;
    } else if (item.type === 'callout') {
      const cls = item.style === 'warning' ? 'callout-warning' : (item.style === 'legal' ? 'callout-legal' : '');
      contentHtml += `<div class="callout ${cls}">\n`;
      if (item.title) contentHtml += `  <div class="callout-title">${item.title}</div>\n`;
      contentHtml += `  <p style="margin:0;">${item.text}</p>\n`;
      contentHtml += `</div>\n`;
    } else if (item.type === 'table') {
      contentHtml += `<table>\n<thead>\n<tr>\n`;
      for (const col of item.headers) {
        contentHtml += `  <th style="width:${col.width || 'auto'}">${col.text}</th>\n`;
      }
      contentHtml += `</tr>\n</thead>\n<tbody>\n`;
      for (const row of item.rows) {
        contentHtml += `<tr>\n`;
        for (const cell of row) {
          contentHtml += `  <td>${cell}</td>\n`;
        }
        contentHtml += `</tr>\n`;
      }
      contentHtml += `</tbody>\n</table>\n`;
    } else if (item.type === 'page_break') {
      contentHtml += `<div class="page-break"></div>\n`;
    }
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${docDef.code} — ${docDef.title}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 15mm 18mm 15mm;
      @bottom-right {
        content: counter(page) " de " counter(pages);
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.55;
      font-size: 9.6pt;
      background: #ffffff;
      margin: 0; padding: 0;
    }
    .page-break { page-break-before: always; }
    .header-bar {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2px solid #0f172a; padding-bottom: 7px; margin-bottom: 18px;
    }
    .header-logo { height: 35px; width: auto; }
    .header-meta { text-align: right; font-size: 7.5pt; color: #475569; font-weight: 600; }
    .header-meta span { color: #0d9488; font-weight: 700; }
    .cover {
      height: 90vh; display: flex; flex-direction: column; justify-content: space-between; padding: 20px;
    }
    .cover-top { text-align: center; padding-top: 25px; }
    .cover-logo { height: 85px; margin-bottom: 18px; }
    .cover-code {
      display: inline-block; background: #0f172a; color: #38bdf8;
      font-size: 8.5pt; font-weight: 800; padding: 4px 14px; border-radius: 999px;
      letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;
    }
    .cover-title {
      font-size: 20pt; font-weight: 900; color: #0f172a; line-height: 1.25; margin: 0 0 10px 0;
    }
    .cover-subtitle {
      font-size: 11pt; color: #0d9488; font-weight: 600; max-width: 650px; margin: 0 auto;
    }
    .cover-badge-bar {
      margin-top: 22px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;
    }
    .cover-badge {
      border: 1px solid #cbd5e1; padding: 5px 12px; border-radius: 8px; font-size: 8pt;
      font-weight: 600; color: #334155; background: #f8fafc;
    }
    .cover-status-banner {
      background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6;
      padding: 8px 12px; border-radius: 6px; margin-top: 18px; font-size: 8pt;
      color: #1e40af; font-weight: 600; text-align: center;
    }
    .cover-footer {
      border-top: 1px solid #e2e8f0; padding-top: 14px; display: grid;
      grid-template-columns: 1fr 1fr; gap: 15px; font-size: 8pt; color: #475569;
    }
    .cover-footer strong { color: #0f172a; }
    h1 {
      color: #0f172a; font-size: 13pt; font-weight: 800; border-left: 4px solid #0d9488;
      padding-left: 10px; margin-top: 18px; margin-bottom: 8px;
    }
    h2 {
      color: #1e293b; font-size: 11pt; font-weight: 700; margin-top: 12px; margin-bottom: 5px;
    }
    h3 {
      color: #334155; font-size: 10pt; font-weight: 700; margin-top: 9px; margin-bottom: 3px;
    }
    p { margin: 0 0 8px 0; text-align: justify; }
    ul, ol { margin: 0 0 10px 0; padding-left: 20px; }
    li { margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 14px 0; font-size: 8.3pt; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 7.7pt; }
    tr:nth-child(even) td { background-color: #f8fafc; }
    .callout {
      border-left: 4px solid #0284c7; background: #f0f9ff; padding: 9px 12px;
      border-radius: 0 8px 8px 0; margin: 10px 0; font-size: 8.5pt;
    }
    .callout-title { font-weight: 800; color: #0369a1; margin-bottom: 3px; }
    .callout-warning { border-left-color: #f59e0b; background: #fffbeb; }
    .callout-warning .callout-title { color: #b45309; }
    .callout-legal { border-left-color: #0d9488; background: #f0fdfa; }
    .callout-legal .callout-title { color: #0f766e; }
    .var-field {
      background: #fef08a; color: #854d0e; font-weight: 700; padding: 1px 4px; border-radius: 3px;
    }
    .status-opt {
      font-weight: 700; color: #0f766e;
    }
    .signature-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 35px;
    }
    .sig-box {
      border-top: 1px solid #0f172a; padding-top: 8px; font-size: 8pt; line-height: 1.4;
    }
    .sig-box strong { color: #0f172a; font-size: 8.5pt; }
    .doc-footer {
      border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 20px;
      font-size: 7.5pt; color: #64748b; display: flex; justify-content: space-between;
    }
  </style>
</head>
<body>
  <!-- PORTADA -->
  <div class="cover">
    <div class="cover-top">
      <img src="${logoBase64}" class="cover-logo" alt="OdontoCloud Logo" />
      <div><span class="cover-code">${docDef.code}</span></div>
      <h1 class="cover-title">${docDef.title}</h1>
      <div class="cover-subtitle">${docDef.subtitle}</div>
      <div class="cover-badge-bar">
        <div class="cover-badge">Software Odontológico SaaS</div>
        <div class="cover-badge">Modelo Contractual Reutilizable</div>
        <div class="cover-badge">Protección Legal de Datos (Ley 1581)</div>
        <div class="cover-badge">Custodia Sanitaria HCE (Res. 839/2017)</div>
      </div>
      <div class="cover-status-banner">
        📋 ESTADO: ${INSTITUTIONAL_META.dossierStatus}
      </div>
    </div>
    
    <div class="cover-footer">
      <div>
        <strong>Proveedor Tecnológico:</strong> ${INSTITUTIONAL_META.softwareName}<br>
        <strong>Titular / Razón Social:</strong> ${INSTITUTIONAL_META.legalEntity} (${INSTITUTIONAL_META.personType})<br>
        <strong>Identificación / NIT:</strong> C.C. ${INSTITUTIONAL_META.idNumber} | NIT ${INSTITUTIONAL_META.nit}<br>
        <strong>Registro Mercantil:</strong> ${INSTITUTIONAL_META.camaraComercio} — Matrícula ${INSTITUTIONAL_META.matriculaMercantil}<br>
        <strong>Domicilio Legal:</strong> ${INSTITUTIONAL_META.city}
      </div>
      <div>
        <strong>Código de Documento:</strong> ${docDef.code}<br>
        <strong>Versión del Modelo:</strong> ${docDef.version}<br>
        <strong>Fecha de Emisión:</strong> ${docDef.date}<br>
        <strong>Actividad Económica:</strong> CIIU ${INSTITUTIONAL_META.ciiu}<br>
        <strong>Portal Oficial:</strong> ${INSTITUTIONAL_META.website}<br>
        <strong>Contacto Oficial:</strong> ${INSTITUTIONAL_META.contactEmail}
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ENCABEZADO DE PÁGINA INTERNA -->
  <div class="header-bar">
    <img src="${logoBase64}" class="header-logo" alt="OdontoCloud Logo" />
    <div class="header-meta">
      ${docDef.code} — Versión ${docDef.version}<br>
      <span>OdontoCloud Colombia</span> — Paquete Legal de Contratación
    </div>
  </div>

  <!-- CONTENIDO COMPLETO -->
  ${contentHtml}

  <!-- FIRMAS CONTRACTUALES -->
  ${docDef.customSignatureHtml || ''}

  <div class="doc-footer">
    <span>${docDef.code} — ${docDef.title}</span>
    <span>OdontoCloud © 2026. Documentación Legal y de Contratación.</span>
  </div>
</body>
</html>`;
}

// Renderizador DOCX nativo completo
async function renderLegalDocx(docDef) {
  const docxElements = [];

  // Título y Portada
  docxElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: logoBuffer,
          transformation: { width: 95, height: 95 },
          type: "png"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: docDef.code, bold: true, size: 28, color: "0F172A" }),
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({ text: docDef.title, bold: true, size: 32, color: "0D9488" })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: docDef.subtitle, italic: true, size: 20, color: "475569" })
      ]
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `ESTADO: ${INSTITUTIONAL_META.dossierStatus}`, bold: true, size: 18, color: "2563EB" })
      ]
    }),
    new Paragraph({ text: "" }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Código Documental", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: docDef.code })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Versión del Modelo", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: docDef.version })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proveedor / Titular", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: `${INSTITUTIONAL_META.legalEntity} (${INSTITUTIONAL_META.personType})` })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Identificación y NIT", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: `C.C. ${INSTITUTIONAL_META.idNumber} | NIT ${INSTITUTIONAL_META.nit}` })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Registro Mercantil", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: `${INSTITUTIONAL_META.camaraComercio} — Matrícula ${INSTITUTIONAL_META.matriculaMercantil}` })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Domicilio Principal", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: INSTITUTIONAL_META.city })] })
          ]
        })
      ]
    }),
    new Paragraph({ text: "" })
  );

  // Renderizar elementos del cuerpo
  for (const item of docDef.elements) {
    if (item.type === 'h1') {
      docxElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({ text: item.text.replace(/<[^>]+>/g, ''), bold: true, size: 24, color: "0F172A" })
          ]
        })
      );
    } else if (item.type === 'h2') {
      docxElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: item.text.replace(/<[^>]+>/g, ''), bold: true, size: 21, color: "0D9488" })
          ]
        })
      );
    } else if (item.type === 'h3') {
      docxElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({ text: item.text.replace(/<[^>]+>/g, ''), bold: true, size: 19, color: "334155" })
          ]
        })
      );
    } else if (item.type === 'p') {
      docxElements.push(
        new Paragraph({
          children: [
            new TextRun({ text: item.text.replace(/<[^>]+>/g, ''), size: 19, color: "1E293B" })
          ]
        })
      );
    } else if (item.type === 'list' || item.type === 'ordered_list') {
      for (const li of item.items) {
        docxElements.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: li.replace(/<[^>]+>/g, ''), size: 19, color: "1E293B" })
            ]
          })
        );
      }
    } else if (item.type === 'callout') {
      const calloutText = `${item.title ? item.title + '\n' : ''}${item.text}`.replace(/<[^>]+>/g, '');
      docxElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: item.style === 'warning' ? "FFFBEB" : "F0FDFA" },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: calloutText, italic: true, size: 18, color: item.style === 'warning' ? "B45309" : "0F766E" })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),
        new Paragraph({ text: "" })
      );
    } else if (item.type === 'table') {
      const rows = [];
      rows.push(
        new TableRow({
          children: item.headers.map(h => 
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "0F172A" },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: h.text.replace(/<[^>]+>/g, ''), bold: true, size: 17, color: "FFFFFF" })]
                })
              ]
            })
          )
        })
      );
      for (const r of item.rows) {
        rows.push(
          new TableRow({
            children: r.map(c => 
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: c.replace(/<[^>]+>/g, ''), size: 17, color: "1E293B" })]
                  })
                ]
              })
            )
          })
        );
      }
      docxElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows
        }),
        new Paragraph({ text: "" })
      );
    }
  }

  // Cuadro de Firmas Final DOCX
  if (docDef.customSignatureDocx) {
    docxElements.push(...docDef.customSignatureDocx);
  }

  const doc = new Document({
    creator: "OdontoCloud Colombia",
    title: `${docDef.code} — ${docDef.title}`,
    description: docDef.subtitle,
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: `OdontoCloud Colombia | ${docDef.code} — Versión ${docDef.version}`, bold: true, size: 18, color: "0D9488" }),
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "OdontoCloud Colombia © 2026 — Modelo Contractual en Revisión", size: 16, color: "64748B" })
              ]
            })
          ]
        })
      },
      children: docxElements
    }]
  });

  return await Packer.toBuffer(doc);
}

// =========================================================================================
// DEFINICIÓN AJUSTADA DEL CONTRATO CON-01
// =========================================================================================

export const con01 = {
  code: 'CON-01',
  title: 'Contrato de Prestación del Servicio OdontoCloud SaaS',
  subtitle: 'Contrato Marco de Licenciamiento de Uso de Software Asistencial en la Nube, Alojamiento, Respaldo y Soporte Técnico',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS',
  elements: [
    {
      type: 'h1',
      text: '1. Comparecientes e Identificación de las Partes'
    },
    {
      type: 'p',
      text: 'Entre los suscritos a saber:'
    },
    {
      type: 'p',
      text: '<strong>DE UNA PARTE:</strong> <strong>JUAN EDUARDO MADRID REQUENA</strong>, mayor de edad, domiciliado y residente en la ciudad de Sincelejo, departamento de Sucre, identificado con Cédula de Ciudadanía No. 1102849760 de Sincelejo, titular del Número de Identificación Tributaria <strong>NIT 1102849760-5</strong> (sujeto a cotejo con RUT vigente expedido por la Dirección de Impuestos y Aduanas Nacionales - DIAN), en su condición de <strong>Persona Natural Comerciante</strong> con Matrícula Mercantil No. <strong>148131</strong> de la Cámara de Comercio de Sincelejo (activa 2026, sujeta a cotejo con certificado mercantil vigente), con actividad económica principal registrada bajo el código CIIU 6312 (Portales web y servicios de procesamiento de datos), actuando en nombre propio y en calidad de titular, creador y propietario exclusivo de la solución tecnológica denominada <strong>OdontoCloud Colombia</strong> (en adelante, <strong>EL PROVEEDOR</strong> o <strong>EL CONTRATISTA</strong>), con sitio web oficial <em>https://odontocloudcolombia.com</em> y canal oficial de notificaciones judiciales y operativas <em>bienvenido@odontocloudcolombia.com</em>.'
    },
    {
      type: 'p',
      text: '<strong>DE OTRA PARTE:</strong> <span class="var-field">[RAZÓN SOCIAL DE LA INSTITUCIÓN PRESTADORA DE SERVICIOS DE SALUD (IPS) O CONSULTORIO ODONTOLÓGICO]</span>, entidad prestadora de servicios de salud legalmente constituida, identificada con el <strong>NIT No. <span class="var-field">[NIT_DE_LA_CLÍNICA]</span></strong>, con domicilio principal en la ciudad de <span class="var-field">[CIUDAD]</span>, departamento de <span class="var-field">[DEPARTAMENTO]</span>, dirección de sede <span class="var-field">[DIRECCIÓN_SEDE_PRINCIPAL]</span>, con Código de Habilitación ante el Registro Especial de Prestadores de Servicios de Salud (REPS) No. <span class="var-field">[CÓDIGO_REPS_12_DÍGITOS]</span>, representada legalmente en este acto por <strong><span class="var-field">[NOMBRE_DEL_REPRESENTANTE_LEGAL]</span></strong>, mayor de edad, identificado(a) con Cédula de Ciudadanía No. <span class="var-field">[CÉDULA_REPRESENTANTE]</span>, con correo electrónico oficial para notificaciones <span class="var-field">[CORREO_NOTIFICACIONES_CLÍNICA]</span> y teléfono de contacto <span class="var-field">[TELÉFONO_CLÍNICA]</span> (en adelante, <strong>EL CONTRATANTE</strong> o <strong>LA CLÍNICA</strong>).'
    },
    {
      type: 'p',
      text: 'Quienes en adelante se denominarán conjuntamente como <strong>LAS PARTES</strong>, han convenido celebrar el presente <strong>CONTRATO DE PRESTACIÓN DE SERVICIOS DE SOFTWARE EN LA NUBE (SaaS)</strong>, el cual se regirá por la legislación comercial colombiana, las normas de protección de datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013), las disposiciones sanitarias sobre historia clínica (Resolución 1995 de 1999 y Resolución 839 de 2017 del Ministerio de Salud y Protección Social) y en especial por las siguientes cláusulas contractuales:'
    },
    {
      type: 'h1',
      text: 'Cláusula Primera — Objeto del Contrato'
    },
    {
      type: 'p',
      text: 'EL PROVEEDOR se obliga a conceder a favor de LA CLÍNICA, bajo la modalidad de <strong>Software as a Service (SaaS)</strong>, una licencia de uso no exclusiva, no sublicenciable, revocable e intransferible para el acceso a través de internet a la plataforma informática asistencial <strong>OdontoCloud Colombia (Versión 2026.1, Release 8.2)</strong>, comprendiendo los servicios de alojamiento en nube (hosting), gestión de base de datos relacional multi-inquilino aislada lógicamente, rutinas periódicas de respaldo lógico de datos y servicio de mesa de ayuda técnica.'
    },
    {
      type: 'h1',
      text: 'Cláusula Segunda — Selección y Estado Individual de Módulos Contratados'
    },
    {
      type: 'p',
      text: 'El alcance operativo de la licencia conferida dependerá de los módulos funcionales habilitados específicamente para LA CLÍNICA al momento de la suscripción, según la siguiente matriz de selección individual:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Módulo Funcional', width: '22%' },
        { text: 'Descripción Operativa y Alcance', width: '48%' },
        { text: 'Estado para la Clínica (Marcar Selección)', width: '30%' }
      ],
      rows: [
        [
          '1. Gestión de Pacientes y Filiación SGSSS',
          'Registro sociodemográfico, régimen de afiliación en salud, antecedentes médicos y estomatológicos, alertas de alergias.',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '2. Agenda Odontológica y Turnos',
          'Asignación de citas por profesional, sillón y sede; control de estados de cita (programada, atendida, cancelada); recordatorios.',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '3. Historia Clínica Odontológica Electrónica (HCE)',
          'Anamnesis estomatológica, examen clínico estomatológico integral, diagnósticos codificados en estándar CIE-10.',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '4. Odontograma Digital Interactivo',
          'Odontograma inicial y evolutivo en nomenclaturas FDI y Universal; registro visual de patologías y procedimientos dentales.',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '5. Evoluciones Clínicas Inmutables',
          'Registro cronológico secuencial foliado mediante clock_timestamp() UTC y soporte de adendas normativas (Res. 1995/1999).',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '6. Consentimientos Informados Digitales',
          'Plantillas procedimentales, captura de firma táctil vectorial del paciente o acudiente en pantalla y archivo PDF inmutable.',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '7. Presupuestos y Planes de Tratamiento',
          'Estructuración de planes odontológicos por fases, tarifas institucionales y procedimientos codificados en CUPS.',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '8. Facturación Electrónica en Salud (FEV)',
          'Emisión de Factura Electrónica de Venta con validación previa DIAN mediante conector Factus, con código CUFE y QR.',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '9. RIPS Formato JSON (Res. 2275/2023)',
          'Generación de estructuras JSON de usuarios, consultas y procedimientos; suite de validación pre-radicación ministerial.',
          '<span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas<br>[ ] Pendiente'
        ],
        [
          '10. Interoperabilidad IHCE (Res. 1888/2025)',
          'Conector base REST para intercambio de resúmenes de atención clínica. <strong>Nota de alcance:</strong> En fase de pruebas / preproducción en sandbox ministerial; no homologado ni habilitado para producción hasta contar con autorización oficial.',
          '[ ] Contratado<br>[ ] No contratado<br><span class="var-field">[X] En pruebas</span><br>[ ] Pendiente'
        ]
      ]
    },
    {
      type: 'h1',
      text: 'Cláusula Tercera — Plan Comercial, Canon Periódico y Condiciones de Pago'
    },
    {
      type: 'p',
      text: '<strong>1. Plan Seleccionado:</strong> LA CLÍNICA contrata el plan <strong><span class="var-field">[PLAN: BÁSICO / PROFESIONAL / IPS MULTISEDE]</span></strong>, el cual autoriza hasta <strong><span class="var-field">[NÚMERO_DE_USUARIOS]</span></strong> usuarios profesionales/asistenciales concurrentes activos en el sistema.'
    },
    {
      type: 'p',
      text: '<strong>2. Canon Periódico:</strong> Por los servicios objeto del contrato, LA CLÍNICA pagará a EL PROVEEDOR la suma de <strong>$<span class="var-field">[VALOR_EN_NÚMEROS]</span> COP</strong> (<span class="var-field">[VALOR_EN_LETRAS]</span> PESOS MONEDA CORRIENTE), pagaderos de manera <strong><span class="var-field">[MENSUAL / ANUAL ANTICIPADA]</span></strong>.'
    },
    {
      type: 'p',
      text: '<strong>3. Plazo y Forma de Pago:</strong> El canon deberá ser cancelado dentro de los primeros <strong><span class="var-field">[CINCO (5)]</span></strong> días hábiles siguientes al inicio de cada periodo facturado, mediante transferencia o consignación bancaria a la cuenta corriente/ahorros No. <span class="var-field">[NÚMERO_DE_CUENTA]</span> del Banco <span class="var-field">[BANCO]</span> a nombre de JUAN EDUARDO MADRID REQUENA.'
    },
    {
      type: 'p',
      text: '<strong>4. Reajuste Anual:</strong> En caso de prórroga automática, el canon se reajustará anualmente a partir del primer día del periodo prorrogado conforme a la variación acumulada del Índice de Precios al Consumidor (IPC) del año anterior certificado por el DANE o el porcentaje que de común acuerdo pacten LAS PARTES por escrito.'
    },
    {
      type: 'h1',
      text: 'Cláusula Cuarta — Vigencia, Duración y Prórrogas'
    },
    {
      type: 'p',
      text: 'El presente contrato tendrá una vigencia inicial de <strong><span class="var-field">[UN (1) AÑO]</span></strong>, contado a partir de la fecha de suscripción del Acta de Entrega, Configuración y Puesta en Marcha (CON-03). El término se prorrogará automáticamente por periodos iguales sucesivos, a menos que cualquiera de LAS PARTES manifieste a la otra por escrito su voluntad de no prorrogarlo con una antelación no inferior a <strong>treinta (30) días calendario</strong> a la fecha de vencimiento del periodo inicial o de sus prórrogas.'
    },
    {
      type: 'h1',
      text: 'Cláusula Quinta — Delimitación de Responsabilidades Técnicas de EL PROVEEDOR'
    },
    {
      type: 'p',
      text: 'EL PROVEEDOR asume exclusivamente obligaciones de medio técnico respecto al funcionamiento del software y la infraestructura cloud provista, a saber:'
    },
    {
      type: 'list',
      items: [
        '<strong>Compromiso Objetivo de Disponibilidad (SLA):</strong> EL PROVEEDOR procurará mantener un nivel de disponibilidad técnica de la plataforma del noventa y nueve punto cinco por ciento (99.5%) en cómputo mensual, entendido como un objetivo operacional de mejores esfuerzos técnicos y no como una garantía absoluta de ininterrupción. Se excluyen expresamente del cómputo de indisponibilidad: a) Ventanas de mantenimiento preventivo, actualización o despliegue técnico previamente notificadas, preferentemente en horario nocturno no asistencial; b) Fallas o cortes en las redes de telecomunicaciones, proveedores de internet (ISP) o infraestructura local de LA CLÍNICA; c) Interrupciones originadas en el proveedor externo de alojamiento VPS o centros de datos; d) Ataques informáticos masivos externos, denegación de servicio (DDoS) o fuerza mayor. Cualquier compensación comercial aplicable por indisponibilidad no atribuible a excepciones se regirá por el plan pactado entre LAS PARTES.',
        '<strong>Política Verificable de Copias de Seguridad:</strong> Implementar y mantener una rutina de respaldos lógicos periódicos de la base de datos relacional mediante utilidades de volcado transaccional (pg_dump comprimido .Fc o instantáneas a nivel de contenedor), almacenados en el servidor host del entorno cloud asignado a OdontoCloud, con fines de recuperación operativa ante fallos de la plataforma. EL PROVEEDOR no asume almacenamiento redundante externo multirregión ni esquemas de cifrado independientes que no hayan sido expresamente verificados y pactados como servicio adicional. LA CLÍNICA mantiene la facultad y el deber de realizar periódicamente sus propias descargas y respaldos institucionales.',
        '<strong>Aislamiento Lógico Multi-Inquilino:</strong> Garantizar la segregación estricta de datos entre prestadores de salud mediante políticas lógicas de base de datos (Row Level Security - RLS), asegurando que ningún usuario de otra entidad pueda acceder a la información de LA CLÍNICA.',
        '<strong>Soporte Técnico Operativo:</strong> Poner a disposición de LA CLÍNICA los canales de asistencia técnica (Asistente IA 24/7, línea de WhatsApp de ingeniería y correo oficial bienvenido@odontocloudcolombia.com) conforme a los alcances y tiempos de respuesta convenidos.',
        '<strong>Notificación de Incidentes de Seguridad:</strong> Notificar formalmente a LA CLÍNICA cualquier incidente de seguridad comprobado que comprometa la confidencialidad de datos personales sensibles de salud, dentro de las veinticuatro (24) horas siguientes a su confirmación técnica, conforme a la Ley 1581 de 2012.',
        '<strong>Herramientas de Exportación:</strong> Mantener habilitadas en la plataforma las funciones de exportación de historias clínicas, evoluciones, odontogramas y consentimientos en formatos abiertos estándar (PDF foliado, CSV y JSON) para facilitar la portabilidad de datos.'
      ]
    },
    {
      type: 'h1',
      text: 'Cláusula Sexta — Delimitación de Responsabilidades Clínicas y Sanitarias de LA CLÍNICA'
    },
    {
      type: 'p',
      text: 'LA CLÍNICA, en su condición indelegable de prestadora de servicios de salud, asume la totalidad de las responsabilidades asistenciales, deontológicas y normativas:'
    },
    {
      type: 'list',
      items: [
        '<strong>Responsabilidad Asistencial Exclusiva e Indelegable:</strong> El acto odontológico, los diagnósticos, planes de tratamiento, prescripción de medicamentos, pertinencia médica, diligenciamiento de notas de evolución y la relación profesional-paciente son de responsabilidad exclusiva, directa e indelegable de LA CLÍNICA y de sus profesionales tratantes. EL PROVEEDOR actúa estrictamente como proveedor de una herramienta tecnológica y no ejerce la odontología ni audita el criterio médico.',
        '<strong>Habilitación Sanitaria ante el REPS:</strong> Cumplir y mantener vigentes las condiciones de habilitación de servicios de salud ante la Secretaría de Salud departamental/distrital y el Registro Especial de Prestadores de Servicios de Salud (REPS) conforme a la Resolución 3100 de 2019 de MinSalud. La provisión de este software no constituye habilitación ni exime a LA CLÍNICA de sus obligaciones regulatorias.',
        '<strong>Custodia Estricta de Credenciales:</strong> Asignar usuarios individuales con contraseña personal e intransferible a cada profesional y funcionario asistencial. Queda terminantemente prohibido el uso de credenciales compartidas o genéricas.',
        '<strong>Veracidad e Integridad de la Información:</strong> Garantizar la exactitud, licitud y veracidad de todos los datos clínicos y demográficos incorporados en la plataforma.',
        '<strong>Terminales y Conectividad Cliente:</strong> Disponer de equipos de cómputo en buen estado operativo, navegadores web actualizados y enlaces a internet estables que cumplan los requisitos mínimos del sistema.',
        '<strong>Pago Oportuno:</strong> Cancelar puntualmente el canon pactado en los términos de la Cláusula Tercera.'
      ]
    },
    {
      type: 'h1',
      text: 'Cláusula Séptima — Suspensión del Servicio por Mora y Procedimiento Previo de Salvaguarda'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '⚠️ Procedimiento Previo de Notificación y Salvaguarda ante Mora',
      text: 'En caso de mora superior a treinta (30) días calendario en el pago del canon acordado, EL PROVEEDOR notificará formalmente a LA CLÍNICA mediante comunicación enviada al correo electrónico registrado, otorgando un plazo perentorio de quince (15) días calendario para la regularización de la obligación económica o para que LA CLÍNICA, con anterioridad a cualquier corte del servicio, coordine y ejecute la descarga y exportación de sus historias clínicas y registros activos a través de las herramientas disponibles en la plataforma. Vencido dicho plazo sin subsanación del pago ni suscripción de acuerdo de prórroga, EL PROVEEDOR podrá proceder a la suspensión temporal del acceso a la plataforma, dejando constancia de la notificación previa efectuada a la IPS para la debida protección de la información clínica.'
    },
    {
      type: 'h1',
      text: 'Cláusula Octava — Custodia Sanitaria, Exportación Verificable y Tratamiento Posterior de Datos'
    },
    {
      type: 'p',
      text: '<strong>1. Custodia Legal a Cargo Privativo de la IPS:</strong> Conforme al artículo 3 de la Resolución 839 de 2017 del Ministerio de Salud y Protección Social, la custodia, archivo y conservación legal de las historias clínicas por el término obligatorio de <strong>quince (15) años</strong> (cinco años en archivo de gestión y diez en archivo central) corresponde de forma privativa e indelegable al Prestador de Servicios de Salud (LA CLÍNICA). OdontoCloud actúa única y transitoriamente como herramienta de archivo digital mientras el contrato se encuentre vigente y con obligaciones al día.'
    },
    {
      type: 'p',
      text: '<strong>2. Plazo de Gracia para Exportación Verificable:</strong> A la terminación del contrato por cualquier causa, LA CLÍNICA dispondrá de un plazo improrrogable de <strong>sesenta (60) días calendario</strong> para descargar y respaldar en sus propios sistemas o soportes locales la totalidad de las historias clínicas, odontogramas, notas de evolución, consentimientos informados y datos financieros en formatos abiertos estándar (PDF foliado, CSV y JSON).'
    },
    {
      type: 'p',
      text: '<strong>3. Entrega Documentada y Fin del Alojamiento:</strong> Al concluir la descarga o al vencimiento del plazo de sesenta (60) días, LAS PARTES suscribirán un <strong>Acta de Cierre y Entrega Documentada de Información</strong>, en la cual LA CLÍNICA certifica haber recibido o descargado la totalidad de sus datos bajo su exclusiva custodia legal.'
    },
    {
      type: 'p',
      text: '<strong>4. Tratamiento Posterior de la Información:</strong> EL PROVEEDOR <strong>no asume custodia pasiva indefinida ni gratuita</strong> de las bases de datos de LA CLÍNICA, ni ejecutará eliminación automática desatendida de la información sin previo aviso. Vencido el plazo de gracia sin que LA CLÍNICA haya retirado sus datos ni suscrito el acta de cierre, EL PROVEEDOR enviará un requerimiento final con quince (15) días de preaviso; transcurrido este término, EL PROVEEDOR quedará facultado para aplicar la tarifa de custodia transitoria acordada o proceder al retiro definitivo y disposición de los contenedores de base de datos conforme a la legislación vigente y a las instrucciones impartidas en el Anexo DOC-06.'
    },
    {
      type: 'h1',
      text: 'Cláusula Novena — Protección de Datos Personales y Acuerdo de Encargo (Anexo DOC-06)'
    },
    {
      type: 'p',
      text: 'En el marco de la Ley 1581 de 2012 y su Decreto Reglamentario 1377 de 2013, LAS PARTES declaran que LA CLÍNICA actúa como <strong>Responsable del Tratamiento</strong> de los datos personales y sensibles de salud de sus pacientes, y EL PROVEEDOR actúa en calidad de <strong>Encargado del Tratamiento</strong>. Se incorpora como parte integral e indisoluble del presente contrato el <strong>ANEXO NO. 1: ACUERDO DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES (DOC-06)</strong>, el cual es un documento contractual sujeto a revisión jurídica y firma bilateral, en el cual se estipulan de manera detallada: el alcance y finalidad del tratamiento, las instrucciones del Responsable, la estricta confidencialidad del personal técnico, la autorización de subencargados de infraestructura cloud/VPS, las medidas de seguridad lógicas y organizativas aplicadas, y el protocolo de devolución o supresión de la información al finalizar el vínculo contractual.'
    },
    {
      type: 'h1',
      text: 'Cláusula Décima — Propiedad Intelectual y Titularidad de la Información'
    },
    {
      type: 'p',
      text: 'Todo el software, código fuente, algoritmos, arquitectura técnica, interfaces gráficas, logotipos, marcas comerciales y documentación técnica de OdontoCloud son de propiedad exclusiva de <strong>JUAN EDUARDO MADRID REQUENA</strong>. LA CLÍNICA no adquiere derechos de autor ni de propiedad intelectual sobre el sistema, limitándose su derecho a la licencia temporal de uso pactada. Por su parte, la información clínica, fichas de pacientes, diagnósticos y consentimientos informados son de propiedad de los pacientes y bajo la custodia legal indelegable de LA CLÍNICA.'
    },
    {
      type: 'h1',
      text: 'Cláusula Undécima — Causales de Terminación'
    },
    {
      type: 'p',
      text: 'El presente contrato terminará por: a) Mutuo acuerdo entre LAS PARTES manifestado por escrito; b) Vencimiento del plazo pactado o de sus prórrogas mediando el preaviso escrito de treinta (30) días; c) Incumplimiento grave de las obligaciones contractuales por cualquiera de LAS PARTES, no subsanado dentro de los quince (15) días siguientes al requerimiento formal; d) Liquidación, disolución o cancelación de la personería jurídica o habilitación REPS de LA CLÍNICA; e) Fuerza mayor o caso fortuito debidamente acreditado.'
    },
    {
      type: 'h1',
      text: 'Cláusula Duodécima — Solución de Controversias y Domicilio Contractual'
    },
    {
      type: 'p',
      text: 'Las diferencias que surjan entre LAS PARTES con motivo de la celebración, interpretación, ejecución o terminación de este contrato se procurarán resolver en primera instancia mediante arreglo directo en un término de quince (15) días hábiles. De persistir el desacuerdo, LAS PARTES acudirán a un Centro de Conciliación legalmente autorizado en la ciudad de Sincelejo, Sucre. Para todos los efectos legales y fiscales, se fija como domicilio contractual la ciudad de Sincelejo, departamento de Sucre, República de Colombia.'
    },
    {
      type: 'p',
      text: 'En constancia de lo acordado y en señal de conformidad, el presente contrato se firma en dos (2) ejemplares de idéntico tenor y valor legal, en la ciudad de Sincelejo, a los <span class="var-field">[DÍA]</span> días del mes de <span class="var-field">[MES]</span> del año <span class="var-field">[AÑO]</span>.'
    }
  ],
  customSignatureHtml: `
  <div class="signature-grid">
    <div class="sig-box">
      <strong>POR EL PROVEEDOR (CONTRATISTA):</strong><br><br><br>
      ___________________________________________<br>
      <strong>JUAN EDUARDO MADRID REQUENA</strong><br>
      Persona Natural Comerciante<br>
      C.C. No. 1102849760 de Sincelejo<br>
      NIT: 1102849760-5 (Sujeto a cotejo con RUT vigente)<br>
      Matrícula Mercantil No. 148131 — C.C. Sincelejo (Sujeta a cotejo)<br>
      OdontoCloud Colombia<br>
      Correo: bienvenido@odontocloudcolombia.com
    </div>
    <div class="sig-box">
      <strong>POR EL CONTRATANTE (LA CLÍNICA):</strong><br><br><br>
      ___________________________________________<br>
      <strong><span class="var-field">[NOMBRE_REPRESENTANTE_LEGAL]</span></strong><br>
      Representante Legal / Director Médico<br>
      C.C. No. <span class="var-field">[CÉDULA_REPRESENTANTE]</span><br>
      <span class="var-field">[RAZÓN SOCIAL DE LA IPS / CONSULTORIO]</span><br>
      NIT: <span class="var-field">[NIT_DE_LA_CLÍNICA]</span><br>
      Código REPS: <span class="var-field">[CÓDIGO_REPS]</span>
    </div>
  </div>
  `,
  customSignatureDocx: [
    new Paragraph({ text: "" }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "334155" },
              children: [new Paragraph({ children: [new TextRun({ text: "POR EL PROVEEDOR (CONTRATISTA)", bold: true, color: "FFFFFF", size: 16 })] })]
            }),
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "334155" },
              children: [new Paragraph({ children: [new TextRun({ text: "POR EL CONTRATANTE (LA CLÍNICA)", bold: true, color: "FFFFFF", size: 16 })] })]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________\nJUAN EDUARDO MADRID REQUENA\nPersona Natural Comerciante\nC.C. No. 1102849760 de Sincelejo\nNIT: 1102849760-5 (Sujeto a cotejo con RUT)\nMatrícula Mercantil 148131 (C.C. Sincelejo)\nOdontoCloud Colombia\nCorreo: bienvenido@odontocloudcolombia.com", size: 16 })] })
              ]
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________\n[NOMBRE_REPRESENTANTE_LEGAL]\nRepresentante Legal / Director Médico\nC.C. No. [CÉDULA_REPRESENTANTE]\n[RAZÓN SOCIAL DE LA IPS]\nNIT: [NIT_CLINICA] | REPS: [CODIGO_REPS]", size: 16 })] })
              ]
            })
          ]
        })
      ]
    })
  ]
};

// =========================================================================================
// COMPILADOR EXCLUSIVO DE CON-01
// =========================================================================================

async function updateCon01() {
  console.log('Compilando ajuste definitivo de CON-01 (Contrato OdontoCloud SaaS)...\n');
  
  const browser = await chromium.launch({ headless: true });

  // 1. Generar HTML y PDF con Playwright
  const html = renderLegalHtml(con01);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  
  const pdfPath = path.join(PDF_OUT_DIR, `${con01.filenameBase}.pdf`);
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
  });
  await page.close();
  await browser.close();
  
  const pdfStats = fs.statSync(pdfPath);
  console.log(`✓ PDF generado exitosamente: ${pdfPath} (${(pdfStats.size / 1024).toFixed(1)} KB)`);

  // 2. Generar DOCX nativo editable
  const docxBuffer = await renderLegalDocx(con01);
  const docxPath = path.join(DOCX_OUT_DIR, `${con01.filenameBase}.docx`);
  fs.writeFileSync(docxPath, docxBuffer);
  
  const docxStats = fs.statSync(docxPath);
  console.log(`✓ DOCX generado exitosamente: ${docxPath} (${(docxStats.size / 1024).toFixed(1)} KB)\n`);

  // 3. Actualizar el archivo ZIP del Paquete Legal
  console.log('Actualizando archivo ZIP: OdontoCloud-2026-Paquete-Legal-Y-Contratacion.zip...');
  const zip = new JSZip();
  const pdfFolder = zip.folder('pdf');
  const docxFolder = zip.folder('docx');

  for (const f of fs.readdirSync(PDF_OUT_DIR)) {
    pdfFolder.file(f, fs.readFileSync(path.join(PDF_OUT_DIR, f)));
  }
  for (const f of fs.readdirSync(DOCX_OUT_DIR)) {
    docxFolder.file(f, fs.readFileSync(path.join(DOCX_OUT_DIR, f)));
  }
  zip.file('INDICE-Y-GUIA-DE-PERSONALIZACION.md', fs.readFileSync(path.join(BASE_OUT_DIR, 'INDICE-Y-GUIA-DE-PERSONALIZACION.md')));

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const zipPath = path.resolve('documentacion/odontocloud/OdontoCloud-2026-Paquete-Legal-Y-Contratacion.zip');
  fs.writeFileSync(zipPath, zipBuffer);
  console.log(`✓ ZIP actualizado: ${zipPath} (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB)\n`);
}

updateCon01().catch(err => {
  console.error('Error durante la actualización de CON-01:', err);
  process.exit(1);
});
