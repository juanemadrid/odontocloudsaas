/**
 * src/modules/odontograma/services/clinicalSuggestionEngine.js
 * Motor de Intenciones Clínicas y Scoring de Procedimientos.
 * 
 * CARACTERÍSTICAS Y PRINCIPIOS DE SEGURIDAD:
 * 1. Función 100% PURA: sin Supabase, sin fetch, sin efectos secundarios, sin mutación de estado.
 * 2. NO contiene códigos CUPS hardcodeados en las reglas.
 * 3. NO crea procedimientos ficticios ni inventa precios.
 * 4. Trabaja EXCLUSIVAMENTE puntuando procedimientos reales del catálogo activo entregado como parámetro.
 * 5. Discrimina conceptualmente entre `cupsCandidate` e `internalCode`.
 * 6. Valida coherencia anatómica y dentición (tipoDenticion vs FDI).
 * 7. Ante contradicción de dentición o hallazgo ambiguo, se abstiene de sugerir.
 */

import {
    CLINICAL_RULES,
    AMBIGUOUS_FINDINGS,
    getDentalGroup,
    getDentitionFromTooth,
    normalizeText
} from "./clinicalRules.js";

import { CUPS_REFERENCE_MAP } from "./cupsReferenceDictionary.js";

/**
 * Ponderaciones numéricas internas del motor de scoring.
 */
export const SCORING_WEIGHTS = {
    THRESHOLD: 35,
    FULL_PATTERN_MATCH: 30,
    PARTIAL_PATTERN_MATCH: 15,
    NEGATIVE_PATTERN_PENALTY: -25,
    CATEGORY_MATCH: 15,
    SURFACE_CONSISTENCY_BONUS: 15,
    SURFACE_MISMATCH_PENALTY: -25,
    GROUP_CONSISTENCY_BONUS: 10,
    GROUP_MISMATCH_PENALTY: -20,
    PRIORITY_1_BONUS: 10,
    PRIORITY_2_BONUS: 5,
    OPTIONAL_CUPS_REF_BONUS: 10
};

/**
 * Discrimina conceptualmente entre un posible candidato a código CUPS y un código interno / SKU.
 * NOTA: Reconocer el formato NO garantiza que el código esté homologado clínicamente ante Minsalud,
 * pero permite descartar códigos internos evidentes (ej. RES-001, OBT-1, 01).
 * 
 * @param {string|number} rawCode
 * @returns {{ cupsCandidate: string|null, internalCode: string|null }}
 */
export function discriminateCode(rawCode) {
    if (!rawCode && rawCode !== 0) {
        return { cupsCandidate: null, internalCode: null };
    }

    const clean = String(rawCode).trim().toUpperCase();
    if (!clean) {
        return { cupsCandidate: null, internalCode: null };
    }

    // Un código CUPS estándar en Colombia está compuesto por 6 caracteres alfanuméricos / numéricos.
    // Si contiene guiones, espacios, o su longitud es distinta de 6, es con certeza un código interno.
    const isCupsFormat = /^[0-9A-Z]{6}$/.test(clean) && !clean.includes("-") && !clean.includes("_");

    if (isCupsFormat) {
        return {
            cupsCandidate: clean,
            internalCode: null
        };
    }

    return {
        cupsCandidate: null,
        internalCode: clean
    };
}

/**
 * Valida la coherencia entre el tipo de dentición declarado en el odontograma y la numeración FDI.
 * @param {string} tipoDenticion 'adulto' | 'infantil' | 'mixto' | 'permanente' | 'temporal'
 * @param {number|string} toothNumber Número dental FDI (11 a 85)
 * @returns {{ isValid: boolean, effectiveDentition: 'permanente'|'temporal'|null, reason: string|null }}
 */
export function validateDentition(tipoDenticion, toothNumber) {
    if (!toothNumber || toothNumber === "---") {
        return { isValid: true, effectiveDentition: "permanente", reason: null };
    }

    const fdiDentition = getDentitionFromTooth(toothNumber);
    if (fdiDentition === "invalido") {
        return { isValid: false, effectiveDentition: null, reason: "INVALID_TOOTH_NUMBER" };
    }

    const normSession = normalizeText(tipoDenticion || "adulto");

    const isSessionAdult = normSession === "adulto" || normSession === "permanente";
    const isSessionChild = normSession === "infantil" || normSession === "nino" || normSession === "temporal";
    const isSessionMixed = normSession === "mixto" || normSession === "mixta";

    // En dentición mixta, ambos tipos de dientes coexisten legítimamente
    if (isSessionMixed) {
        return { isValid: true, effectiveDentition: fdiDentition, reason: null };
    }

    // Validación cruzada estricta:
    // Si la sesión es adulto pero el diente es temporal (51 a 85)
    if (isSessionAdult && fdiDentition === "temporal") {
        return { isValid: false, effectiveDentition: null, reason: "DENTITION_MISMATCH" };
    }

    // Si la sesión es infantil pero el diente es permanente (11 a 48)
    if (isSessionChild && fdiDentition === "permanente") {
        return { isValid: false, effectiveDentition: null, reason: "DENTITION_MISMATCH" };
    }

    return { isValid: true, effectiveDentition: fdiDentition, reason: null };
}

