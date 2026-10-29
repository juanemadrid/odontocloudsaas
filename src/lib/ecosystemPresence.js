import supabase, { supabaseUrl, supabaseAnonKey } from './supabaseClient';

// Each open tab has a separate lease (visible or minimized). No audit history is used as presence.
// "visible" indica si la pantalla está a la vista o minimizada; la sesión sigue activa en ambos casos.
export function startEcosystemPresence(userId, tenantId) {
  const tabId = crypto.randomUUID();
  let token = null;
  let stopped = false;
  let sendVisible = true; // se desactiva solo si la base aún no tiene la columna "visible"
  const send = async (offline) => {
    if (!token) return;
    const query = offline ? '?user_id=eq.' + encodeURIComponent(userId) + '&session_id=eq.' + tabId : '?on_conflict=user_id,session_id';
    const body = { user_id: userId, tenant_id: tenantId, session_id: tabId };
    if (sendVisible) body.visible = document.visibilityState === 'visible';
    const post = (payload) => fetch(supabaseUrl + '/rest/v1/ecosystem_presence' + query, {
      method: offline ? 'DELETE' : 'POST', keepalive: true,
      headers: { apikey: supabaseAnonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      ...(offline ? {} : { body: JSON.stringify(payload) }),
    });
    try {
      const res = await post(body);
      if (!offline && sendVisible && res.status === 400) {
        // Base sin la columna "visible": seguir avisando la presencia sin ese dato.
        sendVisible = false;
        delete body.visible;
        await post(body);
      }
    } catch { /* red temporalmente no disponible */ }
  };
  // La conexión sigue activa aunque la pantalla esté minimizada u oculta (igual que EduNexus).
  // Solo se borra al cerrar sesión o cerrar la pestaña (pagehide).
  const beat = async () => {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
    if (!stopped) await send(false);
  };
  const leave = () => send(true);
  void beat();
  const timer = setInterval(() => void beat(), 6000);
  document.addEventListener('visibilitychange', beat);
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', beat);
  return async () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', beat);
    window.removeEventListener('pagehide', leave);
    window.removeEventListener('pageshow', beat);
    await leave();
  };
}
