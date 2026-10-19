export const doc03 = {
  code: 'DOC-03',
  title: 'Documento Técnico del Sistema de Historia Clínica Electrónica',
  subtitle: 'Cumplimiento Normativo de Inmutabilidad, Folios, Firmas y Conservación de Historias Odontológicas',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-03-Tecnico-Historia-Clinica-Electronica',
  elements: [
    {
      type: 'h1',
      text: '1. Fundamento Jurídico y Normativo de la Historia Clínica en Colombia'
    },
    {
      type: 'p',
      text: 'El módulo de Historia Clínica Electrónica (HCE) de OdontoCloud Colombia ha sido diseñado e implementado en estricta sujeción al marco normativo sanitario colombiano:'
    },
    {
      type: 'list',
      items: [
        'Resolución 1995 de 1999: Establece las normas para el manejo integral de la historia clínica, definiéndola como un documento privado, obligatorio y sometido a reserva, en el cual se registran cronológicamente las condiciones de salud del paciente.',
        'Resolución 839 de 2017: Modifica la Resolución 1995/1999 en lo relativo a los periodos de retención y custodia documental, fijando un término mínimo de retención de quince (15) años (cinco años en el archivo de gestión y diez años en el archivo central), y custodia permanente para víctimas de violaciones a los derechos humanos.',
        'Resolución 3100 de 2019 (y aclaración sobre la vigencia continua tras la revocatoria de la Resolución 1732 de 2026 mediante Resolución 2080 de 2026): Estándar de Historia Clínica y Registros Asistenciales para la Habilitación de Servicios de Salud.',
        'Ley 2015 de 2020: Por medio de la cual se crea el Mecanismo de Interoperabilidad de la Historia Clínica Electrónica (IHCE) y se dictan disposiciones sobre la titularidad del paciente sobre sus datos de salud.',
        'Ley 527 de 1999 y Decreto 2364 de 2012: Marco legal de los mensajes de datos, comercio electrónico y reglamentación de la Firma Electrónica Confiable en la República de Colombia.'
      ]
    },
    {
      type: 'h1',
      text: '2. Garantías de Inmutabilidad y Bloqueo de Alteraciones'
    },
    {
      type: 'p',
      text: 'Para dar cumplimiento al mandato legal de inalterabilidad (prohibición de enmendaduras, tachaduras, borrados o sobreescrituras), OdontoCloud implementa una triple barrera técnica de seguridad:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Nivel de Protección', width: '25%' },
        { text: 'Mecanismo Técnico Implementado', width: '45%' },
        { text: 'Evidencia Técnica Comprobable', width: '30%' }
      ],
      rows: [
        [
          'Nivel 1: Base de Datos (Motor PostgreSQL)',
          'Políticas declarativas de Row Level Security (RLS) que deniegan las operaciones de UPDATE y DELETE sobre cualquier registro de la tabla evoluciones cuyo campo status sea igual a "cerrada".',
          'Políticas SQL activas verificadas en pruebas de regresión automatizadas (scripts/test-permissions-fix.mjs).'
        ],
        [
          'Nivel 2: Triggers de Integridad Criptográfica',
          'Disparadores automáticos a nivel de fila (check_evolution_immutable) que interceptan cualquier intento de modificación directa y calculan el hash SHA-256 del contenido clínico original.',
          'Trigger trg_check_evolution_immutable forzado en esquema DDL de base de datos.'
        ],
        [
          'Nivel 3: Capa de Presentación (Frontend PWA)',
          'La interfaz de usuario inhabilita los controles de edición, campos de texto y selectores una vez certificado el folio, mostrando un distintivo visual de "Folio Cerrado e Inmutable".',
          'Componentes React con estado bloqueado tras verificación de status asistencial.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Secuencialidad, Foliado y Estampas de Tiempo Servidor'
    },
    {
      type: 'p',
      text: 'Cada registro clínico generado en OdontoCloud incorpora de forma automática e inviolable los atributos de secuencialidad requeridos por el Sistema Obligatorio de Garantía de Calidad:'
    },
    {
      type: 'list',
      items: [
        'Estampa Temporal Inviolable: La fecha y hora de la atención no son tomadas del reloj del computador o dispositivo del cliente (que podría ser alterado deliberadamente por el usuario), sino de la función clock_timestamp() sincronizada en el servidor VPS con servidores horarios oficiales NTP (UTC / COT).',
        'Foliado Unívoco: Cada evolución clínica recibe un identificador global único no correlativo y resistente a colisiones basado en el estándar UUID versión 4.',
        'Identificación del Profesional Tratante: Registro indeleble del usuario autenticado (auth.uid()), nombre completo, especialidad odontológica y número de registro o tarjeta médica profesional.'
      ]
    },
    {
      type: 'h1',
      text: '4. Mecanismo de Adendas y Notas Aclaratorias (Res. 1995/1999)'
    },
    {
      type: 'p',
      text: 'El Artículo 7 de la Resolución 1995 de 1999 establece que cuando se requiera hacer una corrección o adición a un registro clínico cerrado, esta debe realizarse mediante una anotación aclaratoria en la fecha en que se advierta el error, sin modificar el contenido previo. OdontoCloud resuelve este requerimiento mediante la tabla especializada evolution_addenda:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Atributo de la Adenda', width: '30%' },
        { text: 'Implementación Técnica en OdontoCloud', width: '40%' },
        { text: 'Garantía Normativa', width: '30%' }
      ],
      rows: [
        [
          'Encadenamiento al Folio Original',
          'Campo evolution_id vinculado como clave foránea inmutable a la evolución base.',
          'Preserva intacto el texto original sin tachaduras ni enmendaduras.'
        ],
        [
          'Fecha y Hora Propia',
          'Estampa temporal automática del momento en que se redacta la aclaración.',
          'Cumple con el principio de secuencialidad cronológica.'
        ],
        [
          'Motivo Explícito',
          'Campo obligatorio donde el odontólogo debe declarar la razón de la nota aclaratoria.',
          'Aporta sustento médico-legal ante auditorías o requerimientos judiciales.'
        ],
        [
          'Firma Electrónica Independiente',
          'Requiere validación de la contraseña del profesional tratante y hash SHA-256 propio.',
          'Garantiza la autenticidad y el no repudio de la aclaración.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '5. Régimen de Firmas: Firma Electrónica Confiable (Decreto 2364 de 2012)'
    },
    {
      type: 'p',
      text: 'Para efectos de total transparencia regulatoria ante las secretarías de salud departamentales y distritales, se aclara con precisión la tipología de firma implementada en OdontoCloud:'
    },
    {
      type: 'callout',
      style: 'legal',
      title: '⚖️ Delimitación Técnica: Firma Electrónica vs Firma Digital Certificada Abierta',
      text: 'OdontoCloud implementa la modalidad de Firma Electrónica Confiable regulada por el Artículo 7 de la Ley 527 de 1999 y el Decreto 2364 de 2012. Esta modalidad se fundamenta en datos que están bajo el control exclusivo del firmante (contraseña personal y token de sesión cifrado), vinculados a la información de manera que cualquier cambio ulterior sea detectable mediante el resumen criptográfico SHA-256. OdontoCloud NO actúa como Entidad de Certificación Digital abierta (ONAC); por ende, no emite certificados digitales en token físico ni firma digital abierta PKI, sino firma electrónica confiable con plena validez probatoria en procesos de habilitación y auditorías de salud.'
    },
    {
      type: 'p',
      text: 'Adicionalmente, para los Consentimientos Informados y autorizaciones del paciente, el sistema cuenta con captura biométrica de trazo manuscrito en pantalla táctil con sellado de tiempo y vinculación al documento de identidad del usuario.'
    },
    {
      type: 'h1',
      text: '6. Conservación, Custodia y Periodos de Retención (Resolución 839 de 2017)'
    },
    {
      type: 'p',
      text: 'Conforme a la Resolución 839 de 2017, la historia clínica debe conservarse por un periodo mínimo de quince (15) años contados a partir de la fecha de la última atención. OdontoCloud garantiza la preservación de los datos mientras la suscripción esté activa y provee mecanismos de exportación en formatos abiertos estándar (JSON y relacional) al finalizar el contrato para que la IPS continúe con la custodia legal por el tiempo restante.'
    }
  ]
};