/**
 * Normaliza el nombre del hallazgo clínico para buscar en la base de reglas.
 */
function cleanFindingKey(hallazgoRaw) {
    if (!hallazgoRaw) return "";
    const firstPart = String(hallazgoRaw).split("-")[0].split("(")[0];
    return normalizeText(firstPart).replace(/\s+/g, "_");
}

/**
 * Evalúa el contexto clínico y retorna los candidatos sugeridos puntuados.
 * 
 * @param {Object} context
 * @param {string} context.hallazgo Nombre o ID del hallazgo (ej. 'Caries', 'amalgama_des')
 * @param {string|number} context.diente Número dental FDI (ej. 16, 54)
 * @param {string} [context.superficie] Nombre de la cara (ej. 'Oclusal/Incisal', 'Vestibular')
 * @param {number} [context.numSuperficies] Número de caras afectadas (1, 2, 3...)
 * @param {string} [context.tipoDenticion] 'adulto' | 'infantil' | 'mixto'
 * @param {Array<Object>} [catalogItems] Lista de procedimientos de la clínica activa
 * @returns {{
 *   suggestions: Array<{
 *     procedure: Object,
 *     score: number,
 *     intention: string,
 *     hasCupsWarning: boolean,
 *     cupsCandidate: string|null,
 *     internalCode: string|null
 *   }>,
 *   metadata: {
 *     matchedFinding: string,
 *     dentitionValidated: boolean,
 *     reason: string|null
 *   }
 * }}
 */
export function getSuggestedProcedures(context, catalogItems = []) {
    if (!context) {
        return {
            suggestions: [],
            metadata: { matchedFinding: "", dentitionValidated: false, reason: "EMPTY_CONTEXT" }
        };
    }

    const findingKey = cleanFindingKey(context.hallazgo || context.situacionOriginal || "");
    const toothNumber = context.diente || context.pieza;
    const surfacesList = Array.isArray(context.superficies) 
        ? context.superficies 
        : (context.superficie ? String(context.superficie).split(/[\/,\+]/).map(s => s.trim()).filter(Boolean) : []);
    const surfacesCount = Number(context.numSuperficies || (surfacesList.length > 0 ? surfacesList.length : 1));

    // 1. Validar coherencia de dentición
    const dentitionValidation = validateDentition(context.tipoDenticion, toothNumber);
    if (!dentitionValidation.isValid) {
        return {
            suggestions: [],
            metadata: {
                matchedFinding: findingKey,
                dentitionValidated: false,
                reason: dentitionValidation.reason
            }
        };
    }

    // 2. Comprobar si es un hallazgo clínicamente ambiguo (decisión exclusivamente manual)
    if (AMBIGUOUS_FINDINGS.includes(findingKey)) {
        return {
            suggestions: [],
            metadata: {
                matchedFinding: findingKey,
                dentitionValidated: true,
                reason: "AMBIGUOUS_CLINICAL_FINDING"
            }
        };
    }

    // 3. Obtener grupo dental anatómico
    const dentalGroup = getDentalGroup(toothNumber);

    // 4. Filtrar reglas clínicas aplicables
    const applicableRules = CLINICAL_RULES.filter(rule => {
        const matchesFinding = rule.hallazgos.includes(findingKey);
        if (!matchesFinding) return false;

        // Validar dentición
        if (rule.denticion !== "todos" && rule.denticion !== dentitionValidation.effectiveDentition) {
            return false;
        }

        // Validar grupo dental
        if (rule.grupoDental !== "todos" && dentalGroup !== "desconocido" && rule.grupoDental !== dentalGroup) {
            return false;
        }

        // Validar número de superficies
        if (rule.numSuperficiesMin !== undefined && surfacesCount < rule.numSuperficiesMin) {
            return false;
        }
        if (rule.numSuperficiesMax !== undefined && surfacesCount > rule.numSuperficiesMax) {
            return false;
        }

        return true;
    });

    if (applicableRules.length === 0) {
        return {
            suggestions: [],
            metadata: {
                matchedFinding: findingKey,
                dentitionValidated: true,
                reason: "NO_MATCHING_RULE"
            }
        };
    }

    // 5. Si el catálogo activo está vacío
    if (!Array.isArray(catalogItems) || catalogItems.length === 0) {
        return {
            suggestions: [],
            metadata: {
                matchedFinding: findingKey,
                dentitionValidated: true,
                reason: "EMPTY_CATALOG"
            }
        };
    }

    // 6. Evaluar y puntuar candidatos reales del catálogo de la clínica
    const candidateMap = new Map();

    for (const rule of applicableRules) {
        for (const intention of rule.intenciones) {
            for (const item of catalogItems) {
                const itemId = item.id || `${item.codigo}_${item.nombre}`;
                const scoreResult = calculateScore(item, intention, surfacesCount, dentalGroup, dentitionValidation.effectiveDentition);

                if (scoreResult >= SCORING_WEIGHTS.THRESHOLD) {
                    const existing = candidateMap.get(itemId);
                    if (!existing || existing.score < scoreResult) {
                        const { cupsCandidate, internalCode } = discriminateCode(item.codigo || item.code || item.codigo_cups);
                        
                        // Validar si genera RIPS pero carece de un candidato CUPS utilizable
                        const isGeneraRips = Boolean(item.genera_rips === true || item.generaRips === true);
                        const hasCupsWarning = isGeneraRips && !cupsCandidate;

                        candidateMap.set(itemId, {
                            procedure: item,
                            score: scoreResult,
                            intention: intention.tipo,
                            hasCupsWarning: hasCupsWarning,
                            cupsCandidate: cupsCandidate,
                            internalCode: internalCode
                        });
                    }
                }
            }
        }
    }

    const scoredCandidates = Array.from(candidateMap.values());

    if (scoredCandidates.length === 0) {
        return {
            suggestions: [],
            metadata: {
                matchedFinding: findingKey,
                dentitionValidated: true,
                reason: "NO_CATALOG_CANDIDATES"
            }
        };
    }

    // 7. Ordenar de forma determinística: mayor puntaje primero, luego orden alfabético
    scoredCandidates.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        const nameA = String(a.procedure?.nombre || "");
        const nameB = String(b.procedure?.nombre || "");
        return nameA.localeCompare(nameB);
    });

    // 8. Limitar estrictamente a las mejores 3 sugerencias
    const topSuggestions = scoredCandidates.slice(0, 3);

    return {
        suggestions: topSuggestions,
        metadata: {
            matchedFinding: findingKey,
            dentitionValidated: true,
            reason: null
        }
    };
}

