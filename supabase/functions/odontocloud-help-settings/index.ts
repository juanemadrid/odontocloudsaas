import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { encryptSecret, decryptSecret, loadEncryptionKey } from '../tenant-secrets/crypto.ts';
import { createHelpCrypto } from '../_shared/helpCrypto.mjs';
import { createHelpSettingsHandler } from './handler.mjs';
import { authenticateHelpSettings } from './auth.mjs';
import { diagnoseClinicHelp } from '../_shared/helpRuntime.ts';

const helpCrypto = createHelpCrypto({ env: (name: string) => Deno.env.get(name),
  readPrivateFile: (path: string) => Deno.readTextFile(path),
  legacyEncrypt: encryptSecret, legacyDecrypt: decryptSecret, legacyCanEncrypt: loadEncryptionKey });

function adminClient(_signal?: AbortSignal) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing internal configuration');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

Deno.serve(createHelpSettingsHandler({
  env: (name: string) => Deno.env.get(name),
  encrypt: helpCrypto.encrypt,
  canEncrypt: helpCrypto.canEncrypt,
  diagnose: diagnoseClinicHelp,
  authenticate: async (token: string, signal: AbortSignal) => {
    return authenticateHelpSettings(adminClient(signal), token);
  },
  readCredential: async (signal: AbortSignal) => {
    const { data, error } = await adminClient(signal).from('odonto_help_credentials')
      .select('model, updated_at, verified_at').eq('id', true).abortSignal(signal).maybeSingle();
    if (error) throw new Error('Settings unavailable');
    return data;
  },
  writeCredential: async (row: Record<string, unknown>, signal: AbortSignal) => {
    const { error } = await adminClient(signal).from('odonto_help_credentials').upsert(row, { onConflict: 'id' }).abortSignal(signal);
    if (error) throw new Error('Settings write failed');
  },
  reserveCheck: async (userId: string, signal: AbortSignal) => {
    const { data, error } = await adminClient(signal).rpc('reserve_odonto_help_key_check', { p_user_id: userId }).abortSignal(signal);
    if (error) throw new Error('Check limit unavailable');
    return data === true;
  },
}));
