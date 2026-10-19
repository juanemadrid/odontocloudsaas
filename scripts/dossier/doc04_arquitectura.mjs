export const doc04 = {
  code: 'DOC-04',
  title: 'Arquitectura Tecnológica e Infraestructura',
  subtitle: 'Topología de Servidores VPS, Contenedores Docker, Aislamiento RLS y Seguridad Criptográfica',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-04-Arquitectura-Tecnologica-Infraestructura',
  elements: [
    {
      type: 'h1',
      text: '1. Topología del Servidor VPS e Infraestructura en Nube'
    },
    {
      type: 'p',
      text: 'OdontoCloud opera sobre una infraestructura en nube privada basada en Servidores Privados Virtuales (VPS) de alto rendimiento alojados en centros de datos Tier III con certificación ISO/IEC 27001. El sistema operativo base es Oracle Linux Enterprise (x86_64), optimizado para cargas transaccionales continuas y máxima disponibilidad.'
    },
    {
      type: 'p',
      text: 'La orquestación de servicios se gestiona mediante Coolify sobre Docker Engine versión 25+, permitiendo el despliegue modular de microservicios contenerizados, control de ciclo de vida, rotación de logs y aislamiento estricto de procesos.'
    },
    {
      type: 'callout',
      style: 'legal',
      title: '🛡️ Aislamiento Estricto de Servicios y Recursos en el VPS',
      text: 'El servicio OdontoCloud opera dentro de su propio namespace de contenedores, redes de puente (bridge networks) dedicadas y volúmenes de almacenamiento persistente independientes. Existe una separación total y absoluta respecto de cualquier otro entorno o servicio alojado en la misma máquina física, impidiendo cualquier cruce de tráfico o acceso a datos entre sistemas.'
    },
    {
      type: 'h1',
      text: '2. Arquitectura de Componentes del Sistema'
    },
    {
      type: 'table',
      headers: [
        { text: 'Capa / Componente', width: '25%' },
        { text: 'Tecnología y Versión', width: '40%' },
        { text: 'Función en OdontoCloud', width: '35%' }
      ],
      rows: [
        [
          'Capa de Presentación (Frontend)',
          'React PWA, Vite, TailwindCSS, Lucide Icons',
          'Interfaz de usuario reactiva, accesible vía web, soporte offline parcial y firma digital.'
        ],
        [
          'Pasarela de Entrada y Proxy Inverso',
          'Kong API Gateway / Coolify Proxy',
          'Terminación TLS 1.3, enrutamiento seguro de peticiones, limitación de tasa (rate limiting).'
        ],
        [
          'Capa de API Asistencial (Backend)',
          'PostgREST Engine / Deno Edge Functions',
          'Exposición segura de endpoints RESTful directamente desde el catálogo de la base de datos.'
        ],
        [
          'Motor de Base de Datos y Datos Clínicos',
          'PostgreSQL 15+ Enterprise',
          'Almacenamiento transaccional ACID, tablas clínicas, triggers de inmutabilidad y colas outbox.'
        ],
        [
          'Mecanismo de Despacho Asíncrono',
          'Transactional Outbox Worker (Node.js)',
          'Consumo y reintento con backoff exponencial de paquetes asistenciales para MinSalud.'
        ],
        [
          'Servidor de Notificaciones y Correo',
          'Resend SMTP Gateway (Dominio Verificado)',
          'Envío de credenciales, avisos de citas y notificaciones transaccionales seguras.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Aislamiento Multi-Inquilino mediante Row Level Security (RLS)'
    },
    {
      type: 'p',
      text: 'OdontoCloud implementa un modelo de base de datos compartida con aislamiento lógico forzado por el motor PostgreSQL mediante Row Level Security (RLS):'
    },
    {
      type: 'list',
      items: [
        'Identificador de Clínica Forzado: Cada tabla del esquema asistencial (pacientes, citas, odontogramas, evoluciones, consentimientos, facturas) incluye la columna tenant_id obligatoria.',
        'Políticas RLS Declarativas: A nivel de motor de datos se ejecutan políticas que filtran cada SELECT, INSERT, UPDATE y DELETE contra el tenant_id del usuario autenticado en la sesión JWT.',
        'Imposibilidad de Fuga entre Clínicas: Ningún usuario de una clínica puede consultar ni modificar información perteneciente a otra clínica, incluso si manipula los identificadores en la URL o en las peticiones HTTP.'
      ]
    },
    {
      type: 'h1',
      text: '4. Seguridad Criptográfica y Cifrado de Secretos (AES-256-GCM)'
    },
    {
      type: 'p',
      text: 'Las credenciales ministeriales de cada clínica (Client Secrets de Microsoft Entra ID y Subscription Keys de MinSalud) así como los tokens de la DIAN jamás se almacenan en texto plano en la base de datos:'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '🔐 Cifrado Criptográfico Simétrico en Reposo',
      text: 'Los secretos se cifran mediante el algoritmo Advanced Encryption Standard en modo Galois/Counter Mode (AES-256-GCM) utilizando una clave maestra de 32 bytes gestionada en el servidor, un vector de inicialización (IV) de 12 bytes generado aleatoriamente por registro y una etiqueta de autenticación (Auth Tag) de 16 bytes que previene ataques de manipulación o sustitución de datos.'
    },
    {
      type: 'h1',
      text: '5. Plan de Respaldo y Metas de Recuperación (RPO / RTO)'
    },
    {
      type: 'p',
      text: 'Para asegurar la continuidad del negocio y el cumplimiento del estándar de habilitación de Procesos Prioritarios:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Mecanismo de Respaldo', width: '35%' },
        { text: 'Frecuencia y Retención', width: '35%' },
        { text: 'Objetivo de Recuperación (Meta)', width: '30%' }
      ],
      rows: [
        [
          'Dumps Transaccionales de Base de Datos (pg_dump -Fc)',
          'Diario a las 02:00 AM (COT). Retención rotativa de 30 días en almacenamiento externo.',
          'RPO (Punto Objetivo de Recuperación): 24 horas (meta de diseño técnico).'
        ],
        [
          'Instantáneas de Volumen Completo (Snapshots)',
          'Semanal y previo a actualizaciones de release o mantenimiento de kernel.',
          'RTO (Tiempo Objetivo de Recuperación): Menor a 4 horas (meta de diseño técnico).'
        ]
      ]
    }
  ]
};
