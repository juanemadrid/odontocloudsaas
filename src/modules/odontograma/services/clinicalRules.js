/**
 * src/modules/odontograma/services/clinicalRules.js
 * Matriz de Conocimiento Odontológico basada estrictamente en INTENCIONES CLÍNICAS.
 * 
 * REGLAS ARQUITECTÓNICAS OBLIGATORIAS:
 * 1. NO contiene códigos CUPS hardcodeados.
 * 2. NO contiene precios.
 * 3. NO contiene IDs de catálogo ni dependencias de una clínica específica.
 * 4. Modela la relación: (Hallazgo + Dentición + Grupo Dental + Superficies) -> Intenciones Terapéuticas.
 */

/**
 * Normaliza cadenas de texto para comparaciones semánticas (minúsculas, sin tildes, sin signos).
 */
export function normalizeText(text) {
    if (!text) return "";
    return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Determina el grupo dental a partir del número de diente (FDI).
 * @param {number|string} toothNumber
 * @returns {'anterior'|'posterior'|'desconocido'}
 */
export function getDentalGroup(toothNumber) {
    const num = parseInt(toothNumber, 10);
    if (isNaN(num)) return "desconocido";

    // Dientes Anteriores: Incisivos y Caninos
    // Permanentes: 11-13, 21-23, 31-33, 41-43
    // Temporales: 51-53, 61-63, 71-73, 81-83
    const lastDigit = num % 10;
    if (lastDigit >= 1 && lastDigit <= 3) {
        return "anterior";
    }

    // Dientes Posteriores: Premolares y Molares
    // Permanentes: 14-18, 24-28, 34-38, 44-48
    // Temporales: 54-55, 64-65, 74-75, 84-85
    if (lastDigit >= 4 && lastDigit <= 8) {
        return "posterior";
    }

    return "desconocido";
}

/**
 * Determina el tipo de dentición estrictamente a partir de la numeración FDI.
 * @param {number|string} toothNumber
 * @returns {'permanente'|'temporal'|'invalido'}
 */
export function getDentitionFromTooth(toothNumber) {
    const num = parseInt(toothNumber, 10);
    if (isNaN(num)) return "invalido";

    // Cuadrantes 1 al 4: Dientes permanentes
    if ((num >= 11 && num <= 18) || (num >= 21 && num <= 28) || (num >= 31 && num <= 38) || (num >= 41 && num <= 48)) {
        return "permanente";
    }

    // Cuadrantes 5 al 8: Dientes temporales / deciduos
    if ((num >= 51 && num <= 55) || (num >= 61 && num <= 65) || (num >= 71 && num <= 75) || (num >= 81 && num <= 85)) {
        return "temporal";
    }

    return "invalido";
}

/**
 * Hallazgos clínicos que son intrínsecamente ambiguos y que por seguridad clínica
 * NUNCA deben generar sugerencias automáticas sin criterio directo del profesional.
 */
export const AMBIGUOUS_FINDINGS = [
    "fractura",
    "ausente",
    "diente_ausente",
    "lesion_apical",
    "implante_malo",
    "carilla_des",
    "perno_malo",
    "mancha",
    "otras",
    "diente_incluido",
    "diente_sin_erup",
    "diente_parcial_erup"
];

/**
 * Matriz de Reglas de Intención Clínica para Hallazgos Tratables.
 */
export const CLINICAL_RULES = [
    // ── CARIES / RESTAURACIONES DESADAPTADAS EN ADULTOS (PERMANENTES) ───────────
    {
        id: "caries_adulto_post_1cara",
        hallazgos: ["caries", "amalgama_des", "rest_desadaptado"],
        denticion: "permanente",
        grupoDental: "posterior",
        numSuperficiesMin: 1,
        numSuperficiesMax: 1,
        intenciones: [
            {
                tipo: "restauracion_resina_1_superficie_posterior",
                prioridad: 1,
                patronesPositivos: [
                    ["resina", "superficie"],
                    ["resina", "fotocurado"],
                    ["resina", "oclusal"],
                    ["restauracion", "oclusal"],
                    ["restauracion", "resina"],
                    ["resina", "1"],
                    ["resina", "una"],
                    ["resina", "simple"],
                    ["obturacion", "resina"],
                    ["resina"]
                ],
                patronesNegativos: [
                    ["dos", "superficies"],
                    ["tres", "superficies"],
                    ["2", "superficies"],
                    ["3", "superficies"],
                    ["anterior"],
                    ["exodoncia"],
                    ["extraccion"],
                    ["endodoncia"],
                    ["corona"],
                    ["implante"],
                    ["cirugia"]
                ],
                categoriasEsperadas: ["OPERATORIA", "OPERATORIA DENTAL", "RESTAURATIVA", "GENERAL"]
            },
            {
                tipo: "restauracion_ionomero_posterior",
                prioridad: 2,
                patronesPositivos: [
                    ["ionomero", "vidrio"],
                    ["ionomero", "posterior"],
                    ["ionomero"]
                ],
                patronesNegativos: [
                    ["anterior"],
                    ["exodoncia"],
                    ["extraccion"],
                    ["endodoncia"],
                    ["corona"],
                    ["implante"]
                ],
                categoriasEsperadas: ["OPERATORIA", "OPERATORIA DENTAL", "PREVENTIVA"]
            }
        ]
    },
    {
        id: "caries_adulto_post_2caras",
        hallazgos: ["caries", "amalgama_des", "rest_desadaptado"],
        denticion: "permanente",
        grupoDental: "posterior",
        numSuperficiesMin: 2,
        numSuperficiesMax: 2,
        intenciones: [
            {
                tipo: "restauracion_resina_2_superficies_posterior",
                prioridad: 1,
                patronesPositivos: [
                    ["resina", "dos"],
                    ["resina", "2"],
                    ["resina", "compuesta"],
                    ["obturacion", "resina", "dos"]
                ],
                patronesNegativos: [
                    ["una", "superficie"],
                    ["1", "superficie"],
                    ["tres", "superficies"],
                    ["3", "superficies"],
                    ["anterior"],
                    ["exodoncia"],
                    ["extraccion"],
                    ["endodoncia"],
                    ["corona"],
                    ["implante"]
                ],
                categoriasEsperadas: ["OPERATORIA", "OPERATORIA DENTAL", "RESTAURATIVA"]
            },
            {
                tipo: "incrustacion_dental",
                prioridad: 2,
                patronesPositivos: [
                    ["incrustacion"],
                    ["inlay"],
                    ["onlay"]
                ],
                patronesNegativos: [
                    ["exodoncia"],
                    ["extraccion"],
                    ["endodoncia"]
                ],
                categoriasEsperadas: ["REHABILITACION", "PROTESIS", "OPERATORIA"]
            }
        ]
    },
    {
        id: "caries_adulto_post_3mas_caras",
        hallazgos: ["caries", "amalgama_des", "rest_desadaptado"],
        denticion: "permanente",
        grupoDental: "posterior",
        numSuperficiesMin: 3,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "restauracion_resina_3_mas_superficies_posterior",
                prioridad: 1,
                patronesPositivos: [
                    ["resina", "tres"],
                    ["resina", "3"],
                    ["resina", "mas", "superficies"],
                    ["resina", "compleja"]
                ],
                patronesNegativos: [
                    ["una", "superficie"],
                    ["1", "superficie"],
                    ["dos", "superficies"],
                    ["2", "superficies"],
                    ["anterior"],
                    ["exodoncia"],
                    ["extraccion"],
                    ["endodoncia"],
                    ["implante"]
                ],
                categoriasEsperadas: ["OPERATORIA", "OPERATORIA DENTAL", "RESTAURATIVA"]
            },
            {
                tipo: "incrustacion_o_corona",
                prioridad: 2,
                patronesPositivos: [
                    ["incrustacion"],
                    ["onlay"],
                    ["overlay"],
                    ["corona"]
                ],
                patronesNegativos: [
                    ["exodoncia"],
                    ["extraccion"],
                    ["endodoncia"]
                ],
                categoriasEsperadas: ["REHABILITACION", "PROTESIS"]
            }
        ]
    },
    {
        id: "caries_adulto_anterior",
        hallazgos: ["caries", "rest_desadaptado"],
        denticion: "permanente",
        grupoDental: "anterior",
        numSuperficiesMin: 1,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "restauracion_resina_anterior",
                prioridad: 1,
                patronesPositivos: [
                    ["resina", "anterior"],
                    ["resina", "estetica"],
                    ["angulo", "incisal"],
                    ["resina", "sector", "anterior"]
                ],
                patronesNegativos: [
                    ["posterior"],
                    ["molar"],
                    ["exodoncia"],
                    ["extraccion"],
                    ["endodoncia"],
                    ["corona"],
                    ["implante"]
                ],
                categoriasEsperadas: ["OPERATORIA", "OPERATORIA DENTAL", "ESTETICA", "RESTAURATIVA"]
            }
        ]
    },

    // ── LESIONES NO CARIOSAS CERVICALES (ABFRACCIÓN / ABRASIÓN / EROSIÓN) ────────
    {
        id: "lesion_cervical",
        hallazgos: ["abfraccion", "abrasion_cervical", "erosion_cervical"],
        denticion: "permanente",
        grupoDental: "todos",
        numSuperficiesMin: 1,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "restauracion_cervical_cuello",
                prioridad: 1,
                patronesPositivos: [
                    ["cervical"],
                    ["cuello"],
                    ["resina", "cuello"],
                    ["ionomero", "cuello"],
                    ["clase", "v"]
                ],
                patronesNegativos: [
                    ["tres", "superficies"],
                    ["compleja"]
                ],
                categoriasEsperadas: ["OPERATORIA", "OPERATORIA DENTAL", "PREVENTIVA"]
            }
        ]
    },

    // ── SELLANTES DESADAPTADOS ──────────────────────────────────────────────────
    {
        id: "sellante_desadaptado",
        hallazgos: ["sellante_des"],
        denticion: "todos",
        grupoDental: "posterior",
        numSuperficiesMin: 1,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "aplicacion_sellante",
                prioridad: 1,
                patronesPositivos: [
                    ["sellante"],
                    ["sellador"],
                    ["sellantes", "fosas"]
                ],
                patronesNegativos: [
                    ["corona"],
                    ["endodoncia"]
                ],
                categoriasEsperadas: ["PREVENCION", "PREVENTIVA", "PROMOCION Y PREVENCION"]
            }
        ]
    },

    // ── ENDODONCIA INDICADA ─────────────────────────────────────────────────────
    {
        id: "endo_indicada_anterior",
        hallazgos: ["endodoncia_indicada", "endodoncia_mala"],
        denticion: "permanente",
        grupoDental: "anterior",
        numSuperficiesMin: 0,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "endodoncia_unirradicular",
                prioridad: 1,
                patronesPositivos: [
                    ["endodoncia", "unirradicular"],
                    ["conductos", "unirradicular"],
                    ["unirradicular"]
                ],
                patronesNegativos: [
                    ["birradicular"],
                    ["multirradicular"],
                    ["polirradicular"]
                ],
                categoriasEsperadas: ["ENDODONCIA"]
            }
        ]
    },
    {
        id: "endo_indicada_posterior",
        hallazgos: ["endodoncia_indicada", "endodoncia_mala"],
        denticion: "permanente",
        grupoDental: "posterior",
        numSuperficiesMin: 0,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "endodoncia_multirradicular",
                prioridad: 1,
                patronesPositivos: [
                    ["endodoncia", "birradicular"],
                    ["endodoncia", "multirradicular"],
                    ["endodoncia", "polirradicular"],
                    ["conductos", "molar"],
                    ["conductos", "premolar"],
                    ["multirradicular"],
                    ["birradicular"]
                ],
                patronesNegativos: [
                    ["unirradicular"]
                ],
                categoriasEsperadas: ["ENDODONCIA"]
            }
        ]
    },

    // ── EXTRACCIÓN INDICADA / RESTO RADICULAR ───────────────────────────────────
    {
        id: "extraccion_adulto",
        hallazgos: ["extraccion", "resto_radicular"],
        denticion: "permanente",
        grupoDental: "todos",
        numSuperficiesMin: 0,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "exodoncia_quirurgica_o_simple",
                prioridad: 1,
                patronesPositivos: [
                    ["exodoncia", "simple"],
                    ["exodoncia", "quirurgica"],
                    ["extraccion", "dental"],
                    ["exodoncia", "resto", "radicular"],
                    ["resto", "radicular"]
                ],
                patronesNegativos: [
                    ["temporal"],
                    ["deciduo"]
                ],
                categoriasEsperadas: ["CIRUGIA", "CIRUGIA ORAL"]
            }
        ]
    },

    // ── DENTICIÓN TEMPORAL / INFANTIL (DIENTES 51 A 85) ─────────────────────────
    {
        id: "caries_temporal",
        hallazgos: ["caries", "rest_desadaptado"],
        denticion: "temporal",
        grupoDental: "todos",
        numSuperficiesMin: 1,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "restauracion_diente_temporal",
                prioridad: 1,
                patronesPositivos: [
                    ["resina", "temporal"],
                    ["resina", "deciduo"],
                    ["ionomero", "temporal"],
                    ["ionomero", "deciduo"],
                    ["obturacion", "temporal"],
                    ["obturacion", "deciduo"],
                    ["restauracion", "temporal"],
                    ["restauracion", "deciduo"],
                    ["resina", "nino"],
                    ["ionomero", "nino"],
                    ["obturacion", "nino"]
                ],
                patronesNegativos: [
                    ["permanente"],
                    ["exodoncia"],
                    ["extraccion"],
                    ["pulpotomia"],
                    ["pulpectomia"],
                    ["corona"],
                    ["adulto"]
                ],
                categoriasEsperadas: ["ODONTOPEDIATRIA", "PEDIATRIA", "OPERATORIA"]
            },
            {
                tipo: "corona_acero_nino",
                prioridad: 2,
                patronesPositivos: [
                    ["corona", "acero"],
                    ["corona", "metalica", "temporal"],
                    ["acero"]
                ],
                patronesNegativos: [
                    ["porcelana"],
                    ["zirconio"],
                    ["exodoncia"],
                    ["extraccion"]
                ],
                categoriasEsperadas: ["ODONTOPEDIATRIA"]
            }
        ]
    },
    {
        id: "endo_temporal",
        hallazgos: ["endodoncia_indicada"],
        denticion: "temporal",
        grupoDental: "todos",
        numSuperficiesMin: 0,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "pulpotomia_o_pulpectomia",
                prioridad: 1,
                patronesPositivos: [
                    ["pulpotomia"],
                    ["pulpectomia"],
                    ["terapia", "pulpar"]
                ],
                patronesNegativos: [
                    ["permanente"],
                    ["exodoncia"],
                    ["extraccion"]
                ],
                categoriasEsperadas: ["ODONTOPEDIATRIA", "ENDODONCIA"]
            }
        ]
    },
    {
        id: "extraccion_temporal",
        hallazgos: ["extraccion", "resto_radicular"],
        denticion: "temporal",
        grupoDental: "todos",
        numSuperficiesMin: 0,
        numSuperficiesMax: 5,
        intenciones: [
            {
                tipo: "exodoncia_diente_temporal",
                prioridad: 1,
                patronesPositivos: [
                    ["exodoncia", "temporal"],
                    ["exodoncia", "deciduo"],
                    ["extraccion", "temporal"],
                    ["extraccion", "deciduo"],
                    ["exodoncia", "dientes", "temporales"],
                    ["exodoncia", "nino"],
                    ["extraccion", "nino"]
                ],
                patronesNegativos: [
                    ["permanente"],
                    ["resina"],
                    ["obturacion"],
                    ["ionomero"]
                ],
                categoriasEsperadas: ["ODONTOPEDIATRIA", "CIRUGIA"]
            }
        ]
    }
];
