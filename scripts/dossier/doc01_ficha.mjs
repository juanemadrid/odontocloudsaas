export const doc01 = {
  code: 'DOC-01',
  title: 'Ficha Técnica Institucional de OdontoCloud',
  subtitle: 'Especificaciones Técnicas, Infraestructura, Requerimientos y Alcance Funcional para Prestadores de Salud',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-01-Ficha-Tecnica-Institucional-OdontoCloud',
  elements: [
    {
      type: 'h1',
      text: '1. Resumen Ejecutivo y Objeto de la Ficha Técnica'
    },
    {
      type: 'p',
      text: 'La presente Ficha Técnica Institucional describe formalmente la naturaleza, especificaciones técnicas, arquitectura funcional, requisitos de infraestructura y alcance operativo de la plataforma tecnológica OdontoCloud Colombia (Versión 2026.1, Release 8.2).'
    },
    {
      type: 'p',
      text: 'OdontoCloud es una solución integral especializada en la gestión clínica, asistencial, administrativa y financiera de consultorios odontológicos independientes e Instituciones Prestadoras de Servicios de Salud (IPS) odontológicas en la República de Colombia. El sistema opera bajo la modalidad de Software como Servicio (SaaS) con almacenamiento en la nube, aislamiento criptográfico multi-inquilino mediante Row Level Security (RLS) y observancia de los lineamientos de interoperabilidad y seguridad vigentes en el país.'
    },
    {
      type: 'callout',
      style: 'legal',
      title: '🏛️ Claridad Regulatoria: Marco Normativo de Habilitación en Salud (2026)',
      text: 'Sobre la Resolución 1732 de 2026 y la vigencia de la Resolución 3100 de 2019: El Ministerio de Salud y Protección Social expidió la Resolución 1732 de agosto de 2026 buscando actualizar el Manual de Inscripción de Prestadores. No obstante, mediante la Resolución 2080 de septiembre de 2026, el propio Ministerio revocó en su totalidad la Resolución 1732 de 2026. Por consiguiente, el marco legal vinculante y plenamente vigente para los procesos de auditoría y habilitación sanitaria continúa siendo la Resolución 3100 de 2019 y sus modificaciones (Resolución 544 de 2023), junto con la Resolución 1995 de 1999 (Historia Clínica), Resolución 839 de 2017 (Custodia y Retención Documental), Ley 2015 de 2020 y Resolución 1888 de 2025 (Interoperabilidad IHCE).'
    },
    {
      type: 'h1',
      text: '2. Tipología de Prestadores y Modalidades de Prestación'
    },
    {
      type: 'p',
      text: 'OdontoCloud ha sido diseñado para ajustarse a las distintas complejidades contempladas en el Sistema Obligatorio de Garantía de Calidad en Salud (SOGCS):'
    },
    {
      type: 'table',
      headers: [
        { text: 'Tipología de Prestador', width: '25%' },
        { text: 'Alcance Operativo en OdontoCloud', width: '40%' },
        { text: 'Exigencias de Habilitación Aplicables', width: '35%' }
      ],
      rows: [
        [
          'Profesional Independiente (Consultorio Presencial)',
          'Gestión mono-sede, agenda de citas, historia clínica odontológica individual, odontograma interactivo, consentimientos informados digitales, facturación electrónica y RIPS JSON.',
          'Estándar de Historia Clínica y Registros Asistenciales (Res. 3100/2019). Cuenta con copias de seguridad remotas diarias y contingencia física documentada.'
        ],
        [
          'Institución Prestadora de Salud (IPS Odontológica)',
          'Gestión multi-sede, asignación de sillones odontológicos, multi-profesional, roles jerarquizados (Dirección Médica, Auditoría, Caja, Recepción), consecutivos independientes y reportes agregados.',
          'Cumplimiento integral de estándares de habilitación. Protocolo de contingencia formal, trazabilidad no repudiable, auditoría y comité de historias clínicas.'
        ],
        [
          'Modalidad Telemedicina (Teleorientación / Teleexperticia)',
          'Interacción clínica remota, registro de teleconcepto, adjuntos radiográficos para interconsulta, consentimiento para telemedicina bajo Res. 2654 de 2019.',
          'Resolución 2654 de 2019 y estándar de procesos prioritarios en telemedicina. Conexión segura cifrada en tránsito (TLS 1.3).'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Requerimientos Técnicos de Infraestructura Cliente'
    },
    {
      type: 'p',
      text: 'Al operar 100% como arquitectura Web Progresiva (PWA) basada en la nube, OdontoCloud elimina la necesidad de servidores locales costosos en las clínicas. Los requerimientos mínimos y óptimos en las terminales cliente son:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Componente', width: '25%' },
        { text: 'Requisito Mínimo Recomendado', width: '40%' },
        { text: 'Requisito Óptimo para Alta Carga', width: '35%' }
      ],
      rows: [
        [
          'Navegador Web',
          'Google Chrome 110+, Microsoft Edge 110+, Mozilla Firefox 115+, Safari 16+',
          'Google Chrome o Microsoft Edge actualizados a la última versión estable'
        ],
        [
          'Memoria RAM',
          '4 GB de memoria física disponible',
          '8 GB o superior para multitarea fluida con visor radiográfico'
        ],
        [
          'Pantalla y Resolución',
          '1366 x 768 píxeles (portátiles y monitores estándar)',
          '1920 x 1080 (Full HD) para visualización simultánea de odontograma y evolución'
        ],
        [
          'Conectividad a Internet',
          'Banda ancha 5 Mbps de bajada / 2 Mbps de subida por sillón activo',
          'Fibra óptica 20 Mbps o superior con respaldo celular 4G/5G'
        ],
        [
          'Dispositivos de Entrada',
          'Teclado, mouse o pantalla táctil (tableta) para consentimientos',
          'Tableta digitalizadora o iPad para captura de firma manuscrita de pacientes'
        ]
      ]
    },
    {
      type: 'h1',
      text: '4. Módulos Funcionales del Sistema'
    },
    {
      type: 'list',
      items: [
        'Módulo de Pacientes: Identificación inequívoca, datos demográficos obligatorios según Res. 1995/1999, aseguradora, contacto de emergencia y acudiente.',
        'Módulo de Agenda Odontológica: Vistas por día, semana y mes, asignación a profesionales y sillones, control de estados de cita y prevención de solapamientos.',
        'Módulo de Historia Clínica Odontológica: Anamnesis, antecedentes médicos y estomatológicos, examen de articulación temporomandibular (ATM), tejidos blandos y periodonto.',
        'Odontograma Digital Interactivo: Nomenclatura FDI y Universal, registro gráfico por cara de cada pieza dental, histórico de evoluciones y cálculo automático de índices COP-D / CEO-D.',
        'Evoluciones Clínicas y Cierre Inmutable: Registro cronológico simultáneo a la atención, diagnóstico CIE-10, procedimientos CUPS, cierre con clave de doctor (Firma Electrónica Confiable Dec. 2364/2012) y bloqueo RLS en base de datos.',
        'Adendas y Notas Aclaratorias: Tabla encadenada evolution_addenda que documenta aclaraciones sin alterar el registro clínico original (Res. 1995/1999).',
        'Consentimientos Informados Digitales: Catálogo de formatos por especialidad odontológica y captura biométrica de firma con trazo en pantalla táctil.',
        'Facturación Electrónica DIAN en Salud (FEV): Integración nativa con pasarela Factus para emisión sincrónica de facturas con CUFE y código QR.',
        'Generador de RIPS JSON (Resolución 2275 de 2023): Validaciones automáticas de consistencia clínica-financiera para el Mecanismo Único de Validación (MUV).',
        'Interoperabilidad IHCE MinSalud (Resolución 1888 de 2025): Arquitectura Transactional Outbox, autenticación OAuth2 Microsoft Entra ID en Sandbox Preproducción y empaquetado HL7 FHIR R4 Bundle RDA.'
      ]
    },
    {
      type: 'h1',
      text: '5. Garantías de Seguridad, Confidencialidad y Soporte'
    },
    {
      type: 'p',
      text: 'La infraestructura de OdontoCloud opera sobre servidores VPS propios con orquestación en contenedores Docker y motor de base de datos PostgreSQL. Toda comunicación viaja cifrada bajo protocolo TLS 1.3 y los secretos de integración de las clínicas se almacenan cifrados con algoritmo simétrico AES-256-GCM. El servicio incluye copias de seguridad diarias automatizadas, canales de soporte técnico y mantenimiento en ventanas no asistenciales.'
    }
  ]
};
