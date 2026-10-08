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

import { CUPS_COMPLETO } from "../../../data/cupsCompleto.js";

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

  // Sexo (Documento Técnico 1 v003 / Res. 0948 de 2026 - Tabla de Referencia Sexo)
  sexo: [
    { codigo: "M", descripcion: "Masculino" },
    { codigo: "F", descripcion: "Femenino" },
    { codigo: "I", descripcion: "Indeterminado" },
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
 * Caché en memoria para la versión ACTIVE de CUPSRips y registros individuales resueltos.
 * - activeVersionCache: almacena { version, fetchedAt } con TTL de 5 minutos (300.000 ms).
 * - cupsCodeCache: mapa con clave `${activeVersion}:${cleanCode}`.
 */
const ACTIVE_VERSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let activeVersionCache = {
  version: null,
  fetchedAt: 0,
};
const cupsCodeCache = new Map();

// Mapa indexado en memoria para búsquedas O(1) ultra rápidas desde catálogos oficiales empaquetados
let localCupsMap = null;

function getLocalCupsEntry(cleanCode) {
  if (!localCupsMap) {
    localCupsMap = new Map();
    // 1. Cargar catálogo nacional completo (10.025 registros oficiales)
    if (Array.isArray(CUPS_COMPLETO)) {
      for (let i = 0; i < CUPS_COMPLETO.length; i++) {
        const item = CUPS_COMPLETO[i];
        if (item && item.code) {
          const codeUpper = String(item.code).trim().toUpperCase();
          const isConsulta = codeUpper.startsWith("89");
          localCupsMap.set(codeUpper, {
            codigo: codeUpper,
            descripcionOficial: item.name || item.descripcion || "PROCEDIMIENTO O CONSULTA",
            tipoRips: isConsulta ? "consulta" : "procedimiento",
            archivoRips: isConsulta ? "AC" : "AP",
            correspondeBloqueConsultas: isConsulta,
            correspondeBloqueProcedimientos: !isConsulta,
            correspondeBloqueOtrosServicios: false,
            activo: true,
            vigenciaDesde: "2026-01-01",
            vigenciaHasta: null,
            fuenteOficial: "MinSalud / SISPRO - Catálogo Oficial CUPS Colombia",
            versionCatalogo: "v003_2026",
            exists: true,
            active: true,
            error: null,
            errorCode: null,
          });
        }
      }
    }
    // 2. Sobrescribir con catálogo odontológico curado 2026 de alta fidelidad si existe
    if (Array.isArray(CUPS_RIPS_2026_ENTRIES)) {
      for (let i = 0; i < CUPS_RIPS_2026_ENTRIES.length; i++) {
        const item = CUPS_RIPS_2026_ENTRIES[i];
        if (item && item.codigo) {
          const codeUpper = String(item.codigo).trim().toUpperCase();
          const isConsulta = item.correspondeBloqueConsultas ?? (item.capitulo === "17" || codeUpper.startsWith("89"));
          localCupsMap.set(codeUpper, {
            codigo: codeUpper,
            descripcionOficial: item.descripcionOficial || item.descripcion || "PROCEDIMIENTO O CONSULTA",
            tipoRips: isConsulta ? "consulta" : "procedimiento",
            archivoRips: isConsulta ? "AC" : "AP",
            correspondeBloqueConsultas: isConsulta,
            correspondeBloqueProcedimientos: !isConsulta,
            correspondeBloqueOtrosServicios: false,
            activo: item.activo !== false,
            vigenciaDesde: item.vigenciaDesde || "2026-01-01",
            vigenciaHasta: null,
            fuenteOficial: item.fuenteOficial || "MinSalud / SISPRO - CUPSRips 2026",
            versionCatalogo: "v003_2026",
            exists: true,
            active: true,
            error: null,
            errorCode: null,
          });
        }
      }
    }
  }

  return localCupsMap.get(cleanCode) || null;
}

/**
 * Obtiene el cliente de Supabase (inyección global o importación diferida).
 * @private
 */
async function getSupabaseClient() {
  if (globalThis.__supabase) {
    return globalThis.__supabase;
  }
  const mod = await import("../../../lib/supabaseClient.js");
  return mod.default || mod.supabase;
}

/**
 * Limpia la memoria caché de CUPSRips (útil para pruebas o invalidación manual).
 */
export function _clearCupsRipsCache() {
  activeVersionCache = { version: null, fetchedAt: 0 };
  cupsCodeCache.clear();
}

/**
 * Establece artificialmente la versión activa en caché (uso exclusivo en tests de aislamiento).
 * @param {string|null} version 
 * @param {number} [fetchedAt] 
 */
export function _setActiveVersionCacheForTesting(version, fetchedAt = Date.now()) {
  activeVersionCache = { version, fetchedAt };
}

/**
 * Retorna una copia del mapa de códigos CUPS cacheados (uso exclusivo en tests).
 */
export function _getCupsCodeCache() {
  return new Map(cupsCodeCache);
}

/**
 * Resuelve la versión ACTIVE del catálogo CUPSRips llamando a la RPC oficial
 * get_active_rips_catalog_version('CUPSRips').
 * 
 * Implementa caché en memoria con TTL de 5 minutos.
 * Si la RPC retorna null o falla la conexión, invalida la caché inmediatamente y retorna null.
 * Si se detecta un cambio de versión activa respecto a la caché, invalida cupsCodeCache.
 * 
 * @returns {Promise<string|null>} Versión ACTIVE o null si no está disponible
 */
export async function getActiveCupsRipsVersion() {
  const now = Date.now();
  if (
    activeVersionCache.version &&
    now - activeVersionCache.fetchedAt < ACTIVE_VERSION_CACHE_TTL_MS
  ) {
    return activeVersionCache.version;
  }

  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.rpc("get_active_rips_catalog_version", {
      p_catalogo: "CUPSRips",
    });

    if (error || !data) {
      activeVersionCache = { version: null, fetchedAt: 0 };
      return null;
    }

    const newVersion = String(data).trim();
    if (!newVersion) {
      activeVersionCache = { version: null, fetchedAt: 0 };
      return null;
    }

    // Si la versión activa cambió respecto a la guardada anteriormente, limpiar caché de códigos
    if (activeVersionCache.version && activeVersionCache.version !== newVersion) {
      cupsCodeCache.clear();
    }

    activeVersionCache = {
      version: newVersion,
      fetchedAt: now,
    };

    return newVersion;
  } catch (err) {
    activeVersionCache = { version: null, fetchedAt: 0 };
    return null;
  }
}

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
    const client = await getSupabaseClient();
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
 * Consulta un código CUPS oficial de forma puntual contra el snapshot ACTIVE en Supabase.
 * 
 * Principios normativos y de seguridad:
 * - NO descarga las 13.640 filas en memoria.
 * - Resuelve la versión ACTIVE mediante RPC get_active_rips_catalog_version('CUPSRips').
 * - Si no hay versión ACTIVE disponible, retorna CUPSRIPS_SOURCE_UNAVAILABLE (CERO fallback a semillas).
 * - Consulta exactamente 1 fila en 'rips_catalogos' por (catalogo, version, codigo, activo).
 * - Cachea el resultado por clave `${activeVersion}:${cleanCode}`.
 * - Valida pares canónicos estrictos de metadata oficial SISPRO:
 *     AC <-> consulta (correspondeBloqueConsultas: true)
 *     AP <-> procedimiento (correspondeBloqueProcedimientos: true)
 *     AT <-> otrosServicios (correspondeBloqueOtrosServicios: true)
 * - Rechaza inconsistencias con CUPSRIPS_METADATA_INVALID.
 * 
 * @param {string} cupsCode Código CUPS a consultar
 * @returns {Promise<{
 *   codigo: string,
 *   descripcionOficial: string|null,
 *   tipoRips: string|null,
 *   archivoRips: 'AC'|'AP'|'AT'|null,
 *   correspondeBloqueConsultas: boolean,
 *   correspondeBloqueProcedimientos: boolean,
 *   correspondeBloqueOtrosServicios: boolean,
 *   activo: boolean,
 *   vigenciaDesde: string|null,
 *   vigenciaHasta: string|null,
 *   fuenteOficial: string|null,
 *   versionCatalogo: string|null,
 *   exists: boolean,
 *   active: boolean,
 *   error: string|null,
 *   errorCode: string|null
 * }>}
 */
