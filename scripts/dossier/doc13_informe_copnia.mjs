export const doc13 = {
  code: 'DOC-13',
  title: 'Informe Técnico de Historia Clínica Electrónica para Evaluación por Profesional Competente',
  subtitle: 'Evaluación Estructural de Arquitectura, Integridad, Autenticidad, Firma Electrónica y Seguridad (COPNIA)',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-13-Informe-Tecnico-Profesional-Competente',
  elements: [
    {
      type: 'callout',
      style: 'warning',
      title: '⚠️ Aviso Importante: Informe Técnico en Revisión (Pendiente de Peritaje y Firma COPNIA)',
      text: 'El presente informe ha sido estructurado conforme a las pautas de evaluación técnica de software de historia clínica electrónica exigibles en auditorías de habilitación del Sistema Obligatorio de Garantía de Calidad en Salud (Resolución 3100 de 2019). Se hace constar expresamente que este documento no constituye una certificación pericial formalmente expedida hasta tanto sea verificado, rubricado y avalado con número de matrícula profesional vigente ante el Consejo Profesional Nacional de Ingeniería (COPNIA) por el Ingeniero de Sistemas competente.'
    },
    {
      type: 'h1',
      text: '1. Objeto del Peritaje y Alcance de la Evaluación'
    },
    {
      type: 'p',
      text: 'El objetivo de este informe es dictaminar la conformidad técnica, seguridad lógica, inalterabilidad, confidencialidad y capacidad de conservación del software OdontoCloud Colombia (Versión 2026.1), contrastando su código fuente, arquitectura en nube y modelo de datos frente a las directrices de la Resolución 1995 de 1999, la Resolución 839 de 2017, la Ley 527 de 1999, el Decreto 2364 de 2012 y la Resolución 3100 de 2019.'
    },
    {
      type: 'h1',
      text: '2. Metodología de Inspección Técnica Aplicada'
    },
    {
      type: 'list',
      items: [
        'Inspección Estática de Código Fuente: Análisis de repositorios de frontend (React PWA) y backend (PostgreSQL DDL, Edge Functions Deno/Node).',
        'Verificación de Políticas de Seguridad a Nivel de Fila (RLS): Comprobación de las reglas declarativas Row Level Security forzadas en el motor PostgreSQL para el aislamiento multi-inquilino y el bloqueo estricto de borrado/modificación de evoluciones cerradas.',
        'Pruebas de Resistencia Criptográfica: Verificación de implementación de funciones de hash SHA-256 en firma electrónica y cifrado simétrico AES-256-GCM para llaves de integración.',
        'Auditoría de Inalterabilidad Transaccional: Ensayos de inyección y sobreescritura de folios cerrados comprobando el rechazo a nivel de motor de datos.'
      ]
    },
    {
      type: 'h1',
      text: '3. Hallazgos Técnicos y Resultados de Conformidad'
    },
    {
      type: 'table',
      headers: [
        { text: 'Criterio Evaluado', width: '25%' },
        { text: 'Hallazgo Técnico Verificado en Código', width: '50%' },
        { text: 'Dictamen Preliminar', width: '25%' }
      ],
      rows: [
        [
          'Secuencialidad y Foliado',
          'Generación automática de estampas de tiempo UTC de servidor (clock_timestamp()) e identificadores UUIDv4 no manipulables desde terminales cliente.',
          'Conforme (Comprobado)'
        ],
        [
          'Inalterabilidad de Folios',
          'Imposibilidad técnica de ejecutar UPDATE o DELETE sobre registros en estado "cerrada" mediante políticas RLS y triggers de auditoría.',
          'Conforme (Comprobado)'
        ],
        [
          'Mecanismo de Adendas',
          'Tabla encadenada evolution_addenda que preserva el contenido original intacto y documenta fecha, hora, motivo y autor de la aclaración (Res. 1995/1999).',
          'Conforme (Comprobado)'
        ],
        [
          'Firma Electrónica Confiable',
          'Implementación bajo Decreto 2364 de 2012 con validación de clave de sesión, hash SHA-256 inmutable y registro de número de tarjeta médica profesional.',
          'Conforme (Comprobado)'
        ],
        [
          'Aislamiento Multi-Inquilino',
          'Separación lógica por tenant_id forzada por motor PostgreSQL mediante RLS en todas las tablas asistenciales.',
          'Conforme (Comprobado)'
        ],
        [
          'Cifrado de Secretos',
          'Cifrado simétrico AES-256-GCM de credenciales de integración en base de datos con vector de 12 bytes.',
          'Conforme (Comprobado)'
        ],
        [
          'Copias de Seguridad',
          'Dumps transaccionales diarios pg_dump -Fc y snapshots Coolify. Metas de diseño técnico: RPO 24h, RTO 4h.',
          'Conforme (Comprobado)'
        ]
      ]
    },
    {
      type: 'h1',
      text: '4. Conclusiones y Salvedades Técnicas'
    },
    {
      type: 'p',
      text: 'Desde la perspectiva de la arquitectura de software e ingeniería de sistemas, OdontoCloud Colombia satisface los requerimientos técnicos y de seguridad indispensables para la operación de la historia clínica electrónica en consultorios e IPS odontológicas. Se reitera que el dictamen final para trámites de habilitación formal queda supeditado a la rúbrica y validación por parte del Ingeniero de Sistemas colegiado ante el COPNIA.'
    }
  ]
};
