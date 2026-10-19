export const doc07 = {
  code: 'DOC-07',
  title: 'Manual de Trazabilidad, Auditoría y Control de Accesos',
  subtitle: 'Pistas Forenses, Segregación de Funciones, Bitácoras Inmutables y Protocolo Break-Glass',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-07-Trazabilidad-Auditoria-Accesos',
  elements: [
    {
      type: 'h1',
      text: '1. Principio de Trazabilidad y Segregación de Funciones'
    },
    {
      type: 'p',
      text: 'En concordancia con el Estándar de Historia Clínica y Registros Asistenciales (Resolución 3100 de 2019), OdontoCloud garantiza la identificación no repudiable de cada usuario que interactúa con el sistema, impidiendo el uso de cuentas genéricas o compartidas.'
    },
    {
      type: 'h1',
      text: '2. Matriz de Roles y Permisos por Perfil Asistencial'
    },
    {
      type: 'table',
      headers: [
        { text: 'Perfil / Rol', width: '20%' },
        { text: 'Permisos Concedidos en OdontoCloud', width: '45%' },
        { text: 'Restricciones Estrictas de Seguridad', width: '35%' }
      ],
      rows: [
        [
          'Superadministrador',
          'Aprovisionamiento de clínicas, monitoreo global de salud de infraestructura, facturación de suscripciones SaaS.',
          'No tiene acceso a lectura ni edición de historias clínicas ni datos sensibles de pacientes de las clínicas.'
        ],
        [
          'Director Médico / Administrador de Clínica',
          'Creación de usuarios doctores, configuración de sedes, lista de precios, tarifas, consecutivos DIAN, auditoría de folios y supervisión Break-Glass.',
          'No puede alterar ni reabrir evoluciones cerradas por los odontólogos tratantes.'
        ],
        [
          'Profesional Odontólogo Tratante',
          'Creación y diligenciamiento de historias clínicas, odontograma interactivo, diagnóstico CIE-10, procedimientos CUPS, prescripciones y firma digital de folios.',
          'Solo puede cerrar evoluciones de las cuales es el profesional asignado. No puede modificar configuraciones globales de la clínica.'
        ],
        [
          'Recepción / Auxiliar',
          'Asignación de citas en agenda, registro inicial de datos demográficos del paciente, facturación en caja y cobro de recibos.',
          'Acceso denegado a notas clínicas privadas, diagnósticos detallados y firma de evoluciones.'
        ],
        [
          'Auditor Médico (Solo Lectura)',
          'Consulta de expedientes, verificación de oportunidad en citas y exportación de reportes de calidad.',
          'Totalmente inhabilitado para crear, modificar o alterar cualquier registro asistencial o financiero.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Bitácora Forense y Registro Inmutable de Eventos'
    },
    {
      type: 'p',
      text: 'El sistema genera pistas de auditoría automáticas a nivel de motor de datos y capa de aplicación:'
    },
    {
      type: 'list',
      items: [
        'Metadatos Obligatorios por Folio: Cada registro de evolución guarda de forma automática la fecha y hora UTC exacta (clock_timestamp() del servidor, no la hora del computador cliente), el identificador del usuario autenticado (auth.uid()), la cédula profesional del odontólogo y su firma electrónica confiable.',
        'Bitácora de Eventos de Seguridad: Registro de inicios de sesión exitosos y fallidos, cambios de contraseñas, descargas de historias clínicas y modificaciones de parámetros tributarios.'
      ]
    },
    {
      type: 'h1',
      text: '4. Protocolo de Emergencia "Break-Glass" (Acceso Asistencial Urgente)'
    },
    {
      type: 'p',
      text: 'En la atención en salud pueden presentarse situaciones de urgencia vital donde un odontólogo especialista o médico de turno debe consultar de inmediato antecedentes o alergias de un paciente cuyo odontólogo tratante no se encuentra disponible.'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '🛡️ Protocolo Controlado Break-Glass en OdontoCloud',
      text: 'Para compatibilizar la protección de la privacidad con la preservación de la vida del paciente: 1. El profesional activa la opción "Acceso de Emergencia (Break-Glass)". 2. Justificación Obligatoria: El sistema exige ingresar una justificación clínica detallada del motivo de la urgencia. 3. Registro Indeleble: Se genera un evento de auditoría de máxima prioridad que registra al usuario que rompió el aislamiento, la hora exacta y el motivo manifestado bajo gravedad de juramento. 4. Alerta a Dirección Médica: Se emite una notificación inmediata en el panel del Administrador y Director Médico de la clínica para su control y verificación posterior.'
    }
  ]
};
