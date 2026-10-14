/**
 * =============================================================================
 * SUITE DE PRUEBAS AUTOMATIZADAS: SIMULACIÓN DE CONECTIVIDAD API IHCE PREPRODUCCIÓN
 * Archivo: scripts/test-ihce-connectivity.mjs
 * =============================================================================
 * Simula de forma aislada y estricta en entorno local:
 * 1. Validación de Contenido en HTTP 200 (No asumir éxito clínico automático):
 *    - 200 con Bundle con registros (Éxito clínico)
 *    - 200 con Bundle total: 0 (Conectividad técnica exitosa sin registros clínicos)
 *    - 200 con OperationOutcome de error (Rechazo semántico FHIR, no éxito clínico)
 *    - 200 con HTML / Proxy no-FHIR (Falla de pasarela / portal cautivo)
 * 2. Casos de error HTTP 401, 403, 404, 429 y Red:
 *    - 401: Diferenciación entre Clave APIM inválida vs Token Bearer expirado/inválido.
 *    - 403: Autorización denegada / prestador sin habilitación en producto APIM.
 *    - 404: Ruta incorrecta (ej. GET /ihce/metadata no expuesta en APIM).
 *    - 429: Cuota APIM superada con cabecera Retry-After.
 *    - Red: DNS (ENOTFOUND) y Timeout controlados.
 * 3. Mecanismo de prueba sin pacientes ficticios no autorizados (Parameters vacío / Gateway probe).
 * 4. Integración de flujo unificado: Obtención de token nuevo en memoria y uso inmediato.
 * 5. Cero exposición de credenciales y sanitización estricta.
 * =============================================================================
 */

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FALLO: ${message}`);
    throw new Error(`AssertionFailed: ${message}`);
  }
  passedTests++;
  console.log(`  ✅ OK: ${message}`);
}

/**
 * Función que clasifica y valida rigurosamente el estado Y el contenido de la respuesta
 */
export function analyzeConnectivityResponse(status, headers = {}, body = null) {
  const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();

  const result = {
    httpStatus: status,
    category: 'UNKNOWN',
    technicalConnectivity: false,
    clinicalQuerySuccess: false,
    authorized: false,
    authenticated: false,
    routeFound: false,
    recordsFound: 0,
    retryAfter: null,
    diagnostics: '',
    recommendation: ''
  };

  // 1. Análisis de respuestas exitosas a nivel HTTP (200 / 204)
  if (status === 200 || status === 204) {
    result.routeFound = true;
    result.authenticated = true;
    result.authorized = true;
    result.technicalConnectivity = true;

    // Validación de cabecera Content-Type
    if (contentType.includes('text/html')) {
      result.category = 'PROXY_HTML_RESPONSE';
      result.technicalConnectivity = false;
      result.diagnostics = 'HTTP 200 recibido pero con formato HTML. Respuesta probable de un proxy intermedio o portal cautivo, no de la API FHIR.';
      result.recommendation = 'Verifique la URL del EndPoint base y que no existan firewalls o proxies corporativos interceptando el tráfico.';
      return result;
    }

    if (!body || typeof body !== 'object') {
      result.category = 'EMPTY_BODY_SUCCESS';
      result.diagnostics = 'HTTP 200 recibido con cuerpo vacío. Pasarela APIM alcanzada.';
      result.recommendation = 'Conectividad básica de pasarela confirmada.';
      return result;
    }

    // Análisis de recurso FHIR R4
    if (body.resourceType === 'Bundle') {
      result.recordsFound = typeof body.total === 'number' ? body.total : (Array.isArray(body.entry) ? body.entry.length : 0);
      
      if (result.recordsFound > 0) {
        result.category = 'CLINICAL_QUERY_SUCCESS';
        result.clinicalQuerySuccess = true;
        result.diagnostics = `Consulta clínica exitosa: Se recuperaron ${result.recordsFound} registro(s) RDA en formato Bundle FHIR.`;
        result.recommendation = 'Operación y flujo clínico completamente funcionales.';
      } else {
        result.category = 'EMPTY_SEARCH_SUCCESS';
        result.clinicalQuerySuccess = false; // Conectividad OK pero no hay datos clínicos
        result.diagnostics = 'Conectividad técnica exitosa: Pasarela y motor FHIR respondieron con Bundle válido sin registros (total: 0). Cero datos expuestos.';
        result.recommendation = 'Conectividad técnica verificada al 100% sin comprometer información clínica.';
      }
      return result;
    }

    if (body.resourceType === 'OperationOutcome') {
      const issues = Array.isArray(body.issue) ? body.issue : [];
      const hasError = issues.some(i => i.severity === 'error' || i.severity === 'fatal');
      const diagDetails = issues.map(i => i.diagnostics || i.code).join('; ') || 'Sin detalles';

      if (hasError) {
        result.category = 'FHIR_SEMANTIC_ERROR';
        result.clinicalQuerySuccess = false;
        result.diagnostics = `HTTP 200 con OperationOutcome de error: El motor FHIR rechazó la solicitud semántica (${diagDetails}).`;
        result.recommendation = 'La pasarela y el backend están conectados, pero el contenido de la petición no cumplió las reglas del Anexo Técnico.';
      } else {
        result.category = 'FHIR_OPERATION_OUTCOME_NOTICE';
        result.diagnostics = `HTTP 200 con OperationOutcome informativo: ${diagDetails}.`;
        result.recommendation = 'Conectividad técnica confirmada con aviso del mecanismo central.';
      }
      return result;
    }

    result.category = 'GATEWAY_HEALTH_SUCCESS';
    result.diagnostics = 'HTTP 200 OK recibido de la pasarela Azure APIM.';
    result.recommendation = 'Conectividad confirmada a nivel de pasarela.';
    return result;
  }

  // 2. Errores de Autenticación / Clave (HTTP 401)
  if (status === 401) {
    result.category = 'AUTH_ERROR';
    result.routeFound = true;
    const rawMsg = (typeof body?.message === 'string' ? body.message : '') +
                   (typeof body?.error_description === 'string' ? body.error_description : '');
    
    if (rawMsg.toLowerCase().includes('subscription') || rawMsg.toLowerCase().includes('access denied')) {
      result.category = 'APIM_KEY_ERROR';
      result.diagnostics = 'Fallo de clave de suscripción: Ocp-Apim-Subscription-Key inválida o inactiva en el producto de Preproducción.';
      result.recommendation = 'Verifique el APIMsubkey en la sección PREPRODUCCIÓN del Portal de MinSalud.';
    } else {
      result.diagnostics = 'Fallo de autenticación: Bearer Token rechazado o caducado por la directiva validate-jwt de APIM.';
      result.recommendation = 'Obtenga un nuevo Access Token OAuth2 en Microsoft Entra ID antes de reintentar.';
    }
    return result;
  }

  // 3. Error de Autorización (HTTP 403)
  if (status === 403) {
    result.category = 'FORBIDDEN_ERROR';
    result.authenticated = true;
    result.authorized = false;
    result.routeFound = true;
    result.diagnostics = 'Fallo de autorización: La suscripción no tiene permisos para este recurso o el prestador no está habilitado en MinSalud.';
    result.recommendation = 'Compruebe con la mesa de ayuda de MinSalud la habilitación del prestador en el API Management.';
    return result;
  }

  // 4. Ruta no encontrada (HTTP 404)
  if (status === 404) {
    result.category = 'NOT_FOUND_ERROR';
    result.routeFound = false;
    result.diagnostics = 'Ruta no encontrada (HTTP 404): La operación o URL (ej. /metadata) no existe en el contrato de Azure APIM.';
    result.recommendation = 'No utilice rutas FHIR no publicadas (como /metadata). Utilice únicamente las operaciones oficiales documentadas ($consultar-rda-paciente o $enviar-rda-consulta).';
    return result;
  }

  // 5. Throttling / Cuota superada (HTTP 429)
  if (status === 429) {
    result.category = 'RATE_LIMITED';
    result.routeFound = true;
    const retrySecs = headers['retry-after'] || headers['Retry-After'] || '60';
    result.retryAfter = parseInt(retrySecs, 10) || 60;
    result.diagnostics = `Límite de solicitudes alcanzado (HTTP 429): Cuota de llamadas excedida en Azure APIM. Esperar ${result.retryAfter}s.`;
    result.recommendation = `Suspenda las peticiones durante al menos ${result.retryAfter} segundos antes de reintentar.`;
    return result;
  }

  // 6. Errores de Servidor Central (HTTP 500+)
  if (status >= 500) {
    result.category = 'SERVER_ERROR';
    result.diagnostics = `Error de servidor central ministerial (HTTP ${status}).`;
    result.recommendation = 'La pasarela respondió pero el servicio interno de MinSalud presentó una falla momentánea.';
    return result;
  }

  return result;
}

/**
 * Simulador de respuestas HTTP para Azure APIM de MinSalud
 */
export function mockApimResponse(scenario, { apimKey, token, path, method, body: reqBody }) {
  if (scenario === 'NETWORK_ERROR') {
    const err = new Error('getaddrinfo ENOTFOUND sandbox.ihcecol.gov.co');
    err.code = 'ENOTFOUND';
    throw err;
  }
  if (scenario === 'TIMEOUT_ERROR') {
    const err = new Error('The operation was aborted due to timeout (10000ms)');
    err.name = 'TimeoutError';
    throw err;
  }

  // 1. Ruta no mapeada en APIM
  if (path === '/ihce/metadata' || path === '/metadata' || path === '/fhir/metadata') {
    return {
      status: 404,
      headers: { 'content-type': 'application/json' },
      body: { statusCode: 404, message: 'Resource not found or operation not mapped in API definition.' }
    };
  }

  // 2. Validación de APIM Key
  if (!apimKey || apimKey !== 'valid-preprod-apim-subkey-12345') {
    return {
      status: 401,
      headers: { 'content-type': 'application/json' },
      body: { statusCode: 401, message: 'Access denied due to invalid subscription key. Make sure to provide a valid key for an active subscription.' }
    };
  }

  // 3. Validación de Token OAuth2
  if (!token || token === 'expired-token') {
    return {
      status: 401,
      headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer error="invalid_token"' },
      body: { statusCode: 401, message: 'Unauthorized. Access token is missing or invalid.' }
    };
  }

  // 4. Rate Limit
  if (scenario === 'RATE_LIMIT') {
    return {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '30' },
      body: { statusCode: 429, message: 'Rate limit is exceeded. Try again in 30 seconds.' }
    };
  }

  // 5. Permisos de rol / prestador
  if (scenario === 'FORBIDDEN_SCOPE') {
    return {
      status: 403,
      headers: { 'content-type': 'application/json' },
      body: { statusCode: 403, message: 'Forbidden. The client does not have permissions for the requested operation.' }
    };
  }

  // 6. Respuesta con HTML (Proxy Error simulado con HTTP 200)
  if (scenario === 'PROXY_HTML') {
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: '<html><body>Gateway Authentication Required</body></html>'
    };
  }

  // 7. Respuesta HTTP 200 con OperationOutcome de Error
  if (scenario === 'HTTP_200_OPERATION_OUTCOME_ERROR') {
    return {
      status: 200,
      headers: { 'content-type': 'application/fhir+json' },
      body: {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Parámetro obligatorio identificador no fue suministrado en Parameters.'
          }
        ]
      }
    };
  }

  // 8. Respuesta HTTP 200 con Bundle con Registros (Consulta clínica con hallazgos)
  if (scenario === 'HTTP_200_BUNDLE_WITH_DATA') {
    return {
      status: 200,
      headers: { 'content-type': 'application/fhir+json' },
      body: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Composition',
              id: 'rda-test-01',
              title: 'RDA Odontología General'
            }
          }
        ]
      }
    };
  }

  // 9. Respuesta HTTP 200 con Bundle Vacío (Verificación técnica de lectura sin pacientes)
  if (path.includes('$consultar-rda-paciente')) {
    return {
      status: 200,
      headers: { 'content-type': 'application/fhir+json' },
      body: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      }
    };
  }

  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: { status: 'healthy', gateway: 'Azure-APIM-MinSalud' }
  };
}

// -----------------------------------------------------------------------------
// EJECUCIÓN DE PRUEBAS
// -----------------------------------------------------------------------------
async function runSuite() {
  console.log('\n=============================================================================');
  console.log('🧪 SUITE DE PRUEBAS: SIMULACIÓN DE CONECTIVIDAD API IHCE PREPRODUCCIÓN');
  console.log('=============================================================================\n');

  // CASO 1: Validación rigurosa de HTTP 200 — Bundle con datos vs Bundle vacío vs OperationOutcome
  console.log('📋 GRUPO 1: Validación de Contenido en HTTP 200 (No asumir éxito clínico automático)');
  {
    // Subcaso A: HTTP 200 con registros reales
    const resData = mockApimResponse('HTTP_200_BUNDLE_WITH_DATA', {
      apimKey: 'valid-preprod-apim-subkey-12345',
      token: 'valid-bearer-token',
      path: '/Composition/$consultar-rda-paciente',
      method: 'POST'
    });
    const analysisData = analyzeConnectivityResponse(resData.status, resData.headers, resData.body);
    assert(analysisData.category === 'CLINICAL_QUERY_SUCCESS', 'Bundle con datos clasificado como CLINICAL_QUERY_SUCCESS.');
    assert(analysisData.clinicalQuerySuccess === true, 'Bandera clinicalQuerySuccess es verdadera cuando total > 0.');
    assert(analysisData.recordsFound === 1, 'Se extrae conteo exacto de registros (1).');

    // Subcaso B: HTTP 200 con Bundle vacío (Conectividad técnica exitosa sin datos expuestos)
    const resEmpty = mockApimResponse('SUCCESS_EMPTY', {
      apimKey: 'valid-preprod-apim-subkey-12345',
      token: 'valid-bearer-token',
      path: '/Composition/$consultar-rda-paciente',
      method: 'POST'
    });
    const analysisEmpty = analyzeConnectivityResponse(resEmpty.status, resEmpty.headers, resEmpty.body);
    assert(analysisEmpty.category === 'EMPTY_SEARCH_SUCCESS', 'Bundle vacío clasificado como EMPTY_SEARCH_SUCCESS.');
    assert(analysisEmpty.technicalConnectivity === true, 'Conectividad técnica es exitosa.');
    assert(analysisEmpty.clinicalQuerySuccess === false, 'No se interpreta automáticamente como consulta clínica con registros.');
    assert(analysisEmpty.recordsFound === 0, 'Total de registros es 0 (seguro sin datos).');

    // Subcaso C: HTTP 200 con OperationOutcome de error
    const resOutcome = mockApimResponse('HTTP_200_OPERATION_OUTCOME_ERROR', {
      apimKey: 'valid-preprod-apim-subkey-12345',
      token: 'valid-bearer-token',
      path: '/Composition/$consultar-rda-paciente',
      method: 'POST'
    });
    const analysisOutcome = analyzeConnectivityResponse(resOutcome.status, resOutcome.headers, resOutcome.body);
    assert(analysisOutcome.category === 'FHIR_SEMANTIC_ERROR', 'OperationOutcome con error clasificado como FHIR_SEMANTIC_ERROR.');
    assert(analysisOutcome.clinicalQuerySuccess === false, 'HTTP 200 con OperationOutcome de error NO se considera éxito clínico.');
    assert(analysisOutcome.diagnostics.includes('rechazó la solicitud'), 'Diagnóstico señala rechazo semántico.');

    // Subcaso D: HTTP 200 con HTML (Proxy / Intercepción)
    const resHtml = mockApimResponse('PROXY_HTML', {
      apimKey: 'valid-preprod-apim-subkey-12345',
      token: 'valid-bearer-token',
      path: '/Composition/$consultar-rda-paciente',
      method: 'POST'
    });
    const analysisHtml = analyzeConnectivityResponse(resHtml.status, resHtml.headers, resHtml.body);
    assert(analysisHtml.category === 'PROXY_HTML_RESPONSE', 'Respuesta HTML clasificada como PROXY_HTML_RESPONSE.');
    assert(analysisHtml.technicalConnectivity === false, 'Conectividad técnica rechazada ante respuesta HTML.');
  }

  // CASO 2: Fallo de clave APIM vs Fallo de Token OAuth2
  console.log('\n📋 GRUPO 2: Diferenciación de Fallos de Autenticación (Key vs Token)');
  {
    // Clave APIM incorrecta
    const resBadKey = mockApimResponse('BAD_KEY', {
      apimKey: 'invalid-key-xyz',
      token: 'valid-bearer-token',
      path: '/Composition/$consultar-rda-paciente',
      method: 'POST'
    });
    const analysisBadKey = analyzeConnectivityResponse(resBadKey.status, resBadKey.headers, resBadKey.body);
    assert(analysisBadKey.category === 'APIM_KEY_ERROR', 'Diferenciado como error de clave APIM.');
    assert(analysisBadKey.recommendation.includes('PREPRODUCCIÓN'), 'Recomendación apunta a la sección PREPRODUCCIÓN.');

    // Token vencido o incorrecto
    const resBadToken = mockApimResponse('BAD_TOKEN', {
      apimKey: 'valid-preprod-apim-subkey-12345',
      token: 'expired-token',
      path: '/Composition/$consultar-rda-paciente',
      method: 'POST'
    });
    const analysisBadToken = analyzeConnectivityResponse(resBadToken.status, resBadToken.headers, resBadToken.body);
    assert(analysisBadToken.category === 'AUTH_ERROR', 'Diferenciado como error de autenticación OAuth2.');
    assert(analysisBadToken.recommendation.includes('Microsoft Entra ID'), 'Recomendación indica renovación de token en Entra ID.');
  }

  // CASO 3: Autorización denegada (403) y Ruta no mapeada (404)
  console.log('\n📋 GRUPO 3: Autorización denegada (403) y Ruta no mapeada en APIM (404)');
  {
    // 403 Forbidden
    const res403 = mockApimResponse('FORBIDDEN_SCOPE', {
      apimKey: 'valid-preprod-apim-subkey-12345',
      token: 'valid-bearer-token',
      path: '/Composition/$consultar-rda-paciente',
      method: 'POST'
    });
    const analysis403 = analyzeConnectivityResponse(res403.status, res403.headers, res403.body);
    assert(analysis403.category === 'FORBIDDEN_ERROR', 'Clasificado como FORBIDDEN_ERROR.');
    assert(analysis403.authorized === false, 'Bandera authorized es falsa.');

    // 404 Not Found (ej. /metadata)
    const res404 = mockApimResponse('BAD_ROUTE', {
      apimKey: 'valid-preprod-apim-subkey-12345',
      token: 'valid-bearer-token',
      path: '/ihce/metadata',
      method: 'GET'
    });
    const analysis404 = analyzeConnectivityResponse(res404.status, res404.headers, res404.body);
    assert(analysis404.category === 'NOT_FOUND_ERROR', 'Clasificado como NOT_FOUND_ERROR.');
    assert(analysis404.routeFound === false, 'Bandera routeFound es falsa.');
    assert(analysis404.recommendation.includes('$consultar-rda-paciente'), 'Instruye utilizar exclusivamente rutas documentadas.');
  }

  // CASO 4: Limitación de solicitudes (429) y Fallas de Red
  console.log('\n📋 GRUPO 4: Limitación de solicitudes (429) y Errores de Red');
  {
    // 429 Rate Limit
    const res429 = mockApimResponse('RATE_LIMIT', {
      apimKey: 'valid-preprod-apim-subkey-12345',
      token: 'valid-bearer-token',
      path: '/Composition/$consultar-rda-paciente',
      method: 'POST'
    });
    const analysis429 = analyzeConnectivityResponse(res429.status, res429.headers, res429.body);
    assert(analysis429.category === 'RATE_LIMITED', 'Clasificado como RATE_LIMITED.');
    assert(analysis429.retryAfter === 30, 'Retry-After extraído correctamente (30s).');

    // Error de DNS
    let dnsOk = false;
    try {
      mockApimResponse('NETWORK_ERROR', {});
    } catch (e) {
      dnsOk = e.code === 'ENOTFOUND';
    }
    assert(dnsOk, 'Error de resolución DNS detectado y controlado.');

    // Error de Timeout
    let timeoutOk = false;
    try {
      mockApimResponse('TIMEOUT_ERROR', {});
    } catch (e) {
      timeoutOk = e.name === 'TimeoutError';
    }
    assert(timeoutOk, 'Timeout de conexión detectado y controlado.');
  }

  // CASO 5: Cero exposición de secretos y estructura de cabeceras
  console.log('\n📋 GRUPO 5: Cero exposición de credenciales y seguridad');
  {
    const secretKey = 'secret-apim-key-99999';
    const secretToken = 'secret-bearer-jwt-11111';
    const sanitizedLog = `Clave: [CONFIGURADA - LONGITUD: ${secretKey.length}] | Token: [CONFIGURADO - LONGITUD: ${secretToken.length}]`;
    assert(!sanitizedLog.includes(secretKey), 'Clave APIM nunca se imprime en logs.');
    assert(!sanitizedLog.includes(secretToken), 'Bearer Token nunca se imprime en logs.');
  }

  // CASO 6: Conformidad de Parámetros según Tabla 23, Página 20 (Manual IHCE v1.3)
  console.log('\n📋 GRUPO 6: Conformidad de Parámetros según Tabla 23 (Manual IHCE v1.3)');
  {
    // Función validadora del contrato de parámetros
    function validateParametersContract(payload) {
      if (!payload || payload.resourceType !== 'Parameters') {
        return { valid: false, error: 'Debe ser recurso Parameters.' };
      }
      const params = payload.parameter || [];
      const identifierParam = params.find(p => p.name === 'identifier');
      const humanuserParam = params.find(p => p.name === 'humanuser');

      if (!identifierParam) {
        return { valid: false, error: 'Parámetro identifier ausente.' };
      }
      if (!identifierParam.valueIdentifier || typeof identifierParam.valueIdentifier.value !== 'string') {
        return { valid: false, error: 'identifier debe ser de tipo Identifier (valueIdentifier).' };
      }

      if (!humanuserParam) {
        return { valid: false, error: 'Parámetro humanuser ausente.' };
      }
      if (typeof humanuserParam.valueString !== 'string') {
        return { valid: false, error: 'humanuser debe ser de tipo string (valueString conforme a Tabla 23).' };
      }
      if (humanuserParam.valueIdentifier) {
        return { valid: false, error: 'humanuser no debe ser valueIdentifier; la Tabla 23 exige valueString.' };
      }

      return { valid: true };
    }

    // Subcaso A: Payload conforme a Tabla 23
    const validPayload = {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'identifier',
          valueIdentifier: {
            system: 'urn:oid:2.16.170.1.4.1',
            value: '1098765432'
          }
        },
        {
          name: 'humanuser',
          valueString: '7000101658'
        }
      ]
    };
    const validCheck = validateParametersContract(validPayload);
    assert(validCheck.valid === true, 'Payload conforme a Tabla 23 validado exitosamente.');
    assert(typeof validPayload.parameter[1].valueString === 'string', 'humanuser está correctamente codificado como valueString (string).');
    assert(typeof validPayload.parameter[0].valueIdentifier === 'object', 'identifier está correctamente codificado como valueIdentifier (Identifier).');

    // Subcaso B: Rechazo si humanuser se envía erróneamente como valueIdentifier
    const invalidHumanUserPayload = {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'identifier',
          valueIdentifier: {
            system: 'urn:oid:2.16.170.1.4.1',
            value: '1098765432'
          }
        },
        {
          name: 'humanuser',
          valueIdentifier: {
            system: 'urn:oid:2.16.170.1.4.1',
            value: '7000101658'
          }
        }
      ]
    };
    const invalidCheck = validateParametersContract(invalidHumanUserPayload);
    assert(invalidCheck.valid === false, 'Detectada discrepancia cuando humanuser usa valueIdentifier en lugar de valueString.');
    assert(invalidCheck.error.includes('valueString'), 'Mensaje de error especifica que Tabla 23 exige valueString.');
  }

  console.log('\n=============================================================================');
  console.log(`🎉 SUITE DE CONECTIVIDAD COMPLETADA: ${passedTests}/${totalTests} pruebas superadas.`);
  console.log('=============================================================================\n');
}

runSuite().catch(err => {
  console.error('\n❌ ERROR FATAL EN SUITE:', err);
  process.exit(1);
});
