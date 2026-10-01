// Manual público de uso: nunca incluir datos de pacientes, credenciales ni datos de otra app.
// Revisar las fuentes de cada guía cuando cambie una pantalla.
export const KNOWLEDGE_VERSION = '2026-09-29';
const guide = (id, category, title, keywords, source, steps, note = '') => ({
  id, category, title, keywords, source, steps, note,
});export const HELP_GUIDES = [
  guide('citas', 'Agenda', 'Apartar una cita nueva', 'agendar reservar apartar cita turno agenda nueva', 'src/modules/agenda/components/AppointmentModal.jsx', [
    'Entra a [Agenda] en el menú lateral y haz clic sobre el recuadro del calendario correspondiente a la hora y sillón deseados.',
    'En [Identidad del Paciente], busca por cédula o nombre y selecciona al paciente. Si es nuevo, pulsa la opción de crear paciente y completa los campos obligatorios: nombres, apellidos, documento, celular, fecha de nacimiento y sexo.',
    'En [Detalles de la Cita], confirma la [Sede], selecciona el [Profesional] (odontólogo) y el [Espacio Clínico] (sillón o consultorio).',
    'Define la [Fecha de Cita], la [Hora] y la [Duración Estimada] en minutos (por defecto 30 min). Puedes marcar [Valoración] o [Control] si corresponde.',
    'Añade comentarios o el motivo de consulta y verifica que el [Estado de la Cita] esté en [Sin Confirmar].',
    'Pulsa el botón verde inferior [CONFIRMAR REGISTRO]. El sistema validará que no haya cruces de horarios con el doctor o el sillón y guardará la cita.',
  ], 'Si sales sin guardar habiendo hecho cambios, el sistema mostrará la alerta: ¿Descartar Cambios? con las opciones [Descartar y Cerrar] o [Seguir Editando]. Las citas con más de 30 días de antigüedad están bloqueadas bajo el estado CITA CERRADA (+1 MES).'),
  guide('editar-cita', 'Agenda', 'Modificar o cancelar una cita', 'reprogramar cambiar cancelar eliminar modificar cita', 'src/modules/agenda/components/AppointmentModal.jsx', [
    'Localiza y haz clic sobre la cita en el calendario de [Agenda].',
    'Para reprogramar: cambia la fecha, hora, duración o profesional y pulsa [CONFIRMAR REGISTRO].',
    'Para cambiar de estado: despliega [Estado de la Cita] y selecciona: Sin Confirmar, Confirmada, En espera (en sala), Atendido o Cancelado.',
    'Pulsa el botón verde [CONFIRMAR REGISTRO] para guardar los cambios y actualizar el color en la agenda.',
    'Para borrar definitivamente la cita: pulsa el botón rojo [ELIMINAR CITA] y confirma en el cuadro rojo con [Sí, Eliminar].',
  ], 'No elimines una cita para indicar que el paciente no asistió; usa el estado [Cancelado] o [No asiste] para conservar la estadística.'),
  guide('whatsapp-cita', 'Agenda', 'Enviar recordatorio por WhatsApp', 'whatsapp recordatorio cita mensaje confirmacion enviar', 'src/modules/agenda/Agenda.jsx', [
    'En la vista de [Agenda], localiza la tarjeta de la cita del paciente.',
    'Haz clic sobre el icono verde de [WhatsApp] en la tarjeta de la cita.',
    'El sistema generará el texto con el nombre del paciente, fecha, hora, doctor y clínica, abriendo WhatsApp Web o tu app de WhatsApp.',
    'Revisa el mensaje y haz clic en enviar en WhatsApp.',
  ], 'Hacer clic en el icono prepara el mensaje con los datos oficiales de la cita. El envío se finaliza desde WhatsApp.'),
  guide('horarios', 'Agenda', 'Configurar horarios y disponibilidad', 'horarios disponibilidad turnos profesional no aparece espacio clinico sillon', 'src/modules/administracion/views/GestionAgenda.jsx', [
    'Entra a [Administración] > [Gestión Agenda] para configurar los turnos y horarios de atención.',
    'Comprueba el profesional, la sede y el período que estás configurando.',
    'Revisa también [Configuración] > [Recursos físicos] para verificar que los sillones estén activos, y [Configuración] > [Usuarios] para el odontólogo.',
    'Vuelve a [Agenda] y comprueba los espacios disponibles.',
  ]),
  guide('pacientes', 'Pacientes', 'Crear o buscar un paciente', 'crear registrar nuevo buscar paciente documento celular', 'src/modules/pacientes/components/PatientList.jsx', [
    'Entra a [Pacientes] en el menú lateral. En la barra superior busca primero por documento, nombre o celular para evitar registros duplicados.',
    'Si no existe, haz clic en el botón verde superior [+ Nuevo Paciente].',
    'Completa los campos obligatorios: Tipo de documento, Número de documento, Nombres, Apellidos, Celular, Fecha de nacimiento y Sexo.',
    'Opcionalmente añade correo, dirección, EPS y ocupación.',
    'Pulsa [Guardar]. El paciente quedará registrado y listo para agendar citas o abrir su expediente clínico.',
  ]),
  guide('importar-pacientes', 'Pacientes', 'Importar pacientes (Excel / ATM)', 'importar pacientes excel csv atm carga masiva', 'src/modules/pacientes/components/ImportadorPacientes.jsx', [
    'En [Pacientes], haz clic en el botón [Importar Pacientes (Excel / ATM)].',
    'Selecciona o arrastra el archivo de Excel / CSV siguiendo las columnas requeridas.',
    'Revisa la previsualización y validaciones del importador antes de confirmar.',
    'Pulsa importar y comprueba los registros importados en el listado de pacientes.',
  ]),
  guide('ficha-paciente', 'Pacientes', 'Ficha clínica y asignación de doctores', 'editar datos personales eps aseguramiento beneficiarios convenio profesionales paciente', 'src/modules/pacientes/components/PatientDetails.jsx', [
    'Busca al paciente en [Pacientes] y haz clic sobre su nombre para abrir su Ficha Integral.',
    'En la barra lateral izquierda encontrarás las 17 pestañas del expediente (Datos personales, EPS, Rx / Imágenes / Doc, Profesionales, Citas, Doc. Clínicos, Odontogramas, Presupuestos, Evoluciones, Pagos, etc.).',
    'Para que un odontólogo pueda registrar evoluciones, ve a la pestaña [Profesionales] y vincúlalo como doctor tratante.',
    'Usa el botón [Guardar] cuando modifiques datos personales o de aseguramiento.',
  ], 'Regla clínica: Para que un doctor pueda evolucionar a un paciente, debe estar asignado en la pestaña [Profesionales]. De lo contrario, el sistema mostrará: No estás asignado como profesional tratante.'),
  guide('historia', 'Clínica', 'Consultar documentos e historia clínica', 'historia clinica anamnesis documentos clinicos antecedentes', 'src/modules/pacientes/components/HistoriaClinicaContainer.jsx', [
    'Abre la ficha del paciente desde [Pacientes].',
    'En el menú lateral, selecciona [Doc. Clínicos].',
    'Selecciona el formulario clínico (Anamnesis, Consentimiento Informado o Historia General) y completa la información requerida.',
    'Revisa las firmas del paciente y del profesional antes de guardar.',
  ]),
  guide('odontograma', 'Clínica', 'Odontograma digital y sincronización con presupuesto', 'odontograma dientes diente superficies hallazgos caries', 'src/modules/odontograma/Odontograma.jsx', [
    'Abre la ficha del paciente y haz clic en la pestaña [Odontogramas].',
    'En el listado inicial, pulsa [+ Nuevo Odontograma] para abrir el editor interactivo.',
    'Selecciona el [Tipo de Dentición] (Completo, Adulto o Infantil) y si deseas, filtra por superficie (Vestibular, Palatina, Mesial, Distal u Oclusal).',
    'En la barra de herramientas, elige el hallazgo (ej: Caries, Obturación, Corona, Endodoncia, Extracción, Implante o Borrador).',
    'Haz clic sobre la cara o pieza dental correspondiente. A la derecha se irá listando el plan de tratamiento con los dientes y superficies marcados.',
    'Para continuar después sin cerrar el caso, pulsa [Guardar Progreso] (estado Abierto). Para finalizar y mandar a cotizar, pulsa [Finalizar Odontograma].',
  ], 'Al pulsar [Finalizar Odontograma], todos los hallazgos y tratamientos planificados se envían automáticamente al módulo de [Presupuestos & planes] del paciente.'),
  guide('periodontograma', 'Clínica', 'Consultar y registrar el periodontograma', 'periodontograma periodontal sondaje', 'src/modules/odontograma/Periodontograma.jsx', [
    'Abre la ficha del paciente y selecciona la pestaña [Periodontogramas].',
    'Crea un nuevo registro y digita los valores de profundidad de sondaje, margen gingival y sangrado en las piezas correspondientes.',
    'Revisa el gráfico periodontal y pulsa guardar.',
  ]),
  guide('evoluciones', 'Clínica', 'Registrar evolución odontológica y diagnósticos CIE-10', 'evolucion evoluciones remision nota aclaratoria cie10 rips copilot', 'src/modules/pacientes/components/EvolucionesTab.jsx', [
    'Abre la ficha del paciente y entra a la pestaña [Evoluciones & Remis].',
    'Haz clic en el botón [+ Nueva Evolución] (recuerda que debes estar asignado como doctor tratante en la pestaña Profesionales).',
    'En el formulario, selecciona el procedimiento realizado y busca el diagnóstico en [Diagnóstico CIE-10].',
    'Redacta la nota de evolución o utiliza el [Copiloto IA] para redactar y estructurar la nota clínica.',
    'Si aplicaste anestésicos, selecciona el producto (ej: Lidocaína 2%) y la vía de administración (Infiltrativa, Troncular).',
    'Pulsa [Guardar Evolución]. Si necesitas corregir un detalle posterior, utiliza la pestaña [Nota Aclaratoria].',
  ], 'El sistema valida que solo el profesional tratante asignado pueda registrar evoluciones, y que las correcciones queden como notas aclaratorias para cumplir la normatividad de historia clínica.'),
  guide('presupuestos', 'Clínica', 'Crear presupuesto y cotizaciones', 'presupuesto plan tratamiento cotizacion procedimientos', 'src/modules/pacientes/components/PlanEditor.jsx', [
    'Abre la ficha del paciente y entra a [Presupuestos & planes].',
    'Pulsa [+ Nuevo Plan] para crear una cotización.',
    'Usa [Importar de Odontograma] para cargar los tratamientos diagnosticados en el odontograma, o [Añadir Procedimiento] para buscar del tarifario de la clínica.',
    'Ajusta cantidades, coberturas/copagos, descuentos y profesional responsable.',
    'Pulsa [Guardar Plan]. Puedes imprimir la cotización en PDF con logo de la clínica o evolucionar tratamientos realizados directamente desde la lista.',
  ]),
  guide('archivos', 'Clínica', 'Radiografías, imágenes y documentos', 'radiografia imagen adjunto archivo rx documento subir', 'src/modules/pacientes/components/PatientRxTab.jsx', [
    'Abre la ficha del paciente y selecciona [Rx / Imágenes / Doc].',
    'Haz clic en subir archivo para adjuntar radiografías panorámicas, periapicales, fotos clínicas o documentos PDF.',
    'Organiza los archivos por fecha y categoría clínica.',
  ]),
  guide('abrir-caja', 'Caja', 'Apertura de caja al inicio del turno', 'abrir apertura caja base inicial', 'src/modules/caja/components/AbrirCajaModal.jsx', [
    'Entra a [Caja] en el menú lateral y haz clic en el botón superior [Abrir Caja].',
    'Confirma el nombre de la caja (ej: Caja Principal).',
    'En el campo obligatorio [Ajustar Base Inicial], digita el monto de efectivo con el que inicias el turno (en pesos COP).',
    'Escribe observaciones si corresponde (ej: Turno mañana) y haz clic en el botón verde [Abrir Caja].',
  ], 'El sistema no permite abrir una segunda caja si el usuario ya tiene una caja abierta activa sin cerrar.'),
  guide('pagos-paciente', 'Caja', 'Registrar pago o abono de un paciente', 'cobrar abonar pago paciente recaudo abono', 'src/modules/pacientes/components/PagoTab.jsx', [
    'Abre la ficha del paciente y entra a la pestaña [Realizar pago].',
    'Selecciona el plan o procedimiento al que se le aplicará el abono.',
    'Ingresa el monto del abono en pesos (COP).',
    'Selecciona el [Método de Pago]: Efectivo, Tarjeta, Transferencia, Nequi, Daviplata o PSE.',
    'Si seleccionas Transferencia, Nequi o Daviplata, el campo [Número de Referencia] es obligatorio.',
    'Selecciona el profesional y haz clic en [Registrar Pago]. El sistema actualizará el saldo y registrará el ingreso en la caja abierta.',
  ], 'Para registrar un pago, la sede debe tener una caja abierta activa en el turno.'),
  guide('cerrar-caja', 'Caja', 'Cerrar y cuadrar la caja (Arqueo diario)', 'cerrar cierre arqueo cuadrar caja efectivo contado diferencia', 'src/modules/caja/components/CerrarCajaModal.jsx', [
    'En [Caja], localiza tu caja abierta y haz clic en [Cerrar Caja].',
    'Revisa el resumen financiero: Base Inicial + Ingresos - Egresos = [Saldo Teórico].',
    'En [Efectivo Contado], digita el total de billetes y monedas que contaste físicamente.',
    'En [Otros Medios], digita el valor total de los vouchers de datáfono y transferencias.',
    'Revisa la [Diferencia] (sobrante o faltante). Añade observaciones si hubo alguna novedad.',
    'Marca la casilla obligatoria: Declaro que he realizado el conteo físico detallado...',
    'Haz clic en el botón rojo [Cerrar Caja Definitivamente].',
  ], 'El botón de cierre definitivo solo se habilita tras marcar la confirmación del conteo físico.'),
  guide('facturas', 'Facturación', 'Factura de venta y facturación electrónica', 'factura venta electronica dian factus cufe emitir', 'src/modules/administracion/views/FacturacionHub.jsx', [
    'Entra a Administración > Facturación > Factura de venta.',
    'Revisa los datos del cliente, los conceptos y los valores en el módulo de facturación.',
    'Para facturación electrónica, comprueba primero Configuración > Facturación electrónica y los consecutivos.',
    'Después de emitir, revisa el estado y los mensajes de respuesta. Si falla, consulta Reportes > Log de errores de facturación.',
  ], 'No se debe asumir aceptación DIAN, CUFE o envío por correo hasta que el sistema confirme el resultado.'),
  guide('recibos', 'Facturación', 'Recibos de caja y saldos a favor', 'recibo caja saldo favor anticipo', 'src/modules/administracion/views/FacturacionHub.jsx', [
    'Entra a Administración > Facturación.',
    'Selecciona Recibo de caja para los comprobantes de ingreso o Saldo a favor para revisar los abonos correspondientes.',
    'Abre el registro o el formulario de creación y verifica tercero, valor y referencias antes de confirmar.',
  ]),
  guide('notas', 'Facturación', 'Notas crédito, débito y liquidaciones', 'nota credito debito liquidacion anulacion descuento', 'src/modules/administracion/views/FacturacionHub.jsx', [
    'Entra a Administración > Facturación y selecciona Nota crédito, Nota débito o Liquidaciones.',
    'Identifica el documento o tratamiento relacionado y revisa el motivo y los importes.',
    'Comprueba el resultado y el estado del documento después de registrar la operación.',
  ], 'La ayuda no anula ni modifica documentos por sí sola.'),
  guide('proveedores', 'Facturación', 'Pagos a proveedores y compras', 'proveedor egreso compra orden factura compra pagar proveedor', 'src/modules/administracion/views/FacturacionHub.jsx', [
    'Revisa el proveedor en Administración > Terceros.',
    'En Administración > Facturación, usa Órdenes de compra para solicitudes o Facturas de compra para documentos recibidos.',
    'En Pagos, registra el egreso con el tercero, los conceptos o facturas y la cuenta correspondientes.',
    'Revisa los importes antes de guardar y verifica el comprobante resultante.',
  ]),
  guide('traslados', 'Facturación', 'Trasladar dinero entre cuentas', 'traslado transferir cuentas banco movimiento', 'src/modules/facturacion/traslados/TrasladosList.jsx', [
    'Entra a Administración > Facturación > Traslados.',
    'Revisa los movimientos registrados y utiliza el formulario disponible para un nuevo traslado.',
    'Verifica cuenta de origen, destino e importe antes de confirmar.',
  ]),
  guide('inventario', 'Inventario', 'Consultar productos y existencias', 'inventario stock producto existencias almacen', 'src/modules/inventario/Inventario.jsx', [
    'Entra a Inventario.',
    'Consulta Listado de inventario para revisar existencias y Listado de movimientos para revisar entradas y salidas.',
    'Comprueba el almacén y los filtros disponibles antes de comparar cantidades.',
  ]),
  guide('movimientos-inventario', 'Inventario', 'Recepción, salida y ajustes de inventario', 'recepcion entrada salida ajuste inventario insumo', 'src/modules/inventario/Inventario.jsx', [
    'Entra a Inventario y elige Recepción producto, Salida producto o Ajustes de inventario según la operación.',
    'Selecciona el producto, almacén y cantidad en el formulario correspondiente.',
    'Revisa los datos y registra el movimiento.',
    'Comprueba el resultado en Listado de inventario y Listado de movimientos.',
  ]),
  guide('reportes', 'Reportes', 'Encontrar reportes e indicadores', 'reporte informe indicador estadistica ventas morbilidad cumpleanos', 'src/modules/reportes/Reportes.jsx', [
    'Entra a Reportes y selecciona Indicadores o el reporte específico.',
    'Hay reportes de pacientes, planes de tratamiento, facturación, convenios, ventas, medicamentos, cumpleaños, citas, morbilidad, consultas y evoluciones.',
    'Ajusta los filtros que ofrezca el reporte y revisa el período antes de interpretar o exportar sus resultados.',
  ]),
  guide('rips', 'Administración', 'Generar y revisar RIPS', 'rips muv json fev validacion cuv', 'src/modules/rips/RipsGenerator.jsx', [
    'Entra a Administración > RIPS JSON y selecciona los datos o documentos que vas a procesar.',
    'Revisa la validación previa y corrige los errores que señale el módulo.',
    'Distingue la descarga preliminar local de la opción Validar y enviar al MUV.',
    'Consulta el resultado de validación antes de dar el envío por aceptado.',
  ], 'Un JSON preliminar no equivale a un envío oficial aceptado.'),
  guide('terceros', 'Administración', 'Gestionar terceros y convenios', 'tercero cliente proveedor convenio descuento', 'src/modules/administracion/AdministracionRouter.jsx', [
    'En Administración, entra a Terceros para proveedores y clientes, o a Convenios para su gestión.',
    'Busca el registro existente antes de crear otro.',
    'Revisa identificación y datos del formulario; guarda y verifica el registro.',
  ]),
  guide('esterilizacion', 'Administración', 'Registrar esterilización', 'esterilizacion autoclave carga ciclo', 'src/modules/esterilizacion/Esterilizacion.jsx', [
    'Entra a Administración > Esterilización.',
    'Abre el formulario del ciclo y completa los campos de control que presenta la pantalla.',
    'Revisa los datos antes de pulsar Guardar o Actualizar.',
  ]),
  guide('residuos', 'Administración', 'Consultar gestión de residuos', 'residuo hospitalario ambiental desecho', 'src/modules/administracion/AdministracionRouter.jsx', [
    'Entra a Administración > Residuos Hosp.',
    'Selecciona la operación de gestión o configuración que corresponda.',
    'Revisa los campos y controles de esa pantalla antes de registrar la información.',
  ]),
  guide('sedes', 'Configuración', 'Configurar sedes y espacios clínicos', 'sede sucursal sillon recurso fisico espacio clinico', 'src/modules/config/ConfigRouter.jsx', [
    'Entra a Configuración > Sucursales para revisar las sedes.',
    'En Configuración > Recursos físicos, revisa los espacios de atención.',
    'Comprueba que los recursos correspondan a la sede y luego verifica su disponibilidad en Agenda.',
  ]),
  guide('usuarios', 'Configuración', 'Usuarios, perfiles y permisos', 'usuario perfil permiso acceso rol no veo boton', 'src/modules/config/ConfigRouter.jsx', [
    'Con un perfil autorizado, entra a Configuración > Usuarios para gestionar las cuentas.',
    'En Configuración > Perfiles revisa los permisos del perfil asignado.',
    'Si falta una opción o aparece bloqueada, solicita al administrador que revise tu perfil y la acción permitida.',
  ], 'El asistente explica opciones, pero no concede permisos ni cambia roles.'),
  guide('empresa', 'Configuración', 'Datos de la clínica y configuración inicial', 'empresa clinica logo nit direccion configuracion inicial asistente', 'src/modules/config/ConfigMenu.jsx', [
    'Entra a Configuración > Asistente de Configuración para revisar la preparación inicial.',
    'Utiliza Datos Básicos para revisar la información de la clínica y el logo.',
    'Completa las secciones de sedes, usuarios y catálogos necesarias antes de operar.',
  ]),
  guide('precios', 'Configuración', 'Listas de precios y planes', 'precio tarifa lista planes copago', 'src/modules/config/ConfigRouter.jsx', [
    'Entra a Configuración > Lista de precios o Planes según lo que necesites configurar.',
    'Revisa los conceptos y valores aplicables antes de guardar cambios.',
    'Para copagos, utiliza la sección Tarifas copago si tu perfil tiene acceso.',
  ]),
  guide('catalogos', 'Configuración', 'Catálogos financieros y de inventario', 'banco metodo pago condicion pago impuesto consecutivo catalogo cuenta categoria almacen', 'src/modules/config/ConfigMenu.jsx', [
    'Abre Configuración y selecciona el catálogo correspondiente: Bancos, Métodos de pago, Condiciones de pago, Impuestos, Consecutivos o Catálogo de cuentas.',
    'Para inventario, revisa Almacenes y Categorías inventario.',
    'Consulta los registros existentes y revisa los campos antes de guardar modificaciones.',
  ]),
  guide('formularios', 'Configuración', 'Formularios y plantillas clínicas', 'formulario campo plantilla consentimiento especialidad parametro carga', 'src/modules/config/ConfigRouter.jsx', [
    'En Configuración, abre Formulario de pacientes para revisar los campos de registro.',
    'Usa Plantillas Doc. Clínicos para las plantillas clínicas y la sección Consentimientos cuando corresponda.',
    'Revisa Especialidades, Parámetros o Cargas según la configuración que necesites.',
  ]),
  guide('suscripcion', 'Configuración', 'Consultar la suscripción', 'suscripcion plan contratado limite cuota renovar', 'src/modules/config/ConfigSuscripcion.jsx', [
    'Entra a Configuración > Suscripción.',
    'Revisa el plan y la información disponible para tu clínica.',
    'Para dudas sobre una cuota o cambio, comprueba las opciones de esa pantalla con el administrador.',
  ], 'Este asistente no conoce el saldo ni las condiciones comerciales particulares de la clínica.'),
  guide('imprimir-agenda', 'Agenda', 'Imprimir la agenda', 'imprimir agenda listado citas impresion', 'src/modules/agenda/Agenda.jsx', [
    'Abre Agenda y selecciona el día y los filtros que necesitas consultar.',
    'Pulsa el botón con el título Imprimir Agenda en la cabecera.',
    'Revisa la información presentada antes de completar la impresión.',
  ]),
  guide('editor-web', 'Configuración', 'Editar la página web de la clínica', 'web pagina sitio portada logo servicios equipo publicar', 'src/modules/cms/WebsiteEditor.jsx', [
    'En Configuración, abre Editor Web si tu plan y perfil lo permiten.',
    'Selecciona Inicio / Portada, Estilo y Marca, Identidad y Misión, Funcionalidades y Servicios, Nuestro Equipo, Testimonios o Contacto / Footer.',
    'Revisa el contenido y los cambios en el editor.',
    'Pulsa Publicar Cambios cuando quieras guardar la actualización para la web.',
  ]),
  guide('portal', 'Pacientes', 'Portal del paciente y solicitudes de cita', 'portal paciente web solicitud cita', 'src/modules/portal/PatientPortal.jsx', [
    'Abre el portal de la clínica y utiliza el acceso previsto para el paciente.',
    'Para solicitar una cita, completa fecha, motivo y celular en el formulario del portal.',
    'Revisa el resultado de la solicitud; no asumas que una solicitud ya es una cita confirmada.',
  ]),
  guide('logs', 'Reportes', 'Consultar errores y registros de comunicación', 'error whatsapp log interoperabilidad ihce mensaje envio', 'src/modules/reportes/Reportes.jsx', [
    'Entra a Reportes.',
    'Selecciona Log de errores de facturación, Log WhatsApp Business API o Log interoperabilidad (IHCE) según el problema.',
    'Revisa el estado y el mensaje registrado para identificar el siguiente paso. Comparte con soporte una descripción sin datos sensibles.',
  ], 'La ayuda no reenvía mensajes ni garantiza que una integración esté activa.'),
  guide('ayuda-ia', 'Ayuda', 'Qué puede hacer este asistente', 'ayuda asistente ollama inteligencia artificial gemini sistema', 'src/components/OdontoHelpAssistantModal.jsx', [
    'Pregunta cómo utilizar una función de OdontoCloud o busca una guía en la biblioteca.',
    'Consulta las guías de referencia que aparecen debajo de la respuesta.',
    'Si la IA local no está disponible, puedes seguir consultando las guías del sistema.',
  ], 'Esta ayuda no ejecuta operaciones, no accede a expedientes y no utiliza documentación de Edunexus. Las otras funciones de IA clínica tienen su propia configuración.'),
  guide('planes-suscripcion', 'Suscripción', 'Planes y Precios Oficiales de OdontoCloud', 'planes precios suscripcion plan mensual anual tarifas software consultorio clinica enterprise valor cuanto cuesta suscripcion odontocloud', 'src/pages/landing/PricingPage.jsx', [
    'Plan Consultorio ($79.900 COP/mes): Para 1 a 3 usuarios. Incluye agenda inteligente con recordatorios por WhatsApp, historia clínica digital completa, odontograma interactivo, consentimientos informados, control de caja y pacientes ilimitados.',
    'Plan Clínica ($110.000 COP/mes — Más Popular): Para hasta 5 usuarios. Incluye Facturación Electrónica DIAN oficial (300 docs/año), RIPS JSON (Resolución 2275), sitio web corporativo (CMS), múltiples sedes y soporte prioritario. ¡Tiene 30 días de prueba gratis!',
    'Plan Enterprise ($199.000 COP/mes): Para redes multi-sede, cadenas e IPS odontológicas. Hasta 11 doctores, 1.000 facturas DIAN/año, roles avanzados de auditoría, comisiones médicas y migración asistida de datos.',
    'Todos los planes incluyen almacenamiento en la nube, copias de seguridad continuas y acceso seguro desde cualquier dispositivo.',
  ]),
  guide('prueba-gratis', 'Prueba Gratuita', 'Iniciar Prueba Gratuita de 30 Días', 'prueba gratis demostracion demo probar 30 dias sin costo cuenta registro registrarme empezar comenzar activar', 'src/components/landing/TrialModal.jsx', [
    'Haz clic en el botón [Solicitar demostración gratuita] o [Comenzar Prueba Gratis] en la página principal.',
    'Completa tus datos básicos: Tu nombre, nombre de la clínica, correo electrónico y contraseña deseada.',
    'Selecciona el [Plan Clínica] recomendado para experimentar todas las funciones (incluyendo facturación y RIPS) por 30 días sin costo ni tarjeta de crédito.',
    'Al enviar el formulario, el equipo activará tu acceso y recibirás un correo oficial de bienvenida para empezar de inmediato.',
  ]),
  guide('facturacion-dian-rips', 'Normativa y Facturación', 'Facturación Electrónica DIAN y RIPS JSON en Colombia', 'facturacion electronica dian rips json resolucion 2275 minsalud sispro muv factus colombia norma ley', 'src/constants/MasterConfig.js', [
    'OdontoCloud está integrado nativamente con Factus, proveedor tecnológico avalado por la DIAN, permitiendo emitir facturas electrónicas, notas crédito y documentos soporte con validación previa en segundos.',
    'Genera y exporta automáticamente los archivos RIPS en formato JSON cumpliendo estrictamente con la Resolución 2275 de 2023 del Ministerio de Salud, listos para radicar en el MUV / SISPRO.',
    'Mantiene trazabilidad total: asocia cada cita y procedimiento CUPS con los diagnósticos CIE-10 del paciente y la factura generada.',
    'Disponible desde el Plan Clínica en adelante.',
  ]),
  guide('contacto-soporte', 'Atención y Ventas', 'Contacto Comercial y Asesoría Humana por WhatsApp', 'contacto whatsapp asesor soporte humano telefono numero hablar ventas comprar ayuda llamada', 'src/pages/landing/FAQPage.jsx', [
    'Si deseas una demostración guiada, resolver dudas específicas o solicitar una cotización especial, nuestro equipo humano te atiende directamente.',
    'Escríbenos a nuestra línea oficial de WhatsApp: +57 301 576 8935 (o haz clic en el botón de WhatsApp dentro del chat).',
    'También puedes escribirnos al correo oficial: bienvenido@odontocloudcolombia.com.',
    'Horario de atención: Lunes a Sábado con soporte técnico permanente para clínicas activas.',
  ]),
  guide('seguridad-migracion', 'Tecnología', 'Seguridad en la Nube y Migración de Datos', 'seguridad nube copias backup privacidad datos migrar migracion pasar datos excel importar instalar requisitos', 'src/constants/MasterConfig.js', [
    'Plataforma 100% en la nube: no requiere instalar nada ni servidores locales. Puedes ingresar desde cualquier computadora, tablet o teléfono con conexión a Internet.',
    'Seguridad de nivel hospitalario: copias de seguridad automáticas diarias, cifrado de información y aislamiento absoluto entre clínicas.',
    'Migración asistida: puedes importar tus pacientes existentes desde archivos de Excel en minutos con nuestro importador automático.',
    'Disponibilidad 24/7 y actualizaciones automáticas sin costo adicional.',
  ]),
];

