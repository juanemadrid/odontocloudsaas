import {
  downloadFactusPdf,
  downloadFactusAttachedDocumentXml,
  downloadFactusSupportDocumentPdf,
  getFactusRanges,
  getFactusStatus,
  sendFactusBill,
  sendFactusSupportDocument,
  sendFactusAdjustmentNote,
  testFactusCredentials,
  sendFactusCreditNote,
  checkFactusCreditNote,
  deleteUnvalidatedFactusCreditNote,
  downloadFactusCreditNoteXml,
  downloadFactusCreditNotePdf,
} from "./factusProxyService.js";
import {
  buildFactusHealthInvoicePayload,
  isFacturaSectorSalud,
} from "./factusHealthPayloadBuilder.js";
import { calculateNIT_DV } from "../utils/dian/dianHelpers.js";

/**
 * factusService.js
 * Robust Factus electronic invoicing service for OdontoCloud.
 * Credentials are loaded from the secure backend at runtime — never from VITE_ env.
 */

// ─────────────────────────────────────────────
// Colombian municipality DANE codes (top 40+)
// ─────────────────────────────────────────────
const MUNICIPALITY_CODES = {
  "bogotá": "11001",
  "bogota": "11001",
  "bogotá d.c.": "11001",
  "bogota d.c.": "11001",
  "medellín": "05001",
  "medellin": "05001",
  "cali": "76001",
  "barranquilla": "08001",
  "cartagena": "13001",
  "cúcuta": "54001",
  "cucuta": "54001",
  "bucaramanga": "68001",
  "pereira": "66001",
  "manizales": "17001",
  "ibagué": "73001",
  "ibague": "73001",
  "santa marta": "47001",
  "villavicencio": "50001",
  "pasto": "52001",
  "montería": "23001",
  "monteria": "23001",
  "neiva": "41001",
  "armenia": "63001",
  "sincelejo": "70001",
  "popayán": "19001",
  "popayan": "19001",
  "valledupar": "20001",
  "tunja": "15001",
  "florencia": "18001",
  "quibdó": "27001",
  "quibdo": "27001",
  "riohacha": "44001",
  "arauca": "81001",
  "yopal": "85001",
  "leticia": "91001",
  "mitú": "97001",
  "mitu": "97001",
  "puerto carreño": "99001",
  "puerto carreno": "99001",
  "inírida": "94001",
  "inirida": "94001",
  "san josé del guaviare": "95001",
  "san jose del guaviare": "95001",
  "bello": "05088",
  "itagüí": "05360",
  "itagui": "05360",
  "envigado": "05266",
  "soledad": "08573",
  "soacha": "25754",
  "dosquebradas": "66170",
  "floridablanca": "68276",
  "buenaventura": "76109",
  "palmira": "76520",
  "buga": "76111",
  "girardot": "25307",
  "chía": "25175",
  "chia": "25175",
  "zipaquirá": "25899",
  "zipaquira": "25899",
  "facatativá": "25269",
  "facatativa": "25269",
  "mosquera": "25473",
  "funza": "25286",
  "cajicá": "25126",
  "cajica": "25126",
};

export const getMunicipalityCode = (cityName) => {
  if (!cityName) return "11001";
  const key = cityName.toLowerCase().trim();
  const code = MUNICIPALITY_CODES[key];
  // Return found code, or null to signal "not found" — callers decide the fallback
  return code || null;
};

// ─────────────────────────────────────────────
// Document type codes (DIAN)
// ─────────────────────────────────────────────
const DOCUMENT_TYPE_CODES = {
  CC: "13",
  NIT: "31",
  CE: "22",
  PA: "41",
  TI: "12",
  RC: "11",
  DE: "21",
  CD: "22",
  PEP: "47",
};

export const getDocTypeCode = (tipoDocumento) => {
  if (!tipoDocumento) return "13";
  return DOCUMENT_TYPE_CODES[tipoDocumento.toUpperCase()] || "13";
};

