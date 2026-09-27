/**
 * server.mjs
 * 
 * Componente: muv-gateway (OdontoCloud VPS Gateway)
 * 
 * Responsabilidades:
 * 1. Escucha en puerto 443 (o MUV_GATEWAY_PORT para desarrollo/tests).
 * 2. Autentica exclusivamente peticiones de Supabase Edge Functions mediante HMAC-SHA256 JWT (TTL <= 60s).
 * 3. Valida protección anti-replay (nonce único).
 * 4. Aplica límite de tamaño de payload (15MB) y timeout de conexión (30s).
 * 5. Se comunica internamente con MUV Docker en https://127.0.0.1:9443 (NO expuesto a WAN).
 * 6. Orquesta LoginSISPRO + CargarFevRips destruyendo secretos y tokens en memoria RAM.
 * 7. CERO logging de contraseñas, tokens JWT, headers de autorización o payloads XML.
 * 8. Retorna respuestas estrictamente saneadas.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { verifyMuvGatewayJwt } from './jwtAuth.mjs';

const DEFAULT_MUV_URL = process.env.MUV_DOCKER_URL || 'https://127.0.0.1:9443';
const MAX_BODY_BYTES = 15 * 1024 * 1024; // 15 MB
const REQUEST_TIMEOUT_MS = 30_000; // 30s timeout

/**
 * Obtiene agente HTTPS con certificado local o configuración TLS segura.
 */
function getMuvHttpsAgent() {
  const certPath = process.env.MUV_CERT_PATH || 'C:/Certificates/fevripsapilocal.pem';
  let ca = null;
  if (fs.existsSync(certPath)) {
    try {
      ca = fs.readFileSync(certPath);
    } catch (_) {}
  }

  return new https.Agent({
    ca: ca || undefined,
    rejectUnauthorized: Boolean(ca), // Si hay certificado pinned, valida; si no, entorno de prueba
    keepAlive: false,
  });
}

/**
 * Invoca LoginSISPRO contra MUV Docker interno.
 */
async function callInternalLoginSISPRO(identidad, password, muvBaseUrl = DEFAULT_MUV_URL) {
  const agent = getMuvHttpsAgent();
  const requestBody = {
    persona: {
      identificacion: {
        tipo: String(identidad.tipoDoc || 'CC').trim(),
        numero: String(identidad.numDoc).trim(),
      },
    },
    clave: String(password),
    nit: String(identidad.nit).trim(),
  };

  if (identidad.tipoUsuario) {
    requestBody.tipoUsuario = String(identidad.tipoUsuario).trim();
  }

  const payloadString = JSON.stringify(requestBody);

  return new Promise((resolve, reject) => {
    const url = new URL('/api/Auth/LoginSISPRO', muvBaseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      url,
      {
        method: 'POST',
        agent: isHttps ? agent : undefined,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve({
              httpStatus: res.statusCode || 200,
              success: Boolean(data?.login && data?.token),
              token: data?.token || null,
              errors: data?.errors || [],
              registrado: data?.registrado || false,
            });
          } catch (e) {
            resolve({
              httpStatus: res.statusCode || 500,
              success: false,
              token: null,
              errors: [`Error parseando respuesta LoginSISPRO: ${e.message}`],
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TIMEOUT_LOGIN_SISPRO: MUV no respondió en el tiempo límite.'));
    });

    req.on('error', err => {
      reject(new Error(`CONEXION_MUV_FALLIDA: ${err.message}`));
    });

    req.write(payloadString);
    req.end();
  });
}

export const MUV_OPERATIONS = {
  FEV_RIPS: 'FEV_RIPS',
  NC_PARTIAL: 'NC_PARTIAL',
  NC_TOTAL: 'NC_TOTAL',
};

export const MUV_ENDPOINT_MAPPING = {
  FEV_RIPS: '/api/PaquetesFevRips/CargarFevRips',
  NC_PARTIAL: '/api/PaquetesFevRips/CargarNC',
  NC_TOTAL: '/api/PaquetesFevRips/CargarNCTotal',
};

/**
 * Invoca endpoint MUV interno según la ruta autoritativa mapeada por el enum fijo.
 */
async function callInternalMuvEndpoint(token, muvPath, payload, muvBaseUrl = DEFAULT_MUV_URL) {
  const agent = getMuvHttpsAgent();
  const rawBody = JSON.stringify(payload);
  const bodyBuffer = Buffer.from(rawBody, 'utf8');
  const gzipBuffer = zlib.gzipSync(bodyBuffer);

  return new Promise((resolve, reject) => {
    const url = new URL(muvPath, muvBaseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      url,
      {
        method: 'POST',
        agent: isHttps ? agent : undefined,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Content-Length': gzipBuffer.length,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve({
              httpStatus: res.statusCode || 200,
              data,
            });
          } catch (e) {
            resolve({
              httpStatus: res.statusCode || 500,
              data: { error: `Error parseando respuesta MUV (${muvPath}): ${e.message}`, raw: raw.slice(0, 300) },
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`TIMEOUT_MUV: MUV no respondió en el tiempo límite (${muvPath}).`));
    });

    req.on('error', err => {
      reject(new Error(`CONEXION_MUV_FALLIDA: ${err.message}`));
    });

    req.write(gzipBuffer);
    req.end();
  });
}

