export const doc11 = {
  code: 'DOC-11',
  title: 'Condiciones de Servicio SaaS y Régimen de Custodia de Datos',
  subtitle: 'Términos Operativos, Delimitación de Responsabilidades y Obligaciones de Conservación Documental (Res. 839/2017)',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-11-Condiciones-SaaS-Custodia-Datos',
  elements: [
    {
      type: 'callout',
      style: 'warning',
      title: '⚖️ Aviso Legal Importante: Documento Propositivo para Concertación Contractual',
      text: 'El presente documento describe los Términos, Condiciones Operativas y Políticas de Custodia SaaS propuestos por OdontoCloud Colombia para regular la relación con sus clientes. No constituye un contrato legal definitivo firmado hasta tanto sea formalmente suscrito entre el Representante Legal del Proveedor Tecnológico y el Representante Legal de la Institución Prestadora de Servicios de Salud (IPS).'
    },
    {
      type: 'h1',
      text: '1. Naturaleza Jurídica del Servicio SaaS'
    },
    {
      type: 'p',
      text: 'OdontoCloud se suministra bajo el modelo de Software como Servicio (Software as a Service - SaaS). La suscripción confiere a la clínica una licencia de uso no exclusiva, intransferible, revocable y temporal para acceder a la plataforma a través de internet, sin que ello implique transferencia de derechos de autor, código fuente ni propiedad intelectual sobre la plataforma.'
    },
    {
      type: 'h1',
      text: '2. Delimitación de Responsabilidades Operativas y Legales'
    },
    {
      type: 'table',
      headers: [
        { text: 'Obligaciones de OdontoCloud (Proveedor SaaS)', width: '50%' },
        { text: 'Obligaciones del Cliente (Prestador de Salud / IPS)', width: '50%' }
      ],
      rows: [
        [
          '• Mantener la disponibilidad técnica de la plataforma (meta SLA: 99.5% anual excluyendo mantenimientos programados).<br>• Implementar las salvaguardas de seguridad lógica, cifrado AES-256-GCM y aislamiento multi-tenant por RLS.<br>• Ejecutar las copias de seguridad de la base de datos en infraestructura en nube.<br>• Garantizar la actualización del software frente a cambios regulatorios obligatorios (DIAN, RIPS e IHCE).<br>• Guardar reserva y confidencialidad absoluta sobre los datos clínicos del prestador.',
          '• Responder por la veracidad, pertinencia científica y licitud de los datos clínicos diligenciados en las historias.<br>• Custodiar con diligencia las claves de acceso de sus profesionales y colaboradores.<br>• Disponer de equipos cliente y conexión a internet estable en sus sedes de atención.<br>• Contar con un Plan de Contingencia Asistencial físico en sede ante fallas externas de conectividad.<br>• Cumplir de manera indelegable con todas las condiciones de Habilitación ante el REPS y la Secretaría de Salud.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Responsabilidad sobre la Custodia Legal de Quince (15) Años (Res. 839/2017)'
    },
    {
      type: 'p',
      text: 'La Resolución 839 de 2017 (que modifica la Resolución 1995 de 1999) y la Ley 2015 de 2020 establecen que la custodia legal de la historia clínica es una obligación jurídica inalienable e indelegable del Prestador de Servicios de Salud (la IPS o el profesional independiente). El prestador está obligado por ley a conservar las historias clínicas por un periodo mínimo de quince (15) años contados a partir de la última atención (5 años en archivo de gestión y 10 años en archivo central).'
    },
    {
      type: 'p',
      text: 'Mientras la suscripción al software se encuentre vigente, OdontoCloud actúa como custodio tecnológico delegado bajo la figura de Encargado del Tratamiento. La finalización de la suscripción SaaS no extingue ni reduce el deber legal del prestador de preservar su archivo clínico.'
    },
    {
      type: 'h1',
      text: '4. Régimen de Terminación del Contrato, Devolución y Prohibición de Borrado Automático'
    },
    {
      type: 'p',
      text: 'En observancia de los derechos de los pacientes y los deberes de conservación sanitaria, se establece el siguiente protocolo ante la finalización de los servicios:'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '🛡️ Protocolo de Devolución de Datos y Custodia Pasiva Transitoria',
      text: '1. Periodo de Gracia para Descarga (60 días): OdontoCloud mantendrá habilitado el acceso a la clínica en modo solo lectura durante un plazo de sesenta (60) días calendario posteriores a la terminación de la suscripción, sin costo adicional.\n2. Formatos Abiertos Estándar: Durante dicho plazo, la clínica podrá exportar la totalidad de sus pacientes, historias clínicas, evoluciones, diagnósticos y soportes en formatos abiertos universales: JSON estructurado (compatible con HL7 FHIR R4) y volcado relacional SQL / XLSX.\n3. Prohibición de Borrado Irreversible Automático: Vencido el periodo de gracia de 60 días, OdontoCloud NO ejecutará borrado automático ni destrucción desatendida de los datos clínicos en sus servidores.\n4. Almacenamiento en Frío y Bloqueo de Acceso: La información será trasladada a un estado de congelamiento pasivo cifrado (custodia pasiva transitoria) para proteger la reserva legal.\n5. Requisitos para la Disposición Definitiva: La eliminación o purga definitiva de la base de datos en el servidor del proveedor solo podrá llevarse a cabo tras la suscripción de un Acta Formal de Entrega y Custodia firmada por el Representante Legal de la IPS donde declare expresamente haber recibido y asegurado los archivos para su conservación legal por 15 años, o en virtud de un mandato formal emitido por autoridad judicial o sanitaria competente.'
    }
  ]
};
