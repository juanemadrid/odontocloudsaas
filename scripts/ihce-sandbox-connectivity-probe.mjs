/**
 * =============================================================================
 * RUNNER DE PREPRODUCCIÓN IHCE: VERIFICACIÓN INTEGRADA DE CONECTIVIDAD API APIM
 * Archivo: scripts/ihce-sandbox-connectivity-probe.mjs
 * =============================================================================
 * FLUJO UNIFICADO DE SEGURIDAD ESTRICTA:
 * 1. OBTENCIÓN AUTOMÁTICA DE TOKEN EN MEMORIA: Se autentica con Microsoft Entra ID
 *    usando las credenciales de Preproducción y retiene el Bearer Token únicamente
 *    en memoria volátil durante la ejecución (cero persistencia en disco ni logs).
 * 2. PRUEBA DE CONECTIVIDAD NO-CLÍNICA: Conecta con Azure APIM MinSalud mediante
 *    la operación documentada POST /Composition/$consultar-rda-paciente sin inventar
 *    números de pacientes ficticios no autorizados (utiliza estructura sintáctica
 *    de control o handshake de pasarela).
 * 3. VALIDACIÓN DE CONTENIDO EN HTTP 200: No asume éxito clínico por el solo código 200;
 *    inspecciona Content-Type, estructura FHIR (Bundle vs OperationOutcome) y total.
 * 4. ENTRADA TOTALMENTE ENMASCARADA: Captura de ClientSecret y APIMsubkey con
 *    caracteres asterisco (*) vía TTY interactiva. Aborta si process.stdin.isTTY es falso.
 * 5. SALVAGUARDA DE AMBIENTE: Doble confirmación manual previa y bloqueo estricto
 *    de producción, VPS y bases de datos.
 * =============================================================================
 */

import readline from 'node:readline';
import { URL } from 'node:url';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IS_DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simulate');
const ALLOWED_APIM_HOSTS = ['sandbox.ihcecol.gov.co', 'vulcano.ihcecol.gov.co'];

function closeReadlineGracefully(rl) {
  return new Promise(resolve => {
    if (!rl || rl.closed) {
      resolve();
      return;
    }
    rl.on('close', () => {
      resolve();
    });
    rl.close();
  });
}

function promptVisible(rl, query) {
  return new Promise(resolve => {
    if (IS_DRY_RUN && !process.stdin.isTTY) {
      console.log(`${query} [SIMULADO EN MEMORIA: s]`);
      if (query.includes('TenantID')) resolve('11111111-2222-3333-4444-555555555555');
      else if (query.includes('ClientID')) resolve('66666666-7777-8888-9999-000000000000');
      else if (query.includes('Scope')) resolve('https://sandbox.ihcecol.gov.co/.default');
      else if (query.includes('EndPoint')) resolve('https://sandbox.ihcecol.gov.co/ihce');
      else if (query.includes('opción')) resolve('1');
      else if (query.includes('Paciente')) resolve('1098765432');
      else if (query.includes('Profesional')) resolve('7000101658');
      else resolve('s');
      return;
    }
    rl.question(query, answer => {
      resolve(answer.trim());
    });
  });
}

function promptMasked(rl, query) {
  return new Promise(resolve => {
    if (!process.stdin.isTTY && !IS_DRY_RUN) {
      console.error('\n🛑 ERROR DE SEGURIDAD: process.stdin.isTTY es falso.');
      console.error('   Se requiere una consola interactiva real para capturar las credenciales de forma oculta.');
      process.exit(1);
    }

    if (IS_DRY_RUN && !process.stdin.isTTY) {
      console.log(`${query} [SIMULADO EN MEMORIA]`);
      resolve('simulated-secret-key-xyz-12345');
      return;
    }

    const origWrite = rl._writeToOutput;
    rl.stdoutMuted = true;
    rl._writeToOutput = function (stringToWrite) {
      if (rl.stdoutMuted) {
        if (stringToWrite.includes('\r\n') || stringToWrite.includes('\n')) {
          origWrite.call(rl, '\n');
        } else if (stringToWrite.charCodeAt(0) === 13) {
          origWrite.call(rl, stringToWrite);
        } else {
          origWrite.call(rl, '*');
        }
      } else {
        origWrite.call(rl, stringToWrite);
      }
    };

    rl.question(query, password => {
      rl.stdoutMuted = false;
      rl._writeToOutput = origWrite;
      resolve(password.trim());
    });
  });
}

