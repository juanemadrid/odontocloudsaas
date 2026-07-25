/**
 * factusService.js
 * Robust Factus electronic invoicing service for OdontoCloud.
 * Credentials are loaded from Firestore at runtime — never from VITE_ env.
 */

// ─────────────────────────────────────────────
// Token cache (per credentials key)
// ─────────────────────────────────────────────
const tokenCache = {};

const credKey = (c) =>
  `${c.factusClientId}:${c.factusUsername}:${c.factusTestMode ? "sandbox" : "prod"}`;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const getBaseUrl = (testMode = true) =>
  testMode
    ? "https://api-sandbox.factus.com.co"
    : "https://api.factus.com.co";

/** Parse a Factus error response into a human-readable string */
const parseFactusError = (data, status) => {
  // Factus 422: errors is an object like { "customer.identification": ["..."] }
  if (data?.errors && typeof data.errors === "object") {
    const details = Object.entries(data.errors)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
      .join(" | ");
    return details || `Error HTTP ${status}`;
  }
  if (data?.message) return data.message;
  if (data?.error_description) return data.error_description;
  // Log full response for debugging
  console.error("Factus full error response:", JSON.stringify(data));
  return `Error HTTP ${status}`;
};

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
export const getToken = async (credentials) => {
  const key = credKey(credentials);
  const cached = tokenCache[key];

  if (cached && Date.now() < cached.expiresAt) {
    return cached.accessToken;
  }

  const baseUrl = getBaseUrl(credentials.factusTestMode);
  const params = new URLSearchParams({
    grant_type: "password",
    client_id: credentials.factusClientId,
    client_secret: credentials.factusClientSecret,
    username: credentials.factusUsername,
    password: credentials.factusPassword,
  });

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseFactusError(data, response.status));
  }

  if (!data.access_token) {
    throw new Error("No se recibió access_token de Factus.");
  }

  // Cache with 60-second safety margin
  const expiresIn = (data.expires_in || 3600) - 60;
  tokenCache[key] = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return data.access_token;
};

// ─────────────────────────────────────────────
// 2. getAccessToken — legacy / direct (no cache)
// ─────────────────────────────────────────────
export const getAccessToken = async (
  clientId,
  clientSecret,
  username,
  password,
  testMode = true
) => {
  const baseUrl = getBaseUrl(testMode);
  const params = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
  });

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseFactusError(data, response.status));
  }
  return data;
};

// ─────────────────────────────────────────────
// 3. testConnection
// ─────────────────────────────────────────────
export const testConnection = async (credentials) => {
  const {
    factusClientId,
    factusClientSecret,
    factusUsername,
    factusPassword,
    username,
    password,
    factusTestMode,
  } = credentials;

  const user = factusUsername || username;
  const pass = factusPassword || password;

  if (!factusClientId || !factusClientSecret || !user || !pass) {
    throw new Error(
      "Faltan credenciales requeridas (Client ID, Client Secret, Usuario, Contraseña)."
    );
  }

  const normalized = {
    factusClientId,
    factusClientSecret,
    factusUsername: user,
    factusPassword: pass,
    factusTestMode,
  };

  const accessToken = await getToken(normalized);

  return {
    success: true,
    message: "Conexión establecida con éxito.",
    accessToken,
  };
};

// ─────────────────────────────────────────────
// 4. getNumberingRanges
// ─────────────────────────────────────────────
export const getNumberingRanges = async (accessToken, testMode = true) => {
  const baseUrl = getBaseUrl(testMode);
  const response = await fetch(`${baseUrl}/v2/numbering-ranges`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseFactusError(data, response.status));
  }
  return data;
};