/**
 * Calcula la puntuación de compatibilidad de un procedimiento real del catálogo contra una intención clínica.
 */
function calculateScore(item, intention, surfacesCount, dentalGroup, effectiveDentition) {
    let score = 0;
    const normalizedName = normalizeText(item.nombre || item.desc || item.descripcion || "");
    const normalizedCategory = normalizeText(item.categoria || "");

    // A. Coincidencia Semántica en Nombre (0 a 30 pts)
    let matchedPositivePattern = false;
    for (const pattern of intention.patronesPositivos) {
        const allWordsPresent = pattern.every(word => normalizedName.includes(word));
        if (allWordsPresent) {
            matchedPositivePattern = true;
            score += SCORING_WEIGHTS.FULL_PATTERN_MATCH;
            break;
        }
    }

    if (!matchedPositivePattern) {
        // Si no cumple ningún patrón positivo explícito de la intención clínica evaluada, se descarta.
        // Esto previene que un procedimiento quirúrgico o de otra especialidad alcance el umbral por categoría o dentición.
        return 0;
    }

    // Penalización severa si contiene patrones negativos explícitos
    if (Array.isArray(intention.patronesNegativos)) {
        for (const pattern of intention.patronesNegativos) {
            const allNegWordsPresent = pattern.every(word => normalizedName.includes(word));
            if (allNegWordsPresent) {
                score += SCORING_WEIGHTS.NEGATIVE_PATTERN_PENALTY * 3; // -75 pts para descarte categórico
                break;
            }
        }
    }

    // B. Coincidencia de Categoría (0 a 15 pts)
    if (normalizedCategory && Array.isArray(intention.categoriasEsperadas)) {
        const matchesCategory = intention.categoriasEsperadas.some(cat => 
            normalizedCategory.includes(normalizeText(cat))
        );
        if (matchesCategory) {
            score += SCORING_WEIGHTS.CATEGORY_MATCH;
        }
    }

    // C. Coherencia de Superficies Dentales (Bonus / Penalización)
    // Solo aplica para intenciones restauradoras donde la cantidad de superficies es relevante
    const isRestorativeIntention = intention.tipo.includes("restauracion") || intention.tipo.includes("resina") || intention.tipo.includes("ionomero");
    if (isRestorativeIntention) {
        if (surfacesCount === 1) {
            if (normalizedName.includes("una") || normalizedName.includes(" 1 ") || normalizedName.includes("simple")) {
                score += SCORING_WEIGHTS.SURFACE_CONSISTENCY_BONUS;
            } else if (normalizedName.includes("dos") || normalizedName.includes(" 2 ") || normalizedName.includes("tres") || normalizedName.includes(" 3 ")) {
                score += SCORING_WEIGHTS.SURFACE_MISMATCH_PENALTY;
            }
        } else if (surfacesCount === 2) {
            if (normalizedName.includes("dos") || normalizedName.includes(" 2 ") || normalizedName.includes("compuesta")) {
                score += SCORING_WEIGHTS.SURFACE_CONSISTENCY_BONUS;
            } else if (normalizedName.includes("una") || normalizedName.includes(" 1 ") || normalizedName.includes("simple")) {
                score += SCORING_WEIGHTS.SURFACE_MISMATCH_PENALTY;
            }
        } else if (surfacesCount >= 3) {
            if (normalizedName.includes("tres") || normalizedName.includes(" 3 ") || normalizedName.includes("mas") || normalizedName.includes("compleja")) {
                score += SCORING_WEIGHTS.SURFACE_CONSISTENCY_BONUS;
            } else if (normalizedName.includes("una") || normalizedName.includes("simple")) {
                score += SCORING_WEIGHTS.SURFACE_MISMATCH_PENALTY;
            }
        }
    }

    // D. Coherencia de Grupo Anatómico (Anterior vs Posterior)
    if (dentalGroup === "posterior") {
        if (normalizedName.includes("posterior") || normalizedName.includes("molar") || normalizedName.includes("premolar")) {
            score += SCORING_WEIGHTS.GROUP_CONSISTENCY_BONUS;
        } else if (normalizedName.includes("anterior") || normalizedName.includes("incisivo") || normalizedName.includes("canino")) {
            score += SCORING_WEIGHTS.GROUP_MISMATCH_PENALTY;
        }
    } else if (dentalGroup === "anterior") {
        if (normalizedName.includes("anterior") || normalizedName.includes("incisivo") || normalizedName.includes("canino") || normalizedName.includes("estetica")) {
            score += SCORING_WEIGHTS.GROUP_CONSISTENCY_BONUS;
        } else if (normalizedName.includes("posterior") || normalizedName.includes("molar") || normalizedName.includes("premolar")) {
            score += SCORING_WEIGHTS.GROUP_MISMATCH_PENALTY;
        }
    }

    // E. Coherencia de Dentición (Temporal vs Permanente)
    if (effectiveDentition === "temporal") {
        const isPediatric = normalizedName.includes("temporal") || 
                            normalizedName.includes("deciduo") || 
                            normalizedName.includes("nino") || 
                            normalizedName.includes("infantil") || 
                            normalizedCategory.includes("odontopediatria") || 
                            normalizedCategory.includes("pediatria");
        if (isPediatric) {
            score += 25;
        } else if (normalizedName.includes("permanente") || normalizedName.includes("adulto")) {
            score -= 30;
        }
    } else if (effectiveDentition === "permanente") {
        const isPediatric = normalizedName.includes("temporal") || 
                            normalizedName.includes("deciduo") || 
                            normalizedName.includes("nino") || 
                            normalizedName.includes("infantil") || 
                            normalizedCategory.includes("odontopediatria");
        if (isPediatric) {
            score -= 30; // Penalizar fuertemente procedimientos pediátricos en dientes de adultos
        } else if (normalizedName.includes("permanente") || normalizedName.includes("adulto")) {
            score += 10;
        }
    }

    // F. Prioridad de Intención Clínica
    if (intention.prioridad === 1) {
        score += SCORING_WEIGHTS.PRIORITY_1_BONUS;
    } else if (intention.prioridad === 2) {
        score += SCORING_WEIGHTS.PRIORITY_2_BONUS;
    }

    // G. Referencia Normativa Opcional (Desacoplada y condicionada)
    if (CUPS_REFERENCE_MAP.enabled && CUPS_REFERENCE_MAP.intenciones?.[intention.tipo]) {
        const cleanItemCode = String(item.codigo || item.code || "").trim();
        const validCupsForIntention = CUPS_REFERENCE_MAP.intenciones[intention.tipo] || [];
        if (validCupsForIntention.includes(cleanItemCode)) {
            score += SCORING_WEIGHTS.OPTIONAL_CUPS_REF_BONUS;
        }
    }

    return score;
}

/**
 * Alias explícito conforme a la especificación de Fase 2A y Fase 2B.
 */
export const generateClinicalSuggestions = getSuggestedProcedures;