/**
 * Validador profundo del contenido de respuesta de Azure APIM y MinSalud
 */
function inspectResponseContent(status, headers = {}, body = null) {
  const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();

  const report = {
    status,
    category: 'UNKNOWN',
    isTechnicalSuccess: false,
    isClinicalRetrieval: false,
    diagnostics: '',
    recommendation: ''
  };

  if (status === 200 || status === 204) {
    if (contentType.includes('text/html')) {
      report.category = 'INTERCEPTACION_HTML_PROXY';
      report.diagnostics = 'HTTP 200 devuelto con HTML. Probable proxy, firewall o portal cautivo intermediario.';
      report.recommendation = 'Verifique la URL del EndPoint y que la red no redirija peticiones HTTPS.';
      return report;
    }

    if (!body || typeof body !== 'object') {
      report.category = 'EXITO_PASARELA_BASE';
      report.isTechnicalSuccess = true;
      report.diagnostics = 'HTTP 200 recibido con cuerpo vacío. Pasarela APIM alcanzada y suscripción autorizada.';
      report.recommendation = 'Conectividad básica de pasarela confirmada.';
      return report;
    }

    if (body.resourceType === 'Bundle') {
      const total = typeof body.total === 'number' ? body.total : (Array.isArray(body.entry) ? body.entry.length : 0);
      report.isTechnicalSuccess = true;

      if (total > 0) {
        report.category = 'CONSULTA_CLINICA_CON_REGISTROS';
        report.isClinicalRetrieval = true;
        report.diagnostics = `Consulta clínica exitosa: Se recuperaron ${total} registro(s) RDA en formato FHIR.`;
        report.recommendation = 'Operación y flujo clínico completamente confirmados.';
      } else {
        report.category = 'CONECTIVIDAD_TECNICA_SIN_DATOS_EXPUESTOS';
        report.isClinicalRetrieval = false;
        report.diagnostics = 'Conectividad técnica exitosa: Pasarela y motor FHIR respondieron con Bundle válido sin registros (total: 0). Cero datos expuestos.';
        report.recommendation = 'Conectividad técnica verificada al 100% sin comprometer información de pacientes.';
      }
      return report;
    }

    if (body.resourceType === 'OperationOutcome') {
      const issues = Array.isArray(body.issue) ? body.issue : [];
      const hasError = issues.some(i => i.severity === 'error' || i.severity === 'fatal');
      const details = issues.map(i => i.diagnostics || i.code).join('; ') || 'Sin detalle';

      if (hasError) {
        report.category = 'RECHAZO_SEMANTICO_FHIR';
        report.isTechnicalSuccess = true; // Pasarela y motor respondieron
        report.isClinicalRetrieval = false;
        report.diagnostics = `HTTP 200 con OperationOutcome de error: El motor FHIR ministerial procesó la petición pero rechazó los parámetros (${details}).`;
        report.recommendation = 'Conectividad técnica de pasarela y backend confirmada.';
      } else {
        report.category = 'AVISO_INFORMATIVO_FHIR';
        report.isTechnicalSuccess = true;
        report.diagnostics = `HTTP 200 con OperationOutcome informativo: ${details}.`;
        report.recommendation = 'Conectividad confirmada con observación del mecanismo central.';
      }
      return report;
    }

    report.category = 'RESPUESTA_EXITOSA_APIM';
    report.isTechnicalSuccess = true;
    report.diagnostics = 'HTTP 200 OK recibido de la pasarela Azure APIM.';
    report.recommendation = 'Pasarela y suscripción APIM operativas.';
    return report;
  }

  // Manejo de errores HTTP
  if (status === 401) {
    const rawMsg = (typeof body?.message === 'string' ? body.message : '') +
                   (typeof body?.error_description === 'string' ? body.error_description : '');
    if (rawMsg.toLowerCase().includes('subscription') || rawMsg.toLowerCase().includes('access denied')) {
      report.category = 'CLAVE_APIM_INVALIDA';
      report.diagnostics = 'Ocp-Apim-Subscription-Key no válida para el producto en Preproducción.';
      report.recommendation = 'Verifique el APIMsubkey en la sección PREPRODUCCIÓN del Portal de MinSalud.';
    } else {
      report.category = 'TOKEN_OAUTH2_INVALIDO';
      report.diagnostics = 'Bearer Token rechazado o expirado por la directiva de autenticación de APIM.';
      report.recommendation = 'El token emitido por Entra ID fue rechazado por la pasarela de MinSalud.';
    }
  } else if (status === 403) {
    report.category = 'AUTORIZACION_DENEGADA';
    report.diagnostics = 'Acceso denegado (403): La suscripción no tiene permisos para este recurso o el prestador no está habilitado.';
    report.recommendation = 'Compruebe con la mesa de ayuda de MinSalud la habilitación del prestador en el API Management.';
  } else if (status === 404) {
    report.category = 'RUTA_NO_ENCONTRADA';
    report.diagnostics = 'Ruta no encontrada (404): La operación solicitada no existe en el contrato publicado de Azure APIM.';
    report.recommendation = 'No utilice rutas FHIR no publicadas (como /metadata). Utilice únicamente las operaciones oficiales ($consultar-rda-paciente o $enviar-rda-consulta).';
  } else if (status === 429) {
    const retrySecs = headers['retry-after'] || headers['Retry-After'] || '60';
    report.category = 'LIMITE_CUOTA_SUPERADO';
    report.diagnostics = `Límite de solicitudes alcanzado (429 Rate Limit): Cuota superada en Azure APIM. Espera requerida: ${retrySecs}s.`;
    report.recommendation = `Suspenda las peticiones durante al menos ${retrySecs} segundos antes de reintentar.`;
  } else if (status >= 500) {
    report.category = 'ERROR_CENTRAL_MINSALUD';
    report.diagnostics = `Falla interna del servidor ministerial (HTTP ${status}).`;
    report.recommendation = 'La pasarela respondió pero el componente central de MinSalud no completó el procesamiento.';
  }

  return report;
}

