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

const BASE_OUT_DIR = path.resolve('documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026');
const PDF_OUT_DIR = path.join(BASE_OUT_DIR, 'pdf');
const DOCX_OUT_DIR = path.join(BASE_OUT_DIR, 'docx');

fs.mkdirSync(PDF_OUT_DIR, { recursive: true });
fs.mkdirSync(DOCX_OUT_DIR, { recursive: true });

const LOGO_PATH = path.resolve('public/assets/logo.png');
const logoBuffer = fs.readFileSync(LOGO_PATH);
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

// Generador HTML para Playwright (A4, márgenes 2.5cm)
function generateHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>CON-01 — Contrato de Prestación del Servicio OdontoCloud SaaS — VALMA Dental Studio</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm 22mm 20mm 22mm;
      @top-left {
        content: "";
      }
      @bottom-left {
        content: "CON-01 | Contrato SaaS — OdontoCloud Colombia";
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
      line-height: 1.33;
      font-size: 9.2pt;
      background: #ffffff;
      margin: 0; padding: 0;
    }
    
    /* ENCABEZADO INSTITUCIONAL */
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
      width: 50px;
      height: 50px;
      object-fit: contain;
    }
    .header-brand {
      font-size: 12pt;
      font-weight: 900;
      color: #0f2942;
      letter-spacing: 0.8px;
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
    .header-meta strong {
      color: #0f2942;
    }
    .badge-status {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid #bfdbfe;
      margin-top: 2px;
      font-size: 6.8pt;
    }

    /* TÍTULO PRINCIPAL */
    .doc-title-block {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 4px;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: 900;
      color: #0f2942;
      margin: 0 0 2px 0;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .doc-subtitle {
      font-size: 8.8pt;
      color: #475569;
      font-weight: 600;
      margin: 0 0 6px 0;
    }
    .client-banner {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0d9488;
      padding: 4px 10px;
      border-radius: 3px;
      display: inline-block;
      font-size: 8pt;
      color: #0f172a;
      text-align: left;
    }
    .client-banner strong {
      color: #0f2942;
    }

    /* TIPOGRAFÍA Y CLÁUSULAS */
    h1 {
      color: #0f2942;
      font-size: 9.8pt;
      font-weight: 800;
      border-left: 3px solid #0d9488;
      padding-left: 6px;
      margin-top: 8px;
      margin-bottom: 3px;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 4px 0;
      text-align: justify;
      text-justify: inter-word;
    }
    ul {
      margin: 0 0 5px 0;
      padding-left: 16px;
    }
    li {
      margin-bottom: 2px;
      text-align: justify;
    }
    .var-field {
      background: #fef08a;
      color: #854d0e;
      font-weight: 700;
      padding: 0px 3px;
      border-radius: 2px;
    }

    /* TABLAS */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 5px 0 7px 0;
      font-size: 7.8pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 3px 5px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #0f2942;
      color: #ffffff;
      font-weight: 700;
      font-size: 7.6pt;
      letter-spacing: 0.2px;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    tr {
      page-break-inside: avoid;
    }

    /* CALLOUTS */
    .callout {
      border-left: 3px solid #0284c7;
      background: #f0f9ff;
      padding: 5px 8px;
      border-radius: 0 4px 4px 0;
      margin: 5px 0 7px 0;
      font-size: 8pt;
      page-break-inside: avoid;
    }
    .callout-title {
      font-weight: 800;
      color: #0369a1;
      margin-bottom: 2px;
    }
    .callout-warning {
      border-left-color: #d97706;
      background: #fffbeb;
    }
    .callout-warning .callout-title {
      color: #b45309;
    }

    /* FIRMAS */
    .signature-section {
      page-break-inside: avoid;
      margin-top: 10px;
      padding-top: 4px;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .sig-card {
      border-top: 1.5px solid #0f2942;
      padding-top: 4px;
      font-size: 7.8pt;
      line-height: 1.3;
    }
    .sig-card strong {
      color: #0f2942;
      font-size: 8.6pt;
    }
  </style>
</head>
<body>

  <!-- ENCABEZADO INSTITUCIONAL -->
  <div class="header-container">
    <div class="header-left">
      <img src="${logoBase64}" class="header-logo" alt="OdontoCloud Logo" />
      <div>
        <div class="header-brand">ODONTOCLOUD COLOMBIA</div>
        <div class="header-tagline">Software de Gestión Odontológica en la Nube</div>
      </div>
    </div>
    <div class="header-meta">
      <strong>Código:</strong> CON-01 | <strong>Versión:</strong> 2026.1<br>
      <strong>Edición:</strong> Octubre 2026 | <strong>Portal:</strong> odontocloudcolombia.com<br>
      <span class="badge-status">BORRADOR PARA REVISIÓN JURÍDICA Y FIRMA</span>
    </div>
  </div>

  <!-- TÍTULO PRINCIPAL Y CLIENTE -->
  <div class="doc-title-block">
    <div class="doc-title">Contrato de Prestación del Servicio OdontoCloud SaaS</div>
    <div class="doc-subtitle">Licenciamiento de Uso de Software Asistencial en la Nube, Alojamiento, Respaldo y Soporte Técnico</div>
    <div class="client-banner">
      <strong>CLIENTE CONTRATANTE:</strong> VALMA DENTAL STUDIO | <strong>NIT:</strong> <span class="var-field">[NIT_VALMA_DENTAL_STUDIO]</span> | <strong>REPS:</strong> <span class="var-field">[CÓDIGO_REPS_12_DÍGITOS]</span>
    </div>
  </div>

  <!-- COMPARECIENTES -->
  <h1>1. Comparecientes e Identificación de las Partes</h1>
  <p>Entre los suscritos a saber:</p>
  <p><strong>DE UNA PARTE:</strong> <strong>JUAN EDUARDO MADRID REQUENA</strong>, mayor de edad, domiciliado y residente en la ciudad de Sincelejo, departamento de Sucre, identificado con Cédula de Ciudadanía No. 1102849760 de Sincelejo, titular del Número de Identificación Tributaria <strong>NIT 1102849760-5</strong> (sujeto a cotejo con RUT vigente expedido por la DIAN), en su condición de <strong>Persona Natural Comerciante</strong> con Matrícula Mercantil No. <strong>148131</strong> de la Cámara de Comercio de Sincelejo (activa 2026, sujeta a cotejo con certificado mercantil vigente), con actividad económica principal registrada bajo el código CIIU 6312 (Portales web y servicios de procesamiento de datos), actuando en nombre propio y en calidad de titular y propietario exclusivo de la plataforma tecnológica <strong>OdontoCloud Colombia</strong> (en adelante, <strong>EL PROVEEDOR</strong> o <strong>EL CONTRATISTA</strong>), con sitio web oficial <em>https://odontocloudcolombia.com</em> y canal oficial de notificaciones <em>bienvenido@odontocloudcolombia.com</em>.</p>
  <p><strong>DE OTRA PARTE:</strong> <strong>VALMA DENTAL STUDIO</strong> <span class="var-field">[O RAZÓN SOCIAL COMPLETA DE LA IPS / CONSULTORIO]</span>, entidad prestadora de servicios de salud legalmente constituida, identificada con el <strong>NIT No. <span class="var-field">[NIT_VALMA_DENTAL_STUDIO]</span></strong>, con domicilio principal en la ciudad de <span class="var-field">[CIUDAD_DOMICILIO]</span>, departamento de <span class="var-field">[DEPARTAMENTO]</span>, dirección de sede <span class="var-field">[DIRECCIÓN_SEDE_PRINCIPAL]</span>, con Código de Habilitación ante el Registro Especial de Prestadores de Servicios de Salud (REPS) No. <span class="var-field">[CÓDIGO_REPS_12_DÍGITOS]</span>, representada legalmente en este acto por <strong><span class="var-field">[NOMBRE_DEL_REPRESENTANTE_LEGAL]</span></strong>, mayor de edad, identificado(a) con Cédula de Ciudadanía No. <span class="var-field">[CÉDULA_REPRESENTANTE]</span>, con correo electrónico oficial para notificaciones <span class="var-field">[CORREO_NOTIFICACIONES_CLÍNICA]</span> y teléfono de contacto <span class="var-field">[TELÉFONO_CLÍNICA]</span> (en adelante, <strong>EL CONTRATANTE</strong> o <strong>LA CLÍNICA</strong>).</p>
  <p>Quienes en adelante se denominarán conjuntamente como <strong>LAS PARTES</strong>, han convenido celebrar el presente <strong>CONTRATO DE PRESTACIÓN DE SERVICIOS DE SOFTWARE EN LA NUBE (SaaS)</strong>, el cual se regirá por la legislación comercial colombiana, las normas de protección de datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013), las disposiciones sanitarias sobre historia clínica (Resolución 1995 de 1999 y Resolución 839 de 2017 de MinSalud) y las siguientes cláusulas:</p>

  <!-- CLÁUSULA PRIMERA -->
  <h1>Cláusula Primera — Objeto del Contrato</h1>
  <p>EL PROVEEDOR se obliga a conceder a favor de LA CLÍNICA, bajo la modalidad de <strong>Software as a Service (SaaS)</strong>, una licencia de uso no exclusiva, no sublicenciable, revocable e intransferible para el acceso a través de internet a la plataforma informática asistencial <strong>OdontoCloud Colombia (Versión 2026.1, Release 8.2)</strong>, comprendiendo los servicios de alojamiento en nube (hosting), gestión de base de datos relacional multi-inquilino aislada lógicamente, rutinas periódicas de respaldo lógico de datos y servicio de mesa de ayuda técnica.</p>

  <!-- CLÁUSULA SEGUNDA -->
  <h1>Cláusula Segunda — Selección y Estado Individual de Módulos Contratados</h1>
  <p>El alcance operativo de la licencia conferida dependerá de los módulos funcionales habilitados específicamente para VALMA Dental Studio al momento de la suscripción, según la siguiente matriz de selección individual:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 26%;">Módulo Funcional</th>
        <th style="width: 46%;">Descripción Operativa y Alcance</th>
        <th style="width: 28%;">Estado para la Clínica</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Gestión de Pacientes y Filiación</strong></td>
        <td>Registro sociodemográfico, régimen SGSSS, antecedentes estomatológicos y médicos, alertas de salud.</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>2. Agenda Odontológica</strong></td>
        <td>Programación de citas por profesional, sillón y sede; control de estados de cita; recordatorios operativos.</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>3. Historia Clínica Electrónica (HCE)</strong></td>
        <td>Anamnesis estomatológica, examen estomatológico integral, diagnósticos codificados en estándar CIE-10.</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>4. Odontograma Digital Interactivo</strong></td>
        <td>Odontograma inicial y evolutivo en nomenclaturas FDI y Universal; registro gráfico de patologías y tratamientos.</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>5. Evoluciones Clínicas Inmutables</strong></td>
        <td>Foliación cronológica mediante clock_timestamp() UTC y soporte de adendas normativas (Res. 1995/1999).</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>6. Consentimientos Informados</strong></td>
        <td>Plantillas procedimentales, captura de firma táctil vectorial del paciente o acudiente y archivo PDF inmutable.</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>7. Presupuestos y Tratamientos</strong></td>
        <td>Estructuración por fases de tratamiento, tarifas institucionales y procedimientos codificados en CUPS.</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>8. Facturación Electrónica (FEV)</strong></td>
        <td>Emisión sincrónica con validación previa DIAN mediante conector Factus, con código CUFE y código QR.</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>9. RIPS Formato JSON (Res. 2275/2023)</strong></td>
        <td>Estructuras JSON de usuarios, consultas y procedimientos; suite de validación pre-radicación ministerial.</td>
        <td><span class="var-field">[X] Contratado</span><br>[ ] No contratado<br>[ ] En pruebas | [ ] Pendiente</td>
      </tr>
      <tr>
        <td><strong>10. Interoperabilidad IHCE (Res. 1888/2025)</strong></td>
        <td>Conector REST preconfigurado para resúmenes de atención. <strong>Nota:</strong> En pruebas/sandbox; no homologado en producción.</td>
        <td>[ ] Contratado<br>[ ] No contratado<br><span class="var-field">[X] En pruebas</span><br>[ ] Pendiente</td>
      </tr>
    </tbody>
  </table>

  <!-- CLÁUSULA TERCERA -->
  <h1>Cláusula Tercera — Plan Comercial, Canon Periódico y Condiciones de Pago</h1>
  <p><strong>1. Plan Seleccionado:</strong> LA CLÍNICA contrata el plan <strong><span class="var-field">[PLAN: PROFESIONAL / BÁSICO / IPS MULTISEDE]</span></strong>, el cual autoriza hasta <strong><span class="var-field">[NÚMERO_DE_USUARIOS]</span></strong> usuarios profesionales/asistenciales concurrentes activos en el sistema.</p>
  <p><strong>2. Canon Periódico:</strong> Por los servicios objeto del contrato, LA CLÍNICA pagará a EL PROVEEDOR la suma de <strong>$<span class="var-field">[VALOR_EN_NÚMEROS]</span> COP</strong> (<span class="var-field">[VALOR_EN_LETRAS]</span> PESOS MONEDA CORRIENTE), pagaderos de manera <strong><span class="var-field">[MENSUAL / ANUAL ANTICIPADA]</span></strong>.</p>
  <p><strong>3. Plazo y Forma de Pago:</strong> El canon deberá ser cancelado dentro de los primeros <strong><span class="var-field">[CINCO (5)]</span></strong> días hábiles siguientes al inicio de cada periodo facturado, mediante transferencia o consignación bancaria a la cuenta corriente/ahorros No. <span class="var-field">[NÚMERO_DE_CUENTA]</span> del Banco <span class="var-field">[BANCO]</span> a nombre de JUAN EDUARDO MADRID REQUENA.</p>
  <p><strong>4. Reajuste Anual:</strong> En caso de prórroga automática, el canon se reajustará anualmente a partir del primer día del periodo prorrogado conforme a la variación acumulada del IPC del año anterior certificado por el DANE o el porcentaje acordado por LAS PARTES.</p>

  <!-- CLÁUSULA CUARTA -->
  <h1>Cláusula Cuarta — Vigencia, Duración y Prórrogas</h1>
  <p>El presente contrato tendrá una vigencia inicial de <strong><span class="var-field">[UN (1) AÑO]</span></strong>, contado a partir de la firma del Acta de Entrega, Configuración y Puesta en Marcha (CON-03). Se prorrogará automáticamente por periodos iguales sucesivos, a menos que cualquiera de LAS PARTES manifieste por escrito su voluntad de no prorrogarlo con una antelación no inferior a <strong>treinta (30) días calendario</strong> a la fecha de vencimiento.</p>

  <!-- CLÁUSULA QUINTA -->
  <h1>Cláusula Quinta — Delimitación de Responsabilidades Técnicas de EL PROVEEDOR</h1>
  <p>EL PROVEEDOR asume exclusivamente obligaciones de medio técnico respecto al funcionamiento del software y la infraestructura provista:</p>
  <ul>
    <li><strong>Compromiso Objetivo de Disponibilidad (SLA):</strong> EL PROVEEDOR procurará mantener un nivel de disponibilidad técnica del 99.5% mensual, entendido como un objetivo operacional de mejores esfuerzos técnicos y no como una garantía absoluta de ininterrupción. Se excluyen del cómputo: a) Ventanas nocturnas de mantenimiento preventivo notificadas; b) Fallas de conectividad/ISP o equipos de LA CLÍNICA; c) Interrupciones originadas en el proveedor de alojamiento VPS o centros de datos; d) Ataques masivos de denegación de servicio (DDoS) o fuerza mayor.</li>
    <li><strong>Política Verificable de Copias de Seguridad:</strong> Mantener una rutina de respaldos lógicos periódicos de la base de datos relacional mediante utilidades de volcado transaccional (pg_dump comprimido .Fc o instantáneas a nivel de contenedor), almacenados en el servidor host asignado a OdontoCloud para contingencias de la plataforma. EL PROVEEDOR no asume almacenamiento redundante externo ni cifrado no comprobado. LA CLÍNICA mantiene el deber de realizar periódicamente sus propias descargas institucionales.</li>
    <li><strong>Aislamiento Lógico Multi-Inquilino:</strong> Segregación estricta de datos mediante políticas lógicas de base de datos (Row Level Security - RLS), asegurando que ningún usuario externo acceda a la información de LA CLÍNICA.</li>
    <li><strong>Soporte Técnico Operativo:</strong> Asistencia técnica mediante Asistente IA 24/7, línea de WhatsApp de ingeniería y correo oficial <em>bienvenido@odontocloudcolombia.com</em>.</li>
    <li><strong>Notificación de Incidentes:</strong> Notificar a LA CLÍNICA cualquier incidente comprobado que comprometa datos personales sensibles dentro de las veinticuatro (24) horas siguientes a su confirmación (Ley 1581/2012).</li>
    <li><strong>Herramientas de Exportación:</strong> Mantener habilitadas las funciones de exportación de historias clínicas en formatos estándar (PDF foliado, CSV y JSON) para facilitar la portabilidad de datos.</li>
  </ul>

  <!-- CLÁUSULA SEXTA -->
  <h1>Cláusula Sexta — Delimitación de Responsabilidades Clínicas y Sanitarias de LA CLÍNICA</h1>
  <p>LA CLÍNICA, en su condición indelegable de prestadora de servicios de salud, asume la totalidad de las responsabilidades asistenciales y regulatorias:</p>
  <ul>
    <li><strong>Responsabilidad Asistencial Exclusiva:</strong> El acto odontológico, diagnósticos, tratamientos, prescripción médica, pertinencia y notas de evolución corresponden exclusivamente a LA CLÍNICA y a sus profesionales tratantes. EL PROVEEDOR actúa estrictamente como proveedor de software y no audita el criterio médico.</li>
    <li><strong>Habilitación Sanitaria ante el REPS:</strong> Obtener y mantener vigentes las condiciones de habilitación de servicios de salud ante el REPS conforme a la Resolución 3100 de 2019 de MinSalud. El software no constituye habilitación ni exime a LA CLÍNICA de sus obligaciones regulatorias.</li>
    <li><strong>Custodia Estricta de Credenciales:</strong> Asignar usuarios individuales con clave personal e intransferible a cada profesional. Queda prohibido el uso compartido de contraseñas.</li>
    <li><strong>Veracidad de la Información:</strong> Garantizar la exactitud y veracidad de todos los datos clínicos incorporados en la plataforma.</li>
    <li><strong>Infraestructura Cliente:</strong> Disponer de terminales compatibles y conexión a internet estable.</li>
    <li><strong>Pago Oportuno:</strong> Cancelar puntualmente el canon pactado en la Cláusula Tercera.</li>
  </ul>

  <!-- CLÁUSULA SÉPTIMA -->
  <h1>Cláusula Séptima — Suspensión por Mora y Procedimiento Previo de Salvaguarda</h1>
  <div class="callout callout-warning">
    <div class="callout-title">⚠️ Notificación Previa y Salvaguarda ante Mora</div>
    En caso de mora superior a treinta (30) días calendario en el pago del canon, EL PROVEEDOR notificará por escrito a LA CLÍNICA otorgando un plazo perentorio de quince (15) días calendario para regularizar la obligación o para que LA CLÍNICA, con anterioridad a cualquier corte del servicio, coordine y descargue sus historias clínicas activas mediante las herramientas de exportación disponibles. Vencido este plazo sin subsanación ni acuerdo, EL PROVEEDOR podrá suspender el acceso a la plataforma, dejando constancia de la notificación previa efectuada a la IPS.
  </div>

  <!-- CLÁUSULA OCTAVA -->
  <h1>Cláusula Octava — Custodia Sanitaria, Exportación Verificable y Tratamiento Posterior</h1>
  <p><strong>1. Custodia Legal a Cargo de la IPS:</strong> Conforme al artículo 3 de la Resolución 839 de 2017 de MinSalud, la custodia y conservación legal de las historias clínicas por el término de <strong>quince (15) años</strong> corresponde de manera privativa e indelegable a LA CLÍNICA. OdontoCloud actúa exclusivamente como herramienta transitoria de archivo mientras el contrato esté vigente.</p>
  <p><strong>2. Plazo de Gracia para Exportación:</strong> A la terminación del contrato, LA CLÍNICA dispondrá de un plazo de <strong>sesenta (60) días calendario</strong> para descargar y respaldar en sus propios medios la totalidad de las historias clínicas, odontogramas, evoluciones, consentimientos y registros contables en PDF foliado, JSON y CSV.</p>
  <p><strong>3. Entrega Documentada y Fin del Alojamiento:</strong> Concluida la descarga o vencido el plazo, LAS PARTES suscribirán un <strong>Acta de Cierre y Entrega Documentada</strong>, certificando el recibo o descarga de los datos bajo la custodia de la IPS.</p>
  <p><strong>4. Prohibición de Borrado Automático y Salvaguarda Sanitaria:</strong> EL PROVEEDOR <strong>no asume custodia pasiva indefinida ni gratuita</strong> de las bases de datos de LA CLÍNICA, pero bajo ninguna circunstancia ejecutará eliminación automática, unilateral o desatendida de la información asistencial. Si vencido el plazo de gracia de sesenta (60) días LA CLÍNICA no ha culminado la exportación ni suscrito el acta de cierre, EL PROVEEDOR remitirá una notificación formal certificada con un preaviso no inferior a treinta (30) días calendario para: a) Coordinar la entrega formal de los archivos de volcado y respaldo en medios seguros; o b) Acordar un esquema transitorio de custodia pasiva tarifada conforme a las directrices de la Resolución 839 de 2017 del Ministerio de Salud y Protección Social. Únicamente tras agotarse este procedimiento documentado y constar la salvaguarda de los datos por la IPS, se procederá a la desinstalación técnica del entorno operativo.</p>

  <!-- CLÁUSULA NOVENA -->
  <h1>Cláusula Novena — Protección de Datos Personales y Acuerdo de Encargo (Anexo DOC-06)</h1>
  <p>En el marco de la Ley 1581 de 2012, LA CLÍNICA actúa como <strong>Responsable del Tratamiento</strong> y EL PROVEEDOR como <strong>Encargado del Tratamiento</strong>. Se incorpora como parte integral el <strong>ANEXO NO. 1: ACUERDO DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES (DOC-06)</strong>, sujeto a revisión y firma bilateral, detallando instrucciones, confidencialidad, autorización de subencargados de infraestructura cloud/VPS, medidas de seguridad aplicadas y protocolo de devolución o disposición de información al finalizar el contrato.</p>

  <!-- CLÁUSULA DÉCIMA -->
  <h1>Cláusula Décima — Propiedad Intelectual y Titularidad de la Información</h1>
  <p>El software, código fuente, modelos de datos, logotipos y documentación técnica de OdontoCloud son de propiedad exclusiva de <strong>JUAN EDUARDO MADRID REQUENA</strong>. LA CLÍNICA no adquiere derechos de autor sobre el sistema. Por su parte, la información clínica, fichas de pacientes y diagnósticos son de propiedad de los pacientes bajo la custodia legal indelegable de LA CLÍNICA.</p>

  <!-- CLÁUSULA UNDÉCIMA Y DUODÉCIMA -->
  <h1>Cláusula Undécima — Causales de Terminación</h1>
  <p>El presente contrato terminará por: a) Mutuo acuerdo escrito; b) Vencimiento del plazo o prórrogas mediando preaviso de treinta (30) días; c) Incumplimiento grave no subsanado en quince (15) días; d) Liquidación o cancelación de personería o REPS de LA CLÍNICA; e) Fuerza mayor debidamente acreditada.</p>

  <h1>Cláusula Duodécima — Solución de Controversias y Domicilio Contractual</h1>
  <p>Las diferencias surgidas se procurarán resolver en primera instancia mediante arreglo directo en un término de quince (15) días hábiles. De persistir el desacuerdo, LAS PARTES acudirán a un Centro de Conciliación legalmente autorizado en Sincelejo, Sucre. Se fija como domicilio contractual la ciudad de Sincelejo, Sucre, República de Colombia.</p>

  <p>En constancia de lo acordado, se firma el presente contrato en dos (2) ejemplares de idéntico tenor, en la ciudad de Sincelejo, a los <span class="var-field">[DÍA]</span> días del mes de <span class="var-field">[MES]</span> del año <span class="var-field">[AÑO]</span>.</p>

  <!-- BLOQUE DE FIRMAS -->
  <div class="signature-section">
    <div class="signature-grid">
      <div class="sig-card">
        <strong>POR EL PROVEEDOR (CONTRATISTA):</strong><br><br>
        ___________________________________________<br>
        <strong>JUAN EDUARDO MADRID REQUENA</strong><br>
        Persona Natural Comerciante<br>
        C.C. No. 1102849760 de Sincelejo<br>
        NIT: 1102849760-5 (Sujeto a cotejo con RUT vigente)<br>
        Matrícula Mercantil No. 148131 — C.C. Sincelejo (Sujeta a cotejo)<br>
        OdontoCloud Colombia<br>
        Correo: bienvenido@odontocloudcolombia.com
      </div>
      <div class="sig-card">
        <strong>POR EL CONTRATANTE (LA CLÍNICA):</strong><br><br>
        ___________________________________________<br>
        <strong><span class="var-field">[NOMBRE_REPRESENTANTE_LEGAL]</span></strong><br>
        Representante Legal / Director Médico<br>
        C.C. No. <span class="var-field">[CÉDULA_REPRESENTANTE]</span><br>
        <strong>VALMA DENTAL STUDIO</strong><br>
        NIT: <span class="var-field">[NIT_VALMA_DENTAL_STUDIO]</span><br>
        Código REPS: <span class="var-field">[CÓDIGO_REPS_12_DÍGITOS]</span>
      </div>
    </div>
  </div>

