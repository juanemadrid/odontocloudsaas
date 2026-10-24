import { HELP_GEMINI_DEFAULT_MODEL, HELP_GEMINI_MODELS, isHelpApiKey } from '../_shared/helpApiKey.mjs';

export const HELP_KEY_AAD = 'odontocloud|help|gemini|v1';
export const HELP_DEFAULT_MODEL = HELP_GEMINI_DEFAULT_MODEL;
export const HELP_MODELS = new Set(HELP_GEMINI_MODELS);
export const HELP_SETTINGS_VERSION = '2026-10-24-auth-keys-1';
class SettingsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Tiny real generation verifies key, API access, model and current quota together.
// No clinic data, user input, or tools are included. No automatic retry or fallback key.
export async function testHelpKey({ apiKey, model, fetchImpl = fetch, signal }) {
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responde OK.' }] }],
      generationConfig: { maxOutputTokens: 8, temperature: 0, thinkingConfig: { thinkingBudget: 0 } } }),
  });
  // Never forward provider messages, which may contain credential fragments.
  if (response.status === 429) throw new SettingsError(429, 'Google indica que no hay cuota disponible. La clave anterior se conserva.');
  if ([400, 401, 403].includes(response.status)) throw new SettingsError(422, 'Google rechazó la clave o sus permisos. Revisa que permita usar la API de Gemini.');
  if (response.status === 404) throw new SettingsError(422, `El modelo seleccionado (${model}) no está disponible para esta clave.`);
  if (!response.ok) throw new SettingsError(503, 'Google no está disponible. Intenta más tarde; la clave anterior se conserva.');
  const result = await response.json();
  if (!result.candidates?.some(c => c.finishReason === 'STOP' && c.content?.parts?.some(p => typeof p.text === 'string' && p.text.trim()))) {
    throw new SettingsError(503, 'No se pudo completar la prueba de Gemini. La clave anterior se conserva.');
  }
}

export function createHelpSettingsHandler({ authenticate, readCredential, writeCredential, encrypt, canEncrypt,
  reserveCheck, env, fetchImpl = fetch, timeoutMs = 15000 }) {
  return async request => {
    const headers = { 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Odonto-Help-Version': HELP_SETTINGS_VERSION };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ success: false, error: 'Método no permitido.' }, 405);
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    try {
      const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
      if (!token) throw new SettingsError(401, 'Debes iniciar sesión.');
      const caller = await authenticate(token, controller.signal);
      if (!caller?.userId || caller.superadmin !== true) throw new SettingsError(403, 'Solo el superadministrador puede configurar esta clave.');
      const reader = request.body?.getReader();
      if (!reader) throw new SettingsError(400, 'Falta la solicitud.');
      const chunks = []; let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 4096) { await reader.cancel(); throw new SettingsError(413, 'Solicitud demasiado grande.'); }
        chunks.push(value);
      }
      const buffer = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
      let body;
      try { body = JSON.parse(new TextDecoder().decode(buffer)); } catch { throw new SettingsError(400, 'Solicitud inválida.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || !['status', 'test', 'save'].includes(body.action) ||
        Object.keys(body).some(k => !(body.action === 'status' ? ['action'] : ['action', 'apiKey', 'model']).includes(k))) {
        throw new SettingsError(400, 'Solicitud inválida.');
      }
      let encryptionReady = false;
      try { await canEncrypt(); encryptionReady = true; } catch { /* Return only a safe status. */ }
      if (body.action === 'status') {
        const row = await readCredential(controller.signal);
        return json({ success: true, configured: !!row || !!env('ODONTO_HELP_GEMINI_API_KEY'),
          source: row ? 'panel' : env('ODONTO_HELP_GEMINI_API_KEY') ? 'server' : 'none',
          model: HELP_MODELS.has(row?.model || env('ODONTO_HELP_GEMINI_MODEL')) ? (row?.model || env('ODONTO_HELP_GEMINI_MODEL')) : HELP_DEFAULT_MODEL,
          version: HELP_SETTINGS_VERSION,
          updatedAt: row?.updated_at || null, verifiedAt: row?.verified_at || null,
          encryptionReady, serverDisabled: env('ODONTO_HELP_ENABLED') === 'false',
          message: encryptionReady ? '' : 'La instalación del cifrado de ayuda está pendiente. Ejecuta el instalador actualizado del servidor y pulsa «Actualizar conexión».' });
      }
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
      const model = body.model || HELP_DEFAULT_MODEL;
      if (!isHelpApiKey(apiKey)) throw new SettingsError(400, 'Pega la clave completa usando «Copiar clave de API» de Google AI Studio. No debe contener espacios ni saltos de línea.');
      if (!HELP_MODELS.has(model)) throw new SettingsError(400, 'Selecciona un modelo de ayuda de Gemini compatible.');
      if (body.action === 'save' && !encryptionReady) throw new SettingsError(503, 'La instalación del cifrado de ayuda está pendiente. Ejecuta el instalador actualizado del servidor y pulsa «Actualizar conexión».');
      if (!await reserveCheck(caller.userId, controller.signal)) throw new SettingsError(429, 'Se alcanzó el límite de pruebas de conexión. Intenta más tarde.');
      // Encrypt before testing/writing so a missing master key can never replace the old key.
      const envelope = body.action === 'save' ? await encrypt(apiKey, HELP_KEY_AAD) : null;
      await testHelpKey({ apiKey, model, fetchImpl, signal: controller.signal });
      if (body.action === 'save') {
        if (controller.signal.aborted) throw new Error('aborted');
        await writeCredential({ id: true, encrypted_key: envelope, model, updated_by: caller.userId,
          updated_at: new Date().toISOString(), verified_at: new Date().toISOString() }, controller.signal);
      }
      return json({ success: true, configured: body.action === 'save', model,
        message: body.action === 'save' ? 'Clave probada y guardada. Activa el interruptor general y las clínicas que usarán la ayuda.' : 'Conexión correcta. Puedes guardar esta clave.' });
    } catch (error) {
      return json({ success: false, error: error instanceof SettingsError ? error.message :
        controller.signal.aborted ? 'La operación tardó demasiado o se canceló. Consulta el estado antes de volver a guardar.' :
          'No se pudo completar la operación. Consulta el estado antes de volver a guardar.' }, error instanceof SettingsError ? error.status : 503);
    } finally { clearTimeout(timer); request.signal.removeEventListener('abort', abort); }
  };
}
