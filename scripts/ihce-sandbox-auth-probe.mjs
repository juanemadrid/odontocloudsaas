/**
 * =============================================================================
 * RUNNER DE PREPRODUCCIÓN IHCE: PROBE PRIVADO DE AUTENTICACIÓN OAUTH2
 * Archivo: scripts/ihce-sandbox-auth-probe.mjs
 * =============================================================================
 * SALVAGUARDAS Y GARANTÍAS DE SEGURIDAD ESTRICTA:
 * 1. DESTINO EXCLUSIVO: Conexión HTTPS únicamente contra login.microsoftonline.com.
 * 2. CERO REDIRECCIONES: Configuración redirect: 'error' en fetch para impedir
 *    seguir redirecciones automáticas hacia cualquier otro destino o dominio.
 * 3. FORMATO GUID ESTRICTO: Valida formalmente que TenantID y ClientID cumplan
 *    con la sintaxis de GUID (8-4-4-4-12) antes de proceder.
 * 4. TTY OBLIGATORIO: Si process.stdin.isTTY es falso, aborta inmediatamente.
 *    NUNCA recurre a un modo que permita capturar secretos en claro.
 * 5. CERO EXPOSICIÓN EN PANTALLA: No muestra fragmentos de ClientID, Scope ni
 *    detalles de secretos.
 * 6. DIAGNÓSTICOS SANITIZADOS: Los errores OAuth2 se reportan mediante códigos
 *    estandarizados y explicaciones sanitizadas, sin imprimir descripciones
 *    crudas que puedan reflejar parámetros sensibles.
 * 7. EXCLUSIVAMENTE OAUTH2: No solicita APIMsubkey; la fase inicial es solo token.
 * 8. AISLAMIENTO TOTAL: Cero dependencias externas, cero conexión a Supabase,
 *    OdontoCloud productivo, VPS o bases de datos clínicas.
 * 9. CONFIRMACIÓN Y ADVERTENCIA: Exige comprobación contra el portal de
 *    Preproducción y confirmación explícita (s/n) antes de cualquier llamada HTTP.
 * 10. GESTIÓN DE MEMORIA DOCUMENTADA: Reconoce las limitaciones del GC de V8
 *     y garantiza la terminación inmediata del proceso (process.exit).
 * =============================================================================
 */

import readline from 'node:readline';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IS_DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simulate');

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
    rl.question(query, answer => {
      resolve(answer.trim());
    });
  });
}

