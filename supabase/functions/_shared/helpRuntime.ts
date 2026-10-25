import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { createHelpHandler, HelpError } from '../odontocloud-help/handler.mjs';
import { authenticateHelp } from '../odontocloud-help/auth.mjs';
import { resolveStoredHelpConfig } from '../odontocloud-help/credentialStore.mjs';
import { encryptSecret, decryptSecret, loadEncryptionKey } from '../tenant-secrets/crypto.ts';
import { createHelpCrypto } from './helpCrypto.mjs';

const env = (name: string) => Deno.env.get(name);
const helpCrypto = createHelpCrypto({ env, readPrivateFile: (path: string) => Deno.readTextFile(path),
  legacyEncrypt: encryptSecret, legacyDecrypt: decryptSecret, legacyCanEncrypt: loadEncryptionKey });
function helpAdmin() {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new HelpError(503, 'El servicio de ayuda no está configurado.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
type Principal = { userId: string; tenantId: string; active: boolean };
export function runtimeHelpHandler(diagnosticPrincipal?: Principal) {
  return createHelpHandler({ env,
    authenticate: async (token: string) => diagnosticPrincipal || await authenticateHelp(helpAdmin(), token),
    resolveConfig: async (signal: AbortSignal) => resolveStoredHelpConfig({ env, decrypt: helpCrypto.decrypt, signal,
      readCredential: async () => {
        const { data, error } = await helpAdmin().from('odonto_help_credentials').select('encrypted_key, model').eq('id', true).abortSignal(signal).maybeSingle();
        if (error) throw new Error('Help credential unavailable');
        return data;
      } }),
    reserve: async (principal: Principal, signal?: AbortSignal) => {
      let query = helpAdmin().rpc('reserve_odonto_help_request', { p_user_id: principal.userId, p_tenant_id: principal.tenantId });
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw new Error('Help quota unavailable');
      return data;
    },
    log: (event: Record<string, unknown>) => console.info('odontocloud-help', JSON.stringify(event)),
  });
}

// Only invoked after verifying an active superadmin. Same handler, gates and quota;
// no login or session is created for a clinic user, and no clinical data is read.
export async function diagnoseClinicHelp(tenantId: string, signal: AbortSignal) {
  const admin = helpAdmin();
  const { data: tenant, error: tenantError } = await admin.from('tenants').select('id, activo').eq('id', tenantId).abortSignal(signal).maybeSingle();
  if (tenantError || !tenant || tenant.activo !== true) return { provider: 'manual', reason: 'disabled', diagnostic: 'clinic_inactive', answer: 'La clínica no está activa.' };
  const { data: profiles, error } = await admin.from('profiles').select('id').eq('tenant_id', tenantId).eq('activo', true).limit(1).abortSignal(signal);
  if (error || !profiles?.[0]) return { provider: 'manual', reason: 'disabled', diagnostic: 'clinic_no_active_profile', answer: 'La clínica no tiene un perfil activo para comprobar la ayuda.' };
  const response = await runtimeHelpHandler({ userId: profiles[0].id, tenantId, active: true })(new Request('http://localhost/help-diagnostic', {
    method: 'POST', headers: { Authorization: 'Bearer internal-help-diagnostic' }, signal,
    body: JSON.stringify({ question: 'o sea cómo se envían y a dónde se envían', previousIds: ['rips'], mode: 'app', stream: false,
      history: [
        { role: 'user', content: 'me ayudas en algo' },
        { role: 'assistant', content: 'Cuéntame qué estabas intentando hacer.' },
        { role: 'user', content: 'no sé cómo se generan los RIPS en este sistema' },
        { role: 'assistant', content: '¿Qué te gustaría hacer con los RIPS?' },
      ] }),
  }));
  return await response.json();
}
