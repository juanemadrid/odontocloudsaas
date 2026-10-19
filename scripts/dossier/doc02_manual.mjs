import { imgConfigBuffer, imgEvolucionBuffer, imgOutboxBuffer } from './engine.mjs';

export const doc02 = {
  code: 'DOC-02',
  title: 'Manual Completo de Usuario y Administrador',
  subtitle: 'Guía Operativa Integral Paso a Paso, Roles, Módulos Asistenciales, Capturas del Sistema y Errores Frecuentes',
  version: '2026.1 (Release 8.2)',
  date: 'Octubre de 2026',
  filenameBase: 'DOC-02-Manual-Usuario-Administrador',
  elements: [
    {
      type: 'h1',
      text: '1. Introducción y Acceso a la Plataforma OdontoCloud'
    },
    {
      type: 'p',
      text: 'El presente manual constituye la guía oficial y auténtica para la operación clínica, administrativa y de interoperabilidad de OdontoCloud Colombia (Versión 2026.1). OdontoCloud está concebido como una Aplicación Web Progresiva (PWA) de alto rendimiento, lo que permite su uso desde computadores de escritorio, portátiles y tabletas sin requerir instalaciones locales complejas.'
    },
    {
      type: 'p',
      text: 'Acceso Seguro al Portal: La plataforma es accesible a través del navegador web institucional en la dirección segura https://odontocloudcolombia.com. Para iniciar sesión, cada usuario debe contar con una cuenta individual activada mediante correo electrónico verificado y una contraseña que cumpla con los estándares mínimos de complejidad (mínimo 8 caracteres, mayúsculas, minúsculas, números y caracteres especiales).'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '⚠️ Obligación de Confidencialidad y Uso Personal de Credenciales',
      text: 'Conforme a la Resolución 1995 de 1999 y la Resolución 3100 de 2019, las credenciales de acceso (usuario y contraseña) son de uso estrictamente personal e intransferible. Queda prohibido compartir cuentas entre odontólogos o utilizar credenciales genéricas en consultorios o áreas de recepción.'
    },
    {
      type: 'h1',
      text: '2. Matriz de Roles, Permisos y Explicación de Botones'
    },
    {
      type: 'p',
      text: 'OdontoCloud implementa un esquema jerarquizado de control de acceso basado en roles (RBAC) reforzado con políticas de seguridad a nivel de fila (Row Level Security - RLS) en la base de datos:'
    },
    {
      type: 'table',
      headers: [
        { text: 'Rol del Sistema', width: '20%' },
        { text: 'Módulos y Funciones Habilitadas', width: '45%' },
        { text: 'Botones y Acciones Permitidas', width: '35%' }
      ],
      rows: [
        [
          'Superadministrador',
          'Gestión global del SaaS, aprovisionamiento de clínicas (tenants), monitoreo de estado de contenedores y facturación de suscripciones.',
          'Botones: "Crear Clínica", "Suspender Acceso", "Configurar Planes", "Ver Métricas Globales". Acceso bloqueado a datos clínicos sensibles de pacientes.'
        ],
        [
          'Administrador de Clínica / Director Médico',
          'Administración integral de la sede, gestión de personal, tarifas, numeraciones de facturación DIAN, credenciales de interoperabilidad y auditoría asistencial.',
          'Botones: "Nuevo Usuario", "Configurar Sede", "Tarifarios CUPS", "Resolución DIAN", "Configurar IHCE", "Auditar Folios". No puede alterar evoluciones cerradas.'
        ],
        [
          'Odontólogo Tratante / Especialista',
          'Diligenciamiento de historia clínica, odontograma interactivo, diagnósticos CIE-10, procedimientos CUPS, evolución y firma electrónica.',
          'Botones: "Nueva Evolución", "Guardar Borrador", "Certificar y Cerrar", "Agregar Adenda", "Nuevo Consentimiento". Solo gestiona pacientes de sus turnos asignados.'
        ],
        [
          'Recepción / Auxiliar Administrativo',
          'Registro demográfico de pacientes, asignación y confirmación de citas en agenda, recepción en sala y cobro en módulo de caja.',
          'Botones: "Crear Paciente", "Agendar Cita", "Confirmar Asistencia", "Generar Factura FEV", "Recibo de Caja". Acceso denegado a notas clínicas y firma médica.'
        ],
        [
          'Auditor Médico / Calidad (Solo Lectura)',
          'Revisión documental para auditorías de habilitación, verificación de oportunidad de citas y exportación de reportes de calidad.',
          'Botones: "Consultar Folio", "Exportar RIPS", "Descargar PDF de Historia", "Ver Trazabilidad". Bloqueado para crear o modificar cualquier registro.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '3. Configuración Institucional de la Clínica'
    },
    {
      type: 'p',
      text: 'Antes de iniciar la atención asistencial, el usuario con rol Administrador de Clínica debe parametrizar la información legal y operativa en el menú "Configuración":'
    },
    {
      type: 'list',
      items: [
        'Datos del Prestador: Razón social, NIT, código de habilitación REPS (12 dígitos), dirección, teléfono corporativo, correo de contacto y logotipo oficial.',
        'Sedes y Consultorios: Registro de sedes físicas, consultorios odontológicos y sillones de atención para la distribución de la agenda.',
        'Catálogo de Profesionales: Registro de odontólogos tratantes, especialidades (Periodoncia, Endodoncia, Ortodoncia, Cirugía Oral, Rehabilitación), número de registro médico y tarjeta profesional.',
        'Tarifarios y Procedimientos: Carga de lista de precios vinculada a códigos oficiales CUPS (Clasificación Única de Procedimientos en Salud).',
        'Parámetros Tributarios DIAN: Ingreso del Token de Factus, prefijo de facturación autorizado, rango de numeración y fecha de vigencia de la resolución de facturación electrónica.'
      ]
    },
    {
      type: 'h1',
      text: '4. Módulo de Pacientes: Registro Demográfico y Ficha'
    },
    {
      type: 'p',
      text: 'Procedimiento paso a paso para la admisión y registro de un paciente en OdontoCloud:'
    },
    {
      type: 'ordered_list',
      items: [
        'Hacer clic en el menú lateral en "Pacientes" y pulsar el botón "+ Nuevo Paciente".',
        'Seleccionar el Tipo de Documento de Identidad (Cédula de Ciudadanía - CC, Tarjeta de Identidad - TI, Registro Civil - RC, Cédula de Extranjería - CE, Permiso por Protección Temporal - PPT, Pasaporte - PA).',
        'Ingresar el Número de Identificación (el sistema valida en tiempo real que no exista duplicidad dentro de la misma clínica).',
        'Diligenciar obligatoriamente los nombres, apellidos, fecha de nacimiento, sexo biológico (Femenino / Masculino / Intersexual) y estado civil conforme a la Resolución 1995 de 1999.',
        'Completar los datos de contacto y residencia: Dirección completa, departamento, municipio de residencia, barrio, número de teléfono móvil y correo electrónico.',
        'Ingresar los datos de aseguramiento en salud: Entidad Promotora de Salud (EPS), régimen de afiliación (Contributivo, Subsidiado, Particular, Medicina Prepagada) y tipo de vinculación.',
        'Registrar la información del Acudiente o Contacto de Emergencia: Nombres, parentesco y teléfono de localización obligatorios para menores de edad y pacientes con discapacidad.',
        'Pulsar el botón "Guardar Paciente". El sistema generará el expediente digital y asignará un identificador único (UUIDv4).'
      ]
    },
    {
      type: 'h1',
      text: '5. Agenda Odontológica y Gestión de Citas'
    },
    {
      type: 'p',
      text: 'El módulo de agenda permite una gestión visual y dinámica de la demanda asistencial:'
    },
    {
      type: 'list',
      items: [
        'Vistas de Calendario: El usuario puede alternar entre vistas Diaria, Semanal y Mensual, así como filtrar por sede física, sillón odontológico o profesional tratante.',
        'Asignación de Cita: Al hacer clic en un intervalo horario disponible, se abre la ventana emergente de asignación. Se busca al paciente por documento o nombre, se selecciona el motivo de consulta, la duración estimada (de 15 a 120 minutos) y notas preparatorias.',
        'Estados de la Cita: La cita avanza a través de una secuencia de estados claramente identificables por color: 1. Programada (azul), 2. Confirmada (verde claro), 3. En Sala de Espera (amarillo), 4. En Consulta (naranja), 5. Atendida (verde oscuro) y 6. Cancelada / No Asistió (gris/rojo).',
        'Prevención de Conflictos: El sistema bloquea automáticamente cualquier intento de solapar citas sobre el mismo profesional o sillón en el mismo bloque horario.'
      ]
    },
    {
      type: 'h1',
      text: '6. Examen Clínico, Anamnesis y Odontograma Interactivo'
    },
    {
      type: 'p',
      text: 'Al ingresar el paciente al consultorio, el odontólogo abre el módulo asistencial haciendo clic en "Atender Paciente" o seleccionando el expediente en el listado:'
    },
    {
      type: 'list',
      items: [
        'Anamnesis Integral: Registro del motivo de consulta expresado textualmente por el paciente y desglose de la enfermedad actual.',
        'Antecedentes Médicos y Estomatológicos: Verificación estructurada con casillas de verificación y campos de detalle para antecedentes patológicos, quirúrgicos, farmacológicos, alérgicos (especialmente penicilina, anestésicos y látex), hemorrágicos, tóxicos y familiares.',
        'Examen Físico de Cabeza, Cuello y Tejidos Blandos: Evaluación clínica y registro de normalidad o hallazgos en la articulación temporomandibular (ATM), labios, carrillos, dorso y vientre de lengua, piso de boca, paladar duro y blando, orofaringe, encías y glándulas salivales.'
      ]
    },
    {
      type: 'p',
      text: 'Uso del Odontograma Interactivo (Adulto y Mixto/Pediátrico):'
    },
    {
      type: 'p',
      text: 'OdontoCloud incorpora un odontograma digital interactivo con gráficos SVG vectoriales que implementa tanto la numeración internacional FDI (Federación Dental Internacional: piezas 11 a 48 en adultos, 51 a 85 en temporales) como la nomenclatura universal. Cada pieza dental está dividida geométricamente en sus cinco caras: Oclusal/Incisal, Mesial, Distal, Vestibular y Lingual/Palatina.'
    },
    {
      type: 'table',
      headers: [
        { text: 'Hallazgo / Procedimiento', width: '30%' },
        { text: 'Convención Gráfica y Color', width: '35%' },
        { text: 'Comportamiento en Odontograma', width: '35%' }
      ],
      rows: [
        [
          'Caries Dental Activa',
          'Rojo (#EF4444)',
          'Se selecciona la herramienta "Caries" y se hace clic en la cara afectada. El sector se tiñe de rojo y suma al índice COP.'
        ],
        [
          'Obturación en Resina o Amalgama',
          'Azul (#2563EB)',
          'Indica tratamiento restaurador existente en buen estado. Se marca en azul sobre la cara tratada.'
        ],
        [
          'Diente Ausente / Perdido',
          'Cruz Negra / Aspa (#1E293B)',
          'El diente se marca como ausente, dibujando una cruz sobre la pieza completa y recalculando el COP.'
        ],
        [
          'Tratamiento de Conductos (Endodoncia)',
          'Línea Central Amarilla / Dorada',
          'Dibuja una línea vertical en la raíz indicando terapia pulpar previa o requerida.'
        ],
        [
          'Corona Protésica / Prótesis Fija',
          'Círculo Periférico Azul',
          'Encierra la pieza dental completa indicando prótesis fija, corona metal-porcelana o zirconio.'
        ],
        [
          'Sellante de Fosas y Fisuras',
          'Punto Verde (#10B981)',
          'Identifica piezas con sellantes preventivos en caras oclusales de molares o premolares.'
        ]
      ]
    },
    {
      type: 'h1',
      text: '7. Evoluciones Clínicas, Diagnóstico CIE-10, Procedimientos CUPS y Cierre Inmutable'
    },
    {
      type: 'p',
      text: 'El registro de la evolución constituye el núcleo legal del expediente odontológico conforme a la Resolución 1995 de 1999 y Resolución 3100 de 2019:'
    },
    {
      type: 'ordered_list',
      items: [
        'Diligenciamiento de Notas de Evolución: Se redacta el resumen de las acciones clínicas ejecutadas durante la sesión de atención.',
        'Diagnósticos (CIE-10): Búsqueda predictiva del diagnóstico principal (ej. K021 Caries de la dentina, K040 Pulpitis, K053 Periodontitis crónica) y diagnósticos relacionados.',
        'Procedimientos (CUPS): Selección de los códigos CUPS ejecutados (ej. 890203 Consulta de primera vez por odontología general, 232101 Obturación dental con resina de fotocurado, 237101 Tratamiento de conducto radicular unirradicular).',
        'Prescripción Farmacológica: Registro de medicamentos formulados con principio activo, concentración, forma farmacéutica, dosis, frecuencia y duración del tratamiento.',
        'Botón "Guardar Borrador": Permite almacenar temporalmente la información mientras la atención está en curso. La evolución permanece en estado borrador y puede seguir editándose.',
        'Botón "Certificar y Cerrar Evolución": Al culminar el acto clínico, el odontólogo presiona este botón. El sistema despliega un modal de confirmación donde solicita la clave de acceso personal del profesional tratante (Firma Electrónica Confiable bajo Decreto 2364 de 2012).',
        'Bloqueo Automático RLS: Una vez validada la clave, el sistema calcula el resumen criptográfico SHA-256 del contenido, estampa la fecha y hora UTC del servidor, asocia la tarjeta profesional y cambia el estado a "cerrada". A partir de ese milisegundo, el motor PostgreSQL bloquea irrevocablemente cualquier comando UPDATE o DELETE sobre el folio.',
        'Botón "Agregar Adenda": Si con posterioridad se requiere realizar una aclaración o corrección, la ley prohíbe reabrir o enmendar el folio original. El doctor utiliza el botón "Agregar Adenda", ingresando el motivo de la aclaración y el nuevo texto, el cual se almacena encadenado en la tabla evolution_addenda con su propio sello temporal y firma.'
      ]
    },
    {
      type: 'image',
      buffer: imgEvolucionBuffer,
      caption: 'Figura 1: Módulo Asistencial OdontoCloud — Diligenciamiento de Folios Clínicos, Diagnóstico CIE-10 y Procedimientos CUPS'
    },
    {
      type: 'h1',
      text: '8. Consentimientos Informados Digitales con Firma Vectorial'
    },
    {
      type: 'p',
      text: 'En concordancia con el Código de Ética Odontológica (Ley 35 de 1989) y la Resolución 3100 de 2019, ningún procedimiento invasivo o que implique riesgos para el paciente puede llevarse a cabo sin su consentimiento informado previo:'
    },
    {
      type: 'ordered_list',
      items: [
        'Desde el expediente del paciente, ingresar a la pestaña "Consentimientos Informados" y pulsar "+ Nuevo Consentimiento".',
        'Seleccionar la plantilla correspondiente al tratamiento a realizar (Operatoria Dental, Endodoncia, Periodoncia, Cirugía Oral y Exodoncia, Ortodoncia, Implantología o Rehabilitación Protésica).',
        'El sistema carga automáticamente el texto legal estandarizado que describe el procedimiento, beneficios esperados, riesgos potenciales, alternativas terapéuticas y consecuencias de no tratarse.',
        'El paciente (o su representante legal en caso de menores) lee el documento en la pantalla del computador o en una tableta digitalizadora.',
        'En el panel inferior, el paciente plasma su firma manuscrita directamente sobre la pantalla táctil mediante trazo vectorial biométrico (captura de trazo, coordenadas y presión).',
        'El odontólogo confirma y firma el consentimiento con su clave profesional. El documento queda sellado de forma inmutable, incorporándose al expediente clínico con fecha y hora exacta.'
      ]
    },
    {
      type: 'h1',
      text: '9. Módulo de Caja, Facturación Electrónica DIAN en Salud y Cobros'
    },
    {
      type: 'p',
      text: 'OdontoCloud integra de forma sincrónica el ciclo asistencial con el ciclo administrativo y tributario:'
    },
    {
      type: 'list',
      items: [
        'Emisión de Factura Electrónica de Venta (FEV) en Salud: Integrada con la pasarela oficial Factus. Al facturar una atención, el sistema envía sincrónicamente los datos estructurados a la DIAN, obteniendo en segundos el Código Único de Facturación Electrónica (CUFE) y el código bidimensional QR.',
        'Soporte Gráfico PDF de la Factura: Generación automática de la representación gráfica oficial con desglose de procedimientos, copagos, cuotas moderadoras, retenciones en la fuente e IVA.',
        'Recibos de Caja y Medios de Pago: Registro de cobros mediante efectivo, transferencia bancaria, tarjetas de crédito/débito y pasarelas de pago. Control de abonos y saldos pendientes por paciente.',
        'Notas Crédito y Débito: Emisión de notas crédito electrónicas asociadas al CUFE de la factura original para devoluciones o correcciones contables sin alterar la historia clínica.'
      ]
    },
    {
      type: 'h1',
      text: '10. Configuración e Interoperabilidad IHCE MinSalud (Resolución 1888 de 2025)'
    },
    {
      type: 'p',
      text: 'OdontoCloud cuenta con el módulo de Interoperabilidad para la Historia Clínica Electrónica nacional conforme al estándar HL7 FHIR R4 definido por el Ministerio de Salud y Protección Social:'
    },
    {
      type: 'image',
      buffer: imgConfigBuffer,
      caption: 'Figura 2: Panel de Configuración de Interoperabilidad IHCE — Registro y Cifrado AES-256-GCM de Credenciales Ministeriales'
    },
    {
      type: 'p',
      text: 'Paso a paso para la configuración técnica de la interoperabilidad ministerial:'
    },
    {
      type: 'ordered_list',
      items: [
        'Ingresar con rol Administrador de Clínica al menú "Configuración" -> "Interoperabilidad IHCE".',
        'Ingresar el Código de Habilitación REPS de la clínica (12 dígitos numéricos asignados por la Secretaría de Salud).',
        'Ingresar las credenciales entregadas por MinSalud para la pasarela ministerial: Client ID (UUID), Client Secret y Ocp-Apim-Subscription-Key (clave de suscripción de API Management).',
        'Pulsar el botón "Guardar Configuración". El backend de OdontoCloud cifra inmediatamente los secretos con AES-256-GCM antes de persistirlos en la base de datos.',
        'Pulsar el botón "Probar Conexión OAuth2". El sistema ejecuta una petición en tiempo real contra login.microsoftonline.com; si las credenciales son correctas, mostrará el mensaje "Conexión Exitosa (HTTP 200)" indicando que el canal de autenticación está activo.'
      ]
    },
    {
      type: 'h2',
      text: '10.1 Bandeja de Transmisiones Asíncronas (Cola Outbox)'
    },
    {
      type: 'p',
      text: 'Para garantizar que una lentitud o caída de la pasarela ministerial no paralice la atención en el consultorio, OdontoCloud utiliza la arquitectura Transactional Outbox:'
    },
    {
      type: 'image',
      buffer: imgOutboxBuffer,
      tag: '[DEMOSTRACIÓN / AMBIENTE DE PRUEBAS PREPRODUCCIÓN - DATO SINTÉTICO DE ENSAYO]',
      caption: 'Figura 3: Bandeja Outbox OdontoCloud — Registro de Paquete Asistencial en Ambiente de Pruebas Sandbox'
    },
    {
      type: 'callout',
      style: 'warning',
      title: '⚠️ Advertencia Regulatoria sobre Radicados y Ambientes de Ensayo',
      text: 'La captura de pantalla y los datos mostrados en la Figura 3 corresponden estrictamente a un ambiente de pruebas sandbox preproducción con datos sintéticos de ensayo (como el identificador de prueba RDA-COL-2026-89087642). No constituyen una evidencia de radicación oficial en el entorno de producción ministerial. La homologación final para producción por parte del Ministerio de Salud se encuentra en trámite conforme al calendario nacional de la Resolución 1888 de 2025.'
    },
    {
      type: 'h1',
      text: '11. Guía de Errores Frecuentes, Preguntas Habituales y Soluciones Rápidas'
    },
    {
      type: 'table',
      headers: [
        { text: 'Situación / Mensaje de Error', width: '25%' },
        { text: 'Causa Técnica Identificada', width: '35%' },
        { text: 'Procedimiento de Solución Inmediata', width: '40%' }
      ],
      rows: [
        [
          'Credenciales inválidas al iniciar sesión',
          'El usuario o contraseña ingresado es incorrecto o la cuenta no ha sido activada.',
          'Verificar mayúsculas/minúsculas. Utilizar la opción "¿Olvidó su contraseña?" para recibir un enlace de restablecimiento seguro en su correo corporativo.'
        ],
        [
          'Sesión expirada por inactividad',
          'El token JWT de sesión ha caducado por motivos de seguridad tras un periodo de inactividad.',
          'Volver a ingresar las credenciales. Los borradores de evolución no guardados previamente no se envían al servidor; se recomienda pulsar "Guardar Borrador" periódicamente.'
        ],
        [
          'Falla general de conexión a Internet en la clínica',
          'Interrupción del servicio de proveedor local de internet (ISP) en las instalaciones de la clínica.',
          'Activar inmediatamente el Plan de Contingencia Asistencial en Papel (DOC-08). Registrar la atención en los formatos físicos impresos de contingencia y transcribirlos al sistema dentro de las 24 horas siguientes al restablecimiento.'
        ],
        [
          'La base de datos rechaza la edición de una evolución',
          'El folio ya fue formalmente cerrado y certificado con firma electrónica.',
          'Comportamiento normal por diseño (Res. 1995/1999 y RLS). Si se requiere aclarar o complementar el texto, utilizar obligatoriamente el botón "Agregar Adenda".'
        ],
        [
          'Rechazo de Factura Electrónica por la DIAN',
          'Inconsistencia en los datos del adquirente (ej. tipo de documento no coincide con el número, o falta dirección fiscal).',
          'Revisar la ficha del paciente, corregir el tipo o número de identificación tributaria y reintentar la emisión sincrónica desde el módulo de caja.'
        ],
        [
          'Error de Conexión en Interoperabilidad IHCE',
          'El token de suscripción APIM o el Client Secret ministerial ingresado en configuración ha vencido.',
          'El Administrador debe ingresar al panel de MinSalud, regenerar las credenciales del Sandbox y actualizarlas en el menú "Configuración -> Interoperabilidad IHCE".'
        ],
        [
          'Firma de consentimiento no se registra en pantalla táctil',
          'Falta de permisos del navegador para captura táctil o baja sensibilidad del dispositivo.',
          'Comprobar la calibración de la pantalla o lápiz táctil. Si persiste, utilizar un ratón convencional o tableta auxiliar conectada por USB.'
        ],
        [
          'Atención en cola Outbox en estado "ERROR"',
          'La pasarela ministerial de MinSalud estuvo temporalmente inaccesible durante el intento de despacho.',
          'No se requiere acción asistencial. El despachador automático en segundo plano reintentará la transmisión con backoff exponencial. Si persiste, pulsar "Reintentar Despacho".'
        ]
      ]
    }
  ]
};
