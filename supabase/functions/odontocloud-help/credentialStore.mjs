import { HELP_KEY_AAD, HELP_MODELS } from '../odontocloud-help-settings/handler.mjs';
import { isHelpApiKey } from '../_shared/helpApiKey.mjs';

// The encrypted panel credential takes precedence. A decryption error fails closed;
// it must never silently fall back to a stale environment or another system's key.
export async function resolveStoredHelpConfig({ readCredential, decrypt, env, signal }) {
  const row = await readCredential(signal);
  if (!row) return {};
  if (!HELP_MODELS.has(row.model)) throw new Error('Invalid help model');
  const apiKey = await decrypt(row.encrypted_key, HELP_KEY_AAD);
  if (!isHelpApiKey(apiKey)) throw new Error('Invalid help credential');
  return { ODONTO_HELP_PROVIDER: 'gemini', ODONTO_HELP_GEMINI_MODEL: row.model,
    ODONTO_HELP_GEMINI_API_KEY: apiKey,
    ODONTO_HELP_ENABLED: env('ODONTO_HELP_ENABLED') ?? 'true' };
}
