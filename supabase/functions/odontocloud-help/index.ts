import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { createHelpHandler, HelpError } from './handler.mjs';
import { authenticateHelp } from './auth.mjs';
import { decryptSecret } from '../tenant-secrets/crypto.ts';
import { resolveStoredHelpConfig } from './credentialStore.mjs';

Deno.serve(createHelpHandler({
  env: (name: string) => Deno.env.get(name),
  resolveConfig: async (signal: AbortSignal) => resolveStoredHelpConfig({
    env: (name: string) => Deno.env.get(name),
    decrypt: decryptSecret,
    signal,
    readCredential: async () => {
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) throw new Error('Missing internal configuration');
      const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal }) } });
      const { data, error } = await admin.from('odonto_help_credentials')
        .select('encrypted_key, model').eq('id', true).maybeSingle();
      if (error) throw new Error('Help credential unavailable');
      return data;
    },
  }),
  log: (event: Record<string, unknown>) => console.info('odontocloud-help', JSON.stringify(event)),
  reserve: async (principal: { userId: string; tenantId: string }, signal?: AbortSignal) => {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return { allowed: false, reason: 'disabled' };
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
    });
    const { data, error } = await admin.rpc('reserve_odonto_help_request', {
      p_user_id: principal.userId, p_tenant_id: principal.tenantId,
    });
    if (error) throw new Error('Help quota unavailable');
    return data;
  },
  authenticate: async (token: string, signal: AbortSignal) => {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new HelpError(503, 'El servicio de ayuda no está configurado.');
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
    });
    return authenticateHelp(admin, token);
  },
}));
