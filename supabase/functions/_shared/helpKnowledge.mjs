// Manual público de uso: nunca incluir datos de pacientes, credenciales ni datos de otra app.
// Revisar las fuentes de cada guía cuando cambie una pantalla.
export const KNOWLEDGE_VERSION = '2026-09-29';
const guide = (id, category, title, keywords, source, steps, note = '', prereq = '') => ({
  id, category, title, keywords, source, steps, note, prereq,
});export const HELP_GUIDES = [
  guide('citas', 'Agenda', 'Apartar una cita nueva', 'agendar reservar apartar cita turno agenda nueva boton confirmar registro donde esta', 'src/modules/agenda/components/AppointmentModal.jsx', [
    'Haz clic en [Agenda] en el menú lateral izquierdo. En la parte superior derecha de Gestión Citas, pulsa el botón azul [+ Nueva Cita]. Se abrirá el formulario de la cita.',
    'En [Identidad del Paciente], escribe el nombre o la cédula en [BUSCAR POR NOMBRE O CC...] y haz clic en el paciente que aparece en los resultados. Si aún no está registrado, marca la casilla [Nuevo] y completa los campos obligatorios: nombres, apellidos, documento, celular, fecha de nacimiento y sexo.',
    'En [Detalles de la Cita], confirma la [Sede], selecciona el [Profesional] (odontólogo) y el [Espacio Clínico] (sillón o consultorio).',
    'Define la [Fecha de Cita], la [Hora] y la [Duración Estimada] en minutos (por defecto 30 min). Puedes marcar [Valoración] o [Control] si corresponde.',
    'Añade comentarios o el motivo de consulta y verifica que el [Estado de la Cita] esté en [Sin Confirmar].',
    'En la parte inferior derecha del formulario modal, pulsa el botón verde [CONFIRMAR REGISTRO]. El sistema validará que no haya cruces de horarios con el doctor o el sillón y guardará la cita.',
  ], 'Si sales sin guardar habiendo hecho cambios, el sistema mostrará la alerta: ¿Descartar Cambios? con las opciones [Descartar y Cerrar] o [Seguir Editando]. Las citas con más de 30 días de antigüedad están bloqueadas bajo el estado CITA CERRADA (+1 MES).',
  'Antes de apartar tu primera cita, recuerda que debes tener configurados previamente en el sistema:\n• La **Sede** activa en [Configuración] > [Sucursales].\n• El **Profesional (Odontólogo)** registrado como usuario en [Configuración] > [Usuarios].\n• El **Espacio Clínico (Sillón / Consultorio)** asignado a la sede en [Configuración] > [Recursos físicos].\n• Los **Horarios y turnos** de atención del profesional en [Administración] > [Gestión Agenda].'),
  guide('editar-cita', 'Agenda', 'Modificar o cancelar una cita', 'reprogramar cambiar cancelar eliminar modificar cita', 'src/modules/agenda/components/AppointmentModal.jsx', [
    'Localiza y haz clic sobre la cita en el calendario de [Agenda].',
    'Para reprogramar: cambia la fecha, hora, duración o profesional y pulsa [CONFIRMAR REGISTRO].',
    'Para cambiar de estado: despliega [Estado de la Cita] y selecciona: Sin Confirmar, Confirmada, En espera (en sala), Atendido o Cancelado.',
    'Pulsa el botón verde [CONFIRMAR REGISTRO] para guardar los cambios y actualizar el color en la agenda.',
    'Para borrar definitivamente la cita: pulsa el botón rojo [ELIMINAR CITA] y confirma en el cuadro rojo con [Sí, Eliminar].',
  ], 'No elimines una cita para indicar que el paciente no asistió; usa el estado [Cancelado] o [No asiste] para conservar la estadística.',
  'Antes de reprogramar, asegúrate de que el odontólogo o sillón al que vas a mover la cita tenga disponibilidad horaria en [Agenda].'),
  guide('whatsapp-cita', 'Agenda', 'Enviar recordatorio por WhatsApp', 'whatsapp recordatorio cita mensaje confirmacion enviar', 'src/modules/agenda/Agenda.jsx', [
    'En la vista de [Agenda], localiza la tarjeta de la cita del paciente.',
    'Haz clic sobre el icono verde de [WhatsApp] en la tarjeta de la cita.',
    'El sistema generará el texto con el nombre del paciente, fecha, hora, doctor y clínica, abriendo WhatsApp Web o tu app de WhatsApp.',
    'Revisa el mensaje y haz clic en enviar en WhatsApp.',
  ], 'Hacer clic en el icono prepara el mensaje con los datos oficiales de la cita. El envío se finaliza desde WhatsApp.',
  'Antes de enviar el recordatorio, verifica que el paciente tenga su número de celular completo guardado y que tengas la sesión de WhatsApp Web o tu app abierta.'),
  guide('horarios', 'Agenda', 'Configurar horarios y disponibilidad', 'horarios disponibilidad turnos profesional no aparece espacio clinico sillon', 'src/modules/administracion/views/GestionAgenda.jsx', [
    'Entra a [Administración] > [Gestión Agenda] para configurar los turnos y horarios de atención.',
    'Comprueba el profesional, la sede y el período que estás configurando.',
    'Revisa también [Configuración] > [Recursos físicos] para verificar que los sillones estén activos, y [Configuración] > [Usuarios] para el odontólogo.',
    'Vuelve a [Agenda] y comprueba los espacios disponibles.',
  ], '', 'Antes de asignar horarios, el profesional debe estar creado en [Configuración] > [Usuarios] y la sede debe estar activa en [Configuración] > [Sucursales].'),
  guide('pacientes', 'Pacientes', 'Crear o buscar un paciente', 'crear registrar nuevo buscar paciente documento celular boton nuevo paciente', 'src/modules/pacientes/components/PatientList.jsx', [
    'Entra a [Pacientes] en el menú lateral izquierdo. En la barra superior busca primero por documento, nombre o celular para evitar registros duplicados.',
    'Si no existe, haz clic en el botón verde [+ Nuevo Paciente] en la parte superior derecha.',
    'Completa los campos obligatorios: Tipo de documento, Número de documento, Nombres, Apellidos, Celular, Fecha de nacimiento y Sexo.',
    'Opcionalmente añade correo, dirección, EPS y ocupación.',
    'Pulsa [Guardar] abajo a la derecha del formulario. El paciente quedará registrado y listo para agendar citas o abrir su expediente clínico.',
  ], '', 'Antes de crear un paciente nuevo, escribe siempre su documento o nombre en el buscador superior para comprobar si ya existe y evitar expedientes duplicados.'),
  guide('importar-pacientes', 'Pacientes', 'Importar pacientes (Excel)', 'importar pacientes excel csv carga masiva', 'src/modules/pacientes/components/ImportadorPacientes.jsx', [
    'En [Pacientes], haz clic en el botón [Importar Pacientes (Excel)].',
    'Selecciona o arrastra el archivo de Excel / CSV siguiendo las columnas requeridas.',
    'Revisa la previsualización y validaciones del importador antes de confirmar.',
    'Pulsa importar y comprueba los registros importados en el listado de pacientes.',
  ], '', 'Antes de importar, asegúrate de tener tu archivo Excel (.xlsx) o CSV con las columnas mínimas obligatorias (Documento, Nombres, Apellidos y Celular) sin celdas combinadas ni filas vacías.'),
  guide('ficha-paciente', 'Pacientes', 'Ficha clínica y asignación de doctores', 'editar datos personales eps aseguramiento beneficiarios convenio profesionales paciente', 'src/modules/pacientes/components/PatientDetails.jsx', [
    'Busca al paciente en [Pacientes] y haz clic sobre su nombre para abrir su Ficha Integral.',
    'En la barra lateral izquierda encontrarás las 17 pestañas del expediente (Datos personales, EPS, Rx / Imágenes / Doc, Profesionales, Citas, Doc. Clínicos, Odontogramas, Presupuestos, Evoluciones, Pagos, etc.).',
    'Para que un odontólogo pueda registrar evoluciones, ve a la pestaña [Profesionales] y vincúlalo como doctor tratante.',
    'Usa el botón [Guardar] cuando modifiques datos personales o de aseguramiento.',
  ], 'Regla clínica: Para que un doctor pueda evolucionar a un paciente, debe estar asignado en la pestaña [Profesionales]. De lo contrario, el sistema mostrará: No estás asignado como profesional tratante.',
  '¡Regla indispensable! Para que un doctor pueda atender o registrar evoluciones a un paciente, debe estar vinculado previamente en la pestaña [Profesionales] de su expediente.'),
  guide('historia', 'Clínica', 'Consultar documentos e historia clínica', 'historia clinica anamnesis documentos clinicos antecedentes', 'src/modules/pacientes/components/HistoriaClinicaContainer.jsx', [
    'Abre la ficha del paciente desde [Pacientes].',
    'En el menú lateral, selecciona [Doc. Clínicos].',
    'Selecciona el formulario clínico (Anamnesis, Consentimiento Informado o Historia General) y completa la información requerida.',
    'Revisa las firmas del paciente y del profesional antes de guardar.',
  ], '', 'El paciente debe estar registrado previamente y las plantillas clínicas deben estar configuradas en [Configuración] > [Plantillas Doc. Clínicos].'),
  guide('odontograma', 'Clínica', 'Odontograma digital, dientes y registro de hallazgos clínicos', 'odontograma dientes diente muela superficies hallazgos caries grafico adulto infantil boton nuevo odontograma guardar finalizar donde esta paciente ficha', 'src/modules/odontograma/Odontograma.jsx', [
    'Desde [Pacientes], abre la ficha del paciente y haz clic en la pestaña [Odontogramas] en la barra lateral de la ficha.',
    'En la cabecera del historial, arriba a la derecha, pulsa el botón índigo [+ Nuevo Odontograma] para abrir el editor interactivo.',
    'Selecciona el [Tipo de Dentición] (Completo, Adulto o Infantil) y la herramienta clínica (ej: Caries, Obturación, Corona, Endodoncia, Extracción o Implante).',
    'Haz clic sobre la cara o pieza dental correspondiente (Vestibular, Oclusal/Incisal, Lingual/Palatina, Mesial, Distal).',
    'En la barra superior (cabecera), arriba a la derecha, pulsa el botón azul [Guardar] para salvar el progreso, o el botón verde [Finalizar] para completar la sesión clínica. También cuentas con [Imprimir] en color ámbar.',
  ], 'Al pulsar [Finalizar], los hallazgos y tratamientos planificados quedan disponibles en la pestaña [Presupuestos & planes] para cargarse opcionalmente con el botón [Odonto. Actual].',
  'Para que los hallazgos del odontograma se coticen automáticamente al finalizarlo, la clínica debe tener su tarifario activo en [Configuración] > [Lista de precios].'),
  guide('periodontograma', 'Clínica', 'Consultar y registrar el periodontograma', 'periodontograma periodontal sondaje', 'src/modules/odontograma/Periodontograma.jsx', [
    'Abre la ficha del paciente y selecciona la pestaña [Periodontogramas].',
    'Crea un nuevo registro y digita los valores de profundidad de sondaje, margen gingival y sangrado en las piezas correspondientes.',
    'Revisa el gráfico periodontal y pulsa guardar.',
  ], '', 'El paciente debe tener su expediente clínico abierto y tener asignado un odontólogo o periodoncista tratante.'),
  guide('evoluciones', 'Clínica', 'Registrar evolución odontológica y diagnósticos CIE-10', 'evolucion evoluciones remision nota aclaratoria cie10 rips copilot', 'src/modules/pacientes/components/EvolucionesTab.jsx', [
    'Abre la ficha del paciente y entra a la pestaña [Evoluciones & Remis].',
    'Haz clic en el botón verde [Evolución] para registrar la consulta clínica o en [Remitir] para una interconsulta médica.',
    'Recuerda que debes estar asignado como doctor tratante en la pestaña [Profesionales] para poder registrar notas a tu nombre.',
    'En el formulario, selecciona el procedimiento realizado y busca el diagnóstico en [Diagnóstico CIE-10].',
    'Redacta la nota de evolución o utiliza el [Copiloto IA] para redactar y estructurar la nota clínica con lenguaje profesional.',
    'Si aplicaste anestésicos, selecciona el producto (ej: Lidocaína 2%) y la vía de administración (Infiltrativa, Troncular).',
    'Pulsa [Guardar Evolución]. Si necesitas corregir un detalle posterior, utiliza la pestaña [Nota Aclaratoria] para mantener la inmutabilidad legal.',
  ], 'El sistema valida que solo el profesional tratante asignado pueda registrar evoluciones, y que las correcciones queden como notas aclaratorias para cumplir la normatividad de historia clínica.',
  '¡Regla obligatoria de OdontoCloud! El odontólogo que registra la evolución DEBE estar asignado previamente en la pestaña [Profesionales] del paciente. Si no está asignado, el sistema bloqueará el guardado mostrando: «No estás asignado como profesional tratante».'),
  guide('presupuestos', 'Clínica', 'Crear presupuesto y planes de tratamiento', 'presupuesto presupuestos plan planes tratamiento cotizacion cotizaciones cotizar procedimientos tarifario agregar items boton nuevo presupuesto crear', 'src/modules/pacientes/components/PlanList.jsx', [
    'Desde [Pacientes], abre la ficha del paciente y entra a la pestaña [Presupuestos & planes] en el menú lateral izquierdo de la ficha. No está en Inicio.',
    'Encontrarás dos secciones: en la cabecera de la tabla superior a la derecha pulsa el botón verde [+ Nuevo Presupuesto], o más abajo pulsa [+ Nuevo Plan de Tratamiento].',
    'En la ventana emergente, escribe el [Nombre], selecciona el [Profesional] tratante, confirma la vigencia en días y la modalidad (Particular o EPS/Convenio), y en la esquina inferior derecha pulsa el botón verde [Crear].',
    'En el editor, haz clic en [+ Agregar Items / Procedimientos] (o el botón verde [+ Agregar items]) en la parte superior para buscar y seleccionar procedimientos en la lista de precios de la clínica. También puedes usar [Cargar Paquete / Combo Completo].',
    'Nota opcional: Si el paciente ya tiene hallazgos registrados en su odontograma, puedes pulsar el botón verde [Odonto. Actual] para importarlos sin digitarlos uno a uno.',
    'Ajusta cantidades, descuentos o copagos. Para cotizaciones, puedes imprimir el PDF formal con el ícono de impresora o pulsar [Convertir a Plan] al ser aprobado. En planes activos, marca (✓) y pulsa el botón azul [Realizar] para mandar el procedimiento a evolución clínica.',
  ], 'No es obligatorio hacer un odontograma previo para crear un presupuesto: puedes cargar directamente los procedimientos desde el tarifario con [+ Agregar Items / Procedimientos].',
  'Antes de elaborar un presupuesto, tu clínica debe tener:\n• La **Lista de Precios / Tarifario** configurada en [Configuración] > [Lista de precios] con los procedimientos y valores en pesos (COP).\n• El **Profesional tratante** asignado en la pestaña [Profesionales] del paciente.'),
  guide('archivos', 'Clínica', 'Radiografías, imágenes y documentos', 'radiografia imagen adjunto archivo rx documento subir', 'src/modules/pacientes/components/PatientRxTab.jsx', [
    'Abre la ficha del paciente y selecciona [Rx / Imágenes / Doc].',
    'Haz clic en subir archivo para adjuntar radiografías panorámicas, periapicales, fotos clínicas o documentos PDF.',
    'Organiza los archivos por fecha y categoría clínica.',
  ], '', 'Tener creado el expediente del paciente y los archivos en formato compatible (JPG, PNG o PDF con peso menor a 15 MB).'),
  guide('abrir-caja', 'Caja', 'Apertura de caja al inicio del turno', 'abrir apertura caja base inicial boton abrir caja donde esta', 'src/modules/caja/components/AbrirCajaModal.jsx', [
    'Entra a [Caja] en el menú lateral izquierdo y haz clic en el botón verde [Abrir Caja] en la parte superior derecha.',
    'Confirma el nombre de la caja (ej: Caja Principal).',
    'En el campo obligatorio [Ajustar Base Inicial], digita el monto de efectivo con el que inicias el turno (en pesos COP).',
    'Escribe observaciones si corresponde y haz clic en el botón verde [Abrir Caja] en la parte inferior del modal.',
  ], 'El sistema no permite abrir una segunda caja si el usuario ya tiene una caja abierta activa sin cerrar.',
  'Antes de abrir caja, verifica no tener otra caja abierta activa a tu nombre en esa sede (el sistema solo permite una caja abierta simultánea por usuario) y ten a la mano el monto exacto de la base de efectivo inicial.'),
  guide('pagos-paciente', 'Caja', 'Registrar pago o abono de un paciente', 'cobrar abonar pago paciente recaudo abono', 'src/modules/pacientes/components/PagoTab.jsx', [
    'Desde [Pacientes], busca al paciente, abre su ficha y entra a [Realizar pago].',
    'En el plan con saldo pendiente, pulsa [Pagar / Abonar]. [Adicionar saldo a favor] es una opción distinta para anticipos.',
    'En [Prestaciones], marca los procedimientos que vas a pagar. Seleccionarlos todavía no registra el pago.',
    'Para pagar el total seleccionado, deja vacío [Abono parcial]. Para abonar una parte, escribe el importe en ese campo. Revisa [Total a pagar] antes de continuar.',
    'Selecciona [Medio de Pago] entre las opciones disponibles. [Número de Referencia / Comprobante] solo aparece y es obligatorio con Transferencia, Cheque, Consignación, Nequi, Daviplata o PSE; con Efectivo no aparece.',
    'Selecciona [Profesional / Responsable] y completa [Observaciones] si corresponde.',
    'Revisa los datos y pulsa [Finalizar Transacción]. Espera el mensaje «Pago registrado exitosamente»; si aparece un error, no des el pago por registrado. La ayuda no puede comprobar que el pago se guardó.',
  ], 'Pagar / Abonar abre el formulario; Finalizar Transacción envía el pago. No son el mismo botón. Un abono parcial no liquida toda la deuda.',
  'Verifica el importe y el medio recibido antes de confirmar. Si aparece Número de Referencia / Comprobante, ten a mano el comprobante correspondiente.'),
  guide('cerrar-caja', 'Caja', 'Cerrar y cuadrar la caja (Arqueo diario)', 'cerrar cierre arqueo cuadrar caja efectivo contado diferencia boton cerrar caja definitivamente', 'src/modules/caja/components/CerrarCajaModal.jsx', [
    'En [Caja] en el menú lateral, localiza tu caja abierta y haz clic en [Cerrar Caja] en la tarjeta activa.',
    'Revisa el resumen financiero: Base Inicial + Ingresos - Egresos = [Saldo Teórico].',
    'En [Efectivo Contado], digita el total de billetes y monedas que contaste físicamente.',
    'En [Otros Medios], digita el valor total de los vouchers de datáfono y transferencias.',
    'Revisa la [Diferencia] (sobrante o faltante). Añade observaciones si hubo alguna novedad.',
    'Marca la casilla obligatoria: Declaro que he realizado el conteo físico detallado...',
    'En la parte inferior derecha, haz clic en el botón rojo [Cerrar Caja Definitivamente].',
  ], 'El botón de cierre definitivo solo se habilita tras marcar la confirmación del conteo físico.',
  'Antes de cerrar la caja definitivamente, debes realizar el conteo físico de todo el efectivo (billetes y monedas) y tener a la mano el total de comprobantes de datáfono y transferencias del turno.'),
  guide('facturas', 'Facturación', 'Factura de venta y facturación electrónica', 'factura venta electronica dian factus cufe emitir', 'src/modules/administracion/views/FacturacionHub.jsx', [
    'Entra a Administración > Facturación > Factura de venta.',
    'Revisa los datos del cliente, los conceptos y los valores en el módulo de facturación.',
    'Para facturación electrónica, comprueba primero Configuración > Facturación electrónica y los consecutivos.',
    'Después de emitir, revisa el estado y los mensajes de respuesta. Si falla, consulta Reportes > Log de errores de facturación.',
  ], 'La Facturación Electrónica DIAN está disponible para clínicas con planes que incluyen emisión oficial DIAN.',
  'Antes de emitir facturas electrónicas oficiales ante la DIAN, recuerda que:\n• Tu clínica debe contar con un plan comercial que incluya facturación DIAN (Plan Clínica o Enterprise).\n• Deben estar configurados la resolución DIAN, prefijo y consecutivos en [Configuración] > [Facturación electrónica].\n• El cliente/paciente debe tener sus datos fiscales completos (cédula o NIT, dirección fiscal, teléfono y correo electrónico).'),
  guide('recibos', 'Facturación', 'Recibos de caja y saldos a favor', 'recibo caja saldo favor anticipo', 'src/modules/administracion/views/FacturacionHub.jsx', [
    'Entra a Administración > Facturación.',
    'Selecciona Recibo de caja para los comprobantes de ingreso o Saldo a favor para revisar los abonos correspondientes.',
    'Abre el registro o el formulario de creación y verifica tercero, valor y referencias antes de confirmar.',
  ], '', 'Para emitir recibos de caja, debes tener una caja abierta o cuenta de banco configurada en [Configuración] > [Catálogos] > [Bancos].'),
  guide('liquidaciones', 'Facturación', 'Liquidación de comisiones y tratamientos', 'liquidacion comisiones tratamiento honorarios doctor pago', 'src/modules/administracion/views/FacturacionHub.jsx', [
    'Entra a Administración > Facturación y selecciona Liquidaciones.',
    'Identifica el profesional o tratamiento a liquidar y revisa las comisiones o importes correspondientes.',
    'Genera y valida la liquidación para cerrar el ciclo administrativo.',
  ], '', 'Los tratamientos deben estar marcados como realizados y cobrados, y los porcentajes de comisión deben estar parametrizados.'),
  guide('proveedores', 'Facturación', 'Pagos a proveedores y facturas de compra', 'proveedor egreso compra factura compra pagar proveedor', 'src/modules/administracion/views/FacturacionHub.jsx', [
    'Revisa el proveedor en Administración > Terceros.',
    'En Administración > Facturación, usa Facturas de compra para registrar las compras y documentos recibidos.',
    'En Pagos, registra el egreso con el tercero, las facturas a pagar y la cuenta correspondiente.',
    'Revisa los importes antes de guardar y verifica el comprobante resultante.',
  ], '', 'El proveedor debe estar registrado en [Administración] > [Terceros] con su NIT y datos de pago.'),
  guide('reportes', 'Reportes', 'Encontrar reportes e indicadores', 'reporte informe indicador estadistica ventas morbilidad cumpleanos clinico', 'src/modules/reportes/Reportes.jsx', [
    'Entra a Reportes y selecciona Indicadores o el reporte específico.',
    'Hay reportes de pacientes, planes de tratamiento, facturación, convenios, ventas, clínico, cumpleaños, citas, morbilidad, consultas y evoluciones.',
    'Ajusta los filtros que ofrezca el reporte y revisa el período antes de interpretar o exportar sus resultados.',
  ]),
  guide('rips', 'Administración', 'Generar y revisar RIPS', 'rips muv json fev validacion cuv', 'src/modules/rips/RipsGenerator.jsx', [
    'Entra a Administración > RIPS JSON y selecciona los datos o documentos que vas a procesar.',
    'Revisa la validación previa y corrige los errores que señale el módulo.',
    'Distingue la descarga preliminar local de la opción Validar y enviar al MUV.',
    'Consulta el resultado de validación antes de dar el envío por aceptado.',
  ], 'Un JSON preliminar no equivale a un envío oficial aceptado.',
  'Antes de generar RIPS oficiales (Resolución 2275):\n• Cada procedimiento debe tener su código CUPS y diagnóstico CIE-10 registrado en las evoluciones.\n• El paciente debe tener sus datos demográficos completos (tipo de documento, fecha de nacimiento, sexo, departamento, municipio y zona de residencia).'),
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
  ], '', 'Esta acción requiere rol de Administrador. Ten definidos el nombre de la sede, dirección, teléfono y la cantidad de sillones o consultorios disponibles.'),
  guide('usuarios', 'Configuración', 'Usuarios, perfiles y permisos', 'usuario perfil permiso acceso rol no veo boton', 'src/modules/config/ConfigRouter.jsx', [
    'Con un perfil autorizado, entra a Configuración > Usuarios para gestionar las cuentas.',
    'En Configuración > Perfiles revisa los permisos del perfil asignado.',
    'Si falta una opción o aparece bloqueada, solicita al administrador que revise tu perfil y la acción permitida.',
  ], 'El asistente explica opciones, pero no concede permisos ni cambia roles.',
  'Solo un Administrador puede crear usuarios. Ten a mano el correo electrónico del profesional, su nombre completo y el rol que tendrá (Odontólogo, Recepción, Administrador).'),
  guide('empresa', 'Configuración', 'Datos de la clínica y empresa (Configuración inicial)', 'empresa clinica razon social nombre comercial logo nit direccion telefono configuracion inicial datos basicos donde pongo cambiar poner', 'src/modules/config/ConfigEmpresa.jsx', [
    'Entra a [Configuración] en el menú lateral izquierdo y haz clic en la opción [Datos Básicos].',
    'En el formulario completa el [Nombre Comercial] (nombre de tu clínica o consultorio), la [Razón Social] y el [NIT / Identificación].',
    'Para cambiar o subir el logotipo de la empresa, haz clic sobre el recuadro [Subir logo] y selecciona el archivo de imagen (PNG o JPG).',
    'Ingresa los datos de contacto: teléfono celular, correo electrónico y dirección física principal.',
    'En la parte superior derecha, pulsa el botón azul [Guardar Cambios] para guardar la información en toda la plataforma.',
  ], 'El nombre comercial y el logo guardados aquí se reflejarán automáticamente en presupuestos, consentimientos, recibos y facturas.'),
  guide('precios', 'Configuración', 'Listas de precios y planes', 'precio tarifa lista planes copago', 'src/modules/config/ConfigRouter.jsx', [
    'Entra a Configuración > Lista de precios o Planes según lo que necesites configurar.',
    'Revisa los conceptos y valores aplicables antes de guardar cambios.',
    'Para copagos, utiliza la sección Tarifas copago si tu perfil tiene acceso.',
  ], '', 'Solo un Administrador puede configurar tarifas. Ten a la mano la lista de procedimientos clínicos que realiza tu clínica con sus valores base en pesos COP.'),
  guide('catalogos', 'Configuración', 'Catálogos financieros y contables', 'banco metodo pago condicion pago impuesto consecutivo catalogo cuenta', 'src/modules/config/ConfigMenu.jsx', [
    'Abre Configuración y selecciona el catálogo correspondiente: Bancos, Métodos de pago, Condiciones de pago, Impuestos, Consecutivos o Catálogo de cuentas.',
    'Consulta los registros existentes y revisa los campos antes de guardar modificaciones.',
    'Guarda los cambios y verifica que los nuevos valores queden disponibles en los módulos de facturación y tesorería.',
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
  guide('planes-suscripcion', 'Suscripción', 'Planes y Precios Oficiales de OdontoCloud', 'planes precios suscripcion plan mensual anual tarifas software consultorio clinica enterprise valor cuanto cuesta suscripcion odontocloud que planes tienes que planes hay que planes manejan costo costos usuarios cuantos usuarios', 'src/pages/landing/PricingPage.jsx', [
    'Plan Consultorio ($79.900 COP/mes o $799.999 COP/año): Hasta 2 usuarios incluidos (1 a 2 doctores). Diseñado para dentistas independientes y consultorios particulares. Incluye agenda inteligente con recordatorios por WhatsApp, historia clínica digital completa, odontograma interactivo, consentimientos informados con firma, control de caja y pacientes ilimitados. No incluye facturación DIAN ni RIPS. Si se requieren más usuarios o facturación, se escala al Plan Clínica.',
    'Plan Clínica ($110.000 COP/mes o $1.100.000 COP/año — ⭐ Más Popular): Hasta 4 usuarios incluidos. Para clínicas en crecimiento. Incluye todo lo de Consultorio más Facturación Electrónica DIAN oficial (400 documentos/año), RIPS JSON oficial (Resolución 2275 de 2023 de Minsalud), sitio web corporativo (CMS), múltiples sedes/sucursales y soporte prioritario por WhatsApp. Si se requieren más de 4 usuarios, se escala a Enterprise.',
    'Plan Enterprise ($199.000 COP/mes o $1.990.000 COP/año): Hasta 8 usuarios activos incluidos. Para redes de clínicas, IPS y cadenas odontológicas. Incluye todo lo de Clínica más Facturación Electrónica DIAN ampliada (1.000 documentos/año), sedes ilimitadas, roles avanzados (Director, Auditor, Odontólogo), módulo de liquidación de comisiones médicas y migración asistida de datos.',
    'Cada plan tiene una capacidad de usuarios definida (2 en Consultorio, 4 en Clínica, 8 en Enterprise). No existen usuarios adicionales gratis; para ampliar el equipo se escala de plan o se cotiza según necesidades.',
    'Todos los planes son 100% en la nube, sin cláusulas de permanencia e incluyen copias de seguridad automáticas diarias y soporte técnico incluido.',
  ]),
  guide('prueba-gratis', 'Prueba Gratuita', 'Iniciar Prueba Gratuita de 30 Días', 'prueba gratis demostracion demo probar 30 dias sin costo cuenta registro registrarme empezar comenzar activar como probar', 'src/components/landing/TrialModal.jsx', [
    'Sin tarjeta de crédito ni compromisos: Puedes probar las funciones esenciales del sistema durante 30 días calendario de manera 100% gratuita.',
    'Funciones de la prueba demo: Disfruta de agenda multi-doctor, odontograma interactivo, historia clínica con consentimientos digitales y control de caja. (Nota: La prueba gratuita no incluye facturación electrónica DIAN ni RIPS; estas se activan con un plan comercial).',
    'Activación oficial: Haz clic en el botón [Solicitar demostración gratuita] en la página principal, completa los datos básicos de tu clínica y recibirás en tu correo el enlace de activación para ingresar de inmediato.',
    'Acompañamiento inicial: Nuestro equipo te enviará credenciales y tutoriales paso a paso para que tu equipo empiece a atender pacientes desde el primer día.',
  ]),
  guide('facturacion-dian-rips', 'Normativa y Facturación', 'Facturación Electrónica DIAN y RIPS JSON en Colombia', 'facturacion electronica dian rips json resolucion 2275 minsalud sispro muv factus colombia norma ley', 'src/constants/MasterConfig.js', [
    'Facturación Electrónica Oficial: Integración nativa con Factus (proveedor tecnológico avalado por la DIAN). Emite facturas electrónicas, notas crédito y notas débito con CUFE y código QR en segundos.',
    'RIPS JSON Automático (Resolución 2275 de 2023): OdontoCloud genera automáticamente los archivos de RIPS en formato JSON listos para radicar en el MUV / SISPRO del Ministerio de Salud, sin reprocesos ni hojas de cálculo.',
    'Trazabilidad Total: Asocia cada procedimiento CUPS con los diagnósticos CIE-10 del paciente, el profesional tratante y la factura generada.',
    'Disponible a partir del Plan Clínica ($110.000 COP/mes).',
  ]),
  guide('historia-odontograma-public', 'Clínica', 'Historia Clínica Digital y Odontograma Interactivo', 'historia clinica odontograma periodontograma consentimientos odontologico dientes diente expediente digital ficha anamnesis', 'src/modules/odontograma/Odontograma.jsx', [
    'Historia Clínica Integral: 17 secciones clínicas especializadas, anamnesis, antecedentes médicos, evoluciones con diagnósticos CIE-10 y notas aclaratorias bajo estricta normativa colombiana.',
    'Odontograma Interactivo 3D: Gráfico visual ágil por piezas y superficies dentales (caries, obturaciones, endodoncias, implantes). Al finalizar el odontograma, se genera automáticamente el presupuesto de tratamiento para el paciente.',
    'Consentimientos Informados Digitales: Firma electrónica del paciente directamente en tablet, celular o pantalla, con almacenamiento seguro en PDF inviolable.',
    'Periodontograma y Galería Radiográfica: Registro de profundidades de sondaje, margen gingival y sangrado, junto con visualización de radiografías en la nube.',
  ]),
  guide('agenda-whatsapp-public', 'Agenda', 'Agenda Inteligente y Recordatorios por WhatsApp', 'agenda citas recordatorios whatsapp turnos horario cancelar agendar reservar citas whatsapp ausentismo', 'src/modules/agenda/Agenda.jsx', [
    'Agenda Médica Inteligente: Vista diaria, semanal y mensual con código de colores por estado de cita (confirmada, en espera, atendida, cancelada).',
    'Recordatorios por WhatsApp: Envío de recordatorios y confirmaciones con un solo clic con los datos del paciente, doctor, fecha y hora para reducir el ausentismo hasta en un 40%.',
    'Control Multi-doctor y Multi-sillón: Validación en tiempo real para evitar cruces de horarios entre especialistas o consultorios.',
  ]),
  guide('contacto-soporte', 'Atención y Ventas', 'Contacto Comercial y Asesoría Humana por WhatsApp', 'contacto whatsapp asesor soporte humano telefono numero hablar ventas comprar ayuda llamada asesor comercial asesor humano', 'src/pages/landing/FAQPage.jsx', [
    'Asesoría Personalizada: Si deseas una demostración guiada, resolver dudas específicas o solicitar una cotización especial, nuestro equipo humano te atiende directamente.',
    'Línea Oficial de WhatsApp: +57 301 576 8935 (o haz clic en el botón de WhatsApp dentro del chat).',
    'Correo Oficial de Contacto: bienvenido@odontocloudcolombia.com.',
    'Atención Inmediata: Lunes a Sábado con soporte permanente para clínicas activas.',
  ]),
  guide('seguridad-migracion', 'Tecnología', 'Seguridad en la Nube y Migración de Datos', 'seguridad nube copias backup privacidad datos migrar migracion pasar datos excel importar instalar requisitos servidor mac windows', 'src/constants/MasterConfig.js', [
    'Plataforma 100% en la Nube: No requiere instalar programas ni comprar servidores locales. Funciona en Windows, Mac, iPads, tablets y smartphones con conexión a Internet.',
    'Seguridad y Privacidad: Copias de seguridad automáticas diarias, cifrado de datos y aislamiento absoluto entre clínicas bajo ley de Habeas Data.',
    'Migración Asistida de Pacientes: Importa tu base de datos de pacientes existente desde archivos de Excel en minutos mediante nuestro importador automatizado.',
    'Disponibilidad Continua: Acceso 24/7 y actualizaciones automáticas sin costos ocultos de mantenimiento.',
  ]),
];

export const PUBLIC_GUIDE_IDS = new Set([
  'planes-suscripcion',
  'prueba-gratis',
  'facturacion-dian-rips',
  'historia-odontograma-public',
  'agenda-whatsapp-public',
  'contacto-soporte',
  'seguridad-migracion',
]);

export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stop = new Set('como hago para una uno unos unas los las del que con por puedo quiero necesito donde este esta esto eso cual cuando sistema paso pasos consultar utilizar usar revisar hola buenas puedes podria podrias ayudar ayudame ayuda favor gracias me el un de a en es al no si ya'.split(' '));
const aliases = {
  hacer: 'crear', hace: 'crear', configurar: 'configuracion', configurarlo: 'configuracion', configura: 'configuracion', configuracion: 'configuracion', configuraasr: 'configuracion',
  cancelo: 'cancelar', reprogramo: 'reprogramar', agendo: 'agendar', reservo: 'reservar', aparto: 'apartar',
  registro: 'registrar', guardo: 'guardar', cobro: 'cobrar', abro: 'abrir', cierro: 'cerrar',
  costo: 'precio', costos: 'precios', valor: 'precio', valores: 'precios',
  cotizacion: 'presupuesto', cotizaciones: 'presupuesto', cotizar: 'presupuesto',
  diente: 'odontograma', dientes: 'odontograma', muela: 'odontograma', muelas: 'odontograma', carie: 'odontograma', caries: 'odontograma',
  pago: 'pago', pagos: 'pago', abono: 'pago', recaudo: 'pago',
  cita: 'cita', citas: 'cita', turno: 'cita', turnos: 'cita',
  evolucion: 'evolucion', evoluciones: 'evolucion',
};
const tokens = text => [...new Set(normalize(text).split(' ').filter(t => t.length > 2 && !stop.has(t)).map(t => aliases[t] || (t.startsWith('configur') ? 'configuracion' : (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))))];

export function searchGuides(question, previousIds = [], mode = 'app') {
  if (/\bedunexus\b/.test(normalize(question))) return [];
  const words = tokens(question);
  const isPublic = mode === 'public';
  
  // En modo público se filtran exclusivamente las guías comerciales y de producto para visitantes
  const candidateGuides = isPublic
    ? HELP_GUIDES.filter(g => PUBLIC_GUIDE_IDS.has(g.id))
    : HELP_GUIDES.filter(g => !['historia-odontograma-public', 'agenda-whatsapp-public', 'facturacion-dian-rips', 'seguridad-migracion'].includes(g.id));

  const ranked = candidateGuides.map(item => {
    const titleWords = tokens(item.title);
    const keyWords = tokens(item.keywords);
    const score = words.reduce((n, word) => {
      let s = 0;
      if (titleWords.includes(word)) s += 5;
      if (keyWords.includes(word)) s += 3;
      return n + s;
    }, 0);
    return { item, score };
  }).filter(hit => hit.score > 0).sort((a, b) => b.score - a.score);

  if (ranked.length) return ranked.filter(hit => hit.score >= Math.max(3, ranked[0].score * 0.45)).slice(0, 3).map(hit => hit.item);
  
  // Only carry topic context for explicit short follow-ups, not unrelated new questions.
  if (/^(y |entonces |despues|luego|como lo |donde lo |no aparece|no encuentro)/.test(normalize(question))) {
    return previousIds.slice(0, 3).map(id => candidateGuides.find(item => item.id === id)).filter(Boolean);
  }
  return [];
}

export function formatGuide(item, isPublic = false) {
  if (isPublic || PUBLIC_GUIDE_IDS.has(item.id)) {
    return `**${item.title}**\n\n${item.steps.map(step => `• ${step}`).join('\n\n')}${item.note ? `\n\n${item.note}` : ''}`;
  }
  const prereqBlock = item.prereq ? `📌 **Recuerda antes de empezar:**\n${item.prereq}\n\n` : '';
  return `**${item.title}**\n\n${prereqBlock}**Pasos a seguir:**\n${item.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}${item.note ? `\n\n${item.note}` : ''}`;
}

export function guideResponse(question, previousIds = [], reason = 'manual', mode = 'app') {
  const isPublic = mode === 'public';
  const qClean = normalize(question);

  if (isPublic) {
    // 1. Saludos en landing pública
    if (/^(hola|hola buenas|buenas|buenos dias|buenas tardes|buenas noches|hey|hola como estas|como estas|que tal|saludos|inicio|empezar)$/.test(qClean)) {
      return {
        provider: 'assistant',
        reason: 'greeting',
        version: KNOWLEDGE_VERSION,
        answer: '¡Hola! 👋 Bienvenido a **OdontoCloud Colombia**. Soy tu Asesor Virtual.\n\nEstoy aquí para orientarte sobre todo lo que nuestro software en la nube puede hacer por tu clínica o consultorio dental:\n\n• 💳 **Planes y Precios:** Conoce nuestros planes desde $79.900 COP/mes.\n• 🚀 **Prueba Gratuita 30 Días:** Activa tu demo completa sin costo ni tarjeta de crédito.\n• 🧾 **Facturación DIAN y RIPS JSON:** Cumplimiento oficial de la Resolución 2275.\n• 🦷 **Historia Clínica y Odontograma:** Expedientes digitales y presupuestos automáticos.\n• 💬 **Asesor Humano:** Chatea con nuestro equipo comercial por WhatsApp al +57 301 576 8935.\n\n¿En qué te gustaría profundizar hoy?',
        sources: [
          { id: 'planes-suscripcion', title: 'Planes y Precios Oficiales', category: 'Suscripción' },
          { id: 'prueba-gratis', title: 'Prueba Gratis 30 Días', category: 'Prueba Gratuita' },
        ],
      };
    }

    // 2. Agradecimientos en landing pública
    if (/^(gracias|muchas gracias|mil gracias|ok gracias|listo gracias|perfecto gracias|vale gracias)$/.test(qClean)) {
      return {
        provider: 'assistant',
        reason: 'thanks',
        version: KNOWLEDGE_VERSION,
        answer: '¡Con el mayor de los gustos! 😊 Si tienes más preguntas sobre los planes, la facturación DIAN, los RIPS o quieres comenzar tu **prueba gratis de 30 días**, aquí estoy para ayudarte.\n\nTambién puedes hacer clic en el botón de abajo para chatear directamente con nuestro equipo por **WhatsApp** (+57 301 576 8935). ¡Que tengas un excelente día!',
        sources: [
          { id: 'contacto-soporte', title: 'Contacto Comercial WhatsApp', category: 'Atención y Ventas' },
        ],
      };
    }

    // 3. Búsqueda de guías públicas
    const guides = searchGuides(question, previousIds, 'public');
    if (guides.length) {
      return {
        provider: 'manual',
        reason,
        version: KNOWLEDGE_VERSION,
        answer: formatGuide(guides[0], true),
        sources: guides.map(({ id, title, category }) => ({ id, title, category })),
      };
    }

    // 4. Fallback comercial elegante para visitantes
    return {
      provider: 'assistant',
      reason: 'public_overview',
      version: KNOWLEDGE_VERSION,
      answer: '**OdontoCloud Colombia** es la plataforma en la nube líder para la administración y crecimiento de consultorios y clínicas odontológicas.\n\nTe permite gestionar en un solo lugar:\n• **Agenda Médica Inteligente:** Control de citas y recordatorios por WhatsApp para evitar pacientes ausentes.\n• **Historia Clínica y Odontograma:** 17 secciones clínicas normativas, consentimientos informados digitales y odontograma interactivo.\n• **Facturación Electrónica DIAN y RIPS:** Emisión oficial con CUFE y generación automática de RIPS JSON (Resolución 2275 de Minsalud).\n• **100% en la Nube:** Seguro, con copias de respaldo continuas y accesible desde cualquier computador, tablet o celular.\n\n¿Te gustaría iniciar una **prueba gratuita de 30 días sin costo**, conocer los **planes y precios**, o comunicarte con un **asesor comercial por WhatsApp** (+57 301 576 8935)?',
      sources: [
        { id: 'planes-suscripcion', title: 'Planes y Precios Oficiales', category: 'Suscripción' },
        { id: 'prueba-gratis', title: 'Prueba Gratis 30 Días', category: 'Prueba Gratuita' },
        { id: 'contacto-soporte', title: 'Contacto Comercial WhatsApp', category: 'Atención y Ventas' },
      ],
    };
  }

  // Comportamiento dentro de la app (médicos / recepcionistas logueados)
  const guides = searchGuides(question, previousIds, 'app');
  return {
    provider: 'manual',
    reason,
    version: KNOWLEDGE_VERSION,
    answer: guides.length ? formatGuide(guides[0], false) : 'No tengo una guía verificada para esa pregunta. Indica el módulo y la acción que intentas realizar, o busca un tema en la biblioteca. No puedo consultar datos particulares ni realizar operaciones desde este chat.',
    sources: guides.map(({ id, title, category }) => ({ id, title, category })),
  };
}
