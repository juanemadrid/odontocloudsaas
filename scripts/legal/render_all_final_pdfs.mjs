import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { PROVIDER_META } from './final_suite_engine.mjs';

const BASE_DIR = path.resolve('documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026');
const PDF_DIR = path.join(BASE_DIR, 'pdf');
fs.mkdirSync(PDF_DIR, { recursive: true });

const LOGO_PATH = path.resolve('public/assets/logo.png');
const logoBuffer = fs.readFileSync(LOGO_PATH);
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

function getBaseTemplate({
  code,
  title,
  subtitle,
  badgeText,
  badgeColor = '#0d9488',
  badgeBg = '#f0fdfa',
  clientBanner = '',
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
      margin: 25mm 25mm 25mm 25mm;
      @bottom-left {
        content: "${code} | ${title.length > 55 ? title.substring(0, 52) + '...' : title} — OdontoCloud Colombia";
        font-family: 'Segoe UI', Calibri, Arial, sans-serif;
        font-size: 8pt;
        color: #64748b;
      }
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        font-family: 'Segoe UI', Calibri, Arial, sans-serif;
        font-size: 8pt;
        color: #64748b;
        font-weight: 600;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Calibri, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.45;
      font-size: 10.2pt;
      background: #ffffff;
      margin: 0; padding: 0;
    }
    
    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0f2942;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
    }
    .header-brand {
      font-size: 13pt;
      font-weight: 900;
      color: #0f2942;
      letter-spacing: 0.8px;
      margin: 0;
      line-height: 1.15;
    }
    .header-tagline {
      font-size: 8.5pt;
      color: #0d9488;
      font-weight: 700;
      margin: 2px 0 0 0;
    }
    .header-meta {
      text-align: right;
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.35;
    }
    .badge-status {
      display: inline-block;
      background: ${badgeBg};
      color: ${badgeColor};
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      margin-top: 3px;
    }

    .doc-title {
      text-align: center;
      font-size: 14.5pt;
      font-weight: 800;
      color: #0f2942;
      margin: 12px 0 3px 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 9.5pt;
      font-weight: 600;
      color: #475569;
      margin-bottom: 14px;
      font-style: italic;
    }
    .client-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #0f2942;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 9pt;
      margin-bottom: 16px;
      color: #334155;
    }

    h2 {
      font-size: 11pt;
      font-weight: 800;
      color: #0f2942;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
      margin-top: 18px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 8px 0;
      text-align: justify;
    }
    ul {
      margin: 0 0 8px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 4px;
      text-align: justify;
    }
    .callout {
      border-left: 4px solid #d97706;
      background: #fffbeb;
      padding: 10px 14px;
      margin: 12px 0;
      border-radius: 0 6px 6px 0;
      page-break-inside: avoid;
    }
    .callout.info {
      border-left-color: #0d9488;
      background: #f0fdfa;
    }
    .callout-title {
      font-weight: 700;
      color: #92400e;
      margin-bottom: 4px;
      font-size: 9.5pt;
    }
    .callout.info .callout-title {
      color: #0f766e;
    }
    .callout-text {
      font-size: 8.8pt;
      color: #78350f;
      line-height: 1.4;
      margin: 0;
      text-align: justify;
    }
    .callout.info .callout-text {
      color: #134e4a;
    }

    .signatures-block {
      margin-top: 24px;
      page-break-inside: avoid;
    }
    .sig-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    .sig-table td {
      width: 48%;
      vertical-align: top;
      padding: 10px;
    }
    .sig-box-primary {
      border-top: 2px solid #0f2942;
      padding-top: 8px;
    }
    .sig-box-warning {
      border-top: 2px solid #b45309;
      padding-top: 8px;
    }
    .sig-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0f2942;
      margin-bottom: 24px;
    }
    .sig-title-warning {
      font-size: 8.5pt;
      font-weight: 800;
      color: #b45309;
      margin-bottom: 24px;
    }
    .sig-name {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f2942;
      margin-top: 4px;
    }
    .sig-meta {
      font-size: 8pt;
      color: #475569;
      line-height: 1.35;
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

  ${clientBanner ? `<div class="client-banner">${clientBanner}</div>` : ''}

  <!-- CONTENIDO -->
  ${contentHtml}

  <!-- FIRMAS -->
  ${signatureHtml}

</body>
</html>`;
}

// 1. Generar HTML para CERT-01
function getCert01Html() {
  const content = `
    <h2>1. Identificación del Proveedor y Titular del Software</h2>
    <p>El suscrito <strong>${PROVIDER_META.legalEntity}</strong>, mayor de edad, domiciliado en la ciudad de Sincelejo, departamento de Sucre, identificado con Cédula de Ciudadanía No. ${PROVIDER_META.idNumber} de Sincelejo, titular del NIT ${PROVIDER_META.nit}, en su condición de <strong>${PROVIDER_META.personType}</strong> con Matrícula Mercantil No. ${PROVIDER_META.matriculaMercantil} de la ${PROVIDER_META.camaraComercio}, con actividad económica principal CIIU ${PROVIDER_META.ciiu}, actuando en nombre propio y en calidad de creador, titular y propietario exclusivo del software OdontoCloud Colombia (con sitio web oficial <a href="${PROVIDER_META.website}">${PROVIDER_META.website}</a> y canal de correo oficial ${PROVIDER_META.contactEmail}),</p>

    <h2>2. CERTIFICA QUE:</h2>
    <p>La plataforma tecnológica denominada <strong>OdontoCloud Colombia (Edición Oficial 2026.1, Release 8.2)</strong>, desarrollada para la gestión clínica, administrativa y asistencial de consultorios odontológicos e Instituciones Prestadoras de Servicios de Salud (IPS), ha sido estructurada e implementada conforme a los estándares técnicos, de seguridad y principios rectores de la documentación digital sanitaria colombiana, cumpliendo con las siguientes características comprobables:</p>
    <ul>
      <li><strong>Autenticidad y Trazabilidad Documental:</strong> La plataforma asigna a cada registro asistencial, nota de evolución y diagnóstico odontológico una marca de tiempo inmutable generada a nivel de base de datos con el servidor en tiempo universal coordinado (<code>clock_timestamp() UTC</code>), vinculada de forma indeleble al identificador único y perfil del profesional de la salud tratante que realizó la atención.</li>
      <li><strong>Integridad e Inmutabilidad de Historias Clínicas:</strong> En estricto cumplimiento de la Resolución 1995 de 1999 y la Resolución 839 de 2017 del Ministerio de Salud y Protección Social, el software garantiza que los registros asistenciales consolidados no pueden ser modificados, sustituidos ni eliminados por ningún usuario del sistema. Cualquier aclaración o corrección posterior se efectúa mediante el mecanismo de notas de adenda fechadas y firmadas secuencialmente, preservando el registro original intacto.</li>
      <li><strong>Fiabilidad y Seguridad en la Nube:</strong> El sistema opera en arquitectura cloud sobre base de datos relacional PostgreSQL con aislamiento lógico multi-inquilino estricto mediante políticas a nivel de fila (Row Level Security - RLS). La infraestructura implementa rutinas periódicas de respaldo lógico de datos (pg_dump transaccional comprimido .Fc) almacenadas en el servidor host asignado, orientadas a garantizar la continuidad del servicio ante fallos técnicos.</li>
      <li><strong>Consentimiento Informado y Firma Electrónica Confiable:</strong> Incorpora módulos para la captura de firma electrónica con trazo vectorial del paciente o acudiente en pantalla táctil conforme a los requisitos del Decreto 2364 de 2012, generando documentos en formato PDF inmutable vinculados al folio de la historia clínica.</li>
      <li><strong>Facturación y RIPS en Salud:</strong> Cuenta con conector verificado para la emisión de Factura Electrónica de Venta en salud (FEV) con código CUFE y QR ante la DIAN mediante Factus, y suite de generación de RIPS en estructura JSON compatible con la Resolución 2275 de 2023 de MinSalud.</li>
    </ul>

    <div class="callout">
      <div class="callout-title">⚖️ Declaración de Alcance y Delimitación Sanitaria Indelegable</div>
      <div class="callout-text">La presente certificación técnica hace constar exclusivamente las características de diseño, arquitectura, seguridad lógica y funcionamiento del software OdontoCloud Colombia. NO constituye habilitación de servicios de salud ante el Registro Especial de Prestadores de Servicios de Salud (REPS), trámite que conforme a la Resolución 3100 de 2019 de MinSalud corresponde única, privativa e indelegablemente a la institución prestadora contratante.</div>
    </div>

    <p>Se expide el presente documento a solicitud de las instituciones prestadoras interesadas, en la ciudad de Sincelejo, Sucre, en el mes de Octubre de 2026.</p>
  `;

  const sigs = `
    <div class="signatures-block">
      <table class="sig-table">
        <tr>
          <td>
            <div class="sig-box-primary">
              <div class="sig-title">POR EL PROVEEDOR TECNOLÓGICO:</div>
              <div class="sig-name">${PROVIDER_META.legalEntity}</div>
              <div class="sig-meta">
                ${PROVIDER_META.personType}<br>
                C.C. No. ${PROVIDER_META.idNumber} de Sincelejo<br>
                NIT: 1102849760-5 (Sujeto a cotejo con RUT)<br>
                Matrícula Mercantil 148131 (C.C. Sincelejo)<br>
                OdontoCloud Colombia<br>
                Correo: ${PROVIDER_META.contactEmail}
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
                Matrícula Profesional No. [DILIGENCIAR MATRÍCULA]<br>
                C.C. No. [DILIGENCIAR CÉDULA]<br>
                Certificado de Vigencia COPNIA: [ADJUNTAR SOPORTE]<br>
                <em>Estado: Dictamen Técnico Pendiente de Inspección</em>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return getBaseTemplate({
    code: 'CERT-01',
    title: 'CERTIFICACIÓN TÉCNICA DEL SOFTWARE ODONTOCLOUD COLOMBIA',
    subtitle: 'Declaración de Cumplimiento Técnico, Autenticidad, Fiabilidad, Integridad y Criterios Sanitarios (Resolución 3100 de 2019 y Ley 594 de 2000)',
    badgeText: 'MODELO OFICIAL — PENDIENTE DE FIRMA COPNIA',
    badgeColor: '#b45309',
    badgeBg: '#fffbeb',
    clientBanner: '<strong>SOFTWARE CERTIFICADO:</strong> OdontoCloud Colombia (Versión 2026.1, Release 8.2) | <strong>Modalidad:</strong> SaaS en la Nube | <strong>Finalidad:</strong> Soporte para Habilitación REPS',
    contentHtml: content,
    signatureHtml: sigs
  });
}