/**
 * Invoca CargarFevRips contra MUV Docker interno (compatibilidad hacia atrás).
 */
async function callInternalCargarFevRips(token, rips, xmlFevFile, muvBaseUrl = DEFAULT_MUV_URL) {
  return callInternalMuvEndpoint(token, MUV_ENDPOINT_MAPPING.FEV_RIPS, { rips, xmlFevFile }, muvBaseUrl);
}

/**
 * Crea el manejador HTTP del Gateway.
 */
export function createMuvGatewayHandler(options = {}) {
  const sharedSecret = options.sharedSecret || process.env.MUV_GATEWAY_SHARED_SECRET;
  const muvBaseUrl = options.muvBaseUrl || DEFAULT_MUV_URL;

  return async function handleRequest(req, res) {
    const sendJson = (status, obj) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      res.end(JSON.stringify(obj));
    };

    // 1. Healthcheck
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
      return sendJson(200, {
        status: 'UP',
        service: 'odontocloud-muv-gateway',
        portPublic: 443,
        muvInternalUrl: 'https://127.0.0.1:9443 (Aislado)',
        supportedOperations: Object.keys(MUV_OPERATIONS),
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Solo método POST en endpoint oficial
    const isAllowedPath = req.url === '/api/v1/transmit-fev-rips' || req.url === '/api/v1/transmit';
    if (req.method !== 'POST' || !isAllowedPath) {
      return sendJson(405, { error: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' });
    }

    // 3. Autenticación JWT HMAC-SHA256 con anti-replay
    const authHeader = req.headers['authorization'];
    const authCheck = verifyMuvGatewayJwt(authHeader, sharedSecret);
    if (!authCheck.valid) {
      console.warn(`[MUV_GATEWAY] Acceso no autorizado: ${authCheck.error} - ${authCheck.message}`);
      return sendJson(401, {
        error: authCheck.error,
        message: authCheck.message,
      });
    }

    const { claims } = authCheck;

    // 4. Recepción y validación de tamaño de body
    let bodyBytes = 0;
    const chunks = [];

    req.on('data', chunk => {
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_BYTES) {
        req.destroy();
        return sendJson(413, { error: 'PAYLOAD_TOO_LARGE', message: 'Payload excede el límite de 15 MB.' });
      }
      chunks.push(chunk);
    });

    req.on('end', async () => {
      let body = null;
      try {
        const rawString = Buffer.concat(chunks).toString('utf8');
        body = JSON.parse(rawString);
      } catch (err) {
        return sendJson(400, { error: 'INVALID_JSON', message: 'Cuerpo de la solicitud no es JSON válido.' });
      }

      // Regla de seguridad estricta: NO permitir path, url o endpoint arbitrarios desde el cliente (evita SSRF)
      if (body?.path || body?.url || body?.endpoint) {
        return sendJson(400, {
          error: 'ARBITRARY_MUV_PATH_FORBIDDEN',
          message: 'No está permitido enviar rutas, paths o URLs arbitrarias hacia MUV. El gateway mapea exclusivamente operaciones fijas.',
        });
      }

      // Resolver operación normativa a partir de enum fijo
      const rawOperation = body?.operation || 'FEV_RIPS';
      const operation = String(rawOperation).toUpperCase();

      if (!MUV_ENDPOINT_MAPPING[operation]) {
        return sendJson(400, {
          error: 'INVALID_OPERATION',
          message: `Operación MUV no permitida: '${rawOperation}'. Operaciones válidas: ${Object.keys(MUV_OPERATIONS).join(', ')}.`,
        });
      }

      const muvPath = MUV_ENDPOINT_MAPPING[operation];
      const { identidad, password, rips, xmlFevFile } = body || {};

      // Validación de parámetros según operación
      let muvPayload = null;
      if (operation === MUV_OPERATIONS.NC_TOTAL) {
        if (!identidad || !password || !xmlFevFile) {
          return sendJson(400, {
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'Campos requeridos para NC_TOTAL: identidad, password, xmlFevFile.',
          });
        }
        // Para NC_TOTAL el cuerpo oficial exige rips = null
        muvPayload = { rips: null, xmlFevFile };
      } else if (operation === MUV_OPERATIONS.NC_PARTIAL) {
        if (!identidad || !password || !rips || !xmlFevFile) {
          return sendJson(400, {
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'Campos requeridos para NC_PARTIAL: identidad, password, rips, xmlFevFile.',
          });
        }
        muvPayload = { rips, xmlFevFile };
      } else {
        // FEV_RIPS
        if (!identidad || !password || !rips || !xmlFevFile) {
          return sendJson(400, {
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'Campos requeridos para FEV_RIPS: identidad, password, rips, xmlFevFile.',
          });
        }
        muvPayload = { rips, xmlFevFile };
      }

      // Variables temporales en RAM
      let ephemeralToken = null;

      try {
        // 5. Paso A: LoginSISPRO en MUV local
        const loginRes = await callInternalLoginSISPRO(identidad, password, muvBaseUrl);

        // Eliminación inmediata de la contraseña de memoria
        body.password = null;

        if (!loginRes.success || !loginRes.token) {
          return sendJson(401, {
            success: false,
            estado: 'REJECTED',
            error: 'SISPRO_AUTH_FAILED',
            message: 'Autenticación SISPRO rechazada por MUV.',
            errors: loginRes.errors || [],
          });
        }

        ephemeralToken = loginRes.token;

        // 6. Paso B: Ejecución del endpoint MUV mapeado por enum
        const cargaRes = await callInternalMuvEndpoint(ephemeralToken, muvPath, muvPayload, muvBaseUrl);

        // Destrucción inmediata del token de memoria
        ephemeralToken = null;

        // 7. Sanitización y normalización del contrato de respuesta MUV
        const resData = cargaRes.data || {};
        const isAccepted = Boolean(
          resData.cuv ||
          resData.resultado?.cuv ||
          resData.CUV ||
          (resData.resultState === 'Procesado' && !(resData.errors?.length || resData.errores?.length))
        );

        const cuvVal = resData.cuv || resData.resultado?.cuv || resData.CUV || null;
        const filingDateVal = resData.filingDate || resData.fechaRadicacion || resData.resultado?.fechaRadicacion || (isAccepted ? new Date().toISOString() : null);
        const errorsList = resData.errors || resData.errores || resData.resultado?.errors || resData.resultado?.errores || [];
        const warningsList = resData.warnings || resData.advertencias || resData.resultado?.warnings || resData.resultado?.advertencias || [];
        const processIdVal = resData.processId || resData.idProceso || resData.resultado?.idProceso || null;
        const invoiceNumVal = resData.invoiceNumber || resData.numFactura || resData.resultado?.numFactura || null;
        const resultStateVal = resData.resultState || resData.estado || (isAccepted ? 'Procesado' : 'Rechazado');

        const sanitized = {
          success: isAccepted,
          httpStatus: cargaRes.httpStatus,
          estado: isAccepted ? 'ACCEPTED' : 'REJECTED',
          resultState: resultStateVal,
          processId: processIdVal,
          invoiceNumber: invoiceNumVal,
          cuv: cuvVal,
          filingDate: filingDateVal,
          fechaRadicacion: filingDateVal,
          errores: Array.isArray(errorsList) ? errorsList : [errorsList].filter(Boolean),
          advertencias: Array.isArray(warningsList) ? warningsList : [warningsList].filter(Boolean),
          errors: Array.isArray(errorsList) ? errorsList : [errorsList].filter(Boolean),
          warnings: Array.isArray(warningsList) ? warningsList : [warningsList].filter(Boolean),
          operation,
          targetEndpoint: muvPath,
          requestId: authCheck.payload.requestId,
        };

        return sendJson(200, sanitized);

      } catch (err) {
        // En caso de fallo, asegurar que no queden referencias sensibles
        ephemeralToken = null;
        if (body) body.password = null;

        console.error(`[MUV_GATEWAY_ERROR] requestId=${authCheck.payload.requestId}: ${err.message}`);
        return sendJson(502, {
          success: false,
          estado: 'ERROR',
          error: 'MUV_COMMUNICATION_ERROR',
          message: err.message,
        });
      }
    });
  };
}

/**
 * Inicia servidor HTTP/HTTPS de Gateway para entorno de producción o pruebas.
 */
export function startMuvGateway(options = {}) {
  const handler = createMuvGatewayHandler(options);
  const server = http.createServer(handler);
  const port = options.port || process.env.MUV_GATEWAY_PORT || 443;

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}