</body>
</html>`;
}

// Generador DOCX Profesional (Calibri/Segoe UI, márgenes 2.5cm, 10.5pt, tablas corporativas)
async function generateDocx() {
  const docxElements = [];

  // Header Table: Logo izquierda, Marca y Subtítulo centro-derecha, Metadatos derecha
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
            width: { size: 14, type: WidthType.PERCENTAGE },
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
            width: { size: 56, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "ODONTOCLOUD COLOMBIA", bold: true, size: 24, color: "0F2942" })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Software de Gestión Odontológica en la Nube", italic: true, size: 18, color: "0D9488", bold: true })
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
                  new TextRun({ text: "Código: CON-01 | Versión: 2026.1\n", bold: true, size: 15, color: "475569" }),
                  new TextRun({ text: "Edición: Octubre 2026\n", size: 15, color: "475569" }),
                  new TextRun({ text: "BORRADOR PARA REVISIÓN Y FIRMA", bold: true, size: 14, color: "1D4ED8" })
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

  // Título Principal
  docxElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({ text: "CONTRATO DE PRESTACIÓN DEL SERVICIO ODONTOCLOUD SaaS", bold: true, size: 28, color: "0F2942" })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "Licenciamiento de Uso de Software Asistencial en la Nube, Alojamiento, Respaldo y Soporte Técnico", italic: true, size: 19, color: "475569" })
      ]
    }),
    new Paragraph({ text: "" }),
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
                  children: [
                    new TextRun({ text: "CLIENTE CONTRATANTE: ", bold: true, size: 18, color: "0F2942" }),
                    new TextRun({ text: "VALMA DENTAL STUDIO", bold: true, size: 18, color: "0D9488" }),
                    new TextRun({ text: " | NIT: [NIT_VALMA_DENTAL_STUDIO] | REPS: [CÓDIGO_REPS_12_DÍGITOS]", size: 17, color: "334155" })
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

  // Helper para párrafos
  const p = (text, isJustified = true) => new Paragraph({
    alignment: isJustified ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    spacing: { after: 100, line: 276 },
    children: [new TextRun({ text, size: 21, color: "1E293B" })]
  });

  // Helper para títulos con keepWithNext
  const h = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepWithNext: true,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, size: 23, color: "0F2942" })]
  });

  // Helper para callout
  const callout = (title, text) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: "FFFBEB" },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: title, bold: true, size: 18, color: "B45309" })]
              }),
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [new TextRun({ text, italic: true, size: 18, color: "78350F" })]
              })
            ]
          })
        ]
      })
    ]
  });

  // 1. COMPARECIENTES
  docxElements.push(
    h("1. Comparecientes e Identificación de las Partes"),
    p("Entre los suscritos a saber:"),
    p("DE UNA PARTE: JUAN EDUARDO MADRID REQUENA, mayor de edad, domiciliado y residente en la ciudad de Sincelejo, departamento de Sucre, identificado con Cédula de Ciudadanía No. 1102849760 de Sincelejo, titular del Número de Identificación Tributaria NIT 1102849760-5 (sujeto a cotejo con RUT vigente expedido por la DIAN), en su condición de Persona Natural Comerciante con Matrícula Mercantil No. 148131 de la Cámara de Comercio de Sincelejo (activa 2026, sujeta a cotejo con certificado mercantil vigente), con actividad económica principal CIIU 6312 (Portales web y servicios de procesamiento de datos), actuando en nombre propio y en calidad de titular y propietario exclusivo de la plataforma tecnológica OdontoCloud Colombia (en adelante, EL PROVEEDOR o EL CONTRATISTA), con sitio web oficial https://odontocloudcolombia.com y correo oficial de notificaciones bienvenido@odontocloudcolombia.com."),
    p("DE OTRA PARTE: VALMA DENTAL STUDIO [O RAZÓN SOCIAL COMPLETA DE LA IPS / CONSULTORIO], entidad prestadora de servicios de salud legalmente constituida, identificada con el NIT No. [NIT_VALMA_DENTAL_STUDIO], con domicilio principal en la ciudad de [CIUDAD_DOMICILIO], departamento de [DEPARTAMENTO], dirección de sede [DIRECCIÓN_SEDE_PRINCIPAL], con Código de Habilitación ante el Registro Especial de Prestadores de Servicios de Salud (REPS) No. [CÓDIGO_REPS_12_DÍGITOS], representada legalmente en este acto por [NOMBRE_DEL_REPRESENTANTE_LEGAL], mayor de edad, identificado(a) con Cédula de Ciudadanía No. [CÉDULA_REPRESENTANTE], con correo oficial para notificaciones [CORREO_NOTIFICACIONES_CLÍNICA] y teléfono de contacto [TELÉFONO_CLÍNICA] (en adelante, EL CONTRATANTE o LA CLÍNICA)."),
    p("Quienes en adelante se denominarán conjuntamente como LAS PARTES, han convenido celebrar el presente CONTRATO DE PRESTACIÓN DE SERVICIOS DE SOFTWARE EN LA NUBE (SaaS), el cual se regirá por la legislación comercial colombiana, las normas de protección de datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013), las disposiciones sanitarias sobre historia clínica (Resolución 1995 de 1999 y Resolución 839 de 2017 de MinSalud) y las siguientes cláusulas:")
  );

  // CLÁUSULA PRIMERA
  docxElements.push(
    h("Cláusula Primera — Objeto del Contrato"),
    p("EL PROVEEDOR se obliga a conceder a favor de LA CLÍNICA, bajo la modalidad de Software as a Service (SaaS), una licencia de uso no exclusiva, no sublicenciable, revocable e intransferible para el acceso a través de internet a la plataforma informática asistencial OdontoCloud Colombia (Versión 2026.1, Release 8.2), comprendiendo los servicios de alojamiento en nube (hosting), gestión de base de datos relacional multi-inquilino aislada lógicamente, rutinas periódicas de respaldo lógico de datos y servicio de mesa de ayuda técnica.")
  );

  // CLÁUSULA SEGUNDA — TABLA DE MÓDULOS
  docxElements.push(
    h("Cláusula Segunda — Selección y Estado Individual de Módulos Contratados"),
    p("El alcance operativo de la licencia conferida dependerá de los módulos funcionales habilitados específicamente para VALMA Dental Studio al momento de la suscripción, según la siguiente matriz de selección individual:")
  );

  const modulosRows = [
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({ shading: { type: ShadingType.CLEAR, fill: "0F2942" }, children: [new Paragraph({ children: [new TextRun({ text: "Módulo Funcional", bold: true, size: 17, color: "FFFFFF" })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, fill: "0F2942" }, children: [new Paragraph({ children: [new TextRun({ text: "Descripción Operativa y Alcance", bold: true, size: 17, color: "FFFFFF" })] })] }),
        new TableCell({ shading: { type: ShadingType.CLEAR, fill: "0F2942" }, children: [new Paragraph({ children: [new TextRun({ text: "Estado para la Clínica", bold: true, size: 17, color: "FFFFFF" })] })] })
      ]
    })
  ];

  const modulosData = [
    ["1. Gestión de Pacientes y Filiación SGSSS", "Registro sociodemográfico, régimen SGSSS, antecedentes estomatológicos y médicos, alertas de salud.", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["2. Agenda Odontológica y Turnos", "Programación de citas por profesional, sillón y sede; control de estados de cita; recordatorios.", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["3. Historia Clínica Odontológica (HCE)", "Anamnesis estomatológica, examen clínico estomatológico integral, diagnósticos en CIE-10.", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["4. Odontograma Digital Interactivo", "Odontograma inicial y evolutivo en nomenclaturas FDI y Universal; registro visual de patologías.", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["5. Evoluciones Clínicas Inmutables", "Foliación secuencial mediante clock_timestamp() UTC y soporte de adendas normativas (Res. 1995/1999).", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["6. Consentimientos Informados Digitales", "Plantillas procedimentales, captura de firma táctil vectorial del paciente o acudiente y archivo PDF inmutable.", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["7. Presupuestos y Planes de Tratamiento", "Estructuración por fases de tratamiento, tarifas institucionales y procedimientos en estándar CUPS.", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["8. Facturación Electrónica en Salud (FEV)", "Emisión sincrónica con validación previa DIAN mediante conector Factus, con código CUFE y QR.", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["9. RIPS Formato JSON (Res. 2275/2023)", "Generación de estructuras JSON de usuarios, consultas y procedimientos; suite de validación pre-radicación.", "[X] Contratado | [ ] No contratado\n[ ] En pruebas | [ ] Pendiente"],
    ["10. Interoperabilidad IHCE (Res. 1888/2025)", "Conector base REST para resúmenes de atención. Nota: En fase de pruebas/sandbox; no homologado en producción.", "[ ] Contratado | [ ] No contratado\n[X] En pruebas | [ ] Pendiente"]
  ];

  for (const [mName, mDesc, mState] of modulosData) {
    modulosRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: mName, bold: true, size: 16, color: "0F2942" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: mDesc, size: 16, color: "1E293B" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: mState, size: 15, color: "0D9488", bold: true })] })] })
        ]
      })
    );
  }

  docxElements.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: modulosRows }));
  docxElements.push(new Paragraph({ text: "" }));

  // CLÁUSULA TERCERA
  docxElements.push(
    h("Cláusula Tercera — Plan Comercial, Canon Periódico y Condiciones de Pago"),
    p("1. Plan Seleccionado: LA CLÍNICA contrata el plan [PLAN: PROFESIONAL / BÁSICO / IPS MULTISEDE], el cual autoriza hasta [NÚMERO_DE_USUARIOS] usuarios profesionales/asistenciales concurrentes activos en el sistema."),
    p("2. Canon Periódico: Por los servicios objeto del contrato, LA CLÍNICA pagará a EL PROVEEDOR la suma de $[VALOR_EN_NÚMEROS] COP ([VALOR_EN_LETRAS] PESOS MONEDA CORRIENTE), pagaderos de manera [MENSUAL / ANUAL ANTICIPADA]."),
    p("3. Plazo y Forma de Pago: El canon deberá ser cancelado dentro de los primeros [CINCO (5)] días hábiles siguientes al inicio de cada periodo facturado, mediante transferencia o consignación bancaria a la cuenta corriente/ahorros No. [NÚMERO_DE_CUENTA] del Banco [BANCO] a nombre de JUAN EDUARDO MADRID REQUENA."),
    p("4. Reajuste Anual: En caso de prórroga automática, el canon se reajustará anualmente a partir del primer día del periodo prorrogado conforme a la variación acumulada del IPC del año anterior certificado por el DANE o el porcentaje acordado por LAS PARTES.")
  );

  // CLÁUSULA CUARTA
  docxElements.push(
    h("Cláusula Cuarta — Vigencia, Duración y Prórrogas"),
    p("El presente contrato tendrá una vigencia inicial de [UN (1) AÑO], contado a partir de la firma del Acta de Entrega, Configuración y Puesta en Marcha (CON-03). Se prorrogará automáticamente por periodos iguales sucesivos, a menos que cualquiera de LAS PARTES manifieste por escrito su voluntad de no prorrogarlo con una antelación no inferior a treinta (30) días calendario a la fecha de vencimiento.")
  );

  // CLÁUSULA QUINTA
  docxElements.push(
    h("Cláusula Quinta — Delimitación de Responsabilidades Técnicas de EL PROVEEDOR"),
    p("EL PROVEEDOR asume exclusivamente obligaciones de medio técnico respecto al funcionamiento del software y la infraestructura provista:"),
    p("• Compromiso Objetivo de Disponibilidad (SLA): EL PROVEEDOR procurará mantener un nivel de disponibilidad técnica del 99.5% mensual, entendido como un objetivo operacional de mejores esfuerzos técnicos y no como una garantía absoluta de ininterrupción. Se excluyen del cómputo: a) Ventanas nocturnas de mantenimiento preventivo notificadas; b) Fallas de conectividad/ISP o equipos de LA CLÍNICA; c) Interrupciones originadas en el proveedor de alojamiento VPS o centros de datos; d) Ataques masivos de denegación de servicio (DDoS) o fuerza mayor."),
    p("• Política Verificable de Copias de Seguridad: Mantener una rutina de respaldos lógicos periódicos de la base de datos relacional mediante utilidades de volcado transaccional (pg_dump comprimido .Fc o instantáneas a nivel de contenedor), almacenados en el servidor host asignado a OdontoCloud para contingencias de la plataforma. EL PROVEEDOR no asume almacenamiento redundante externo ni cifrado no comprobado. LA CLÍNICA mantiene el deber de realizar periódicamente sus propias descargas institucionales."),
    p("• Aislamiento Lógico Multi-Inquilino: Segregación estricta de datos mediante políticas lógicas de base de datos (Row Level Security - RLS), asegurando que ningún usuario externo acceda a la información de LA CLÍNICA."),
    p("• Soporte Técnico Operativo: Asistencia técnica mediante Asistente IA 24/7, línea de WhatsApp de ingeniería y correo oficial bienvenido@odontocloudcolombia.com."),
    p("• Notificación de Incidentes: Notificar a LA CLÍNICA cualquier incidente comprobado que comprometa datos personales sensibles dentro de las veinticuatro (24) horas siguientes a su confirmación (Ley 1581/2012)."),
    p("• Herramientas de Exportación: Mantener habilitadas las funciones de exportación de historias clínicas en formatos estándar (PDF foliado, CSV y JSON) para facilitar la portabilidad de datos.")
  );

  // CLÁUSULA SEXTA
  docxElements.push(
    h("Cláusula Sexta — Delimitación de Responsabilidades Clínicas y Sanitarias de LA CLÍNICA"),
    p("LA CLÍNICA, en su condición indelegable de prestadora de servicios de salud, asume la totalidad de las responsabilidades asistenciales y regulatorias:"),
    p("• Responsabilidad Asistencial Exclusiva: El acto odontológico, diagnósticos, tratamientos, prescripción médica, pertinencia y notas de evolución corresponden exclusivamente a LA CLÍNICA y a sus profesionales tratantes. EL PROVEEDOR actúa estrictamente como proveedor de software y no audita el criterio médico."),
    p("• Habilitación Sanitaria ante el REPS: Obtener y mantener vigentes las condiciones de habilitación de servicios de salud ante el REPS conforme a la Resolución 3100 de 2019 de MinSalud. El software no constituye habilitación ni exime a LA CLÍNICA de sus obligaciones regulatorias."),
    p("• Custodia Estricta de Credenciales: Asignar usuarios individuales con clave personal e intransferible a cada profesional. Queda prohibido el uso compartido de contraseñas."),
    p("• Veracidad de la Información: Garantizar la exactitud y veracidad de todos los datos clínicos incorporados en la plataforma."),
    p("• Infraestructura Cliente: Disponer de terminales compatibles y conexión a internet estable."),
    p("• Pago Oportuno: Cancelar puntualmente el canon pactado en la Cláusula Tercera.")
  );

  // CLÁUSULA SÉPTIMA
  docxElements.push(
    h("Cláusula Séptima — Suspensión por Mora y Procedimiento Previo de Salvaguarda"),
    callout("⚠️ Notificación Previa y Salvaguarda ante Mora", "En caso de mora superior a treinta (30) días calendario en el pago del canon, EL PROVEEDOR notificará por escrito a LA CLÍNICA otorgando un plazo perentorio de quince (15) días calendario para regularizar la obligación o para que LA CLÍNICA, con anterioridad a cualquier corte del servicio, coordine y descargue sus historias clínicas activas mediante las herramientas de exportación disponibles. Vencido este plazo sin subsanación ni acuerdo, EL PROVEEDOR podrá suspender el acceso a la plataforma, dejando constancia de la notificación previa efectuada a la IPS.")
  );

  // CLÁUSULA OCTAVA
  docxElements.push(
    h("Cláusula Octava — Custodia Sanitaria, Exportación Verificable y Tratamiento Posterior"),
    p("1. Custodia Legal a Cargo de la IPS: Conforme al artículo 3 de la Resolución 839 de 2017 de MinSalud, la custodia y conservación legal de las historias clínicas por el término de quince (15) años corresponde de manera privativa e indelegable a LA CLÍNICA. OdontoCloud actúa exclusivamente como herramienta transitoria de archivo mientras el contrato esté vigente."),
    p("2. Plazo de Gracia para Exportación: A la terminación del contrato, LA CLÍNICA dispondrá de un plazo de sesenta (60) días calendario para descargar y respaldar en sus propios medios la totalidad de las historias clínicas, odontogramas, evoluciones, consentimientos y registros contables en PDF foliado, JSON y CSV."),
    p("3. Entrega Documentada y Fin del Alojamiento: Concluida la descarga o vencido el plazo, LAS PARTES suscribirán un Acta de Cierre y Entrega Documentada, certificando el recibo o descarga de los datos bajo la custodia de la IPS."),
    p("4. Prohibición de Borrado Automático y Salvaguarda Sanitaria: EL PROVEEDOR no asume custodia pasiva indefinida ni gratuita de las bases de datos de LA CLÍNICA, pero bajo ninguna circunstancia ejecutará eliminación automática, unilateral o desatendida de la información asistencial. Si vencido el plazo de gracia de sesenta (60) días LA CLÍNICA no ha culminado la exportación ni suscrito el acta de cierre, EL PROVEEDOR remitirá una notificación formal certificada con un preaviso no inferior a treinta (30) días calendario para: a) Coordinar la entrega formal de los archivos de volcado y respaldo en medios seguros; o b) Acordar un esquema transitorio de custodia pasiva tarifada conforme a las directrices de la Resolución 839 de 2017 del Ministerio de Salud y Protección Social. Únicamente tras agotarse este procedimiento documentado y constar la salvaguarda de los datos por la IPS, se procederá a la desinstalación técnica del entorno operativo.")
  );

  // CLÁUSULA NOVENA
  docxElements.push(
    h("Cláusula Novena — Protección de Datos Personales y Acuerdo de Encargo (Anexo DOC-06)"),
    p("En el marco de la Ley 1581 de 2012, LA CLÍNICA actúa como Responsable del Tratamiento y EL PROVEEDOR como Encargado del Tratamiento. Se incorpora como parte integral el ANEXO NO. 1: ACUERDO DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES (DOC-06), sujeto a revisión y firma bilateral, detallando instrucciones, confidencialidad, autorización de subencargados de infraestructura cloud/VPS, medidas de seguridad aplicadas y protocolo de devolución o disposición de información al finalizar el contrato.")
  );

  // CLÁUSULA DÉCIMA
  docxElements.push(
    h("Cláusula Décima — Propiedad Intelectual y Titularidad de la Información"),
    p("El software, código fuente, modelos de datos, logotipos y documentación técnica de OdontoCloud son de propiedad exclusiva de JUAN EDUARDO MADRID REQUENA. LA CLÍNICA no adquiere derechos de autor sobre el sistema. Por su parte, la información clínica, fichas de pacientes y diagnósticos son de propiedad de los pacientes bajo la custodia legal indelegable de LA CLÍNICA.")
  );

  // CLÁUSULA UNDÉCIMA Y DUODÉCIMA
  docxElements.push(
    h("Cláusula Undécima — Causales de Terminación"),
    p("El presente contrato terminará por: a) Mutuo acuerdo escrito; b) Vencimiento del plazo o prórrogas mediando preaviso de treinta (30) días; c) Incumplimiento grave no subsanado en quince (15) días; d) Liquidación o cancelación de personería o REPS de LA CLÍNICA; e) Fuerza mayor debidamente acreditada."),
    h("Cláusula Duodécima — Solución de Controversias y Domicilio Contractual"),
    p("Las diferencias surgidas se procurarán resolver en primera instancia mediante arreglo directo en un término de quince (15) días hábiles. De persistir el desacuerdo, LAS PARTES acudirán a un Centro de Conciliación legalmente autorizado en Sincelejo, Sucre. Se fija como domicilio contractual la ciudad de Sincelejo, Sucre, República de Colombia."),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      keepWithNext: true,
      spacing: { after: 140, line: 276 },
      children: [new TextRun({ text: "En constancia de lo acordado, se firma el presente contrato en dos (2) ejemplares de idéntico tenor, en la ciudad de Sincelejo, a los [DÍA] días del mes de [MES] del año [AÑO].", size: 21, color: "1E293B" })]
    })
  );

  // BLOQUE DE FIRMAS CON KEEPWITHNEXT Y CANTSPLIT
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
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
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "0F2942" } },
            children: [
              new Paragraph({
                spacing: { before: 80, after: 40 },
                children: [new TextRun({ text: "POR EL PROVEEDOR (CONTRATISTA):", bold: true, size: 16, color: "0F2942" })]
              }),
              new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "JUAN EDUARDO MADRID REQUENA", bold: true, size: 17, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: "Persona Natural Comerciante\nC.C. No. 1102849760 de Sincelejo\nNIT: 1102849760-5 (Sujeto a cotejo con RUT)\nMatrícula Mercantil 148131 (C.C. Sincelejo)\nOdontoCloud Colombia\nCorreo: bienvenido@odontocloudcolombia.com", size: 15, color: "475569" })] })
            ]
          }),
          new TableCell({
            width: { size: 4, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: "" })]
          }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "0F2942" } },
            children: [
              new Paragraph({
                spacing: { before: 80, after: 40 },
                children: [new TextRun({ text: "POR EL CONTRATANTE (LA CLÍNICA):", bold: true, size: 16, color: "0F2942" })]
              }),
              new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "[NOMBRE_REPRESENTANTE_LEGAL]", bold: true, size: 17, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: "Representante Legal / Director Médico\nC.C. No. [CÉDULA_REPRESENTANTE]\nVALMA DENTAL STUDIO\nNIT: [NIT_VALMA_DENTAL_STUDIO]\nCódigo REPS: [CÓDIGO_REPS_12_DÍGITOS]", size: 15, color: "475569" })] })
            ]
          })
        ]
      })
    ]
  });

  docxElements.push(signatureTable);

  const doc = new Document({
    creator: "OdontoCloud Colombia",
    title: "CON-01 — Contrato SaaS — VALMA Dental Studio",
    description: "Contrato de Prestación del Servicio OdontoCloud SaaS",
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
                new TextRun({ text: "OdontoCloud Colombia | CON-01 — Versión 2026.1", bold: true, size: 16, color: "0D9488" }),
                new TextRun({ text: "  •  Cliente: VALMA Dental Studio", size: 15, color: "64748B" })
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
                            new TextRun({ text: "CON-01 Contrato SaaS | OdontoCloud Colombia — Borrador para Revisión y Firma", size: 14, color: "64748B" })
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

async function buildAll() {
  console.log("Compilando versión profesional de CON-01 para VALMA Dental Studio...");

  // 1. Generar DOCX
  const docxBuffer = await generateDocx();
  const docxPath = path.join(DOCX_OUT_DIR, 'CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.docx');
  fs.writeFileSync(docxPath, docxBuffer);
  console.log("✓ DOCX generado exitosamente:", docxPath);

  // 2. Generar PDF con Playwright
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const html = generateHtml();
  await page.setContent(html, { waitUntil: 'load' });

  const pdfPath = path.join(PDF_OUT_DIR, 'CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '22mm',
      bottom: '20mm',
      left: '22mm'
    }
  });
  console.log("✓ PDF generado exitosamente:", pdfPath);

  // 3. Capturar imágenes de la primera y última página para el informe visual
  const screenshotsDir = path.resolve('documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026/capturas');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  // Captura de la primera página del documento HTML
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const p1Shot = path.join(screenshotsDir, 'CON-01_Pagina_1.png');
  await page.screenshot({ path: p1Shot, clip: { x: 0, y: 0, width: 900, height: 1200 } });
  console.log("✓ Captura Página 1:", p1Shot);

  // Captura de la última página (scroll al final para firmas)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const pLastShot = path.join(screenshotsDir, 'CON-01_Ultima_Pagina_Firmas.png');
  await page.screenshot({ path: pLastShot, fullPage: false });
  console.log("✓ Captura Última Página (Firmas):", pLastShot);

  await browser.close();
}

buildAll().catch(err => {
  console.error("Error en buildAll:", err);
  process.exit(1);
});
