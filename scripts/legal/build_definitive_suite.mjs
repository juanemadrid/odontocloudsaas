import fs from 'fs';
import path from 'path';
import { 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  AlignmentType, 
  WidthType, 
  ShadingType, 
  BorderStyle,
  PageBreak 
} from 'docx';
import { chromium } from 'playwright';
import { 
  DOCX_DIR, 
  PDF_DIR, 
  PROVIDER_META, 
  pText, 
  hSection, 
  calloutBox, 
  buildDocxFile, 
  getHtmlTemplate 
} from './generate_definitive_suite.mjs';

// =========================================================================================
// 1. CERT-01: INFORME TÉCNICO DE ARQUITECTURA Y CUMPLIMIENTO SANITARIO (2 PÁGINAS)
// =========================================================================================
async function buildCert01() {
  console.log("Generando CERT-01 (Informe Técnico Pendiente COPNIA — 2 Páginas exactas)...");

  // Cuerpo DOCX
  const body = [
    // --- PÁGINA 1 ---
    hSection("1. Identificación del Titular y Desarrollador del Software"),
    pText(`El suscrito ${PROVIDER_META.legalEntity}, mayor de edad, domiciliado en la ciudad de Sincelejo, departamento de Sucre, identificado con Cédula de Ciudadanía No. ${PROVIDER_META.idNumber} de Sincelejo, titular del NIT ${PROVIDER_META.nit}, en su condición de ${PROVIDER_META.personType} con Matrícula Mercantil No. ${PROVIDER_META.matriculaMercantil} de la ${PROVIDER_META.camaraComercio}, con actividad económica principal CIIU ${PROVIDER_META.ciiu}, actuando en nombre propio y en calidad de propietario y desarrollador de la plataforma OdontoCloud Colombia (sitio oficial ${PROVIDER_META.website} y correo ${PROVIDER_META.contactEmail}), expide el presente informe técnico para fines de auditoría, verificación institucional y evaluación pericial independiente.`),

    hSection("2. Alcance del Informe y Principios Rectores"),
    pText("El presente documento hace constar el estado de desarrollo, arquitectura tecnológica, controles lógicos y funcionalidad de la plataforma tecnológica denominada OdontoCloud Colombia (Edición Oficial 2026.1, Release 8.2), desarrollada para la gestión asistencial, administrativa y operativa de consultorios odontológicos e Instituciones Prestadoras de Servicios de Salud (IPS)."),
    pText("El software ha sido concebido bajo los principios rectores de autenticidad, integridad, confidencialidad y disponibilidad exigidos por la legislación colombiana en materia de tecnologías de la información y salud digital (Ley 594 de 2000, Ley 1438 de 2011 y Resolución 839 de 2017)."),

    hSection("3. Características Técnicas Comprobadas y Auditables"),
    pText("La plataforma cuenta con los siguientes componentes tecnológicos implementados y verificables:"),
    pText("• 3.1 Autenticidad y Marcas Temporales Inmutables: El sistema asigna a cada nota de evolución, diagnóstico odontológico y registro clínico una marca temporal inmutable generada a nivel de base de datos en tiempo universal coordinado (clock_timestamp() UTC), vinculada de forma indeleble al identificador único y perfil profesional del odontólogo tratante autenticado."),
    pText("• 3.2 Integridad Asistencial (Res. 1995/1999 y Res. 839/2017): Los registros clínicos consolidados y cerrados no pueden ser editados, alterados ni eliminados por ningún usuario del sistema. Cualquier modificación, aclaración o adición posterior se efectúa mediante el mecanismo de notas de adenda fechadas y firmadas secuencialmente, preservando intacto el registro asistencial original."),
    pText("• 3.3 Aislamiento Lógico Multi-Inquilino (Multi-Tenant RLS): La plataforma opera sobre motor relacional PostgreSQL con políticas de seguridad a nivel de fila (Row Level Security - RLS). La segregación se valida de forma criptográfica en cada consulta mediante el identificador institucional (organization_id), impidiendo cualquier visibilidad o cruce de datos entre clínicas."),

    // SALTO DE PÁGINA OBLIGATORIO A PÁGINA 2
    new Paragraph({ children: [new PageBreak()] }),

    // --- PÁGINA 2 ---
    pText("• 3.4 Consentimiento Informado y Firma Electrónica Táctil: Incorpora módulos para la captura de firma electrónica con trazo vectorial del paciente o acudiente en pantalla táctil conforme a los requisitos del Decreto 2364 de 2012, generando documentos en formato PDF inmutable vinculados al folio de la historia clínica."),
    pText("• 3.5 Facturación FEV y RIPS en Salud: Cuenta con conector verificado para la emisión de Factura Electrónica de Venta en salud (FEV) con código CUFE y código QR ante la DIAN mediante Factus, y suite de exportación de RIPS en estructura JSON compatible con los lineamientos de la Resolución 2275 de 2023 del Ministerio de Salud y Protección Social."),

    hSection("4. Declaración de Alcance y Delimitación Sanitaria REPS"),
    calloutBox("⚖️ Declaración Obligatoria de Alcance y Delimitación Sanitaria REPS", 
      "El presente documento es un INFORME TÉCNICO emitido por el titular del software y NO CONSTITUYE certificación profesional colegiada ni habilitación sanitaria. La habilitación de servicios de salud ante el Registro Especial de Prestadores de Servicios de Salud (REPS) conforme a la Resolución 3100 de 2019 de MinSalud corresponde de manera privativa e indelegable a la IPS prestadora. El dictamen pericial independiente se encuentra pendiente de inspección y firma por Ingeniero de Sistemas con matrícula profesional activa ante el COPNIA.", true),

    pText("Se expide el presente informe en la ciudad de Sincelejo, departamento de Sucre, en el mes de Octubre de 2026, para someterse a evaluación pericial independiente.")
  ];

  // Tabla de Firmas DOCX (Página 2)
  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "0F2942" } },
            margins: { top: 80, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "POR EL TITULAR Y DESARROLLADOR:", bold: true, size: 14, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: "\n___________________________________________", size: 14, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: PROVIDER_META.legalEntity, bold: true, size: 15, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: `${PROVIDER_META.personType}\nC.C. ${PROVIDER_META.idNumber} de Sincelejo | NIT: 1102849760-5\nOdontoCloud Colombia — ${PROVIDER_META.contactEmail}`, size: 13, color: "475569" })] })
            ]
          }),
          new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "" })] }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "B45309" } },
            margins: { top: 80, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "DICTAMEN PERICIAL INDEPENDIENTE (COPNIA):", bold: true, size: 14, color: "B45309" })] }),
              new Paragraph({ children: [new TextRun({ text: "\n___________________________________________", size: 14, color: "B45309" })] }),
              new Paragraph({ children: [new TextRun({ text: "[PENDIENTE DE EVALUACIÓN Y FIRMA]", bold: true, size: 15, color: "B45309" })] }),
              new Paragraph({ children: [new TextRun({ text: "Ingeniero de Sistemas Colegiado ante el COPNIA\nMatrícula Profesional No. [PENDIENTE EVALUACIÓN]\nCertificado de Vigencia COPNIA: [ADJUNTAR]\nEstado: Pendiente de Inspección Técnica", size: 13, color: "78350F" })] })
            ]
          })
        ]
      })
    ]
  });

  const docxBuf = await buildDocxFile({
    code: "CERT-01",
    title: "INFORME TÉCNICO DE ARQUITECTURA Y CUMPLIMIENTO SANITARIO",
    subtitle: "Documento Técnico Institucional Sometido a Evaluación y Certificación Profesional Independiente (Resolución 3100 de 2019 y Ley 594 de 2000)",
    badgeText: "INFORME TÉCNICO — PENDIENTE DE EVALUACIÓN Y FIRMA COPNIA",
    badgeColor: "B45309",
    bannerText: "SOFTWARE EVALUADO: OdontoCloud Colombia v2026.1 (Release 8.2) | Modalidad SaaS Cloud | Sometido a Inspección Pericial",
    bodyElements: body,
    signatureTable: sigTable
  });

  const docxPath = path.join(DOCX_DIR, 'CERT-01-Certificacion-Tecnica-Software-OdontoCloud.docx');
  fs.writeFileSync(docxPath, docxBuf);
  console.log("✓ DOCX generado:", docxPath);

  // HTML Playwright con división exacta de 2 páginas
  const contentHtml = `
    <!-- PÁGINA 1 -->
    <h2>1. Identificación del Titular y Desarrollador del Software</h2>
    <p>El suscrito <strong>${PROVIDER_META.legalEntity}</strong>, mayor de edad, domiciliado en la ciudad de Sincelejo, departamento de Sucre, identificado con Cédula de Ciudadanía No. ${PROVIDER_META.idNumber} de Sincelejo, titular del NIT ${PROVIDER_META.nit}, en su condición de <strong>${PROVIDER_META.personType}</strong> con Matrícula Mercantil No. ${PROVIDER_META.matriculaMercantil} de la ${PROVIDER_META.camaraComercio}, con actividad económica principal CIIU ${PROVIDER_META.ciiu}, actuando en nombre propio y en calidad de propietario y desarrollador de la plataforma OdontoCloud Colombia (sitio oficial <a href="${PROVIDER_META.website}">${PROVIDER_META.website}</a> y correo ${PROVIDER_META.contactEmail}), expide el presente informe técnico para fines de auditoría, verificación institucional y evaluación pericial independiente.</p>

    <h2>2. Alcance del Informe y Principios Rectores</h2>
    <p>El presente documento hace constar el estado de desarrollo, arquitectura tecnológica, controles lógicos y funcionalidad de la plataforma tecnológica denominada <strong>OdontoCloud Colombia (Edición Oficial 2026.1, Release 8.2)</strong>, desarrollada para la gestión asistencial, administrativa y operativa de consultorios odontológicos e Instituciones Prestadoras de Servicios de Salud (IPS).</p>
    <p>El software ha sido concebido bajo los principios rectores de autenticidad, integridad, confidencialidad y disponibilidad exigidos por la legislación colombiana en materia de tecnologías de la información y salud digital (Ley 594 de 2000, Ley 1438 de 2011 y Resolución 839 de 2017).</p>

    <h2>3. Características Técnicas Comprobadas y Auditables</h2>
    <p>La plataforma cuenta con los siguientes componentes tecnológicos implementados y verificables:</p>
    <ul>
      <li><strong>3.1 Autenticidad y Marcas Temporales Inmutables:</strong> El sistema asigna a cada nota de evolución, diagnóstico odontológico y registro clínico una marca temporal inmutable generada a nivel de base de datos en tiempo universal coordinado (<code>clock_timestamp() UTC</code>), vinculada de forma indeleble al identificador único y perfil profesional del odontólogo tratante autenticado.</li>
      <li><strong>3.2 Integridad Asistencial (Res. 1995/1999 y Res. 839/2017):</strong> Los registros clínicos consolidados y cerrados no pueden ser editados, alterados ni eliminados por ningún usuario del sistema. Cualquier modificación, aclaración o adición posterior se efectúa mediante el mecanismo de notas de adenda fechadas y firmadas secuencialmente, preservando intacto el registro asistencial original.</li>
      <li><strong>3.3 Aislamiento Lógico Multi-Inquilino (Multi-Tenant RLS):</strong> La plataforma opera sobre motor relacional PostgreSQL con políticas de seguridad a nivel de fila (<em>Row Level Security - RLS</em>). La segregación se valida de forma criptográfica en cada consulta mediante el identificador institucional (<code>organization_id</code>), impidiendo cualquier visibilidad o cruce de datos entre clínicas.</li>
    </ul>

    <!-- SALTO A PÁGINA 2 -->
    <div style="page-break-before: always;"></div>

    <!-- PÁGINA 2 -->
    <ul>
      <li><strong>3.4 Consentimiento Informado y Firma Electrónica Táctil:</strong> Incorpora módulos para la captura de firma electrónica con trazo vectorial del paciente o acudiente en pantalla táctil conforme a los requisitos del Decreto 2364 de 2012, generando documentos en formato PDF inmutable vinculados al folio de la historia clínica.</li>
      <li><strong>3.5 Facturación FEV y RIPS en Salud:</strong> Cuenta con conector verificado para la emisión de Factura Electrónica de Venta en salud (FEV) con código CUFE y código QR ante la DIAN mediante Factus, y suite de exportación de RIPS en estructura JSON compatible con los lineamientos de la Resolución 2275 de 2023 del Ministerio de Salud y Protección Social.</li>
    </ul>

    <h2>4. Declaración de Alcance y Delimitación Sanitaria REPS</h2>
    <div class="callout">
      <div class="callout-title">⚖️ Declaración Obligatoria de Alcance y Delimitación Sanitaria REPS</div>
      <div class="callout-text">El presente documento es un INFORME TÉCNICO emitido por el titular del software y NO CONSTITUYE certificación profesional colegiada ni habilitación sanitaria. La habilitación de servicios de salud ante el Registro Especial de Prestadores de Servicios de Salud (REPS) conforme a la Resolución 3100 de 2019 de MinSalud corresponde de manera privativa e indelegable a la IPS prestadora. El dictamen pericial independiente se encuentra pendiente de inspección y firma por Ingeniero de Sistemas con matrícula profesional activa ante el COPNIA.</div>
    </div>

    <p>Se expide el presente informe en la ciudad de Sincelejo, departamento de Sucre, en el mes de Octubre de 2026, para someterse a evaluación pericial independiente.</p>
  `;

  const sigsHtml = `
    <div class="signatures-block">
      <table class="sig-table">
        <tr>
          <td>
            <div class="sig-box-primary">
              <div class="sig-title">POR EL TITULAR Y DESARROLLADOR:</div>
              <div class="sig-name">${PROVIDER_META.legalEntity}</div>
              <div class="sig-meta">
                ${PROVIDER_META.personType}<br>
                C.C. No. ${PROVIDER_META.idNumber} de Sincelejo | NIT: 1102849760-5<br>
                OdontoCloud Colombia — ${PROVIDER_META.contactEmail}
              </div>
            </div>
          </td>
          <td style="width: 4%;"></td>
          <td>
            <div class="sig-box-warning">
              <div class="sig-title-warning">DICTAMEN PERICIAL INDEPENDIENTE (COPNIA):</div>
              <div class="sig-name" style="color: #b45309;">[PENDIENTE DE EVALUACIÓN Y FIRMA]</div>
              <div class="sig-meta" style="color: #78350f;">
                Ingeniero de Sistemas Colegiado ante el COPNIA<br>
                Matrícula Profesional No. [PENDIENTE EVALUACIÓN]<br>
                Certificado de Vigencia COPNIA: [ADJUNTAR SOPORTE]<br>
                <em>Estado: Pendiente de Inspección Técnica</em>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return getHtmlTemplate({
    code: 'CERT-01',
    title: 'INFORME TÉCNICO DE ARQUITECTURA Y CUMPLIMIENTO SANITARIO',
    subtitle: 'Documento Técnico Institucional Sometido a Evaluación y Certificación Profesional Independiente (Resolución 3100 de 2019 y Ley 594 de 2000)',
    badgeText: 'INFORME TÉCNICO — PENDIENTE DE EVALUACIÓN Y FIRMA COPNIA',
    badgeColor: '#b45309',
    badgeBg: '#fffbeb',
    bannerHtml: '<strong>SOFTWARE EVALUADO:</strong> OdontoCloud Colombia v2026.1 (Release 8.2) | <strong>Modalidad:</strong> SaaS Cloud | <strong>Finalidad:</strong> Sometido a Inspección Pericial',
    contentHtml,
    signatureHtml: sigsHtml
  });
}

// =========================================================================================
// 2. PROT-01: PROTOCOLO DE SEGURIDAD DE LA INFORMACIÓN, INFRAESTRUCTURA Y RESPALDO (2 PÁGINAS)
// =========================================================================================
async function buildProt01() {
  console.log("Generando PROT-01 (Protocolo de Seguridad y Respaldo Cloud — 2 Páginas exactas)...");

  // Cuerpo DOCX
  const body = [
    // --- PÁGINA 1 ---
    hSection("1. Objetivo y Alcance del Protocolo"),
    pText("Establecer las medidas técnicas, controles organizativos y procedimientos de seguridad lógica y respaldo aplicados en la plataforma OdontoCloud Colombia para salvaguardar la confidencialidad, integridad, autenticidad y disponibilidad de la información clínica y administrativa de las IPS y consultorios odontológicos."),

    hSection("2. Arquitectura de Infraestructura Cloud y Redes Seguras"),
    pText("OdontoCloud opera bajo el modelo Software as a Service (SaaS) desplegado sobre servidores virtuales privados (VPS) dedicados con sistema operativo empresarial Oracle Linux, gestionados mediante contenedores Docker aislados. Los componentes del sistema (frontend web interactivo, backend de microservicios y base de datos relacional) se interconectan en redes internas segmentadas sin exposición innecesaria de puertos directos a internet público."),
    pText("Toda comunicación de los usuarios se canaliza a través de un proxy inverso seguro que aplica cifrado obligatorio en tránsito mediante protocolo HTTPS con certificados TLS 1.3 de última generación y suites criptográficas robustas."),

    hSection("3. Aislamiento Lógico Multi-Inquilino (Multi-Tenant RLS)"),
    pText("La segregación de historias clínicas entre diferentes instituciones se implementa a nivel de motor de base de datos relacional PostgreSQL activando políticas de seguridad a nivel de fila (Row Level Security - RLS). Toda consulta o transacción valida el identificador institucional único (organization_id) derivado del token JWT criptográfico del usuario autenticado, impidiendo cualquier acceso o visibilidad de datos entre clínicas."),

    hSection("4. Política Verificable de Respaldos Lógicos y Restauración"),
    pText("• Respaldo Lógico Automatizado: Se ejecutan copias periódicas de la base de datos relacional mediante la herramienta estándar pg_dump en formato binario comprimido (.Fc) sobre el servidor host asignado."),
    pText("• Integridad y Recuperación: Las copias capturan el estado transaccional consistente de las historias clínicas, odontogramas y facturación. El procedimiento documentado de restauración se realiza mediante utilidades estándar (pg_restore)."),
    pText("• Delimitación Técnica Honesta: El sistema cuenta con copias de seguridad lógicas en el servidor host; no cuenta con replicación geográfica multi-nube redundante en tiempo real. Por lo anterior, la IPS mantiene el deber y la facultad indelegable de realizar sus propias descargas periódicas locales mediante los módulos de exportación."),

    // SALTO DE PÁGINA OBLIGATORIO A PÁGINA 2
    new Paragraph({ children: [new PageBreak()] }),

    // --- PÁGINA 2 ---
    hSection("5. Controles de Acceso, Autenticación y Credenciales"),
    pText("El acceso se rige por un esquema de control de roles (RBAC): Administrador (gestión institucional), Odontólogo/Especialista (asistencia clínica, odontograma y adendas) y Recepción/Admisiones (citas y datos demográficos, sin acceso a la nota clínica reservada). Es responsabilidad estricta de la clínica custodiar las credenciales; se prohíbe el uso de cuentas compartidas."),

    hSection("6. Contingencia Asistencial, Trazabilidad y Bitácoras"),
    pText("El sistema registra bitácoras de auditoría de eventos críticos. Se aclara que actualmente no existe un módulo automatizado de Break-Glass en la interfaz; contingencias asistenciales extraordinarias se tramitan mediante soporte administrativo con registro manual en bitácora."),

    hSection("7. Gestión de Incidentes de Seguridad y Notificación en 24 Horas"),
    pText("Ante cualquier brecha confirmada de seguridad sobre datos personales o de salud, OdontoCloud notificará formalmente al Representante Legal de la IPS afectada dentro de las veinticuatro (24) horas siguientes a su confirmación técnica (Ley 1581 de 2012).")
  ];

  // Firma DOCX compacta en Página 2
  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "0F2942" } },
            margins: { top: 80, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "RESPONSABLE DE ARQUITECTURA TECNOLÓGICA Y SEGURIDAD:", bold: true, size: 14, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: "___________________________________________", size: 14, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: PROVIDER_META.legalEntity, bold: true, size: 15, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: `Titular y Desarrollador — ${PROVIDER_META.personType} | C.C. No. ${PROVIDER_META.idNumber} de Sincelejo | NIT: 1102849760-5\nOdontoCloud Colombia — Sede Sincelejo, Sucre | Canal Técnico: ${PROVIDER_META.contactEmail}`, size: 13, color: "475569" })] })
            ]
          })
        ]
      })
    ]
  });

  const docxBuf = await buildDocxFile({
    code: "PROT-01",
    title: "PROTOCOLO DE SEGURIDAD DE LA INFORMACIÓN Y RESPALDO CLOUD",
    subtitle: "Directrices Técnicas de Seguridad Lógica, Cifrado, Respaldos Transaccionales y Continuidad Operativa OdontoCloud SaaS",
    badgeText: "DOCUMENTO TÉCNICO OFICIAL DE SEGURIDAD",
    badgeColor: "0D9488",
    bannerText: "INFRAESTRUCTURA AUDITADA: VPS Oracle Linux | Docker Containers | PostgreSQL RLS | Cifrado HTTPS/TLS 1.3",
    bodyElements: body,
    signatureTable: sigTable
  });

  const docxPath = path.join(DOCX_DIR, 'PROT-01-Protocolo-Seguridad-Informacion-Respaldo-Cloud.docx');
  fs.writeFileSync(docxPath, docxBuf);
  console.log("✓ DOCX generado:", docxPath);

  // HTML Playwright con división exacta de 2 páginas
  const contentHtml = `
    <!-- PÁGINA 1 -->
    <h2>1. Objetivo y Alcance del Protocolo</h2>
    <p>Establecer las medidas técnicas, controles organizativos y procedimientos de seguridad lógica y respaldo aplicados en la plataforma OdontoCloud Colombia para salvaguardar la confidencialidad, integridad, autenticidad y disponibilidad de la información clínica y administrativa de las IPS y consultorios odontológicos.</p>

    <h2>2. Arquitectura de Infraestructura Cloud y Redes Seguras</h2>
    <p>OdontoCloud opera bajo el modelo Software as a Service (SaaS) desplegado sobre servidores virtuales privados (VPS) dedicados con sistema operativo empresarial Oracle Linux, gestionados mediante contenedores Docker aislados. Los componentes del sistema (frontend web interactivo, backend de microservicios y base de datos relacional) se interconectan en redes internas segmentadas sin exposición innecesaria de puertos directos a internet público.</p>
    <p>Toda comunicación de los usuarios se canaliza a través de un proxy inverso seguro que aplica cifrado obligatorio en tránsito mediante protocolo HTTPS con certificados TLS 1.3 de última generación y suites criptográficas robustas.</p>

    <h2>3. Aislamiento Lógico Multi-Inquilino (Multi-Tenant RLS)</h2>
    <p>La segregación de historias clínicas entre diferentes instituciones se implementa a nivel de motor de base de datos relacional PostgreSQL activando políticas de seguridad a nivel de fila (<em>Row Level Security - RLS</em>). Toda consulta o transacción valida el identificador institucional único (<code>organization_id</code>) derivado del token JWT criptográfico del usuario autenticado, impidiendo cualquier acceso o visibilidad de datos entre clínicas.</p>

    <h2>4. Política Verificable de Respaldos Lógicos y Restauración</h2>
    <p><strong>• Respaldo Lógico Automatizado:</strong> Se ejecutan copias periódicas de la base de datos relacional mediante la herramienta estándar <code>pg_dump</code> en formato binario comprimido (.Fc) sobre el servidor host asignado.</p>
    <p><strong>• Integridad y Recuperación:</strong> Las copias capturan el estado transaccional consistente de las historias clínicas, odontogramas y facturación. El procedimiento documentado de restauración se realiza mediante utilidades estándar (<code>pg_restore</code>).</p>
    <p><strong>• Delimitación Técnica Honesta:</strong> El sistema cuenta con copias de seguridad lógicas en el servidor host; no cuenta con replicación geográfica multi-nube redundante en tiempo real. Por lo anterior, la IPS mantiene el deber y la facultad indelegable de realizar sus propias descargas periódicas locales mediante los módulos de exportación.</p>

    <!-- SALTO A PÁGINA 2 -->
    <div style="page-break-before: always;"></div>

    <!-- PÁGINA 2 -->
    <h2>5. Controles de Acceso, Autenticación y Credenciales</h2>
    <p>El acceso se rige por un esquema de control de roles (RBAC): Administrador (gestión institucional), Odontólogo/Especialista (asistencia clínica, odontograma y adendas) y Recepción/Admisiones (citas y datos demográficos, sin acceso a la nota clínica reservada). Es responsabilidad estricta de la clínica custodiar las credenciales; se prohíbe el uso de cuentas compartidas.</p>

    <h2>6. Contingencia Asistencial, Trazabilidad y Bitácoras</h2>
    <p>El sistema registra bitácoras de auditoría de eventos críticos. Se aclara que actualmente no existe un módulo automatizado de Break-Glass en la interfaz; contingencias asistenciales extraordinarias se tramitan mediante soporte administrativo con registro manual en bitácora.</p>

    <h2>7. Gestión de Incidentes de Seguridad y Notificación en 24 Horas</h2>
    <p>Ante cualquier brecha confirmada de seguridad sobre datos personales o de salud, OdontoCloud notificará formalmente al Representante Legal de la IPS afectada dentro de las veinticuatro (24) horas siguientes a su confirmación técnica (Ley 1581 de 2012).</p>
  `;

  const sigsHtml = `
    <div class="signatures-block">
      <table class="sig-table">
        <tr>
          <td style="width: 100%;">
            <div class="sig-box-primary">
              <div class="sig-title">RESPONSABLE DE ARQUITECTURA TECNOLÓGICA Y SEGURIDAD:</div>
              <div class="sig-name">${PROVIDER_META.legalEntity}</div>
              <div class="sig-meta">
                Titular y Desarrollador — ${PROVIDER_META.personType} | C.C. No. ${PROVIDER_META.idNumber} de Sincelejo | NIT: 1102849760-5<br>
                OdontoCloud Colombia — Sede Sincelejo, Sucre | Canal Técnico: ${PROVIDER_META.contactEmail}
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return getHtmlTemplate({
    code: 'PROT-01',
    title: 'PROTOCOLO DE SEGURIDAD DE LA INFORMACIÓN Y RESPALDO CLOUD',
    subtitle: 'Directrices Técnicas de Seguridad Lógica, Cifrado, Respaldos Transaccionales y Continuidad Operativa OdontoCloud SaaS',
    badgeText: 'DOCUMENTO TÉCNICO OFICIAL DE SEGURIDAD',
    badgeColor: '#0d9488',
    badgeBg: '#f0fdfa',
    bannerHtml: '<strong>INFRAESTRUCTURA AUDITADA:</strong> VPS Oracle Linux | Docker Containers | PostgreSQL RLS | Cifrado HTTPS/TLS 1.3',
    contentHtml,
    signatureHtml: sigsHtml
  });
}

