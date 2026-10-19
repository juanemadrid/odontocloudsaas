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
  dossierStatus: 'BORRADOR OFICIAL PARA PERSONALIZACIÓN Y FIRMA CONTRACTUAL',
  
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
        <div class="cover-badge">Modelo de Contratación Comercial</div>
        <div class="cover-badge">Protección Legal de Datos (Ley 1581)</div>
        <div class="cover-badge">Custodia HCE (Res. 839/2017)</div>
      </div>
      <div class="cover-status-banner">
        📋 ${INSTITUTIONAL_META.dossierStatus}
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
                new TextRun({ text: "OdontoCloud Colombia © 2026 — Paquete Legal de Contratación", size: 16, color: "64748B" })
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
// DEFINICIÓN DE LOS 3 DOCUMENTOS LEGALES (CON-01, CON-02, CON-03)
// =========================================================================================

export const con01 = {
  code: 'CON-01',
  title: 'Contrato de Prestación del Servicio OdontoCloud SaaS',
  subtitle: 'Contrato de Adhesión y Licenciamiento de Uso de Software Asistencial en la Nube, Alojamiento, Respaldo y Soporte Técnico',
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
      text: '<strong>DE UNA PARTE:</strong> <strong>JUAN EDUARDO MADRID REQUENA</strong>, mayor de edad, domiciliado y residente en la ciudad de Sincelejo, departamento de Sucre, identificado con Cédula de Ciudadanía No. 1102849760 de Sincelejo, titular del Número de Identificación Tributaria <strong>NIT 1102849760-5</strong> (sujeto a cotejo con RUT vigente expedido por la DIAN), en su condición de <strong>Persona Natural Comerciante</strong> con Matrícula Mercantil No. <strong>148131</strong> de la Cámara de Comercio de Sincelejo (activa 2026, sujeta a cotejo con certificado mercantil vigente), con actividad económica principal CIIU 6312 (Portales web y servicios de procesamiento de datos), actuando en nombre propio y como creador, titular y propietario exclusivo de la plataforma tecnológica <strong>OdontoCloud Colombia</strong> (en adelante, <strong>EL PROVEEDOR</strong> o <strong>EL CONTRATISTA</strong>), con portal web oficial <em>https://odontocloudcolombia.com</em> y correo electrónico de notificaciones judiciales y operativas <em>bienvenido@odontocloudcolombia.com</em>.'
    },
    {
      type: 'p',
      text: '<strong>DE OTRA PARTE:</strong> <span class="var-field">[RAZÓN SOCIAL DE LA INSTITUCIÓN PRESTADORA DE SERVICIOS DE SALUD (IPS) O CONSULTORIO ODONTOLÓGICO]</span>, entidad prestadora de servicios de salud legalmente constituida, identificada con el <strong>NIT No. <span class="var-field">[NIT_DE_LA_CLÍNICA]</span></strong>, con domicilio principal en la ciudad de <span class="var-field">[CIUDAD]</span>, departamento de <span class="var-field">[DEPARTAMENTO]</span>, dirección <span class="var-field">[DIRECCIÓN_SEDE_PRINCIPAL]</span>, con Código de Habilitación ante el Registro Especial de Prestadores de Servicios de Salud (REPS) No. <span class="var-field">[CÓDIGO_REPS_12_DÍGITOS]</span>, representada legalmente en este acto por <strong><span class="var-field">[NOMBRE_DEL_REPRESENTANTE_LEGAL]</span></strong>, mayor de edad, identificado(a) con Cédula de Ciudadanía No. <span class="var-field">[CÉDULA_REPRESENTANTE]</span>, con correo electrónico para notificaciones <span class="var-field">[CORREO_NOTIFICACIONES_CLÍNICA]</span> y teléfono de contacto <span class="var-field">[TELÉFONO_CLÍNICA]</span> (en adelante, <strong>EL CONTRATANTE</strong> o <strong>LA CLÍNICA</strong>).'
    },
    {
      type: 'p',
      text: 'Quienes en adelante se denominarán conjuntamente como <strong>LAS PARTES</strong>, han convenido celebrar el presente <strong>CONTRATO DE PRESTACIÓN DE SERVICIOS DE SOFTWARE EN LA NUBE (SaaS)</strong>, el cual se regirá por las leyes de la República de Colombia, las normas mercantiles, las disposiciones en materia de protección de datos personales (Ley 1581 de 2012), el régimen sanitario de historia clínica (Resolución 1995 de 1999 y Resolución 839 de 2017) y en especial por las siguientes cláusulas:'
    },
    {
      type: 'h1',
      text: 'Cláusula Primera — Objeto del Contrato'
    },
    {
      type: 'p',
      text: 'EL PROVEEDOR se obliga a conceder a LA CLÍNICA, bajo la modalidad de <strong>Software as a Service (SaaS)</strong>, una licencia de uso no exclusiva, no sublicenciable, revocable e intransferible para el acceso y uso de la plataforma digital en la nube denominada <strong>OdontoCloud Colombia (Versión 2026.1, Release 8.2)</strong>, incluyendo los servicios complementarios de alojamiento cloud, gestión de base de datos relacional multi-inquilino aislada, copias de seguridad automáticas diarias, actualizaciones periódicas del sistema y soporte técnico asistido.'
    },
    {
      type: 'h1',
      text: 'Cláusula Segunda — Módulos Habilitados y Alcance Operativo'
    },
    {
      type: 'p',
      text: 'La licencia de uso conferida mediante el presente contrato comprende el acceso integral a los siguientes módulos funcionales implementados en la plataforma:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Módulo Funcional', width: '25%' },
        { text: 'Descripción Operativa', width: '55%' },
        { text: 'Estado', width: '20%' }
      ],
      rows: [
        [
          '1. Gestión de Pacientes y Filiación',
          'Registro de datos demográficos, régimen de afiliación SGSSS, antecedentes estomatológicos y médicos, alertas de alergias.',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '2. Agenda Odontológica',
          'Programación de citas por profesional, sillón y sede; estados de cita (programada, atendida, cancelada); recordatorios operativos.',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '3. Historia Clínica Electrónica (HCE)',
          'Anamnesis estomatológica, examen clínico estomatológico, diagnósticos codificados en estándar CIE-10.',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '4. Odontograma Digital Interactivo',
          'Odontograma inicial y de evolución en nomenclatura FDI y Universal; registro visual de patologías y tratamientos.',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '5. Evoluciones Clínicas Inmutables',
          'Registro cronológico secuencial con marca de tiempo clock_timestamp() UTC y régimen de adendas normativas (Res. 1995/1999).',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '6. Consentimientos Informados Digitales',
          'Plantillas procedimentales, captura de firma táctil vectorial del paciente o acudiente e inmutabilidad probatoria.',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '7. Presupuestos y Planes de Tratamiento',
          'Estructuración por fases de tratamiento, tarifas institucionales, codificación de procedimientos CUPS.',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '8. Facturación Electrónica en Salud',
          'Emisión sincrónica de Factura Electrónica de Venta (FEV) con validación previa DIAN mediante conector Factus.',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '9. RIPS Formato JSON (Res. 2275/2023)',
          'Generación de esquemas JSON de usuarios, consultas y procedimientos; suite de validación pre-radicación.',
          '<span class="var-field">[HABILITADO]</span>'
        ],
        [
          '10. Interoperabilidad IHCE (Res. 1888/2025)',
          'Conector base REST para intercambio de resúmenes de atención clínica conforme al estándar de MinSalud.',
          '<span class="var-field">[PREPRODUCCIÓN / ACTIVO]</span>'
        ]
      ]
    },
    {
      type: 'h1',
      text: 'Cláusula Tercera — Plan Contratado, Canon Mensual y Condiciones de Pago'
    },
    {
      type: 'p',
      text: '<strong>1. Plan Seleccionado:</strong> LA CLÍNICA contrata el plan <strong><span class="var-field">[PLAN: BÁSICO / PROFESIONAL / IPS CORPORATIVO]</span></strong>, el cual autoriza hasta <strong><span class="var-field">[NÚMERO_DE_USUARIOS]</span></strong> usuarios profesionales/asistenciales concurrentes y capacidad de almacenamiento transaccional para la sede indicada.'
    },
    {
      type: 'p',
      text: '<strong>2. Canon Periódico:</strong> Por el licenciamiento, alojamiento cloud y soporte técnico, LA CLÍNICA pagará a EL PROVEEDOR la suma de <strong>$<span class="var-field">[VALOR_EN_NÚMEROS]</span> COP</strong> (<span class="var-field">[VALOR_EN_LETRAS]</span> PESOS M/CTE), pagaderos de manera <strong><span class="var-field">[MENSUAL / ANUAL ANTICIPADA]</span></strong>.'
    },
    {
      type: 'p',
      text: '<strong>3. Fecha y Plazo de Pago:</strong> El canon deberá ser cancelado dentro de los primeros <strong><span class="var-field">[CINCO (5)]</span></strong> días hábiles siguientes al inicio de cada periodo facturado, mediante consignación o transferencia bancaria a la cuenta corriente/ahorros No. <span class="var-field">[NÚMERO_DE_CUENTA]</span> del Banco <span class="var-field">[BANCO]</span> a nombre de JUAN EDUARDO MADRID REQUENA.'
    },
    {
      type: 'p',
      text: '<strong>4. Reajuste Anual:</strong> En caso de prórroga, el canon se reajustará anualmente conforme a la variación del Índice de Precios al Consumidor (IPC) del año inmediatamente anterior certificado por el DANE o el porcentaje que de común acuerdo pacten LAS PARTES.'
    },
    {
      type: 'h1',
      text: 'Cláusula Cuarta — Vigencia, Duración y Prórrogas'
    },
    {
      type: 'p',
      text: 'El presente contrato tendrá una vigencia inicial de <strong><span class="var-field">[UN (1) AÑO]</span></strong>, contado a partir de la fecha de suscripción del Acta de Entrega, Configuración y Puesta en Marcha (CON-03). El término se prorrogará automáticamente por periodos sucesivos iguales, salvo que cualquiera de LAS PARTES manifieste a la otra por escrito su intención de no prorrogarlo con una antelación no inferior a <strong>treinta (30) días calendario</strong> a la fecha de vencimiento.'
    },
    {
      type: 'h1',
      text: 'Cláusula Quinta — Obligaciones de EL PROVEEDOR'
    },
    {
      type: 'p',
      text: 'Constituyen obligaciones específicas de EL PROVEEDOR:'
    },
    {
      type: 'list',
      items: [
        '<strong>Disponibilidad Operativa:</strong> Garantizar una disponibilidad técnica objetivo de la plataforma del noventa y nueve punto cinco por ciento (99.5%) mensual, excluyendo las ventanas de mantenimiento nocturno previamente notificadas.',
        '<strong>Copias de Seguridad Diarias:</strong> Ejecutar respaldos transaccionales automáticos de la base de datos (pg_dump -Fc) diariamente a las 02:00 AM COT, cifrados en reposo y almacenados en volumen secundario redundante.',
        '<strong>Aislamiento de Información:</strong> Implementar políticas estrictas de aislamiento lógico multi-inquilino (Row Level Security - RLS), asegurando que ningún usuario de otra clínica u organización pueda acceder a los datos clínicos de LA CLÍNICA.',
        '<strong>Soporte y Mesa de Ayuda:</strong> Brindar soporte técnico a través del Asistente Virtual IA 24/7, canal de WhatsApp de ingeniería y correo oficial bienvenido@odontocloudcolombia.com conforme a los niveles de servicio establecidos en el Manual DOC-10.',
        '<strong>Notificación de Incidentes:</strong> Notificar a LA CLÍNICA cualquier brecha de seguridad que afecte la confidencialidad de datos personales dentro de las veinticuatro (24) horas siguientes a su detección, conforme a la Ley 1581 de 2012.',
        '<strong>Facilitación de Portabilidad:</strong> Proveer mecanismos de exportación de historias clínicas en formatos estándar abiertos (PDF, CSV, JSON) en caso de retiro o migración.'
      ]
    },
    {
      type: 'h1',
      text: 'Cláusula Sexta — Obligaciones de LA CLÍNICA (EL CONTRATANTE)'
    },
    {
      type: 'p',
      text: 'Constituyen obligaciones específicas de LA CLÍNICA:'
    },
    {
      type: 'list',
      items: [
        '<strong>Veracidad de la Información:</strong> Suministrar información fidedigna respecto a la razón social, código REPS, profesionales habilitados y configuración de la clínica.',
        '<strong>Custodia de Credenciales:</strong> Asignar credenciales individuales intransferibles a cada profesional odontólogo o auxiliar asistencial. Queda terminantemente prohibido el uso compartido de usuarios o contraseñas genéricas.',
        '<strong>Infraestructura Cliente:</strong> Disponer de terminales de cómputo que cumplan los requerimientos mínimos de hardware, navegadores actualizados y conexión a internet de banda ancha estable.',
        '<strong>Responsabilidad Asistencial Indelegable:</strong> Asumir de manera directa, exclusiva e indelegable toda la responsabilidad médico-legal y odontológica respecto al diligenciamiento de historias clínicas, diagnósticos, consentimientos, pertinencia de tratamientos y habilitación del servicio ante el REPS (Resolución 3100 de 2019).',
        '<strong>Pago Oportuno:</strong> Cancelar puntualmente el canon periódico acordado en la Cláusula Tercera.',
        '<strong>Notificación Oportuna:</strong> Reportar inmediatamente a EL PROVEEDOR cualquier uso indebido, sospecha de compromiso de credenciales o anomalía técnica en la plataforma.'
      ]
    },
    {
      type: 'h1',
      text: 'Cláusula Séptima — Suspensión del Servicio por Mora y Protección Asistencial'
    },
    {
      type: 'callout',
      style: 'legal',
      title: '⚖️ Protección de la Continuidad Asistencial y Ética Médica',
      text: 'En caso de mora superior a treinta (30) días calendario en el pago del canon, EL PROVEEDOR enviará requerimiento escrito con quince (15) días de preaviso. Durante dicho lapso y antes de cualquier suspensión total del servicio, EL PROVEEDOR habilitará un modo restringido de "Solo Consulta" para que LA CLÍNICA pueda visualizar las historias clínicas de pacientes en curso o atender urgencias vitales, preservando el derecho a la salud y la ética médica.'
    },
    {
      type: 'h1',
      text: 'Cláusula Octava — Custodia, Exportación y Devolución de Historias Clínicas (Res. 839/2017)'
    },
    {
      type: 'p',
      text: '<strong>1. Custodia Legal a Cargo del Prestador:</strong> Conforme al artículo 3 de la Resolución 839 de 2017 de MinSalud, la custodia y conservación legal de la historia clínica por el término mínimo de <strong>quince (15) años</strong> (cinco años en archivo de gestión y diez en archivo central) corresponde de manera privativa al Prestador de Servicios de Salud (LA CLÍNICA).'
    },
    {
      type: 'p',
      text: '<strong>2. Periodo de Gracia para Descarga de Datos:</strong> A la terminación del contrato por cualquier causa, LA CLÍNICA dispondrá de un periodo de gracia improrrogable de <strong>sesenta (60) días calendario</strong> para descargar, extraer y respaldar en sus propios medios la totalidad de las historias clínicas, odontogramas, evoluciones, consentimientos y registros contables en formatos estándar descargables (PDF foliado por paciente, JSON y CSV).'
    },
    {
      type: 'p',
      text: '<strong>3. Prohibición Categórica de Borrado Automático:</strong> Vencido el periodo de gracia sin que LA CLÍNICA haya exportado la información, <strong>EL PROVEEDOR NO efectuará borrado automático ni destrucción desatendida</strong> de las historias clínicas. Los datos pasarán a un estado de custodia pasiva en archivo cifrado fuera de línea. La disposición final o destrucción de historias clínicas solo procederá previa suscripción de un <strong>Acta Legal de Entrega o Destrucción</strong> firmada por el Representante Legal de la IPS, dando estricto cumplimiento a las tablas de retención documental sanitarias.'
    },
    {
      type: 'h1',
      text: 'Cláusula Novena — Confidencialidad y Tratamiento de Datos Personales (DPA Anexo)'
    },
    {
      type: 'p',
      text: 'LAS PARTES declaran expresamente que en la ejecución de este contrato, LA CLÍNICA ostenta la calidad jurídica de <strong>Responsable del Tratamiento</strong> y EL PROVEEDOR actúa en calidad de <strong>Encargado del Tratamiento</strong> en los términos de la Ley 1581 de 2012 y su Decreto Reglamentario 1377 de 2013. Se incorpora y suscribe de manera vinculante como <strong>ANEXO NO. 1</strong> el <em>Acuerdo de Encargo de Tratamiento de Datos Personales (DOC-06)</em>, el cual rige todas las operaciones de almacenamiento y procesamiento de datos sensibles de salud.'
    },
    {
      type: 'h1',
      text: 'Cláusula Décima — Propiedad Intelectual'
    },
    {
      type: 'p',
      text: 'Todo el software, código fuente, modelos de datos, arquitectura de sistemas, diseño visual, logotipos, marcas comerciales y documentación técnica de OdontoCloud son y continuarán siendo de propiedad exclusiva de <strong>JUAN EDUARDO MADRID REQUENA</strong>. LA CLÍNICA no adquiere ningún derecho de propiedad intelectual sobre la plataforma, limitándose su derecho a la licencia de uso temporal estipulada en este contrato. Por su parte, todos los datos asistenciales, historias clínicas, diagnósticos y fichas de pacientes ingresados por LA CLÍNICA son de propiedad exclusiva de sus respectivos titulares y bajo la custodia sanitaria indelegable de LA CLÍNICA.'
    },
    {
      type: 'h1',
      text: 'Cláusula Undécima — Terminación del Contrato'
    },
    {
      type: 'p',
      text: 'El presente contrato terminará por: a) Mutuo acuerdo entre LAS PARTES expresado por escrito; b) Vencimiento del plazo contractual o de sus prórrogas mediando el preaviso correspondiente; c) Incumplimiento grave de las obligaciones pactadas por cualquiera de LAS PARTES, no subsanado dentro de los quince (15) días siguientes a la notificación; d) Liquidación obligatoria o disolución de LA CLÍNICA; e) Fuerza mayor o caso fortuito debidamente comprobado.'
    },
    {
      type: 'h1',
      text: 'Cláusula Duodécima — Solución de Controversias y Domicilio Contractual'
    },
    {
      type: 'p',
      text: 'Cualquier diferencia o controversia que surja entre LAS PARTES con motivo de la celebración, ejecución o terminación del presente contrato, se resolverá en primera instancia mediante arreglo directo en un plazo máximo de quince (15) días hábiles. De persistir el desacuerdo, LAS PARTES acudirán a un Centro de Conciliación legalmente autorizado en la ciudad de Sincelejo, Sucre. Para todos los efectos legales, se fija como domicilio contractual la ciudad de Sincelejo, Sucre, República de Colombia.'
    },
    {
      type: 'p',
      text: 'En constancia de lo acordado y en señal de aceptación, se firma el presente contrato en dos (2) ejemplares del mismo tenor y valor probatorio, en la ciudad de Sincelejo, a los <span class="var-field">[DÍA]</span> días del mes de <span class="var-field">[MES]</span> del año <span class="var-field">[AÑO]</span>.'
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
      NIT: 1102849760-5<br>
      Matrícula Mercantil No. 148131 — C.C. Sincelejo<br>
      OdontoCloud Colombia
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
                new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________\nJUAN EDUARDO MADRID REQUENA\nPersona Natural Comerciante\nC.C. No. 1102849760 de Sincelejo\nNIT: 1102849760-5\nMatrícula Mercantil 148131 (Sincelejo)\nOdontoCloud Colombia", size: 16 })] })
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

export const con02 = {
  code: 'CON-02',
  title: 'Constancia de Contratación y Suministro del Software',
  subtitle: 'Certificación Oficial del Proveedor sobre Licenciamiento, Versión, Modalidad SaaS y Estado Operativo del Software Asistencial',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'CON-02-Constancia-Contratacion-Suministro-Software',
  elements: [
    {
      type: 'h1',
      text: '1. Identificación del Emisor y Proveedor Tecnológico'
    },
    {
      type: 'p',
      text: 'El suscrito <strong>JUAN EDUARDO MADRID REQUENA</strong>, mayor de edad, domiciliado en la ciudad de Sincelejo, Sucre, identificado con Cédula de Ciudadanía No. 1102849760 de Sincelejo, titular del <strong>NIT 1102849760-5</strong> (sujeto a cotejo con RUT vigente expedido por la DIAN), en su condición de <strong>Persona Natural Comerciante</strong> debidamente registrado ante la Cámara de Comercio de Sincelejo bajo la Matrícula Mercantil No. <strong>148131</strong> (activa 2026, sujeta a cotejo con certificado mercantil vigente), en calidad de titular, creador y propietario de la solución tecnológica <strong>OdontoCloud Colombia</strong>,'
    },
    {
      type: 'h1',
      text: '2. CERTIFICA QUE:'
    },
    {
      type: 'p',
      text: 'La institución prestadora de servicios de salud identificada como <strong><span class="var-field">[RAZÓN SOCIAL DE LA CLÍNICA / IPS / CONSULTORIO]</span></strong>, identificada con el <strong>NIT No. <span class="var-field">[NIT_CLÍNICA]</span></strong>, con domicilio en la ciudad de <span class="var-field">[CIUDAD]</span>, sede <span class="var-field">[DIRECCIÓN_SEDE]</span>, e inscrita en el Registro Especial de Prestadores de Servicios de Salud (REPS) con el <strong>Código REPS No. <span class="var-field">[CÓDIGO_REPS_12_DÍGITOS]</span></strong>, ha suscrito formalmente contrato de prestación de servicios y licenciamiento de uso de software en la nube con este proveedor.'
    },
    {
      type: 'h1',
      text: '3. Parámetros Técnicos del Suministro'
    },
    {
      type: 'table',
      headers: [
        { text: 'Parámetro Técnico', width: '35%' },
        { text: 'Detalle Verificado y Habilitado', width: '65%' }
      ],
      rows: [
        [
          'Nombre del Software',
          '<strong>OdontoCloud Colombia</strong> (OdontoCloud SaaS)'
        ],
        [
          'Versión Oficial Suministrada',
          '<strong>Versión 2026.1 (Release 8.2)</strong>'
        ],
        [
          'Modalidad de Despliegue',
          'Software as a Service (SaaS en la nube) con base de datos relacional multi-tenant aislada'
        ],
        [
          'Plan Contratado',
          '<strong><span class="var-field">[PLAN: Básico / Profesional / IPS Multisede]</span></strong>'
        ],
        [
          'Capacidad Autorizada',
          'Hasta <strong><span class="var-field">[NÚMERO_USUARIOS]</span></strong> usuarios profesionales concurrentes'
        ],
        [
          'Fecha de Suscripción Contractual',
          '<span class="var-field">[DÍA/MES/AÑO DE FIRMA DE CONTRATO]</span>'
        ],
        [
          'Fecha de Activación y Puesta en Marcha',
          '<span class="var-field">[DÍA/MES/AÑO DE ACTIVACIÓN TÉCNICA]</span>'
        ],
        [
          'Vigencia Inicial',
          'Un (1) año calendario prorrogable automáticamente'
        ],
        [
          'Estado Operativo Actual',
          '<strong>ACTIVO Y EN OPERACIÓN NORMAL</strong>'
        ]
      ]
    },
    {
      type: 'h1',
      text: '4. Módulos Asistenciales y Operativos Habilitados'
    },
    {
      type: 'p',
      text: 'A la institución prestadora certificada se le han configurado y activado satisfactoriamente los siguientes módulos de software:'
    },
    {
      type: 'list',
      items: [
        '<strong>Gestión de Pacientes y Filiación SGSSS:</strong> Registro sociodemográfico y antecedentes clínicos.',
        '<strong>Historia Clínica Odontológica Electrónica:</strong> Anamnesis, examen estomatológico y diagnósticos CIE-10.',
        '<strong>Odontograma Digital Interactivo:</strong> Simbología FDI y Universal con registro gráfico inicial y evolutivo.',
        '<strong>Evoluciones Clínicas Inmutables:</strong> Foliación automática secuencial UTC y soporte de adendas normativas (Res. 1995/1999).',
        '<strong>Consentimientos Informados con Trazo Vectorial:</strong> Diligenciamiento y firma digital en pantalla.',
        '<strong>Presupuestos y Procedimientos CUPS:</strong> Catalogación tarifaria y planes de tratamiento odontológico.',
        '<strong>Facturación Electrónica en Salud:</strong> Conector habilitado para emisión FEV ante la DIAN con CUFE y QR.',
        '<strong>Generación de RIPS JSON:</strong> Estructura compatible con la Resolución 2275 de 2023 de MinSalud.'
      ]
    },
    {
      type: 'h1',
      text: '5. Declaración de Alcance y Delimitación Sanitaria Indelegable'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '⚠️ Delimitación de Responsabilidad ante Entidades Sanitarias y REPS',
      text: 'La presente constancia certifica exclusivamente el suministro técnico, licenciamiento de uso y disponibilidad de la plataforma de software OdontoCloud Colombia. <strong>NO constituye certificación de habilitación sanitaria de servicios de salud ante el Registro Especial de Prestadores de Servicios de Salud (REPS)</strong>, trámite que conforme a la Resolución 3100 de 2019 de MinSalud es de competencia y responsabilidad exclusiva, directa e indelegable de la institución prestadora de salud contratante.'
    },
    {
      type: 'p',
      text: 'Se expide la presente constancia a solicitud de la entidad prestadora interesada, en la ciudad de Sincelejo, Sucre, a los <span class="var-field">[DÍA]</span> días del mes de <span class="var-field">[MES]</span> del año <span class="var-field">[AÑO]</span>.'
    }
  ],
  customSignatureHtml: `
  <div style="margin-top: 40px; max-width: 400px;">
    ___________________________________________<br>
    <strong>JUAN EDUARDO MADRID REQUENA</strong><br>
    Persona Natural Comerciante — Titular y Propietario<br>
    Cédula de Ciudadanía No. 1102849760 de Sincelejo<br>
    NIT: 1102849760-5<br>
    Matrícula Mercantil No. 148131 (Cámara de Comercio de Sincelejo)<br>
    OdontoCloud Colombia<br>
    Correo: bienvenido@odontocloudcolombia.com | Web: https://odontocloudcolombia.com
  </div>
  `,
  customSignatureDocx: [
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({
          text: "\n\n___________________________________________\nJUAN EDUARDO MADRID REQUENA\nPersona Natural Comerciante — Titular y Propietario\nC.C. No. 1102849760 de Sincelejo\nNIT: 1102849760-5\nMatrícula Mercantil No. 148131 (C.C. Sincelejo)\nOdontoCloud Colombia\nCorreo: bienvenido@odontocloudcolombia.com",
          size: 17
        })
      ]
    })
  ]
};

