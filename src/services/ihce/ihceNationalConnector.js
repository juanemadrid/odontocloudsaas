/**
 * IHCE National Connector — Conector hacia el Mecanismo Nacional MinSalud
 * 
 * Implementa el protocolo oficial exacto conforme al:
 * "Manual de Operaciones de Interoperabilidad IHCE v1.3" (MinSalud Colombia)
 * 
 * Operación Principal: POST /Composition/$enviar-rda-consulta
 * Operación Consulta:  POST /Composition/$consultar-rda-paciente
 * 
 * Cabeceras Obligatorias:
 * - Content-Type: application/fhir+json
 * - Authorization: Bearer <access_token>
 * - Ocp-Apim-Subscription-Key: <azure_apim_key>
 * - User-Agent: OdontoCloud-IHCE-Connector/2.0
 * 
 * Respuestas Oficiales:
 * - 200 / 201: Éxito (RDA radicado)
 * - 400: Error de estructura / sintaxis FHIR
 * - 401: Token inválido o caducado (renovación transparente)
 * - 403: Subscription Key o Prestador no autorizado
 * - 409: Conflicto / RDA duplicado (Encounter ya reportado)
 * - 422: Rechazo semántico / clínico
 * - 429: Cuota APIM superada (Retry-After)
 * - 500 / 503: Falla de servicio central
 */

import { IhceAuthClient } from './ihceAuthClient.js';
import { IHCE_LIVE_ENABLED } from './ihceConstants.js';

class IhceNationalConnector {
  constructor(options = {}) {
    this.authClient = options.authClient || new IhceAuthClient({ mockServer: options.mockServer });
    this.mockServer = options.mockServer || null;
    this.apiEndpoint = options.apiEndpoint || 'https://vulcano.ihcecol.gov.co/fhir/r4';
  }

  /**
   * Envía un Bundle RDA oficial al mecanismo nacional mediante $enviar-rda-consulta
   * 
   * @param {Object} params
   * @param {Object} params.bundle - Bundle HL7 FHIR R4 (type: document)
   * @param {Object} params.credentials - { tenantId, clientId, clientSecret, repsCode, apimSubscriptionKey }
   * @param {string} params.idempotencyKey - Hash SHA-256 único de la transacción
   */
  async submitRdaBundle({ bundle, credentials, idempotencyKey }) {
    if (!IHCE_LIVE_ENABLED && !this.mockServer) {
      return {
        success: false,
        status: 'BLOQUEADO_SALVAGUARDA',
        httpStatus: 403,
        isTerminal: true,
        error: 'IHCE_LIVE_DISABLED: Todas las transmisiones externas hacia el Ministerio están estrictamente deshabilitadas.'
      };
    }

    if (!bundle || bundle.resourceType !== 'Bundle') {
      return {
        success: false,
        status: 'RECHAZADO',
        httpStatus: 400,
        isTerminal: true,
        error: 'BUNDLE_INVALID: El recurso suministrado no es un Bundle FHIR válido.'
      };
    }

    // 1. Obtener Token de Acceso en Hércules OAuth2
    let tokenResult;
    try {
      tokenResult = await this.authClient.getAccessToken(credentials);
    } catch (authErr) {
      const statusCode = authErr.statusCode || 500;
      const isTerminal = statusCode === 403;
      return {
        success: false,
        status: isTerminal ? 'ERROR_DEFINITIVO' : 'ERROR_REINTENTO',
        httpStatus: statusCode,
        isTerminal,
        error: `AUTH_FAILURE: ${authErr.message}`,
        retryAfterSeconds: statusCode === 429 ? 30 : 60
      };
    }

    // 2. Preparar Headers Normativos Oficiales (Manual v1.3)
    const apimKey = credentials.apimSubscriptionKey || credentials.subscriptionKey;
    const headers = {
      'Content-Type': 'application/fhir+json',
      Authorization: `Bearer ${tokenResult.accessToken}`,
      ...(apimKey ? { 'Ocp-Apim-Subscription-Key': apimKey } : {}),
      'X-Reps-Code': credentials.repsCode || '000000000000',
      'X-Idempotency-Key': idempotencyKey || bundle.id,
      'User-Agent': 'OdontoCloud-IHCE-Connector/2.0'
    };

    // 3. Ejecutar Petición (vía Simulador Mock o API Real con salvaguarda)
    const context = { bundle, idempotencyKey };
    if (!IHCE_LIVE_ENABLED) {
      if (this.mockServer) {
        return this._executeMockSubmission(bundle, headers, credentials, context);
      }
      return {
        success: false,
        status: 'BLOQUEADO_SALVAGUARDA',
        httpStatus: 403,
        isTerminal: true,
        error: 'IHCE_LIVE_DISABLED: Todas las transmisiones externas hacia el Ministerio están estrictamente deshabilitadas.'
      };
    }

    return this._executeRealSubmission(bundle, headers, credentials, context);
  }

