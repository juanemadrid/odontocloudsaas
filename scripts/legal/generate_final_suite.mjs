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
  BorderStyle 
} from 'docx';
import { 
  buildDocxDocument, 
  pText, 
  hSection, 
  calloutBox, 
  PROVIDER_META 
} from './final_suite_engine.mjs';

const BASE_DIR = path.resolve('documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026');
const DOCX_DIR = path.join(BASE_DIR, 'docx');
fs.mkdirSync(DOCX_DIR, { recursive: true });

// =========================================================================================
// 1. CERT-01: CERTIFICACIÓN TÉCNICA DEL SOFTWARE ODONTOCLOUD COLOMBIA
// =========================================================================================
export async function buildCert01() {
  const body = [
    hSection("1. Identificación del Proveedor y Titular del Software"),
    pText(`El suscrito ${PROVIDER_META.legalEntity}, mayor de edad, domiciliado en la ciudad de Sincelejo, departamento de Sucre, identificado con Cédula de Ciudadanía No. ${PROVIDER_META.idNumber} de ${PROVIDER_META.idCity}, titular del ${PROVIDER_META.nit}, en su condición de ${PROVIDER_META.personType} con Matrícula Mercantil No. ${PROVIDER_META.matriculaMercantil} de la ${PROVIDER_META.camaraComercio}, con actividad económica principal CIIU ${PROVIDER_META.ciiu}, actuando en nombre propio y en calidad de creador, titular y propietario exclusivo del software OdontoCloud Colombia (con sitio web oficial ${PROVIDER_META.website} y correo oficial ${PROVIDER_META.contactEmail}),`),
    
    hSection("2. CERTIFICA QUE:"),
    pText("La plataforma tecnológica denominada OdontoCloud Colombia (Edición Oficial 2026.1, Release 8.2), desarrollada para la gestión clínica, administrativa y asistencial de consultorios odontológicos e Instituciones Prestadoras de Servicios de Salud (IPS), ha sido estructurada e implementada conforme a los estándares técnicos, de seguridad y principios rectores de la documentación digital sanitaria colombiana, cumpliendo con las siguientes características comprobables:"),
    
    pText("• Autenticidad y Trazabilidad Documental: La plataforma asigna a cada registro asistencial, nota de evolución y diagnóstico odontológico una marca de tiempo inmutable generada a nivel de base de datos con el servidor en tiempo universal coordinado (clock_timestamp() UTC), vinculada de forma indeleble al identificador único y perfil del profesional de la salud tratante que realizó la atención."),
    pText("• Integridad e Inmutabilidad de Historias Clínicas: En estricto cumplimiento de la Resolución 1995 de 1999 y la Resolución 839 de 2017 del Ministerio de Salud y Protección Social, el software garantiza que los registros asistenciales consolidados no pueden ser modificados, sustituidos ni eliminados por ningún usuario del sistema. Cualquier aclaración o corrección posterior se efectúa mediante el mecanismo de notas de adenda fechadas y firmadas secuencialmente, preservando el registro original intacto."),
    pText("• Fiabilidad y Seguridad en la Nube: El sistema opera en arquitectura cloud sobre base de datos relacional PostgreSQL con aislamiento lógico multi-inquilino estricto mediante políticas a nivel de fila (Row Level Security - RLS). La infraestructura implementa rutinas periódicas de respaldo lógico de datos (pg_dump transaccional comprimido .Fc) almacenadas en el servidor host asignado, orientadas a garantizar la continuidad del servicio ante fallos técnicos."),
    pText("• Consentimiento Informado y Firma Electrónica Confiable: Incorpora módulos para la captura de firma electrónica con trazo vectorial del paciente o acudiente en pantalla táctil conforme a los requisitos del Decreto 2364 de 2012, generando documentos en formato PDF inmutable vinculados al folio de la historia clínica."),
    pText("• Facturación y RIPS en Salud: Cuenta con conector verificado para la emisión de Factura Electrónica de Venta en salud (FEV) con código CUFE y QR ante la DIAN mediante Factus, y suite de generación de RIPS en estructura JSON compatible con la Resolución 2275 de 2023 de MinSalud."),

    calloutBox("⚖️ Declaración de Alcance y Delimitación Sanitaria Indelegable", 
      "La presente certificación técnica hace constar exclusivamente las características de diseño, arquitectura, seguridad lógica y funcionamiento del software OdontoCloud Colombia. NO constituye habilitación de servicios de salud ante el Registro Especial de Prestadores de Servicios de Salud (REPS), trámite que conforme a la Resolución 3100 de 2019 de MinSalud corresponde única, privativa e indelegablemente a la institución prestadora contratante.", true),

    pText("Se expide el presente documento a solicitud de las instituciones prestadoras interesadas, en la ciudad de Sincelejo, Sucre, en el mes de Octubre de 2026.")
  ];

  const sigTable = new Table({
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
                children: [new TextRun({ text: "POR EL PROVEEDOR TECNOLÓGICO:", bold: true, size: 16, color: "0F2942" })]
              }),
              new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: PROVIDER_META.legalEntity, bold: true, size: 17, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: `${PROVIDER_META.personType}\nC.C. No. ${PROVIDER_META.idNumber} de Sincelejo\nNIT: 1102849760-5 (Sujeto a cotejo con RUT)\nMatrícula Mercantil 148131 (C.C. Sincelejo)\nOdontoCloud Colombia\nCorreo: ${PROVIDER_META.contactEmail}`, size: 15, color: "475569" })] })
            ]
          }),
          new TableCell({
            width: { size: 4, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: "" })]
          }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "B45309" } },
            children: [
              new Paragraph({
                spacing: { before: 80, after: 40 },
                children: [new TextRun({ text: "DICTAMEN PERICIAL INDEPENDIENTE (COPNIA):", bold: true, size: 16, color: "B45309" })]
              }),
              new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________", size: 16, color: "B45309" })] }),
              new Paragraph({ children: [new TextRun({ text: "[PENDIENTE DE EVALUACIÓN Y FIRMA]", bold: true, size: 16, color: "B45309" })] }),
              new Paragraph({ children: [new TextRun({ text: "Ingeniero de Sistemas Colegiado ante el COPNIA\nMatrícula Profesional No. [DILIGENCIAR MATRÍCULA]\nC.C. No. [DILIGENCIAR CÉDULA]\nCertificado de Vigencia COPNIA: [ADJUNTAR SOPORTE]\nEstado: Dictamen Técnico Pendiente de Inspección", size: 15, color: "78350F" })] })
            ]
          })
        ]
      })
    ]
  });

  const buf = await buildDocxDocument({
    code: "CERT-01",
    title: "CERTIFICACIÓN TÉCNICA DEL SOFTWARE ODONTOCLOUD COLOMBIA",
    subtitle: "Declaración de Cumplimiento Técnico, Autenticidad, Fiabilidad, Integridad y Criterios Sanitarios (Resolución 3100 de 2019 y Ley 594 de 2000)",
    statusBadgeText: "MODELO OFICIAL — PENDIENTE DE FIRMA COPNIA",
    statusColor: "B45309",
    clientBanner: [
      new TextRun({ text: "SOFTWARE CERTIFICADO: ", bold: true, size: 18, color: "0F2942" }),
      new TextRun({ text: "OdontoCloud Colombia (Versión 2026.1, Release 8.2)", bold: true, size: 18, color: "0D9488" }),
      new TextRun({ text: " | Modalidad SaaS en la Nube | Soporte para Habilitación REPS", size: 16, color: "334155" })
    ],
    bodyElements: body,
    signatureTable: sigTable
  });

  const docxPath = path.join(DOCX_DIR, 'CERT-01-Certificacion-Tecnica-Software-OdontoCloud.docx');
  fs.writeFileSync(docxPath, buf);
  console.log("✓ Creado:", docxPath);
}

