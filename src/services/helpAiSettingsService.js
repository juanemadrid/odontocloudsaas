import supabase from '../lib/supabaseClient';

export async function manageHelpAiKey(action, input = {}) {
  const { data, error } = await supabase.functions.invoke('odontocloud-help-settings', {
    body: { action, ...input },
  });
  if (error) {
    let message = 'No se pudo contactar la configuración de IA. Comprueba que el servidor esté actualizado.';
    try {
      const details = await error.context?.json();
      if (typeof details?.error === 'string') message = details.error;
    } catch { /* Do not display request data or credentials. */ }
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error || 'No se pudo completar la operación.');
  return data;
}
