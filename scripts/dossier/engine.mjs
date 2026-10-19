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
  BorderStyle,
  ShadingType
} from 'docx';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

export const BASE_DIR = path.resolve('documentacion/odontocloud/expediente-institucional-2026');
export const DOCX_DIR = path.join(BASE_DIR, 'docx');
export const PDF_DIR = path.join(BASE_DIR, 'pdf');
export const EVIDENCIAS_DIR = path.join(BASE_DIR, 'evidencias');
export const LOGO_PATH = path.resolve('public/assets/logo.png');

export const logoBuffer = fs.readFileSync(LOGO_PATH);
export const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

export const imgConfigBuffer = fs.readFileSync(path.join(EVIDENCIAS_DIR, 'evidencia_config_ihce.png'));
export const imgEvolucionBuffer = fs.readFileSync(path.join(EVIDENCIAS_DIR, 'evidencia_evolucion_clinica.png'));
export const imgOutboxBuffer = fs.readFileSync(path.join(EVIDENCIAS_DIR, 'evidencia_outbox_radicada.png'));

export const INSTITUTIONAL_META = {
  softwareName: 'OdontoCloud Colombia',
  version: '2026.1 (Release 8.2)',
  editionDate: 'Octubre de 2026',
  dossierStatus: 'DOCUMENTACIÓN INSTITUCIONAL EN REVISIÓN (Borrador Oficial previo a firmas legales y validación COPNIA)',
  
  // Identidad Legal del Proveedor Tecnológico (Persona Natural Comerciante)
  legalEntity: 'JUAN EDUARDO MADRID REQUENA',
  personType: 'Persona Natural con Registro Mercantil',
  idType: 'Cédula de Ciudadanía',
  idNumber: '1102849760',
  nit: '1102849760-5 (Sujeto a verificación con RUT)',
  camaraComercio: 'Cámara de Comercio de Sincelejo',
  matriculaMercantil: '148131 (Activa 2026 - Sujeta a cotejo con certificado mercantil)',
  ciiu: '6312 — Portales Web y Servicios de Procesamiento de Datos',
  city: 'Sincelejo, Sucre, Colombia',
  
  // Canales Oficiales y Representación
  repLegal: 'JUAN EDUARDO MADRID REQUENA (Titular / Propietario)',
  contactEmail: 'bienvenido@odontocloudcolombia.com',
  website: 'https://odontocloudcolombia.com',
  
  // Peritaje Técnico Independiente (DOC-13)
  techLead: '[PENDIENTE DE DESIGNACIÓN: Ingeniero de Sistemas con Matrícula Profesional COPNIA]'
};

