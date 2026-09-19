// src/utils/dian/dianHelpers.js
// ============================================================
// 🇨🇴 Utilidades y Validaciones Estándar DIAN - OdontoCloud
// Algoritmo Módulo 11 oficial de la DIAN para cálculo de DV
// ============================================================

/**
 * Factores de ponderación oficiales de la DIAN para el cálculo del DV.
 * Se aplican de derecha a izquierda sobre los dígitos del NIT.
 */
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/**
 * Calcula el Dígito de Verificación (DV) de un NIT según el algoritmo Módulo 11 de la DIAN.
 * @param {string|number} nit - Número de identificación tributaria (sin guion ni DV)
 * @returns {number|null} Dígito de verificación (0 a 9) o null si es inválido
 */
export function calculateNIT_DV(nit) {
  if (!nit) return null;
  const cleanNIT = String(nit).trim().replace(/[^0-9]/g, "");
  if (!cleanNIT || cleanNIT.length === 0 || cleanNIT.length > 15) return null;

  let sum = 0;
  const len = cleanNIT.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(cleanNIT.charAt(len - 1 - i), 10);
    const weight = NIT_WEIGHTS[i];
    sum += digit * weight;
  }

  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) {
    return remainder;
  }
  return 11 - remainder;
}

/**
 * Formatea un NIT con su guion y dígito de verificación.
 * @param {string|number} nit
 * @returns {string} Ejemplo: "900123456-7"
 */
export function formatNITWithDV(nit) {
  if (!nit) return "";
  const clean = String(nit).trim().replace(/[^0-9]/g, "");
  if (!clean) return "";
  const dv = calculateNIT_DV(clean);
  return dv !== null ? `${clean}-${dv}` : clean;
}

/**
 * Valida si un NIT con DV proporcionado coincide con el cálculo oficial DIAN.
 * @param {string} fullNIT - Cadena en formato "900123456-7" o "900123456"
 * @param {number|string} [explicitDV]
 * @returns {boolean}
 */
export function isValidNIT_DV(fullNIT, explicitDV = null) {
  if (!fullNIT) return false;
  let nit = String(fullNIT).trim();
  let dv = explicitDV;

  if (nit.includes("-")) {
    const parts = nit.split("-");
    nit = parts[0].replace(/[^0-9]/g, "");
    dv = parts[1]?.trim();
  } else {
    nit = nit.replace(/[^0-9]/g, "");
  }

  if (!nit || dv === null || dv === undefined || dv === "") return false;
  const computedDV = calculateNIT_DV(nit);
  return computedDV !== null && String(computedDV) === String(dv).trim();
}

/**
 * Catálogo estándar de motivos para Notas de Ajuste al Documento Soporte Electrónico (DIAN).
 */
export const MOTIVOS_AJUSTE_DOCUMENTO_SOPORTE = [
  { id: "1", codigo: "1", label: "1 - Devolución parcial de los bienes y/o no aceptación parcial del servicio" },
  { id: "2", codigo: "2", label: "2 - Anulación de documento soporte en adquisiciones efectuadas a no obligados a facturar" },
  { id: "3", codigo: "3", label: "3 - Rebaja o descuento total o parcial" },
  { id: "4", codigo: "4", label: "4 - Ajuste de precio o corrección de valores" },
  { id: "5", codigo: "5", label: "5 - Otros motivos" }
];

/**
 * Valida si un tercero cumple con la totalidad de datos obligatorios requeridos por la DIAN
 * para la emisión de un Documento Soporte Electrónico.
 * @param {Object} tercero
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
export function validateTerceroForDian(tercero) {
  const errors = [];
  const warnings = [];

  if (!tercero) {
    return { isValid: false, errors: ["No se ha seleccionado ningún tercero."], warnings: [] };
  }

  // 1. Nombre o Razón Social
  const nombre = (tercero.razonSocial || `${tercero.nombre || ""} ${tercero.apellidos || ""}`).trim();
  if (!nombre) {
    errors.push("Razón social o Nombre completo del tercero es requerido.");
  }

  // 2. Tipo y Número de Documento
  const tipoDoc = (tercero.tipoDocumento || "").toUpperCase();
  const numDoc = (tercero.nroDocumento || tercero.numeroDocumento || "").trim();

  if (!numDoc) {
    errors.push("Número de documento es requerido.");
  } else if (tipoDoc === "NIT") {
    // Si es NIT, debe tener guion y DV válido
    if (!numDoc.includes("-")) {
      errors.push("El NIT debe incluir guion y Dígito de Verificación (ej: 900123456-7).");
    } else {
      const parts = numDoc.split("-");
      const computedDV = calculateNIT_DV(parts[0]);
      if (computedDV === null || String(computedDV) !== String(parts[1]).trim()) {
        errors.push(`El Dígito de Verificación (${parts[1]}) no es válido para el NIT ${parts[0]} (debería ser ${computedDV}).`);
      }
    }
  }

  // 3. Dirección
  const direccion = (tercero.direccion || "").trim();
  if (!direccion) {
    errors.push("Dirección de domicilio es requerida por la DIAN.");
  }

  // 4. Ciudad / Municipio
  const ciudad = (tercero.ciudad || "").trim();
  if (!ciudad) {
    errors.push("Ciudad / Municipio de domicilio es requerido.");
  }

  // 5. Correo electrónico
  const email = (tercero.email || "").trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    errors.push("Correo electrónico es requerido para la transmisión electrónica.");
  } else if (!emailRegex.test(email)) {
    errors.push("El correo electrónico no tiene un formato válido.");
  }

  // 6. Teléfono o Celular
  const telefono = (tercero.telefono || tercero.celular || "").trim();
  if (!telefono) {
    errors.push("Teléfono de contacto es requerido.");
  }

  // 7. Código Postal (Debe tener 6 dígitos numéricos)
  const codigoPostal = (tercero.codigoPostal || "").trim();
  if (!codigoPostal) {
    errors.push("Código postal de 6 dígitos es obligatorio para la DIAN.");
  } else if (!/^\d{6}$/.test(codigoPostal)) {
    errors.push(`El código postal debe contener exactamente 6 dígitos numéricos (actual: "${codigoPostal}").`);
  }

  // 8. Tipo de persona
  const tipoPersona = (tercero.tipoPersona || "").trim();
  if (!tipoPersona) {
    errors.push("Tipo de persona (Natural o Jurídica) es requerido.");
  }

  // 9. Procedencia
  const procedencia = (tercero.identificadorProcedencia || "").trim();
  if (!procedencia) {
    warnings.push("Identificador de procedencia no especificado (se asumirá Nacional).");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
