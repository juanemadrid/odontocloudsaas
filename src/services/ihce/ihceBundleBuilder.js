/**
 * =============================================================================
 * ODONTOCLOUD — GENERADOR Y VALIDADOR FHIR R4 / RDA (COLOMBIA 2026)
 * Archivo: src/services/ihce/ihceBundleBuilder.js
 * =============================================================================
 * Construye y valida el Resumen Digital de Atención (RDA) de Consulta Externa
 * aplicable a Odontología, de acuerdo con la Resolución 866 de 2021 y la
 * Resolución 1888 de 2025 (HL7 FHIR R4 - Perfiles Nacionales Colombia).
 * =============================================================================
 */

import {
  FHIR_SYSTEMS,
  LOINC_RDA_CONSULTA,
  TIPOS_DOCUMENTO_COLOMBIA,
  ETNIAS_DANE,
  MODALIDADES_ATENCION,
  TIPOS_DIAGNOSTICO
} from "./ihceConstants.js";

/**
 * Genera un UUID estándar o formato URN
 */
const generateUrnUuid = () => `urn:uuid:${crypto.randomUUID()}`;

/**
 * Construye el Bundle FHIR R4 oficial (tipo document) para Consulta Odontológica
 * @param {Object} params - Datos de la atención clínica
 * @returns {Object} FHIR R4 Bundle
 */
