export const doc08 = {
  code: 'DOC-08',
  title: 'Plan de Copias de Seguridad, Restauración y Continuidad Operativa',
  subtitle: 'Estrategia de Respaldos Transaccionales, Pruebas de Restauración y Plan de Contingencia Física en Sede',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-08-Plan-Copias-Seguridad-Continuidad',
  elements: [
    {
      type: 'h1',
      text: '1. Realidad Técnica Comprobable de las Copias de Seguridad'
    },
    {
      type: 'p',
      text: 'En atención a las directrices de habilitación de la Resolución 3100 de 2019 y el estándar de gestión documental, se describe con absoluta transparencia técnica el mecanismo real de respaldos que opera sobre la plataforma OdontoCloud Colombia:'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '⚠️ Transparencia Auditora: Evidencia Técnica vs Metas de Diseño',
      text: 'Para evitar observaciones en visitas de auditoría, se hace constar que los tiempos de recuperación (RPO y RTO) expresados en este documento corresponden a metas de diseño de la arquitectura tecnológica. Las copias de seguridad de PostgreSQL se generan mediante dumps transaccionales comprimidos (pg_dump -Fc) y snapshots de volumen en el orquestador Coolify. La IPS o consultorio debe formalizar internamente en su Comité de Calidad la realización y acta del simulacro de restauración anual.'
    },
    {
      type: 'h1',
      text: '2. Cronograma y Tipología de Respaldos en Nube'
    },
    {
      type: 'table',
      headers: [
        { text: 'Tipo de Respaldo', width: '25%' },
        { text: 'Herramienta y Comando', width: '35%' },
        { text: 'Frecuencia y Destino', width: '40%' }
      ],
      rows: [
        [
          'Copia Lógica Transaccional',
          'pg_dump -Fc (Custom format con compresión y checksums)',
          'Diaria a las 02:00 AM (COT). Almacenamiento cifrado con retención de 30 días.'
        ],
        [
          'Instantánea de Volumen (Snapshot)',
          'Docker Volume Snapshots / Snapshot de disco VPS',
          'Semanal y previo a despliegues de nuevos releases de software.'
        ],
        [
          'Exportación de Archivos Adjuntos',
          'Sincronización de buckets de Storage (radiografías/consentimientos)',
          'Diaria incremental hacia almacenamiento georredundante.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Procedimiento de Restauración y Pruebas Periódicas'
    },
    {
      type: 'ordered_list',
      items: [
        'Detección y Declaración de Incidencia: Identificación de corrupción de datos o falla mayor de hardware que requiera recuperación.',
        'Aislamiento del Entorno: Suspensión temporal de conexiones cliente para evitar transacciones intermedias.',
        'Aprovisionamiento de Instancia Limpia: Despliegue de un contenedor PostgreSQL limpio desde imagen verificada.',
        'Ejecución del Comando de Restauración: pg_restore -d postgres --clean --if-exists backup_file.dump con validación de integridad referencial.',
        'Verificación de Consistencia: Ejecución de consultas de validación sobre tablas críticas (pacientes, citas, evoluciones cerradas e índices).',
        'Reanudación del Tráfico: Reactivación del enrutamiento a través de Kong API Gateway y emisión del reporte de normalización.'
      ]
    },
    {
      type: 'h1',
      text: '4. Plan de Contingencia Asistencial Físico (En Consultorio)'
    },
    {
      type: 'p',
      text: 'Ante eventos de fuerza mayor que impidan el acceso a internet o causen corte de energía eléctrica prolongado en las instalaciones de la clínica:'
    },
    {
      type: 'callout',
      style: 'legal',
      title: '📋 Protocolo de Contingencia Física Obligatorio',
      text: '1. Formatos Físicos de Contingencia: La clínica debe mantener en recepción y consultorios un stock de formularios impresos de contingencia (ficha de evolución odontológica y odontograma en papel).\n2. Registro Asistencial Simultáneo: El odontólogo diligencia manualmente en papel la atención con firma autógrafa y sello profesional para no interrumpir el servicio de salud.\n3. Transcripción Posterior Obligatoria: Una vez restablecida la conectividad o energía, el personal dispone de un plazo máximo perentorio de veinticuatro (24) horas para transcribir íntegramente la atención al sistema OdontoCloud, marcando la opción "Atención en Contingencia Física" y adjuntando la fotografía o escaneo del documento físico.'
    }
  ]
};
