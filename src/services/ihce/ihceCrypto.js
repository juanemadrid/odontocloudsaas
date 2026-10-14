/**
 * IHCE Crypto — Módulo Criptográfico Servidor AES-256-GCM
 * 
 * Implementa cifrado autenticado de secreto en reposo conforme al estándar
 * NIST SP 800-38D y los requerimientos de seguridad del Ministerio de Salud.
 * Cero dependencias externas (utiliza Web Crypto API nativo).
 * 
 * Estructura de Envelope Cifrado:
 * {
 *   v: 1,
 *   alg: 'AES-256-GCM',
 *   kid: 'v1',
 *   iv: '<base64 12 bytes>',
 *   ciphertext: '<base64 ciphertext + auth tag 16 bytes>'
 * }
 */

export class IhceCryptoError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'IhceCryptoError';
    this.statusCode = statusCode;
  }
}

export const base64ToUint8 = (b64) => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
};

export const uint8ToBase64 = (bytes) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
};

/**
 * Obtiene la clave de cifrado a partir de la variable de entorno o una clave suministrada.
 */
export async function loadKey(masterKeyBase64) {
  const rawB64 = masterKeyBase64 || 
    (typeof process !== 'undefined' ? process.env?.IHCE_MASTER_ENCRYPTION_KEY || process.env?.TENANT_SECRETS_MASTER_KEY : null);

  if (!rawB64) {
    throw new IhceCryptoError('Clave maestra de cifrado IHCE no configurada en el servidor (fail-closed).', 500);
  }

  const keyBytes = base64ToUint8(rawB64.trim());
  if (keyBytes.length !== 32) {
    throw new IhceCryptoError('Longitud de clave maestra inválida (debe ser exactamente 32 bytes para AES-256).', 500);
  }

  return await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra un secreto en texto plano usando AES-256-GCM y datos asociados autenticados (AAD).
 * 
 * @param {string} plaintext - El secreto (ej. client_secret o apim_key)
 * @param {string} aad - Contexto asociado (ej. `tenantId:repsCode:tipo`)
 * @param {string} [masterKeyBase64] - Clave maestra opcional
 * @returns {Promise<Object>} Envelope cifrado
 */
export async function encryptSecret(plaintext, aad, masterKeyBase64 = null) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new IhceCryptoError('El texto plano a cifrar debe ser un string no vacío.', 400);
  }

  const key = await loadKey(masterKeyBase64);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const aadBytes = new TextEncoder().encode(aad || '');

  const encryptedBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aadBytes },
    key,
    data
  );

  return {
    v: 1,
    alg: 'AES-256-GCM',
    kid: 'v1',
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(encryptedBuf))
  };
}

/**
 * Descifra un envelope cifrado con verificación de autenticidad AAD.
 * 
 * @param {Object} envelope - { v, alg, kid, iv, ciphertext }
 * @param {string} aad - Mismo contexto asociado usado al cifrar
 * @param {string} [masterKeyBase64] - Clave maestra opcional
 * @returns {Promise<string>} Texto descifrado
 */
export async function decryptSecret(envelope, aad, masterKeyBase64 = null) {
  if (!envelope || !envelope.iv || !envelope.ciphertext) {
    throw new IhceCryptoError('Envelope de secreto cifrado incompleto o corrupto.', 400);
  }

  if (envelope.alg !== 'AES-256-GCM') {
    throw new IhceCryptoError(`Algoritmo no soportado: ${envelope.alg}`, 400);
  }

  const key = await loadKey(masterKeyBase64);
  const iv = base64ToUint8(envelope.iv);
  const ciphertextBytes = base64ToUint8(envelope.ciphertext);
  const aadBytes = new TextEncoder().encode(aad || '');

  try {
    const decryptedBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aadBytes },
      key,
      ciphertextBytes
    );

    return new TextDecoder().decode(decryptedBuf);
  } catch (err) {
    throw new IhceCryptoError('Fallo de descifrado: autenticación GCM fallida o clave incorrecta.', 403);
  }
}