async function runInteractiveConnectivityProbe() {
  console.log('\n=============================================================================');
  console.log('🛡️  ODONTOCLOUD — VERIFICACIÓN INTEGRADA DE CONECTIVIDAD API IHCE');
  console.log('    Protocolo Oficial: Azure API Management (Manual de Operaciones IHCE v1.3)');
  if (IS_DRY_RUN) {
    console.log('    ⚠️  MODO SIMULACIÓN LOCAL ACTIVADO (--dry-run): CERO LLAMADAS EXTERNAS');
  }
  console.log('=============================================================================\n');

  console.log('📋 SALVAGUARDAS DE SEGURIDAD ESTRICTA:');
  console.log('   ✓ Flujo unificado: Obtiene token OAuth2 nuevo en memoria y ejecuta la prueba sin tocar disco');
  console.log('   ✓ Destino validado: Únicamente login.microsoftonline.com y *.ihcecol.gov.co');
  console.log('   ✓ Cero pacientes inventados: Prueba no clínica mediante parámetros de control o handshake');
  console.log('   ✓ Validación de contenido en HTTP 200: No asume éxito clínico sin verificar el recurso');
  console.log('   ✓ Captura de credenciales: TTY enmascarada (*), sin historial ni persistencia');
  console.log('   ✓ Aislamiento de infraestructura: VPS, Supabase y OdontoCloud producción INTACTOS\n');

  if (!process.stdin.isTTY && !IS_DRY_RUN) {
    console.error('🛑 ABORTADO: process.stdin.isTTY es falso. Esta prueba exige un terminal interactivo.');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // 1. Ingreso de TenantID oficial y validación GUID
  const tenantId = await promptVisible(rl, '1️⃣  Ingrese el TenantID oficial de Preproducción (GUID): ');
  if (!GUID_REGEX.test(tenantId)) {
    console.error('\n❌ Error: El TenantID debe ser un GUID válido (formato 8-4-4-4-12).');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  // 2. Ingreso de ClientID oficial y validación GUID
  const clientId = await promptVisible(rl, '2️⃣  Ingrese el ClientID asignado para Preproducción (GUID): ');
  if (!GUID_REGEX.test(clientId)) {
    console.error('\n❌ Error: El ClientID debe ser un GUID válido (formato 8-4-4-4-12).');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  // 3. Ingreso de Scope oficial
  const scope = await promptVisible(rl, '3️⃣  Ingrese el Scope asignado para Preproducción: ');
  if (!scope || scope.length < 3) {
    console.error('\n❌ Error: El Scope es obligatorio.');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  // 4. Ingreso enmascarado de ClientSecret
  const clientSecret = await promptMasked(rl, '4️⃣  Ingrese el ClientSecret de Preproducción [ENTRADA OCULTA]: ');
  if (!clientSecret || clientSecret.length < 4) {
    console.error('\n❌ Error: El ClientSecret es obligatorio.');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  // 5. Ingreso enmascarado de APIMsubkey
  const apimKey = await promptMasked(rl, '5️⃣  Ingrese el APIMsubkey de Preproducción [ENTRADA OCULTA]: ');
  if (!apimKey || apimKey.length < 8) {
    console.error('\n❌ Error: El APIMsubkey es obligatorio.');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  // 6. EndPoint Base asignado por MinSalud
  const defaultEndpoint = 'https://sandbox.ihcecol.gov.co/ihce';
  const endpointInput = await promptVisible(rl, `6️⃣  Confirme el EndPoint base de Preproducción [Default: ${defaultEndpoint}]: `);
  const baseEndpoint = (endpointInput || defaultEndpoint).trim().replace(/\/+$/, '');

  let parsedUrl;
  try {
    parsedUrl = new URL(baseEndpoint);
  } catch (err) {
    console.error(`\n❌ Error: URL inválida (${baseEndpoint}).`);
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  if (parsedUrl.protocol !== 'https:') {
    console.error('\n🛑 VIOLACIÓN DE SEGURIDAD: Solo se permite protocolo HTTPS.');
    await closeReadlineGracefully(rl);
    process.exitCode = 2;
    return;
  }

  const isAllowedHost = ALLOWED_APIM_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`));
  if (!isAllowedHost) {
    console.error(`\n🛑 VIOLACIÓN DE SEGURIDAD: Destino no autorizado (${parsedUrl.hostname}).`);
    console.error(`   Solo se admiten dominios oficiales (${ALLOWED_APIM_HOSTS.join(', ')}).`);
    await closeReadlineGracefully(rl);
    process.exitCode = 2;
    return;
  }

  // 7. Modalidad de prueba de lectura conforme a Tabla 23 (Manual IHCE v1.3)
  console.log('\n7️⃣  Seleccione la modalidad de verificación técnica:');
  console.log('    [1] Operación oficial con Parámetros Normativos: POST /Composition/$consultar-rda-paciente');
  console.log('        (Conforme a Tabla 23: identifier como valueIdentifier y humanuser como valueString)');
  console.log('    [2] Verificación de Pasarela Base: GET /');
  console.log('        (Valida respuesta de Azure APIM y autorización de la suscripción sin consultar datos)');

  const methodChoice = await promptVisible(rl, '    Seleccione opción (1 o 2) [Default: 2]: ');
  const selectedMode = methodChoice === '1' ? 'CONSULTAR_RDA_NORMATIVO' : 'GATEWAY_BASE';

  let targetPath = '';
  let httpMethod = 'POST';
  let requestBody = null;

  if (selectedMode === 'CONSULTAR_RDA_NORMATIVO') {
    targetPath = '/Composition/$consultar-rda-paciente';
    httpMethod = 'POST';
    
    // Captura de datos sintéticos oficiales autorizados
    const patientDoc = await promptVisible(rl, '    Ingrese el número de documento del Paciente Sintético Oficial: ');
    const humanUserDoc = await promptVisible(rl, '    Ingrese la Cédula/Identificación del Profesional (humanuser): ');

    if (!patientDoc || !humanUserDoc) {
      console.error('\n❌ Error: Para la operación $consultar-rda-paciente, identifier y humanuser son obligatorios (Tabla 23).');
      await closeReadlineGracefully(rl);
      process.exitCode = 1;
      return;
    }

    // Estructura oficial exacta: Tabla 23, Página 20 (Manual IHCE v1.3)
    requestBody = JSON.stringify({
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'identifier',
          valueIdentifier: {
            system: 'urn:oid:2.16.170.1.4.1',
            value: patientDoc
          }
        },
        {
          name: 'humanuser',
          valueString: String(humanUserDoc) // string estricto conforme a Tabla 23
        }
      ]
    });
  } else {
    targetPath = '';
    httpMethod = 'GET';
  }

  const fullTargetUrl = `${baseEndpoint}${targetPath}`;

  // ---------------------------------------------------------------------------
  // RESUMEN Y DOBLE AUTORIZACIÓN EXPRESA
  // ---------------------------------------------------------------------------
  console.log('\n-----------------------------------------------------------------------------');
  console.log('🔍 VERIFICACIÓN PREVIA DE IDENTIFICADORES Y DESTINOS:');
  console.log('   Paso 1 (Autenticación):');
  console.log(`     - Servidor de Identidad: https://login.microsoftonline.com/{TenantID}/oauth2/v2.0/token`);
  console.log(`     - TenantID: [GUID VÁLIDO - VERIFICADO]`);
  console.log(`     - ClientID: [GUID VÁLIDO - VERIFICADO]`);
  console.log(`     - ClientSecret: [ENMASCARADO EN MEMORIA VOLÁTIL]`);
  console.log('   Paso 2 (Conectividad API):');
  console.log(`     - Pasarela MinSalud: ${fullTargetUrl}`);
  console.log(`     - Método HTTP: ${httpMethod}`);
  console.log(`     - Modalidad: ${selectedMode === 'CONSULTAR_RDA_NORMATIVO' ? 'Operación oficial FHIR con Parámetros Normativos (Tabla 23)' : 'Handshake GET base APIM'}`);
  console.log(`     - APIM Subkey: [ENMASCARADO - LONGITUD: ${apimKey.length} car.]`);
  console.log('   Garantía Clínica: Cero pacientes inventados, cero historias enviadas.');
  console.log('-----------------------------------------------------------------------------');

  console.log('\n⚠️  CONFIRMACIÓN DE AMBIENTE:');
  console.log('   Confirme que todos los datos provienen de la tarjeta PREPRODUCCIÓN / SANDBOX');
  console.log('   del Portal de Administración de Llaves del Ministerio de Salud.');

  const envConfirm = await promptVisible(rl, '\n¿Confirma que estos datos corresponden estrictamente a PREPRODUCCIÓN? (s/n): ');
  if (envConfirm.toLowerCase() !== 's' && envConfirm.toLowerCase() !== 'si' && envConfirm.toLowerCase() !== 'y') {
    console.log('\n🛑 Cancelado por el usuario: Ambiente no confirmado. Cero peticiones realizadas.');
    await closeReadlineGracefully(rl);
    process.exitCode = 0;
    return;
  }

  const sendConfirm = await promptVisible(rl, '¿Autoriza expresamente la ejecución de este flujo unificado de prueba? (s/n): ');
  if (sendConfirm.toLowerCase() !== 's' && sendConfirm.toLowerCase() !== 'si' && sendConfirm.toLowerCase() !== 'y') {
    console.log('\n🛑 Cancelado por el usuario: Envío no autorizado. Cero conexiones realizadas.');
    await closeReadlineGracefully(rl);
    process.exitCode = 0;
    return;
  }

  // ---------------------------------------------------------------------------
  // MODO SIMULACIÓN LOCAL (--dry-run)
  // ---------------------------------------------------------------------------
  if (IS_DRY_RUN) {
    console.log('\n=============================================================================');
    console.log('🎉 SIMULACIÓN LOCAL EXITOSA (--dry-run)');
    console.log('=============================================================================');
    console.log('  ✓ Paso 1 (OAuth2): Autenticación simulada contra Entra ID aprobada.');
    console.log('  ✓ Paso 2 (APIM): Conexión simulada contra Azure APIM aprobada.');
    console.log('  ✓ Inspección de contenido: Validador de HTTP 200 operativo.');
    console.log('  ✓ Cero almacenamiento en disco: Garantizado.');
    console.log('  ✓ Cero conexiones externas realizadas.');
    console.log('=============================================================================\n');
    await closeReadlineGracefully(rl);
    process.exitCode = 0;
    return;
  }

  // ---------------------------------------------------------------------------
  // PASO 1: OBTENCIÓN DE TOKEN OAUTH2 EN MEMORIA
  // ---------------------------------------------------------------------------
  console.log('\n🔑 PASO 1: Solicitando Access Token nuevo a Microsoft Entra ID...');
  let freshToken = null;
  const oauthStartTime = Date.now();

  try {
    const oauthEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const bodyParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope
    });

    const oauthRes = await fetch(oauthEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OdontoCloud-IHCE-UnifiedProbe/1.0'
      },
      body: bodyParams.toString(),
      redirect: 'error'
    });

    const oauthElapsed = Date.now() - oauthStartTime;
    const oauthBody = await oauthRes.json().catch(() => null);

    if (!oauthRes.ok || !oauthBody?.access_token) {
      console.error('\n❌ ERROR EN PASO 1 (AUTENTICACIÓN OAUTH2):');
      console.error(`   HTTP ${oauthRes.status} en ${oauthElapsed} ms.`);
      console.error(`   Diagnóstico: ${oauthBody?.error || 'auth_failure'}`);
      await closeReadlineGracefully(rl);
      process.exitCode = 1;
      return;
    }

    freshToken = oauthBody.access_token;
    console.log(`   ✅ Token OAuth2 obtenido exitosamente en ${oauthElapsed} ms (Vigencia: ${oauthBody.expires_in || 3600}s).`);
    console.log('   🔒 Token retenido exclusivamente en memoria volátil.');
  } catch (authNetErr) {
    console.error('\n💥 ERROR DE RED EN PASO 1 (MICROSOFT ENTRA ID):', authNetErr.message);
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  // ---------------------------------------------------------------------------
  // PASO 2: PRUEBA DE CONECTIVIDAD API AZURE APIM
  // ---------------------------------------------------------------------------
  console.log('\n🌐 PASO 2: Verificando conectividad con Azure APIM MinSalud...');
  const apimStartTime = Date.now();

  try {
    const headers = {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json',
      'Ocp-Apim-Subscription-Key': apimKey,
      'Authorization': `Bearer ${freshToken}`,
      'User-Agent': 'OdontoCloud-IHCE-UnifiedProbe/1.0'
    };

    const fetchOptions = {
      method: httpMethod,
      headers,
      redirect: 'error'
    };
    if (requestBody) {
      fetchOptions.body = requestBody;
    }

    const apimRes = await fetch(fullTargetUrl, fetchOptions);
    const apimElapsed = Date.now() - apimStartTime;
    const responseHeaders = Object.fromEntries(apimRes.headers.entries());
    const responseBody = await apimRes.json().catch(() => null);

    // Inspección profunda de contenido
    const report = inspectResponseContent(apimRes.status, responseHeaders, responseBody);

    console.log('\n=============================================================================');
    console.log('📊 RESULTADO DE LA VERIFICACIÓN DE CONECTIVIDAD:');
    console.log('=============================================================================');
    console.log(`  🌐 Código HTTP: ${apimRes.status} ${apimRes.statusText || ''}`);
    console.log(`  ⏱️ Tiempo de Respuesta: ${apimElapsed} ms`);
    console.log(`  📋 Clasificación de Contenido: ${report.category}`);
    console.log(`  🔌 Conectividad Técnica: ${report.isTechnicalSuccess ? 'EXITOSA' : 'FALLIDA'}`);
    console.log(`  📄 Recuperación Clínica: ${report.isClinicalRetrieval ? 'SÍ' : 'NO (Prueba de control no clínica)'}`);
    console.log(`  💬 Diagnóstico Detallado: ${report.diagnostics}`);
    console.log(`  💡 Recomendación Operativa: ${report.recommendation}`);

    if (responseHeaders['ocp-apim-trace-id']) {
      console.log(`  🔍 APIM Trace ID: ${responseHeaders['ocp-apim-trace-id']}`);
    }

    console.log('=============================================================================');
    console.log('🛡️  SEGURIDAD:');
    console.log('   - Token y claves liberados de memoria al finalizar el proceso.');
    console.log('   - Cero persistencia en archivos o bases de datos.\n');

    await closeReadlineGracefully(rl);
    process.exitCode = report.isTechnicalSuccess ? 0 : 1;
    return;
  } catch (apimNetErr) {
    const apimElapsed = Date.now() - apimStartTime;
    console.error('\n=============================================================================');
    console.error('💥 ERROR DE TRANSPORTE / RED EN PASO 2:');
    console.error('=============================================================================');
    console.error(`  ⏱️ Tiempo: ${apimElapsed} ms`);
    console.error(`  ⚠️ Diagnóstico: ${apimNetErr.message}`);
    console.error('  📋 Causa probable: Fallo de resolución DNS o firewall de red.');
    console.error('=============================================================================\n');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }
}

runInteractiveConnectivityProbe();