  /**
   * Consulta formal de documento por identificador / idempotencia (Manual v1.3 / FHIR R4)
   * GET /Composition?identifier=<identificador>
   * Invocado por IhceReconciliationService para verificar recepción previa sin inventar endpoints.
   * 
   * @param {string} identifier - Identificador o clave de idempotencia del documento
   * @param {Object} credentials - Credenciales de la clínica prestadora
   */
  async queryDocumentByIdentifier(identifier, credentials) {
    if (!identifier) {
      throw new Error('IDENTIFIER_REQUIRED: Se requiere identificador para la consulta de documento.');
    }

    // Si la red en vivo está deshabilitada (salvaguarda de seguridad)
    if (!IHCE_LIVE_ENABLED) {
      if (this.mockServer && typeof this.mockServer.queryByIdempotency === 'function') {
        return this.mockServer.queryByIdempotency(identifier);
      }
      return {
        available: false,
        found: false,
        confirmedUnregistered: false,
        radicado: null,
        reason: 'IHCE_LIVE_DISABLED_AND_NO_MOCK_QUERY'
      };
    }

    // En red real, consultar mediante operación oficial de búsqueda FHIR R4:
    // GET /Composition?identifier=<identifier>
    let tokenResult;
    try {
      tokenResult = await this.authClient.getAccessToken(credentials);
    } catch (e) {
      return {
        available: false,
        found: false,
        confirmedUnregistered: false,
        error: `AUTH_FAILURE: ${e.message}`
      };
    }

    const apimKey = credentials?.apimSubscriptionKey || credentials?.subscriptionKey;
    const headers = {
      'Content-Type': 'application/fhir+json',
      Authorization: `Bearer ${tokenResult.accessToken}`,
      ...(apimKey ? { 'Ocp-Apim-Subscription-Key': apimKey } : {}),
      'X-Reps-Code': credentials?.repsCode || '000000000000',
      'User-Agent': 'OdontoCloud-IHCE-Connector/2.0'
    };

    try {
      const response = await fetch(`${this.apiEndpoint}/Composition?identifier=${encodeURIComponent(identifier)}`, {
        method: 'GET',
        headers
      });

      if (response.status === 404) {
        return {
          available: true,
          found: false,
          confirmedUnregistered: true,
          radicado: null
        };
      }

      if (!response.ok) {
        return {
          available: false,
          found: false,
          confirmedUnregistered: false,
          httpStatus: response.status,
          reason: `HTTP_ERROR_${response.status}`
        };
      }

      const bundle = await response.json();
      if (bundle?.resourceType === 'Bundle' && Array.isArray(bundle.entry) && bundle.entry.length > 0) {
        const comp = bundle.entry[0]?.resource;
        const radicado = comp?.identifier?.find(i => i.system?.includes('radicado') || i.value?.startsWith('RAD-'))?.value ||
                         comp?.id || null;

        if (radicado) {
          return {
            available: true,
            found: true,
            confirmedUnregistered: false,
            radicado,
            fhirId: comp?.id || null,
            timestamp: comp?.date || new Date().toISOString()
          };
        }
      }

      if (bundle?.resourceType === 'Bundle' && (bundle.total === 0 || !bundle.entry || bundle.entry.length === 0)) {
        return {
          available: true,
          found: false,
          confirmedUnregistered: true,
          radicado: null
        };
      }

      return {
        available: true,
        found: false,
        confirmedUnregistered: false,
        reason: 'INCONCLUSIVE_REGISTRY_RESPONSE'
      };
    } catch (netErr) {
      return {
        available: false,
        found: false,
        confirmedUnregistered: false,
        reason: `NETWORK_ERROR: ${netErr.message}`
      };
    }
  }

