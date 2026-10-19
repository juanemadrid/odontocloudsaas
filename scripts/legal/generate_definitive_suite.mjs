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
  ShadingType, 
  BorderStyle, 
  PageNumber 
} from 'docx';
import { chromium } from 'playwright';

// Directorios de salida definitivos
const BASE_DIR = path.resolve('documentacion/odontocloud/ENTREGA-DEFINITIVA-EXPEDIENTE-2026');
const DOCX_DIR = path.join(BASE_DIR, 'docx');
const PDF_DIR = path.join(BASE_DIR, 'pdf');

fs.mkdirSync(DOCX_DIR, { recursive: true });
fs.mkdirSync(PDF_DIR, { recursive: true });

// Recursos visuales
const LOGO_PATH = path.resolve('public/assets/logo.png');
const logoBuffer = fs.readFileSync(LOGO_PATH);
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

// Metadatos Oficiales del Proveedor Tecnológico
export const PROVIDER_META = {
  softwareName: 'OdontoCloud Colombia',
  tagline: 'Software de Gestión Odontológica en la Nube',
  version: '2026.1 (Release 8.2)',
  editionDate: 'Octubre de 2026',
  legalEntity: 'JUAN EDUARDO MADRID REQUENA',
  personType: 'Persona Natural Comerciante',
  idNumber: '1102849760',
  idCity: 'Sincelejo',
  nit: '1102849760-5 (Sujeto a cotejo con RUT vigente expedido por la DIAN)',
  camaraComercio: 'Cámara de Comercio de Sincelejo',
  matriculaMercantil: '148131 (Activa 2026 — Sujeta a cotejo con certificado mercantil vigente)',
  ciiu: '6312 — Portales Web y Servicios de Procesamiento de Datos',
  city: 'Sincelejo, Sucre, Colombia',
  contactEmail: 'bienvenido@odontocloudcolombia.com',
  website: 'https://odontocloudcolombia.com'
};

// =========================================================================================
// UTILIDADES COMUNES DOCX
// =========================================================================================
function pText(text, options = {}) {
  const { bold = false, italic = false, color = "1E293B", size = 19, spaceAfter = 60, line = 260, align = AlignmentType.JUSTIFIED } = options;
  return new Paragraph({
    alignment: align,
    spacing: { after: spaceAfter, line: line },
    children: [
      new TextRun({
        text,
        bold,
        italic,
        color,
        size,
        font: "Segoe UI"
      })
    ]
  });
}

function hSection(title, color = "0F2942") {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 100, after: 40 },
    keepWithNext: true,
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: 21,
        color: color,
        font: "Segoe UI"
      })
    ]
  });
}