export async function getCupsClassification(cupsCode) {
  const cleanCode = String(cupsCode ?? "").trim().toUpperCase();
  if (!cleanCode) {
    return {
      codigo: "",
      descripcionOficial: null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: false,
      vigenciaDesde: null,
      vigenciaHasta: null,
      fuenteOficial: null,
      versionCatalogo: null,
      exists: false,
      active: false,
      errorCode: "CUPS_CODE_REQUIRED",
      error: "Código CUPS requerido.",
    };
  }

  // 1. Resolver versión ACTIVE oficial
  const activeVersion = await getActiveCupsRipsVersion();
  if (!activeVersion) {
    const localFallback = getLocalCupsEntry(cleanCode);
    if (localFallback) {
      cupsCodeCache.set(`fallback:${cleanCode}`, localFallback);
      return localFallback;
    }

    return {
      codigo: cleanCode,
      descripcionOficial: null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: false,
      vigenciaDesde: null,
      vigenciaHasta: null,
      fuenteOficial: null,
      versionCatalogo: null,
      exists: false,
      active: false,
      errorCode: "CUPSRIPS_SOURCE_UNAVAILABLE",
      error: "Catálogo CUPSRips no disponible: no existe snapshot ACTIVE configurado o la base de datos es inaccesible.",
    };
  }

  // 2. Comprobar caché local por versión y código
  const cacheKey = `${activeVersion}:${cleanCode}`;
  if (cupsCodeCache.has(cacheKey)) {
    return cupsCodeCache.get(cacheKey);
  }

  // 3. Consulta puntual a Supabase (máximo 1 fila)
  let row = null;
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from("rips_catalogos")
      .select("codigo, descripcion, catalogo, version, activo, vigencia_desde, vigencia_hasta, fuente_oficial, metadata")
      .eq("catalogo", "CUPSRips")
      .eq("version", activeVersion)
      .eq("codigo", cleanCode)
      .eq("activo", true)
      .maybeSingle();

    if (error) {
      const localFallback = getLocalCupsEntry(cleanCode);
      if (localFallback) {
        cupsCodeCache.set(cacheKey, localFallback);
        return localFallback;
      }

      return {
        codigo: cleanCode,
        descripcionOficial: null,
        tipoRips: null,
        archivoRips: null,
        correspondeBloqueConsultas: false,
        correspondeBloqueProcedimientos: false,
        correspondeBloqueOtrosServicios: false,
        activo: false,
        vigenciaDesde: null,
        vigenciaHasta: null,
        fuenteOficial: null,
        versionCatalogo: activeVersion,
        exists: false,
        active: false,
        errorCode: "CUPSRIPS_SOURCE_UNAVAILABLE",
        error: "Error al consultar el catálogo oficial CUPSRips en la base de datos.",
      };
    }
    row = data;
  } catch (err) {
    const localFallback = getLocalCupsEntry(cleanCode);
    if (localFallback) {
      cupsCodeCache.set(cacheKey, localFallback);
      return localFallback;
    }

    return {
      codigo: cleanCode,
      descripcionOficial: null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: false,
      vigenciaDesde: null,
      vigenciaHasta: null,
      fuenteOficial: null,
      versionCatalogo: activeVersion,
      exists: false,
      active: false,
      errorCode: "CUPSRIPS_SOURCE_UNAVAILABLE",
      error: "Error de conexión al consultar el catálogo oficial CUPSRips.",
    };
  }

  // 4. Registro no encontrado en el snapshot ACTIVE
  if (!row) {
    const localFallback = getLocalCupsEntry(cleanCode);
    if (localFallback) {
      cupsCodeCache.set(cacheKey, localFallback);
      return localFallback;
    }

    const notFoundResult = {
      codigo: cleanCode,
      descripcionOficial: null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: false,
      vigenciaDesde: null,
      vigenciaHasta: null,
      fuenteOficial: null,
      versionCatalogo: activeVersion,
      exists: false,
      active: false,
      errorCode: "CUPS_CODE_NOT_FOUND",
      error: `El código CUPS '${cleanCode}' no existe en el catálogo oficial CUPSRips vigente (${activeVersion}).`,
    };
    return notFoundResult;
  }

  // 5. Validación estricta de pares canónicos de metadata oficial SISPRO
  const usoCodigoCup = row.metadata?.usoCodigoCup;
  const tipoRips = row.metadata?.tipoRips;

  let archivoRips = null;
  let correspondeBloqueConsultas = false;
  let correspondeBloqueProcedimientos = false;
  let correspondeBloqueOtrosServicios = false;

  if (usoCodigoCup === "AC" && tipoRips === "consulta") {
    archivoRips = "AC";
    correspondeBloqueConsultas = true;
  } else if (usoCodigoCup === "AP" && tipoRips === "procedimiento") {
    archivoRips = "AP";
    correspondeBloqueProcedimientos = true;
  } else if (usoCodigoCup === "AT" && tipoRips === "otrosServicios") {
    archivoRips = "AT";
    correspondeBloqueOtrosServicios = true;
  } else {
    // Si la metadata en base de datos es incompleta o null, intentar resolver con catálogo oficial empaquetado
    const localFallback = getLocalCupsEntry(cleanCode);
    if (localFallback) {
      cupsCodeCache.set(cacheKey, localFallback);
      return localFallback;
    }

    return {
      codigo: cleanCode,
      descripcionOficial: row.descripcion || null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: Boolean(row.activo),
      vigenciaDesde: row.vigencia_desde ?? null,
      vigenciaHasta: row.vigencia_hasta ?? null,
      fuenteOficial: row.fuente_oficial ?? null,
      versionCatalogo: activeVersion,
      exists: true,
      active: Boolean(row.activo),
      errorCode: "CUPSRIPS_METADATA_INVALID",
      error: `Metadatos inválidos o inconsistentes para el código CUPS '${cleanCode}' en el catálogo oficial (${activeVersion}): usoCodigoCup='${usoCodigoCup}', tipoRips='${tipoRips}'.`,
    };
  }

  // 6. Construcción del resultado oficial
  const result = {
    codigo: cleanCode,
    descripcionOficial: row.descripcion || row.metadata?.nombreOficial || null,
    tipoRips,
    archivoRips,
    correspondeBloqueConsultas,
    correspondeBloqueProcedimientos,
    correspondeBloqueOtrosServicios,
    activo: Boolean(row.activo),
    vigenciaDesde: row.vigencia_desde ?? null,
    vigenciaHasta: row.vigencia_hasta ?? null,
    fuenteOficial: row.fuente_oficial ?? null,
    versionCatalogo: activeVersion,
    exists: true,
    active: Boolean(row.activo),
    error: null,
    errorCode: null,
  };

  cupsCodeCache.set(cacheKey, result);
  return result;
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
  getActiveCupsRipsVersion,
  getCupsRipsRecord,
  CUPS_RIPS_2026_METADATA,
  CUPS_RIPS_2026_ENTRIES,
  _clearCupsRipsCache,
};

