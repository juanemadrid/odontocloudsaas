import supabase, { supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient.js';

// PostgREST exposes the tables available to the current authenticated role.
// Discover optional legacy tables without issuing requests to missing routes.
let cachedSchema = null;
let schemaRequest = null;
let schemaIdentity = null;

export async function hasOptionalBillingTable(table) {
  if (!['terceros', 'facturas_electronicas'].includes(table)) {
    throw new Error('Tabla opcional no permitida.');
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token || supabaseAnonKey;
  if (schemaIdentity !== token) {
    cachedSchema = null;
    schemaRequest = null;
    schemaIdentity = token;
  }
  if (cachedSchema && Date.now() - cachedSchema.at < 60000) return cachedSchema.paths.has('/' + table);
  if (!schemaRequest) {
    const request = (async () => {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}`, Accept: 'application/openapi+json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`No se pudo consultar el esquema de facturación (HTTP ${response.status}).`);
      const schema = await response.json();
      if (!schema.paths || typeof schema.paths !== 'object') throw new Error('Esquema de facturación inválido.');
      const result = { paths: new Set(Object.keys(schema.paths)), at: Date.now() };
      if (schemaIdentity === token) cachedSchema = result;
      return result;
    })();
    schemaRequest = request;
    request.finally(() => { if (schemaRequest === request) schemaRequest = null; }).catch(() => {});
  }
  return (await schemaRequest).paths.has('/' + table);
}

export async function queryOptionalBillingTable(table, query) {
  if (!await hasOptionalBillingTable(table)) return { data: [], error: null };
  return query(supabase.from(table));
}
