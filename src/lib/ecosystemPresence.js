import supabase, { supabaseUrl, supabaseAnonKey } from './supabaseClient';

// Each visible tab has a separate lease. No audit history is used as presence.
export function startEcosystemPresence(userId, tenantId) {
  const tabId = crypto.randomUUID();
  let token = null;
  let stopped = false;
  const send = (offline) => {
    if (!token) return Promise.resolve();
    const query = offline ? '?user_id=eq.' + encodeURIComponent(userId) + '&session_id=eq.' + tabId : '?on_conflict=user_id,session_id';
    return fetch(supabaseUrl + '/rest/v1/ecosystem_presence' + query, {
      method: offline ? 'DELETE' : 'POST', keepalive: true,
      headers: { apikey: supabaseAnonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      ...(offline ? {} : { body: JSON.stringify({ user_id: userId, tenant_id: tenantId, session_id: tabId }) }),
    }).catch(() => {});
  };
  const beat = async () => {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
    if (!stopped) await send(document.visibilityState !== 'visible');
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
