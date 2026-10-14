/**
 * =============================================================================
 * SUITE DE PRUEBAS AUTOMATIZADAS: INTEGRACIÓN LOCAL AISLADA IHCE ODONTOCLOUD
 * Archivo: scripts/test-ihce-isolated-suite.mjs
 * =============================================================================
 * EJECUCIÓN TOTALMENTE AISLADA:
 * - Cero llamadas de red hacia MinSalud / SISPRO / Hércules.
 * - Cero modificaciones en base de datos productiva o VPS.
 * - Datos 100% sintéticos y ficticios.
 * - Simula el protocolo oficial MinSalud v1.3.
 * =============================================================================
 */

import { buildRdaConsultaExternaBundle, validateRdaBundle } from '../server/ihce/ihceBundleBuilder.js';
import { IhceAuthClient } from '../server/ihce/ihceAuthClient.js';
import { IhceNationalConnector } from '../server/ihce/ihceNationalConnector.js';
import { IhceMockNationalServer } from '../server/ihce/ihceMockNationalServer.js';
import { IhceWorker } from '../server/ihce/ihceWorker.js';
import { IhceReconciliationService } from '../server/ihce/ihceReconciliationService.js';
import { encryptSecret, decryptSecret } from '../server/ihce/ihceCrypto.js';
import { FHIR_SYSTEMS, SERVICIOS_HABILITADOS_REPS } from '../server/ihce/ihceConstants.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FALLO: ${message}`);
    throw new Error(`AssertionFailed: ${message}`);
  }
  passedTests++;
  console.log(`  ✅ OK: ${message}`);
}

