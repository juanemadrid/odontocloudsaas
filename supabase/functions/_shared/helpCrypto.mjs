// Dedicated help encryption. No credentials from another app or clinic are used.
export const HELP_MASTER_FILE = '/home/deno/functions/.odonto-help-secrets/master-key-v1';
export const HELP_MASTER_KID = 'help-v1';
const toBase64 = bytes => btoa(String.fromCharCode(...bytes));
const fromBase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));

export function createHelpCrypto({ env, readPrivateFile, legacyEncrypt, legacyDecrypt, legacyCanEncrypt }) {
  async function dedicatedKey() {
    let raw = env('ODONTO_HELP_MASTER_KEY_V1');
    if (!raw) {
      try { raw = await readPrivateFile(HELP_MASTER_FILE); }
      catch (error) {
        // Only absence permits legacy fallback. Permission/corruption errors fail closed.
        if (error?.name === 'NotFound' || error?.code === 'ENOENT') return null;
        throw new Error('Help encryption unavailable');
      }
    }
    try {
      const bytes = fromBase64(raw.trim());
      if (bytes.length !== 32) throw new Error();
      return await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    } catch { throw new Error('Invalid help encryption configuration'); }
  }
  return {
    async canEncrypt() {
      if (await dedicatedKey()) return;
      await legacyCanEncrypt();
    },
    async encrypt(plaintext, aadString) {
      const key = await dedicatedKey();
      if (!key) return legacyEncrypt(plaintext, aadString);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
        additionalData: new TextEncoder().encode(aadString) }, key, new TextEncoder().encode(plaintext));
      return { v: 1, alg: 'A256GCM', kid: HELP_MASTER_KID, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
    },
    async decrypt(envelope, aadString) {
      if (envelope?.kid !== HELP_MASTER_KID) return legacyDecrypt(envelope, aadString);
      const key = await dedicatedKey();
      if (!key || envelope.v !== 1 || envelope.alg !== 'A256GCM' || typeof envelope.iv !== 'string' ||
        typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > 2048) throw new Error('Help encryption unavailable');
      try {
        const iv = fromBase64(envelope.iv);
        if (iv.length !== 12) throw new Error();
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv,
          additionalData: new TextEncoder().encode(aadString) }, key, fromBase64(envelope.ciphertext));
        return new TextDecoder().decode(plain);
      } catch { throw new Error('Help credential integrity check failed'); }
    },
  };
}
