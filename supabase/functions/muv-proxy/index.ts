import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decryptInstitutionalSisproSecret,
  decryptDoctorSisproSecret,
} from "../tenant-secrets/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const DOCUMENT_TYPE = {
  INVOICE: "INVOICE",
  CREDIT_NOTE: "CREDIT_NOTE",
} as const;

export const MUV_PROXY_OPERATIONS = {
  FEV_RIPS: "FEV_RIPS",
  NC_PARTIAL: "NC_PARTIAL",
  NC_TOTAL: "NC_TOTAL",
} as const;

class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Calcula hash SHA-256 en formato hexadecimal.
 */
async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Firma JWT HMAC-SHA256 (HS256) interno para muv-gateway (TTL = 60s).
 */
async function createMuvGatewayToken(claims: Record<string, unknown>, secretStr: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "odontocloud-muv-proxy",
    aud: "odontocloud-muv-gateway",
    iat: nowSec,
    exp: nowSec + 60, // TTL estricto de 60 segundos
    nonce: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    ...claims,
  };

  const toB64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const b64Header = toB64Url({ alg: "HS256", typ: "JWT" });
  const b64Payload = toB64Url(payload);
  const data = `${b64Header}.${b64Payload}`;

  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${data}.${b64Sig}`;
}

/**
 * Descarga el AttachedDocument on-demand desde Factus API (Factura o Nota Crédito).
 * DOWNLOAD_ON_DEMAND: No persiste el XML completo en Base de Datos.
 */
async function fetchAttachedDocumentOnDemand(
  factusConfig: any,
  documentNumber: string,
  documentType: "INVOICE" | "CREDIT_NOTE" = "INVOICE"
): Promise<string> {
  const isSandbox = factusConfig.factusTestMode !== false;
  const baseUrl = isSandbox ? "https://api-sandbox.factus.com.co" : "https://api.factus.com.co";

  // Obtener OAuth token de Factus
  const tokenParams = new URLSearchParams({
    grant_type: "password",
    client_id: factusConfig.factusClientId,
    client_secret: factusConfig.factusClientSecret,
    username: factusConfig.factusUsername,
    password: factusConfig.factusPassword,
  });

  const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new HttpError(
      502,
      `Error autenticando con Factus API: ${tokenData.error_description || tokenData.message || tokenRes.status}`
    );
  }

  // Endpoint oficial según DOCUMENT_TYPE
  const endpointPath = documentType === "CREDIT_NOTE"
    ? `/v2/credit-notes/${encodeURIComponent(documentNumber)}/download-attached-document-xml`
    : `/v2/bills/${encodeURIComponent(documentNumber)}/download-attached-document-xml`;

  const docRes = await fetch(`${baseUrl}${endpointPath}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const docData = await docRes.json().catch(() => ({}));
  if (!docRes.ok) {
    throw new HttpError(
      502,
      `Error descargando AttachedDocument de Factus (${documentType}): ${docData.message || docRes.status}`
    );
  }

  const rawBase64 = docData?.data?.xml_base_64_encoded || docData?.xml_base_64_encoded || docData?.data?.file || "";
  if (!rawBase64) {
    throw new HttpError(502, `Factus no retornó el XML del AttachedDocument para ${documentType}.`);
  }

  return rawBase64;
}

/**
 * Ejecuta validación de estructura XML para AttachedDocument (soporta Invoice y CreditNote).
 */
function validateAttachedDocumentXmlStructure(xmlBase64: string, expectedDocType: "INVOICE" | "CREDIT_NOTE" = "INVOICE") {
  let xmlText = "";
  try {
    xmlText = atob(xmlBase64);
  } catch {
    throw new HttpError(400, "AttachedDocument no es un Base64 decodificable.");
  }

  if (!xmlText.includes("AttachedDocument")) {
    throw new HttpError(400, "El archivo descargado no es un contenedor AttachedDocument válido.");
  }

  if (expectedDocType === "CREDIT_NOTE") {
    if (!xmlText.includes("CreditNote")) {
      throw new HttpError(400, "El contenedor AttachedDocument no contiene una CreditNote válida.");
    }
  } else {
    if (!xmlText.includes("Invoice")) {
      throw new HttpError(400, "El contenedor AttachedDocument no contiene una Invoice válida.");
    }
  }

  // Extraer UUID (CUFE / CUDE)
  const uuidMatch = xmlText.match(/<cbc:UUID[^>]*>([a-f0-9]{64,128})<\/cbc:UUID>/i) ||
                    xmlText.match(/<UUID[^>]*>([a-f0-9]{64,128})<\/UUID>/i);
  const xmlUuid = uuidMatch ? uuidMatch[1].trim() : null;

  // Extraer NIT Emisor
  const nitMatch = xmlText.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:CompanyID[^>]*>([0-9]+)<\/cbc:CompanyID>/i) ||
                   xmlText.match(/<cbc:CompanyID[^>]*>([0-9]+)<\/cbc:CompanyID>/i);
  const xmlNit = nitMatch ? nitMatch[1].trim() : null;

  return {
    xmlText,
    xmlUuid,
    xmlNit,
  };
}