// =========================================================================================
// 2. PROT-01: PROTOCOLO DE SEGURIDAD DE LA INFORMACIÓN, INFRAESTRUCTURA Y RESPALDO
// =========================================================================================
export async function buildProt01() {
  const body = [
    hSection("1. Objetivo y Alcance del Protocolo"),
    pText("El presente protocolo establece los lineamientos, medidas técnicas, controles organizativos y procedimientos de respaldo aplicados en la plataforma OdontoCloud Colombia para garantizar la confidencialidad, integridad, autenticidad y disponibilidad de la información clínica y administrativa de las instituciones prestadoras de servicios de salud (IPS) y consultorios odontológicos."),

    hSection("2. Arquitectura Tecnológica e Infraestructura Cloud"),
    pText("OdontoCloud opera bajo un modelo de Software as a Service (SaaS) desplegado sobre servidores virtuales privados (VPS) de alto rendimiento con sistema operativo Oracle Linux / Linux empresarial, gestionados mediante contenedores Docker aislados. Los componentes del sistema (frontend web interactivo, backend de microservicios, API REST y base de datos relacional) se ejecutan en redes internas virtuales segmentadas, impidiendo la exposición innecesaria de puertos a internet público."),
    pText("Toda la interacción de usuarios con la plataforma se canaliza a través de un proxy inverso seguro que aplica cifrado obligatorio en tránsito mediante protocolo HTTPS con certificados SSL/TLS 1.3 de última generación y suites criptográficas robustas."),

    hSection("3. Aislamiento Lógico Multi-Inquilino (Multi-Tenant Security)"),
    pText("La segregación de la información entre diferentes clínicas odontológicas se implementa a nivel de motor de base de datos relacional (PostgreSQL) mediante la activación de políticas de seguridad por fila (Row Level Security - RLS)."),
    pText("Cada transacción, consulta o mutación de datos ejecutada por un usuario se valida contra el identificador único institucional (organization_id / tenant_id) derivado de su token de autenticación. Este control criptográfico y relacional garantiza de manera matemática que ningún usuario, odontólogo o administrativo de una clínica pueda tener visibilidad ni acceso a los registros clínicos de otra entidad."),

    hSection("4. Política Verificable de Copias de Seguridad y Recuperación"),
    pText("Para asegurar la resiliencia operativa y la disponibilidad de los datos ante contingencias técnicas, OdontoCloud aplica una política verificable de respaldos:"),
    pText("• Respaldo Lógico Automatizado: Se ejecutan copias de seguridad lógicas periódicas de la base de datos relacional mediante la herramienta de volcado transaccional pg_dump en formato binario comprimido (.Fc) o instantáneas a nivel de contenedor."),
    pText("• Ubicación y Resguardo: Los volcados se almacenan en el sistema de almacenamiento del servidor host asignado a OdontoCloud, en volúmenes protegidos con permisos estrictos de acceso de nivel de superusuario."),
    pText("• Consistencia Transaccional: Las copias capturan el estado exacto de las tablas clínicas, evoluciones, odontogramas y facturación sin interrumpir la operación asistencial en curso."),
    pText("• Prueba de Restauración: Se mantienen procedimientos documentados de restauración de datos a través de utilidades estándar (pg_restore), permitiendo reanudar la operación del servicio en caso de fallo del contenedor."),
    pText("• Deber de Respaldo Local de la IPS: Sin perjuicio de las copias de seguridad de la infraestructura cloud, la clínica contratante tiene el derecho y la obligación de realizar sus propias descargas periódicas de historias clínicas mediante los módulos de exportación del sistema."),

    hSection("5. Controles de Acceso, Autenticación y Credenciales"),
    pText("El acceso a la plataforma se rige por un esquema de control de acceso basado en roles (Role-Based Access Control - RBAC), diferenciando perfiles:"),
    pText("• Administrador de Clínica: Configuración institucional, tarifas, consentimientos y supervisión de usuarios."),
    pText("• Odontólogo / Especialista: Acceso asistencial a agenda, anamnesis, odontograma, evoluciones, adendas y prescripción."),
    pText("• Recepción / Admisiones: Asignación de citas, registro de datos demográficos y facturación, con acceso restringido a la intimidad de la evolución médica."),
    pText("• Responsabilidad del Cliente sobre Credenciales: Las contraseñas de acceso deben ser custodiadas con estricto carácter personal e intransferible por cada usuario. Queda terminantemente prohibido el uso de cuentas compartidas o genéricas. El cliente es responsable de revocar inmediatamente el acceso a funcionarios desvinculados."),

    hSection("6. Trazabilidad, Auditoría y Protocolo de Contingencia Asistencial"),
    pText("El sistema registra de forma automática en bitácoras protegidas cada intento de acceso, modificación de registros clínicos, emisión de facturas y eventos críticos de seguridad. En situaciones de urgencia vital donde se requiera acceso asistencial extraordinario, la plataforma contempla procedimientos de contingencia que registran indeleblemente la justificación médica de la consulta (protocolo Break-Glass)."),

    hSection("7. Gestión de Incidentes de Seguridad y Notificación en 24 Horas"),
    pText("Ante la detección de cualquier evento confirmado que comprometa o amenace la confidencialidad de datos personales sensibles de salud, OdontoCloud activará el protocolo de contención técnica y notificará formalmente al Representante Legal de la IPS afectada dentro de las veinticuatro (24) horas siguientes a su confirmación técnica, conforme a los deberes fijados por la Ley 1581 de 2012.")
  ];

  const sigTable = new Table({
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
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "0F2942" } },
            children: [
              new Paragraph({
                spacing: { before: 80, after: 40 },
                children: [new TextRun({ text: "RESPONSABLE DE SEGURIDAD Y ARQUITECTURA TECNOLÓGICA:", bold: true, size: 16, color: "0F2942" })]
              }),
              new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: PROVIDER_META.legalEntity, bold: true, size: 17, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: `Titular y Desarrollador — ${PROVIDER_META.personType}\nC.C. No. ${PROVIDER_META.idNumber} de Sincelejo | NIT: 1102849760-5\nOdontoCloud Colombia — Sede Sincelejo, Sucre\nCanal Técnico: ${PROVIDER_META.contactEmail}`, size: 15, color: "475569" })] })
            ]
          })
        ]
      })
    ]
  });

  const buf = await buildDocxDocument({
    code: "PROT-01",
    title: "PROTOCOLO DE SEGURIDAD DE LA INFORMACIÓN Y RESPALDO CLOUD",
    subtitle: "Directrices Técnicas de Seguridad Lógica, Cifrado, Respaldos Transaccionales y Continuidad Operativa OdontoCloud SaaS",
    statusBadgeText: "DOCUMENTO TÉCNICO OFICIAL DE SEGURIDAD",
    statusColor: "0D9488",
    bodyElements: body,
    signatureTable: sigTable
  });

  const docxPath = path.join(DOCX_DIR, 'PROT-01-Protocolo-Seguridad-Informacion-Respaldo-Cloud.docx');
  fs.writeFileSync(docxPath, buf);
  console.log("✓ Creado:", docxPath);
}