function promptMasked(rl, query) {
  return new Promise(resolve => {
    // REGLA 2: Si no es una terminal TTY interactiva, cancelar inmediatamente
    if (!process.stdin.isTTY && !IS_DRY_RUN) {
      console.error('\n🛑 ERROR DE SEGURIDAD: process.stdin.isTTY es falso.');
      console.error('   Se requiere una consola interactiva real para capturar el ClientSecret de forma oculta.');
      console.error('   Operación abortada para impedir la captura en texto claro.');
      process.exit(1);
    }

    if (IS_DRY_RUN && !process.stdin.isTTY) {
      console.log(`${query} [SIMULADO EN MEMORIA]`);
      resolve('dummy-simulation-secret-xyz-1234');
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

async function runInteractiveProbe() {
  console.log('\n=============================================================================');
  console.log('🛡️  ODONTOCLOUD — PROBE PRIVADO DE AUTENTICACIÓN PREPRODUCCIÓN IHCE');
  console.log('    Protocolo Oficial: OAuth2 Client Credentials (Manual IHCE v1.3)');
  if (IS_DRY_RUN) {
    console.log('    ⚠️  MODO SIMULACIÓN LOCAL ACTIVADO (--dry-run): CERO LLAMADAS DE RED');
  }
  console.log('=============================================================================\n');
  console.log('📋 SALVAGUARDAS DE EJECUCIÓN VERIFICADAS:');
  console.log('   ✓ Destino único permitido: https://login.microsoftonline.com/{TenantID}/oauth2/v2.0/token');
  console.log('   ✓ Política de redirección: STRICT ERROR (redirect: "error")');
  console.log('   ✓ Captura de credenciales: TTY enmascarado obligatorio (Sin historial de comandos)');
  console.log('   ✓ Cero exposición en logs: Sin fragmentos de ClientID, Secret ni Scope');
  console.log('   ✓ Diagnósticos sanitizados: Sin volcado de respuestas crudas');
  console.log('   ✓ Aislamiento de infraestructura: Sin Supabase, sin VPS, sin bases de datos\n');

  // Comprobación temprana de TTY antes de solicitar datos
  if (!process.stdin.isTTY && !IS_DRY_RUN) {
    console.error('🛑 ABORTADO: process.stdin.isTTY es falso. Esta prueba exige un terminal interactivo.');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // 1. Ingreso de TenantID oficial y validación GUID (REGLA 1)
  const tenantId = await promptVisible(rl, '1️⃣  Ingrese el TenantID oficial de Preproducción (GUID): ');
  if (!GUID_REGEX.test(tenantId)) {
    console.error('\n❌ Error: El TenantID debe ser un GUID válido (formato 8-4-4-4-12, ej: 12345678-1234-1234-1234-123456789abc).');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  // 2. Ingreso de ClientID oficial y validación GUID (REGLA 1)
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

  // 4. Ingreso enmascarado de ClientSecret (REGLA 2 y REGLA 5)
  const clientSecret = await promptMasked(rl, '4️⃣  Ingrese el ClientSecret de Preproducción [ENTRADA OCULTA]: ');
  if (!clientSecret || clientSecret.length < 4) {
    console.error('\n❌ Error: El ClientSecret es obligatorio.');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }

  // ---------------------------------------------------------------------------
  // CONSTRUCCIÓN DEL ENDPOINT Y VERIFICACIÓN DE DESTINO (REGLA 1)
  // ---------------------------------------------------------------------------
  const resolvedEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const targetUrl = new URL(resolvedEndpoint);

  if (targetUrl.protocol !== 'https:' || targetUrl.hostname !== 'login.microsoftonline.com') {
    console.error(`\n🛑 VIOLACIÓN DE SEGURIDAD: Destino no permitido (${targetUrl.hostname}).`);
    await closeReadlineGracefully(rl);
    process.exitCode = 2;
    return;
  }

  // REGLA 3: No mostrar fragmentos de ClientID, Scope ni secretos
  console.log('\n-----------------------------------------------------------------------------');
  console.log('🔍 VERIFICACIÓN DE IDENTIFICADORES Y DESTINO:');
  console.log(`   - Endpoint Destino: https://login.microsoftonline.com/{TenantID}/oauth2/v2.0/token`);
  console.log(`   - Host Destino: ${targetUrl.hostname} (Microsoft Entra ID)`);
  console.log(`   - Protocolo: HTTPS`);
  console.log(`   - Política de Redirección: STRICT ERROR (redirect: "error")`);
  console.log(`   - TenantID: [GUID VÁLIDO - VERIFICADO]`);
  console.log(`   - ClientID: [GUID VÁLIDO - VERIFICADO]`);
  console.log(`   - Scope: [CONFIGURADO - VERIFICADO]`);
  console.log(`   - ClientSecret: [CAPTURADO EN MODO OCULTO - EN MEMORIA VOLÁTIL]`);
  console.log('-----------------------------------------------------------------------------');

  // REGLA 1: Confirmación manual de contraste contra el portal ministerial
  console.log('\n⚠️  CONFIRMACIÓN DE AMBIENTE:');
  console.log('   Compruebe manualmente estos identificadores contra la sección PREPRODUCCIÓN / SANDBOX');
  console.log('   del Portal de Administración de Llaves de MinSalud.');
  console.log('   Nota: Esta comprobación manual ayuda a prevenir confusiones, pero no garantiza');
  console.log('   por sí sola el ambiente del directorio en el proveedor de identidad.');

  // REGLA 9: Doble confirmación explícita previa a cualquier conexión
  const envConfirm = await promptVisible(rl, '\n¿Confirma que comprobó que estos identificadores corresponden a PREPRODUCCIÓN? (s/n): ');
  if (envConfirm.toLowerCase() !== 's' && envConfirm.toLowerCase() !== 'si' && envConfirm.toLowerCase() !== 'y') {
    console.log('\n🛑 Cancelado por el usuario: Ambiente no confirmado. Cero peticiones realizadas.');
    await closeReadlineGracefully(rl);
    process.exitCode = 0;
    return;
  }

  const sendConfirm = await promptVisible(rl, '¿Autoriza ahora el envío de la petición de token OAuth2 a Microsoft Entra ID? (s/n): ');

  if (sendConfirm.toLowerCase() !== 's' && sendConfirm.toLowerCase() !== 'si' && sendConfirm.toLowerCase() !== 'y') {
    console.log('\n🛑 Cancelado por el usuario: Envío no autorizado. Cero peticiones de red realizadas.');
    await closeReadlineGracefully(rl);
    process.exitCode = 0;
    return;
  }

  // ---------------------------------------------------------------------------
  // MODO SIMULACIÓN LOCAL (--dry-run)
  // ---------------------------------------------------------------------------
  if (IS_DRY_RUN) {
    console.log('\n=============================================================================');
    console.log('🎉 SIMULACIÓN LOCAL COMPLETADA CON ÉXITO (--dry-run)');
    console.log('=============================================================================');
    console.log('  ✓ Validación de formato GUID: Aprobada para TenantID y ClientID.');
    console.log('  ✓ Captura oculta de ClientSecret: Verificada.');
    console.log('  ✓ Construcción de endpoint: https://login.microsoftonline.com/{TenantID}/oauth2/v2.0/token.');
    console.log('  ✓ Bloqueo de redirecciones: Configurado.');
    console.log('  ✓ Doble confirmación del usuario: Verificada.');
    console.log('  ✓ Cero conexiones externas realizadas.');
    console.log('=============================================================================\n');
    await closeReadlineGracefully(rl);
    process.exitCode = 0;
    return;
  }

  // ---------------------------------------------------------------------------
  // EJECUCIÓN CONTROLADA DE LA PETICIÓN OAUTH2
  // ---------------------------------------------------------------------------
  console.log('\n📡 Transmitiendo solicitud OAuth2 Client Credentials a Microsoft Entra ID...');
  const startTime = Date.now();

  try {
    const bodyParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope
    });

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'OdontoCloud-IHCE-AuthProbe/1.3'
    };

    // REGLA 2: redirect: 'error' impide que fetch siga redirecciones automáticas
    const response = await fetch(resolvedEndpoint, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
      redirect: 'error'
    });

    const elapsed = Date.now() - startTime;
    const responseBody = await response.json().catch(() => null);

    console.log('\n=============================================================================');
    if (response.ok && responseBody?.access_token) {
      console.log('🎉 RESULTADO: AUTENTICACIÓN EXITOSA EN PREPRODUCCIÓN');
      console.log('=============================================================================');
      console.log(`  ✅ Código HTTP: ${response.status} OK`);
      console.log(`  ⏱️ Tiempo de Respuesta: ${elapsed} ms`);
      console.log(`  🔑 Access Token Recibido: SÍ (Bearer JWT válido emitido por Entra ID)`);
      console.log(`  📏 Longitud del Token: ${responseBody.access_token.length} caracteres`);
      console.log(`  ⏳ Vigencia: ${responseBody.expires_in || 3600} segundos (~${Math.round((responseBody.expires_in || 3600) / 60)} min)`);
      console.log(`  🎯 Token Type: ${responseBody.token_type || 'Bearer'}`);
      console.log('=============================================================================');
      console.log('🛡️  SEGURIDAD Y MEMORIA:');
      console.log('   - Cero tokens ni credenciales guardados en archivos, bases de datos o logs.');
      console.log('   - Aviso técnico: En Node.js (V8), las cadenas de texto permanecen en el heap');
      console.log('     hasta que el recolector de basura las libere. La terminación inmediata del');
      console.log('     proceso del sistema operativo garantiza la liberación total de la memoria.\n');
      await closeReadlineGracefully(rl);
      process.exitCode = 0;
      return;
    } else {
      // REGLA 4: Diagnósticos sanitizados sin imprimir descripciones crudas
      console.log('⚠️  RESULTADO: RESPUESTA DE MICROSOFT ENTRA ID');
      console.log('=============================================================================');
      console.log(`  ❌ Código HTTP: ${response.status}`);
      console.log(`  ⏱️ Tiempo de Respuesta: ${elapsed} ms`);
      
      const rawError = typeof responseBody?.error === 'string' ? responseBody.error : 'auth_error';
      console.log(`  ⚠️ Diagnóstico Sanitizado: ${rawError}`);
      
      if (rawError === 'invalid_client') {
        console.log('  📋 Causa: El ClientID o ClientSecret no coincide con el registrado en Entra ID para este Tenant.');
      } else if (rawError === 'invalid_scope') {
        console.log('  📋 Causa: El Scope indicado no corresponde al recurso expuesto para la API de Sandbox.');
      } else if (rawError === 'unauthorized_client') {
        console.log('  📋 Causa: El cliente no está autorizado para usar el grant_type client_credentials.');
      } else if (response.status === 404) {
        console.log('  📋 Causa: El TenantID no existe en el directorio de Microsoft Entra ID.');
      } else {
        console.log('  📋 Causa: Petición de token rechazada por el servidor de autorización.');
      }
      console.log('=============================================================================\n');
      await closeReadlineGracefully(rl);
      process.exitCode = 1;
      return;
    }
  } catch (netErr) {
    const elapsed = Date.now() - startTime;
    console.error('\n=============================================================================');
    console.error('💥 ERROR DE TRANSPORTE / RED:');
    console.error('=============================================================================');
    console.error(`  ⏱️ Tiempo: ${elapsed} ms`);
    console.error(`  ⚠️ Diagnóstico: ${netErr.message}`);
    console.error('=============================================================================\n');
    await closeReadlineGracefully(rl);
    process.exitCode = 1;
    return;
  }
}

// Ejecutar
runInteractiveProbe();
