export const doc05 = {
  code: 'DOC-05',
  title: 'Política y Procedimientos de Seguridad de la Información',
  subtitle: 'Directrices de Ciberseguridad, Salvaguardas Criptográficas, Prevención OWASP y Gestión de Incidentes',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-05-Politica-Seguridad-Informacion',
  elements: [
    {
      type: 'h1',
      text: '1. Objeto y Alcance de la Política de Seguridad'
    },
    {
      type: 'p',
      text: 'El presente documento formaliza los lineamientos, salvaguardas tecnológicas y procedimientos operativos implementados por OdontoCloud Colombia para preservar la confidencialidad, integridad, disponibilidad y trazabilidad de los datos asistenciales y administrativos gestionados a través de la plataforma SaaS.'
    },
    {
      type: 'p',
      text: 'Esta política aplica a todos los componentes de la arquitectura: servidores virtuales en nube (VPS), contenedores Docker, bases de datos PostgreSQL, pasarelas de conexión (Kong API Gateway, PostgREST), endpoints criptográficos y mecanismos de comunicación con terminales cliente en consultorios e IPS.'
    },
    {
      type: 'h1',
      text: '2. Salvaguardas Criptográficas (Cifrado en Reposo y en Tránsito)'
    },
    {
      type: 'p',
      text: 'OdontoCloud implementa controles criptográficos de estándar bancario y hospitalario conforme a las mejores prácticas internacionales (ISO/IEC 27001:2022 y lineamientos NIST SP 800-52):'
    },
    {
      type: 'table',
      headers: [
        { text: 'Dimensión Criptográfica', width: '25%' },
        { text: 'Estándar / Algoritmo Implementado', width: '45%' },
        { text: 'Aplicación Concreta en el Sistema', width: '30%' }
      ],
      rows: [
        [
          'Cifrado en Tránsito (Network)',
          'Protocolo Transport Layer Security (TLS 1.3) con suites de cifrado seguras (ECDHE-RSA-AES256-GCM-SHA384).',
          '100% de las comunicaciones web, API REST, WebSockets y transmisiones con MinSalud y Factus. Prohibición de HTTP plano.'
        ],
        [
          'Cifrado Simétrico en Reposo (Database)',
          'Advanced Encryption Standard en modo Galois/Counter Mode (AES-256-GCM) con vector de 12 bytes y Auth Tag de 16 bytes.',
          'Cifrado de credenciales de integración de cada clínica (claves APIM, secretos Entra ID y tokens). Jamás se guardan en texto plano.'
        ],
        [
          'Almacenamiento de Contraseñas',
          'Algoritmo de hash criptográfico unidireccional con salt dinámico (Argon2id / Bcrypt, factor de coste 10+).',
          'Protección de credenciales de acceso de doctores y personal administrativo. Imposibilidad de recuperación en texto plano.'
        ],
        [
          'Firmas Electrónicas Confiables',
          'Resumen criptográfico SHA-256 encadenado a la clave secreta de sesión del profesional tratante.',
          'Certificación de cierre de historias clínicas, garantizando que cualquier modificación posterior invalide el hash.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Prevención de Vulnerabilidades (Alineación OWASP Top 10)'
    },
    {
      type: 'list',
      items: [
        'Inyección SQL (SQLi): Eliminación total de concatenación de strings en sentencias SQL. Toda consulta viaja a través de la capa PostgREST con tipado estricto y prepared statements.',
        'Ataques de Secuencias de Comandos en Sitios Cruzados (XSS): Sanitización obligatoria del contenido HTML mediante biblioteca especializada (DOMPurify) antes de cualquier renderizado en pantalla.',
        'Asignación Masiva y Falsificación de Solicitudes (CSRF): Uso de tokens JWT firmados en cabeceras de autorización Bearer, prescindiendo de cookies de sesión vulnerables a CSRF.',
        'Rotura de Control de Acceso (BOLA / IDOR): Políticas obligatorias de Row Level Security (RLS) en el motor de base de datos PostgreSQL, impidiendo que un usuario acceda a datos de otra sede o clínica alterando IDs en la URL.'
      ]
    },
    {
      type: 'h1',
      text: '4. Gestión y Notificación de Incidentes de Seguridad'
    },
    {
      type: 'p',
      text: 'OdontoCloud cuenta con un protocolo formal de respuesta ante incidentes de ciberseguridad:'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '🚨 Procedimiento de Notificación a la IPS ante Incidentes (Ley 1581/2012)',
      text: 'En caso de detectarse un evento de seguridad comprobado que comprometa la confidencialidad de datos personales o clínicos de los pacientes (fuga de información o acceso no autorizado no mitigado): 1. Contención Inmediata: Aislamiento de sesiones y rotación inmediata de secretos en un plazo inferior a 2 horas. 2. Notificación Formal al Prestador: Comunicación escrita a la Dirección Médica de la IPS en un plazo máximo de veinticuatro (24) horas hábiles, detallando el vector de ataque, el alcance potencial y las medidas correctivas aplicadas. 3. Soporte para Reporte SIC: Suministro del informe forense para que el Prestador (como Responsable) cumpla con su deber de notificación a la Superintendencia de Industria y Comercio (SIC).'
    }
  ]
};
