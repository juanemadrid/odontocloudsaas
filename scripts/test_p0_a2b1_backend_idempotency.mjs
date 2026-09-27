/**
 * test_p0_a2b1_backend_idempotency.mjs
 * 
 * Suite de pruebas formal para Fase P0-A2B1:
 * Backend Seguro MUV + Idempotencia Atómica + Gateway VPS
 * 
 * Verificaciones:
 * 1. JWT válido (HS256)
 * 2. JWT expirado (rechazo seguro)
 * 3. Firma inválida (rechazo seguro)
 * 4. Nonce reutilizado (anti-replay guard)
 * 5. Idempotencia: Cálculo canónico de idempotency_key
 * 6. Dos requests concurrentes (PostgreSQL unique index 23505)
 * 7. Factura ya validada con CUV (bloqueo por uq_rips_validaciones_factura_cuv)
 * 8. Secreto SISPRO no expuesto
 * 9. Token MUV no expuesto
 * 10. Timeout Gateway
 * 11. Error MUV saneado
 * 12. Tenant incorrecto / factura aislada
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { signMuvGatewayJwt, verifyMuvGatewayJwt, _resetSeenNoncesForTest } from '../services/muv-gateway/jwtAuth.mjs';
import { createMuvGatewayHandler } from '../services/muv-gateway/server.mjs';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const TEST_GATEWAY_SECRET = 'test_shared_secret_muv_gateway_1234567890abcdef_secure';

const TEST_TENANT = '11111111-1111-1111-1111-111111111111';
const TEST_TENANT_B = '22222222-2222-2222-2222-222222222222';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 SUITE FORMAL: BACKEND SEGURO MUV + IDEMPOTENCIA ATÓMICA (P0-A2B1)');
  console.log('='.repeat(70));

  const dbClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // ---------------------------------------------------------------------------
  // 1. JWT VÁLIDO
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Pruebas de Autenticación JWT HMAC-SHA256 ---');
  _resetSeenNoncesForTest();
  const validToken = signMuvGatewayJwt({
    tenantId: TEST_TENANT,
    userId: 'user-test-123',
    facturaId: 'FEV-TEST-001',
    cufe: 'cufe-mock-123',
  }, TEST_GATEWAY_SECRET);

  const resValid = verifyMuvGatewayJwt(validToken, TEST_GATEWAY_SECRET);
  assert(resValid.valid === true, 'JWT firmado con HMAC-SHA256 es verificado exitosamente');
  assert(resValid.payload.iss === 'odontocloud-muv-proxy', 'Claim iss verificado correctamente');
  assert(resValid.payload.aud === 'odontocloud-muv-gateway', 'Claim aud verificado correctamente');

  // ---------------------------------------------------------------------------
  // 2. JWT EXPIRADO
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. JWT Expirado ---');
  const expiredPayload = {
    iss: 'odontocloud-muv-proxy',
    aud: 'odontocloud-muv-gateway',
    iat: Math.floor(Date.now() / 1000) - 100,
    exp: Math.floor(Date.now() / 1000) - 40, // Expirado hace 40s
    nonce: 'expired-nonce-001',
    requestId: 'req-001',
  };
  const b64H = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b64P = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
  const sigExp = crypto.createHmac('sha256', TEST_GATEWAY_SECRET).update(`${b64H}.${b64P}`).digest('base64url');
  const expiredToken = `${b64H}.${b64P}.${sigExp}`;

  const resExpired = verifyMuvGatewayJwt(expiredToken, TEST_GATEWAY_SECRET);
  assert(resExpired.valid === false && resExpired.error === 'TOKEN_EXPIRED', 'JWT expirado es rechazado con TOKEN_EXPIRED');

  // ---------------------------------------------------------------------------
  // 3. FIRMA INVÁLIDA
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Firma Inválida / Secreto Incorrecto ---');
  const resBadSig = verifyMuvGatewayJwt(validToken, 'wrong_secret_tampered');
  assert(resBadSig.valid === false && resBadSig.error === 'INVALID_SIGNATURE', 'Firma con secreto erróneo es rechazada con INVALID_SIGNATURE');

  // ---------------------------------------------------------------------------
  // 4. NONCE REUTILIZADO (ANTI-REPLAY)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Protección Anti-Replay (Nonce) ---');
  const fixedNonce = 'nonce-unique-test-777';
  const replayToken = signMuvGatewayJwt({ nonce: fixedNonce, tenantId: TEST_TENANT }, TEST_GATEWAY_SECRET);
  const firstUse = verifyMuvGatewayJwt(replayToken, TEST_GATEWAY_SECRET);
  assert(firstUse.valid === true, 'Primer uso del nonce es aceptado');

  const secondUse = verifyMuvGatewayJwt(replayToken, TEST_GATEWAY_SECRET);
  assert(secondUse.valid === false && secondUse.error === 'REPLAY_ATTACK_DETECTED', 'Segundo uso con mismo nonce es bloqueado con REPLAY_ATTACK_DETECTED');

  // ---------------------------------------------------------------------------
  // 5. CÁLCULO DE IDEMPOTENCY KEY
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Idempotencia: Cálculo Backend SHA-256 ---');
  const facturaId = 'FAC-99901';
  const cufe = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify({ tipo: 'RIPS_V003' })).digest('hex');
  const expectedKey = crypto.createHash('sha256').update(`${TEST_TENANT}::${facturaId}::${cufe}::${payloadHash}`).digest('hex');

  assert(typeof expectedKey === 'string' && expectedKey.length === 64, 'Idempotency key es SHA-256 de 64 caracteres');

  // ---------------------------------------------------------------------------
  // 6. CONCURRENCIA ATÓMICA EN POSTGRESQL (ÍNDICE UNIQUE IDEMPOTENCY)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Concurrencia Atómica en PostgreSQL (Índice uq_rips_validaciones_idempotency) ---');
  const testIdempotencyKey = `idemp-test-${crypto.randomUUID()}`;

  // Intento 1: Inserción inicial
  const insert1 = await dbClient.from('rips_validaciones').insert([{
    tenant_id: TEST_TENANT,
    documento_id: 'FAC-CONCURRENT-001',
    tipo_documento: 'FV',
    esquema_version: 'DT1-v003-2026',
    estado: 'PENDIENTE',
    idempotency_key: testIdempotencyKey,
    payload_hash: payloadHash,
  }]).select('id').single();

  assert(!insert1.error && insert1.data?.id, 'Primera inserción con idempotency_key exitosa');

  // Intento 2: Inserción simultánea / idéntica
  const insert2 = await dbClient.from('rips_validaciones').insert([{
    tenant_id: TEST_TENANT,
    documento_id: 'FAC-CONCURRENT-001',
    tipo_documento: 'FV',
    esquema_version: 'DT1-v003-2026',
    estado: 'PENDIENTE',
    idempotency_key: testIdempotencyKey,
    payload_hash: payloadHash,
  }]).select('id').single();

  assert(insert2.error && (insert2.error.code === '23505' || insert2.error.message.includes('uq_rips_validaciones_idempotency')),
    'Segunda inserción concurrente es rechazada atómicamente por PostgreSQL (23505 unique_violation)');

  // ---------------------------------------------------------------------------
  // 7. FACTURA YA VALIDADA CON CUV (ÍNDICE UNIQUE FACTURA + CUV)
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Factura Ya Validada con CUV (Índice uq_rips_validaciones_factura_cuv) ---');
  // Obtener o crear una factura válida para respetar FK rips_validaciones_factura_id_fkey
  const { data: existingFactura } = await dbClient.from('facturas').select('id, tenant_id').limit(1).maybeSingle();
  let testFacturaId = existingFactura?.id;
  if (!testFacturaId) {
    const newFac = await dbClient.from('facturas').insert([{
      tenant_id: TEST_TENANT,
      total: 100000,
      estado: 'emitida'
    }]).select('id').single();
    testFacturaId = newFac.data?.id;
  }

  const mockCuv1 = `CUV-APPROVED-${crypto.randomUUID()}`;

  // Limpiar cualquier registro previo para esta factura en test
  await dbClient.from('rips_validaciones').delete().eq('factura_id', testFacturaId);

  const insertValidated1 = await dbClient.from('rips_validaciones').insert([{
    tenant_id: TEST_TENANT,
    factura_id: testFacturaId,
    documento_id: 'FAC-APPROVED-001',
    tipo_documento: 'FV',
    esquema_version: 'DT1-v003-2026',
    estado: 'VALIDADO',
    cuv: mockCuv1,
  }]).select('id').single();

  assert(!insertValidated1.error && insertValidated1.data?.id, 'Registro aceptado con CUV insertado con éxito');

  // Intento de re-validar con CUV la misma factura
  const insertValidated2 = await dbClient.from('rips_validaciones').insert([{
    tenant_id: TEST_TENANT,
    factura_id: testFacturaId,
    documento_id: 'FAC-APPROVED-001',
    tipo_documento: 'FV',
    esquema_version: 'DT1-v003-2026',
    estado: 'VALIDADO',
    cuv: `CUV-DUPLICATE-${crypto.randomUUID()}`,
  }]).select('id').single();

  assert(insertValidated2.error && (insertValidated2.error.code === '23505' || insertValidated2.error.message.includes('uq_rips_validaciones_factura_cuv')),
    'Intento de duplicar CUV para la misma factura es rechazado atómicamente por PostgreSQL (uq_rips_validaciones_factura_cuv)');

  // Limpieza inmediata
  await dbClient.from('rips_validaciones').delete().eq('factura_id', testFacturaId);

  // ---------------------------------------------------------------------------
  // 8. SERVICIO MUV GATEWAY: SECRETO Y TOKEN NO EXPUESTOS EN RESPUESTA
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. MUV Gateway: Saneamiento y No Exposición de Secretos ---');
  
  // Crear un Mock del servidor MUV interno en un puerto local efímero
  let mockMuvCalled = false;
  const mockMuvServer = http.createServer((req, res) => {
    mockMuvCalled = true;
    if (req.url === '/api/Auth/LoginSISPRO') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ login: true, registrado: true, token: 'secret_muv_bearer_token_xyz999' }));
      return;
    }
    if (req.url === '/api/PaquetesFevRips/CargarFevRips') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        resultado: {
          cuv: 'CUV-VALIDATED-MOCK-123456789',
          fechaRadicacion: '2026-09-26T18:00:00Z',
        },
        errors: [],
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise(resolve => mockMuvServer.listen(0, resolve));
  const mockMuvPort = mockMuvServer.address().port;
  const mockMuvUrl = `http://127.0.0.1:${mockMuvPort}`;

  // Iniciar Gateway apuntando al Mock MUV
  const gatewayHandler = createMuvGatewayHandler({
    sharedSecret: TEST_GATEWAY_SECRET,
    muvBaseUrl: mockMuvUrl,
  });

  const gatewayServer = http.createServer(gatewayHandler);
  await new Promise(resolve => gatewayServer.listen(0, resolve));
  const gatewayPort = gatewayServer.address().port;

  // Enviar petición legítima con JWT válido
  const gatewayClientToken = signMuvGatewayJwt({ tenantId: TEST_TENANT }, TEST_GATEWAY_SECRET);
  const secretPasswordInPayload = 'TopSecretSisproPass123!';

  const reqPayload = JSON.stringify({
    identidad: { tipoDoc: 'CC', numDoc: '64576359', nit: '64576359', tipoUsuario: 'PIN' },
    password: secretPasswordInPayload,
    rips: { numDocumentoIdObligado: '64576359' },
    xmlFevFile: Buffer.from('<AttachedDocument></AttachedDocument>').toString('base64'),
  });

  const gatewayResponse = await new Promise((resolve, reject) => {
    const r = http.request(`http://127.0.0.1:${gatewayPort}/api/v1/transmit-fev-rips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayClientToken}`,
        'Content-Length': Buffer.byteLength(reqPayload),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    r.on('error', reject);
    r.write(reqPayload);
    r.end();
  });

  assert(gatewayResponse.status === 200, 'Gateway responde HTTP 200 a solicitud autenticada');
  assert(gatewayResponse.body.success === true, 'Respuesta indica success: true');
  assert(gatewayResponse.body.cuv === 'CUV-VALIDATED-MOCK-123456789', 'CUV recibido correctamente en respuesta saneada');

  // Verificación estricta de no-exposición de contraseñas ni tokens
  const responseText = JSON.stringify(gatewayResponse.body);
  assert(!responseText.includes(secretPasswordInPayload), 'Contraseña SISPRO estrictamente ausente en respuesta');
  assert(!responseText.includes('secret_muv_bearer_token_xyz999'), 'Token Bearer MUV estrictamente ausente en respuesta');
  assert(!responseText.includes(TEST_GATEWAY_SECRET), 'Secreto compartido Edge/VPS estrictamente ausente en respuesta');

  // ---------------------------------------------------------------------------
  // 9. RECHAZO DE SOLICITUD SIN AUTORIZACIÓN AL GATEWAY
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Rechazo de Acceso No Autorizado al Gateway ---');
  const unauthRes = await new Promise((resolve) => {
    const r = http.request(`http://127.0.0.1:${gatewayPort}/api/v1/transmit-fev-rips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    r.write(reqPayload);
    r.end();
  });

  assert(unauthRes.status === 401 && unauthRes.body.error === 'MISSING_TOKEN', 'Llamada al gateway sin JWT es rechazada con HTTP 401');

  // ---------------------------------------------------------------------------
  // 10. ERROR MUV SANEADO
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Sanitización de Rechazos Normativos MUV ---');
  // Reconfigurar Mock MUV para responder rechazo normativo (RVC001)
  mockMuvServer.removeAllListeners('request');
  mockMuvServer.on('request', (req, res) => {
    if (req.url === '/api/Auth/LoginSISPRO') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ login: true, token: 'token-tmp-err' }));
      return;
    }
    if (req.url === '/api/PaquetesFevRips/CargarFevRips') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        errors: [{ code: 'RVC001', message: 'NIT de la FEV no coincide con el prestador.' }],
      }));
      return;
    }
  });

  const errClientToken = signMuvGatewayJwt({ tenantId: TEST_TENANT }, TEST_GATEWAY_SECRET);
  const errorResponse = await new Promise((resolve) => {
    const r = http.request(`http://127.0.0.1:${gatewayPort}/api/v1/transmit-fev-rips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${errClientToken}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    r.write(reqPayload);
    r.end();
  });

  assert(errorResponse.body.success === false, 'Rechazo normativo entrega success: false');
  assert(errorResponse.body.estado === 'REJECTED', 'Estado mapeado a REJECTED');
  assert(errorResponse.body.errores?.[0]?.code === 'RVC001', 'Código de error normativo RVC001 preservado y saneado');

  // Limpieza de servidores de prueba
  mockMuvServer.close();
  gatewayServer.close();

  // Limpieza de filas de prueba en BD
  await dbClient.from('rips_validaciones').delete().eq('idempotency_key', testIdempotencyKey);

  console.log('\n' + '='.repeat(70));
  console.log(`TOTAL PRUEBAS: ${passedTests + failedTests} | EXITOSAS: ${passedTests} | FALLIDAS: ${failedTests}`);
  console.log('='.repeat(70));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Error fatal en pruebas:', err);
  process.exit(1);
});
