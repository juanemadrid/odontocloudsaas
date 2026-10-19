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
import JSZip from 'jszip';

const BASE_DIR = path.resolve('documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026');
const PDF_DIR = path.join(BASE_DIR, 'pdf');
const DOCX_DIR = path.join(BASE_DIR, 'docx');

fs.mkdirSync(PDF_DIR, { recursive: true });
fs.mkdirSync(DOCX_DIR, { recursive: true });

const LOGO_PATH = path.resolve('public/assets/logo.png');
const logoBuffer = fs.readFileSync(LOGO_PATH);

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

// Generador genérico de DOCX con el diseño corporativo perfeccionado en CON-01
export async function buildDocxDocument({
  code,
  title,
  subtitle,
  statusBadgeText,
  statusColor = "1D4ED8",
  clientBanner = null,
  bodyElements = [],
  signatureTable = null
}) {
  const docxElements = [];

  // 1. Tabla de Encabezado Institucional (Logo izquierda, Marca centro, Metadatos derecha)
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
        children: [
          new TableCell({
            width: { size: 13, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new ImageRun({
                    data: logoBuffer,
                    transformation: { width: 55, height: 55 },
                    type: "png"
                  })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "ODONTOCLOUD COLOMBIA", bold: true, size: 23, color: "0F2942" })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Software de Gestión Odontológica en la Nube", italic: true, size: 17, color: "0D9488", bold: true })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `Código: ${code} | Versión: 2026.1\n`, bold: true, size: 15, color: "475569" }),
                  new TextRun({ text: "Edición: Octubre 2026\n", size: 14, color: "475569" }),
                  new TextRun({ text: statusBadgeText, bold: true, size: 14, color: statusColor })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  docxElements.push(headerTable);
  docxElements.push(new Paragraph({ text: "" }));

  // 2. Bloque de Título Principal
  docxElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: title, bold: true, size: 27, color: "0F2942" })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: subtitle, italic: true, size: 19, color: "475569" })
      ]
    })
  );

  // Banner opcional de Cliente / Proveedor
  if (clientBanner) {
    docxElements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 40 },
                    children: clientBanner
                  })
                ]
              })
            ]
          })
        ]
      }),
      new Paragraph({ text: "" })
    );
  }

  // 3. Elementos del Cuerpo
  docxElements.push(...bodyElements);

  // 4. Bloque de Firmas si aplica
  if (signatureTable) {
    docxElements.push(new Paragraph({ text: "" }), signatureTable);
  }

  const doc = new Document({
    creator: "OdontoCloud Colombia",
    title: `${code} — ${title}`,
    description: subtitle,
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1418, // 2.5 cm
            right: 1418,
            bottom: 1418,
            left: 1418
          }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: `OdontoCloud Colombia | ${code} — Versión 2026.1`, bold: true, size: 15, color: "0D9488" }),
                new TextRun({ text: "  •  Documentación Institucional Oficial", size: 14, color: "64748B" })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE }
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 70, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: `${code} | OdontoCloud Colombia — ${statusBadgeText}`, size: 14, color: "64748B" })
                          ]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 30, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({ text: "Página ", size: 14, color: "64748B" }),
                            new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "64748B", bold: true }),
                            new TextRun({ text: " de ", size: 14, color: "64748B" }),
                            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "64748B", bold: true })
                          ]
                        })
                      ]
                    })
                  ]
                })
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

// Helpers tipográficos
export const pText = (text, isJustified = true) => new Paragraph({
  alignment: isJustified ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
  spacing: { after: 90, line: 276 },
  children: [new TextRun({ text, size: 21, color: "1E293B" })]
});

export const hSection = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  keepWithNext: true,
  spacing: { before: 160, after: 70 },
  children: [new TextRun({ text, bold: true, size: 23, color: "0F2942" })]
});

export const calloutBox = (title, text, isWarning = false) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: isWarning ? "FFFBEB" : "F0FDFA" },
          children: [
            new Paragraph({
              spacing: { after: 50 },
              children: [new TextRun({ text: title, bold: true, size: 18, color: isWarning ? "B45309" : "0F766E" })]
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [new TextRun({ text, italic: true, size: 18, color: isWarning ? "78350F" : "134E4A" })]
            })
          ]
        })
      ]
    })
  ]
});