export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stop = new Set('como hago para una uno unos unas los las del que con por puedo quiero necesito donde este esta esto eso cual cuando sistema paso pasos consultar utilizar usar revisar'.split(' '));
const aliases = { cancelo: 'cancelar', reprogramo: 'reprogramar', agendo: 'agendar', reservo: 'reservar', aparto: 'apartar', registro: 'registrar', guardo: 'guardar', cobro: 'cobrar', abro: 'abrir', cierro: 'cerrar', costo: 'precio', costos: 'precios', valor: 'precio', valores: 'precios', cotizacion: 'precio' };
const tokens = text => [...new Set(normalize(text).split(' ').filter(t => t.length > 2 && !stop.has(t)).map(t => aliases[t] || (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t)))];
export function searchGuides(question, previousIds = []) {
  if (/\bedunexus\b/.test(normalize(question))) return [];
  const words = tokens(question);
  const ranked = HELP_GUIDES.map(item => {
    const titleWords = tokens(item.title);
    const keyWords = tokens(item.keywords);
    const score = words.reduce((n, word) => n + (titleWords.includes(word) ? 5 : keyWords.includes(word) ? 3 : 0), 0);
    return { item, score };
  }).filter(hit => hit.score > 0).sort((a, b) => b.score - a.score);
  if (ranked.length) return ranked.filter(hit => hit.score >= Math.max(3, ranked[0].score * 0.45)).slice(0, 3).map(hit => hit.item);
  // Only carry topic context for explicit short follow-ups, not unrelated new questions.
  if (/^(y |entonces |despues|luego|como lo |donde lo |no aparece|no encuentro)/.test(normalize(question))) {
    return previousIds.slice(0, 3).map(id => HELP_GUIDES.find(item => item.id === id)).filter(Boolean);
  }
  return [];
}
export function formatGuide(item) {
  return `**${item.title}**\n${item.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}${item.note ? `\n\n${item.note}` : ''}`;
}
export function guideResponse(question, previousIds = [], reason = 'manual') {
  const guides = searchGuides(question, previousIds);
  return {
    provider: 'manual', reason, version: KNOWLEDGE_VERSION,
    answer: guides.length ? formatGuide(guides[0]) : 'No tengo una guía verificada para esa pregunta. Indica el módulo y la acción que intentas realizar, o busca un tema en la biblioteca. No puedo consultar datos particulares ni realizar operaciones desde este chat.',
    sources: guides.map(({ id, title, category }) => ({ id, title, category })),
  };
}
