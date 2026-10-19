export const doc09 = {
  code: 'DOC-09',
  title: 'Documento de Integraciones (DIAN, Factus, RIPS e IHCE)',
  subtitle: 'Especificaciones de Pasarelas Fiscales, RIPS JSON y Estado Real de Interoperabilidad con MinSalud',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-09-Integraciones-DIAN-Factus-RIPS-IHCE',
  elements: [
    {
      type: 'h1',
      text: '1. Arquitectura General del Ecosistema de Integraciones'
    },
    {
      type: 'p',
      text: 'OdontoCloud Colombia ha sido diseñado como un núcleo interoperable que conecta la práctica clínica diaria con los tres pilares de reporte e interoperabilidad obligatorios en la República de Colombia: 1. Facturación Electrónica de Venta en Salud ante la DIAN, 2. Registro Individual de Prestación de Servicios de Salud (RIPS JSON) conforme a la Resolución 2275 de 2023, y 3. El Mecanismo de Interoperabilidad de la Historia Clínica Electrónica (IHCE) del Ministerio de Salud y Protección Social (Resolución 1888 de 2025).'
    },
    {
      type: 'h1',
      text: '2. Integración 1: Facturación Electrónica en Salud con la DIAN (Factus)'
    },
    {
      type: 'p',
      text: 'La emisión de facturas electrónicas de venta (FEV) en el sector salud se realiza de forma sincrónica a través del proveedor tecnológico autorizado Factus:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Componente Tributario', width: '30%' },
        { text: 'Especificación Técnica', width: '45%' },
        { text: 'Estado de Verificación', width: '25%' }
      ],
      rows: [
        [
          'Conexión API REST',
          'Autenticación vía Bearer Token con cifrado TLS 1.3 y payload JSON estructurado.',
          'Comprobada (Estado 1)'
        ],
        [
          'Validación Previa DIAN',
          'Emisión sincrónica con obtención inmediata del Código Único de Facturación Electrónica (CUFE) y QR.',
          'Comprobada (Estado 1)'
        ],
        [
          'Campos Específicos del Sector Salud',
          'Inclusión de campos del sector salud (código prestador, tipo de usuario, modalidad de pago, copagos).',
          'Comprobada (Estado 1)'
        ],
        [
          'Representación Gráfica (PDF)',
          'Plantilla adaptada a odontología con desglose de procedimientos CUPS y conceptos tributarios.',
          'Comprobada (Estado 1)'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Integración 2: RIPS como Soporte de FEV (Resolución 2275 de 2023)'
    },
    {
      type: 'p',
      text: 'OdontoCloud incluye el motor de transformación y validación de RIPS en estructura JSON conforme a los anexos técnicos de la Resolución 2275 de 2023:'
    },
    {
      type: 'list',
      items: [
        'Estructura JSON Estandarizada: Genera los objetos JSON de Usuarios, Consultas (código de consulta, finalidad, causa externa, diagnóstico principal y relacionados CIE-10) y Procedimientos Odontológicos (código CUPS, ámbito de realización, vía de ingreso).',
        'Consistencia FEV-RIPS: Los valores facturados en el módulo de caja coinciden matemáticamente con los valores reportados en cada procedimiento asistencial, evitando glosas por inconsistencia.',
        'Catálogos Oficiales: Validación en tiempo real contra los catálogos nacionales de CIE-10 y CUPS de Odontología integrados en el código de OdontoCloud (evidencia en scripts/test_rips_v003_pure_adapter.mjs).'
      ]
    },
    {
      type: 'h1',
      text: '4. Integración 3: Interoperabilidad IHCE MinSalud (Resolución 1888 de 2025)'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '⚠️ Delimitación Estricta de Etapas de Interoperabilidad ante Auditorías',
      text: 'Para total transparencia ante auditores de habilitación, se declaran con exactitud las etapas técnicas y su estado real verificado:\n1. Autenticación OAuth2 con Microsoft Entra ID: COMPROBADA EN PREPRODUCCIÓN. Se verificó la obtención exitosa de tokens Bearer ante login.microsoftonline.com con credenciales de Sandbox entregadas por MinSalud (HTTP 200 en 290 ms, evidencia en scripts/test-ihce-connectivity.mjs).\n2. Acceso a Pasarela Ministerial (APIM Gateway): EN ETAPA DE PRUEBAS PREPRODUCCIÓN.\n3. Paquete HL7 FHIR R4 (Bundle RDA Document): IMPLEMENTADO Y VALIDADO ESTRUCTURALMENTE (recursos Patient, Encounter, Condition y Procedure conforme al perfil nacional).\n4. Autorización Formal para Producción por MinSalud: EN PROCESO DE HOMOLOGACIÓN MINISTERIAL. Conforme al cronograma de la Resolución 1888 de 2025, ningún software puede operar en producción sin haber completado la fase previa en Sandbox. OdontoCloud se encuentra en dicha fase reglamentaria.'
    },
    {
      type: 'h1',
      text: '5. Arquitectura del Transactional Outbox y Aclaración sobre Datos Sintéticos'
    },
    {
      type: 'p',
      text: 'Para evitar que una indisponibilidad o latencia de los servidores de MinSalud congele la atención médica en el consultorio, OdontoCloud implementa el patrón arquitectónico Transactional Outbox:'
    },
    {
      type: 'ordered_list',
      items: [
        'El odontólogo firma la evolución clínica normalmente en su consultorio.',
        'Un trigger nativo en PostgreSQL (trg_enqueue_closed_evolution_for_ihce) inserta de forma instantánea la atención en la cola public.ihce_outbox_queue con estado "PENDIENTE".',
        'El despachador en segundo plano (Worker) toma el paquete en lote, lo procesa y lo transmite de forma asíncrona hacia la pasarela ministerial.',
        'Al recibir la respuesta de la pasarela ministerial, la atención pasa a estado "ACEPTADO" o "ERROR" para su posterior auditoría.'
      ]
    },
    {
      type: 'callout',
      style: 'warning',
      title: '🚨 Aclaración Expresa sobre Radicados de Ensayo (RDA-COL-2026-89087642)',
      text: 'Se hace constar categóricamente que el identificador RDA-COL-2026-89087642 utilizado en ejemplos demostrativos y pruebas de interfaz corresponde exclusivamente a un DATO SINTÉTICO DE ENSAYO generado en el ambiente de pruebas sandbox preproducción. NO constituye un radicado ministerial oficial ni una certificación de homologación definitiva emitida por el Ministerio de Salud. La autorización de producción se encuentra en trámite reglamentario.'
    }
  ]
};