  /**
   * Consulta los RDAs de un paciente en la red nacional mediante $consultar-rda-paciente
   */
  async consultarRdaPaciente(tipoDocumento, documento, credentials) {
    let tokenResult;
    try {
      tokenResult = await this.authClient.getAccessToken(credentials);
    } catch (e) {
      return { success: false, rdas: [] };
    }

    const apimKey = credentials.apimSubscriptionKey || credentials.subscriptionKey;
    const headers = {
      'Content-Type': 'application/fhir+json',
      Authorization: `Bearer ${tokenResult.accessToken}`,
      ...(apimKey ? { 'Ocp-Apim-Subscription-Key': apimKey } : {})
    };

    if (!IHCE_LIVE_ENABLED) {
      if (this.mockServer?.consultarRdaPaciente) {
        return this.mockServer.consultarRdaPaciente(tipoDocumento, documento, headers);
      }
      return { 
        success: false, 
        status: 'BLOQUEADO_SALVAGUARDA',
        error: 'IHCE_LIVE_DISABLED: Consultas externas deshabilitadas por salvaguarda.' 
      };
    }

    try {
      const payload = {
        resourceType: 'Parameters',
        parameter: [
          {
            name: 'identificador',
            valueIdentifier: {
              system: 'urn:oid:2.16.170.1.4.1',
              value: documento
            }
          }
        ]
      };

      const response = await fetch(`${this.apiEndpoint}/Composition/$consultar-rda-paciente`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) return { success: false, rdas: [] };
      const data = await response.json();
      return { success: true, bundle: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async _executeMockSubmission(bundle, headers, credentials, context = {}) {
    if (!this.mockServer) {
      return {
        success: false,
        status: 'ERROR_REINTENTO',
        httpStatus: 503,
        isTerminal: false,
        error: 'MOCK_SERVER_UNAVAILABLE: Simulador local no inicializado y envíos reales deshabilitados.',
        retryAfterSeconds: 30
      };
    }

    try {
      const response = await this.mockServer.submitBundle(bundle, headers);
      return this._classifyResponse(response.statusCode, response.body, response.headers, credentials, context);
    } catch (err) {
      return {
        success: false,
        status: 'ERROR_REINTENTO',
        httpStatus: 500,
        isTerminal: false,
        error: `SIMULATION_FAULT: ${err.message}`,
        retryAfterSeconds: 30
      };
    }
  }

  async _executeRealSubmission(bundle, headers, credentials, context = {}) {
    try {
      // Endpoint oficial: POST /Composition/$enviar-rda-consulta
      const response = await fetch(`${this.apiEndpoint}/Composition/$enviar-rda-consulta`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bundle)
      });

      const responseBody = await response.json().catch(() => null);
      const responseHeaders = Object.fromEntries(response.headers.entries());

      if (response.status === 401) {
        this.authClient.invalidateToken(credentials.tenantId);
      }

      return this._classifyResponse(response.status, responseBody, responseHeaders, credentials, context);
    } catch (networkErr) {
      return {
        success: false,
        status: 'ERROR_REINTENTO',
        httpStatus: 503,
        isTerminal: false,
        error: `NETWORK_TIMEOUT: Fallo de transporte HTTP con MinSalud: ${networkErr.message}`,
        retryAfterSeconds: 60
      };
    }
  }

  _classifyResponse(statusCode, body, headers = {}, credentials, context = {}) {
    const retryAfter = parseInt(headers['Retry-After'] || headers['retry-after'] || '60', 10);

    // HTTP 200 OK o 201 CREATED: Radicación Exitosa en MinSalud
    if (statusCode === 200 || statusCode === 201) {
      const radicado = body?.radicado_oficial || 
                       headers['X-Radicado'] || 
                       headers['x-radicado'] || 
                       null;
      const fhirId = body?.id || null;

      if (!radicado) {
        // PROHIBIDO INVENTAR RADICADOS: Si MinSalud no retornó radicado oficial, queda pendiente de conciliación
        return {
          success: false,
          status: 'PENDIENTE_CONCILIACION',
          httpStatus: statusCode,
          isTerminal: false,
          radicado: null,
          error: 'NO_OFFICIAL_RADICADO: MinSalud no retornó radicado oficial en respuesta 200/201. Requiere conciliación.',
          detalle: body
        };
      }

      return {
        success: true,
        status: 'ACEPTADO',
        httpStatus: statusCode,
        isTerminal: true,
        radicado,
        responseFhirId: fhirId,
        detalle: body
      };
    }

    // HTTP 409 CONFLICT: RDA Duplicado en MinSalud (Manual v1.3)
    if (statusCode === 409) {
      const radicadoExistente = body?.radicado_oficial || 
                                headers['X-Radicado'] || 
                                headers['x-radicado'] || 
                                null;

      // REGLA CRÍTICA 9: NUNCA marcar HTTP 409 como ACEPTADO sin verificar la correspondencia del documento original.
      // Debe existir coincidencia probada con la clave de idempotencia del documento enviado o correspondencia explícita.
      const hasVerifiedCorrespondence = Boolean(
        radicadoExistente && (
          (context?.idempotencyKey && (
            body?.idempotency_key === context.idempotencyKey ||
            body?.identificador_coincidente === context.idempotencyKey ||
            body?.verified_original_identifier === context.idempotencyKey
          )) ||
          body?.correspondencia_documento_verificada === true
        )
      );

      if (hasVerifiedCorrespondence) {
        return {
          success: true,
          status: 'ACEPTADO',
          httpStatus: 409,
          isTerminal: true,
          radicado: radicadoExistente,
          responseFhirId: body?.id || 'duplicate-verified',
          nota: 'RDA_CONFIRMADO_PREVIO: Correspondencia con documento original verificada formalmente.',
          detalle: body
        };
      }

      // Si no viene probada la correspondencia del documento original, NO inventar radicado ni marcar ACEPTADO a ciegas.
      // Se retiene en PENDIENTE_CONCILIACION para verificación mediante queryDocumentByIdentifier.
      return {
        success: false,
        status: 'PENDIENTE_CONCILIACION',
        httpStatus: 409,
        isTerminal: false,
        radicado: null,
        error: 'CONFLICT_UNVERIFIED_CORRESPONDENCE: MinSalud reportó conflicto (HTTP 409) sin correspondencia probada del documento original. Retenido en PENDIENTE_CONCILIACION.',
        detalle: body
      };
    }

    // HTTP 400: Error Sintáctico
    if (statusCode === 400) {
      return {
        success: false,
        status: 'RECHAZADO',
        httpStatus: 400,
        isTerminal: true,
        error: this._extractDiagnostics(body) || 'Estructura sintáctica del Bundle rechazada por MinSalud.',
        detalle: body
      };
    }

    // HTTP 401: Token expirado o revocado
    if (statusCode === 401) {
      this.authClient.invalidateToken(credentials.tenantId);
      return {
        success: false,
        status: 'ERROR_REINTENTO',
        httpStatus: 401,
        isTerminal: false,
        error: 'Sesión o token caducado en Hércules. Renovando credenciales.',
        retryAfterSeconds: 5,
        detalle: body
      };
    }

    // HTTP 403: No Autorizado (Subscription Key inválida o prestador inactivo en REPS)
    if (statusCode === 403) {
      return {
        success: false,
        status: 'ERROR_DEFINITIVO',
        httpStatus: 403,
        isTerminal: true,
        error: this._extractDiagnostics(body) || 'Prestador no habilitado o Subscription Key APIM no autorizada.',
        detalle: body
      };
    }

    // HTTP 422: Validación Semántica / Regla Clínica de MinSalud
    if (statusCode === 422) {
      return {
        success: false,
        status: 'RECHAZADO',
        httpStatus: 422,
        isTerminal: true,
        error: this._extractDiagnostics(body) || 'Rechazo por regla semántica/clínica de MinSalud.',
        detalle: body
      };
    }

    // HTTP 429: Rate Limit en Azure APIM
    if (statusCode === 429) {
      return {
        success: false,
        status: 'ERROR_REINTENTO',
        httpStatus: 429,
        isTerminal: false,
        error: 'Cuota de peticiones superada en Azure APIM. Esperando ventana.',
        retryAfterSeconds: retryAfter > 0 ? retryAfter : 30,
        detalle: body
      };
    }

    // HTTP 500 / 503 / Errores de Transporte
    return {
      success: false,
      status: 'ERROR_REINTENTO',
      httpStatus: statusCode || 500,
      isTerminal: false,
      error: this._extractDiagnostics(body) || `Indisponibilidad del servicio central (HTTP ${statusCode}).`,
      retryAfterSeconds: retryAfter > 0 ? retryAfter : 60,
      detalle: body
    };
  }

  _extractDiagnostics(body) {
    if (!body) return null;
    if (body.resourceType === 'OperationOutcome' && Array.isArray(body.issue) && body.issue.length > 0) {
      return body.issue.map(i => i.diagnostics || i.code).filter(Boolean).join(' | ');
    }
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
    return null;
  }
}

export { IhceNationalConnector, IHCE_LIVE_ENABLED };