// Generador de HTML para Playwright PDF
export function renderHtml(docDef) {
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
    } else if (item.type === 'image') {
      const imgB64 = `data:image/png;base64,${item.buffer.toString('base64')}`;
      contentHtml += `<div class="screenshot-figure">\n`;
      if (item.tag) contentHtml += `  <div><span class="tag-synthetic">${item.tag}</span></div>\n`;
      contentHtml += `  <img src="${imgB64}" class="screenshot-img" alt="${item.caption || 'Captura'}" />\n`;
      if (item.caption) contentHtml += `  <div class="screenshot-caption">${item.caption}</div>\n`;
      contentHtml += `</div>\n`;
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
      font-size: 9.8pt;
      background: #ffffff;
      margin: 0; padding: 0;
    }
    .page-break { page-break-before: always; }
    .header-bar {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2px solid #0f172a; padding-bottom: 7px; margin-bottom: 20px;
    }
    .header-logo { height: 35px; width: auto; }
    .header-meta { text-align: right; font-size: 7.5pt; color: #475569; font-weight: 600; }
    .header-meta span { color: #0d9488; font-weight: 700; }
    .cover {
      height: 90vh; display: flex; flex-direction: column; justify-content: space-between; padding: 25px 20px;
    }
    .cover-top { text-align: center; padding-top: 30px; }
    .cover-logo { height: 90px; margin-bottom: 20px; }
    .cover-code {
      display: inline-block; background: #0f172a; color: #38bdf8;
      font-size: 8.5pt; font-weight: 800; padding: 4px 14px; border-radius: 999px;
      letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;
    }
    .cover-title {
      font-size: 22pt; font-weight: 900; color: #0f172a; line-height: 1.2; margin: 0 0 10px 0;
    }
    .cover-subtitle {
      font-size: 11.5pt; color: #0d9488; font-weight: 600; max-width: 650px; margin: 0 auto;
    }
    .cover-badge-bar {
      margin-top: 25px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;
    }
    .cover-badge {
      border: 1px solid #cbd5e1; padding: 5px 12px; border-radius: 8px; font-size: 8pt;
      font-weight: 600; color: #334155; background: #f8fafc;
    }
    .cover-status-banner {
      background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b;
      padding: 8px 12px; border-radius: 6px; margin-top: 20px; font-size: 8pt;
      color: #92400e; font-weight: 600; text-align: center;
    }
    .cover-footer {
      border-top: 1px solid #e2e8f0; padding-top: 16px; display: grid;
      grid-template-columns: 1fr 1fr; gap: 15px; font-size: 8pt; color: #475569;
    }
    .cover-footer strong { color: #0f172a; }
    h1 {
      color: #0f172a; font-size: 13.5pt; font-weight: 800; border-left: 4px solid #0d9488;
      padding-left: 10px; margin-top: 20px; margin-bottom: 8px;
    }
    h2 {
      color: #1e293b; font-size: 11.5pt; font-weight: 700; margin-top: 14px; margin-bottom: 5px;
    }
    h3 {
      color: #334155; font-size: 10.2pt; font-weight: 700; margin-top: 10px; margin-bottom: 4px;
    }
    p { margin: 0 0 8px 0; text-align: justify; }
    ul, ol { margin: 0 0 10px 0; padding-left: 20px; }
    li { margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 16px 0; font-size: 8.5pt; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 7.8pt; }
    tr:nth-child(even) td { background-color: #f8fafc; }
    .callout {
      border-left: 4px solid #0284c7; background: #f0f9ff; padding: 10px 12px;
      border-radius: 0 8px 8px 0; margin: 12px 0; font-size: 8.8pt;
    }
    .callout-title { font-weight: 800; color: #0369a1; margin-bottom: 3px; }
    .callout-warning { border-left-color: #f59e0b; background: #fffbeb; }
    .callout-warning .callout-title { color: #b45309; }
    .callout-legal { border-left-color: #0d9488; background: #f0fdfa; }
    .callout-legal .callout-title { color: #0f766e; }
    .screenshot-figure {
      margin: 12px 0 16px 0; text-align: center; border: 1px solid #e2e8f0;
      border-radius: 8px; padding: 8px; background: #f8fafc;
    }
    .screenshot-img {
      max-width: 100%; height: auto; border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08); max-height: 260px; object-fit: contain;
    }
    .screenshot-caption { font-size: 7.5pt; color: #64748b; margin-top: 5px; font-weight: 600; }
    .tag-synthetic {
      background: #fee2e2; color: #991b1b; font-weight: 700; padding: 2px 6px;
      border-radius: 4px; font-size: 7pt; display: inline-block; margin-bottom: 4px;
    }
    .approval-table { margin-top: 25px; width: 100%; border-collapse: collapse; }
    .approval-table th { background: #334155; color: #ffffff; text-align: center; font-size: 7.5pt; }
    .approval-table td { height: 60px; vertical-align: top; font-size: 7.5pt; color: #475569; }
    .approval-table td strong { color: #0f172a; display: block; margin-bottom: 3px; }
    .pending-tag {
      color: #b91c1c; font-weight: 700; background: #fee2e2; padding: 2px 6px;
      border-radius: 4px; font-size: 7pt; display: inline-block; margin-top: 3px;
    }
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
        <div class="cover-badge">Resolución 1995/1999 & 839/2017</div>
        <div class="cover-badge">Marco Res. 3100/2019 (Vigente)</div>
        <div class="cover-badge">Edición Institucional 2026</div>
      </div>
      <div class="cover-status-banner">
        ⚠️ ESTADO: ${INSTITUTIONAL_META.dossierStatus}
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
        <strong>Código Documental:</strong> ${docDef.code}<br>
        <strong>Versión:</strong> ${docDef.version}<br>
        <strong>Fecha de Emisión:</strong> ${docDef.date}<br>
        <strong>Actividad Económica:</strong> CIIU ${INSTITUTIONAL_META.ciiu}<br>
        <strong>Canal Oficial:</strong> ${INSTITUTIONAL_META.website}<br>
        <strong>Contacto:</strong> ${INSTITUTIONAL_META.contactEmail}
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ENCABEZADO DE PÁGINA INTERNA -->
  <div class="header-bar">
    <img src="${logoBase64}" class="header-logo" alt="OdontoCloud Logo" />
    <div class="header-meta">
      ${docDef.code} — Versión ${docDef.version}<br>
      <span>OdontoCloud Colombia</span> — Confidencial Prestador de Salud
    </div>
  </div>

  <!-- CONTENIDO COMPLETO -->
  ${contentHtml}

  <!-- BLOQUE DE REVISIÓN Y APROBACIÓN -->
  <div class="callout callout-legal" style="margin-top: 30px;">
    <div class="callout-title">⚖️ Declaración de Alcance, Propiedad y Reserva Institucional</div>
    <p style="margin: 0; font-size: 8pt;">
      El presente documento ha sido elaborado por el equipo de ingeniería y cumplimiento de OdontoCloud Colombia como proveedor tecnológico del software. No constituye una habilitación de servicios de salud ante el REPS, ni reemplaza los dictámenes emitidos por profesionales independientes con matrícula COPNIA. La responsabilidad asistencial y de habilitación corresponde de forma indelegable al Prestador de Servicios de Salud (IPS o Profesional Independiente).
    </p>
  </div>

  <table class="approval-table">
    <thead>
      <tr>
        <th style="width: 33%;">ELABORÓ (TÉCNICO / INGENIERÍA)</th>
        <th style="width: 34%;">REVISÓ (AUDITORÍA / COMPLIANCE)</th>
        <th style="width: 33%;">APROBÓ (DIRECCIÓN / LEGAL)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>Equipo de Ingeniería y Arquitectura SaaS</strong>
          OdontoCloud Colombia<br>
          Fecha: ${docDef.date}<br>
          Estado: Aprobado Técnico
        </td>
        <td>
          <strong>Responsable Técnico de Seguridad y Sistemas</strong>
          ${INSTITUTIONAL_META.techLead}<br>
          <span class="pending-tag">PENDIENTE DE VALIDACIÓN MATRÍCULA COPNIA</span>
        </td>
        <td>
          <strong>Dirección / Titular y Propietario</strong>
          ${INSTITUTIONAL_META.repLegal}<br>
          C.C. ${INSTITUTIONAL_META.idNumber} | NIT ${INSTITUTIONAL_META.nit}<br>
          <span class="pending-tag">PENDIENTE DE FIRMA PROTOCOLARIA</span>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="doc-footer">
    <span>${docDef.code} — ${docDef.title}</span>
    <span>OdontoCloud © 2026. Todos los derechos reservados.</span>
  </div>
</body>
</html>`;
}

// Generador de DOCX nativo 100% completo a partir del mismo modelo de elementos
export async function renderDocx(docDef) {
  const docxElements = [];

  // Título y Portada
  docxElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: logoBuffer,
          transformation: { width: 100, height: 100 },
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
        new TextRun({ text: docDef.title, bold: true, size: 34, color: "0D9488" })
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
        new TextRun({ text: `ESTADO: ${INSTITUTIONAL_META.dossierStatus}`, bold: true, size: 18, color: "B45309" })
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
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Versión Oficial", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: docDef.version })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Fecha de Emisión", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: docDef.date })] })
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
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Actividad Económica", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: `CIIU ${INSTITUTIONAL_META.ciiu}` })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Domicilio Legal", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: INSTITUTIONAL_META.city })] })
          ]
        })
      ]
    }),
    new Paragraph({ text: "" })
  );

  // Renderizar cada elemento exactamente igual al PDF
  for (const item of docDef.elements) {
    if (item.type === 'h1') {
      docxElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({ text: item.text.replace(/<[^>]+>/g, ''), bold: true, size: 26, color: "0F172A" })
          ]
        })
      );
    } else if (item.type === 'h2') {
      docxElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: item.text.replace(/<[^>]+>/g, ''), bold: true, size: 22, color: "0D9488" })
          ]
        })
      );
    } else if (item.type === 'h3') {
      docxElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({ text: item.text.replace(/<[^>]+>/g, ''), bold: true, size: 20, color: "334155" })
          ]
        })
      );
    } else if (item.type === 'p') {
      docxElements.push(
        new Paragraph({
          children: [
            new TextRun({ text: item.text.replace(/<[^>]+>/g, ''), size: 20, color: "1E293B" })
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
                        new TextRun({ text: calloutText, italic: true, size: 19, color: item.style === 'warning' ? "B45309" : "0F766E" })
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
      // Header row
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
      // Data rows
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
    } else if (item.type === 'image') {
      if (item.tag) {
        docxElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: item.tag.replace(/<[^>]+>/g, ''), bold: true, size: 16, color: "991B1B" })
            ]
          })
        );
      }
      docxElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: item.buffer,
              transformation: { width: 500, height: 260 },
              type: "png"
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: (item.caption || '').replace(/<[^>]+>/g, ''), italic: true, size: 16, color: "64748B" })
          ]
        }),
        new Paragraph({ text: "" })
      );
    }
  }

  // Cuadro de Firmas Final
  docxElements.push(
    new Paragraph({ text: "" }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "334155" },
              children: [new Paragraph({ children: [new TextRun({ text: "ELABORÓ (TÉCNICO / INGENIERÍA)", bold: true, color: "FFFFFF", size: 16 })] })]
            }),
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "334155" },
              children: [new Paragraph({ children: [new TextRun({ text: "REVISÓ (AUDITORÍA / COMPLIANCE)", bold: true, color: "FFFFFF", size: 16 })] })]
            }),
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "334155" },
              children: [new Paragraph({ children: [new TextRun({ text: "APROBÓ (DIRECCIÓN / LEGAL)", bold: true, color: "FFFFFF", size: 16 })] })]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "Equipo de Arquitectura e Ingeniería SaaS\nOdontoCloud Colombia\nFecha: Octubre de 2026\nEstado: Aprobado Técnico", size: 16 })] })
              ]
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: `${INSTITUTIONAL_META.techLead}\nPENDIENTE DE VALIDACIÓN MATRÍCULA COPNIA`, size: 16 })] })
              ]
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: `${INSTITUTIONAL_META.repLegal}\nC.C. ${INSTITUTIONAL_META.idNumber} | NIT ${INSTITUTIONAL_META.nit}\nPENDIENTE DE FIRMA PROTOCOLARIA`, size: 16 })] })
              ]
            })
          ]
        })
      ]
    })
  );

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
                new TextRun({ text: "Documento Institucional OdontoCloud © 2026 — En Revisión Previa a Firmas", size: 16, color: "64748B" })
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