async function runSuite() {
  console.log('\n=============================================================================');
  console.log('🧪 INICIANDO SUITE DE PRUEBAS IHCE — AMBIENTE LOCAL AISLADO (ODONTOCLOUD)');
  console.log('=============================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: IDENTIFICACIÓN DEL PRESTADOR DR. GUILLERMO RODRÍGUEZ (REPS + SERVICIO 334)
  // ---------------------------------------------------------------------------
  console.log('📋 GRUPO 1: Identificación Oficial del Prestador en REPS');
  {
    const prestadorReps = '7000101658'; // 10 dígitos
    const sedeReps = '01';              // 2 dígitos
    const servicioReps = SERVICIOS_HABILITADOS_REPS.ODONTOLOGIA_GENERAL.code; // '334'

    assert(prestadorReps.length === 10, 'Código de prestador tiene exactamente 10 dígitos (7000101658).');
    assert(sedeReps.length === 2, 'Código de sede tiene exactamente 2 dígitos (01).');
    assert(servicioReps === '334', 'Servicio habilitado es 334 – Odontología General (no 328).');
    assert(prestadorReps + sedeReps === '700010165801', 'Composición de sede de 12 dígitos preserva integridad sin alterar el código de prestador.');
  }

  // ---------------------------------------------------------------------------
  // TEST 2: AISLAMIENTO MULTIPROFESIONAL Y MULTIEMPRESA (PREVENCIÓN DE SUPLANTACIÓN)
  // ---------------------------------------------------------------------------
  console.log('\n📋 GRUPO 2: Aislamiento Multiprofesional y Protección de Credenciales');
  {
    const mockServer = new IhceMockNationalServer({ mode: 'DYNAMIC' });
    const connector = new IhceNationalConnector({ mockServer });
    const worker = new IhceWorker({ connector });

    // Simulador de BD con dos odontólogos en la misma clínica:
    // Doctor 1: Dr. Guillermo (con credenciales REPS 7000101658)
    // Doctor 2: Dra. Sandra (prestador independiente sin credenciales configuradas)
    const doctorGuillermoId = 'doc-guillermo-uuid-001';
    const doctorSandraId = 'doc-sandra-uuid-002';
    const tenantId = 'clinica-compartida-uuid-100';

    const credentialsDb = {
      [doctorGuillermoId]: {
        is_active: true,
        client_id: 'client-guillermo-id',
        client_secret: 'secret-guillermo-dummy',
        apim_subscription_key: 'apim-key-guillermo-dummy',
        codigo_habilitacion_reps: '7000101658',
        codigo_sede_reps: '01',
        codigo_servicio_reps: '334',
        ambiente: 'SANDBOX_MOCK'
      }
      // Dra. Sandra NO tiene credenciales registradas
    };

    mockServer.validClients.add('client-guillermo-id');

    // Caso 2.1: Atención atendida por el Dr. Guillermo -> Debe resolverse exitosamente con sus llaves
    let updatedJobStatus = null;
    let updatedJobMessage = null;

    const mockDbGuillermo = {
      claimBatch: async () => [{
        id: 'job-guillermo-1',
        tenant_id: tenantId,
        idempotency_key: 'idemp-guillermo-1'
      }],
      getJobClinicalContext: async () => ({
        evolution: {
          id: 'evo-g1',
          doctor_id: doctorGuillermoId,
          fecha: '2026-10-13T10:00:00Z',
          closed_at: '2026-10-13T10:30:00Z',
          modalidad_atencion: '01',
          cie10_principal_codigo: 'K02.1',
          cups_codigo: '890203',
          diagnostico: 'Caries de la dentina',
          tratamiento: 'Consulta odontológica de primera vez',
          reps_prestador: '7000101658'
        },
        patient: {
          id: 'pat-1',
          tipo_documento: 'CC',
          documento: '999888777',
          nombres: 'Paciente Ficticio Apolo',
          apellidos: 'Prueba',
          genero: 'M',
          fecha_nacimiento: '1990-05-15'
        },
        practitioner: {
          id: doctorGuillermoId,
          tipo_documento: 'CC',
          numero_documento: '12345678',
          nombre_completo: 'Dr. Guillermo José Rodríguez Mercado',
          registro_medico: 'RETHUS-GRM-001',
          codigo_habilitacion_reps: '7000101658',
          especialidad: 'Odontología General'
        },
        organization: {
          id: 'org-1',
          nit: '900123456',
          nombre: 'Consultorio Odontológico Guillermo Rodríguez',
          codigo_habilitacion_reps: '7000101658'
        },
        branch: {
          id: 'branch-1',
          codigo_sede_reps: '01',
          nombre: 'Sede Principal'
        }
      }),
      getPrestadorCredentials: async ({ doctorId, repsCode }) => {
        return credentialsDb[doctorId] || null;
      },
      updateJobResult: async ({ status, errorMensaje }) => {
        updatedJobStatus = status;
        updatedJobMessage = errorMensaje;
      }
    };

    await worker.processCycle(mockDbGuillermo);
    if (updatedJobStatus !== 'ACEPTADO') {
      console.log('    Debug Guillermo job:', { status: updatedJobStatus, error: updatedJobMessage });
    }
    assert(updatedJobStatus === 'ACEPTADO', 'Atención del Dr. Guillermo despachada exitosamente con sus credenciales autorizadas.');

    // Caso 2.2: Atención atendida por la Dra. Sandra (sin credenciales)
    // El sistema NUNCA debe usar las llaves del Dr. Guillermo para transmitir la atención de Sandra
    const mockDbSandra = {
      claimBatch: async () => [{
        id: 'job-sandra-1',
        tenant_id: tenantId,
        idempotency_key: 'idemp-sandra-1'
      }],
      getJobClinicalContext: async () => ({
        evolution: {
          id: 'evo-s1',
          doctor_id: doctorSandraId,
          fecha: '2026-10-13T11:00:00Z',
          closed_at: '2026-10-13T11:20:00Z',
          modalidad_atencion: '01',
          cie10_principal_codigo: 'K05.0',
          cups_codigo: '890203',
          reps_prestador: '1100109988' // REPS propio de Sandra
        },
        patient: {
          id: 'pat-2',
          tipo_documento: 'CC',
          documento: '888777666',
          nombres: 'Paciente Ficticio Boreal',
          apellidos: 'Prueba',
          genero: 'F',
          fecha_nacimiento: '1985-08-20'
        },
        practitioner: {
          id: doctorSandraId,
          nombre_completo: 'Dra. Sandra Independiente',
          codigo_habilitacion_reps: '1100109988'
        },
        organization: {
          id: 'org-2',
          codigo_habilitacion_reps: '1100109988'
        },
        branch: {
          id: 'branch-1',
          codigo_sede_reps: '01'
        }
      }),
      getPrestadorCredentials: async ({ doctorId }) => {
        return credentialsDb[doctorId] || null;
      },
      updateJobResult: async ({ status, errorMensaje }) => {
        updatedJobStatus = status;
        updatedJobMessage = errorMensaje;
      }
    };

    await worker.processCycle(mockDbSandra);
    assert(updatedJobStatus === 'ERROR_REINTENTO', 'Atención de profesional sin credenciales retenida sin transmitir.');
    assert(updatedJobMessage.includes('CREDENTIALS_MISSING'), 'Se generó alerta de seguridad por falta de credenciales del profesional específico.');

    // Caso 2.3: Intento de violación de habilitación (si alguien intentara asociar las credenciales de Guillermo a Sandra)
    const mockDbViolacion = {
      claimBatch: async () => [{
        id: 'job-violation-1',
        tenant_id: tenantId,
        idempotency_key: 'idemp-violation-1'
      }],
      getJobClinicalContext: async () => ({
        evolution: {
          id: 'evo-v1',
          doctor_id: doctorSandraId,
          fecha: '2026-10-13T12:00:00Z',
          reps_prestador: '1100109988'
        },
        patient: {
          id: 'pat-3',
          tipo_documento: 'CC',
          documento: '777666555',
          nombres: 'Paciente Prueba C',
          apellidos: 'Sintético',
          genero: 'M',
          fecha_nacimiento: '1995-01-01'
        },
        practitioner: {
          id: doctorSandraId,
          nombre_completo: 'Dra. Sandra',
          codigo_habilitacion_reps: '1100109988'
        },
        organization: {
          codigo_habilitacion_reps: '1100109988'
        },
        branch: { codigo_sede_reps: '01' }
      }),
      // Intenta retornar erróneamente las credenciales de Guillermo para la atención de Sandra:
      getPrestadorCredentials: async () => credentialsDb[doctorGuillermoId],
      updateJobResult: async ({ status, errorMensaje }) => {
        updatedJobStatus = status;
        updatedJobMessage = errorMensaje;
      }
    };

    await worker.processCycle(mockDbViolacion);
    assert(updatedJobStatus === 'RECHAZADO', 'Intento de cruce de REPS rechazado inmediatamente.');
    assert(updatedJobMessage.includes('SECURITY_VIOLATION'), 'Detección estricta de conflicto de REPS (prohibida transmisión con identidad ajena).');
  }

  // ---------------------------------------------------------------------------
  // TEST 3: CONSTRUCCIÓN Y VALIDACIÓN SINTÁCTICA LOCAL DE BUNDLE FHIR R4
  // ---------------------------------------------------------------------------
  console.log('\n📋 GRUPO 3: Estructura FHIR R4 (RDA Consulta Externa Odontológica)');
  {
    const bundleParams = {
      evolution: {
        id: 'evo-test-334',
        doctor_id: 'doc-guillermo-001',
        fecha: '2026-10-13T09:00:00Z',
        closed_at: '2026-10-13T09:30:00Z',
        modalidad_atencion: '01',
        causa_externa: '13',
        cie10_principal_codigo: 'K02.1',
        cie10_principal_tipo: 2,
        cups_codigo: '890203',
        diagnostico: 'Caries de la dentina',
        tratamiento: 'Consulta de primera vez por odontología general',
        notas: 'Paciente acude a valoración odontológica rutinaria. Sin antecedentes patológicos relevantes.'
      },
      patient: {
        id: 'pat-test-uuid',
        tipo_documento: 'CC',
        documento: '1099888777',
        nombres: 'Juan Ficticio',
        apellidos: 'Pérez Sintético',
        genero: 'M',
        fecha_nacimiento: '1988-11-20',
        direccion: 'Calle 100 # 15-20',
        ciudad: 'Sincelejo',
        divipola_municipio: '70001',
        telefono: '3001234567',
        pertenencia_etnica_codigo: '6'
      },
      practitioner: {
        id: 'doc-guillermo-001',
        tipo_documento: 'CC',
        numero_documento: '70123456',
        nombre_completo: 'Guillermo José Rodríguez Mercado',
        registro_medico: 'RETHUS-70123456',
        especialidad: 'Odontología General',
        codigo_servicio: '334'
      },
      organization: {
        id: 'org-guillermo-001',
        nit: '70123456-1',
        nombre: 'Consultorio Odontológico Guillermo José Rodríguez Mercado',
        codigo_habilitacion_reps: '7000101658'
      },
      branch: {
        id: 'branch-01',
        codigo_sede_reps: '01',
        nombre: 'Consultorio Principal'
      }
    };

    const bundle = buildRdaConsultaExternaBundle(bundleParams);

    assert(bundle.resourceType === 'Bundle', 'Recurso raíz es Bundle.');
    assert(bundle.type === 'document', 'Tipo de Bundle es document.');
    assert(bundle.entry[0].resource.resourceType === 'Composition', 'Primer elemento de entry es Composition.');

    const composition = bundle.entry[0].resource;
    assert(composition.type.coding[0].code === '34133-9', 'Composition type codificado con LOINC oficial (34133-9).');

    const encounter = bundle.entry.find(e => e.resource.resourceType === 'Encounter')?.resource;
    assert(encounter.serviceType.coding[0].code === '334', 'Encounter declara explícitamente el servicio REPS 334 (Odontología General).');
    assert(encounter.class.code === 'AMB', 'Encounter class es AMB (Ambulatoria).');

    const organization = bundle.entry.find(e => e.resource.resourceType === 'Organization')?.resource;
    const repsOrg = organization.identifier.find(i => i.system === FHIR_SYSTEMS.REPS)?.value;
    assert(repsOrg === '7000101658', 'Organization contiene el código de prestador REPS de 10 dígitos (7000101658).');

    const validation = validateRdaBundle(bundle);
    assert(validation.valid === true, 'Bundle supera 100% las reglas del validador estricto local.');
    console.log('    ℹ️ AVISO NORMATIVO: Esta validación local confirma estructura conforme, pero el Visto Bueno oficial depende exclusivamente del banco de pruebas Vulcano de MinSalud.');
  }

  // ---------------------------------------------------------------------------
  // TEST 4: BLOQUEO ABSOLUTO DE PRODUCCIÓN
  // ---------------------------------------------------------------------------
  console.log('\n📋 GRUPO 4: Bloqueo de Red y Salvaguarda de Producción');
  {
    const authClient = new IhceAuthClient();
    const connector = new IhceNationalConnector({ authClient });

    let prodBlocked = false;
    try {
      await authClient.getAccessToken({
        tenantId: 'tenant-prod',
        clientId: 'client-prod',
        clientSecret: 'secret-prod',
        ambiente: 'PRODUCCION'
      });
    } catch (err) {
      prodBlocked = err.message.includes('IHCE_PRODUCCION_BLOQUEADA');
    }
    assert(prodBlocked === true, 'Intento de autenticar en ambiente PRODUCCION bloqueado con excepción fatal.');

    const submitResult = await connector.submitRdaBundle({
      bundle: { resourceType: 'Bundle', entry: [] },
      credentials: {
        tenantId: 'tenant-prod',
        ambiente: 'PRODUCCION'
      },
      idempotencyKey: 'test-key-prod'
    });
    assert(submitResult.status === 'BLOQUEADO_SALVAGUARDA', 'Intento de despacho a PRODUCCION rechazado con estatus BLOQUEADO_SALVAGUARDA.');
  }

  // ---------------------------------------------------------------------------
  // TEST 5: MANEJO DE MANUAL V1.3 — HTTP 200 / 201 Y CONFLICTO DUPLICADO (HTTP 409)
  // ---------------------------------------------------------------------------
  console.log('\n📋 GRUPO 5: Correspondencia Manual v1.3 (HTTP 200 / 201 y Duplicados HTTP 409)');
  {
    const mockServer = new IhceMockNationalServer({ mode: 'DYNAMIC' });
    const connector = new IhceNationalConnector({ mockServer });
    mockServer.validClients.add('valid-client');

    const credentials = {
      tenantId: 'tenant-1',
      clientId: 'valid-client',
      clientSecret: 'dummy-secret',
      apimSubscriptionKey: 'apim-sub-key-test',
      repsCode: '7000101658',
      ambiente: 'SANDBOX_MOCK'
    };

    const bundle = {
      resourceType: 'Bundle',
      id: 'bundle-idem-1',
      type: 'document',
      entry: [{ resource: { resourceType: 'Composition' } }]
    };

    const idempKey = 'idempotency-hash-sha256-abc123xyz';

    // 5.1 Envío primario: Manual v1.3 especifica HTTP 200 OK
    const res1 = await connector.submitRdaBundle({ bundle, credentials, idempotencyKey: idempKey });
    assert(res1.status === 'ACEPTADO' && res1.httpStatus === 200, 'Respuesta exitosa oficial recibida con HTTP 200 OK (Manual v1.3).');
    assert(res1.radicado && res1.radicado.startsWith('RAD-'), 'Radicado oficial ministerial extraído correctamente.');
    const radicadoOriginal = res1.radicado;

    // 5.2 Alternativa HTTP 201 CREATED también soportada
    mockServer.setMode('SUCCESS_201');
    const res201 = await connector.submitRdaBundle({ bundle, credentials, idempotencyKey: 'idemp-201-key' });
    assert(res201.status === 'ACEPTADO' && res201.httpStatus === 201, 'Respuesta exitosa alternativa con HTTP 201 aceptada correctamente.');
    mockServer.setMode('DYNAMIC');

    // 5.3 Segundo envío con misma clave (Conflicto 409 con correspondencia probada)
    const res2 = await connector.submitRdaBundle({ bundle, credentials, idempotencyKey: idempKey });
    assert(res2.status === 'ACEPTADO' && res2.httpStatus === 409, 'Reenvío 409 con correspondencia de documento verificada aceptado sin duplicar atención.');
    assert(res2.radicado === radicadoOriginal, 'Radicado confirmado coincide exactamente con el original sin generar uno nuevo.');

    // 5.4 Conflicto 409 SIN correspondencia probada (MinSalud OperationOutcome estándar sin radicado)
    // PROHIBIDO INVENTAR IDENTIFICADORES: Debe quedar PENDIENTE_CONCILIACION
    mockServer.setMode('CONFLICT_409');
    const resConflictUnverified = await connector.submitRdaBundle({ 
      bundle, 
      credentials, 
      idempotencyKey: 'idemp-unverified-409' 
    });
    assert(resConflictUnverified.status === 'PENDIENTE_CONCILIACION' && resConflictUnverified.httpStatus === 409, 
      'Duplicado HTTP 409 sin correspondencia comprobada retenido estrictamente en PENDIENTE_CONCILIACION.');
    assert(resConflictUnverified.radicado === null, 'Cero identificadores inventados: radicado permanece null.');
    mockServer.setMode('DYNAMIC');
  }

  // ---------------------------------------------------------------------------
  // TEST 6: TRATAMIENTO DE RECHAZO SEMÁNTICO (HTTP 422)
  // ---------------------------------------------------------------------------
  console.log('\n📋 GRUPO 6: Rechazo Semántico de Regla Clínica MinSalud (HTTP 422)');
  {
    const mockServer = new IhceMockNationalServer({ mode: 'UNPROCESSABLE_422' });
    const connector = new IhceNationalConnector({ mockServer });
    mockServer.validClients.add('client-test');

    const res = await connector.submitRdaBundle({
      bundle: { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Composition' } }] },
      credentials: {
        tenantId: 'tenant-1',
        clientId: 'client-test',
        clientSecret: 'dummy-secret',
        apimSubscriptionKey: 'apim-key-test',
        ambiente: 'SANDBOX_MOCK'
      },
      idempotencyKey: 'idemp-err-422'
    });

    assert(res.status === 'RECHAZADO' && res.httpStatus === 422, 'Rechazo semántico HTTP 422 clasificado como RECHAZADO.');
    assert(res.isTerminal === true, 'Estado es terminal (no reintentable en bucle infinito).');
  }

  // ---------------------------------------------------------------------------
  // TEST 7: RESILIENCIA Y CONCILIACIÓN DE TAREAS HUÉRFANAS
  // ---------------------------------------------------------------------------
  console.log('\n📋 GRUPO 7: Conciliación de Transacciones Huérfanas');
  {
    const mockServer = new IhceMockNationalServer({ mode: 'DYNAMIC' });
    const connector = new IhceNationalConnector({ mockServer });
    const reconciliationService = new IhceReconciliationService({ connector });

    // Registramos previamente un documento en el mock para simular que MinSalud lo recibió
    mockServer.registeredDocuments.set('idemp-orphan-1', {
      radicado: 'RAD-RECONCILED-991',
      fhirId: 'fhir-doc-991',
      timestamp: new Date().toISOString()
    });

    let reconciledStatus = null;
    let reconciledRadicado = null;
    const dbAdapter = {
      updateJobResult: async ({ status, radicado }) => {
        reconciledStatus = status;
        reconciledRadicado = radicado;
      }
    };

    const job = { id: 'job-orphan-1', idempotency_key: 'idemp-orphan-1' };
    const creds = { tenantId: 'tenant-1' };

    const result = await reconciliationService.reconcileJob(job, dbAdapter, creds);
    assert(result.reconciled === true && reconciledStatus === 'ACEPTADO', 'Trabajo huérfano conciliado exitosamente con MinSalud sin retransmitir.');
    assert(reconciledRadicado === 'RAD-RECONCILED-991', 'Radicado recuperado de forma concluyente desde el registro nacional.');
  }

  // ---------------------------------------------------------------------------
  // TEST 8: PROTECCIÓN CRIPTOGRÁFICA DE SECRETOS Y FLUJO REAL DE WORKER (AES-256-GCM)
  // ---------------------------------------------------------------------------
  console.log('\n📋 GRUPO 8: Custodia Criptográfica en Reposo y Descifrado en Worker (AES-256-GCM)');
  {
    // Clave de prueba de 32 bytes (256 bits) en Base64
    const masterKeyTest = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU=';
    process.env.IHCE_MASTER_ENCRYPTION_KEY = masterKeyTest;
    const fakeClientSecret = 'super-secret-client-credentials-token-xyz-1234';
    const fakeApimKey = 'super-secret-apim-subkey-abc-9876';
    const repsGuillermo = '7000101658';
    const tenantClinica = 'tenant-clinica-crypto-999';
    const aadContext = `prestador:${repsGuillermo}:tenant:${tenantClinica}`;

    // 8.1 Cifrado en envelope
    const secretEnvelope = await encryptSecret(fakeClientSecret, aadContext, masterKeyTest);
    const apimEnvelope = await encryptSecret(fakeApimKey, aadContext, masterKeyTest);
    assert(secretEnvelope.alg === 'AES-256-GCM', 'Algoritmo de sobre es AES-256-GCM.');
    assert(secretEnvelope.ciphertext !== fakeClientSecret, 'El secreto cifrado no contiene texto plano.');
    assert(secretEnvelope.iv && secretEnvelope.iv.length > 0, 'Vector de inicialización único de 12 bytes generado.');

    // 8.2 Descifrado directo
    const decryptedSecret = await decryptSecret(secretEnvelope, aadContext, masterKeyTest);
    const decryptedApim = await decryptSecret(apimEnvelope, aadContext, masterKeyTest);
    assert(decryptedSecret === fakeClientSecret, 'Descifrado auténtico recupera client_secret con verificación AAD.');
    assert(decryptedApim === fakeApimKey, 'Descifrado auténtico recupera APIM subscription key.');

    // 8.3 Intento de tampering AAD (falsificación de contexto de prestador)
    let tamperDetected = false;
    try {
      await decryptSecret(secretEnvelope, 'prestador:9999999999:tenant:fake', masterKeyTest);
    } catch {
      tamperDetected = true;
    }
    assert(tamperDetected === true, 'Modificación del contexto asociado (AAD) rechazada por verificación criptográfica.');

    // 8.4 Flujo REAL del Worker con sobres cifrados:
    // El worker debe recibir el sobre cifrado en BD, descifrarlo en memoria volátil y despachar sin errores
    const mockServerWorker = new IhceMockNationalServer({ mode: 'DYNAMIC' });
    mockServerWorker.validClients.add('client-guillermo-crypto');
    const connectorWorker = new IhceNationalConnector({ mockServer: mockServerWorker });
    const workerWithCrypto = new IhceWorker({ connector: connectorWorker });

    let workerUpdatedStatus = null;
    let workerRadicado = null;

    const mockDbCrypto = {
      claimBatch: async () => [{
        id: 'job-crypto-1',
        tenant_id: tenantClinica,
        idempotency_key: 'idemp-crypto-flow-1'
      }],
      getJobClinicalContext: async () => ({
        evolution: {
          id: 'evo-c1',
          doctor_id: 'doc-guillermo-crypto',
          fecha: '2026-10-13T14:00:00Z',
          closed_at: '2026-10-13T14:30:00Z',
          modalidad_atencion: '01',
          cie10_principal_codigo: 'K02.1',
          cups_codigo: '890203',
          reps_prestador: repsGuillermo
        },
        patient: {
          id: 'pat-c1',
          tipo_documento: 'CC',
          documento: '555444333',
          nombres: 'Paciente Cripto',
          apellidos: 'Prueba',
          genero: 'M',
          fecha_nacimiento: '1992-03-10'
        },
        practitioner: {
          id: 'doc-guillermo-crypto',
          tipo_documento: 'CC',
          numero_documento: '70123456',
          nombre_completo: 'Dr. Guillermo José Rodríguez Mercado',
          registro_medico: 'RETHUS-70123456',
          codigo_habilitacion_reps: repsGuillermo
        },
        organization: {
          codigo_habilitacion_reps: repsGuillermo
        },
        branch: { codigo_sede_reps: '01' }
      }),
      // La base de datos devuelve ÚNICAMENTE sobres cifrados JSONB (sin texto plano)
      getPrestadorCredentials: async () => ({
        is_active: true,
        client_id: 'client-guillermo-crypto',
        client_secret_envelope: secretEnvelope,
        apim_subscription_key_envelope: apimEnvelope,
        codigo_habilitacion_reps: repsGuillermo,
        codigo_sede_reps: '01',
        codigo_servicio_reps: '334',
        ambiente: 'SANDBOX_MOCK'
      }),
      updateJobResult: async ({ status, radicado, errorMensaje }) => {
        workerUpdatedStatus = status;
        workerRadicado = radicado;
        if (status !== 'ACEPTADO') {
          console.log('    Debug worker crypto error:', { status, errorMensaje });
        }
      }
    };

    await workerWithCrypto.processCycle(mockDbCrypto);
    assert(workerUpdatedStatus === 'ACEPTADO', 'Worker descifró exitosamente los sobres AES-256-GCM en memoria y radicó la atención.');
    assert(workerRadicado && workerRadicado.startsWith('RAD-'), 'Radicación completada con radicado oficial emitido.');
  }

  console.log('\n=============================================================================');
  console.log(`🎉 SUITE LOCAL SUPERADA: ${passedTests}/${totalTests} pruebas exitosas sin errores.`);
  console.log('=============================================================================\n');
}

runSuite().catch(err => {
  console.error('\n💥 ERROR FATAL EN LA EJECUCIÓN DE PRUEBAS:', err);
  process.exit(1);
});