// =========================================================================================
// 3. TERM-01: TÉRMINOS Y CONDICIONES GENERALES DE USO DEL SERVICIO SAAS
// =========================================================================================
export async function buildTerm01() {
  const body = [
    hSection("1. Definiciones y Alcance Contractual"),
    pText("Los presentes Términos y Condiciones regulan el acceso, licenciamiento de uso y prestación de servicios de software en la nube bajo el modelo Software as a Service (SaaS) a través de la plataforma OdontoCloud Colombia (en adelante, el Servicio o la Plataforma), provista por JUAN EDUARDO MADRID REQUENA (en adelante, EL PROVEEDOR)."),
    pText("El uso de la plataforma por parte de cualquier clínica, consultorio odontológico, profesional independiente o institución prestadora de salud (en adelante, EL CLIENTE o LA IPS) implica el conocimiento, aceptación vinculante y sujeción estricta a estas condiciones generales."),

    hSection("2. Capacidad y Registro de Usuarios"),
    pText("El acceso al Servicio requiere la previa formalización comercial del plan correspondiente. LA IPS designará a los usuarios autorizados (odontólogos, especialistas, recepcionistas y administradores) a quienes se les habilitarán credenciales personales e intransferibles."),
    pText("LA IPS declara bajo la gravedad de juramento que la información suministrada respecto a su personería jurídica, código de habilitación REPS, domicilio y profesionales de la salud vinculados es verídica, vigente y legítima."),

    hSection("3. Licencia de Uso No Exclusiva y Propiedad Intelectual"),
    pText("EL PROVEEDOR concede a LA IPS una licencia temporal de uso, no exclusiva, revocable, no sublicenciable e intransferible para acceder a OdontoCloud a través de internet durante la vigencia del servicio contratado."),
    pText("Todo el software, código fuente, algoritmos, arquitectura técnica, modelos relacionales de datos, diseño de interfaces, marcas comerciales y logotipos son de propiedad exclusiva de JUAN EDUARDO MADRID REQUENA. LA IPS no adquiere derecho alguno de propiedad intelectual sobre el sistema."),
    pText("Por su parte, todos los registros clínicos, datos personales de pacientes, diagnósticos, consentimientos y fichas asistenciales ingresados en la plataforma son de propiedad de los pacientes y están bajo la custodia legal indelegable de LA IPS."),

    hSection("4. Disponibilidad del Servicio y Exclusiones de SLA"),
    pText("EL PROVEEDOR procurará mantener un nivel objetivo de disponibilidad del servicio del 99.5% mensual bajo un estándar de mejores esfuerzos técnicos. No obstante, LAS PARTES reconocen que pueden presentarse contingencias inherentes a las redes de telecomunicaciones."),
    pText("Se excluyen del cálculo de indisponibilidad: a) Ventanas programadas de mantenimiento preventivo y actualización, notificadas preferentemente en horarios nocturnos no asistenciales; b) Fallas en las redes de internet, equipos locales o proveedores de conectividad de LA IPS; c) Cortes o afectaciones imprevistas en la infraestructura del proveedor de hosting o VPS; d) Ataques informáticos masivos de denegación de servicio (DDoS) o eventos de fuerza mayor."),

    hSection("5. Responsabilidad Asistencial y Sanitaria Exclusiva de la IPS"),
    pText("LA IPS reconoce expresamente que OdontoCloud actúa de forma exclusiva como proveedor de una herramienta tecnológica de información."),
    pText("El acto odontológico, los diagnósticos, planes de tratamiento, prescripción de medicamentos, pertinencia clínica, diligenciamiento de notas de evolución y la relación profesional-paciente corresponden de manera privativa, directa e indelegable a los profesionales tratantes y a LA IPS. El software no ejerce la odontología, no formula prescripciones autónomas ni reemplaza el criterio médico."),
    pText("Asimismo, la obtención, registro y mantenimiento de la habilitación sanitaria ante el Registro Especial de Prestadores de Servicios de Salud (REPS) conforme a la Resolución 3100 de 2019 de MinSalud es de competencia exclusiva del prestador de salud."),

    hSection("6. Procedimiento ante Mora y Salvaguarda de la Información"),
    pText("En caso de mora superior a treinta (30) días calendario en el pago de los cánones acordados, EL PROVEEDOR remitirá un requerimiento formal al correo registrado de LA IPS, otorgando un plazo perentorio de quince (15) días calendario para la regularización de la obligación económica o para que la clínica proceda a la descarga y exportación de sus historias clínicas y registros activos a través de los módulos habilitados. Vencido este plazo sin acuerdo, EL PROVEEDOR podrá suspender temporalmente el acceso a la plataforma."),

    hSection("7. Custodia de 15 Años (Res. 839/2017), Exportación y Terminación"),
    pText("• Custodia Privativa de la IPS: Conforme a la Resolución 839 de 2017 de MinSalud, la custodia y conservación legal de las historias clínicas por el término de quince (15) años corresponde de manera privativa e indelegable a LA IPS."),
    pText("• Periodo de Gracia para Descarga: Finalizado el vínculo contractual por cualquier causa, LA IPS dispondrá de un periodo de gracia improrrogable de sesenta (60) días calendario para descargar o exportar la totalidad de sus historias clínicas foliadas en PDF, datos en JSON/CSV y consentimientos digitalizados."),
    pText("• Acta de Cierre y Entrega Documentada: Al término de la descarga, LAS PARTES suscribirán un Acta de Cierre y Entrega Documentada certificando que la información ha sido recibida por LA IPS bajo su custodia."),
    pText("• Fin del Alojamiento: EL PROVEEDOR no asume la custodia pasiva indefinida ni gratuita de las bases de datos de LA IPS, ni efectuará eliminación automática desatendida. Vencido el plazo de gracia sin suscripción del acta ni retiro de datos, se enviará un preaviso final de quince (15) días para acordar custodia transitoria tarifada o proceder al retiro y disposición de los contenedores conforme a la ley."),

    hSection("8. Ley Aplicable y Jurisdicción"),
    pText("Los presentes Términos se rigen e interpretan conforme a las leyes de la República de Colombia. Cualquier diferencia se resolverá en primera instancia mediante arreglo directo y, en su defecto, ante los centros de conciliación autorizados en la ciudad de Sincelejo, Sucre.")
  ];

  const buf = await buildDocxDocument({
    code: "TERM-01",
    title: "TÉRMINOS Y CONDICIONES GENERALES DE USO DEL SERVICIO SAAS",
    subtitle: "Condiciones Generales de Contratación, Licenciamiento, Nivel de Servicio, Régimen de Custodia y Tratamiento Posterior de Datos",
    statusBadgeText: "BORRADOR PARA REVISIÓN Y ADHESIÓN COMERCIAL",
    statusColor: "1D4ED8",
    bodyElements: body
  });

  const docxPath = path.join(DOCX_DIR, 'TERM-01-Terminos-Condiciones-Uso-Servicio-SaaS.docx');
  fs.writeFileSync(docxPath, buf);
  console.log("✓ Creado:", docxPath);
}