export const con03 = {
  code: 'CON-03',
  title: 'Acta de Entrega, Configuración y Puesta en Marcha',
  subtitle: 'Protocolo Formal de Entrega del Entorno Cloud, Habilitación de Usuarios, Verificación de Módulos, Capacitación y Recibido a Satisfacción',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'CON-03-Acta-Entrega-Configuracion-Puesta-Marcha',
  elements: [
    {
      type: 'h1',
      text: '1. Datos de la Entrega y Puesta en Marcha'
    },
    {
      type: 'table',
      headers: [
        { text: 'Dato de Control', width: '35%' },
        { text: 'Información Registrada', width: '65%' }
      ],
      rows: [
        [
          'Fecha de Puesta en Marcha',
          '<span class="var-field">[DÍA/MES/AÑO DE ENTREGA]</span>'
        ],
        [
          'Hora de Entrega Operativa',
          '<span class="var-field">[HORA: e.g. 09:30 AM COT]</span>'
        ],
        [
          'Prestador Receptor (Clínica / IPS)',
          '<strong><span class="var-field">[RAZÓN SOCIAL DE LA CLÍNICA / IPS]</span></strong>'
        ],
        [
          'NIT de la Clínica',
          '<span class="var-field">[NIT_CLÍNICA]</span>'
        ],
        [
          'Código REPS Habilitación',
          '<span class="var-field">[CÓDIGO_REPS_12_DÍGITOS]</span>'
        ],
        [
          'Sede o Instalación',
          '<span class="var-field">[DIRECCIÓN_SEDE_CLÍNICA]</span>'
        ],
        [
          'Responsable Receptor por la Clínica',
          '<strong><span class="var-field">[NOMBRE_RESPONSABLE_RECEPTOR]</span></strong>'
        ],
        [
          'Cargo en la Clínica',
          '<span class="var-field">[CARGO: e.g. Director Médico / Administrador]</span>'
        ],
        [
          'Responsable Técnico por OdontoCloud',
          '<strong>JUAN EDUARDO MADRID REQUENA</strong> / Delegado de Soporte e Ingeniería'
        ],
        [
          'URL Oficial de Acceso Asignada',
          '<strong>https://odontocloudcolombia.com</strong>'
        ]
      ]
    },
    {
      type: 'h1',
      text: '2. Usuarios Administrativos y Profesionales Configurados'
    },
    {
      type: 'callout',
      style: 'legal',
      title: '🔒 Declaración Estricta de Seguridad de la Información (ISO 27001)',
      text: 'En estricto cumplimiento de los principios de confidencialidad y no divulgación de credenciales, <strong>EN ESTE DOCUMENTO NO SE CONSIGNAN CONTRASEÑAS NI CLAVES DE ACCESO</strong>. Las credenciales temporales y enlaces de activación individual fueron transmitidos de manera cifrada e individual directamente a los correos electrónicos corporativos verificados de cada funcionario autorizado.'
    },
    {
      type: 'table',
      headers: [
        { text: 'Rol Asignado', width: '25%' },
        { text: 'Nombre del Funcionario', width: '30%' },
        { text: 'Cédula', width: '15%' },
        { text: 'Correo Verificado de Acceso', width: '30%' }
      ],
      rows: [
        [
          'Administrador General de Clínica',
          '<span class="var-field">[NOMBRE ADMINISTRADOR]</span>',
          '<span class="var-field">[CÉDULA]</span>',
          '<span class="var-field">[CORREO_ADMIN@CLINICA.COM]</span>'
        ],
        [
          'Odontólogo Principal / Director',
          '<span class="var-field">[NOMBRE ODONTÓLOGO 1]</span>',
          '<span class="var-field">[CÉDULA]</span>',
          '<span class="var-field">[CORREO_DR1@CLINICA.COM]</span>'
        ],
        [
          'Odontólogo Especialista',
          '<span class="var-field">[NOMBRE ODONTÓLOGO 2]</span>',
          '<span class="var-field">[CÉDULA]</span>',
          '<span class="var-field">[CORREO_DR2@CLINICA.COM]</span>'
        ],
        [
          'Recepción y Admisiones',
          '<span class="var-field">[NOMBRE RECEPCIONISTA]</span>',
          '<span class="var-field">[CÉDULA]</span>',
          '<span class="var-field">[CORREO_RECEPCION@CLINICA.COM]</span>'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Verificación de Componentes Técnicos y Pruebas Realizadas'
    },
    {
      type: 'p',
      text: 'En la sesión de puesta en marcha se ejecutaron las siguientes pruebas técnicas conjuntas entre el proveedor y el equipo de la clínica, arrojando resultado <strong>CONFORME</strong> en su totalidad:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Componente / Módulo Evaluado', width: '40%' },
        { text: 'Prueba Técnica Realizada', width: '45%' },
        { text: 'Resultado', width: '15%' }
      ],
      rows: [
        [
          '1. Acceso Seguro a la Plataforma',
          'Conexión segura vía protocolo HTTPS con certificado SSL/TLS 1.3 activo.',
          'CONFORME'
        ],
        [
          '2. Parametrización Institucional',
          'Carga de logotipo corporativo de la clínica, razón social, NIT y pie de página en reportes.',
          'CONFORME'
        ],
        [
          '3. Creación y Búsqueda de Paciente',
          'Registro de paciente ficticio de prueba, validación de campos obligatorios y guardado.',
          'CONFORME'
        ],
        [
          '4. Odontograma Interactivo FDI',
          'Marcado de superficies dentales, aplicación de colores estandarizados y renderizado.',
          'CONFORME'
        ],
        [
          '5. Evolución Clínica e Inmutabilidad',
          'Prueba de guardado de evolución, verificación de timestamp UTC e imposibilidad de sobreescritura.',
          'CONFORME'
        ],
        [
          '6. Consentimiento Informado',
          'Generación de plantilla, trazado de firma digital en pantalla táctil y almacenamiento PDF.',
          'CONFORME'
        ],
        [
          '7. Facturación en Salud (FEV)',
          'Verificación de conector con Factus y parametrización de rangos de numeración DIAN.',
          'CONFORME'
        ],
        [
          '8. Validación de RIPS JSON',
          'Prueba de consistencia de estructura de datos según la Resolución 2275 de 2023.',
          'CONFORME'
        ]
      ]
    },
    {
      type: 'h1',
      text: '4. Capacitación y Transferencia de Conocimiento'
    },
    {
      type: 'p',
      text: 'Se certifica que el personal asistencial y administrativo de LA CLÍNICA participó en la sesión formal de inducción y capacitación operativa impartida por OdontoCloud Colombia:'
    },
    {
      type: 'list',
      items: [
        '<strong>Fecha y Duración:</strong> <span class="var-field">[DÍA/MES/AÑO]</span> — Sesión de <span class="var-field">[NÚMERO_HORAS]</span> horas cronológicas.',
        '<strong>Modalidad:</strong> <span class="var-field">[VIRTUAL ASISTIDA VÍA CONFERENCIA EN VIVO / PRESENCIAL]</span>.',
        '<strong>Asistentes:</strong> <span class="var-field">[NÚMERO_ASISTENTES]</span> funcionarios del equipo clínico y administrativo.',
        '<strong>Temario Impartido:</strong> Navegación general, gestión de citas, diligenciamiento de anamnesis estomatológica, manejo del odontograma inicial y evolutivo, registro de notas de evolución con adendas, captura de firmas en consentimientos, facturación electrónica y canales de soporte técnico.'
      ]
    },
    {
      type: 'h1',
      text: '5. Entrega de Documentación Técnica y Manuales Oficiales'
    },
    {
      type: 'p',
      text: 'En este acto, LA CLÍNICA recibe formalmente en formato digital (PDF y DOCX editable) los siguientes documentos rectores del expediente del software:'
    },
    {
      type: 'list',
      items: [
        '<strong>DOC-01:</strong> Ficha Técnica Institucional de OdontoCloud (Versión 2026.1).',
        '<strong>DOC-02:</strong> Manual Completo de Usuario y Administrador (Con capturas y flujos paso a paso).',
        '<strong>DOC-05:</strong> Política y Procedimientos de Seguridad de la Información.',
        '<strong>DOC-08:</strong> Plan de Copias de Seguridad, Restauración y Continuidad Operativa.',
        '<strong>DOC-10:</strong> Manual de Soporte, Mantenimiento y Gestión de Incidentes.',
        '<strong>DOC-12:</strong> Matriz Técnica de Habilitación para Prestadores de Salud (Resolución 3100/2019).'
      ]
    },
    {
      type: 'h1',
      text: '6. Observaciones y Acuerdos Particulares'
    },
    {
      type: 'p',
      text: '<span class="var-field">[DILIGENCIAR: Ninguna observación especial / Registrar aquí compromisos de migración previa de base de datos o parametrizaciones específicas acordadas con la clínica]</span>.'
    },
    {
      type: 'h1',
      text: '7. Constancia de Recibido a Entera Satisfacción y Firmas'
    },
    {
      type: 'p',
      text: 'Habiéndose completado la configuración, verificado el acceso a todos los módulos contratados y recibido la capacitación y manuales técnicos, el representante de LA CLÍNICA suscribe la presente acta declarando el <strong>RECIBIDO A ENTERA SATISFACCIÓN</strong> del entorno cloud activado.'
    }
  ],
  customSignatureHtml: `
  <div class="signature-grid">
    <div class="sig-box">
      <strong>ENTREGÓ (ODONTOCLOUD COLOMBIA):</strong><br><br><br>
      ___________________________________________<br>
      <strong>JUAN EDUARDO MADRID REQUENA</strong><br>
      Titular y Proveedor Tecnológico<br>
      C.C. No. 1102849760 de Sincelejo<br>
      NIT: 1102849760-5<br>
      Matrícula Mercantil 148131 — C.C. Sincelejo<br>
      OdontoCloud Colombia
    </div>
    <div class="sig-box">
      <strong>RECIBIÓ A SATISFACCIÓN (LA CLÍNICA):</strong><br><br><br>
      ___________________________________________<br>
      <strong><span class="var-field">[NOMBRE_RESPONSABLE_RECEPTOR]</span></strong><br>
      <span class="var-field">[CARGO: Director Médico / Gerente / Administrador]</span><br>
      C.C. No. <span class="var-field">[CÉDULA_RESPONSABLE]</span><br>
      <span class="var-field">[RAZÓN SOCIAL DE LA IPS / CONSULTORIO]</span><br>
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
              children: [new Paragraph({ children: [new TextRun({ text: "ENTREGÓ (ODONTOCLOUD COLOMBIA)", bold: true, color: "FFFFFF", size: 16 })] })]
            }),
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "334155" },
              children: [new Paragraph({ children: [new TextRun({ text: "RECIBIÓ A SATISFACCIÓN (LA CLÍNICA)", bold: true, color: "FFFFFF", size: 16 })] })]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________\nJUAN EDUARDO MADRID REQUENA\nTitular y Proveedor Tecnológico\nC.C. No. 1102849760 de Sincelejo\nNIT: 1102849760-5\nMatrícula Mercantil 148131 (Sincelejo)\nOdontoCloud Colombia", size: 16 })] })
              ]
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________\n[NOMBRE_RESPONSABLE_RECEPTOR]\n[CARGO: Director Médico / Administrador]\nC.C. No. [CÉDULA_RESPONSABLE]\n[RAZÓN SOCIAL DE LA CLÍNICA]\nCódigo REPS: [CÓDIGO_REPS]", size: 16 })] })
              ]
            })
          ]
        })
      ]
    })
  ]
};

// =========================================================================================
// COMPILADOR DE LOS DOCUMENTOS
// =========================================================================================

async function generateLegalPackage() {
  console.log('Iniciando generación del Paquete Legal de Contratación OdontoCloud 2026...\n');
  
  const browser = await chromium.launch({ headless: true });
  const docs = [con01, con02, con03];

  for (const docDef of docs) {
    console.log(`Compilando ${docDef.code} — ${docDef.title}...`);
    
    // 1. Generar HTML y compilar a PDF con Playwright
    const html = renderLegalHtml(docDef);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    
    const pdfPath = path.join(PDF_OUT_DIR, `${docDef.filenameBase}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });
    await page.close();
    
    const pdfStats = fs.statSync(pdfPath);
    console.log(`  ✓ PDF generado: ${pdfPath} (${(pdfStats.size / 1024).toFixed(1)} KB)`);

    // 2. Generar DOCX nativo editable
    const docxBuffer = await renderLegalDocx(docDef);
    const docxPath = path.join(DOCX_OUT_DIR, `${docDef.filenameBase}.docx`);
    fs.writeFileSync(docxPath, docxBuffer);
    
    const docxStats = fs.statSync(docxPath);
    console.log(`  ✓ DOCX generado: ${docxPath} (${(docxStats.size / 1024).toFixed(1)} KB)\n`);
  }

  await browser.close();

  // 3. Crear el Índice y Guía de Personalización
  const guideMarkdown = `# PAQUETE LEGAL DE CONTRATACIÓN Y ENTREGA ODONTOCLOUD 2026
**Modelos Contractuales, Certificación y Acta de Entrega para Prestadores de Salud (IPS y Consultorios)**  
**Titular y Proveedor Tecnológico:** JUAN EDUARDO MADRID REQUENA (Persona Natural Comerciante)  
**Cédula:** 1102849760 | **NIT:** 1102849760-5 (Sujeto a cotejo con RUT vigente)  
**Matrícula Mercantil:** 148131 (Cámara de Comercio de Sincelejo, Activa 2026 — Sujeta a cotejo)  
**Domicilio:** Sincelejo, Sucre, Colombia | **Sitio Web:** https://odontocloudcolombia.com  
**Versión de Plataforma:** 2026.1 (Release 8.2) | **Estado:** BORRADOR OFICIAL PARA PERSONALIZACIÓN  

---

## 1. RELACIÓN DE DOCUMENTOS LEGALES GENERADOS

| Código | Documento | Formatos | Finalidad y Uso Práctico |
| :--- | :--- | :---: | :--- |
| **CON-01** | Contrato de Prestación del Servicio OdontoCloud SaaS | PDF y DOCX | Contrato marco de prestación de servicios en la nube, licenciamiento no exclusivo, plan y canon, duración, obligaciones, soporte, suspensión por mora garantizando consulta médica, custodia legal de historias clínicas (15 años Res. 839/2017) con periodo de gracia de 60 días y prohibición de borrado automático, y firmas bilaterales. |
| **CON-02** | Constancia de Contratación y Suministro del Software | PDF y DOCX | Certificación formal emitida por el titular de OdontoCloud a favor de la clínica o IPS para evidenciar la contratación del software, versión 2026.1 (Release 8.2), modalidad SaaS, módulos activos y fecha de activación, delimitando expresamente que no sustituye la habilitación sanitaria REPS (Res. 3100/2019). |
| **CON-03** | Acta de Entrega, Configuración y Puesta en Marcha | PDF y DOCX | Protocolo de entrega del entorno digital con verificación conjunta de los 8 componentes clave, registro de funcionarios con usuarios configurados (sin contraseñas por seguridad ISO 27001), constancia de capacitación impartida, entrega de manuales técnicos y recibido a satisfacción. |

---

## 2. ARTICULACIÓN CON LOS ANEXOS TÉCNICOS EXISTENTES

Conforme a la estructura integral del servicio, los siguientes documentos del expediente técnico actúan como anexos vinculantes de los documentos de contratación:

1. **ANEXO NO. 1 DEL CONTRATO (CON-01):**
   - **DOC-06:** *Política de Tratamiento de Datos Personales y Acuerdo de Encargo de Tratamiento (DPA)*.  
     *(Define la relación Responsable vs Encargado de Datos conforme a la Ley 1581 de 2012).*
2. **ANEXO NO. 2 (TÉRMINOS Y CONDICIONES GENERALES):**
   - **DOC-11:** *Condiciones de Servicio SaaS y Régimen de Custodia de Datos Sanitarios*.
3. **DOCUMENTOS ENTREGADOS CON EL ACTA (CON-03):**
   - **DOC-01:** *Ficha Técnica Institucional*.
   - **DOC-02:** *Manual Completo de Usuario y Administrador*.
   - **DOC-10:** *Manual de Soporte, Mantenimiento y Gestión de Incidentes*.
   - **DOC-12:** *Matriz Técnica de Habilitación para Prestadores de Salud*.

---

## 3. LISTA DE CAMPOS VARIABLES A COMPLETAR PARA CADA NUEVA CLÍNICA

Cada vez que se vincule una nueva clínica odontológica, consultorio o IPS, el usuario debe abrir los archivos editables **DOCX** y reemplazar los campos resaltados en corchetes \`[...]\` con la información particular del cliente:

### A. Para el Contrato de Servicio (CON-01):
1. \`[RAZÓN SOCIAL DE LA CLÍNICA / IPS]\`: Nombre comercial o razón social legal completa registrada en Cámara de Comercio.
2. \`[NIT_DE_LA_CLÍNICA]\`: Número de Identificación Tributaria con su dígito de verificación.
3. \`[CIUDAD]\` y \`[DEPARTAMENTO]\`: Domicilio legal de la clínica.
4. \`[DIRECCIÓN_SEDE_PRINCIPAL]\`: Dirección física de la sede habilitada.
5. \`[CÓDIGO_REPS_12_DÍGITOS]\`: Código único de prestador de 12 dígitos asignado por la Secretaría de Salud.
6. \`[NOMBRE_DEL_REPRESENTANTE_LEGAL]\`: Nombre completo de quien suscribe el contrato.
7. \`[CÉDULA_REPRESENTANTE]\`: Cédula de ciudadanía o extranjería del representante legal.
8. \`[CORREO_NOTIFICACIONES_CLÍNICA]\` y \`[TELÉFONO_CLÍNICA]\`: Canales formales de comunicación.
9. \`[PLAN: BÁSICO / PROFESIONAL / IPS]\`: Plan comercial pactado.
10. \`[NÚMERO_DE_USUARIOS]\`: Cantidad de usuarios profesionales concurrentes habilitados.
11. \`[VALOR_EN_NÚMEROS]\` y \`[VALOR_EN_LETRAS]\`: Canon mensual o anual acordado en pesos colombianos (COP).
12. \`[MENSUAL / ANUAL ANTICIPADA]\`: Periodicidad de facturación.
13. \`[NÚMERO_DE_CUENTA]\` y \`[BANCO]\`: Cuenta bancaria autorizada del proveedor para recibir pagos.
14. \`[DÍA]\`, \`[MES]\`, \`[AÑO]\`: Fecha de suscripción del contrato.

### B. Para la Constancia de Suministro (CON-02):
1. \`[RAZÓN SOCIAL DE LA CLÍNICA / IPS / CONSULTORIO]\`: Nombre del prestador.
2. \`[NIT_CLÍNICA]\` y \`[CÓDIGO_REPS_12_DÍGITOS]\`: Identificación tributaria y sanitaria.
3. \`[CIUDAD]\` y \`[DIRECCIÓN_SEDE]\`: Ubicación de la instalación.
4. \`[PLAN CONTRATADO]\` y \`[NÚMERO_USUARIOS]\`: Plan y usuarios habilitados.
5. \`[DÍA/MES/AÑO DE FIRMA DE CONTRATO]\`: Fecha en que se suscribió el CON-01.
6. \`[DÍA/MES/AÑO DE ACTIVACIÓN TÉCNICA]\`: Fecha en que comenzó la operación del software.
7. \`[DÍA]\`, \`[MES]\`, \`[AÑO]\`: Fecha de expedición de la constancia.

### C. Para el Acta de Entrega y Puesta en Marcha (CON-03):
1. \`[DÍA/MES/AÑO DE ENTREGA]\` y \`[HORA: e.g. 09:30 AM COT]\`: Momento exacto de la entrega.
2. \`[RAZÓN SOCIAL DE LA CLÍNICA / IPS]\`, \`[NIT_CLÍNICA]\`, \`[CÓDIGO_REPS]\`, \`[DIRECCIÓN_SEDE_CLÍNICA]\`.
3. \`[NOMBRE_RESPONSABLE_RECEPTOR]\` y \`[CARGO: e.g. Director Médico / Administrador]\`: Funcionario receptor de la clínica.
4. **Tabla de Usuarios Configurados:**
   - Nombre completo, cédula y correo corporativo individual de cada usuario creado (sin incluir contraseñas).
5. \`[DÍA/MES/AÑO]\`, \`[NÚMERO_HORAS]\`, \`[VIRTUAL / PRESENCIAL]\`, \`[NÚMERO_ASISTENTES]\`: Datos de la sesión de capacitación impartida.
6. \`[OBSERVACIONES PARTICULARES]\`: Indicar si no hubo novedades o registrar acuerdos de migración previa.
7. \`[NOMBRE_RESPONSABLE_RECEPTOR]\`, \`[CÉDULA_RESPONSABLE]\`: Firma de recibido a entera satisfacción.
`;

  fs.writeFileSync(path.join(BASE_OUT_DIR, 'INDICE-Y-GUIA-DE-PERSONALIZACION.md'), guideMarkdown);
  console.log(`✓ Índice y Guía de personalización generado: ${path.join(BASE_OUT_DIR, 'INDICE-Y-GUIA-DE-PERSONALIZACION.md')}\n`);
}

generateLegalPackage().catch(err => {
  console.error('Error durante la generación del paquete legal:', err);
  process.exit(1);
});
