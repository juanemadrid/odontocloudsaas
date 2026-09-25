/**
 * Catálogos Oficiales de Referencia SISPRO / MinSalud
 * Documento Técnico 1 Versión 003 (15 de julio de 2026) y Resolución 948 de 2026.
 * 
 * Cada elemento versionado contiene:
 * - codigo
 * - descripcion
 * - catalogo
 * - version
 * - vigencia_desde
 * - vigencia_hasta
 * - activo
 * - fuente_oficial
 */

// Semilla oficial base extraída de las tablas maestras vigentes de SISPRO:
export const OFFICIAL_SEED_CATALOGS = {
  // RIPSTipoUsuarioVersion2 (01 al 14 publicado por SISPRO. El código 14 fue incorporado en v003)
  RIPSTipoUsuarioVersion2: [
    { codigo: "01", descripcion: "Contributivo cotizante" },
    { codigo: "02", descripcion: "Contributivo beneficiario" },
    { codigo: "03", descripcion: "Contributivo adicional" },
    { codigo: "04", descripcion: "Subsidiado" },
    { codigo: "05", descripcion: "No afiliado" },
    { codigo: "06", descripcion: "Especial o Excepción cotizante" },
    { codigo: "07", descripcion: "Especial o Excepción beneficiario" },
    { codigo: "08", descripcion: "Personas privadas de la libertad a cargo del Fondo Nacional de Salud" },
    { codigo: "09", descripcion: "Tomador / Amparado ARL" },
    { codigo: "10", descripcion: "Tomador / Amparado SOAT" },
    { codigo: "11", descripcion: "Tomador / Amparado Planes Voluntarios de Salud" },
    { codigo: "12", descripcion: "Particular" },
    { codigo: "13", descripcion: "Especial o excepción no cotizante (Ley 352 de 1997)" },
    { codigo: "14", descripcion: "Lesionado en accidente de tránsito sin seguro SOAT" },
  ].map(it => ({
    ...it,
    catalogo: "RIPSTipoUsuarioVersion2",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Tabla de Referencia RIPSTipoUsuarioVersion2",
  })),

  // LstSiNo (Valores oficiales SISPRO: 01=SI, 02=NO)
  LstSiNo: [
    { codigo: "01", descripcion: "SI" },
    { codigo: "02", descripcion: "NO" },
  ].map(it => ({
    ...it,
    catalogo: "LstSiNo",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Tabla de Referencia LstSiNo",
  })),

  // Servicios REPS Odontológicos Oficiales (MinSalud REPS)
  servicios_reps: [
    { codigo: "334", descripcion: "Odontología General" },
    { codigo: "311", descripcion: "Endodoncia" },
    { codigo: "338", descripcion: "Ortodoncia" },
    { codigo: "343", descripcion: "Periodoncia" },
    { codigo: "347", descripcion: "Rehabilitación Oral" },
    { codigo: "396", descripcion: "Odontopediatría" },
    { codigo: "410", descripcion: "Cirugía Oral" },
    { codigo: "411", descripcion: "Cirugía Maxilofacial" },
  ].map(it => ({
    ...it,
    catalogo: "servicios_reps",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "Registro Especial de Prestadores de Servicios de Salud (REPS)",
  })),

  // Tipos de Documento
  tipos_documento: [
    { codigo: "CC", descripcion: "Cédula de Ciudadanía" },
    { codigo: "CE", descripcion: "Cédula de Extranjería" },
    { codigo: "PA", descripcion: "Pasaporte" },
    { codigo: "RC", descripcion: "Registro Civil" },
    { codigo: "TI", descripcion: "Tarjeta de Identidad" },
    { codigo: "AS", descripcion: "Adulto sin identificación" },
    { codigo: "MS", descripcion: "Menor sin identificación" },
    { codigo: "CD", descripcion: "Carné Diplomático" },
    { codigo: "SC", descripcion: "Salvo Conducto" },
    { codigo: "PE", descripcion: "Permiso Especial de Permanencia" },
    { codigo: "PT", descripcion: "Permiso por Protección Temporal" },
    { codigo: "DE", descripcion: "Documento Extranjero" },
  ].map(it => ({
    ...it,
    catalogo: "tipos_documento",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Tabla de Referencia Tipos de Documento",
  })),

  // Sexo
  sexo: [
    { codigo: "H", descripcion: "Hombre" },
    { codigo: "M", descripcion: "Mujer" },
  ].map(it => ({
    ...it,
    catalogo: "sexo",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Zonas Territoriales
  zonas_territoriales: [
    { codigo: "01", descripcion: "Urbana" },
    { codigo: "02", descripcion: "Rural" },
  ].map(it => ({
    ...it,
    catalogo: "zonas_territoriales",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Modalidad de Atención
  modalidad_atencion: [
    { codigo: "01", descripcion: "Intramural" },
    { codigo: "02", descripcion: "Extramural unidad móvil" },
    { codigo: "03", descripcion: "Extramural domiciliaria" },
    { codigo: "04", descripcion: "Telemedicina interactiva" },
    { codigo: "06", descripcion: "Telemedicina no interactiva" },
    { codigo: "07", descripcion: "Telemedicina telexperticia" },
    { codigo: "08", descripcion: "Telemedicina telemonitoreo" },
  ].map(it => ({
    ...it,
    catalogo: "modalidad_atencion",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Grupo de Servicios
  grupo_servicios: [
    { codigo: "01", descripcion: "Consulta externa" },
    { codigo: "02", descripcion: "Apoyo diagnóstico y complementación terapéutica" },
    { codigo: "03", descripcion: "Internación" },
    { codigo: "04", descripcion: "Quirúrgico" },
    { codigo: "05", descripcion: "Atención inmediata" },
  ].map(it => ({
    ...it,
    catalogo: "grupo_servicios",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Finalidad de Consulta
  finalidad_consulta: [
    { codigo: "10", descripcion: "Diagnóstico" },
    { codigo: "11", descripcion: "Terapéutico" },
    { codigo: "16", descripcion: "Protección específica" },
  ].map(it => ({
    ...it,
    catalogo: "finalidad_consulta",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Finalidad de Procedimientos
  finalidad_procedimiento: [
    { codigo: "01", descripcion: "Diagnóstico" },
    { codigo: "02", descripcion: "Terapéutico" },
    { codigo: "03", descripcion: "Protección específica" },
    { codigo: "04", descripcion: "Detección temprana" },
    { codigo: "05", descripcion: "No aplica" },
  ].map(it => ({
    ...it,
    catalogo: "finalidad_procedimiento",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Causa Externa / Motivo de Atención
  causa_externa: [
    { codigo: "38", descripcion: "Enfermedad general" },
    { codigo: "01", descripcion: "Accidente de trabajo" },
    { codigo: "02", descripcion: "Accidente de tránsito" },
  ].map(it => ({
    ...it,
    catalogo: "causa_externa",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Concepto de Recaudo
  concepto_recaudo: [
    { codigo: "01", descripcion: "Copago" },
    { codigo: "02", descripcion: "Cuota moderadora" },
    { codigo: "03", descripcion: "Pagos compartidos en planes voluntarios de salud" },
    { codigo: "04", descripcion: "Anticipo" },
    { codigo: "05", descripcion: "No aplica / Ninguno" },
  ].map(it => ({
    ...it,
    catalogo: "concepto_recaudo",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Tipo de Diagnóstico Principal
  tipo_diagnostico: [
    { codigo: "01", descripcion: "Impresión diagnóstica" },
    { codigo: "02", descripcion: "Confirmado nuevo" },
    { codigo: "03", descripcion: "Confirmado repetido" },
  ].map(it => ({
    ...it,
    catalogo: "tipo_diagnostico",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Vía de Ingreso al Servicio de Salud (Procedimientos)
  via_ingreso: [
    { codigo: "01", descripcion: "Demanda espontánea" },
    { codigo: "02", descripcion: "Remitido" },
    { codigo: "03", descripcion: "Urgencias" },
  ].map(it => ({
    ...it,
    catalogo: "via_ingreso",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
  })),
};

import {
  CUPS_RIPS_2026_METADATA,
  CUPS_RIPS_2026_ENTRIES,
  getCupsRipsRecord,
} from "./catalogs/cupsRips2026.js";

const catalogMemoryCache = new Map();

/**
 * Consulta un catálogo oficial versionado desde la base de datos (con fallback a la semilla oficial).
 * 
 * @param {string} catalogName 
 * @param {string} [version='v003_2026'] 
 * @returns {Promise<Array<object>>}
 */
export async function getOfficialCatalog(catalogName, version = "v003_2026") {
  const cacheKey = `${catalogName}_${version}`;
  if (catalogMemoryCache.has(cacheKey)) {
    return catalogMemoryCache.get(cacheKey);
  }

  try {
    const client = globalThis.__supabase || (await import("../../../lib/supabaseClient.js")).default;
    const { data, error } = await client
      .from("rips_catalogos")
      .select("codigo, descripcion, catalogo, version, vigencia_desde, vigencia_hasta, activo, fuente_oficial, metadata")
      .eq("catalogo", catalogName);

    if (!error && Array.isArray(data) && data.length > 0) {
      // Si la tabla contiene metadata JSONB con tipo_rips o bloque_consultas, se aplanan
      const mapped = data.map(d => ({
        ...d,
        tipo_rips: d.metadata?.tipo_rips || (d.tipo_rips ?? null),
        bloque_consultas: d.metadata?.bloque_consultas ?? d.bloque_consultas,
        bloque_procedimientos: d.metadata?.bloque_procedimientos ?? d.bloque_procedimientos,
      }));
      catalogMemoryCache.set(cacheKey, mapped);
      return mapped;
    }
  } catch (err) {
    console.warn(`getOfficialCatalog [${catalogName}]: usando semilla oficial offline.`);
  }

  const fallback = OFFICIAL_SEED_CATALOGS[catalogName] || [];
  catalogMemoryCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Valida un código contra el catálogo oficial correspondiente.
 * 
 * @param {string} catalogName 
 * @param {string} code 
 * @param {string} [version='v003_2026'] 
 * @returns {Promise<{ valid: boolean, entry: object|null, error?: string }>}
 */
export async function validateCatalogValue(catalogName, code, version = "v003_2026") {
  const cleanCode = String(code || "").trim();
  if (!cleanCode) {
    return { valid: false, entry: null, error: `Código vacío para catálogo ${catalogName}` };
  }

  const catalog = await getOfficialCatalog(catalogName, version);
  const entry = catalog.find(item => item.codigo === cleanCode);

  if (!entry) {
    return {
      valid: false,
      entry: null,
      error: `El código '${cleanCode}' no existe en el catálogo oficial '${catalogName}' (${version}).`,
    };
  }

  if (entry.activo === false) {
    return {
      valid: false,
      entry,
      error: `El código '${cleanCode}' está inactivo en el catálogo oficial '${catalogName}' (${version}).`,
    };
  }

  return { valid: true, entry };
}

/**
 * Consulta un código CUPS oficial y devuelve todos sus atributos de reporte RIPS.
 * Cumple con los requerimientos normativos:
 * - código
 * - descripción oficial
 * - estado/vigencia (activo)
 * - tipo o clasificación para RIPS ('consulta' | 'procedimiento')
 * - si corresponde al bloque consultas
 * - si corresponde al bloque procedimientos
 * - fuente oficial
 * - versión/vigencia del catálogo
 * 
 * @param {string} cupsCode
 * @param {string} [version='v003_2026']
 * @returns {Promise<{
 *   codigo: string,
 *   descripcionOficial: string|null,
 *   tipoRips: string|null,
 *   correspondeBloqueConsultas: boolean,
 *   correspondeBloqueProcedimientos: boolean,
 *   activo: boolean,
 *   vigenciaDesde: string|null,
 *   vigenciaHasta: string|null,
 *   fuenteOficial: string|null,
 *   versionCatalogo: string,
 *   exists: boolean,
 *   active: boolean,
 *   error: string|null
 * }>}
 */
/**
 * Consulta un código CUPS oficial y devuelve todos sus atributos de reporte RIPS
 * desde el catálogo independiente CUPSRips (Resolución 2706 de 2025).
 * 
 * Atributos oficiales:
 * - código
 * - descripción oficial inmutable
 * - estado/vigencia (activo)
 * - tipo o clasificación para RIPS ('consulta' | 'procedimiento')
 * - si corresponde al bloque consultas (Archivo AC)
 * - si corresponde al bloque procedimientos (Archivo AP)
 * - fuente oficial con trazabilidad de capítulo
 * - versión del esquema RIPS vs versión de resolución CUPS separadas
 * 
 * @param {string} cupsCode
 * @returns {Promise<object>}
 */
export async function getCupsClassification(cupsCode) {
  return await getCupsRipsRecord(cupsCode);
}

export {
  CUPS_RIPS_2026_METADATA,
  CUPS_RIPS_2026_ENTRIES,
  getCupsRipsRecord,
};

export default {
  OFFICIAL_SEED_CATALOGS,
  getOfficialCatalog,
  validateCatalogValue,
  getCupsClassification,
  getCupsRipsRecord,
  CUPS_RIPS_2026_METADATA,
};