/**
 * Ejecuta FEV_RIPS_CROSSCHECK para Facturas en memoria.
 */
function performFevRipsCrosscheck(xmlBase64: string, ripsJson: any, prestadorNit: string) {
  const { xmlUuid, xmlNit } = validateAttachedDocumentXmlStructure(xmlBase64, "INVOICE");
  const ripsNit = String(ripsJson?.numDocumentoIdObligado || "").trim();

  const errors: string[] = [];
  if (xmlNit && prestadorNit && xmlNit !== prestadorNit) {
    errors.push(`RVC001_MISMATCH: NIT de la factura (${xmlNit}) no coincide con el NIT del prestador (${prestadorNit}).`);
  }
  if (xmlNit && ripsNit && xmlNit !== ripsNit) {
    errors.push(`RVG06_MISMATCH: NIT del XML (${xmlNit}) no coincide con el NIT del RIPS (${ripsNit}).`);
  }

  return {
    valid: errors.length === 0,
    xmlCufe: xmlUuid,
    xmlNit,
    errors,
  };
}

/**
 * Ejecuta NC_RIPS_CROSSCHECK para Notas Crédito Parciales.
 */
function performNcRipsCrosscheck({
  xmlBase64,
  ripsJson,
  prestadorNit,
  nc,
  factura,
}: {
  xmlBase64: string;
  ripsJson: any;
  prestadorNit: string;
  nc: any;
  factura: any;
}) {
  const { xmlUuid, xmlNit } = validateAttachedDocumentXmlStructure(xmlBase64, "CREDIT_NOTE");
  const errors: string[] = [];

  const cleanPrestadorNit = String(prestadorNit || "").replace(/\D/g, "");
  const ripsNit = String(ripsJson?.numDocumentoIdObligado || "").replace(/\D/g, "");

  // 1. NIT emisor NC vs Prestador vs RIPS
  if (xmlNit && cleanPrestadorNit && xmlNit !== cleanPrestadorNit) {
    errors.push(`NC_NIT_MISMATCH: NIT del XML de la Nota Crédito (${xmlNit}) no coincide con el prestador (${cleanPrestadorNit}).`);
  }
  if (cleanPrestadorNit && ripsNit && cleanPrestadorNit !== ripsNit) {
    errors.push(`NC_RIPS_NIT_MISMATCH: NIT del RIPS (${ripsNit}) no coincide con el prestador (${cleanPrestadorNit}).`);
  }

  // 2. Número de Factura Original en RIPS
  const facOriginalNum = String(
    factura?.detalles?.factusInvoiceNumber ||
    factura?.detalles?.bill_number ||
    factura?.numero ||
    ""
  ).trim();

  const ripsFacNum = String(ripsJson?.numFactura || "").trim();
  if (!ripsFacNum || ripsFacNum !== facOriginalNum) {
    errors.push(
      `NUM_FACTURA_MISMATCH: RIPS numFactura (${ripsFacNum}) debe ser exactamente el número de factura original (${facOriginalNum}).`
    );
  }

  // 3. tipoNota debe ser estrictamente "NC"
  if (ripsJson?.tipoNota !== "NC") {
    errors.push(`TIPO_NOTA_INVALID: tipoNota en RIPS debe ser 'NC' (actual: '${ripsJson?.tipoNota}').`);
  }

  // 4. numNota debe coincidir con el número oficial de la NC Factus/DIAN
  const ncOfficialNum = String(nc?.numero || "").trim();
  const ripsNumNota = String(ripsJson?.numNota || "").trim();
  if (!ripsNumNota || ripsNumNota !== ncOfficialNum) {
    errors.push(
      `NUM_NOTA_MISMATCH: RIPS numNota (${ripsNumNota}) debe coincidir con el número oficial de la Nota Crédito (${ncOfficialNum}).`
    );
  }

  // 5. CUDE
  if (!nc?.cude) {
    errors.push("CUDE_REQUIRED: La Nota Crédito no posee CUDE fiscal emitido.");
  }

  // 6. Precheck de Trazabilidad Clínica Inequívoca en ítems acreditados
  const ncItems = Array.isArray(nc?.items) ? nc.items : [];
  for (const it of ncItems) {
    const stableId =
      it.planItemId ||
      it.plan_item_id ||
      it.clinicalSourceId ||
      it.clinical_source_id ||
      it.evolucionId ||
      it.evolucion_id ||
      it.atencionId ||
      it.atencion_id ||
      it.documentoClinicoId ||
      it.documento_clinico_id ||
      it.invoiceLineId ||
      it.invoice_line_id ||
      (it.planId && it.id && it.id !== it.planId ? it.id : null);

    if (!stableId) {
      errors.push(
        `PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING: El ítem acreditado '${it.descripcion || it.nombre || "Servicio"}' no tiene un identificador clínico inequívoco persistido.`
      );
    }
  }

  // 7. Validación de Valores Monetarios (NC_RIPS_VALUE_MISMATCH)
  let totalRipsServicios = 0;
  const usuarios = Array.isArray(ripsJson?.usuarios) ? ripsJson.usuarios : [];
  for (const u of usuarios) {
    const servicios = u?.servicios || {};
    const consultas = Array.isArray(servicios.consultas) ? servicios.consultas : [];
    const procedimientos = Array.isArray(servicios.procedimientos) ? servicios.procedimientos : [];
    const otros = Array.isArray(servicios.otrosServicios) ? servicios.otrosServicios : [];

    for (const c of consultas) totalRipsServicios += Number(c.vrServicio || 0);
    for (const p of procedimientos) totalRipsServicios += Number(p.vrServicio || 0);
    for (const o of otros) {
      const q = Number(o.cantidadOS || 1);
      const v = Number(o.vrUnitOS || 0);
      totalRipsServicios += q * v;
    }
  }

  const targetMonto = Number(nc?.monto_acreditado || nc?.monto || 0);
  const diff = Math.abs(Math.round(totalRipsServicios * 100) - Math.round(targetMonto * 100)) / 100;
  if (diff > 0.05) {
    errors.push(
      `NC_RIPS_VALUE_MISMATCH: La suma de servicios del RIPS ajustado ($${totalRipsServicios}) no coincide con el valor acreditado en la NC ($${targetMonto}).`
    );
  }

  return {
    valid: errors.length === 0,
    xmlCude: xmlUuid,
    errors,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  let adminClient: any = null;
  let validationId: string | null = null;
  let computedIdempotencyKey: string | null = null;
  let cleanTenantId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gatewaySharedSecret = Deno.env.get("MUV_GATEWAY_SHARED_SECRET");
    const gatewayUrl = Deno.env.get("MUV_GATEWAY_URL") || "https://muv-gateway.odontocloud.internal:443";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError(500, "Configuración interna de Supabase incompleta.");
    }
    if (!gatewaySharedSecret) {
      throw new HttpError(500, "MUV_GATEWAY_SHARED_SECRET no está configurado en el servidor.");
    }

    // 1. Validar JWT de sesión del usuario OdontoCloud
    const authHeader = request.headers.get("Authorization");
    const userToken = authHeader?.replace(/^Bearer\s+/i, "");
    if (!userToken) throw new HttpError(401, "Debes iniciar sesión.");

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await adminClient.auth.getUser(userToken);
    if (authError || !authData.user) throw new HttpError(401, "Sesión no válida o expirada.");

    // 2. Obtener tenant y perfil autorizado
    const { data: profile, error: profError } = await adminClient
      .from("profiles")
      .select("tenant_id, role, activo")
      .eq("id", authData.user.id)
      .single();

    if (profError || !profile || profile.activo === false || !profile.tenant_id) {
      throw new HttpError(403, "Perfil no autorizado para transmitir RIPS o Notas Crédito.");
    }

    const role = String(profile.role || "").trim().toLowerCase();
    const isSuperadmin = role === "superadmin";
    const isAllowedRole = isSuperadmin || ["admin", "administrador", "facturador", "doctor", "odontologo"].includes(role);
    if (!isAllowedRole) {
      throw new HttpError(403, "Rol de usuario sin privilegios para transmisión MUV.");
    }

    const body = await request.json();
    const { facturaId, creditNoteId, ripsJson, doctorIdOverride } = body || {};

    const tenantId = isSuperadmin && body?.tenantId ? String(body.tenantId) : String(profile.tenant_id);
    cleanTenantId = tenantId;

    // ─────────────────────────────────────────────────────────────────────────────
    // RAMA A: TRANSMISIÓN DE NOTA CRÉDITO (TOTAL O PARCIAL)
    // ─────────────────────────────────────────────────────────────────────────────
    if (creditNoteId) {
      // 1. Cargar Nota Crédito autoritativa
      const { data: nc, error: ncErr } = await adminClient
        .from("notas_credito")
        .select("*, facturas(*)")
        .eq("id", creditNoteId)
        .eq("tenant_id", tenantId)
        .single();

      if (ncErr || !nc) {
        throw new HttpError(404, "Nota Crédito no encontrada para este tenant.");
      }

      if (nc.dian_status !== "ACCEPTED" && nc.dian_status !== "SIMULADA") {
        throw new HttpError(400, "La Nota Crédito debe estar ACEPTADA ante la DIAN antes de transmitir al MUV.");
      }

      if (!nc.cude) {
        throw new HttpError(400, "La Nota Crédito no posee CUDE fiscal registrado.");
      }

      if (!nc.numero) {
        throw new HttpError(400, "La Nota Crédito no posee número oficial asignado por Factus.");
      }

      const facturaOriginal = nc.facturas;
      if (!facturaOriginal) {
        throw new HttpError(400, "Factura original asociada a la Nota Crédito no encontrada.");
      }

      const isTotal = String(nc.tipo_nota_credito || "").toUpperCase() === "TOTAL";
      const operation = isTotal ? MUV_PROXY_OPERATIONS.NC_TOTAL : MUV_PROXY_OPERATIONS.NC_PARTIAL;

      // 2. Calcular payload_hash e idempotency_key
      const payloadHash = operation === MUV_PROXY_OPERATIONS.NC_TOTAL
        ? "NULL_RIPS"
        : await sha256Hex(JSON.stringify(ripsJson || nc.items || {}));

      computedIdempotencyKey = await sha256Hex(`${tenantId}::${nc.id}::${nc.cude}::${payloadHash}::${operation}`);

      // 3. Verificar si ya fue formalmente aceptada por MUV
      const ncDetalles = nc.detalles || {};
      if (ncDetalles.muvStatus === "ACCEPTED" && (ncDetalles.cuv || isTotal)) {
        return json({
          success: true,
          estado: "ALREADY_VALIDATED_WITH_CUV",
          message: `Esta Nota Crédito (${operation}) ya fue transmitida y validada por MUV.`,
          cuv: ncDetalles.cuv || ncDetalles.processId || "MUV_ACCEPTED",
          operation,
        });
      }

      // 4. Adquisición ATÓMICA en PostgreSQL
      const { data: lockRow, error: lockError } = await adminClient
        .from("rips_validaciones")
        .insert([{
          tenant_id: tenantId,
          factura_id: facturaOriginal.id,
          tipo_documento: operation,
          documento_id: nc.numero,
          esquema_version: "DT1-v003-2026",
          estado: "PENDIENTE",
          cufe: nc.cude,
          idempotency_key: computedIdempotencyKey,
          payload_hash: payloadHash,
          payload_resumen: {
            muv_status: "VALIDATING",
            operation,
            nota_credito_id: nc.id,
            started_at: new Date().toISOString(),
            userId: authData.user.id,
          },
          creado_por: authData.user.id,
        }])
        .select("id")
        .single();

      if (lockError) {
        if (lockError.code === "23505" || lockError.message?.includes("uq_rips_validaciones")) {
          const { data: currentVal } = await adminClient
            .from("rips_validaciones")
            .select("id, estado, cuv")
            .eq("tenant_id", tenantId)
            .eq("idempotency_key", computedIdempotencyKey)
            .maybeSingle();

          if (currentVal?.cuv || currentVal?.estado === "VALIDADO") {
            return json({
              success: true,
              estado: "ALREADY_VALIDATED_WITH_CUV",
              message: "Esta Nota Crédito ya fue validada con CUV.",
              cuv: currentVal.cuv,
              operation,
            });
          }

          return json({
            success: false,
            estado: "VALIDATION_ALREADY_IN_PROGRESS",
            error: "VALIDATION_ALREADY_IN_PROGRESS",
            message: "Existe una transmisión en progreso al MUV para esta Nota Crédito.",
          }, 409);
        }
        throw lockError;
      }

      validationId = lockRow.id;

      // 5. Resolver secretos SISPRO del prestador
      const { data: secRow, error: secErr } = await adminClient
        .from("tenant_secrets")
        .select("sispro_config, factus_config")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (secErr || !secRow?.sispro_config) {
        throw new HttpError(400, "Configuración SISPRO no encontrada para esta clínica.");
      }

      const sisproCfg = secRow.sispro_config;
      const factusCfg = secRow.factus_config || {};

      let sisproPassword = "";
      let identidad: any = {};

      const doctorId = doctorIdOverride || facturaOriginal?.doctorId;
      if (doctorId && sisproCfg.doctores?.[doctorId]?.sisproPasswordEncrypted) {
        const envelope = sisproCfg.doctores[doctorId].sisproPasswordEncrypted;
        sisproPassword = await decryptDoctorSisproSecret(tenantId, doctorId, envelope);
        identidad = {
          tipoDoc: sisproCfg.doctores[doctorId].tipoDoc || "CC",
          numDoc: sisproCfg.doctores[doctorId].documento || sisproCfg.sisproUsuario,
          nit: String(facturaOriginal?.nitEmisor || sisproCfg.sisproUsuario).replace(/\D/g, ""),
          tipoUsuario: "PIN",
        };
      } else {
        const envelope = sisproCfg.sisproPasswordEncrypted || sisproCfg.sisproPassword;
        sisproPassword = await decryptInstitutionalSisproSecret(tenantId, envelope);
        const isPin = String(sisproCfg.tipoUsuario || "PIN").toUpperCase() === "PIN";
        identidad = {
          tipoDoc: sisproCfg.sisproTipoDoc || "CC",
          numDoc: sisproCfg.sisproUsuario,
          nit: String(sisproCfg.nit || sisproCfg.sisproUsuario).replace(/\D/g, ""),
          tipoUsuario: isPin ? "PIN" : "RE",
        };
      }

      if (!sisproPassword) {
        throw new HttpError(400, "No se pudo recuperar la contraseña SISPRO configurada.");
      }

      // 6. Descargar AttachedDocument CreditNote on-demand desde Factus
      let attachedDocumentBase64 = "";
      if (body?.xmlFevBase64) {
        attachedDocumentBase64 = body.xmlFevBase64;
      } else {
        attachedDocumentBase64 = await fetchAttachedDocumentOnDemand(factusCfg, nc.numero, "CREDIT_NOTE");
      }

      // 7. Ejecutar Crosscheck específico
      if (operation === MUV_PROXY_OPERATIONS.NC_TOTAL) {
        // Estructura XML CreditNote
        const xmlCheck = validateAttachedDocumentXmlStructure(attachedDocumentBase64, "CREDIT_NOTE");
        if (xmlCheck.xmlNit && identidad.nit && xmlCheck.xmlNit !== identidad.nit) {
          throw new HttpError(422, `NIT de la Nota Crédito (${xmlCheck.xmlNit}) no coincide con el prestador (${identidad.nit}).`);
        }
      } else {
        // NC Parcial: NC_RIPS_CROSSCHECK
        if (!ripsJson) {
          throw new HttpError(400, "Para Nota Crédito Parcial el campo 'ripsJson' es obligatorio.");
        }
        const crosscheck = performNcRipsCrosscheck({
          xmlBase64: attachedDocumentBase64,
          ripsJson,
          prestadorNit: identidad.nit,
          nc,
          factura: facturaOriginal,
        });

        if (!crosscheck.valid) {
          await adminClient.from("rips_validaciones").update({
            estado: "RECHAZADO",
            errores: crosscheck.errors,
            idempotency_key: null,
            payload_resumen: { muv_status: "REJECTED_CROSSCHECK", crosscheckErrors: crosscheck.errors },
            updated_at: new Date().toISOString(),
          }).eq("id", validationId);

          return json({
            success: false,
            estado: "REJECTED",
            error: "NC_RIPS_CROSSCHECK_FAILED",
            errors: crosscheck.errors,
          }, 422);
        }
      }

      // 8. Generar JWT interno para gateway
      const internalJwt = await createMuvGatewayToken({
        tenantId,
        userId: authData.user.id,
        creditNoteId: nc.numero,
        operation,
        cude: nc.cude,
      }, gatewaySharedSecret);

      // 9. Transmitir a muv-gateway con enum fijo
      const gatewayPayload = {
        operation, // "NC_TOTAL" | "NC_PARTIAL"
        identidad,
        password: sisproPassword,
        rips: operation === MUV_PROXY_OPERATIONS.NC_TOTAL ? null : ripsJson,
        xmlFevFile: attachedDocumentBase64,
      };

      sisproPassword = ""; // Destruir referencia en memoria

      const gatewayRes = await fetch(`${gatewayUrl}/api/v1/transmit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalJwt}`,
        },
        body: JSON.stringify(gatewayPayload),
      });

      const gatewayData = await gatewayRes.json().catch(() => ({}));
      const isAccepted = Boolean(gatewayData.success);

      // 10. Persistir resultado en rips_validaciones
      await adminClient.from("rips_validaciones").update({
        estado: isAccepted ? "VALIDADO" : "RECHAZADO",
        cuv: gatewayData.cuv || null,
        errores: gatewayData.errores || [],
        advertencias: gatewayData.advertencias || [],
        idempotency_key: isAccepted ? computedIdempotencyKey : null,
        payload_resumen: {
          muv_status: isAccepted ? "ACCEPTED" : "REJECTED",
          operation,
          fechaRadicacion: gatewayData.fechaRadicacion || null,
          httpStatus: gatewayData.httpStatus || gatewayRes.status,
          processId: gatewayData.processId || null,
          requestId: gatewayData.requestId || null,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", validationId);

      // 11. Persistir en public.notas_credito.detalles
      if (isAccepted) {
        const mergedNcDetalles = {
          ...ncDetalles,
          muvStatus: "ACCEPTED",
          cuv: gatewayData.cuv || null,
          fechaRadicacionMuv: gatewayData.fechaRadicacion || new Date().toISOString(),
          muvPayloadHash: payloadHash,
          muvOperation: operation,
          muvProcessId: gatewayData.processId || null,
        };

        await adminClient
          .from("notas_credito")
          .update({ detalles: mergedNcDetalles })
          .eq("id", nc.id);

        // 12. Actualizar resumen en facturas.detalles SIN BORRAR CUV original de la factura
        const facDetalles = facturaOriginal.detalles || {};
        const mergedFacDetalles = {
          ...facDetalles,
          muv_credit_adjustment_status: operation === MUV_PROXY_OPERATIONS.NC_TOTAL ? "FULLY_CANCELLED_MUV" : "PARTIALLY_ADJUSTED_MUV",
          muvCreditAdjustmentStatus: operation === MUV_PROXY_OPERATIONS.NC_TOTAL ? "FULLY_CANCELLED_MUV" : "PARTIALLY_ADJUSTED_MUV",
        };

        await adminClient
          .from("facturas")
          .update({ detalles: mergedFacDetalles })
          .eq("id", facturaOriginal.id);
      }

      return json({
        success: isAccepted,
        estado: isAccepted ? "ACCEPTED" : "REJECTED",
        operation,
        cuv: gatewayData.cuv || null,
        fechaRadicacion: gatewayData.fechaRadicacion || null,
        processId: gatewayData.processId || null,
        errores: gatewayData.errores || [],
        advertencias: gatewayData.advertencias || [],
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RAMA B: TRANSMISIÓN DE FACTURA ELECTRÓNICA INICIAL (FEV_RIPS)
    // ─────────────────────────────────────────────────────────────────────────────
    if (!facturaId || !ripsJson) {
      throw new HttpError(400, "Parámetros obligatorios: facturaId, ripsJson (o creditNoteId para notas crédito).");
    }

    // 3. Validar pertenencia de la factura al tenant
    const { data: factura, error: facError } = await adminClient
      .from("facturas")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`id.eq.${facturaId},numero.eq.${facturaId}`)
      .maybeSingle();

    let facturaDetalles = factura?.detalles;
    if (typeof facturaDetalles === "string") {
      try {
        facturaDetalles = JSON.parse(facturaDetalles);
      } catch {
        facturaDetalles = {};
      }
    } else if (!facturaDetalles || typeof facturaDetalles !== "object") {
      facturaDetalles = {};
    }

    const facturaNumber = factura?.numero || facturaDetalles?.factusInvoiceNumber || factura?.id || facturaId;
    const cufe = facturaDetalles?.cufe || factura?.cufe || ripsJson?.numFactura || facturaNumber;

    // 4. Calcular payload_hash e idempotency_key
    const payloadHash = await sha256Hex(JSON.stringify(ripsJson));
    computedIdempotencyKey = await sha256Hex(`${tenantId}::${facturaNumber}::${cufe}::${payloadHash}`);

    // 5. Verificar si la factura ya está formalmente aceptada con CUV
    const { data: existingValidated } = await adminClient
      .from("rips_validaciones")
      .select("id, cuv, estado")
      .eq("tenant_id", tenantId)
      .eq("factura_id", factura?.id || null)
      .in("estado", ["VALIDADO", "valido"])
      .not("cuv", "is", null)
      .maybeSingle();

    if (existingValidated) {
      return json({
        success: true,
        estado: "ALREADY_VALIDATED_WITH_CUV",
        message: "Esta factura ya fue formalmente transmitida y validada por MUV con CUV emitido.",
        cuv: existingValidated.cuv,
      });
    }

    // 6. Adquisición ATÓMICA en PostgreSQL
    const { data: lockRow, error: lockError } = await adminClient
      .from("rips_validaciones")
      .insert([{
        tenant_id: tenantId,
        factura_id: factura?.id || null,
        tipo_documento: "FV",
        documento_id: facturaNumber,
        esquema_version: "DT1-v003-2026",
        estado: "PENDIENTE",
        cufe,
        idempotency_key: computedIdempotencyKey,
        payload_hash: payloadHash,
        payload_resumen: {
          muv_status: "VALIDATING",
          started_at: new Date().toISOString(),
          userId: authData.user.id,
        },
        creado_por: authData.user.id,
      }])
      .select("id")
      .single();

    if (lockError) {
      if (lockError.code === "23505" || lockError.message?.includes("uq_rips_validaciones")) {
        const { data: currentVal } = await adminClient
          .from("rips_validaciones")
          .select("id, estado, cuv")
          .eq("tenant_id", tenantId)
          .eq("idempotency_key", computedIdempotencyKey)
          .maybeSingle();

        if (currentVal?.cuv) {
          return json({
            success: true,
            estado: "ALREADY_VALIDATED_WITH_CUV",
            message: "Esta factura ya fue validada con CUV.",
            cuv: currentVal.cuv,
          });
        }

        return json({
          success: false,
          estado: "VALIDATION_ALREADY_IN_PROGRESS",
          error: "VALIDATION_ALREADY_IN_PROGRESS",
          message: "Existe una transmisión en progreso al MUV para este paquete. Espere el resultado.",
        }, 409);
      }
      throw lockError;
    }

    validationId = lockRow.id;

    // 7. Resolver secretos y configuración del prestador
    const { data: secRow, error: secErr } = await adminClient
      .from("tenant_secrets")
      .select("sispro_config, factus_config")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (secErr || !secRow?.sispro_config) {
      throw new HttpError(400, "Configuración SISPRO no encontrada para esta clínica.");
    }

    const sisproCfg = secRow.sispro_config;
    const factusCfg = secRow.factus_config || {};

    let sisproPassword = "";
    let identidad: any = {};

    const doctorId = doctorIdOverride || factura?.doctorId;
    if (doctorId && sisproCfg.doctores?.[doctorId]?.sisproPasswordEncrypted) {
      const envelope = sisproCfg.doctores[doctorId].sisproPasswordEncrypted;
      sisproPassword = await decryptDoctorSisproSecret(tenantId, doctorId, envelope);
      identidad = {
        tipoDoc: sisproCfg.doctores[doctorId].tipoDoc || "CC",
        numDoc: sisproCfg.doctores[doctorId].documento || sisproCfg.sisproUsuario,
        nit: String(factura?.nitEmisor || sisproCfg.sisproUsuario).replace(/\D/g, ""),
        tipoUsuario: "PIN",
      };
    } else {
      const envelope = sisproCfg.sisproPasswordEncrypted || sisproCfg.sisproPassword;
      sisproPassword = await decryptInstitutionalSisproSecret(tenantId, envelope);
      const isPin = String(sisproCfg.tipoUsuario || "PIN").toUpperCase() === "PIN";
      identidad = {
        tipoDoc: sisproCfg.sisproTipoDoc || "CC",
        numDoc: sisproCfg.sisproUsuario,
        nit: String(sisproCfg.nit || sisproCfg.sisproUsuario).replace(/\D/g, ""),
        tipoUsuario: isPin ? "PIN" : "RE",
      };
    }

    if (!sisproPassword) {
      throw new HttpError(400, "No se pudo recuperar la contraseña SISPRO configurada.");
    }

    // 8. Descargar AttachedDocument Invoice on-demand desde Factus
    let attachedDocumentBase64 = "";
    if (body?.xmlFevBase64) {
      attachedDocumentBase64 = body.xmlFevBase64;
    } else {
      attachedDocumentBase64 = await fetchAttachedDocumentOnDemand(factusCfg, facturaNumber, "INVOICE");
    }

    // 9. Ejecutar FEV_RIPS_CROSSCHECK en memoria
    const crosscheck = performFevRipsCrosscheck(attachedDocumentBase64, ripsJson, identidad.nit);
    if (!crosscheck.valid) {
      await adminClient.from("rips_validaciones").update({
        estado: "RECHAZADO",
        errores: crosscheck.errors,
        idempotency_key: null,
        payload_resumen: { muv_status: "REJECTED_CROSSCHECK", crosscheckErrors: crosscheck.errors },
        updated_at: new Date().toISOString(),
      }).eq("id", validationId);

      return json({
        success: false,
        estado: "REJECTED",
        error: "FEV_RIPS_CROSSCHECK_FAILED",
        errors: crosscheck.errors,
      }, 422);
    }

    // 10. Generar JWT interno para gateway
    const internalJwt = await createMuvGatewayToken({
      tenantId,
      userId: authData.user.id,
      facturaId: facturaNumber,
      cufe,
      operation: "FEV_RIPS",
    }, gatewaySharedSecret);

    // 11. Transmitir a muv-gateway
    const gatewayPayload = {
      operation: "FEV_RIPS",
      identidad,
      password: sisproPassword,
      rips: ripsJson,
      xmlFevFile: attachedDocumentBase64,
    };

    sisproPassword = "";

    const gatewayRes = await fetch(`${gatewayUrl}/api/v1/transmit-fev-rips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${internalJwt}`,
      },
      body: JSON.stringify(gatewayPayload),
    });

    const gatewayData = await gatewayRes.json().catch(() => ({}));
    const isAccepted = Boolean(gatewayData.success && gatewayData.cuv);

    await adminClient.from("rips_validaciones").update({
      estado: isAccepted ? "VALIDADO" : "RECHAZADO",
      cuv: gatewayData.cuv || null,
      errores: gatewayData.errores || [],
      advertencias: gatewayData.advertencias || [],
      idempotency_key: isAccepted ? computedIdempotencyKey : null,
      payload_resumen: {
        muv_status: isAccepted ? "ACCEPTED" : "REJECTED",
        fechaRadicacion: gatewayData.fechaRadicacion || null,
        httpStatus: gatewayData.httpStatus || gatewayRes.status,
        requestId: gatewayData.requestId || null,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", validationId);

    if (isAccepted && factura?.id) {
      const mergedDetalles = {
        ...facturaDetalles,
        cuv: gatewayData.cuv,
        muvStatus: "ACCEPTED",
        fechaRadicacionMuv: gatewayData.fechaRadicacion || new Date().toISOString(),
      };
      await adminClient.from("facturas").update({
        detalles: mergedDetalles,
        updated_at: new Date().toISOString(),
      }).eq("id", factura.id);
    }

    return json({
      success: isAccepted,
      estado: isAccepted ? "ACCEPTED" : "REJECTED",
      cuv: gatewayData.cuv || null,
      fechaRadicacion: gatewayData.fechaRadicacion || null,
      errores: gatewayData.errores || [],
      advertencias: gatewayData.advertencias || [],
    });

  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Error interno en transmisión MUV.";

    if (adminClient && validationId) {
      try {
        await adminClient.from("rips_validaciones").update({
          estado: "ERROR",
          errores: [{ error: message }],
          idempotency_key: null,
          payload_resumen: { muv_status: "ERROR", errorMessage: message },
          updated_at: new Date().toISOString(),
        }).eq("id", validationId);
      } catch (_) {}
    }

    return json({
      success: false,
      estado: "ERROR",
      error: err.code || "MUV_PROXY_ERROR",
      message,
    }, status);
  }
});