// 2. Generar HTML para PROT-01
function getProt01Html() {
  const content = `
    <h2>1. Objetivo y Alcance del Protocolo</h2>
    <p>El presente protocolo establece los lineamientos, medidas técnicas, controles organizativos y procedimientos de respaldo aplicados en la plataforma OdontoCloud Colombia para garantizar la confidencialidad, integridad, autenticidad y disponibilidad de la información clínica y administrativa de las instituciones prestadoras de servicios de salud (IPS) y consultorios odontológicos.</p>

    <h2>2. Arquitectura Tecnológica e Infraestructura Cloud</h2>
    <p>OdontoCloud opera bajo un modelo de Software as a Service (SaaS) desplegado sobre servidores virtuales privados (VPS) de alto rendimiento con sistema operativo Oracle Linux / Linux empresarial, gestionados mediante contenedores Docker aislados. Los componentes del sistema (frontend web interactivo, backend de microservicios, API REST y base de datos relacional) se ejecutan en redes internas virtuales segmentadas, impidiendo la exposición innecesaria de puertos a internet público.</p>
    <p>Toda la interacción de usuarios con la plataforma se canaliza a través de un proxy inverso seguro que aplica cifrado obligatorio en tránsito mediante protocolo HTTPS con certificados SSL/TLS 1.3 de última generación y suites criptográficas robustas.</p>

    <h2>3. Aislamiento Lógico Multi-Inquilino (Multi-Tenant Security)</h2>
    <p>La segregación de la información entre diferentes clínicas odontológicas se implementa a nivel de motor de base de datos relacional (PostgreSQL) mediante la activación de políticas de seguridad por fila (Row Level Security - RLS).</p>
    <p>Cada transacción, consulta o mutación de datos ejecutada por un usuario se valida contra el identificador único institucional (organization_id / tenant_id) derivado de su token de autenticación. Este control criptográfico y relacional garantiza de manera matemática que ningún usuario, odontólogo o administrativo de una clínica pueda tener visibilidad ni acceso a los registros clínicos de otra entidad.</p>

    <h2>4. Política Verificable de Copias de Seguridad y Recuperación</h2>
    <p>Para asegurar la resiliencia operativa y la disponibilidad de los datos ante contingencias técnicas, OdontoCloud aplica una política verificable de respaldos:</p>
    <ul>
      <li><strong>Respaldo Lógico Automatizado:</strong> Se ejecutan copias de seguridad lógicas periódicas de la base de datos relacional mediante la herramienta de volcado transaccional <code>pg_dump</code> en formato binario comprimido (.Fc) o instantáneas a nivel de contenedor.</li>
      <li><strong>Ubicación y Resguardo:</strong> Los volcados se almacenan en el sistema de almacenamiento del servidor host asignado a OdontoCloud, en volúmenes protegidos con permisos estrictos de acceso de nivel de superusuario.</li>
      <li><strong>Consistencia Transaccional:</strong> Las copias capturan el estado exacto de las tablas clínicas, evoluciones, odontogramas y facturación sin interrumpir la operación asistencial en curso.</li>
      <li><strong>Prueba de Restauración:</strong> Se mantienen procedimientos documentados de restauración de datos a través de utilidades estándar (<code>pg_restore</code>), permitiendo reanudar la operación del servicio en caso de fallo del contenedor.</li>
      <li><strong>Deber de Respaldo Local de la IPS:</strong> Sin perjuicio de las copias de seguridad de la infraestructura cloud, la clínica contratante tiene el derecho y la obligación de realizar sus propias descargas periódicas de historias clínicas mediante los módulos de exportación del sistema.</li>
    </ul>

    <h2>5. Controles de Acceso, Autenticación y Credenciales</h2>
    <p>El acceso a la plataforma se rige por un esquema de control de acceso basado en roles (Role-Based Access Control - RBAC), diferenciando perfiles:</p>
    <ul>
      <li><strong>Administrador de Clínica:</strong> Configuración institucional, tarifas, consentimientos y supervisión de usuarios.</li>
      <li><strong>Odontólogo / Especialista:</strong> Acceso asistencial a agenda, anamnesis, odontograma, evoluciones, adendas y prescripción.</li>
      <li><strong>Recepción / Admisiones:</strong> Asignación de citas, registro de datos demográficos y facturación, con acceso restringido a la intimidad de la evolución médica.</li>
      <li><strong>Responsabilidad del Cliente sobre Credenciales:</strong> Las contraseñas de acceso deben ser custodiadas con estricto carácter personal e intransferible por cada usuario. Queda terminantemente prohibido el uso de cuentas compartidas o genéricas. El cliente es responsable de revocar inmediatamente el acceso a funcionarios desvinculados.</li>
    </ul>

    <h2>6. Trazabilidad, Auditoría y Protocolo de Contingencia Asistencial</h2>
    <p>El sistema registra de forma automática en bitácoras protegidas cada intento de acceso, modificación de registros clínicos, emisión de facturas y eventos críticos de seguridad. En situaciones de urgencia vital donde se requiera acceso asistencial extraordinario, la plataforma contempla procedimientos de contingencia que registran indeleblemente la justificación médica de la consulta (protocolo Break-Glass).</p>

    <h2>7. Gestión de Incidentes de Seguridad y Notificación en 24 Horas</h2>
    <p>Ante la detección de cualquier evento confirmado que comprometa o amenace la confidencialidad de datos personales sensibles de salud, OdontoCloud activará el protocolo de contención técnica y notificará formalmente al Representante Legal de la IPS afectada dentro de las veinticuatro (24) horas siguientes a su confirmación técnica, conforme a los deberes fijados por la Ley 1581 de 2012.</p>
  `;

  const sigs = `
    <div class="signatures-block">
      <table class="sig-table">
        <tr>
          <td style="width: 100%;">
            <div class="sig-box-primary">
              <div class="sig-title">RESPONSABLE DE SEGURIDAD Y ARQUITECTURA TECNOLÓGICA:</div>
              <div class="sig-name">${PROVIDER_META.legalEntity}</div>
              <div class="sig-meta">
                Titular y Desarrollador — ${PROVIDER_META.personType}<br>
                C.C. No. ${PROVIDER_META.idNumber} de Sincelejo | NIT: 1102849760-5<br>
                OdontoCloud Colombia — Sede Sincelejo, Sucre<br>
                Canal Técnico: ${PROVIDER_META.contactEmail}
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return getBaseTemplate({
    code: 'PROT-01',
    title: 'PROTOCOLO DE SEGURIDAD DE LA INFORMACIÓN Y RESPALDO CLOUD',
    subtitle: 'Directrices Técnicas de Seguridad Lógica, Cifrado, Respaldos Transaccionales y Continuidad Operativa OdontoCloud SaaS',
    badgeText: 'DOCUMENTO TÉCNICO OFICIAL DE SEGURIDAD',
    badgeColor: '#0d9488',
    badgeBg: '#f0fdfa',
    contentHtml: content,
    signatureHtml: sigs
  });
}

// 3. Generar HTML para TERM-01
function getTerm01Html() {
  const content = `
    <h2>1. Definiciones y Alcance Contractual</h2>
    <p>Los presentes Términos y Condiciones regulan el acceso, licenciamiento de uso y prestación de servicios de software en la nube bajo el modelo Software as a Service (SaaS) a través de la plataforma OdontoCloud Colombia (en adelante, el Servicio o la Plataforma), provista por <strong>JUAN EDUARDO MADRID REQUENA</strong> (en adelante, EL PROVEEDOR).</p>
    <p>El uso de la plataforma por parte de cualquier clínica, consultorio odontológico, profesional independiente o institución prestadora de salud (en adelante, EL CLIENTE o LA IPS) implica el conocimiento, aceptación vinculante y sujeción estricta a estas condiciones generales.</p>

    <h2>2. Capacidad y Registro de Usuarios</h2>
    <p>El acceso al Servicio requiere la previa formalización comercial del plan correspondiente. LA IPS designará a los usuarios autorizados (odontólogos, especialistas, recepcionistas y administradores) a quienes se les habilitarán credenciales personales e intransferibles.</p>
    <p>LA IPS declara bajo la gravedad de juramento que la información suministrada respecto a su personería jurídica, código de habilitación REPS, domicilio y profesionales de la salud vinculados es verídica, vigente y legítima.</p>

    <h2>3. Licencia de Uso No Exclusiva y Propiedad Intelectual</h2>
    <p>EL PROVEEDOR concede a LA IPS una licencia temporal de uso, no exclusiva, revocable, no sublicenciable e intransferible para acceder a OdontoCloud a través de internet durante la vigencia del servicio contratado.</p>
    <p>Todo el software, código fuente, algoritmos, arquitectura técnica, modelos relacionales de datos, diseño de interfaces, marcas comerciales y logotipos son de propiedad exclusiva de JUAN EDUARDO MADRID REQUENA. LA IPS no adquiere derecho alguno de propiedad intelectual sobre el sistema.</p>
    <p>Por su parte, todos los registros clínicos, datos personales de pacientes, diagnósticos, consentimientos y fichas asistenciales ingresados en la plataforma son de propiedad de los pacientes y están bajo la custodia legal indelegable de LA IPS.</p>

    <h2>4. Disponibilidad del Servicio y Exclusiones de SLA</h2>
    <p>EL PROVEEDOR procurará mantener un nivel objetivo de disponibilidad del servicio del 99.5% mensual bajo un estándar de mejores esfuerzos técnicos. No obstante, LAS PARTES reconocen que pueden presentarse contingencias inherentes a las redes de telecomunicaciones.</p>
    <p>Se excluyen del cálculo de indisponibilidad: a) Ventanas programadas de mantenimiento preventivo y actualización, notificadas preferentemente en horarios nocturnos no asistenciales; b) Fallas en las redes de internet, equipos locales o proveedores de conectividad de LA IPS; c) Cortes o afectaciones imprevistas en la infraestructura del proveedor de hosting o VPS; d) Ataques informáticos masivos de denegación de servicio (DDoS) o eventos de fuerza mayor.</p>

    <h2>5. Responsabilidad Asistencial y Sanitaria Exclusiva de la IPS</h2>
    <p>LA IPS reconoce expresamente que OdontoCloud actúa de forma exclusiva como proveedor de una herramienta tecnológica de información.</p>
    <p>El acto odontológico, los diagnósticos, planes de tratamiento, prescripción de medicamentos, pertinencia clínica, diligenciamiento de notas de evolución y la relación profesional-paciente corresponden de manera privativa, directa e indelegable a los profesionales tratantes y a LA IPS. El software no ejerce la odontología, no formula prescripciones autónomas ni reemplaza el criterio médico.</p>
    <p>Asimismo, la obtención, registro y mantenimiento de la habilitación sanitaria ante el Registro Especial de Prestadores de Servicios de Salud (REPS) conforme a la Resolución 3100 de 2019 de MinSalud es de competencia exclusiva del prestador de salud.</p>

    <h2>6. Procedimiento ante Mora y Salvaguarda de la Información</h2>
    <p>En caso de mora superior a treinta (30) días calendario en el pago de los cánones acordados, EL PROVEEDOR remitirá un requerimiento formal al correo registrado de LA IPS, otorgando un plazo perentorio de quince (15) días calendario para la regularización de la obligación económica o para que la clínica proceda a la descarga y exportación de sus historias clínicas y registros activos a través de los módulos habilitados. Vencido este plazo sin acuerdo, EL PROVEEDOR podrá suspender temporalmente el acceso a la plataforma.</p>

    <h2>7. Custodia de 15 Años (Res. 839/2017), Exportación y Terminación</h2>
    <ul>
      <li><strong>Custodia Privativa de la IPS:</strong> Conforme a la Resolución 839 de 2017 de MinSalud, la custodia y conservación legal de las historias clínicas por el término de quince (15) años corresponde de manera privativa e indelegable a LA IPS.</li>
      <li><strong>Periodo de Gracia para Descarga:</strong> Finalizado el vínculo contractual por cualquier causa, LA IPS dispondrá de un periodo de gracia improrrogable de sesenta (60) días calendario para descargar o exportar la totalidad de sus historias clínicas foliadas en PDF, datos en JSON/CSV y consentimientos digitalizados.</li>
      <li><strong>Acta de Cierre y Entrega Documentada:</strong> Al término de la descarga, LAS PARTES suscribirán un Acta de Cierre y Entrega Documentada certificando que la información ha sido recibida por LA IPS bajo su custodia.</li>
      <li><strong>Fin del Alojamiento:</strong> EL PROVEEDOR no asume la custodia pasiva indefinida ni gratuita de las bases de datos de LA IPS, ni efectuará eliminación automática desatendida. Vencido el plazo de gracia sin suscripción del acta ni retiro de datos, se enviará un preaviso final de quince (15) días para acordar custodia transitoria tarifada o proceder al retiro y disposición de los contenedores conforme a la ley.</li>
    </ul>

    <h2>8. Ley Aplicable y Jurisdicción</h2>
    <p>Los presentes Términos se rigen e interpretan conforme a las leyes de la República de Colombia. Cualquier diferencia se resolverá en primera instancia mediante arreglo directo y, en su defecto, ante los centros de conciliación autorizados en la ciudad de Sincelejo, Sucre.</p>
  `;

  return getBaseTemplate({
    code: 'TERM-01',
    title: 'TÉRMINOS Y CONDICIONES GENERALES DE USO DEL SERVICIO SAAS',
    subtitle: 'Condiciones Generales de Contratación, Licenciamiento, Nivel de Servicio, Régimen de Custodia y Tratamiento Posterior de Datos',
    badgeText: 'BORRADOR PARA REVISIÓN Y ADHESIÓN COMERCIAL',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    contentHtml: content
  });
}

// 4. Generar HTML para POL-01
function getPol01Html() {
  const content = `
    <h2>1. Alcance, Marco Jurídico y Principios Rectores</h2>
    <p>La presente Política de Tratamiento de Datos Personales y Acuerdo de Encargo regula las operaciones de recolección, almacenamiento, custodia temporal y procesamiento de datos personales llevadas a cabo por <strong>JUAN EDUARDO MADRID REQUENA</strong> (en adelante, ODONTOCLOUD COLOMBIA o EL ENCARGADO), en cumplimiento estricto de la Ley Estatutaria 1581 de 2012, el Decreto Reglamentario 1377 de 2013 y demás normas que las adicionen o modifiquen.</p>
    <p>El tratamiento se fundamenta en los principios de legalidad, finalidad, libertad, veracidad, transparencia, acceso restringido, seguridad y confidencialidad.</p>

    <h2>2. Delimitación de Roles: Responsable vs. Encargado del Tratamiento</h2>
    <p>LAS PARTES declaran de manera expresa e inequívoca la delimitación jurídica de sus calidades:</p>
    <ul>
      <li><strong>LA CLÍNICA / IPS</strong> actúa en calidad de <strong>RESPONSABLE DEL TRATAMIENTO</strong> respecto a los datos personales y datos sensibles de salud de sus pacientes, usuarios y colaboradores.</li>
      <li><strong>ODONTOCLOUD COLOMBIA</strong> actúa en calidad de <strong>ENCARGADO DEL TRATAMIENTO</strong>, procesando y almacenando los datos personales única y exclusivamente por cuenta y bajo las instrucciones de LA CLÍNICA, con el propósito estricto de prestar el servicio de software en la nube.</li>
    </ul>

    <h2>3. Tratamiento Especial de Datos Sensibles de Salud</h2>
    <p>Se reconocen como datos sensibles los relativos a la salud, diagnósticos odontológicos, anamnesis, historia clínica, odontograma, imágenes diagnósticas, evolución clínica y firma digital de los pacientes.</p>
    <p>ODONTOCLOUD COLOMBIA solo procesará datos sensibles de salud cuando: a) LA CLÍNICA cuente con la autorización previa, expresa e informada del titular (paciente o acudiente legal); b) El tratamiento sea necesario para salvaguardar el interés vital del paciente; o c) El tratamiento tenga una finalidad histórica o médica legalmente autorizada.</p>

    <h2>4. Finalidades Exclusivas del Tratamiento Tecnológico</h2>
    <p>Los datos personales y sensibles confiados a ODONTOCLOUD COLOMBIA se destinan de manera privativa a:</p>
    <ul>
      <li>Gestión de la historia clínica electrónica y archivo digital odontológico.</li>
      <li>Administración de agendas de citas, turnos y recordatorios operativos.</li>
      <li>Estructuración y validación de RIPS en formato JSON (Resolución 2275 de 2023).</li>
      <li>Conexión tecnológica para la emisión de Factura Electrónica en Salud con CUFE y QR ante la DIAN.</li>
      <li>Ejecución de copias de seguridad de contingencia y recuperación técnica del sistema.</li>
    </ul>
    <p>Queda terminantemente prohibido a ODONTOCLOUD COLOMBIA vender, ceder, transferir, comercializar o usar los datos de pacientes para fines publicitarios, de perfilamiento no solicitado o de explotación comercial ajena al servicio contratado.</p>

    <h2>5. Derechos de los Titulares (Derechos ARCO) y Canales de Atención</h2>
    <p>Los titulares de los datos tienen derecho a conocer, actualizar, rectificar y suprimir sus datos personales, así como a revocar la autorización otorgada, conforme al artículo 8 de la Ley 1581 de 2012.</p>
    <p>Las solicitudes de pacientes serán canalizadas primariamente a través de LA CLÍNICA como Responsable del Tratamiento. Para solicitudes directas o consultas sobre esta política, se encuentra habilitado el canal oficial: <code>bienvenido@odontocloudcolombia.com</code>.</p>

    <h2>6. Deberes del Encargado y Autorización de Subencargados</h2>
    <p>ODONTOCLOUD COLOMBIA se compromete a: a) Tratar la información únicamente bajo instrucciones del Responsable; b) Mantener estricta reserva y confidencialidad; c) Implementar medidas de seguridad lógicas (RLS, cifrado HTTPS/TLS 1.3); d) Notificar cualquier brecha de seguridad dentro de las veinticuatro (24) horas siguientes a su detección.</p>
    <p>LA CLÍNICA autoriza a ODONTOCLOUD COLOMBIA a utilizar proveedores de infraestructura de nube (servidores virtuales privados / VPS y centros de datos certificados) estrictamente indispensables para la operatividad del sistema, quienes actuarán como subencargados técnicos bajo acuerdos equivalentes de seguridad.</p>

    <h2>7. Devolución, Exportación y Supresión de Datos al Término del Contrato</h2>
    <p>Finalizada la prestación del servicio por cualquier causa, LA CLÍNICA contará con sesenta (60) días calendario para descargar o exportar la totalidad de su información en formatos abiertos estándar.</p>
    <p>Concluida la exportación, LAS PARTES suscribirán un Acta de Cierre y Entrega Documentada. ODONTOCLOUD COLOMBIA no mantendrá copias pasivas indefinidas ni realizará eliminación desatendida sin previa notificación formal de quince (15) días, dando cumplimiento a las disposiciones de la Resolución 839 de 2017 de MinSalud.</p>
  `;

  const sigs = `
    <div class="signatures-block">
      <table class="sig-table">
        <tr>
          <td>
            <div class="sig-box-primary">
              <div class="sig-title">POR EL ENCARGADO DEL TRATAMIENTO:</div>
              <div class="sig-name">${PROVIDER_META.legalEntity}</div>
              <div class="sig-meta">
                ${PROVIDER_META.personType}<br>
                C.C. No. ${PROVIDER_META.idNumber} de Sincelejo<br>
                NIT: 1102849760-5<br>
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
                C.C. No. [CÉDULA_REPRESENTANTE]<br>
                [RAZÓN SOCIAL DE LA CLÍNICA / IPS]<br>
                NIT: [NIT_CLINICA]
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return getBaseTemplate({
    code: 'POL-01',
    title: 'POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES Y ACUERDO DE ENCARGO (DPA)',
    subtitle: 'Manual Integral de Protección de Datos Personales, Tratamiento de Datos Sensibles de Salud y Acuerdo de Encargo de Tratamiento',
    badgeText: 'DOCUMENTO CONTRACTUAL SUJETO A FIRMA BILATERAL',
    badgeColor: '#0d9488',
    badgeBg: '#f0fdfa',
    contentHtml: content,
    signatureHtml: sigs
  });
}

