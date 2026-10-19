export const doc06 = {
  code: 'DOC-06',
  title: 'Política de Tratamiento de Datos Personales y Acuerdo de Encargo (DPA)',
  subtitle: 'Marco de Protección de Datos Sensibles en Salud (Ley 1581/2012) y Régimen Contractual de Encargo y Custodia',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-06-Politica-Tratamiento-Datos-DPA',
  elements: [
    {
      type: 'h1',
      text: '1. PARTE I: POLÍTICA GENERAL DE TRATAMIENTO DE DATOS PERSONALES'
    },
    {
      type: 'p',
      text: 'En estricto cumplimiento de la Ley Estatutaria 1581 de 2012, el Decreto Reglamentario 1377 de 2013 y la Ley Estatutaria de Salud 1751 de 2015, OdontoCloud Colombia adopta la presente Política de Tratamiento de Datos Personales.'
    },
    {
      type: 'h2',
      text: '1.1 Tratamiento de Datos Sensibles de Salud (Artículos 5 y 6 Ley 1581/2012)'
    },
    {
      type: 'p',
      text: 'La información contenida en las historias clínicas, odontogramas, radiografías, diagnósticos y tratamientos corresponde a la categoría jurídica de Datos Sensibles, cuyo tratamiento goza de una especial protección constitucional:'
    },
    {
      type: 'list',
      items: [
        'Finalidad Exclusiva: Los datos se tratan exclusivamente para la gestión asistencial y odontológica del paciente, facturación de servicios, soporte legal y cumplimiento de reportes obligatorios al Sistema General de Seguridad Social en Salud (SGSSS) a través de RIPS e IHCE.',
        'Prohibición de Explotación Comercial: Se prohíbe de manera absoluta e irrevocable la comercialización, cesión, perfilamiento publicitario o monetización de los datos de salud de los pacientes.'
      ]
    },
    {
      type: 'h2',
      text: '1.2 Derechos de los Titulares (Derechos ARCO) y Límites Sanitarios'
    },
    {
      type: 'p',
      text: 'Los pacientes, como titulares de la información, tienen derecho a conocer, actualizar y rectificar sus datos personales. No obstante, por expresa disposición sanitaria (Resolución 1995 de 1999, Resolución 839 de 2017 y Ley 2015 de 2020), el derecho de supresión o eliminación de datos no procede sobre la historia clínica mientras permanezca vigente el deber legal de custodia y retención obligatoria de quince (15) años a cargo del prestador de salud.'
    },
    {
      type: 'page_break'
    },
    {
      type: 'h1',
      text: '2. PARTE II: ACUERDO CONTRACTUAL DE ENCARGO DEL TRATAMIENTO (DPA)'
    },
    {
      type: 'p',
      text: 'El presente acuerdo regula las relaciones de tratamiento de datos entre la Institución Prestadora de Servicios de Salud (o Consultorio Odontológico) y OdontoCloud Colombia, con el fin de dar cumplimiento al Artículo 25 del Decreto 1377 de 2013.'
    },
    {
      type: 'callout',
      style: 'legal',
      title: '📋 Delimitación Contractual de Roles Jurídicos',
      text: 'La Clínica / IPS actúa como RESPONSABLE DEL TRATAMIENTO (recolecta los datos, define fines asistenciales y ostenta la custodia legal sanitaria). OdontoCloud Colombia actúa como ENCARGADO DEL TRATAMIENTO (proveedor tecnológico SaaS que procesa y aloja los datos únicamente por cuenta e instrucción de la clínica, sin relación asistencial directa con el paciente).'
    },
    {
      type: 'table',
      headers: [
        { text: 'Obligaciones del Responsable (Clínica / IPS)', width: '50%' },
        { text: 'Obligaciones del Encargado (OdontoCloud)', width: '50%' }
      ],
      rows: [
        [
          '• Recabar la autorización previa e informada del paciente.<br>• Responder por la pertinencia médica y veracidad de los datos.<br>• Custodiar legalmente las historias por el término de 15 años (Res. 839/2017).<br>• Gestionar las solicitudes de copia de historia clínica.',
          '• Tratar los datos exclusivamente según instrucciones contractuales.<br>• Garantizar salvaguardas técnicas, TLS 1.3, AES-256-GCM y RLS.<br>• Mantener reserva profesional indefinida sobre los registros.<br>• Poner a disposición la exportación completa al fin del servicio.'
        ]
      ]
    },
    {
      type: 'h2',
      text: '2.1 Régimen de Conservación, Devolución y Prohibición de Borrado Automático'
    },
    {
      type: 'p',
      text: 'En concordancia con la Resolución 839 de 2017 (que modifica la Res. 1995/1999) y la Ley 2015 de 2020, la terminación de una relación comercial no extingue las obligaciones legales de conservación de la historia clínica. Por ello, se establecen las siguientes reglas contractuales:'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '⚖️ Salvaguarda Legal: Prohibición de Borrado Irreversible Automático a los 60 Días',
      text: '1. Periodo de Descarga Operativa (60 días): Tras la terminación del contrato SaaS, OdontoCloud mantendrá habilitado el acceso a la clínica en modo solo lectura durante un plazo de sesenta (60) días calendario para que descargue su base de datos completa en formatos abiertos estándar (JSON estructurado y relacional SQL/XLSX).\n2. Prohibición de Destrucción Automática: Vencido el plazo de 60 días, OdontoCloud NO ejecutará ningún borrado irreversible automático ni eliminación desatendida de registros clínicos.\n3. Custodia Pasiva Transitoria: La cuenta pasará a un estado de congelamiento pasivo cifrado (almacenamiento en frío), preservando la integridad de los datos.\n4. Protocolo Formal de Disposición: Cualquier eliminación o purga definitiva únicamente podrá llevarse a cabo si: (a) Existe una constancia formal o Acta de Entrega y Custodia firmada por el Representante Legal de la IPS certificando que ha recibido la totalidad de los datos y asumido la custodia por los 15 años de ley; (b) Media orden expresa de autoridad sanitaria o judicial competente; o (c) Se suscribe un contrato remunerado de depósito documental pasivo a largo plazo.'
    }
  ]
};
