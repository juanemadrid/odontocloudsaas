// supabase/functions/tenant-secrets/crypto.ts
// ============================================================================
// MÓDULO CRIPTOGRÁFICO FORMAL AES-256-GCM / Web Crypto API
// ============================================================================
// Compatible nativamente con Deno (Supabase Edge Runtime) y Node.js.
// Cero dependencias externas.
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
  return getEnvVar("TENANT_SECRETS_ACTIVE_KEY_ID") || "v1";
};

export async function loadEncryptionKey(kid = getActiveKeyId()): Promise<CryptoKey> {
  const envVarName = kid === "v1" ? "TENANT_SECRETS_MASTER_KEY_V1" : `TENANT_SECRETS_MASTER_KEY_${kid.toUpperCase()}`;
  const rawB64 = getEnvVar(envVarName) || (kid === "v1" ? getEnvVar("TENANT_SECRETS_MASTER_KEY") : undefined);

  if (!rawB64) {
    throw new CryptoError(500, "Clave maestra de cifrado no disponible (fail-closed).");
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToUint8(rawB64.trim());
  } catch {
    throw new CryptoError(500, "Formato de clave maestra invalido.");
  }

  if (keyBytes.length !== 32) {
    throw new CryptoError(500, "Longitud de clave maestra invalida (debe ser exactamente 32 bytes).");
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
  if (typeof plaintext !== "string") {
    throw new CryptoError(400, "El secreto debe ser un texto valido.");
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
    alg: "A256GCM",
    kid,
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(encryptedBuf)),
  };
}

export async function decryptSecret(envelope: unknown, aadString: string): Promise<string> {
  if (!envelope || typeof envelope !== "object") {
    throw new CryptoError(400, "Estructura de envelope cifrado invalida.");
  }
  const env = envelope as Partial<EncryptedEnvelope>;
  if (env.v !== 1 || env.alg !== "A256GCM" || !env.kid || !env.iv || !env.ciphertext) {
    throw new CryptoError(400, "Parametros de envelope cifrado invalidos.");
  }

  const key = await loadEncryptionKey(env.kid);
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    iv = base64ToUint8(env.iv);
    ciphertext = base64ToUint8(env.ciphertext);
  } catch {
    throw new CryptoError(400, "Fallo al decodificar Base64 del envelope.");
  }

  if (iv.length !== 12) {
    throw new CryptoError(400, "Longitud de IV invalida (debe ser 12 bytes).");
  }

  const aad = new TextEncoder().encode(aadString);
  const cryptoObj = globalThis.crypto;

  try {
    const decryptedBuf = await cryptoObj.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuf);
  } catch {
    throw new CryptoError(403, "Fallo de autenticacion de integridad criptografica (tamper o AAD mismatch).");
  }
}

export async function decryptInstitutionalSisproSecret(tenantId: string, envelope: unknown): Promise<string> {
  return await decryptSecret(envelope, `${tenantId}|sispro|institutional|v1`);
}

export async function decryptDoctorSisproSecret(tenantId: string, doctorId: string, envelope: unknown): Promise<string> {
  return await decryptSecret(envelope, `${tenantId}|sispro|doctor|${doctorId}|v1`);
}