// Compilador Playwright
async function renderAllPdfs() {
  console.log("=== COMPILANDO PDFs NATIVOS DE LA SUITE INSTITUCIONAL FINAL ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const docs = [
    {
      code: 'CERT-01',
      file: 'CERT-01-Certificacion-Tecnica-Software-OdontoCloud.pdf',
      html: getCert01Html()
    },
    {
      code: 'PROT-01',
      file: 'PROT-01-Protocolo-Seguridad-Informacion-Respaldo-Cloud.pdf',
      html: getProt01Html()
    },
    {
      code: 'TERM-01',
      file: 'TERM-01-Terminos-Condiciones-Uso-Servicio-SaaS.pdf',
      html: getTerm01Html()
    },
    {
      code: 'POL-01',
      file: 'POL-01-Politica-Tratamiento-Datos-Personales-DPA.pdf',
      html: getPol01Html()
    }
  ];

  for (const doc of docs) {
    console.log(`Renderizando ${doc.code} -> ${doc.file}...`);
    await page.setContent(doc.html, { waitUntil: 'load' });
    const targetPath = path.join(PDF_DIR, doc.file);
    await page.pdf({
      path: targetPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '25mm',
        right: '25mm',
        bottom: '25mm',
        left: '25mm'
      }
    });
    const stats = fs.statSync(targetPath);
    console.log(`✓ Generado exitosamente: ${doc.file} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log("\nTodos los PDFs de la suite han sido compilados con éxito!");
}

renderAllPdfs().catch(err => {
  console.error("Error compilando PDFs:", err);
  process.exit(1);
});
