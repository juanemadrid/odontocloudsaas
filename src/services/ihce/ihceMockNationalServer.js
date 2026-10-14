/**
 * IHCE Mock National Server — Simulador Local de Alta Fidelidad
 * 
 * Simula el servidor de autorización Hércules y el mecanismo nacional
 * Vulcano FHIR R4 de Minsalud para pruebas locales controladas sin conexión externa.
 * Conforme con el Manual de Operaciones de Interoperabilidad IHCE v1.3.
 * 
 * Modos de simulación:
 * - 'SUCCESS_201' / 'SUCCESS_200': Bundle aceptado y radicado asignado.
 * - 'BAD_REQUEST_400': Error sintáctico en petición o headers.
 * - 'UNAUTHORIZED_401': Token inválido o expirado.
 * - 'FORBIDDEN_403': Prestador o Subscription Key no habilitado.
 * - 'CONFLICT_409': RDA ya registrado previamente para este encuentro.
 * - 'UNPROCESSABLE_422': Rechazo semántico / clínico (reglas de negocio de Minsalud).
 * - 'RATE_LIMITED_429': Límite de peticiones excedido con header Retry-After.
 * - 'SERVER_ERROR_500': Error no controlado del servidor central.
 * - 'SERVICE_UNAVAILABLE_503': Indisponibilidad temporal por mantenimiento.
 * - 'DYNAMIC': Evalúa las credenciales, headers de APIM y el contenido del Bundle.
 */

class IhceMockNationalServer {
  constructor(options = {}) {
    this.mode = options.mode || 'DYNAMIC';
    this.forcedCode = options.forcedCode || null;
    this.rateLimitCounter = 0;
    this.validClients = options.validClients || new Set([
      'cliente-apolo-id',
      'cliente-boreal-id',
      'test-valid-client'
    ]);
    this.registeredDocuments = new Map();
  }

  setMode(mode, forcedCode = null) {
    this.mode = mode;
    this.forcedCode = forcedCode;
  }

  /**
   * Consulta oficial de documento por clave de idempotencia o identificador
   */
  async queryByIdempotency(idempotencyKey) {
    if (this.registeredDocuments.has(idempotencyKey)) {
      const doc = this.registeredDocuments.get(idempotencyKey);
      return {
        available: true,
        found: true,
        confirmedUnregistered: false,
        radicado: doc.radicado,
        fhirId: doc.fhirId,
        timestamp: doc.timestamp
      };
    }
    return {
      available: true,
      found: false,
      confirmedUnregistered: true,
      radicado: null
    };
  }

  async queryDocumentByIdentifier(identifier) {
    return this.queryByIdempotency(identifier);
  }

