export function helpFallbackMessage(result = {}) {
  const code = result.diagnostic;
  const quotaMessages = {
    reservation_user_cooldown: 'Todavía no han pasado 10 segundos desde tu consulta anterior. Espera unos segundos; se muestra el manual.',
    reservation_global_minute: 'Se alcanzaron las 4 consultas por minuto compartidas entre todas las clínicas y las pruebas. Espera un minuto; se muestra el manual.',
    reservation_global_day: 'Se alcanzó el límite diario interno de OdontoCloud entre todas las clínicas y pruebas. Se renueva a medianoche de Colombia; esperar un minuto no lo restablece. Se muestra el manual.',
    reservation_global_month: 'Se alcanzó el límite mensual interno de OdontoCloud entre todas las clínicas y pruebas. Se muestra el manual.',
    reservation_clinic_day: 'Esta clínica alcanzó su límite diario interno de ayuda, incluyendo las pruebas. Se renueva a medianoche de Colombia; esperar un minuto no lo restablece. Se muestra el manual.',
    reservation_clinic_month: 'Esta clínica alcanzó su límite mensual interno de ayuda, incluyendo las pruebas. Se muestra el manual.',
  };
  if (Object.hasOwn(quotaMessages, code)) return quotaMessages[code];
  if (result.provider === 'assistant' && ['disabled', 'quota', 'not_configured', 'unavailable'].includes(result.reason)) {
    return result.reason === 'quota' ? 'La IA alcanzó una cuota o una espera temporal. Este es un mensaje automático; espera al menos 10 segundos antes de volver a intentar.' : 'La IA no está disponible para esta conversación en este momento. Este es un mensaje automático de apoyo.';
  }
  if (code === 'help_session_rejected') return 'La sesión no permitió consultar la IA. Vuelve a iniciar sesión; esta respuesta procede del manual.';
  if (code === 'help_endpoint_unavailable') return 'No se pudo conectar con el servicio de IA de ayuda. Esta respuesta procede del manual local.';
  if (code === 'gemini_truncated') return 'Gemini alcanzó el límite de respuesta antes de terminar. Se muestra la guía de respaldo.';
  if (code === 'gemini_unverified_labels') return 'La respuesta de Gemini incluyó una opción que no pudimos verificar en el manual. Se muestra la guía segura.';
  if (code === 'gemini_http_400') return 'Google rechazó la configuración del modelo. El superadministrador debe probar la conexión.';
  if (code === 'gemini_http_401' || code === 'gemini_http_403') return 'Google rechazó la clave o sus permisos. El superadministrador debe revisar la conexión.';
  if (code === 'gemini_http_404') return 'El modelo configurado no está disponible en Google. El superadministrador debe seleccionar otro modelo compatible.';
  if (code === 'gemini_timeout') return 'Gemini tardó demasiado. Se muestra la guía de respaldo.';
  if (code === 'help_configuration_unavailable') return 'No se pudo cargar la conexión cifrada de la ayuda. El superadministrador debe revisar su estado.';
  if (code === 'clinic_inactive') return 'La clínica está inactiva.';
  if (code === 'clinic_no_active_profile') return 'No hay un perfil activo de esta clínica para ejecutar la prueba.';
  if (result.reason === 'disabled') return 'La IA está apagada para esta clínica o en el interruptor general. Esta respuesta procede del manual.';
  if (result.reason === 'quota') return code === 'gemini_http_429'
    ? 'Google indica que no hay cuota disponible. Esta respuesta procede del manual.'
    : 'Se alcanzó una cuota o el límite temporal de consultas. Espera al menos 10 segundos entre mensajes; si persiste, el superadministrador debe revisar los límites. Esta respuesta procede del manual.';
  if (result.reason === 'not_configured') return 'La conexión de IA de ayuda no está configurada. Esta respuesta procede del manual.';
  if (result.reason === 'unavailable') return 'No se recibió una respuesta válida de la IA. Esta respuesta procede del manual de respaldo.';
  return '';
}