function calloutBox(title, text, isWarning = false) {
  const borderColor = isWarning ? "D97706" : "0D9488";
  const bgColor = isWarning ? "FFFBEB" : "F0FDFA";
  const titleColor = isWarning ? "92400E" : "0F766E";
  const textColor = isWarning ? "78350F" : "134E4A";

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: bgColor },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: title, bold: true, size: 19, color: titleColor, font: "Segoe UI" })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 0, line: 250 },
                children: [
                  new TextRun({ text: text, size: 17, color: textColor, font: "Segoe UI" })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

async function buildDocxFile({
  code,
  title,
  subtitle,
  badgeText,
  badgeColor = "0D9488",
  bannerText = null,
  bodyElements = [],
  signatureTable = null
}) {
  const docxElements = [];

  // Encabezado institucional compacto
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: "0F2942" },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: logoBuffer,
                    transformation: { width: 48, height: 48 },
                    type: "png"
                  })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 54, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "ODONTOCLOUD COLOMBIA", bold: true, size: 21, color: "0F2942", font: "Segoe UI" })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Software de Gestión Odontológica en la Nube", italic: true, size: 15, color: "0D9488", bold: true, font: "Segoe UI" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `Código: ${code} | Versión: 2026.1\n`, bold: true, size: 14, color: "475569", font: "Segoe UI" }),
                  new TextRun({ text: "Edición: Octubre 2026\n", size: 13, color: "475569", font: "Segoe UI" }),
                  new TextRun({ text: badgeText, bold: true, size: 13, color: badgeColor, font: "Segoe UI" })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  docxElements.push(headerTable);
  docxElements.push(new Paragraph({ spacing: { after: 40 }, children: [] }));

  // Bloque de Título Principal
  docxElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 30 },
      keepWithNext: true,
      children: [
        new TextRun({ text: title, bold: true, size: 23, color: "0F2942", font: "Segoe UI" })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 70 },
      keepWithNext: true,
      children: [
        new TextRun({ text: subtitle, italic: true, size: 16, color: "475569", font: "Segoe UI" })
      ]
    })
  );

  if (bannerText) {
    docxElements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  left: { style: BorderStyle.SINGLE, size: 16, color: "0F2942" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" }
                },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [
                      new TextRun({ text: bannerText, size: 15, color: "334155", bold: true, font: "Segoe UI" })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }),
      new Paragraph({ spacing: { after: 40 }, children: [] })
    );
  }

  // Cuerpo
  docxElements.push(...bodyElements);

  // Bloque de Firmas si aplica
  if (signatureTable) {
    docxElements.push(new Paragraph({ spacing: { after: 30 }, children: [] }), signatureTable);
  }

  const doc = new Document({
    creator: "OdontoCloud Colombia",
    title: `${code} — ${title}`,
    description: subtitle,
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134, // 2.0 cm
            right: 1247, // 2.2 cm
            bottom: 1134, // 2.0 cm
            left: 1247
          }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 20 },
              children: [
                new TextRun({ text: `${code} | OdontoCloud Colombia — Edición 2026.1`, size: 13, color: "94A3B8", font: "Segoe UI" })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: `${code} — Página `, size: 14, color: "64748B", font: "Segoe UI" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "64748B", bold: true, font: "Segoe UI" }),
                new TextRun({ text: " de ", size: 14, color: "64748B", font: "Segoe UI" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "64748B", bold: true, font: "Segoe UI" })
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
// PLANTILLA HTML PARA PLAYWRIGHT PDF
// =========================================================================================
function getHtmlTemplate({
  code,
  title,
  subtitle,
  badgeText,
  badgeColor = '#0d9488',
  badgeBg = '#f0fdfa',
  bannerHtml = '',
  contentHtml,
  signatureHtml = ''
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${code} — ${title} — OdontoCloud Colombia</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 20mm 18mm 20mm;
      @bottom-left {
        content: "${code} | ${title.length > 55 ? title.substring(0, 52) + '...' : title} — OdontoCloud Colombia";
        font-family: 'Segoe UI', Calibri, Arial, sans-serif;
        font-size: 7.5pt;
        color: #64748b;
      }
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        font-family: 'Segoe UI', Calibri, Arial, sans-serif;
        font-size: 7.5pt;
        color: #64748b;
        font-weight: 600;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Calibri, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.36;
      font-size: 9.3pt;
      background: #ffffff;
      margin: 0; padding: 0;
    }
    
    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0f2942;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    .header-brand {
      font-size: 11.5pt;
      font-weight: 900;
      color: #0f2942;
      letter-spacing: 0.6px;
      margin: 0;
      line-height: 1.15;
    }
    .header-tagline {
      font-size: 8pt;
      color: #0d9488;
      font-weight: 700;
      margin: 2px 0 0 0;
    }
    .header-meta {
      text-align: right;
      font-size: 7.2pt;
      color: #475569;
      line-height: 1.3;
    }
    .badge-status {
      display: inline-block;
      background: ${badgeBg};
      color: ${badgeColor};
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      margin-top: 2px;
      font-size: 6.8pt;
      border: 1px solid rgba(0,0,0,0.06);
    }

    .doc-title {
      text-align: center;
      font-size: 13pt;
      font-weight: 800;
      color: #0f2942;
      margin: 6px 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 8.8pt;
      font-weight: 600;
      color: #475569;
      margin-bottom: 10px;
      font-style: italic;
    }
    .banner-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0f2942;
      padding: 5px 10px;
      border-radius: 3px;
      font-size: 8.2pt;
      margin-bottom: 10px;
      color: #334155;
      text-align: center;
      font-weight: 600;
    }

    h2 {
      font-size: 10pt;
      font-weight: 800;
      color: #0f2942;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 2px;
      margin-top: 10px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 5px 0;
      text-align: justify;
    }
    ul {
      margin: 0 0 5px 0;
      padding-left: 18px;
    }
    li {
      margin-bottom: 3px;
      text-align: justify;
    }
    code {
      font-family: 'Consolas', monospace;
      font-size: 8.5pt;
      background: #f1f5f9;
      padding: 1px 3px;
      border-radius: 3px;
    }
    .callout {
      border-left: 4px solid #d97706;
      background: #fffbeb;
      padding: 6px 10px;
      margin: 8px 0;
      border-radius: 0 4px 4px 0;
      page-break-inside: avoid;
    }
    .callout.info {
      border-left-color: #0d9488;
      background: #f0fdfa;
    }
    .callout-title {
      font-weight: 700;
      color: #92400e;
      margin-bottom: 2px;
      font-size: 8.8pt;
    }
    .callout.info .callout-title {
      color: #0f766e;
    }
    .callout-text {
      font-size: 8.2pt;
      color: #78350f;
      line-height: 1.35;
      margin: 0;
      text-align: justify;
    }
    .callout.info .callout-text {
      color: #134e4a;
    }

    .signatures-block {
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .sig-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .sig-table td {
      width: 48%;
      vertical-align: top;
      padding: 6px 8px;
    }
    .sig-box-primary {
      border-top: 2px solid #0f2942;
      padding-top: 6px;
    }
    .sig-box-warning {
      border-top: 2px solid #b45309;
      padding-top: 6px;
    }
    .sig-title {
      font-size: 8pt;
      font-weight: 800;
      color: #0f2942;
      margin-bottom: 18px;
    }
    .sig-title-warning {
      font-size: 8pt;
      font-weight: 800;
      color: #b45309;
      margin-bottom: 18px;
    }
    .sig-name {
      font-size: 8.8pt;
      font-weight: 800;
      color: #0f2942;
      margin-top: 2px;
    }
    .sig-meta {
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.3;
      margin-top: 2px;
    }
  </style>
</head>
<body>

  <!-- ENCABEZADO INSTITUCIONAL -->
  <div class="header-container">
    <div class="header-left">
      <img src="${logoBase64}" class="header-logo" alt="Logo OdontoCloud" />
      <div>
        <div class="header-brand">${PROVIDER_META.softwareName.toUpperCase()}</div>
        <div class="header-tagline">${PROVIDER_META.tagline}</div>
      </div>
    </div>
    <div class="header-meta">
      <div><strong>Código:</strong> ${code} | <strong>Versión:</strong> 2026.1</div>
      <div><strong>Edición:</strong> ${PROVIDER_META.editionDate}</div>
      <div class="badge-status">${badgeText}</div>
    </div>
  </div>

  <!-- TITULO Y SUBTITULO -->
  <div class="doc-title">${title}</div>
  <div class="doc-subtitle">${subtitle}</div>

  ${bannerHtml ? `<div class="banner-box">${bannerHtml}</div>` : ''}

  <!-- CONTENIDO -->
  ${contentHtml}

  <!-- FIRMAS -->
  ${signatureHtml}

</body>
</html>`;
}

// Exportamos configuraciones
export {
  BASE_DIR,
  DOCX_DIR,
  PDF_DIR,
  pText,
  hSection,
  calloutBox,
  buildDocxFile,
  getHtmlTemplate
};
