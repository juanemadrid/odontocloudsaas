import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { createHelpHandler, HelpError } from './handler.mjs';
import { authenticateHelp } from './auth.mjs';

Deno.serve(createHelpHandler({
  env: (name: string) => Deno.env.get(name),
  authenticate: async (token: string) => {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new HelpError(503, 'El servicio de ayuda no está configurado.');
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    return authenticateHelp(admin, token);
  },
}));
