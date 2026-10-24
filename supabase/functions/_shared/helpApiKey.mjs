// Google validates authenticity. Do not assume a prefix, fixed length, or an
// alphanumeric-only alphabet: authorization keys differ from older API keys.
export const HELP_API_KEY_MAX_LENGTH = 1024;
export const HELP_GEMINI_DEFAULT_MODEL = 'gemini-1.5-flash';
export const HELP_GEMINI_MODELS = Object.freeze([
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]);
export function isHelpApiKey(value) {
  // Bounded printable ASCII is safe in x-goog-api-key; reject whitespace/CRLF.
  return typeof value === 'string' && /^[\x21-\x7e]{20,1024}$/.test(value);
}