// ─────────────────────────────────────────────
// 5. downloadInvoicePDF
// ─────────────────────────────────────────────
export const downloadInvoicePDF = async (
  billNumber,
  accessToken,
  testMode = true
) => {
  const baseUrl = getBaseUrl(testMode);
  const response = await fetch(
    `${baseUrl}/v2/bills/${billNumber}/download-pdf`,
    {
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    let errorMsg = `Error HTTP ${response.status}`;
    try {
      const errData = await response.json();
      errorMsg = parseFactusError(errData, response.status);
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return response.blob();
};

// ─────────────────────────────────────────────
// 6. sendInvoice — full payload builder + send
// ─────────────────────────────────────────────
export const sendInvoice = async (invoiceData, patientData, tenantCredentials) => {
  // ── Load credentials: check sucursal / tenant specific credentials, fallback to superadmin central ──
  let resolvedCreds = tenantCredentials;
  try {
    const { getFactusCredentialsForTenant } = await import("./factusAdminService");
    const foundCreds = await getFactusCredentialsForTenant(
      invoiceData?.inquilino || tenantCredentials?.inquilino,
      invoiceData?.sucursalId || tenantCredentials?.sucursalId
    );
    if (foundCreds) {
      resolvedCreds = { ...foundCreds, ...tenantCredentials };
    }
  } catch (e) {
    console.warn("Could not resolve Factus credentials for tenant/sucursal:", e.message);
  }

  const creds = {
    factusClientId:     resolvedCreds?.factusClientId,
    factusClientSecret: resolvedCreds?.factusClientSecret,
    factusUsername:     resolvedCreds?.factusUsername || resolvedCreds?.username,
    factusPassword:     resolvedCreds?.factusPassword || resolvedCreds?.password,
    factusTestMode:     resolvedCreds?.factusTestMode ?? true,
  };

  const accessToken = await getToken(creds);
  const testMode = creds.factusTestMode;

  // Auto-fetch the correct "Factura de Venta" numbering range from Factus API.
  // IMPORTANT: /v2/bills/validate ONLY accepts ranges of type "Factura de Venta".
  // Ranges like "Nota Crédito", "Nota Débito", etc. will cause a 422 error.
  let numberingRangeId = Number(resolvedCreds.factusNumberingRangeId || tenantCredentials?.factusNumberingRangeId) || 0;
  try {
    const rangesData = await getNumberingRanges(accessToken, testMode);
    console.log("🔍 Raw numbering ranges response:", JSON.stringify(rangesData, null, 2));

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
    const isUsable = (r) =>
      (r.is_active === true || r.is_active === 1 || r.is_active === "1") &&
      r.is_expired !== true && r.is_expired !== 1;

    // Priority 1: active, non-expired "Factura de Venta" range
    const invoiceDocumentNames = ["factura de venta", "factura venta", "invoice"];
    let selectedRange = ranges.find(
      (r) => isUsable(r) && invoiceDocumentNames.includes((r.document || "").toLowerCase())
    );

    // Priority 2: if a specific ID was saved and it matches a "Factura de Venta", use it
    if (!selectedRange && numberingRangeId) {
      const savedRange = ranges.find((r) => Number(r.id) === numberingRangeId && isUsable(r));
      if (savedRange && invoiceDocumentNames.includes((savedRange.document || "").toLowerCase())) {
        selectedRange = savedRange;
      }
    }

    // Priority 3 (fallback): any active non-expired range — may still fail if wrong type
    if (!selectedRange) {
      selectedRange = ranges.find(isUsable) || ranges[0];
      if (selectedRange) {
        console.warn(
          `⚠️ No "Factura de Venta" range found. Using fallback: "${selectedRange.document}" (ID ${selectedRange.id}). ` +
          "Configure a 'Factura de Venta' range in Factus for reliable invoicing."
        );
      }
    }

    if (selectedRange?.id) {
      numberingRangeId = Number(selectedRange.id);
      console.log(
        `✅ Selected numbering range — ID: ${numberingRangeId} | Type: "${selectedRange.document}" | Prefix: "${selectedRange.prefix}"`
      );
    } else {
      console.warn("⚠️ No numbering range found in response. Ranges array:", ranges);
    }
  } catch (e) {
    console.warn("Could not auto-fetch numbering ranges:", e.message);
  }

  if (!numberingRangeId) {
    // Factus V2 sandbox default range ID is typically 8
    // This will be overridden by the auto-fetch above if the API returns ranges correctly
    numberingRangeId = 8;
    console.warn("⚠️ Using default numbering range ID 8 for Factus V2 sandbox. Configure the correct ID in Configuración → Facturación Electrónica.");
  }

  // ── Patient / customer data ──
  const docNum = String(
    patientData.documento ||
      patientData.identificacion ||
      patientData.cedula ||
      "222222222222"
  ).replace(/\D/g, "");

  const tipoDoc = getDocTypeCode(
    patientData.tipoDocumento || patientData.tipo_documento
  );

  const email = patientData.email || patientData.correo || "correo@prueba.com";
  const phone = String(
    patientData.telefono || patientData.celular || "3001234567"
  ).replace(/\D/g, "");
  const address =
    patientData.direccion || patientData.address || "Dirección no registrada";
  const cityName =
    patientData.ciudad || patientData.municipio || "Bogotá D.C.";
  const municipalityCode = getMunicipalityCode(cityName) || "11001"; // default Bogotá if not found

  const fullName = [patientData.nombre, patientData.apellido]
    .filter(Boolean)
    .join(" ")
    .trim() || "Cliente OdontoCloud";

  // ── Legal organization & tribute based on document type ──
  // Factus V2 uses code strings directly (not _id)
  // identification_document_code: "13"=CC, "31"=NIT, "22"=CE, "41"=PA, "12"=TI
  const isNIT = tipoDoc === "31";
  // legal_organization_code: "2"=Persona Natural, "1"=Persona Jurídica
  const legalOrgCode = isNIT ? "1" : "2";
  // tribute_code: "ZZ"=No aplica (Persona Natural), "O-13"=Gran Contribuyente (NIT)
  const tributeCode = isNIT ? "O-13" : "ZZ";

  // Split name for Factus `names` field
  const nameParts = fullName.trim().split(" ");
  const firstName = nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(" ") || fullName;
  const lastName  = nameParts.slice(Math.ceil(nameParts.length / 2)).join(" ") || firstName;

  // ── Items ──
  const rawItems = invoiceData.items || [];
  const factusItems = rawItems.map((item, idx) => {
    const qty = parseFloat(item.cantidad || item.quantity || 1);
    const price = parseFloat(item.precioUnitario || item.precio || item.valor || 0);
    const discountRate = parseFloat(item.descuento || item.discount || 0);

    return {
      code_reference: item.code || `SERV-${String(idx + 1).padStart(4, "0")}`,
      name: String(
        item.descripcion || item.nombre || item.concepto || "Servicio Odontológico"
      ).slice(0, 100),
      quantity: qty,
      discount_rate: discountRate,
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
  // invoiceData.total may be an abono/partial payment — do NOT use it for payment_details.amount.
  // Factus requires: sum(payment_details.amount) == sum(item.price * item.quantity * (1 - discount/100))
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
      ...(lastName && lastName !== firstName ? { last_names: lastName } : {}),
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

  console.log("📤 Factus payload:", JSON.stringify(payload, null, 2));

  const baseUrl = getBaseUrl(testMode);
  const response = await fetch(`${baseUrl}/v2/bills/validate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("❌ Factus error response:", JSON.stringify(data, null, 2));
    throw new Error(parseFactusError(data, response.status));
  }

  return { ...data, _referenceCode: referenceCode };
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