// =========================================================================================
// 3. TERM-01: TÉRMINOS Y CONDICIONES GENERALES DE USO DEL SERVICIO SAAS (2 PÁGINAS)
// =========================================================================================
async function buildTerm01() {
  console.log("Generando TERM-01 (Términos y Condiciones SaaS — 2 Páginas exactas)...");

  // Cuerpo DOCX
  const body = [
    // --- PÁGINA 1 ---
    hSection("1. Definiciones y Partes"),
    pText(`Los presentes Términos y Condiciones regulan el licenciamiento y uso de la plataforma OdontoCloud Colombia, provista por ${PROVIDER_META.legalEntity} (EL PROVEEDOR). Su aceptación vincula a toda persona natural o jurídica (LA IPS o EL CLIENTE) que acceda al servicio en la nube.`),

    hSection("2. Licencia de Uso No Exclusiva y Propiedad Intelectual"),
    pText("EL PROVEEDOR concede a LA IPS una licencia temporal, no exclusiva, revocable e intransferible para el uso del software en la nube. Todo el código, diseño y algoritmos son propiedad exclusiva de JUAN EDUARDO MADRID REQUENA. Los registros asistenciales e historias clínicas ingresadas son de propiedad de los pacientes bajo la custodia legal indelegable de LA IPS."),

    hSection("3. Nivel de Servicio (SLA) y Exclusiones"),
    pText("Se establece una disponibilidad objetivo del 99.5% mensual bajo un estándar de mejores esfuerzos técnicos. Se excluyen del cómputo de indisponibilidad: ventanas de mantenimiento preventivo notificadas con antelación, fallas en los proveedores de internet o equipos locales de la IPS, cortes fortuitos en el hosting/VPS o eventos de fuerza mayor."),

    hSection("4. Responsabilidad Asistencial Exclusiva y Delimitación REPS"),
    pText("OdontoCloud provee exclusivamente una herramienta informática. La relación odontólogo-paciente, los diagnósticos, planes de tratamiento, prescripción de fármacos y la pertinencia clínica corresponden de forma privativa e indelegable a los profesionales de la salud y a LA IPS. El software no ejerce la odontología. La obtención y mantenimiento de la habilitación sanitaria REPS (Resolución 3100 de 2019 de MinSalud) es responsabilidad privativa de LA IPS."),

    // SALTO DE PÁGINA OBLIGATORIO A PÁGINA 2
    new Paragraph({ children: [new PageBreak()] }),

    // --- PÁGINA 2 ---
    hSection("5. Procedimiento ante Mora y Salvaguarda de Historias Clínicas"),
    pText("En caso de mora superior a treinta (30) días calendario en el canon mensual pactado, EL PROVEEDOR enviará un requerimiento formal por escrito otorgando un plazo perentorio de quince (15) días calendario para regularizar la obligación o para que la clínica proceda a la descarga de sus historias clínicas activas mediante los módulos habilitados. Vencido este término sin acuerdo, podrá suspenderse temporalmente el acceso a la plataforma."),

    hSection("6. Custodia Sanitaria de 15 Años (Res. 839/2017) y Terminación"),
    pText("• Custodia Privativa de la IPS: Conforme a la Resolución 839 de 2017 de MinSalud, la custodia y conservación legal de las historias clínicas por quince (15) años corresponde de manera privativa e indelegable a LA IPS."),
    pText("• Periodo de Gracia de 60 Días: Finalizado el servicio por cualquier causa, LA IPS dispondrá de un plazo de sesenta (60) días calendario para exportar la totalidad de historias clínicas foliadas en PDF, datos en JSON/CSV y consentimientos digitalizados."),
    pText("• Acta de Cierre y Entrega Documentada: Al finalizar la exportación, LAS PARTES suscribirán un Acta de Cierre y Entrega Documentada que acredite el recibo formal de la información bajo custodia de la IPS."),
    pText("• Prohibición Absoluta de Borrado Automático: En ningún caso OdontoCloud ejecutará eliminación automática, unilateral o desatendida de datos asistenciales. Vencido el plazo de gracia sin retiro de datos, se enviará una notificación formal con preaviso de treinta (30) días para coordinar la entrega física/digital de los respaldos o pactar custodia transitoria tarifada."),

    hSection("7. Ley Aplicable y Jurisdicción"),
    pText("Se rige por las leyes de la República de Colombia. Cualquier controversia se someterá en primera instancia a arreglo directo y, en su defecto, ante los centros de conciliación autorizados en la ciudad de Sincelejo, Sucre.")
  ];

  const docxBuf = await buildDocxFile({
    code: "TERM-01",
    title: "TÉRMINOS Y CONDICIONES GENERALES DE USO DEL SERVICIO SAAS",
    subtitle: "Condiciones Generales de Contratación, Licenciamiento, Nivel de Servicio, Régimen de Custodia y Tratamiento Posterior de Datos",
    badgeText: "CONDICIONES GENERALES DE CONTRATACIÓN SAAS",
    badgeColor: "1D4ED8",
    bannerText: "RÉGIMEN CONTRACTUAL: Adhesión para Clínicas e IPS Odontológicas | Cumplimiento Resolución 839 de 2017 MinSalud",
    bodyElements: body
  });

  const docxPath = path.join(DOCX_DIR, 'TERM-01-Terminos-Condiciones-Uso-Servicio-SaaS.docx');
  fs.writeFileSync(docxPath, docxBuf);
  console.log("✓ DOCX generado:", docxPath);

  // HTML Playwright con división exacta de 2 páginas
  const contentHtml = `
    <!-- PÁGINA 1 -->
    <h2>1. Definiciones y Partes</h2>
    <p>Los presentes Términos y Condiciones regulan el licenciamiento y uso de la plataforma OdontoCloud Colombia, provista por <strong>${PROVIDER_META.legalEntity}</strong> (EL PROVEEDOR). Su aceptación vincula a toda persona natural o jurídica (LA IPS o EL CLIENTE) que acceda al servicio en la nube.</p>

    <h2>2. Licencia de Uso No Exclusiva y Propiedad Intelectual</h2>
    <p>EL PROVEEDOR concede a LA IPS una licencia temporal, no exclusiva, revocable e intransferible para el uso del software en la nube. Todo el código, diseño y algoritmos son propiedad exclusiva de JUAN EDUARDO MADRID REQUENA. Los registros asistenciales e historias clínicas ingresadas son de propiedad de los pacientes bajo la custodia legal indelegable de LA IPS.</p>

    <h2>3. Nivel de Servicio (SLA) y Exclusiones</h2>
    <p>Se establece una disponibilidad objetivo del 99.5% mensual bajo un estándar de mejores esfuerzos técnicos. Se excluyen del cómputo de indisponibilidad: ventanas de mantenimiento preventivo notificadas con antelación, fallas en los proveedores de internet o equipos locales de la IPS, cortes fortuitos en el hosting/VPS o eventos de fuerza mayor.</p>

    <h2>4. Responsabilidad Asistencial Exclusiva y Delimitación REPS</h2>
    <p>OdontoCloud provee exclusivamente una herramienta informática. La relación odontólogo-paciente, los diagnósticos, planes de tratamiento, prescripción de fármacos y la pertinencia clínica corresponden de forma privativa e indelegable a los profesionales de la salud y a LA IPS. El software no ejerce la odontología. La obtención y mantenimiento de la habilitación sanitaria REPS (Resolución 3100 de 2019 de MinSalud) es responsabilidad privativa de LA IPS.</p>

    <!-- SALTO A PÁGINA 2 -->
    <div style="page-break-before: always;"></div>

    <!-- PÁGINA 2 -->
    <h2>5. Procedimiento ante Mora y Salvaguarda de Historias Clínicas</h2>
    <p>En caso de mora superior a treinta (30) días calendario en el canon mensual pactado, EL PROVEEDOR enviará un requerimiento formal por escrito otorgando un plazo perentorio de quince (15) días calendario para regularizar la obligación o para que la clínica proceda a la descarga de sus historias clínicas activas mediante los módulos habilitados. Vencido este término sin acuerdo, podrá suspenderse temporalmente el acceso a la plataforma.</p>

    <h2>6. Custodia Sanitaria de 15 Años (Res. 839/2017) y Terminación</h2>
    <ul>
      <li><strong>Custodia Privativa de la IPS:</strong> Conforme a la Resolución 839 de 2017 de MinSalud, la custodia y conservación legal de las historias clínicas por quince (15) años corresponde de manera privativa e indelegable a LA IPS.</li>
      <li><strong>Periodo de Gracia de 60 Días:</strong> Finalizado el servicio por cualquier causa, LA IPS dispondrá de un plazo de sesenta (60) días calendario para exportar la totalidad de historias clínicas foliadas en PDF, datos en JSON/CSV y consentimientos digitalizados.</li>
      <li><strong>Acta de Cierre y Entrega Documentada:</strong> Al finalizar la exportación, LAS PARTES suscribirán un Acta de Cierre y Entrega Documentada que acredite el recibo formal de la información bajo custodia de la IPS.</li>
      <li><strong>Prohibición Absoluta de Borrado Automático:</strong> En ningún caso OdontoCloud ejecutará eliminación automática, unilateral o desatendida de datos asistenciales. Vencido el plazo de gracia sin retiro de datos, se enviará una notificación formal con preaviso de treinta (30) días para coordinar la entrega física/digital de los respaldos o pactar custodia transitoria tarifada.</li>
    </ul>

    <h2>7. Ley Aplicable y Jurisdicción</h2>
    <p>Se rige por las leyes de la República de Colombia. Cualquier controversia se someterá en primera instancia a arreglo directo y, en su defecto, ante los centros de conciliación autorizados en la ciudad de Sincelejo, Sucre.</p>
  `;

  return getHtmlTemplate({
    code: 'TERM-01',
    title: 'TÉRMINOS Y CONDICIONES GENERALES DE USO DEL SERVICIO SAAS',
    subtitle: 'Condiciones Generales de Contratación, Licenciamiento, Nivel de Servicio, Régimen de Custodia y Tratamiento Posterior de Datos',
    badgeText: 'CONDICIONES GENERALES DE CONTRATACIÓN SAAS',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    bannerHtml: '<strong>RÉGIMEN CONTRACTUAL:</strong> Adhesión para Clínicas e IPS Odontológicas | Cumplimiento Resolución 839 de 2017 MinSalud',
    contentHtml
  });
}

