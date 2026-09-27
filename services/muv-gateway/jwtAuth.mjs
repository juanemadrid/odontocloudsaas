/**
 * jwtAuth.mjs
 * 
 * Verificador criptográfico de tokens JWT HMAC-SHA256 (HS256)
 * para el canal seguro Supabase Edge Function (muv-proxy) → VPS (muv-gateway).
 * 
 * Reglas de seguridad:
 * 1. Firma estrictamente HMAC-SHA256 validada con timingSafeEqual.
 * 2. TTL máximo: 60 segundos.
 * 3. Deriva máxima de reloj (drift): 10 segundos.
 * 4. Protección estricta contra Replay Attack mediante caché de nonces con auto-expiración.
 * 5. Claims requeridas: iss, aud, iat, exp, nonce, requestId.
 */

import crypto from 'node:crypto';

// Caché en memoria para mitigar Replay Attacks (nonce -> expMs)
const seenNonces = new Map();

// Limpieza periódica de nonces expirados
function purgeExpiredNonces() {
  const now = Date.now();
  for (const [nonce, expMs] of seenNonces.entries()) {
    if (expMs <= now) {
      seenNonces.delete(nonce);
    }
  }
}

// Intervalo de limpieza cada 30 segundos
setInterval(purgeExpiredNonces, 30_000).unref();

/**
 * Firma un JWT HMAC-SHA256 para emisión desde Edge / cliente interno.
 */
export function signMuvGatewayJwt(claims, secret) {
  if (!secret || typeof secret !== 'string') {
    throw new Error('MUV_GATEWAY_SHARED_SECRET es obligatorio.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'odontocloud-muv-proxy',
    aud: 'odontocloud-muv-gateway',
    iat: nowSec,
    exp: nowSec + Math.min(60, claims.ttlSec || 60),
    nonce: claims.nonce || crypto.randomUUID(),
    requestId: claims.requestId || crypto.randomUUID(),
    tenantId: claims.tenantId,
    userId: claims.userId,
    ...claims,
  };

  delete payload.ttlSec;

  const header = { alg: 'HS256', typ: 'JWT' };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${b64Header}.${b64Payload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  return `${data}.${sig}`;
}

/**
 * Valida un token JWT entrante en muv-gateway.
 */
export function verifyMuvGatewayJwt(token, secret) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'MISSING_TOKEN', message: 'Token JWT ausente.' };
  }
  if (!secret || typeof secret !== 'string') {
    return { valid: false, error: 'CONFIG_ERROR', message: 'MUV_GATEWAY_SHARED_SECRET no configurado en servidor.' };
  }

  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'INVALID_FORMAT', message: 'Formato JWT inválido.' };
  }

  const [b64Header, b64Payload, sig] = parts;
  const data = `${b64Header}.${b64Payload}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'INVALID_SIGNATURE', message: 'Firma HMAC-SHA256 inválida.' };
  }

  let header, payload;
  try {
    header = JSON.parse(Buffer.from(b64Header, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'MALFORMED_PAYLOAD', message: 'Payload JWT no es JSON válido.' };
  }

  if (header.alg !== 'HS256') {
    return { valid: false, error: 'UNSUPPORTED_ALG', message: `Algoritmo '${header.alg}' no permitido; use HS256.` };
  }

  // Validaciones de Claims
  if (payload.iss !== 'odontocloud-muv-proxy') {
    return { valid: false, error: 'INVALID_ISSUER', message: `Emisor '${payload.iss}' no autorizado.` };
  }
  if (payload.aud !== 'odontocloud-muv-gateway') {
    return { valid: false, error: 'INVALID_AUDIENCE', message: `Audiencia '${payload.aud}' no autorizada.` };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Comprobar deriva de reloj (máximo 10s al futuro)
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 10) {
    return { valid: false, error: 'INVALID_IAT', message: 'Fecha de emisión (iat) futura o inválida.' };
  }

  // Comprobar expiración
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return { valid: false, error: 'TOKEN_EXPIRED', message: 'Token JWT ha expirado.' };
  }

  // Comprobar TTL máximo de 60 segundos
  if (payload.exp - payload.iat > 60) {
    return { valid: false, error: 'TTL_EXCEEDED', message: 'TTL de token excede el máximo permitido de 60 segundos.' };
  }

  // Comprobar Nonce y protección anti-replay
  if (!payload.nonce || typeof payload.nonce !== 'string' || payload.nonce.trim().length === 0) {
    return { valid: false, error: 'MISSING_NONCE', message: 'Claim nonce es obligatorio.' };
  }

  const nonce = payload.nonce.trim();
  if (seenNonces.has(nonce)) {
    return { valid: false, error: 'REPLAY_ATTACK_DETECTED', message: 'Nonce ya utilizado; solicitud rechazada por protección anti-replay.' };
  }

  // Registrar nonce hasta su fecha de expiración
  seenNonces.set(nonce, payload.exp * 1000);

  if (!payload.requestId || typeof payload.requestId !== 'string') {
    return { valid: false, error: 'MISSING_REQUEST_ID', message: 'Claim requestId es obligatorio.' };
  }

  return { valid: true, payload };
}

/**
 * Resetea el caché de nonces (solo para pruebas unitarias).
 */
export function _resetSeenNoncesForTest() {
  seenNonces.clear();
}