// ─────────────────────────────────────────────
// 1. getToken — cached OAuth2 token
// ─────────────────────────────────────────────
export const getToken = async () => {
  const status = await getFactusStatus();
  if (!status.configured) {
    throw new Error("La clínica no tiene credenciales Factus configuradas.");
  }
  return "server-managed";
};

// ─────────────────────────────────────────────
// 2. getAccessToken — compatibilidad: el token nunca sale del backend
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
export const getAccessToken = async (
  clientId,
  clientSecret,
  username,
  password,
  testMode = true
) => {
  await testFactusCredentials({
    factusClientId: clientId,
    factusClientSecret: clientSecret,
    factusUsername: username,
    factusPassword: password,
    factusTestMode: testMode,
  });
  return { access_token: "server-managed" };
};

// ─────────────────────────────────────────────
// 3. testConnection
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
export const testConnection = async (credentials) => {
  await testFactusCredentials(credentials);
  return {
    success: true,
    message: "Conexión establecida con éxito.",
    accessToken: "server-managed",
  };
};

// ─────────────────────────────────────────────
// 4. getNumberingRanges
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
export const getNumberingRanges = async () => {
  const data = await getFactusRanges();
  return data.result;
};

// ─────────────────────────────────────────────
// 5. downloadInvoicePDF
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
export const downloadInvoicePDF = async (billNumber) => {
  const data = await downloadFactusPdf(billNumber);
  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: data.mimeType || "application/pdf" });
};

