export const doc10 = {
  code: 'DOC-10',
  title: 'Manual de Soporte, Mantenimiento y Gestión de Incidentes',
  subtitle: 'Políticas de Asistencia Técnica, Canales de Atención, Clasificación de Severidades y Metas de SLA',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-10-Manual-Soporte-Mantenimiento',
  elements: [
    {
      type: 'h1',
      text: '1. Objetivos del Servicio de Soporte Técnico'
    },
    {
      type: 'p',
      text: 'El presente manual establece las políticas, canales de atención, procedimientos de reporte y acuerdos operativos implementados por OdontoCloud Colombia para brindar asistencia técnica continua, mantenimiento correctivo y preventivo a consultorios e Instituciones Prestadoras de Servicios de Salud (IPS).'
    },
    {
      type: 'h1',
      text: '2. Canales Oficiales de Atención y Mesa de Ayuda'
    },
    {
      type: 'table',
      headers: [
        { text: 'Canal de Soporte', width: '25%' },
        { text: 'Descripción Operativa y Alcance', width: '45%' },
        { text: 'Horario de Disponibilidad', width: '30%' }
      ],
      rows: [
        [
          'Asistente Virtual IA en Plataforma',
          'Módulo interactivo de ayuda integrado en la interfaz de OdontoCloud para resolución de dudas operativas inmediatas, navegación y flujos clínicos.',
          '24 horas / 7 días a la semana (Automático)'
        ],
        [
          'Línea WhatsApp de Soporte Oficial',
          'Atención directa con ingenieros de soporte para incidencias en consultorio, dudas de facturación DIAN, credenciales y validaciones operativas.',
          'Lunes a Viernes: 07:00 a 19:00 COT<br>Sábados: 08:00 a 13:00 COT'
        ],
        [
          'Correo Electrónico Corporativo',
          'Recepción formal de solicitudes, PQRS, reportes de incidencias complejas y constancias de soporte: bienvenido@odontocloudcolombia.com',
          'Recepción 24/7 (Gestión en horario hábil)'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Matriz de Clasificación de Incidentes y Tiempos de Respuesta'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '⚠️ Nota Auditora: Tiempos SLA Propuestos para Concertación',
      text: 'Los tiempos de respuesta y solución indicados en la siguiente matriz corresponden a metas estándar de nivel de servicio (SLA) propuestas por OdontoCloud, las cuales se formalizan y pactan individualmente en el contrato de suscripción de cada prestador según su plan contratado.'
    },
    {
      type: 'table',
      headers: [
        { text: 'Severidad', width: '15%' },
        { text: 'Definición y Criterio de Impacto', width: '40%' },
        { text: 'Tiempo de Respuesta Inicial (Meta)', width: '22%' },
        { text: 'Tiempo Objetivo de Solución / Mitigación', width: '23%' }
      ],
      rows: [
        [
          'P1 — Crítico',
          'Caída total de la plataforma o indisponibilidad del servicio para toda la clínica que impide completamente la atención de pacientes.',
          'Menor a 1 hora hábil',
          'Menor a 4 horas (Vía contingencia o restauración)'
        ],
        [
          'P2 — Alto',
          'Falla severa en un módulo esencial (ej. imposibilidad de firmar evoluciones o emitir facturas electrónicas), existiendo workaround temporal.',
          'Menor a 2 horas hábiles',
          'Menor a 8 horas hábiles'
        ],
        [
          'P3 — Medio',
          'Incidencia operativa no bloqueante (ej. lentitud transitoria en reportes, desajuste visual o inconsistencia en filtros de búsqueda).',
          'Menor a 4 horas hábiles',
          'Menor a 24 horas hábiles'
        ],
        [
          'P4 — Bajo',
          'Consultas operativas, solicitudes de cambio de configuración, aclaraciones normativas o propuestas de nuevas funcionalidades.',
          'Menor a 8 horas hábiles',
          'Según cronograma de releases mensuales'
        ]
      ]
    },
    {
      type: 'h1',
      text: '4. Procedimiento de Reporte y Escalamiento Técnico'
    },
    {
      type: 'ordered_list',
      items: [
        'Registro de la Solicitud: El usuario de la clínica reporta el incidente a través de WhatsApp o correo electrónico, suministrando descripción del caso, usuario afectado y capturas de pantalla.',
        'Nivel 1 (Triage y Soporte Operativo): Verificación de conectividad, permisos de usuario y guía inmediata al personal de la clínica.',
        'Nivel 2 (Ingeniería de Software y Base de Datos): Diagnóstico de errores de aplicación, inconsistencias en esquemas o fallas de pasarelas fiscales/ministeriales.',
        'Nivel 3 (Infraestructura y Seguridad): Intervención directa en contenedores Docker, servidor VPS o restauración de copias de seguridad ante fallas críticas de infraestructura.'
      ]
    },
    {
      type: 'h1',
      text: '5. Política de Ventanas de Mantenimiento y Parches'
    },
    {
      type: 'p',
      text: 'Para no interrumpir la consulta odontológica diurna de las clínicas, todas las labores de mantenimiento preventivo, actualización de kernel o despliegues mayores se ejecutan dentro de la Ventana de Mantenimiento No Asistencial: de 10:00 PM a 05:00 AM (COT), con notificación previa por correo electrónico a las clínicas con un mínimo de cuarenta y ocho (48) horas de anticipación.'
    }
  ]
};