// =========================================================================================
// 4. POL-01: POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES Y ACUERDO DE ENCARGO (DPA)
// =========================================================================================
export async function buildPol01() {
  const body = [
    hSection("1. Alcance, Marco Jurídico y Principios Rectores"),
    pText("La presente Política de Tratamiento de Datos Personales y Acuerdo de Encargo regula las operaciones de recolección, almacenamiento, custodia temporal y procesamiento de datos personales llevadas a cabo por JUAN EDUARDO MADRID REQUENA (en adelante, ODONTOCLOUD COLOMBIA o EL ENCARGADO), en cumplimiento estricto de la Ley Estatutaria 1581 de 2012, el Decreto Reglamentario 1377 de 2013 y demás normas que las adicionen o modifiquen."),
    pText("El tratamiento se fundamenta en los principios de legalidad, finalidad, libertad, veracidad, transparencia, acceso restringido, seguridad y confidencialidad."),

    hSection("2. Delimitación de Roles: Responsable vs. Encargado del Tratamiento"),
    pText("LAS PARTES declaran de manera expresa e inequívoca la delimitación jurídica de sus calidades:"),
    pText("• LA CLÍNICA / IPS actúa en calidad de RESPONSABLE DEL TRATAMIENTO respecto a los datos personales y datos sensibles de salud de sus pacientes, usuarios y colaboradores."),
    pText("• ODONTOCLOUD COLOMBIA actúa en calidad de ENCARGADO DEL TRATAMIENTO, procesando y almacenando los datos personales única y exclusivamente por cuenta y bajo las instrucciones de LA CLÍNICA, con el propósito estricto de prestar el servicio de software en la nube."),

    hSection("3. Tratamiento Especial de Datos Sensibles de Salud"),
    pText("Se reconocen como datos sensibles los relativos a la salud, diagnósticos odontológicos, anamnesis, historia clínica, odontograma, imágenes diagnósticas, evolución clínica y firma digital de los pacientes."),
    pText("ODONTOCLOUD COLOMBIA solo procesará datos sensibles de salud cuando: a) LA CLÍNICA cuente con la autorización previa, expresa e informada del titular (paciente o acudiente legal); b) El tratamiento sea necesario para salvaguardar el interés vital del paciente; o c) El tratamiento tenga una finalidad histórica o médica legalmente autorizada."),

    hSection("4. Finalidades Exclusivas del Tratamiento Tecnológico"),
    pText("Los datos personales y sensibles confiados a ODONTOCLOUD COLOMBIA se destinan de manera privativa a:"),
    pText("• Gestión de la historia clínica electrónica y archivo digital odontológico."),
    pText("• Administración de agendas de citas, turnos y recordatorios operativos."),
    pText("• Estructuración y validación de RIPS en formato JSON (Resolución 2275 de 2023)."),
    pText("• Conexión tecnológica para la emisión de Factura Electrónica en Salud con CUFE y QR ante la DIAN."),
    pText("• Ejecución de copias de seguridad de contingencia y recuperación técnica del sistema."),
    pText("Queda terminantemente prohibido a ODONTOCLOUD COLOMBIA vender, ceder, transferir, comercializar o usar los datos de pacientes para fines publicitarios, de perfilamiento no solicitado o de explotación comercial ajena al servicio contratado."),

    hSection("5. Derechos de los Titulares (Derechos ARCO) y Canales de Atención"),
    pText("Los titulares de los datos tienen derecho a conocer, actualizar, rectificar y suprimir sus datos personales, así como a revocar la autorización otorgada, conforme al artículo 8 de la Ley 1581 de 2012."),
    pText("Las solicitudes de pacientes serán canalizadas primariamente a través de LA CLÍNICA como Responsable del Tratamiento. Para solicitudes directas o consultas sobre esta política, se encuentra habilitado el canal oficial: bienvenido@odontocloudcolombia.com."),

    hSection("6. Deberes del Encargado y Autorización de Subencargados"),
    pText("ODONTOCLOUD COLOMBIA se compromete a: a) Tratar la información únicamente bajo instrucciones del Responsable; b) Mantener estricta reserva y confidencialidad; c) Implementar medidas de seguridad lógicas (RLS, cifrado HTTPS/TLS 1.3); d) Notificar cualquier brecha de seguridad dentro de las veinticuatro (24) horas siguientes a su detección."),
    pText("LA CLÍNICA autoriza a ODONTOCLOUD COLOMBIA a utilizar proveedores de infraestructura de nube (servidores virtuales privados / VPS y centros de datos certificados) estrictamente indispensables para la operatividad del sistema, quienes actuarán como subencargados técnicos bajo acuerdos equivalentes de seguridad."),

    hSection("7. Devolución, Exportación y Supresión de Datos al Término del Contrato"),
    pText("Finalizada la prestación del servicio por cualquier causa, LA CLÍNICA contará con sesenta (60) días calendario para descargar o exportar la totalidad de su información en formatos abiertos estándar."),
    pText("Concluida la exportación, LAS PARTES suscribirán un Acta de Cierre y Entrega Documentada. ODONTOCLOUD COLOMBIA no mantendrá copias pasivas indefinidas ni realizará eliminación desatendida sin previa notificación formal de quince (15) días, dando cumplimiento a las disposiciones de la Resolución 839 de 2017 de MinSalud.")
  ];

  const sigTable = new Table({
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
                children: [new TextRun({ text: "POR EL ENCARGADO DEL TRATAMIENTO:", bold: true, size: 16, color: "0F2942" })]
              }),
              new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: PROVIDER_META.legalEntity, bold: true, size: 17, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: `${PROVIDER_META.personType}\nC.C. No. ${PROVIDER_META.idNumber} de Sincelejo\nNIT: 1102849760-5\nOdontoCloud Colombia`, size: 15, color: "475569" })] })
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
                children: [new TextRun({ text: "POR EL RESPONSABLE DEL TRATAMIENTO:", bold: true, size: 16, color: "0F2942" })]
              }),
              new Paragraph({ children: [new TextRun({ text: "\n\n___________________________________________", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "[NOMBRE_REPRESENTANTE_LEGAL]", bold: true, size: 17, color: "0F2942" })] }),
              new Paragraph({ children: [new TextRun({ text: "Representante Legal / Director Médico\nC.C. No. [CÉDULA_REPRESENTANTE]\n[RAZÓN SOCIAL DE LA CLÍNICA / IPS]\nNIT: [NIT_CLINICA]", size: 15, color: "475569" })] })
            ]
          })
        ]
      })
    ]
  });

  const buf = await buildDocxDocument({
    code: "POL-01",
    title: "POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES Y ACUERDO DE ENCARGO (DPA)",
    subtitle: "Manual Integral de Protección de Datos Personales, Tratamiento de Datos Sensibles de Salud y Acuerdo de Encargo de Tratamiento",
    statusBadgeText: "DOCUMENTO CONTRACTUAL SUJETO A FIRMA BILATERAL",
    statusColor: "0D9488",
    bodyElements: body,
    signatureTable: sigTable
  });

  const docxPath = path.join(DOCX_DIR, 'POL-01-Politica-Tratamiento-Datos-Personales-DPA.docx');
  fs.writeFileSync(docxPath, buf);
  console.log("✓ Creado:", docxPath);
}

// Compilador maestro de la suite
async function generateAll() {
  console.log("=== COMPILANDO SUITE INSTITUCIONAL FINAL ODONTOCLOUD 2026 ===\n");
  await buildCert01();
  await buildProt01();
  await buildTerm01();
  await buildPol01();

  // Copiar CON-01 actualizado para tener los 5 documentos en la suite
  const con01Src = path.resolve('documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026/docx/CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.docx');
  const con01Dst = path.join(DOCX_DIR, 'CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.docx');
  fs.copyFileSync(con01Src, con01Dst);
  console.log("✓ Copiado CON-01 a suite final:", con01Dst);
}

generateAll().catch(err => {
  console.error("Error generando suite:", err);
  process.exit(1);
});