// ─────────────────────────────────────────────
// 6. sendInvoice — full payload builder + send
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
export const sendInvoice = async (invoiceData, patientData, tenantCredentials) => {
  // El navegador solo trabaja con estado no sensible; las credenciales y el
  // token permanecen dentro de la Edge Function.
  let resolvedCreds = tenantCredentials;
  if (!resolvedCreds?.serverManaged) {
    const { getFactusCredentialsForTenant } = await import("./factusAdminService");
    resolvedCreds = await getFactusCredentialsForTenant(
      invoiceData?.inquilino || tenantCredentials?.inquilino
    );
  }
  if (!resolvedCreds?.serverManaged) {
    throw new Error("La clínica no tiene credenciales Factus configuradas.");
  }

  const testMode = resolvedCreds.factusTestMode !== false;

  // Auto-fetch the correct "Factura de Venta" numbering range from Factus API.
  // IMPORTANT: /v2/bills/validate ONLY accepts ranges of type "Factura de Venta".
  // Ranges like "Nota Crédito", "Nota Débito", etc. will cause a 422 error.
  let numberingRangeId = Number(resolvedCreds.factusNumberingRangeId || tenantCredentials?.factusNumberingRangeId) || 0;
  if (!numberingRangeId) try {
    const rangesData = await getNumberingRanges();

    // Factus uses Laravel pagination: { data: { data: [...], pagination: {...} } }
    let ranges = [];
    if (Array.isArray(rangesData)) {
      ranges = rangesData;
    } else if (Array.isArray(rangesData?.data)) {
      ranges = rangesData.data;
    } else if (Array.isArray(rangesData?.data?.data)) {
      ranges = rangesData.data.data;
    }

    // Helper: is the range active and not expired?
    // Helper: is the range active and not expired?
    const isUsable = (r) =>
      (r.is_active === true || r.is_active === 1 || r.is_active === "1") &&
      r.is_expired !== true && r.is_expired !== 1;

    // Priority 1: active, non-expired "Factura de Venta" range
    const isInvoiceDoc = (doc) => {
      const d = (doc || "").toLowerCase();
      return (d.includes("factura") || d.includes("invoice") || d.includes("venta")) &&
             !d.includes("crédito") && !d.includes("credito") && !d.includes("débito") && !d.includes("debito");
    };

    let selectedRange = ranges.find((r) => isUsable(r) && isInvoiceDoc(r.document));

    // Priority 2: if a specific ID was saved and it matches a "Factura de Venta", use it
    if (!selectedRange && numberingRangeId) {
      const savedRange = ranges.find((r) => Number(r.id) === numberingRangeId && isUsable(r));
      if (savedRange && isInvoiceDoc(savedRange.document)) {
        selectedRange = savedRange;
      }
    }

    // Priority 3 (fallback): any active non-expired range
    if (!selectedRange) {
      selectedRange = ranges.find(isUsable) || ranges[0];
      if (selectedRange) {
        console.warn(
          `⚠️ Usando rango: "${selectedRange.document}" (ID ${selectedRange.id}).`
        );
      }
    }

    if (selectedRange?.id) {
      numberingRangeId = Number(selectedRange.id);
    } else {
      console.warn("⚠️ No numbering range found in response. Ranges array:", ranges);
    }
  } catch (error) {
    console.warn("No fue posible obtener automáticamente los rangos Factus:", error.message);
  }

  if (!numberingRangeId) {
    if (!testMode) {
      throw new Error("No hay un rango de numeración Factus configurado para producción.");
    }
    numberingRangeId = 8;
  }

  // ── Patient / customer data ──
  let docNum = String(
    patientData.documento ||
      patientData.identificacion ||
      patientData.cedula ||
      "222222222222"
  ).replace(/\D/g, "");
  if (!docNum || docNum.length < 3) docNum = "222222222222";

  const tipoDoc = getDocTypeCode(
    patientData.tipoDocumento || patientData.tipo_documento
  );

  const rawEmail = String(patientData.email || patientData.correo || "").trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "facturacion@odontocloud.com";

  let phone = String(
    patientData.telefono || patientData.celular || "3001234567"
  ).replace(/\D/g, "");
  if (phone.length < 10) phone = phone.padEnd(10, "0");

  const address =
    patientData.direccion || patientData.address || "Dirección no registrada";
  const cityName =
    patientData.ciudad || patientData.municipio || "Bogotá D.C.";
  const municipalityCode = getMunicipalityCode(cityName) || "11001";

  const fullName = [patientData.nombre, patientData.apellido]
    .filter(Boolean)
    .join(" ")
    .trim() || "Cliente OdontoCloud";

  // ── Legal organization & tribute based on document type ──
  const isNIT = tipoDoc === "31";
  const legalOrgCode = isNIT ? "1" : "2";
  const tributeCode = isNIT ? "O-13" : "ZZ";

  // Split name for Factus `names` & `last_names`
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Cliente";
  const lastName  = nameParts.slice(1).join(" ") || firstName || "General";

  // ── Items ──
  const rawItems = invoiceData.items || [];
  const factusItems = rawItems.map((item, idx) => {
    const qty = parseFloat(item.cantidad || item.quantity || 1) || 1;
    const price = parseFloat(item.precioUnitario || item.precio || item.valor || 0) || 0;
    
    let discountRate = 0;
    const rawDiscount = parseFloat(item.descuento || item.discount || 0) || 0;
    if (rawDiscount > 0) {
      if (rawDiscount <= 100 && !item.descuentoEnPesos) {
        discountRate = rawDiscount;
      } else if (price * qty > 0) {
        discountRate = Math.min(100, Math.max(0, (rawDiscount / (price * qty)) * 100));
      }
    }

    return {
      code_reference: item.code || `SERV-${String(idx + 1).padStart(4, "0")}`,
      name: String(
        item.descripcion || item.nombre || item.concepto || "Servicio Odontológico"
      ).slice(0, 100),
      quantity: qty,
      discount_rate: Number(discountRate.toFixed(2)),
      price: price,
      unit_measure_code: "94",      // unidad
      standard_code: "0001",        // Estándar contribuyente
      taxes: [
        { code: "01", rate: "0.00" } // IVA 0% — servicios odontológicos exentos
      ],
    };
  });

  if (factusItems.length === 0) {
    factusItems.push({
      code_reference: "SERV-0001",
      name: "Servicio Odontológico",
      quantity: 1,
      discount_rate: 0,
      price: parseFloat(invoiceData.total || 0),
      unit_measure_code: "94",
      standard_code: "0001",
      taxes: [{ code: "01", rate: "0.00" }],
    });
  }

  // ── Total: MUST equal sum of items for Factus validation ──
  const itemsTotal = factusItems.reduce((sum, item) => {
    const lineTotal = item.price * item.quantity * (1 - (item.discount_rate || 0) / 100);
    return sum + lineTotal;
  }, 0);
  const totalAmount = itemsTotal.toFixed(2);

  // ── Payment ──
  const paymentForm = String(invoiceData.condicionPago || "1");
  const paymentMethodCode = String(invoiceData.medioPago || "10");

  const referenceCode =
    invoiceData.factusReferenceCode ||
    `OC-${Date.now().toString(36).toUpperCase()}`;

  // ── Full payload — Factus V2 structure ──
  const payload = {
    numbering_range_id: numberingRangeId,
    reference_code: referenceCode,
    observation: (invoiceData.observaciones || "Emitido desde OdontoCloud").slice(0, 250),
    payment_details: [
      {
        payment_form: paymentForm,
        payment_method_code: paymentMethodCode,
        amount: totalAmount,
      },
    ],
    customer: {
      identification_document_code: tipoDoc,
      identification: docNum,
      names: firstName,
      ...(legalOrgCode === "2" ? { last_names: lastName } : {}),
      ...(isNIT ? { company: fullName, trade_name: fullName } : {}),
      address: address,
      email: email,
      phone: phone,
      legal_organization_code: legalOrgCode,
      tribute_code: tributeCode,
      municipality_code: municipalityCode,
    },
    items: factusItems,
  };

  let finalPayload = payload;
  let fevRipsFlag = resolvedCreds?.fevRipsFlagEnabled ?? invoiceData?.fevRipsFlagEnabled;
  if (fevRipsFlag === undefined && (invoiceData?.esSectorSalud === true || invoiceData?.tipoOperacion === "SS-CUFE")) {
    const tenantId = invoiceData?.tenant_id || invoiceData?.inquilino || resolvedCreds?.inquilino;
    if (tenantId) {
      try {
        const { isFevRips0948Enabled } = await import("../modules/rips/v003/ripsFeatureFlagService");
        fevRipsFlag = await isFevRips0948Enabled(tenantId);
      } catch (err) {
        console.warn("Could not check FEV-RIPS feature flag:", err.message);
        fevRipsFlag = false;
      }
    }
  }

  if (isFacturaSectorSalud({ factura: invoiceData, fevRipsFlagEnabled: Boolean(fevRipsFlag) })) {
    finalPayload = buildFactusHealthInvoicePayload(
      payload,
      invoiceData.healthData || invoiceData.health,
      {
        billing_period: invoiceData.billing_period || invoiceData.periodoFacturacion,
        beneficiary: invoiceData.beneficiary || invoiceData.pacienteBeneficiario,
      }
    );
  }

  const proxyResponse = await sendFactusBill(finalPayload);
  return { ...proxyResponse.result, _referenceCode: referenceCode };
};

