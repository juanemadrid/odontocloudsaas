/**
 * DianService.js
 * Delegates electronic invoice emission to Factus (via factusService).
 * If Factus credentials are missing, returns NO_CONFIGURADA status.
 */

import factusService from "./factusService";

/**
 * Emit an electronic invoice through Factus → DIAN.
 *
 * @param {Object} factura        - Invoice data (items, total, medioPago, etc.)
 * @param {Object} patient        - Patient data (documento, tipoDocumento, email, etc.)
 * @param {Object|null} tenantCredentials - Factus credentials from Firestore tenants doc
 */
export const emitirFacturaDian = async (
  factura,
  patient = {},
  tenantCredentials = null
) => {
  // No credentials → return graceful no-config response
  if (
    !tenantCredentials ||
    !tenantCredentials.factusClientId ||
    !tenantCredentials.factusClientSecret ||
    !tenantCredentials.factusUsername ||
    !tenantCredentials.factusPassword
  ) {
    return {
      success: false,
      dianStatus: "NO_CONFIGURADA",
      cufe: null,
      qrCode: null,
      factusInvoiceNumber: null,
      factusResponse: null,
      message:
        "Facturación electrónica no configurada. Configure las credenciales Factus en Configuración → Facturación Electrónica.",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const result = await factusService.sendInvoice(factura, patient, tenantCredentials);

    // Extract key fields from Factus response
    const bill = result?.data?.bill || result?.bill || result;
    const cufe =
      bill?.cufe ||
      bill?.cude ||
      result?.data?.cufe ||
      result?.cufe ||
      null;
    const qrCode =
      bill?.qr_code ||
      bill?.qr ||
      result?.data?.qr_code ||
      result?.qr_code ||
      null;
    const invoiceNumber =
      bill?.number ||
      bill?.invoice_number ||
      result?.data?.number ||
      result?.number ||
      null;

    const isTestMode = tenantCredentials.factusTestMode ?? true;

    return {
      success: true,
      dianStatus: isTestMode ? "SIMULADA" : "ACEPTADA",
      cufe,
      qrCode,
      factusInvoiceNumber: invoiceNumber,
      factusResponse: result,
      message: isTestMode
        ? "Factura emitida en modo sandbox (sin validez fiscal)."
        : "Factura aceptada por la DIAN.",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      dianStatus: "RECHAZADA",
      cufe: null,
      qrCode: null,
      factusInvoiceNumber: null,
      factusResponse: null,
      message: error.message || "Error al emitir la factura electrónica.",
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Returns display label + CSS color classes for a DIAN status string.
 */
export const getDianStatusLabel = (status) => {
  switch (status) {
    case "ACEPTADA":
      return { label: "DIAN Aceptada", color: "bg-green-100 text-green-700" };
    case "RECHAZADA":
      return { label: "DIAN Rechazada", color: "bg-red-100 text-red-700" };
    case "PROCESANDO":
      return { label: "Enviando...", color: "bg-yellow-100 text-yellow-700" };
    case "NO_CONFIGURADA":
      return {
        label: "Sin configurar",
        color: "bg-orange-100 text-orange-700",
      };
    case "SIMULADA":
      return { label: "Simulada", color: "bg-amber-100 text-amber-700" };
    default:
      return { label: "No emitida", color: "bg-slate-100 text-slate-500" };
  }
};
