import { HELP_GUIDES, normalize } from './helpKnowledge.mjs';

// Project into a fixed public operational vocabulary, never forward the original
// text or arbitrary names/values. Preserve conditions, negation, order and tense.
const terms = `a al algo algun alguna algunos algunas ante antes aqui asi aun aunque bajo bien cada casi como con contra cual cuales cuando cuanto de del desde despues donde durante e el ella ellos en entre era es esa ese eso esta estan este estos falta fui ha haber hace hacen hacer hacia hasta hay he la las le les lo los mas me mi mientras mismo mucha mucho muy nada ni no nos o otra otro otras otros para pero por porque puede pueden puedo que quien se sea segun ser si sin sobre solo son su sus tambien te tiene tienen tengo tener todo todos tu un una uno unos unas y ya yo
que pasa sucede significa efecto consecuencia motivo razon diferencia diferencia problema problemas error errores fallo funciona funcionar funcionando aparece aparecen aparezca aparecer veo ver visto viendo encuentra encontrar encuentro encuentra encontrarlo muestra mostrar mostrarse sale salen salio salir permite permitir permitido impide impedir bloquea bloqueado bloqueada obligatorio obligatoria requiere requieren requisito requisitos necesario necesaria opcion opciones activado activada activa activar desactivado desactivada desactiva desactivar habilitado habilitada habilitar deshabilitado deshabilitada seleccion seleccionar seleccionado seleccionada seleccione seleccionado elegir elegi elige elegido marcar marcado marca marcada marcando desmarcar desmarcado configurar configurado configurada configuracion guardo guardar guarde guardado crear creo cree creado generar genera genero genere generado generados generacion exportar exporto enviar envio enviado envia transmitir transmito pagar pago pague pagado abonar abono consultar consulta busco buscar busque registrar registro registre registrado editar editarlo editarla modifique modificar cambio cambiar cambiado elimino eliminar borrado borrar cancelar cancelado cancele calcular valido validar validacion rechazado rechazo terminar termine terminado finalizar finalizado complete completar abrir abri abierto cierro cerrar cerrado entrar entre continuar continua sigo seguir siguiente anterior primero primera segundo segunda tercero tercera ultimo ultima explicar explicame explicacion entendi entiendo entender sencillo sencilla mejor detalles detalle paso pasos repite repetir resumen
sistema programa pantalla formulario ventana boton pestaña menu lateral superior inferior derecha izquierda ficha tabla filtro filtros campo campos dato datos registro registros atencion atenciones clinica clinicas profesional profesionales doctor doctores odontologo odontologos administrador administradora recepcionista paciente pacientes usuario usuarios permiso permisos perfil perfiles prestador independiente ips sede sedes sucursal sucursales agenda cita citas horario horarios disponibilidad sillon sillones espacio clinico
rips rip json muv cuv fev dian cups reps nit evolucion evoluciones procedimiento procedimientos consulta consultas historia documento documentos clinicos facturacion factura facturas recibo recibos caja presupuesto presupuestos plan planes tratamiento tratamientos cotizacion cotizaciones tarifario precio precios producto productos servicio servicios fecha fechas periodo rango inicial final pago pagos efectivo transferencia parcial total cuenta cuentas lista listas habilitacion filtro sucursal especialidad especialidades importe cantidad descuento vigencia modalidad profesionalmente`;
const dictionary = new Map((terms + ' obligado obligada obligacion obligaciones legal legales habilitado independiente institucional institucionales desmarcada desmarcado resultados resultado vacio vacia duda dudas pregunta preguntas ayuda ayudame necesito necesitar perdido perdida empezar empiezo empiezo explicarlo explicarme contar cuentame sucede intentar intento intentaba pegado pegada congelado congelada rojo roja').split(/\s+/).filter(Boolean).map(word => [word, word]));
dictionary.set('rip', 'rips');
// Public UI labels extend vocabulary with canonical words, never runtime values.
for (const guide of HELP_GUIDES) {
  for (const [, label] of [guide.prereq, ...guide.steps, guide.note].join('\n').matchAll(/\[([^\]\n]+)\]/g)) {
    for (const word of normalize(label).split(' ')) if (/^[a-z]+$/.test(word)) dictionary.set(word, word);
  }
}

export function projectHelpMeaning(value) {
  const text = String(value || '').slice(0, 1800)
    .replace(/https?:\/\/\S+|\b[^\s@]+@[^\s@]+\.[^\s@]+/gi, ' ')
    .replace(/\b\S*\d\S*\b/g, ' ');
  const words = normalize(text).split(' ').filter(Boolean);
  const projected = [];
  for (const word of words) {
    const canonical = dictionary.get(word);
    if (canonical) projected.push(canonical);
    else if (projected.at(-1) !== '(detalle omitido)') projected.push('(detalle omitido)');
  }
  return projected.slice(0, 90).join(' ');
}

export function projectHelpHistory(history = []) {
  return history.slice(-2).filter(m => ['user', 'assistant'].includes(m.role))
    .map(m => ({ role: m.role, meaning: projectHelpMeaning(m.content).slice(0, 400) }));
}
