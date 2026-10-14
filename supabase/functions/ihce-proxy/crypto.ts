// supabase/functions/ihce-proxy/crypto.ts
// ============================================================================
// MÓDULO CRIPTOGRÁFICO SERVIDOR AES-256-GCM / Web Crypto API (IHCE)
// ============================================================================
// Cumplimiento estricto:
// - Procesa claves y cifrado exclusivamente en el servidor (Deno / Edge Runtime).
// - Prohibido cifrado o exposición de claves maestras en el frontend.
// - Cero dependencias externas.
// ============================================================================

export class CryptoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const base64ToUint8 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
};

export const uint8ToBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
};

export interface EncryptedEnvelope {
  v: number;
  alg: string;
  kid: string;
  iv: string;
  ciphertext: string;
}

const getEnvVar = (name: string): string | undefined => {
  if (typeof Deno !== "undefined" && Deno.env && Deno.env.get) {
    return Deno.env.get(name);
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }
  return undefined;
};

export const getActiveKeyId = (): string => {
  return getEnvVar("IHCE_ACTIVE_KEY_ID") || getEnvVar("TENANT_SECRETS_ACTIVE_KEY_ID") || "v1";
};

export async function loadEncryptionKey(kid = getActiveKeyId()): Promise<CryptoKey> {
  const rawB64 = getEnvVar("IHCE_MASTER_ENCRYPTION_KEY") ||
                 getEnvVar(`IHCE_MASTER_ENCRYPTION_KEY_${kid.toUpperCase()}`) ||
                 getEnvVar("TENANT_SECRETS_MASTER_KEY") ||
                 getEnvVar("TENANT_SECRETS_MASTER_KEY_V1");

  if (!rawB64) {
    throw new CryptoError(500, "Clave maestra de cifrado IHCE no configurada en el servidor (fail-closed).");
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToUint8(rawB64.trim());
  } catch {
    throw new CryptoError(500, "Formato de clave maestra IHCE inválido (base64 requerido).");
  }

  if (keyBytes.length !== 32) {
    throw new CryptoError(500, "Longitud de clave maestra inválida (debe ser exactamente 32 bytes para AES-256).");
  }

  const cryptoObj = globalThis.crypto;
  return await cryptoObj.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(plaintext: string, aadString: string): Promise<EncryptedEnvelope> {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new CryptoError(400, "El secreto debe ser un texto válido no vacío.");
  }
  const kid = getActiveKeyId();
  const key = await loadEncryptionKey(kid);
  const cryptoObj = globalThis.crypto;
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const aad = new TextEncoder().encode(aadString);

  const encryptedBuf = await cryptoObj.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    data
  );

  return {
    v: 1,
    alg: "AES-256-GCM",
    kid,
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(encryptedBuf)),
  };
}

export async function decryptSecret(envelope: EncryptedEnvelope, aadString: string): Promise<string> {
  if (!envelope || envelope.v !== 1 || envelope.alg !== "AES-256-GCM" || !envelope.iv || !envelope.ciphertext) {
    throw new CryptoError(400, "Estructura de sobre cifrado inválida.");
  }
  const key = await loadEncryptionKey(envelope.kid || "v1");
  const cryptoObj = globalThis.crypto;
  const iv = base64ToUint8(envelope.iv);
  const ciphertextWithTag = base64ToUint8(envelope.ciphertext);
  const aad = new TextEncoder().encode(aadString);

  try {
    const decryptedBuf = await cryptoObj.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      ciphertextWithTag
    );
    return new TextDecoder().decode(decryptedBuf);
  } catch (err) {
    throw new CryptoError(400, "Fallo al descifrar el secreto: verificación de integridad/AAD rechazada.");
  }
}