// =========================================================================================
// 4. POL-01: POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES Y ACUERDO DE ENCARGO (2 PÁGINAS)
// =========================================================================================
async function buildPol01() {
  console.log("Generando POL-01 (Política de Datos y Acuerdo de Encargo DPA — 2 Páginas exactas)...");

  // Cuerpo DOCX
  const body = [
    // --- PÁGINA 1 ---
    hSection("1. Alcance, Marco Jurídico y Principios Rectores"),
    pText(`Regula el tratamiento de datos personales por ${PROVIDER_META.legalEntity} (ODONTOCLOUD COLOMBIA) en cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013, aplicando los principios de legalidad, finalidad, veracidad, transparencia, seguridad y confidencialidad.`),

    hSection("2. Delimitación Estricta de Roles: Responsable vs. Encargado"),
    pText("• LA CLÍNICA / IPS actúa en calidad de RESPONSABLE DEL TRATAMIENTO respecto a los datos personales y datos sensibles de salud de sus pacientes y equipo asistencial."),
    pText("• ODONTOCLOUD COLOMBIA actúa en calidad de ENCARGADO DEL TRATAMIENTO, procesando los datos única y exclusivamente por cuenta y bajo instrucciones de la clínica para proveer el servicio en la nube."),

    hSection("3. Tratamiento de Datos Sensibles de Salud y Prohibición Comercial"),
    pText("Los datos de salud (anamnesis, odontogramas, evoluciones y consentimientos) son sensibles. LA CLÍNICA garantiza contar con la autorización previa, expresa e informada de los pacientes. ODONTOCLOUD COLOMBIA destina la información de forma privativa a la operación técnica del software (historia clínica, agenda, facturación FEV y RIPS). Queda estrictamente prohibido a OdontoCloud vender, ceder, transferir, monetizar o explotar comercialmente los datos clínicos de los pacientes."),

    hSection("4. Finalidades Exclusivas del Tratamiento Tecnológico"),
    pText("Los datos se procesan exclusivamente para la provisión del software asistencial, validación de RIPS JSON y conexión a factura electrónica DIAN, prohibiéndose cualquier finalidad ajena."),

    // SALTO DE PÁGINA OBLIGATORIO A PÁGINA 2
    new Paragraph({ children: [new PageBreak()] }),

    // --- PÁGINA 2 ---
    hSection("5. Derechos de los Titulares (ARCO) y Canales de Atención"),
    pText("Los titulares tienen derecho a conocer, actualizar, rectificar y suprimir sus datos (Art. 8 Ley 1581/2012). Las peticiones se tramitan a través de la IPS como Responsable del Tratamiento. Para comunicaciones directas con OdontoCloud se dispone del canal: bienvenido@odontocloudcolombia.com."),

    hSection("6. Deberes de Seguridad y Notificación de Incidentes en 24 Horas"),
    pText("El Encargado aplicará medidas técnicas (cifrado TLS 1.3, RLS PostgreSQL, respaldos) y notificará al Representante Legal de la IPS cualquier incidente de seguridad dentro de las veinticuatro (24) horas siguientes a su confirmación técnica."),

    hSection("7. Devolución, Exportación Segura (60 Días) y Terminación"),
    pText("Finalizado el servicio, LA CLÍNICA dispondrá de sesenta (60) días calendario para la exportación completa de sus registros. Se suscribirá un Acta de Cierre y Entrega Documentada. No se realizará borrado automático sin previa notificación formal de treinta (30) días calendario.")
  ];

  // Firma bilateral DOCX en Página 2
  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "0F2942" } },
            margins: { top: 80, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "POR EL ENCARGADO DEL TRATAMIENTO:", bold: true, size: 14, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: "___________________________________________", size: 14, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: PROVIDER_META.legalEntity, bold: true, size: 15, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: `${PROVIDER_META.personType}\nC.C. ${PROVIDER_META.idNumber} de Sincelejo | NIT: 1102849760-5\nOdontoCloud Colombia`, size: 13, color: "475569" })] })
            ]
          }),
          new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "" })] }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "0F2942" } },
            margins: { top: 80, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "POR EL RESPONSABLE DEL TRATAMIENTO:", bold: true, size: 14, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: "___________________________________________", size: 14, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "[NOMBRE_REPRESENTANTE_LEGAL]", bold: true, size: 15, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: "Representante Legal / Director Médico\nC.C. [CÉDULA] | NIT: [NIT_CLINICA]\n[RAZÓN SOCIAL DE LA CLÍNICA / IPS]", size: 13, color: "475569" })] })
            ]
          })
        ]
      })
    ]
  });

  const docxBuf = await buildDocxFile({
    code: "POL-01",
    title: "POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES Y ACUERDO DE ENCARGO (DPA)",
    subtitle: "Manual Integral de Protección de Datos Personales, Tratamiento de Datos Sensibles de Salud y Acuerdo de Encargo de Tratamiento",
    badgeText: "ACUERDO DE ENCARGO (DPA) SUJETO A FIRMA BILATERAL",
    badgeColor: "0D9488",
    bannerText: "RÉGIMEN LEGAL: Ley Estatutaria 1581 de 2012 | Decreto 1377 de 2013 | Clínica: Responsable / OdontoCloud: Encargado",
    bodyElements: body,
    signatureTable: sigTable
  });

  const docxPath = path.join(DOCX_DIR, 'POL-01-Politica-Tratamiento-Datos-Personales-DPA.docx');
  fs.writeFileSync(docxPath, docxBuf);
  console.log("✓ DOCX generado:", docxPath);

  // HTML Playwright con división exacta de 2 páginas
  const contentHtml = `
    <!-- PÁGINA 1 -->
    <h2>1. Alcance, Marco Jurídico y Principios Rectores</h2>
    <p>Regula el tratamiento de datos personales por <strong>${PROVIDER_META.legalEntity}</strong> (ODONTOCLOUD COLOMBIA) en cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013, aplicando los principios de legalidad, finalidad, veracidad, transparencia, seguridad y confidencialidad.</p>

    <h2>2. Delimitación Estricta de Roles: Responsable vs. Encargado</h2>
    <ul>
      <li><strong>LA CLÍNICA / IPS</strong> actúa en calidad de <strong>RESPONSABLE DEL TRATAMIENTO</strong> respecto a los datos personales y datos sensibles de salud de sus pacientes y equipo asistencial.</li>
      <li><strong>ODONTOCLOUD COLOMBIA</strong> actúa en calidad de <strong>ENCARGADO DEL TRATAMIENTO</strong>, procesando los datos única y exclusivamente por cuenta y bajo instrucciones de la clínica para proveer el servicio en la nube.</li>
    </ul>

    <h2>3. Tratamiento de Datos Sensibles de Salud y Prohibición Comercial</h2>
    <p>Los datos de salud (anamnesis, odontogramas, evoluciones y consentimientos) son sensibles. LA CLÍNICA garantiza contar con la autorización previa, expresa e informada de los pacientes. ODONTOCLOUD COLOMBIA destina la información de forma privativa a la operación técnica del software (historia clínica, agenda, facturación FEV y RIPS). <strong>Queda estrictamente prohibido a OdontoCloud vender, ceder, transferir, monetizar o explotar comercialmente los datos clínicos de los pacientes.</strong></p>

    <h2>4. Finalidades Exclusivas del Tratamiento Tecnológico</h2>
    <p>Los datos se procesan exclusivamente para la provisión del software asistencial, validación de RIPS JSON y conexión a factura electrónica DIAN, prohibiéndose cualquier finalidad ajena.</p>

    <!-- SALTO A PÁGINA 2 -->
    <div style="page-break-before: always;"></div>

    <!-- PÁGINA 2 -->
    <h2>5. Derechos de los Titulares (ARCO) y Canales de Atención</h2>
    <p>Los titulares tienen derecho a conocer, actualizar, rectificar y suprimir sus datos (Art. 8 Ley 1581/2012). Las peticiones se tramitan a través de la IPS como Responsable del Tratamiento. Para comunicaciones directas con OdontoCloud se dispone del canal: <code>bienvenido@odontocloudcolombia.com</code>.</p>

    <h2>6. Deberes de Seguridad y Notificación de Incidentes en 24 Horas</h2>
    <p>El Encargado aplicará medidas técnicas (cifrado TLS 1.3, RLS PostgreSQL, respaldos) y notificará al Representante Legal de la IPS cualquier incidente de seguridad dentro de las veinticuatro (24) horas siguientes a su confirmación técnica.</p>

    <h2>7. Devolución, Exportación Segura (60 Días) y Terminación</h2>
    <p>Finalizado el servicio, LA CLÍNICA dispondrá de sesenta (60) días calendario para la exportación completa de sus registros. Se suscribirá un Acta de Cierre y Entrega Documentada. No se realizará borrado automático sin previa notificación formal de treinta (30) días calendario.</p>
  `;

  const sigsHtml = `
    <div class="signatures-block">
      <table class="sig-table">
        <tr>
          <td>
            <div class="sig-box-primary">
              <div class="sig-title">POR EL ENCARGADO DEL TRATAMIENTO:</div>
              <div class="sig-name">${PROVIDER_META.legalEntity}</div>
              <div class="sig-meta">
                ${PROVIDER_META.personType}<br>
                C.C. No. ${PROVIDER_META.idNumber} de Sincelejo | NIT: 1102849760-5<br>
                OdontoCloud Colombia
              </div>
            </div>
          </td>
          <td style="width: 4%;"></td>
          <td>
            <div class="sig-box-primary">
              <div class="sig-title">POR EL RESPONSABLE DEL TRATAMIENTO:</div>
              <div class="sig-name">[NOMBRE_REPRESENTANTE_LEGAL]</div>
              <div class="sig-meta">
                Representante Legal / Director Médico<br>
                C.C. [CÉDULA] | NIT: [NIT_CLINICA]<br>
                [RAZÓN SOCIAL DE LA CLÍNICA / IPS]
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return getHtmlTemplate({
    code: 'POL-01',
    title: 'POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES Y ACUERDO DE ENCARGO (DPA)',
    subtitle: 'Manual Integral de Protección de Datos Personales, Tratamiento de Datos Sensibles de Salud y Acuerdo de Encargo de Tratamiento',
    badgeText: 'ACUERDO DE ENCARGO (DPA) SUJETO A FIRMA BILATERAL',
    badgeColor: '#0d9488',
    badgeBg: '#f0fdfa',
    bannerHtml: '<strong>RÉGIMEN LEGAL:</strong> Ley Estatutaria 1581 de 2012 | Decreto 1377 de 2013 | Clínica: Responsable / OdontoCloud: Encargado',
    contentHtml,
    signatureHtml: sigsHtml
  });
}

// =========================================================================================
// 5. CON-01: CONTRATO DE PRESTACIÓN DEL SERVICIO ODONTOCLOUD SAAS (4 PÁGINAS)
// =========================================================================================
async function buildCon01() {
  console.log("Copiando y verificando CON-01 perfeccionado para VALMA Dental Studio (4 Páginas)...");

  const con01Src = path.resolve('documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026/docx/CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.docx');
  const con01Dst = path.join(DOCX_DIR, 'CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.docx');
  fs.copyFileSync(con01Src, con01Dst);
  console.log("✓ DOCX CON-01 sincronizado a entrega definitiva:", con01Dst);

  const con01PdfSrc = path.resolve('documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026/pdf/CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.pdf');
  const con01PdfDst = path.join(PDF_DIR, 'CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.pdf');
  fs.copyFileSync(con01PdfSrc, con01PdfDst);
  console.log("✓ PDF CON-01 sincronizado a entrega definitiva:", con01PdfDst);
}

// =========================================================================================
// COMPILADOR MAESTRO Y RENDERIZADOR PDF CON PLAYWRIGHT
// =========================================================================================
async function buildAll() {
  console.log("================================================================================");
  console.log("COMPILANDO ENTREGA DEFINITIVA DEL EXPEDIENTE INSTITUCIONAL ODONTOCLOUD 2026");
  console.log("================================================================================\n");

  const cert01Html = await buildCert01();
  const prot01Html = await buildProt01();
  const term01Html = await buildTerm01();
  const pol01Html = await buildPol01();
  await buildCon01();

  // Renderizar los 4 PDFs restantes con Playwright
  console.log("\nIniciando Chromium en modo headless para renderizar PDFs de alta precisión...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const pdfQueue = [
    { code: 'CERT-01', file: 'CERT-01-Certificacion-Tecnica-Software-OdontoCloud.pdf', html: cert01Html },
    { code: 'PROT-01', file: 'PROT-01-Protocolo-Seguridad-Informacion-Respaldo-Cloud.pdf', html: prot01Html },
    { code: 'TERM-01', file: 'TERM-01-Terminos-Condiciones-Uso-Servicio-SaaS.pdf', html: term01Html },
    { code: 'POL-01', file: 'POL-01-Politica-Tratamiento-Datos-Personales-DPA.pdf', html: pol01Html }
  ];

  for (const item of pdfQueue) {
    console.log(`Renderizando ${item.code} -> ${item.file}...`);
    await page.setContent(item.html, { waitUntil: 'load' });
    const targetPath = path.join(PDF_DIR, item.file);
    await page.pdf({
      path: targetPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '18mm',
        right: '20mm',
        bottom: '18mm',
        left: '20mm'
      }
    });
    const stats = fs.statSync(targetPath);
    console.log(`✓ PDF generado exitosamente: ${item.file} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log("\n¡Todos los documentos DOCX y PDF de la entrega definitiva han sido creados!");
}

buildAll().catch(err => {
  console.error("Error generando suite:", err);
  process.exit(1);
});