/**
 * Downloads the legal AttachedDocument XML for an electronic bill.
 * Endpoint: GET /v2/bills/:number/download-attached-document-xml
 *
 * @param {string} billNumber - Factus bill number (e.g. SETP990020758)
 * @returns {Promise<string>} Base64-encoded AttachedDocument XML
 */
export const downloadAttachedDocumentXml = async (billNumber) => {
  const data = await downloadFactusAttachedDocumentXml(billNumber);
  return data?.xml_base_64_encoded || "";
};

/**
 * Transmits a Documento Soporte to Factus V2 / DIAN.
 * Endpoint: POST /v2/support-documents/validate
 */
export const sendSupportDocument = async (supportDocData) => {
  let numberingRangeId = supportDocData.numberingRangeId || supportDocData.rangoId || supportDocData.numbering_range_id;

  // Si no viene en los datos, buscar el rango activo de Factus automáticamente
  if (!numberingRangeId) {
    try {
      const rangesData = await getNumberingRanges();
      let ranges = [];
      if (Array.isArray(rangesData)) {
        ranges = rangesData;
      } else if (Array.isArray(rangesData?.data)) {
        ranges = rangesData.data;
      } else if (Array.isArray(rangesData?.data?.data)) {
        ranges = rangesData.data.data;
      }

      const isUsable = (r) =>
        (r.is_active === true || r.is_active === 1 || r.is_active === "1") &&
        r.is_expired !== true && r.is_expired !== 1;

      // Prioridad 1: Rango explícito de Documento Soporte
      const isSupportDoc = (doc) => {
        const d = (doc || "").toLowerCase();
        return d.includes("soporte") || d.includes("support");
      };

      let selectedRange = ranges.find((r) => isUsable(r) && isSupportDoc(r.document));

      // Prioridad 2: Rango con prefijo que coincida con el prefijo del documento o "DS"
      if (!selectedRange) {
        const pref = String(supportDocData.prefijo || "DS").toUpperCase();
        selectedRange = ranges.find((r) => isUsable(r) && String(r.prefix || "").toUpperCase() === pref);
      }

      // Prioridad 3: Rango con prefijo iniciado en DS o SD
      if (!selectedRange) {
        selectedRange = ranges.find(
          (r) => isUsable(r) && (String(r.prefix || "").toUpperCase().startsWith("DS") || String(r.prefix || "").toUpperCase().startsWith("SD"))
        );
      }

      // Prioridad 4: Cualquier rango usable activo como fallback
      if (!selectedRange) {
        selectedRange = ranges.find(isUsable) || ranges[0];
      }

      if (selectedRange?.id) {
        numberingRangeId = Number(selectedRange.id);
        console.info(`✅ Rango de numeración asignado para Documento Soporte: "${selectedRange.document}" (ID: ${numberingRangeId}, Prefijo: ${selectedRange.prefix})`);
      }
    } catch (e) {
      console.warn("No se pudo obtener rangos de Factus automáticamente:", e);
    }
  }

  if (!numberingRangeId) {
    throw new Error("No se encontró un rango de numeración Factus activo para Documento Soporte. Por favor verifica tus rangos de numeración en Factus.");
  }

  const tercero = supportDocData.tercero || {};
  const docNum = String(tercero.numero_documento || tercero.identificacion || "").trim();
  const rawTipo = String(tercero.tipo_documento || tercero.tipoDocumento || "NIT").toUpperCase();
  const tipoDoc = getDocTypeCode(rawTipo);
  const fullName = String(
    tercero.nombre_completo ||
    tercero.razon_social ||
    `${tercero.nombre || ""} ${tercero.apellido || ""}`.trim() ||
    "Proveedor"
  ).trim();
  const email = (tercero.email || "proveedor@clinica.com").trim().toLowerCase();
  const phone = String(tercero.telefono || tercero.celular || "3000000000").replace(/\D/g, "").slice(0, 10);
  const address = (tercero.direccion || "Dirección principal").trim();
  const municipalityCode = tercero.codigo_municipio || getMunicipalityCode(tercero.ciudad) || "11001";
  const dv = tercero.dv || calculateNIT_DV(docNum) || "0";

  const rawItems = supportDocData.items || supportDocData.detalles || [];
  const factusItems = rawItems.map((item, idx) => {
    const qty = parseFloat(item.cantidad || item.quantity || 1) || 1;
    const price = parseFloat(item.precioUnitario || item.precio || item.valor || item.price || 0) || 0;
    const discountRate = parseFloat(item.descuento || item.discount || 0) || 0;

    return {
      code_reference: item.code || item.code_reference || `COMPRA-${String(idx + 1).padStart(4, "0")}`,
      name: String(item.descripcion || item.nombre || item.concepto || "Compra o Servicio Recibido").slice(0, 100),
      quantity: Number(qty.toFixed(2)),
      discount_rate: Number(discountRate.toFixed(2)),
      price: Number(price.toFixed(2)),
      unit_measure_code: "94", // unidad
      standard_code: "0001",
      taxes: [
        { code: "01", rate: "0.00" } // IVA 0% (Obligatorio en Factus V2 para cada ítem)
      ],
    };
  });

  if (factusItems.length === 0) {
    const fallbackPrice = parseFloat(supportDocData.total || supportDocData.totalConceptos || 0);
    factusItems.push({
      code_reference: "COMPRA-0001",
      name: "Compra de bienes o servicios a no obligados a facturar",
      quantity: 1,
      discount_rate: 0,
      price: Number(fallbackPrice.toFixed(2)),
      unit_measure_code: "94",
      standard_code: "0001",
      taxes: [{ code: "01", rate: "0.00" }],
    });
  }

  // ── Payment Form (1: Contado, 2: Crédito) ──
  const rawCondicion = String(supportDocData.condicionPago || supportDocData.condicion_pago || supportDocData.tipo_pago || "1").toLowerCase();
  const paymentForm = (rawCondicion.includes("crédit") || rawCondicion.includes("credit") || rawCondicion === "2") ? "2" : "1";

  // ── Payment Method Code (Códigos oficiales DIAN) ──
  const mapPaymentMethodCode = (raw) => {
    if (!raw) return "10";
    const str = String(raw).trim().toLowerCase();
    if (/^\d+$/.test(str)) return str;
    if (str.includes("consigna")) return "42";
    if (str.includes("transfer")) return "42";
    if (str.includes("efectivo") || str.includes("cash")) return "10";
    if (str.includes("crédito") || str.includes("credito")) return "48";
    if (str.includes("débito") || str.includes("debito")) return "49";
    if (str.includes("cheque")) return "20";
    if (str.includes("nequi") || str.includes("daviplata") || str.includes("bancolombia")) return "42";
    return "10";
  };
  const paymentMethodCode = mapPaymentMethodCode(supportDocData.medioPago || supportDocData.medio_pago || supportDocData.metodoPago);

  const itemsTotal = factusItems.reduce((sum, item) => {
    const lineTotal = item.price * item.quantity * (1 - (item.discount_rate || 0) / 100);
    return sum + lineTotal;
  }, 0);
  const totalAmount = itemsTotal > 0 ? itemsTotal.toFixed(2) : parseFloat(supportDocData.total || 0).toFixed(2);
  const referenceCode = supportDocData.referenceCode || `DS-${Date.now().toString(36).toUpperCase()}`;

  const payload = {
    numbering_range_id: Number(numberingRangeId),
    reference_code: referenceCode,
    observation: (supportDocData.observaciones || "Documento soporte en adquisiciones efectuadas a no obligados a facturar").slice(0, 500),
    payment_details: [
      {
        payment_form: paymentForm,
        payment_method_code: paymentMethodCode,
        amount: totalAmount,
        ...(paymentForm === "2" && supportDocData.fechaVencimiento ? { due_date: supportDocData.fechaVencimiento } : {}),
      },
    ],
    provider: {
      identification_document_code: tipoDoc,
      identification: docNum,
      ...(tipoDoc === "31" ? { dv: String(dv) } : {}),
      names: fullName,
      address: address,
      country_code: "CO",
      municipality_code: municipalityCode,
      email: email,
      phone: phone,
    },
    items: factusItems,
  };

  const proxyResponse = await sendFactusSupportDocument(payload);
  return { ...proxyResponse.result, _referenceCode: referenceCode };
};