export function buildRdaConsultaExternaBundle({
  evolution,
  patient,
  practitioner,
  organization,
  branch,
  medications = [],
  allergies = []
}) {
  if (!evolution || !patient || !practitioner || !organization) {
    throw new Error("PARAMETROS_INCOMPLETOS: evolution, patient, practitioner y organization son obligatorios.");
  }

  // Identificadores URN de referencia interna relativa en el Bundle document
  const compositionUrn = generateUrnUuid();
  const patientUrn = generateUrnUuid();
  const practitionerUrn = generateUrnUuid();
  const orgUrn = generateUrnUuid();
  const encounterUrn = generateUrnUuid();
  const locationUrn = generateUrnUuid();

  const bundleTimestamp = evolution.closed_at || evolution.fecha || new Date().toISOString();
  const bundleId = crypto.randomUUID();

  // 1. RECURSO PATIENT (Patient-Co)
  const fhirPatient = {
    fullUrl: patientUrn,
    resource: {
      resourceType: "Patient",
      id: patient.id || crypto.randomUUID(),
      meta: {
        profile: [FHIR_SYSTEMS.PROFILE_PATIENT]
      },
      identifier: [
        {
          use: "official",
          system: FHIR_SYSTEMS.IDENTIFICACION_USUARIO,
          type: {
            coding: [
              {
                system: FHIR_SYSTEMS.TIPOS_IDENTIFICACION,
                code: patient.tipo_documento,
                display: TIPOS_DOCUMENTO_COLOMBIA[patient.tipo_documento]?.display || patient.tipo_documento
              }
            ]
          },
          value: String(patient.documento)
        }
      ],
      active: patient.activo !== false,
      name: [
        {
          use: "official",
          family: patient.apellidos || "",
          given: (patient.nombres || "").split(" ").filter(Boolean)
        }
      ],
      gender: patient.genero === "F" ? "female" : patient.genero === "M" ? "male" : "other",
      birthDate: patient.fecha_nacimiento ? patient.fecha_nacimiento.substring(0, 10) : undefined,
      address: [
        {
          use: "home",
          line: patient.direccion ? [patient.direccion] : [],
          city: patient.ciudad || undefined,
          extension: patient.divipola_municipio ? [
            {
              url: FHIR_SYSTEMS.EXT_MUNICIPIO,
              valueCoding: {
                system: FHIR_SYSTEMS.DIVIPOLA,
                code: patient.divipola_municipio
              }
            }
          ] : []
        }
      ],
      telecom: [
        ...(patient.telefono ? [{ system: "phone", value: patient.telefono, use: "mobile" }] : []),
        ...(patient.email ? [{ system: "email", value: patient.email }] : [])
      ],
      extension: [
        ...(patient.pertenencia_etnica_codigo ? [{
          url: FHIR_SYSTEMS.EXT_ETNIA,
          valueCoding: {
            system: FHIR_SYSTEMS.ETNIAS,
            code: patient.pertenencia_etnica_codigo,
            display: ETNIAS_DANE[patient.pertenencia_etnica_codigo]?.display
          }
        }] : [])
      ]
    }
  };

  // 2. RECURSO PRACTITIONER (Practitioner-Co)
  const fhirPractitioner = {
    fullUrl: practitionerUrn,
    resource: {
      resourceType: "Practitioner",
      id: practitioner.id || crypto.randomUUID(),
      meta: {
        profile: [FHIR_SYSTEMS.PROFILE_PRACTITIONER]
      },
      identifier: [
        ...(practitioner.numero_documento ? [{
          use: "official",
          system: FHIR_SYSTEMS.IDENTIFICACION_USUARIO,
          type: {
            coding: [{
              system: FHIR_SYSTEMS.TIPOS_IDENTIFICACION,
              code: practitioner.tipo_documento || "CC"
            }]
          },
          value: String(practitioner.numero_documento)
        }] : []),
        ...(practitioner.registro_medico ? [{
          use: "secondary",
          system: FHIR_SYSTEMS.RETHUS,
          value: String(practitioner.registro_medico)
        }] : [])
      ],
      active: practitioner.activo !== false,
      name: [
        {
          use: "official",
          text: practitioner.nombre_completo || practitioner.full_name || "Profesional de Salud"
        }
      ],
      qualification: [
        {
          code: {
            text: practitioner.especialidad || "Odontología General"
          }
        }
      ]
    }
  };

  // 3. RECURSO ORGANIZATION (Organization-Co)
  const fhirOrganization = {
    fullUrl: orgUrn,
    resource: {
      resourceType: "Organization",
      id: organization.id || crypto.randomUUID(),
      meta: {
        profile: [FHIR_SYSTEMS.PROFILE_ORGANIZATION]
      },
      identifier: [
        ...(organization.nit ? [{
          system: FHIR_SYSTEMS.NIT,
          value: String(organization.nit)
        }] : []),
        ...((branch?.codigo_habilitacion_reps || organization?.codigo_habilitacion_reps) ? [{
          system: FHIR_SYSTEMS.REPS,
          value: String(branch?.codigo_habilitacion_reps || organization?.codigo_habilitacion_reps)
        }] : [])
      ],
      name: organization.nombre || "IPS Odontológica",
      telecom: organization.telefono ? [{ system: "phone", value: organization.telefono }] : []
    }
  };

  // 4. RECURSO LOCATION (Sede REPS)
  const fhirLocation = {
    fullUrl: locationUrn,
    resource: {
      resourceType: "Location",
      id: branch?.id || crypto.randomUUID(),
      identifier: branch?.codigo_sede_reps ? [{
        system: FHIR_SYSTEMS.REPS_SEDE,
        value: branch.codigo_sede_reps
      }] : [],
      name: branch?.nombre || "Sede Principal",
      managingOrganization: {
        reference: orgUrn
      }
    }
  };

  // 5. RECURSO ENCOUNTER (Encounter-Co)
  const fhirEncounter = {
    fullUrl: encounterUrn,
    resource: {
      resourceType: "Encounter",
      id: crypto.randomUUID(),
      meta: {
        profile: [FHIR_SYSTEMS.PROFILE_ENCOUNTER]
      },
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: "ambulatory"
      },
      subject: {
        reference: patientUrn
      },
      participant: [
        {
          individual: {
            reference: practitionerUrn
          }
        }
      ],
      period: {
        start: evolution.fecha || bundleTimestamp,
        end: evolution.closed_at || bundleTimestamp
      },
      serviceProvider: {
        reference: orgUrn
      },
      serviceType: {
        coding: [
          {
            system: FHIR_SYSTEMS.REPS_SERVICIO,
            code: evolution.codigo_servicio || practitioner.codigo_servicio || organization.codigo_servicio || "334",
            display: "Odontología General"
          }
        ]
      },
      location: [
        {
          location: {
            reference: locationUrn
          }
        }
      ],
      extension: [
        ...(evolution.modalidad_atencion ? [{
          url: FHIR_SYSTEMS.EXT_MODALIDAD,
          valueCoding: {
            system: FHIR_SYSTEMS.MODALIDAD_ATENCION,
            code: evolution.modalidad_atencion,
            display: MODALIDADES_ATENCION[evolution.modalidad_atencion]?.display
          }
        }] : []),
        ...(evolution.causa_externa ? [{
          url: FHIR_SYSTEMS.EXT_CAUSA_EXTERNA,
          valueCoding: {
            system: FHIR_SYSTEMS.CAUSA_EXTERNA,
            code: evolution.causa_externa
          }
        }] : [])
      ]
    }
  };

  const clinicalEntries = [];
  const sectionEntries = [];

  // 6. RECURSO CONDITION (Diagnóstico Principal)
  if (evolution.cie10_principal_codigo) {
    const conditionUrn = generateUrnUuid();
    clinicalEntries.push({
      fullUrl: conditionUrn,
      resource: {
        resourceType: "Condition",
        id: crypto.randomUUID(),
        meta: {
          profile: [FHIR_SYSTEMS.PROFILE_CONDITION]
        },
        clinicalStatus: {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active"
          }]
        },
        verificationStatus: {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed"
          }]
        },
        category: [
          {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
              display: "Encounter Diagnosis"
            }]
          }
        ],
        code: {
          coding: [
            {
              system: FHIR_SYSTEMS.CIE10,
              code: evolution.cie10_principal_codigo,
              display: evolution.diagnostico || undefined
            }
          ]
        },
        subject: {
          reference: patientUrn
        },
        encounter: {
          reference: encounterUrn
        },
        recordedDate: bundleTimestamp,
        extension: evolution.cie10_principal_tipo ? [
          {
            url: FHIR_SYSTEMS.EXT_TIPO_DIAGNOSTICO,
            valueCoding: {
              system: "https://minsalud.gov.co/ihce/tipo-diagnostico",
              code: String(evolution.cie10_principal_tipo),
              display: TIPOS_DIAGNOSTICO[evolution.cie10_principal_tipo]?.display
            }
          }
        ] : []
      }
    });

    sectionEntries.push({
      title: "Diagnósticos Odontológicos",
      code: {
        coding: [{
          system: FHIR_SYSTEMS.LOINC,
          code: "29548-5",
          display: "Diagnosis"
        }]
      },
      entry: [{ reference: conditionUrn }]
    });
  }

  // 7. RECURSO PROCEDURE (Procedimiento Odontológico CUPS)
  if (evolution.cups_codigo) {
    const procedureUrn = generateUrnUuid();
    clinicalEntries.push({
      fullUrl: procedureUrn,
      resource: {
        resourceType: "Procedure",
        id: crypto.randomUUID(),
        meta: {
          profile: [FHIR_SYSTEMS.PROFILE_PROCEDURE]
        },
        status: "completed",
        code: {
          coding: [
            {
              system: FHIR_SYSTEMS.CUPS,
              code: evolution.cups_codigo,
              display: evolution.tratamiento || undefined
            }
          ]
        },
        subject: {
          reference: patientUrn
        },
        encounter: {
          reference: encounterUrn
        },
        performedDateTime: bundleTimestamp
      }
    });

    sectionEntries.push({
      title: "Procedimientos Realizados",
      code: {
        coding: [{
          system: FHIR_SYSTEMS.LOINC,
          code: "29554-3",
          display: "Procedure Narrative"
        }]
      },
      entry: [{ reference: procedureUrn }]
    });
  }

  // 8. RECURSO COMPOSITION (Documento Encabezado RDA)
  const fhirComposition = {
    fullUrl: compositionUrn,
    resource: {
      resourceType: "Composition",
      id: crypto.randomUUID(),
      meta: {
        profile: [FHIR_SYSTEMS.PROFILE_COMPOSITION]
      },
      status: "final",
      type: {
        coding: [
          LOINC_RDA_CONSULTA
        ],
        text: "Resumen Digital de Atención Odontológica"
      },
      category: [
        {
          coding: [{
            system: "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
            code: "clinical-note"
          }]
        }
      ],
      subject: {
        reference: patientUrn
      },
      encounter: {
        reference: encounterUrn
      },
      date: bundleTimestamp,
      author: [
        {
          reference: practitionerUrn
        }
      ],
      title: "Resumen Digital de Atención (RDA) - OdontoCloud",
      custodian: {
        reference: orgUrn
      },
      section: [
        {
          title: "Motivo de Consulta y Evolución",
          code: {
            coding: [{
              system: FHIR_SYSTEMS.LOINC,
              code: "42349-1",
              display: "Reason for visit"
            }]
          },
          text: {
            status: "generated",
            div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${evolution.notas || evolution.motivo || "Atención odontológica registrada"}</p></div>`
          }
        },
        ...sectionEntries
      ]
    }
  };

  // ENSAMBLAJE FINAL DEL BUNDLE DOCUMENT
  const bundle = {
    resourceType: "Bundle",
    id: bundleId,
    meta: {
      profile: [FHIR_SYSTEMS.PROFILE_BUNDLE_RDA],
      lastUpdated: bundleTimestamp
    },
    identifier: {
      system: "https://odontocloudcolombia.com/ihce/rda",
      value: `RDA-${evolution.id || bundleId}`
    },
    type: "document",
    timestamp: bundleTimestamp,
    entry: [
      fhirComposition,
      fhirPatient,
      fhirPractitioner,
      fhirOrganization,
      fhirLocation,
      fhirEncounter,
      ...clinicalEntries
    ]
  };

  return bundle;
}

/**
 * Validador estricto y reproducible de conformación de Bundle FHIR R4 RDA
 * según perfiles nacionales y terminologías oficiales del Ministerio de Salud
 * (Resolución 866 de 2021, Resolución 1888 de 2025, Manual Operativo v1.3).
 * 
 * @param {Object} bundle 
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateRdaBundle(bundle) {
  const errors = [];

  if (!bundle || bundle.resourceType !== "Bundle") {
    errors.push("El recurso raíz debe ser de tipo 'Bundle'.");
    return { valid: false, errors };
  }

  if (bundle.type !== "document") {
    errors.push("El Bundle de RDA debe ser obligatoriamente de tipo 'document'.");
  }

  if (!bundle.meta?.profile || !bundle.meta.profile.includes(FHIR_SYSTEMS.PROFILE_BUNDLE_RDA)) {
    errors.push(`Bundle.meta.profile debe declarar el perfil oficial: ${FHIR_SYSTEMS.PROFILE_BUNDLE_RDA}`);
  }

  if (!bundle.entry || !Array.isArray(bundle.entry) || bundle.entry.length === 0) {
    errors.push("El Bundle debe contener al menos un elemento en 'entry'.");
    return { valid: false, errors };
  }

  // Regla FHIR Document: El primer recurso en entry DEBE ser una Composition
  const firstResource = bundle.entry[0]?.resource;
  if (!firstResource || firstResource.resourceType !== "Composition") {
    errors.push("La primera entrada de un Bundle de tipo document DEBE ser un recurso 'Composition'.");
    return { valid: false, errors };
  }

  const entriesByUrn = new Map(bundle.entry.map(e => [e.fullUrl, e.resource]).filter(([u]) => Boolean(u)));

  // Validaciones por recurso individual
  for (const entry of bundle.entry) {
    const res = entry.resource;
    if (!res) continue;

    // 1. COMPOSITION
    if (res.resourceType === "Composition") {
      if (!res.meta?.profile || !res.meta.profile.includes(FHIR_SYSTEMS.PROFILE_COMPOSITION)) {
        errors.push(`Composition.meta.profile debe declarar el perfil: ${FHIR_SYSTEMS.PROFILE_COMPOSITION}`);
      }
      if (!res.subject?.reference || !entriesByUrn.has(res.subject.reference)) {
        errors.push(`Composition.subject referencia inexistente o no resuelta: ${res.subject?.reference}`);
      }
      if (!res.author?.[0]?.reference || !entriesByUrn.has(res.author[0].reference)) {
        errors.push(`Composition.author referencia inexistente: ${res.author?.[0]?.reference}`);
      }
      if (!res.custodian?.reference || !entriesByUrn.has(res.custodian.reference)) {
        errors.push(`Composition.custodian referencia inexistente: ${res.custodian?.reference}`);
      }
      if (!res.encounter?.reference || !entriesByUrn.has(res.encounter.reference)) {
        errors.push(`Composition.encounter referencia inexistente: ${res.encounter?.reference}`);
      }
      const loincCode = res.type?.coding?.find(c => c.system === FHIR_SYSTEMS.LOINC)?.code;
      if (!loincCode) {
        errors.push(`Composition.type debe incluir codificación LOINC oficial (ej. 34133-9 o 11488-4).`);
      }
    }

    // 2. PATIENT
    if (res.resourceType === "Patient") {
      if (!res.meta?.profile || !res.meta.profile.includes(FHIR_SYSTEMS.PROFILE_PATIENT)) {
        errors.push(`Patient.meta.profile debe declarar: ${FHIR_SYSTEMS.PROFILE_PATIENT}`);
      }
      if (!res.identifier || res.identifier.length === 0) {
        errors.push("Patient debe incluir al menos un 'identifier' nacional.");
      } else {
        const docType = res.identifier[0]?.type?.coding?.[0]?.code;
        if (docType && !TIPOS_DOCUMENTO_COLOMBIA[docType]) {
          errors.push(`Patient tipo de documento '${docType}' no corresponde a catálogo oficial nacional.`);
        }
      }
      if (!res.name || res.name.length === 0 || !res.name[0].family) {
        errors.push("Patient debe incluir 'name' con al menos primer apellido (family).");
      }
      if (!res.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(res.birthDate)) {
        errors.push("Patient.birthDate debe tener formato ISO YYYY-MM-DD.");
      }
      if (!['male', 'female', 'other', 'unknown'].includes(res.gender)) {
        errors.push(`Patient.gender '${res.gender}' no es válido según FHIR AdministrativeGender.`);
      }
      // Verificar extensión de etnia oficial
      const etniaExt = res.extension?.find(e => e.url === FHIR_SYSTEMS.EXT_ETNIA);
      if (etniaExt) {
        const etniaCode = etniaExt.valueCoding?.code || etniaExt.valueCodeableConcept?.coding?.[0]?.code;
        if (etniaCode && !ETNIAS_DANE[etniaCode]) {
          errors.push(`Patient etnia '${etniaCode}' no es válida en catálogo DANE.`);
        }
      }
    }

    // 3. ORGANIZATION
    if (res.resourceType === "Organization") {
      if (!res.meta?.profile || !res.meta.profile.includes(FHIR_SYSTEMS.PROFILE_ORGANIZATION)) {
        errors.push(`Organization.meta.profile debe declarar: ${FHIR_SYSTEMS.PROFILE_ORGANIZATION}`);
      }
      const repsId = res.identifier?.find(i => i.system === FHIR_SYSTEMS.REPS || i.system === FHIR_SYSTEMS.REPS_PRESTADOR);
      if (!repsId || !/^\d{10,12}$/.test(repsId.value)) {
        errors.push("Organization debe incluir identifier REPS numérico de 10 dígitos (prestador) o 12 dígitos (sede).");
      }
    }

    // 4. PRACTITIONER
    if (res.resourceType === "Practitioner") {
      if (!res.meta?.profile || !res.meta.profile.includes(FHIR_SYSTEMS.PROFILE_PRACTITIONER)) {
        errors.push(`Practitioner.meta.profile debe declarar: ${FHIR_SYSTEMS.PROFILE_PRACTITIONER}`);
      }
      if (!res.identifier || res.identifier.length === 0) {
        errors.push("Practitioner debe incluir identificación profesional.");
      }
    }

    // 5. ENCOUNTER
    if (res.resourceType === "Encounter") {
      if (!res.meta?.profile || !res.meta.profile.includes(FHIR_SYSTEMS.PROFILE_ENCOUNTER)) {
        errors.push(`Encounter.meta.profile debe declarar: ${FHIR_SYSTEMS.PROFILE_ENCOUNTER}`);
      }
      if (res.status !== "finished") {
        errors.push("Encounter para RDA cerrado debe tener status 'finished'.");
      }
      if (res.class?.code !== "AMB") {
        errors.push("Encounter para consulta externa debe ser de clase 'AMB'.");
      }
    }

    // 6. CONDITION (Diagnóstico CIE-10)
    if (res.resourceType === "Condition") {
      if (!res.meta?.profile || !res.meta.profile.includes(FHIR_SYSTEMS.PROFILE_CONDITION)) {
        errors.push(`Condition.meta.profile debe declarar: ${FHIR_SYSTEMS.PROFILE_CONDITION}`);
      }
      const cie10Coding = res.code?.coding?.find(c => c.system === FHIR_SYSTEMS.CIE10);
      if (!cie10Coding || !/^[A-Z][0-9]{2}(\.?[0-9]{1,2})?$/.test(cie10Coding.code)) {
        errors.push(`Condition debe incluir código CIE-10 con sintaxis oficial válida: ${cie10Coding?.code}`);
      }
    }

    // 7. PROCEDURE (Procedimiento CUPS)
    if (res.resourceType === "Procedure") {
      if (!res.meta?.profile || !res.meta.profile.includes(FHIR_SYSTEMS.PROFILE_PROCEDURE)) {
        errors.push(`Procedure.meta.profile debe declarar: ${FHIR_SYSTEMS.PROFILE_PROCEDURE}`);
      }
      const cupsCoding = res.code?.coding?.find(c => c.system === FHIR_SYSTEMS.CUPS);
      if (!cupsCoding || !/^\d{6}$/.test(cupsCoding.code)) {
        errors.push(`Procedure debe incluir código CUPS numérico de 6 dígitos: ${cupsCoding?.code}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

