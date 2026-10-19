export const doc12 = {
  code: 'DOC-12',
  title: 'Matriz Técnica de Habilitación para Prestadores de Salud (IPS y Consultorios)',
  subtitle: 'Correlación de Requisitos de la Resolución 3100 de 2019, Evidencias en Software y Acciones del Prestador',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-12-Matriz-Habilitacion-Prestadores',
  elements: [
    {
      type: 'h1',
      text: '1. Alcance de la Matriz de Habilitación para Auditorías'
    },
    {
      type: 'p',
      text: 'La presente Matriz Técnica y Normativa correlaciona las exigencias del Sistema Único de Habilitación en Salud de Colombia frente a los módulos, controles de software y evidencias comprobables de OdontoCloud Colombia.'
    },
    {
      type: 'callout',
      style: 'legal',
      title: '🏛️ Claridad Normativa en Habilitación (2026)',
      text: 'Se hace constar formalmente que mediante la Resolución 2080 de septiembre de 2026, el Ministerio de Salud revocó en su totalidad la Resolución 1732 de 2026. Por ende, la norma de habilitación plenamente vigente es la Resolución 3100 de 2019 y sus modificaciones (Resolución 544 de 2023). La presente matriz evalúa el software frente a los estándares de dicha resolución y la normativa concordante de historia clínica, custodia (Res. 839/2017) e interoperabilidad.'
    },
    {
      type: 'h1',
      text: '2. Matriz Pormenorizada de Cumplimiento Técnico-Asistencial'
    },
    {
      type: 'table',
      headers: [
        { text: 'Norma / Numeral', width: '12%' },
        { text: 'Requisito Sanitario Exigido', width: '23%' },
        { text: 'Responsable', width: '12%' },
        { text: 'Implementación en OdontoCloud & Evidencia Técnica', width: '33%' },
        { text: 'Estado', width: '10%' },
        { text: 'Acción IPS', width: '10%' }
      ],
      rows: [
        [
          'Res. 3100/2019<br>Estándar Historia Clínica',
          'Diligenciamiento de historia en el momento de la atención de forma simultánea.',
          'Prestador Asistencial',
          'Módulo asistencial en tiempo real con fecha/hora UTC automática de servidor. Evidencia: Tabla evoluciones con estampas de tiempo clock_timestamp().',
          '1 - Comprobado',
          'Capacitar doctores en cierre inmediato tras la atención.'
        ],
        [
          'Res. 3100/2019<br>Estándar Historia Clínica',
          'Inalterabilidad: Prohibición de enmendaduras, tachaduras, borrados y sobreescrituras.',
          'Software SaaS',
          'Row Level Security en PostgreSQL y triggers trg_check_evolution_immutable que bloquean UPDATE y DELETE sobre folios cerrados (status = "cerrada"). Evidencia: Test suites automáticas.',
          '1 - Comprobado',
          'Ninguna. Blindado automáticamente por sistema.'
        ],
        [
          'Res. 1995/1999<br>Artículos 7 y 8',
          'Notas aclaratorias y adendas vinculadas cronológicamente sin alterar el texto original.',
          'Software SaaS y Prestador',
          'Módulo de Adendas encadenadas en tabla evolution_addenda con sello de tiempo UTC independiente y firma de doctor.',
          '1 - Comprobado',
          'Instruir al personal médico en uso de adenda ante aclaraciones.'
        ],
        [
          'Res. 3100/2019<br>Estándar Historia Clínica',
          'Identificación y firma no repudiable de quien realiza la atención clínica.',
          'Software SaaS y Prestador',
          'Firma Electrónica Confiable (Decreto 2364/2012) con hash SHA-256 de sesión, clave personal y número de registro o tarjeta profesional.',
          '1 - Comprobado',
          'Exigir registro de firma y tarjeta en perfil de cada odontólogo.'
        ],
        [
          'Res. 3100/2019<br>Estándar Historia Clínica',
          'Consentimientos informados firmados para procedimientos que impliquen riesgos.',
          'Prestador Asistencial',
          'Módulo de consentimientos digitales con captura biométrica vectorial de trazo manuscrito del paciente en pantalla táctil.',
          '1 - Comprobado',
          'Aplicar y firmar consentimientos previo al acto clínico.'
        ],
        [
          'Res. 3100/2019<br>Estándar Historia Clínica',
          'Mecanismos de respaldo y copias de seguridad de las historias clínicas.',
          'Software SaaS',
          'Dumps transaccionales de PostgreSQL con pg_dump -Fc diarios a las 02:00 COT y snapshots Coolify. Metas de diseño técnico: RPO 24h, RTO 4h.',
          '1 - Comprobado',
          'Formalizar acta anual de prueba en Comité de Historias.'
        ],
        [
          'Res. 3100/2019<br>Estándar Procesos Prioritarios',
          'Plan de contingencia asistencial documentado ante fallas del sistema o energía.',
          'Prestador (IPS)',
          'Procedimiento de contingencia documentado en DOC-08 (fichas físicas impresas en consultorio y posterior transcripción en menos de 24 h).',
          '1 - Comprobado',
          'Mantener formatos impresos en recepción y consultorios.'
        ],
        [
          'Ley 1581/2012<br>Artículos 5 y 25',
          'Protección de datos sensibles de salud y Acuerdo de Encargo de Tratamiento (DPA).',
          'Software SaaS y Prestador',
          'Acuerdo formal DPA incorporado en DOC-06. Cifrado simétrico AES-256-GCM en reposo y aislamiento multi-tenant por clínica.',
          '1 - Comprobado',
          'Suscribir DPA institucional con OdontoCloud.'
        ],
        [
          'Res. 2275/2023<br>MUV MinSalud',
          'Generación de RIPS en estructura JSON como soporte obligatorio de la Factura en Salud.',
          'Software SaaS',
          'Motor de validación sintáctica y semántica de RIPS JSON para usuarios, consultas y procedimientos odontológicos (test_rips_v003_pure_adapter.mjs).',
          '1 - Comprobado',
          'Generar y remitir RIPS junto con la FEV a las EPS.'
        ],
        [
          'Res. 1888/2025<br>MinSalud IHCE',
          'Interoperabilidad de Historia Clínica Electrónica nacional conforme a estándar HL7 FHIR R4.',
          'Software SaaS',
          'Autenticación OAuth2 Entra ID en Sandbox Preproducción comprobada (HTTP 200, 290 ms). Paquete Bundle RDA implementado. Autorización para producción en trámite.',
          '2 - En Preproducción',
          'Gestionar credenciales de interoperabilidad ante MinSalud.'
        ],
        [
          'Res. 839/2017<br>MinSalud',
          'Conservación y custodia legal de la historia clínica por 15 años (5 gestión / 10 central).',
          'Prestador Asistencial',
          'Preservación continua en nube durante suscripción. Prohibición de borrado automático a los 60 días tras terminación; exportación abierta JSON/SQL.',
          '1 - Comprobado',
          'Garantizar la custodia legal institucional del archivo clínico.'
        ]
      ]
    }
  ]
};