  /**
   * Simula la autenticación en Hércules OAuth2
   */
  async authenticate({ clientId, clientSecret, repsCode }) {
    if (this.forcedCode === 401 || this.mode === 'UNAUTHORIZED_401') {
      return {
        success: false,
        statusCode: 401,
        error: 'invalid_client',
        error_description: 'Credenciales de prestador inválidas en Hércules.'
      };
    }

    if (this.forcedCode === 403 || this.mode === 'FORBIDDEN_403') {
      return {
        success: false,
        statusCode: 403,
        error: 'forbidden_reps',
        error_description: 'Código de habilitación REPS inactivo o no autorizado en el registro nacional.'
      };
    }

    if (this.forcedCode === 503 || this.mode === 'SERVICE_UNAVAILABLE_503') {
      return {
        success: false,
        statusCode: 503,
        error: 'service_unavailable',
        error_description: 'Servicio de autenticación Hércules en mantenimiento programado.'
      };
    }

    // Validación básica en modo DYNAMIC
    if (this.mode === 'DYNAMIC' && !this.validClients.has(clientId)) {
      return {
        success: false,
        statusCode: 401,
        error: 'invalid_client',
        error_description: `Client ID '${clientId}' no registrado en el directorio ministerial simulado.`
      };
    }

    return {
      success: true,
      statusCode: 200,
      access_token: `mock_jwt_token_${clientId}_${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'ihce:write ihce:read'
    };
  }

  /**
   * Simula el endpoint POST /Composition/$enviar-rda-consulta del mecanismo nacional
   */
  async submitBundle(bundle, headers = {}) {
    // 1. Simulación forzada por código
    if (this.forcedCode) {
      return this._handleForcedCode(this.forcedCode, headers);
    }

    // 2. Modos estáticos
    switch (this.mode) {
      case 'SUCCESS_200':
        return this._buildSuccess(bundle, headers, 200);
      case 'SUCCESS_201':
        return this._buildSuccess(bundle, headers, 201);
      case 'CONFLICT_409':
        // Simulación estándar MinSalud: OperationOutcome sin radicado oficial
        return {
          statusCode: 409,
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'conflict',
              diagnostics: 'RDA ya registrado previamente para este encuentro en MinSalud.'
            }]
          }
        };
      case 'CONFLICT_409_VERIFIED':
        return {
          statusCode: 409,
          headers: {
            'X-Radicado': 'RAD-EXISTENTE-MINSALUD-PREV'
          },
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'conflict',
              diagnostics: 'RDA ya registrado previamente para este encuentro en MinSalud.'
            }],
            radicado_oficial: 'RAD-EXISTENTE-MINSALUD-PREV',
            correspondencia_documento_verificada: true
          }
        };
      case 'BAD_REQUEST_400':
        return {
          statusCode: 400,
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'structure',
              diagnostics: 'El Bundle no cumple con la estructura requerida para Documento FHIR.'
            }]
          }
        };
      case 'UNAUTHORIZED_401':
        return {
          statusCode: 401,
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'login',
              diagnostics: 'Token de autorización ausente, inválido o expirado.'
            }]
          }
        };
      case 'FORBIDDEN_403':
        return {
          statusCode: 403,
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'forbidden',
              diagnostics: 'El prestador o Subscription Key no tiene permisos para radicar documentos en MinSalud.'
            }]
          }
        };
      case 'UNPROCESSABLE_422':
        return {
          statusCode: 422,
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'business-rule',
              diagnostics: 'Falla de validación semántica: El código CIE-10 reportado no coincide con el grupo de edad del paciente.'
            }]
          }
        };
      case 'RATE_LIMITED_429':
        return {
          statusCode: 429,
          headers: { 'Retry-After': '30' },
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'warning',
              code: 'throttled',
              diagnostics: 'Cuota de peticiones por minuto superada en Azure APIM. Espere 30 segundos.'
            }]
          }
        };
      case 'SERVER_ERROR_500':
        return {
          statusCode: 500,
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'fatal',
              code: 'exception',
              diagnostics: 'Error interno en la base de datos del repositorio nacional.'
            }]
          }
        };
      case 'SERVICE_UNAVAILABLE_503':
        return {
          statusCode: 503,
          headers: { 'Retry-After': '60' },
          body: {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'transient',
              code: 'timeout',
              diagnostics: 'El mecanismo nacional se encuentra en ventana de mantenimiento reglamentario.'
            }]
          }
        };
    }

    // 3. Modo DYNAMIC: Validación real de cabeceras y contenido del Bundle
    return this._evaluateDynamicSubmission(bundle, headers);
  }

  /**
   * Simula la consulta histórica de RDAs de un paciente
   */
  async consultarRdaPaciente(tipoDocumento, documento, headers = {}) {
    const auth = headers.Authorization || headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'login' }] }
      };
    }

    const apimKey = headers['Ocp-Apim-Subscription-Key'] || headers['ocp-apim-subscription-key'];
    if (!apimKey) {
      return {
        statusCode: 403,
        body: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Header Ocp-Apim-Subscription-Key requerido.' }] }
      };
    }

    return {
      success: true,
      statusCode: 200,
      bundle: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Composition',
              id: `rda-hist-${documento}`,
              status: 'final',
              title: 'Resumen Digital de Atención Odontológica Histórico',
              date: new Date().toISOString(),
              subject: { reference: `Patient/${documento}` }
            }
          }
        ]
      }
    };
  }

  _handleForcedCode(code, headers = {}) {
    if (code === 200) return this._buildSuccess({}, headers, 200);
    if (code === 201) return this._buildSuccess({}, headers, 201);
    if (code === 400) return { statusCode: 400, body: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid' }] } };
    if (code === 401) return { statusCode: 401, body: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'login' }] } };
    if (code === 403) return { statusCode: 403, body: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden' }] } };
    if (code === 409) return { statusCode: 409, body: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'conflict', diagnostics: 'Encounter duplicate' }] } };
    if (code === 422) return { statusCode: 422, body: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'processing' }] } };
    if (code === 429) return { statusCode: 429, headers: { 'Retry-After': '15' }, body: { resourceType: 'OperationOutcome', issue: [{ severity: 'transient', code: 'throttled' }] } };
    if (code === 500) return { statusCode: 500, body: { resourceType: 'OperationOutcome', issue: [{ severity: 'fatal', code: 'exception' }] } };
    if (code === 503) return { statusCode: 503, headers: { 'Retry-After': '45' }, body: { resourceType: 'OperationOutcome', issue: [{ severity: 'transient', code: 'timeout' }] } };
    return { statusCode: code, body: { resourceType: 'OperationOutcome', issue: [] } };
  }

  _buildSuccess(bundle, headers = {}, statusCode = 200) {
    const radicado = `RAD-IHCE-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const fhirId = `doc-rda-${Date.now()}`;
    const idKey = headers['X-Idempotency-Key'] || headers['x-idempotency-key'] || bundle?.id;
    if (idKey) {
      this.registeredDocuments.set(idKey, {
        radicado,
        fhirId,
        timestamp: new Date().toISOString(),
        bundle
      });
    }
    return {
      statusCode,
      headers: {
        Location: `https://vulcano.ihcecol.gov.co/fhir/r4/Composition/${fhirId}`,
        'X-Radicado': radicado
      },
      body: {
        resourceType: 'Bundle',
        id: fhirId,
        type: 'document-response',
        timestamp: new Date().toISOString(),
        radicado_oficial: radicado,
        status: 'ACEPTADO'
      }
    };
  }

  _evaluateDynamicSubmission(bundle, headers = {}) {
    // 1. Verificar token en Authorization header
    const auth = headers.Authorization || headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: {
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'login', diagnostics: 'Header Authorization Bearer ausente.' }]
        }
      };
    }

    // 2. Verificar cabecera Ocp-Apim-Subscription-Key (Requerida por MinSalud Azure APIM)
    const apimKey = headers['Ocp-Apim-Subscription-Key'] || headers['ocp-apim-subscription-key'];
    if (!apimKey) {
      return {
        statusCode: 403,
        body: {
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Header Ocp-Apim-Subscription-Key ausente o inválido para la pasarela ministerial.' }]
        }
      };
    }

    // 3. Verificar estructura mínima de Bundle FHIR R4
    if (!bundle || bundle.resourceType !== 'Bundle' || bundle.type !== 'document') {
      return {
        statusCode: 400,
        body: {
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'structure', diagnostics: 'El recurso debe ser un Bundle de tipo "document".' }]
        }
      };
    }

    if (!bundle.entry || bundle.entry.length === 0 || bundle.entry[0]?.resource?.resourceType !== 'Composition') {
      return {
        statusCode: 422,
        body: {
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'business-rule', diagnostics: 'La primera entrada del Bundle debe ser la Composition del RDA.' }]
        }
      };
    }

    // 4. Verificar duplicidad / idempotencia previa (Simulación HTTP 409 oficial MinSalud)
    const idKey = headers['X-Idempotency-Key'] || headers['x-idempotency-key'] || bundle?.id;
    if (idKey && this.registeredDocuments.has(idKey)) {
      const existing = this.registeredDocuments.get(idKey);
      return {
        statusCode: 409,
        headers: {
          'X-Radicado': existing.radicado
        },
        body: {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'conflict',
            diagnostics: 'El encuentro o RDA ya fue radicado previamente con esta clave de idempotencia.'
          }],
          radicado_oficial: existing.radicado,
          idempotency_key: idKey,
          correspondencia_documento_verificada: true
        }
      };
    }

    // Respuesta oficial exitosa: HTTP 200 OK según Manual de Operaciones v1.3
    return this._buildSuccess(bundle, headers, 200);
  }
}

export { IhceMockNationalServer };
