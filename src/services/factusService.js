import {
  downloadFactusPdf,
  getFactusRanges,
  getFactusStatus,
  sendFactusBill,
  testFactusCredentials,
} from "./factusProxyService";

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

  const proxyResponse = await sendFactusBill(payload);
  return { ...proxyResponse.result, _referenceCode: referenceCode };
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
  getNumberingRanges,
  getMunicipalityCode,
  getDocTypeCode,
};

export default factusService;
