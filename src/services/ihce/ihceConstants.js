/**
 * =============================================================================
 * ODONTOCLOUD — CONSTANTES Y TERMINOLOGÍAS OFICIALES IHCE (COLOMBIA 2026)
 * Archivo: src/services/ihce/ihceConstants.js
 * =============================================================================
 * Especificaciones de acuerdo con Resolución 866 de 2021 y Resolución 1888 de 2025:
 * - HL7 FHIR R4
 * - Perfiles Nacionales de Colombia (Vulcano)
 * - Sistemas de Codificación oficiales (DANE, Minsalud, SISPRO)
 * =============================================================================
 */

// SALVAGUARDA DE SEGURIDAD ESTRICTA:
// Deshabilitado por defecto (fail-closed). Solo se activa si IHCE_LIVE_ENABLED='true'
// en entorno de ejecución controlado. Producción se mantiene estrictamente bloqueada.
export const IHCE_LIVE_ENABLED = typeof process !== 'undefined' && process.env?.IHCE_LIVE_ENABLED === 'true';
export const IHCE_ENVIRONMENT = (typeof process !== 'undefined' && process.env?.IHCE_ENVIRONMENT) || 'SANDBOX_MOCK';
export const IS_PRODUCTION_BLOCKED = true;

export const FHIR_SYSTEMS = {
  // Identificadores de Sujetos y Prestadores
  IDENTIFICACION_USUARIO: "https://minsalud.gov.co/ihce/identificacion-usuario",
  TIPOS_IDENTIFICACION: "https://minsalud.gov.co/ihce/tipos-identificacion",
  REPS: "https://minsalud.gov.co/ihce/reps",
  REPS_PRESTADOR: "https://minsalud.gov.co/ihce/reps-prestador",
  REPS_SEDE: "https://minsalud.gov.co/ihce/reps-sede",
  REPS_SERVICIO: "https://minsalud.gov.co/ihce/reps-servicio",
  RETHUS: "https://minsalud.gov.co/ihce/rethus",
  NIT: "https://minsalud.gov.co/ihce/nit",

  // Terminologías Clínicas
  CIE10: "http://hl7.org/fhir/sid/icd-10",
  CUPS: "https://minsalud.gov.co/ihce/cups",
  CUM: "https://minsalud.gov.co/ihce/cum",
  LOINC: "http://loinc.org",
  SNOMED_CT: "http://snomed.info/sct",

  // Catálogos DANE y Administrativos
  DIVIPOLA: "https://minsalud.gov.co/ihce/divipola",
  ETNIAS: "https://minsalud.gov.co/ihce/etnias",
  CAUSA_EXTERNA: "https://minsalud.gov.co/ihce/causa-externa",
  FINALIDAD_CONSULTA: "https://minsalud.gov.co/ihce/finalidad-consulta",
  MODALIDAD_ATENCION: "https://minsalud.gov.co/ihce/modalidad-atencion",
  VIAS_ADMINISTRACION: "https://minsalud.gov.co/ihce/vias-administracion",

  // Perfiles y Extensiones Oficiales de Colombia
  EXT_MUNICIPIO: "https://minsalud.gov.co/fhir/StructureDefinition/CoMunicipio",
  EXT_DEPARTAMENTO: "https://minsalud.gov.co/fhir/StructureDefinition/CoDepartamento",
  EXT_ETNIA: "https://minsalud.gov.co/fhir/StructureDefinition/CoPertenenciaEtnica",
  EXT_MODALIDAD: "https://minsalud.gov.co/fhir/StructureDefinition/CoModalidadAtencion",
  EXT_CAUSA_EXTERNA: "https://minsalud.gov.co/fhir/StructureDefinition/CoCausaExterna",
  EXT_TIPO_DIAGNOSTICO: "https://minsalud.gov.co/fhir/StructureDefinition/CoTipoDiagnostico",
  
  // Perfiles Nacionales StructureDefinition
  PROFILE_BUNDLE_RDA: "https://minsalud.gov.co/fhir/StructureDefinition/BundleRDA-Co",
  PROFILE_COMPOSITION: "https://minsalud.gov.co/fhir/StructureDefinition/CompositionRDA-Co",
  PROFILE_PATIENT: "https://minsalud.gov.co/fhir/StructureDefinition/Patient-Co",
  PROFILE_PRACTITIONER: "https://minsalud.gov.co/fhir/StructureDefinition/Practitioner-Co",
  PROFILE_ORGANIZATION: "https://minsalud.gov.co/fhir/StructureDefinition/Organization-Co",
  PROFILE_ENCOUNTER: "https://minsalud.gov.co/fhir/StructureDefinition/Encounter-Co",
  PROFILE_CONDITION: "https://minsalud.gov.co/fhir/StructureDefinition/Condition-Co",
  PROFILE_PROCEDURE: "https://minsalud.gov.co/fhir/StructureDefinition/Procedure-Co",
  PROFILE_MEDICATION_REQUEST: "https://minsalud.gov.co/fhir/StructureDefinition/MedicationRequest-Co"
};

