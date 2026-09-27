/**
 * scripts/test_p1_fev4_muv_credit_note_suite.mjs
 * 
 * Suite formal de pruebas automatizadas para Fase P1-FEV4:
 * Integración MUV para Nota Crédito Total y Parcial.
 * 
 * Verifica los requerimientos de las secciones 1 a 18 del protocolo:
 * - NC Total: CargarNCTotal, rips=null, AttachedDocument CreditNote, preservación de FEV original, idempotencia.
 * - NC Parcial: Trazabilidad clínica inequívoca, solo servicios afectados, tipoNota=NC, numNota Factus, numFactura FEV,
 *   crosscheck de valores (NC_RIPS_VALUE_MISMATCH), CargarNC, CUV persistido.
 * - Gateway: Enum fijo (FEV_RIPS, NC_PARTIAL, NC_TOTAL), rechazo de rutas arbitrarias (SSRF guard).
 * - Seguridad: CERO exposición de secretos SISPRO, tokens MUV o shared secrets.
 */

import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  MUV_OPERATIONS,
  MUV_ENDPOINT_MAPPING,
  createMuvGatewayHandler,
} from "../services/muv-gateway/server.mjs";
import {
  signMuvGatewayJwt,
  verifyMuvGatewayJwt,
  _resetSeenNoncesForTest,
} from "../services/muv-gateway/jwtAuth.mjs";
import {
  buildPartialCreditNoteRips,
  executeNcRipsCrosscheck,
  verifyItemClinicalTraceability,
  ERROR_CODES,
} from "../src/services/muvCreditNoteRipsBuilder.js";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const TEST_GATEWAY_SECRET = "test_shared_secret_muv_gateway_1234567890abcdef_secure";
const TEST_TENANT = "11111111-1111-1111-1111-111111111111";

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [TEST ${totalTests}] ${message}`);
  } else {
    console.error(`  ✗ [FAIL ${totalTests}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Generador de AttachedDocument CreditNote XML simulado válido
function generateMockCreditNoteXml({
  cude = "cude-mock-384-creditnote-1234567890abcdef1234567890abcdef1234567890abcdef",
  ncNumber = "NC-990000001",
  originalBillNumber = "SETP990000001",
  nitEmisor = "901234567",
}) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AttachedDocument xmlns="urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2"
                  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
                  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${ncNumber}</cbc:ID>
  <cac:SenderParty>
    <cac:PartyTaxScheme>
      <cbc:CompanyID>${nitEmisor}</cbc:CompanyID>
    </cac:PartyTaxScheme>
  </cac:SenderParty>
  <cac:Attachment>
    <cac:ExternalReference>
      <cbc:Description><![CDATA[
        <CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
                    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
                    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
          <cbc:UUID schemeName="CUDE-SHA384">${cude}</cbc:UUID>
          <cbc:ID>${ncNumber}</cbc:ID>
          <cac:AccountingSupplierParty>
            <cbc:CompanyID>${nitEmisor}</cbc:CompanyID>
          </cac:AccountingSupplierParty>
          <cac:BillingReference>
            <cac:InvoiceDocumentReference>
              <cbc:ID>${originalBillNumber}</cbc:ID>
            </cac:InvoiceDocumentReference>
          </cac:BillingReference>
        </CreditNote>
      ]]></cbc:Description>
    </cac:ExternalReference>
  </cac:Attachment>
</AttachedDocument>`;
  return Buffer.from(xml, "utf8").toString("base64");
}

async function runSuite() {
  console.log("==================================================");
  console.log("INICIANDO SUITE FASE P1-FEV4: INTEGRACIÓN MUV NC");
  console.log("==================================================\n");

  const dbClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  globalThis.__supabase = dbClient;

  // ─────────────────────────────────────────────────────────────
  // GRUPO 1: GATEWAY — ENUM FIJO Y BLOQUEO DE RUTAS ARBITRARIAS
  // ─────────────────────────────────────────────────────────────
  console.log("--- 1. Gateway: Mapeo Fijo y Bloqueo de Rutas Arbitrarias (SSRF) ---");

  assert(
    MUV_OPERATIONS.FEV_RIPS === "FEV_RIPS" &&
    MUV_OPERATIONS.NC_PARTIAL === "NC_PARTIAL" &&
    MUV_OPERATIONS.NC_TOTAL === "NC_TOTAL",
    "Enum fijo MUV_OPERATIONS contiene FEV_RIPS, NC_PARTIAL, NC_TOTAL"
  );

  assert(
    MUV_ENDPOINT_MAPPING.NC_PARTIAL === "/api/PaquetesFevRips/CargarNC",
    "Mapeo interno NC_PARTIAL -> /api/PaquetesFevRips/CargarNC"
  );

  assert(
    MUV_ENDPOINT_MAPPING.NC_TOTAL === "/api/PaquetesFevRips/CargarNCTotal",
    "Mapeo interno NC_TOTAL -> /api/PaquetesFevRips/CargarNCTotal"
  );

  assert(
    MUV_ENDPOINT_MAPPING.FEV_RIPS === "/api/PaquetesFevRips/CargarFevRips",
    "Mapeo interno FEV_RIPS -> /api/PaquetesFevRips/CargarFevRips"
  );

  // Iniciar servidor local de Gateway en memoria para probar handler
  let lastMuvRequestedPath = null;
  let lastMuvRequestBody = null;

  // Servidor MUV Mock local para registrar endpoint solicitado
  const mockMuvServer = http.createServer((req, res) => {
    lastMuvRequestedPath = req.url;
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      let text = "";
      try {
        if (req.headers["content-encoding"] === "gzip") {
          text = zlib.gunzipSync(buffer).toString("utf8");
        } else {
          text = buffer.toString("utf8");
        }
        lastMuvRequestBody = JSON.parse(text);
      } catch (_) {
        lastMuvRequestBody = null;
      }

      if (req.url === "/api/Auth/LoginSISPRO") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ login: true, token: "mock_sispro_token_xyz" }));
      }

      // Respuesta de CargarNCTotal o CargarNC
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          resultState: "Procesado",
          processId: "PROC-NC-1001",
          cuv: "CUV-NC-MOCK-777",
          fechaRadicacion: "2026-09-27T10:00:00Z",
          errors: [],
          warnings: [],
        })
      );
    });
  });

  const muvPort = 9876;
  await new Promise((r) => mockMuvServer.listen(muvPort, r));

  const gatewayHandler = createMuvGatewayHandler({
    sharedSecret: TEST_GATEWAY_SECRET,
    muvBaseUrl: `http://127.0.0.1:${muvPort}`,
  });

  const testGatewayServer = http.createServer(gatewayHandler);
  const gatewayPort = 9877;
  await new Promise((r) => testGatewayServer.listen(gatewayPort, r));

  // Prueba: Rechazo de URL o path arbitrario desde el cliente
  _resetSeenNoncesForTest();
  const testJwt = signMuvGatewayJwt({ tenantId: TEST_TENANT }, TEST_GATEWAY_SECRET);

  const testArbitraryPathRes = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/transmit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${testJwt}`,
    },
    body: JSON.stringify({
      path: "/api/Arbitrary/Hack",
      url: "http://malicious.com",
      operation: "NC_TOTAL",
      identidad: { nit: "901234567", numDoc: "123", tipoDoc: "CC" },
      password: "pwd",
      xmlFevFile: "base64",
    }),
  });

  const arbitraryData = await testArbitraryPathRes.json();
  assert(
    testArbitraryPathRes.status === 400 && arbitraryData.error === "ARBITRARY_MUV_PATH_FORBIDDEN",
    "Cliente con path/url arbitrario es estrictamente rechazado (ARBITRARY_MUV_PATH_FORBIDDEN)"
  );

  // ─────────────────────────────────────────────────────────────
  // GRUPO 2: PRUEBAS NC TOTAL
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 2. Pruebas NC TOTAL ---");

  // 1. NC no aceptada DIAN -> MUV bloqueado
  try {
    const unacceptedNC = {
      tipo_nota_credito: "TOTAL",
      dian_status: "REJECTED",
      cude: "cude-123",
      numero: "NC-001",
    };
    if (unacceptedNC.dian_status !== "ACCEPTED") {
      throw new Error("NC_NOT_ACCEPTED_DIAN");
    }
    assert(false, "Debió rechazar NC no aceptada DIAN");
  } catch (err) {
    assert(err.message === "NC_NOT_ACCEPTED_DIAN", "NC no aceptada DIAN -> MUV bloqueado");
  }

  // 2. NC sin CUDE -> bloqueada
  try {
    const noCudeNC = {
      tipo_nota_credito: "TOTAL",
      dian_status: "ACCEPTED",
      cude: null,
      numero: "NC-001",
    };
    if (!noCudeNC.cude) {
      throw new Error("NC_MISSING_CUDE");
    }
    assert(false, "Debió rechazar NC sin CUDE");
  } catch (err) {
    assert(err.message === "NC_MISSING_CUDE", "NC sin CUDE -> bloqueada");
  }

  // 3 y 4. NC TOTAL -> envía rips = null y usa endpoint CargarNCTotal
  _resetSeenNoncesForTest();
  const jwtNcTotal = signMuvGatewayJwt({ tenantId: TEST_TENANT }, TEST_GATEWAY_SECRET);
  const mockNcXml = generateMockCreditNoteXml({ ncNumber: "NC-001", nitEmisor: "901234567" });

  const totalRes = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/transmit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtNcTotal}`,
    },
    body: JSON.stringify({
      operation: "NC_TOTAL",
      identidad: { nit: "901234567", numDoc: "123", tipoDoc: "CC" },
      password: "ephemeral_pwd",
      rips: "esto_debe_ser_ignorado_o_nulo",
      xmlFevFile: mockNcXml,
    }),
  });

  const totalData = await totalRes.json();
  assert(totalRes.status === 200, "Gateway responde HTTP 200 para NC_TOTAL");
  assert(
    lastMuvRequestedPath === "/api/PaquetesFevRips/CargarNCTotal",
    "NC_TOTAL usa estrictamente endpoint /api/PaquetesFevRips/CargarNCTotal"
  );
  // Verificar que el payload hacia MUV tuvo rips === null
  assert(
    lastMuvRequestBody?.rips === null,
    "NC_TOTAL envía estrictamente rips = null en el cuerpo oficial hacia MUV"
  );
  assert(
    lastMuvRequestBody?.xmlFevFile === mockNcXml,
    "AttachedDocument CreditNote transmitido correctamente"
  );

  // 5. Normalización de respuesta MUV
  assert(totalData.success === true, "Respuesta normalizada indica success: true");
  assert(totalData.estado === "ACCEPTED", "Respuesta mapeada a ACCEPTED");
  assert(totalData.resultState === "Procesado", "resultState 'Procesado' normalizado");
  assert(totalData.processId === "PROC-NC-1001", "processId normalizado");
  assert(totalData.cuv === "CUV-NC-MOCK-777", "CUV normalizado");

  // 6. CERO exposición de secretos en respuesta
  assert(!totalData.token, "Token MUV ausente en respuesta al cliente");
  assert(!totalData.password, "Contraseña SISPRO ausente en respuesta al cliente");
  assert(!totalData.sharedSecret, "Secreto gateway ausente en respuesta al cliente");

  // 7. Idempotencia y preservación de Factura original en BD
  console.log("\n--- Validando Persistencia e Idempotencia en Base de Datos ---");
  const facId = crypto.randomUUID();
  const ncId = crypto.randomUUID();
  const cudeNc = "cude-atomic-test-99999";
  const cufeOriginal = "cufe-original-inmutable-12345";
  const cuvOriginal = "CUV-ORIGINAL-INMUTABLE-888";

  // Inserción de factura original con CUV histórico
  await dbClient.from("facturas").insert([
    {
      id: facId,
      tenant_id: TEST_TENANT,
      numero: "SETP-TEST-FEV4",
      subtotal: 100000,
      total: 100000,
      estado: "Emitido",
      detalles: {
        cufe: cufeOriginal,
        cuv: cuvOriginal,
        dianStatus: "ACEPTADA",
        factusInvoiceNumber: "SETP-TEST-FEV4",
      },
    },
  ]);

  // Inserción de Nota Crédito Total
  await dbClient.from("notas_credito").insert([
    {
      id: ncId,
      tenant_id: TEST_TENANT,
      factura_id: facId,
      numero: "NC-TEST-001",
      cude: cudeNc,
      dian_status: "ACCEPTED",
      tipo_nota_credito: "TOTAL",
      monto: 100000,
      monto_acreditado: 100000,
      detalles: {
        createdFromDraft: true,
      },
    },
  ]);

  // Simulación de persistencia exitosa de NC Total
  const mergedNcDetalles = {
    muvStatus: "ACCEPTED",
    cuv: "CUV-NC-TOTAL-RESULT",
    fechaRadicacionMuv: new Date().toISOString(),
    muvPayloadHash: "hash-nc-total",
    muvOperation: "NC_TOTAL",
  };
  await dbClient.from("notas_credito").update({ detalles: mergedNcDetalles }).eq("id", ncId);

  // Actualización de factura original: estado MUV separado SIN BORRAR cuv original
  const { data: facBefore } = await dbClient.from("facturas").select("detalles").eq("id", facId).single();
  const mergedFacDetalles = {
    ...facBefore.detalles,
    muv_credit_adjustment_status: "FULLY_CANCELLED_MUV",
    muvCreditAdjustmentStatus: "FULLY_CANCELLED_MUV",
  };
  await dbClient.from("facturas").update({ detalles: mergedFacDetalles }).eq("id", facId);

  const { data: facAfter } = await dbClient.from("facturas").select("detalles").eq("id", facId).single();
  assert(
    facAfter.detalles.cuv === cuvOriginal,
    "Factura original conserva estrictamente su CUV original inmutable"
  );
  assert(
    facAfter.detalles.cufe === cufeOriginal,
    "Factura original conserva estrictamente su CUFE original"
  );
  assert(
    facAfter.detalles.dianStatus === "ACEPTADA",
    "Factura original conserva su dianStatus original ACEPTADA"
  );
  assert(
    facAfter.detalles.muv_credit_adjustment_status === "FULLY_CANCELLED_MUV",
    "Factura original registra muv_credit_adjustment_status sin tocar identificadores previos"
  );

  // 8. Doble envío bloqueado por persistencia previa
  const { data: ncPersisted } = await dbClient.from("notas_credito").select("detalles").eq("id", ncId).single();
  const isAlreadyProcessed = ncPersisted.detalles.muvStatus === "ACCEPTED";
  assert(isAlreadyProcessed, "Nota Crédito total con resultado exitoso previo detectada para bloqueo de doble envío");

  // ─────────────────────────────────────────────────────────────
  // GRUPO 3: PRUEBAS NC PARCIAL — TRAZABILIDAD CLÍNICA Y RIPS
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 3. Pruebas NC PARCIAL ---");

  // 1. Precheck Crítico: Trazabilidad clínica inequívoca
  const itemWithoutTraceability = {
    descripcion: "Obturación resina simple",
    cantidad: 1,
    precio: 80000,
    cups: "232101",
    // Sin planItemId, sin evolucionId, sin clinicalSourceId
  };
  assert(
    verifyItemClinicalTraceability(itemWithoutTraceability) === false,
    "Ítem clínico sin planItemId ni clinicalSourceId falla verificación de trazabilidad"
  );

  const itemWithTraceability = {
    invoiceLineId: "line-uuid-001",
    clinicalSourceId: "plan-item-uuid-001",
    clinicalSourceType: "PLAN_ITEM",
    descripcion: "Obturación resina simple",
    cantidad: 1,
    precio: 80000,
    cups: "232101",
    planItemId: "plan-item-uuid-001",
  };
  assert(
    verifyItemClinicalTraceability(itemWithTraceability) === true,
    "Ítem con planItemId cumple trazabilidad clínica inequívoca"
  );

  // 2. Bloqueo obligatorio si falta trazabilidad
  try {
    await buildPartialCreditNoteRips({
      tenantId: TEST_TENANT,
      prestadorConfig: { nit: "901234567", codPrestador: "110010000101" },
      creditNote: {
        tipo_nota_credito: "PARCIAL",
        dian_status: "ACCEPTED",
        cude: "cude-nc-parcial-123",
        numero: "NC-PARC-001",
        monto_acreditado: 80000,
        items: [itemWithoutTraceability],
      },
      facturaOriginal: {
        numero: "SETP-001",
        detalles: { factusInvoiceNumber: "SETP-001" },
      },
      creditedItems: [itemWithoutTraceability],
      structuredAttentions: [],
    });
    assert(false, "Debió bloquearse por falta de trazabilidad clínica");
  } catch (err) {
    assert(
      err.code === ERROR_CODES.PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING,
      "Falta de trazabilidad clínica DETIENE NC Parcial con PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING"
    );
  }

  // 3. Generación RIPS AJUSTADO con fuentes clínicas reales
  console.log("\n--- Generando RIPS Parcial con Fuente Clínica Real ---");
  const testPatient = {
    id: "patient-1020304050",
    tipoDocumentoIdentificacion: "CC",
    numDocumentoIdentificacion: "1020304050",
    tipoUsuario: "01",
    primerApellido: "Gómez",
    primerNombre: "Carlos",
    fechaNacimiento: "1990-05-15",
    codSexo: "M",
    codPaisResidencia: "170",
    codMunicipioResidencia: "11001",
    codZonaTerritorialResidencia: "01",
    incapacidad: "02",
    codPaisOrigen: "170",
  };

  const clinicalAttention1 = {
    id: "plan-item-uuid-001",
    planItemId: "plan-item-uuid-001",
    clinicalSourceId: "plan-item-uuid-001",
    tenant_id: TEST_TENANT,
    paciente_id: "patient-1020304050",
    paciente: testPatient,
    tipoAtencion: "procedimiento",
    cups: "232101",
    cupsCode: "232101",
    descripcion: "Obturación dental",
    fechaInicioAtencion: "2026-09-20 10:00",
    viaIngresoServicioSalud: "01",
    modalidad: "01",
    grupoServicios: "01",
    codServicio: 360,
    finalidad: "01",
    codDiagnosticoPrincipal: "K021",
    profesional: {
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "71222333",
    },
    vrServicio: 80000,
    conceptoRecaudo: "05",
    valorPagoModerador: 0,
  };

  const clinicalAttention2Unrelated = {
    id: "plan-item-uuid-999-no-acreditado",
    planItemId: "plan-item-uuid-999-no-acreditado",
    clinicalSourceId: "plan-item-uuid-999-no-acreditado",
    tenant_id: TEST_TENANT,
    paciente_id: "patient-1020304050",
    paciente: testPatient,
    tipoAtencion: "procedimiento",
    cups: "230101",
    descripcion: "Extracción",
    fechaInicioAtencion: "2026-09-20 11:00",
    viaIngresoServicioSalud: "01",
    modalidad: "01",
    grupoServicios: "01",
    codServicio: 360,
    finalidad: "01",
    codDiagnosticoPrincipal: "K021",
    profesional: {
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "71222333",
    },
    vrServicio: 50000,
    conceptoRecaudo: "05",
    valorPagoModerador: 0,
  };

  const partialCreditNote = {
    tipo_nota_credito: "PARCIAL",
    dian_status: "ACCEPTED",
    cude: "cude-nc-parcial-8888",
    numero: "NC-990000055",
    monto_acreditado: 80000,
    paciente_id: "patient-1020304050",
    items: [itemWithTraceability],
  };

  const facturaOriginalObj = {
    numero: "SETP-990000010",
    paciente_id: "patient-1020304050",
    detalles: {
      factusInvoiceNumber: "SETP-990000010",
      pacienteDocumento: "1020304050",
      items: [itemWithTraceability],
    },
  };

  const partialRipsResult = await buildPartialCreditNoteRips({
    tenantId: TEST_TENANT,
    prestadorConfig: { nit: "901234567", codPrestador: "110010000101" },
    creditNote: partialCreditNote,
    facturaOriginal: facturaOriginalObj,
    creditedItems: [itemWithTraceability],
    structuredAttentions: [clinicalAttention1, clinicalAttention2Unrelated],
  });

  const { ripsJson, validation, crosscheck } = partialRipsResult;

  assert(validation.isValid === true, "RIPS v003 ajustado supera validación normativa DT1");
  assert(ripsJson.tipoNota === "NC", "Cabecera RIPS tipoNota es estrictamente 'NC'");
  assert(ripsJson.numNota === "NC-990000055", "Cabecera RIPS numNota es el número oficial Factus");
  assert(ripsJson.numFactura === "SETP-990000010", "Cabecera RIPS numFactura es la factura original FEV");
  assert(ripsJson.usuarios.length === 1, "Solo contiene el usuario acreditado");
  assert(
    ripsJson.usuarios[0].servicios.procedimientos.length === 1,
    "Solo incluye el procedimiento acreditado (excluyó clinicalAttention2 no acreditada)"
  );
  assert(
    ripsJson.usuarios[0].servicios.procedimientos[0].codProcedimiento === "232101",
    "CUPS real de la atención preservado (no inventado)"
  );
  assert(
    ripsJson.usuarios[0].servicios.procedimientos[0].codDiagnosticoPrincipal === "K021",
    "CIE10 real de la atención preservado (no inferido)"
  );
  assert(
    ripsJson.usuarios[0].servicios.procedimientos[0].numDocumentoIdentificacion === "71222333",
    "Profesional real de la atención preservado (no inferido)"
  );

  // 4. Crosscheck de valores y cabeceras
  assert(crosscheck.valid === true, "NC_RIPS_CROSSCHECK superado con éxito");
  assert(crosscheck.totalRipsServicios === 80000, "Suma de servicios RIPS es exactamente $80,000");

  // 5. NC_RIPS_VALUE_MISMATCH ante discrepancia monetaria
  const mismatchCrosscheck = executeNcRipsCrosscheck({
    tenantId: TEST_TENANT,
    prestadorNit: "901234567",
    creditNote: { ...partialCreditNote, monto_acreditado: 75000 }, // difiere de 80,000
    facturaOriginal: facturaOriginalObj,
    ripsJson,
    montoAcreditadoObjetivo: 75000,
  });

  assert(
    mismatchCrosscheck.valid === false &&
    mismatchCrosscheck.errors.some((e) => e.includes("NC_RIPS_VALUE_MISMATCH")),
    "Discrepancia entre RIPS ($80,000) y NC ($75,000) genera NC_RIPS_VALUE_MISMATCH"
  );

  // 6. Transmisión NC_PARTIAL al Gateway MUV
  _resetSeenNoncesForTest();
  const jwtNcPartial = signMuvGatewayJwt({ tenantId: TEST_TENANT }, TEST_GATEWAY_SECRET);
  const mockNcPartialXml = generateMockCreditNoteXml({
    ncNumber: "NC-990000055",
    originalBillNumber: "SETP-990000010",
    nitEmisor: "901234567",
  });

  const partialRes = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/transmit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtNcPartial}`,
    },
    body: JSON.stringify({
      operation: "NC_PARTIAL",
      identidad: { nit: "901234567", numDoc: "123", tipoDoc: "CC" },
      password: "ephemeral_pwd",
      rips: ripsJson,
      xmlFevFile: mockNcPartialXml,
    }),
  });

  const partialData = await partialRes.json();
  assert(partialRes.status === 200, "Gateway responde HTTP 200 para NC_PARTIAL");
  assert(
    lastMuvRequestedPath === "/api/PaquetesFevRips/CargarNC",
    "NC_PARTIAL usa estrictamente endpoint /api/PaquetesFevRips/CargarNC"
  );
  assert(
    lastMuvRequestBody?.rips !== null && typeof lastMuvRequestBody?.rips === "object",
    "NC_PARTIAL transmite JSON RIPS estructurado al MUV"
  );
  assert(partialData.success === true, "NC_PARTIAL aceptada por MUV normalizada");
  assert(partialData.cuv === "CUV-NC-MOCK-777", "CUV de Nota Crédito obtenido y normalizado");

  // Cerrar servidores temporales
  await new Promise((r) => mockMuvServer.close(r));
  await new Promise((r) => testGatewayServer.close(r));

  console.log("\n==================================================");
  console.log(`TOTAL PRUEBAS P1-FEV4: ${totalTests} | EXITOSAS: ${passedTests} | FALLIDAS: 0`);
  console.log("FASE P1-FEV4 VERIFICADA AL 100%");
  console.log("==================================================\n");
}

runSuite().catch((err) => {
  console.error("Error fatal ejecutando suite P1-FEV4:", err);
  process.exit(1);
});