/**
 * Transmits a Nota de Ajuste a Documento Soporte.
 * Endpoint: POST /v2/adjustment-notes/validate
 */
export const sendSupportDocumentAdjustmentNote = async (noteData) => {
  const payload = {
    reference_code: noteData.referenceCode || `NA-${Date.now().toString(36).toUpperCase()}`,
    support_document_number: noteData.supportDocumentNumber,
    reason_code: String(noteData.reasonCode || "2"),
    observation: (noteData.observacion || "Anulación de documento soporte").slice(0, 500),
  };
  const proxyResponse = await sendFactusAdjustmentNote(payload);
  return proxyResponse.result;
};

/**
 * Downloads the legal PDF for a Documento Soporte
 */
export const downloadSupportDocumentPDF = async (documentNumber) => {
  const response = await downloadFactusSupportDocumentPdf(documentNumber);
  const binaryString = atob(response.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `DocSoporte-${documentNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

// ─────────────────────────────────────────────
// 7. Credit Note methods and helpers
// ─────────────────────────────────────────────
export {
  sendFactusCreditNote,
  checkFactusCreditNote,
  deleteUnvalidatedFactusCreditNote,
  downloadFactusCreditNoteXml,
  downloadFactusCreditNotePdf,
};

/**
 * Filtra los rangos de numeración autorizados para Nota Crédito (document = 22 / 'Nota Crédito').
 */
export const filterActiveCreditNoteRanges = (ranges) => {
  if (!ranges) return [];
  let list = ranges;
  if (ranges && typeof ranges === "object" && !Array.isArray(ranges)) {
    if (Array.isArray(ranges.result?.data?.data)) list = ranges.result.data.data;
    else if (Array.isArray(ranges.result?.data)) list = ranges.result.data;
    else if (Array.isArray(ranges.data?.data)) list = ranges.data.data;
    else if (Array.isArray(ranges.data)) list = ranges.data;
    else if (Array.isArray(ranges.ranges)) list = ranges.ranges;
  }
  if (!Array.isArray(list)) return [];
  return list.filter((r) => {
    const doc = String(r.document || "").toLowerCase().trim();
    const docId = String(r.document_id || r.document_type || "").trim();
    const isCreditNote =
      doc.includes("nota crédito") ||
      doc.includes("nota credito") ||
      doc === "22" ||
      docId === "22";
    const isActive = r.is_active === true || r.is_active === 1 || r.is_active === "1";
    const notExpired = r.is_expired !== true && r.is_expired !== 1;
    const notDeleted = !r.deleted_at;
    return isCreditNote && isActive && notExpired && notDeleted;
  });
};

/**
 * Descarga el PDF oficial de una Nota Crédito y retorna el Blob.
 */
export const downloadCreditNotePDF = async (creditNoteNumber) => {
  const data = await downloadFactusCreditNotePdf(creditNoteNumber);
  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: data.mimeType || "application/pdf" });
};

/**
 * Descarga el XML AttachedDocument oficial de una Nota Crédito y retorna Blob + fileName.
 */
export const downloadCreditNoteXML = async (creditNoteNumber) => {
  const data = await downloadFactusCreditNoteXml(creditNoteNumber);
  const binary = atob(data.xml_base_64_encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: "application/xml;charset=utf-8" });
  return { blob, fileName: data.file_name || `NotaCredito-${creditNoteNumber}.xml` };
};

// ─────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────
const factusService = {
  getToken,
  getAccessToken,
  testConnection,
  sendInvoice,
  downloadInvoicePDF,
  downloadAttachedDocumentXml,
  sendSupportDocument,
  sendSupportDocumentAdjustmentNote,
  downloadSupportDocumentPDF,
  getNumberingRanges,
  getMunicipalityCode,
  getDocTypeCode,
  sendFactusCreditNote,
  checkFactusCreditNote,
  deleteUnvalidatedFactusCreditNote,
  downloadFactusCreditNoteXml,
  downloadFactusCreditNotePdf,
  filterActiveCreditNoteRanges,
  downloadCreditNotePDF,
  downloadCreditNoteXML,
};

export default factusService;