// Códigos de Tipo de Documento Minsalud
export const TIPOS_DOCUMENTO_COLOMBIA = {
  CC: { code: "CC", display: "Cédula de Ciudadanía" },
  TI: { code: "TI", display: "Tarjeta de Identidad" },
  RC: { code: "RC", display: "Registro Civil" },
  CE: { code: "CE", display: "Cédula de Extranjería" },
  PA: { code: "PA", display: "Pasaporte" },
  MS: { code: "MS", display: "Menor sin Identificación" },
  AS: { code: "AS", display: "Adulto sin Identificación" },
  PE: { code: "PE", display: "Permiso Especial de Permanencia" },
  PT: { code: "PT", display: "Permiso por Protección Temporal" }
};

// Pertenencia Étnica DANE
export const ETNIAS_DANE = {
  "1": { code: "1", display: "Indígena" },
  "2": { code: "2", display: "ROM (Gitano)" },
  "3": { code: "3", display: "Raizal del Archipiélago de San Andrés y Providencia" },
  "4": { code: "4", display: "Palenquero de San Basilio" },
  "5": { code: "5", display: "Negro(a), Mulato(a), Afrocolombiano(a)" },
  "6": { code: "6", display: "Ninguna de las anteriores" }
};

// Modalidad de Atención Minsalud
export const MODALIDADES_ATENCION = {
  "01": { code: "01", display: "Intramural" },
  "02": { code: "02", display: "Extramural domiciliaria" },
  "03": { code: "03", display: "Extramural unidad móvil" },
  "04": { code: "04", display: "Extramural jornada de salud" },
  "06": { code: "06", display: "Telemedicina interactiva" },
  "07": { code: "07", display: "Telemedicina no interactiva" },
  "08": { code: "08", display: "Telemedicina telexperticia" },
  "09": { code: "09", display: "Telemonitoreo" }
};

// Tipo de Diagnóstico Minsalud
export const TIPOS_DIAGNOSTICO = {
  1: { code: "1", display: "Impresión diagnóstica" },
  2: { code: "2", display: "Confirmado nuevo" },
  3: { code: "3", display: "Confirmado repetido" }
};

// Código LOINC para Documento Resumen Digital de Atención (RDA)
export const LOINC_RDA_CONSULTA = {
  code: "34133-9",
  display: "Summarization of episode note",
  system: FHIR_SYSTEMS.LOINC
};

// Servicios Asistenciales Habilitados en REPS (MinSalud Colombia)
export const SERVICIOS_HABILITADOS_REPS = {
  ODONTOLOGIA_GENERAL: {
    code: "334",
    display: "Odontología General",
    system: FHIR_SYSTEMS.REPS_SERVICIO
  },
  ODONTOPEDIATRIA: {
    code: "335",
    display: "Odontopediatría",
    system: FHIR_SYSTEMS.REPS_SERVICIO
  },
  ORTODONCIA: {
    code: "336",
    display: "Ortodoncia y Ortopedia Maxilar",
    system: FHIR_SYSTEMS.REPS_SERVICIO
  },
  PERIODONCIA: {
    code: "337",
    display: "Periodoncia",
    system: FHIR_SYSTEMS.REPS_SERVICIO
  },
  ENDODONCIA: {
    code: "338",
    display: "Endodoncia",
    system: FHIR_SYSTEMS.REPS_SERVICIO
  },
  CIRUGIA_ORAL: {
    code: "339",
    display: "Cirugía Oral y Maxilofacial",
    system: FHIR_SYSTEMS.REPS_SERVICIO
  },
  REHABILITACION_ORAL: {
    code: "340",
    display: "Rehabilitación Oral",
    system: FHIR_SYSTEMS.REPS_SERVICIO
  }
};

