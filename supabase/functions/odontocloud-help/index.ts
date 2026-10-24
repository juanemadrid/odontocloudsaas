import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { createHelpHandler, HelpError } from './handler.mjs';
import { authenticateHelp } from './auth.mjs';
import { decryptSecret, encryptSecret, loadEncryptionKey } from '../tenant-secrets/crypto.ts';
import { createHelpCrypto } from '../_shared/helpCrypto.mjs';
import { resolveStoredHelpConfig } from './credentialStore.mjs';

const helpCrypto = createHelpCrypto({ env: (name: string) => Deno.env.get(name),
  readPrivateFile: (path: string) => Deno.readTextFile(path),
  legacyEncrypt: encryptSecret, legacyDecrypt: decryptSecret, legacyCanEncrypt: loadEncryptionKey });

Deno.serve(createHelpHandler({
  env: (name: string) => Deno.env.get(name),
  resolveConfig: async (signal: AbortSignal) => resolveStoredHelpConfig({
    env: (name: string) => Deno.env.get(name),
    decrypt: helpCrypto.decrypt,
    signal,
    readCredential: async () => {
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) throw new Error('Missing internal configuration');
      const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data, error } = await admin.from('odonto_help_credentials')
        .select('encrypted_key, model').eq('id', true).maybeSingle();
      if (error) throw new Error('Help credential unavailable');
      return data;
    },
  }),
  log: (event: Record<string, unknown>) => console.info('odontocloud-help', JSON.stringify(event)),
  reserve: async (principal: { userId: string; tenantId: string }) => {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return { allowed: false, reason: 'disabled' };
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.rpc('reserve_odonto_help_request', {
      p_user_id: principal.userId, p_tenant_id: principal.tenantId,
    });
    if (error) throw new Error('Help quota unavailable');
    return data;
  },
  authenticate: async (token: string) => {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new HelpError(503, 'El servicio de ayuda no está configurado.');
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    return authenticateHelp(admin, token);
  },
}));
