/**
 * src/modules/odontograma/services/clinicalOdontogramTransitionEngine.js
 * Motor PURO de Transiciones Odontológicas y Proyección del Estado Actual (Fase 3A).
 * 
 * REGLAS ARQUITECTÓNICAS OBLIGATORIAS:
 * 1. Lógica pura y determinista: 0% BD, 0% Supabase, 0% fetch, 0% efectos secundarios.
 * 2. Cero colores hexadecimales en la semántica clínica del motor.
 * 3. Inmutabilidad estricta de los datos de entrada (deep clone).
 * 4. Desacoplamiento total: NO depende de códigos CUPS hardcodeados.
 */

import {
    EFFECT_TYPES,
    EFFECT_DEFINITIONS,
    normalizeSurfaces
} from "./odontogramEffectRules.js";

/**
 * Normaliza cadenas de texto para análisis semántico.
 */
function normalizeString(str) {
    if (!str) return "";
    return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Infiere el effect_type a partir de la intención clínica o del nombre del procedimiento.
 * @param {string} [intentionType] Intención clínica estructurada (ej. 'restauracion_resina_1_superficie_posterior')
 * @param {string} [procedimientoNombre] Nombre del procedimiento en catálogo
 * @returns {string|null} Tipo de efecto o null si es ambiguo
 */
export function inferEffectType(intentionType, procedimientoNombre) {
    const normIntention = normalizeString(intentionType);
    const normName = normalizeString(procedimientoNombre);
    const combined = `${normIntention} ${normName}`;

    // 1. NO_OP: Procedimientos diagnósticos, preventivos o de soporte que no alteran la anatomía dental
    if (
        combined.includes("consulta") ||
        combined.includes("diagnostico") ||
        combined.includes("radiografia") ||
        combined.includes("periapical") ||
        combined.includes("panoramica") ||
        combined.includes("profilaxis") ||
        combined.includes("detartraje") ||
        combined.includes("control") ||
        combined.includes("mantenimiento")
    ) {
        return EFFECT_TYPES.NO_OP;
    }

    // 2. EXTRACTION_COMPLETED: Procedimientos quirúrgicos de exodoncia
    if (
        combined.includes("exodoncia") ||
        combined.includes("extraccion")
    ) {
        return EFFECT_TYPES.EXTRACTION_COMPLETED;
    }

    // 3. ROOT_CANAL_COMPLETED: Endodoncias / terapia de conductos
    if (
        combined.includes("endodoncia") ||
        combined.includes("conducto") ||
        combined.includes("pulpectomia") ||
        combined.includes("pulpotomia")
    ) {
        return EFFECT_TYPES.ROOT_CANAL_COMPLETED;
    }

    // 4. IMPLANT_COMPLETED: Colocación de implantes oseointegrados
    if (
        combined.includes("implante")
    ) {
        return EFFECT_TYPES.IMPLANT_COMPLETED;
    }

    // 5. CROWN_COMPLETED: Prótesis fija / coronas
    if (
        combined.includes("corona") ||
        combined.includes("casquete") ||
        combined.includes("incrustacion") ||
        combined.includes("onlay") ||
        combined.includes("inlay")
    ) {
        return EFFECT_TYPES.CROWN_COMPLETED;
    }

    // 6. VENEER_COMPLETED: Carillas estéticas
    if (
        combined.includes("carilla")
    ) {
        return EFFECT_TYPES.VENEER_COMPLETED;
    }

    // 7. AMALGAM_COMPLETED: Restauraciones en amalgama
    if (
        combined.includes("amalgama")
    ) {
        return EFFECT_TYPES.AMALGAM_COMPLETED;
    }

    // 8. SEALANT_COMPLETED: Sellantes de fosas y fisuras
    if (
        combined.includes("sellante")
    ) {
        return EFFECT_TYPES.SEALANT_COMPLETED;
    }

    // 9. RESTORATION_COMPLETED: Restauraciones en resina o ionómero
    if (
        combined.includes("resina") ||
        combined.includes("obturacion") ||
        combined.includes("restauracion") ||
        combined.includes("ionomero") ||
        normIntention.startsWith("restauracion_")
    ) {
        return EFFECT_TYPES.RESTORATION_COMPLETED;
    }

    return null;
}

/**
 * Calcula de forma pura la transición odontológica propuesta para un procedimiento.
 * @param {Object} params
 * @param {string} params.hallazgoOrigen - Hallazgo diagnóstico previo (ej: "caries", "fractura")
 * @param {string|number} params.diente - Número de diente FDI (ej: "16")
 * @param {string|Array<string>} [params.superficies] - Superficies involucradas
 * @param {string} [params.procedimientoNombre] - Nombre del procedimiento
 * @param {string} [params.intentionType] - Intención clínica de Fase 2A
 * @param {string} [params.requestedEffectType] - Efecto solicitado/confirmado explícitamente
 * @param {boolean} [params.resolveFinding=true] - Si se aprueba resolver el hallazgo patológico
 * @param {Object} [params.estadoActual={}] - Estado anatómico actual del diente en el odontograma
 * @returns {Object} Resultado estructurado de la transición clínica
 */
export function calculateOdontogramTransition({
    hallazgoOrigen = "",
    diente,
    superficies = [],
    procedimientoNombre = "",
    intentionType = "",
    requestedEffectType = null,
    resolveFinding = true,
    estadoActual = {}
} = {}) {
    const toothStr = String(diente || "").trim();
    if (!toothStr) {
        return { valid: false, reason: "MISSING_TOOTH_NUMBER", warnings: ["Número de diente no especificado."] };
    }

    // Determinar effect_type: prevalece el solicitado explícitamente si es válido
    let effectType = requestedEffectType;
    if (!effectType || !EFFECT_DEFINITIONS[effectType]) {
        effectType = inferEffectType(intentionType, procedimientoNombre);
    }

    if (!effectType || !EFFECT_DEFINITIONS[effectType]) {
        return {
            valid: false,
            reason: "AMBIGUOUS_EFFECT",
            warnings: [`No se pudo determinar un efecto odontológico seguro e inequívoco para "${procedimientoNombre}".`]
        };
    }

    const definition = EFFECT_DEFINITIONS[effectType];
    const canonicalSurfaces = normalizeSurfaces(superficies);
    const warnings = [];

    // Validar estado actual del diente para detectar anomalías clínicas
    const toothCurrentData = estadoActual[toothStr] || estadoActual || {};
    const isCurrentlyAbsent = toothCurrentData?.general?.id === "ausente";

    if (isCurrentlyAbsent) {
        if (effectType === EFFECT_TYPES.RESTORATION_COMPLETED || 
            effectType === EFFECT_TYPES.AMALGAM_COMPLETED || 
            effectType === EFFECT_TYPES.CROWN_COMPLETED || 
            effectType === EFFECT_TYPES.ROOT_CANAL_COMPLETED) {
            return {
                valid: false,
                reason: "INVALID_STATE_TRANSITION",
                warnings: [`Transición inválida: No se puede aplicar ${effectType} sobre la pieza ${toothStr} porque está registrada como ausente.`]
            };
        }
        if (effectType === EFFECT_TYPES.EXTRACTION_COMPLETED) {
            warnings.push(`Advertencia clínica: El diente ${toothStr} ya figura previamente como ausente.`);
        }
    }

    // Extraer estados previos
    const previousState = {};
    const newState = {};

    if (definition.scope === "surface") {
        if (canonicalSurfaces.length === 0) {
            warnings.push("Procedimiento de superficie sin facetas anatómicas especificadas.");
        }
        canonicalSurfaces.forEach(s => {
            if (s !== "Completo") {
                previousState[s] = toothCurrentData[s]?.id || hallazgoOrigen || "sano";
                newState[s] = definition.resultToolId;
            }
        });
    } else if (definition.scope === "general" || definition.scope === "tooth") {
        previousState.general = toothCurrentData?.general?.id || hallazgoOrigen || "presente";
        newState.general = definition.resultToolId;
    }

    const isFindingResolved = Boolean(resolveFinding && definition.defaultResolvesFinding && effectType !== EFFECT_TYPES.PROCEDURE_IN_PROGRESS);

    return {
        valid: true,
        effect_type: effectType,
        tooth: toothStr,
        surfaces: canonicalSurfaces,
        previous_state: previousState,
        new_state: newState,
        resolves_finding: isFindingResolved,
        scope: definition.scope,
        replaces_whole_tooth: definition.replacesWholeTooth,
        warnings
    };
}

/**
 * Proyecta el Estado Odontológico Actual a partir de un odontograma base y los eventos acumulados.
 * Es una función PURA: NO muta el baseOdontogramaData original bajo ninguna circunstancia.
 * 
 * @param {Object} baseOdontogramaData - hallazgos.data original (inmutable)
 * @param {Array<Object>} events - Array de eventos clínicos odontológicos
 * @returns {Object} { data: Object, metadata: { eventsApplied: number, eventsIgnored: number, warnings: Array<string> } }
 */
export function projectCurrentOdontogram(baseOdontogramaData = {}, events = []) {
    // 1. Inmutabilidad estricta: Clon profundo de la base
    const projectedData = JSON.parse(JSON.stringify(baseOdontogramaData || {}));
    const warnings = [];
    let eventsApplied = 0;
    let eventsIgnored = 0;

    if (!Array.isArray(events) || events.length === 0) {
        return {
            data: projectedData,
            metadata: { eventsApplied: 0, eventsIgnored: 0, warnings: [] }
        };
    }

    // 2. Filtrar eventos anulados y ordenar cronológicamente
    // Criterio de orden: fecha_evento ASC; desempatador determinista: created_at ASC o id ASC
    const activeEvents = events
        .filter(evt => {
            if (!evt || evt.estado_evento === "anulado") {
                eventsIgnored++;
                return false;
            }
            return true;
        })
        .sort((a, b) => {
            const timeA = new Date(a.fecha_evento || a.created_at || 0).getTime();
            const timeB = new Date(b.fecha_evento || b.created_at || 0).getTime();
            if (timeA !== timeB) return timeA - timeB;
            
            const createA = new Date(a.created_at || 0).getTime();
            const createB = new Date(b.created_at || 0).getTime();
            if (createA !== createB) return createA - createB;

            return String(a.id || "").localeCompare(String(b.id || ""));
        });

    // 3. Aplicar eventos determinísticamente
    for (const evt of activeEvents) {
        const toothStr = String(evt.diente || "").trim();
        const effectType = evt.effect_type;
        const definition = EFFECT_DEFINITIONS[effectType];

        if (!toothStr || !definition) {
            eventsIgnored++;
            warnings.push(`Evento ignorado: tipo de efecto desconocido o diente no válido (${effectType}, diente: ${toothStr}).`);
            continue;
        }

        // Caso especial: PROCEDURE_IN_PROGRESS y NO_OP no alteran visualmente el odontograma
        if (effectType === EFFECT_TYPES.PROCEDURE_IN_PROGRESS || effectType === EFFECT_TYPES.NO_OP) {
            eventsApplied++;
            continue;
        }

        if (!projectedData[toothStr]) {
            projectedData[toothStr] = {};
        }

        const toothCurrent = projectedData[toothStr];
        const isCurrentlyAbsent = toothCurrent?.general?.id === "ausente";

        // Validación de conflicto: No se puede restaurar una pieza ausente
        if (isCurrentlyAbsent && (
            effectType === EFFECT_TYPES.RESTORATION_COMPLETED ||
            effectType === EFFECT_TYPES.AMALGAM_COMPLETED ||
            effectType === EFFECT_TYPES.CROWN_COMPLETED ||
            effectType === EFFECT_TYPES.ROOT_CANAL_COMPLETED
        )) {
            eventsIgnored++;
            warnings.push(`Conflicto ignorado: Intento de restaurar diente ausente ${toothStr}.`);
            continue;
        }

        // CASO A: EXTRACTION_COMPLETED (Efecto destructivo sobre toda la pieza)
        if (effectType === EFFECT_TYPES.EXTRACTION_COMPLETED) {
            // Eliminar todas las facetas individuales y fijar estado ausente
            projectedData[toothStr] = {
                general: { id: "ausente" }
            };
            eventsApplied++;
            continue;
        }

        // CASO B: IMPLANT_COMPLETED (Colocación de implante)
        if (effectType === EFFECT_TYPES.IMPLANT_COMPLETED) {
            if (!isCurrentlyAbsent && Object.keys(toothCurrent).length > 0 && !toothCurrent.general) {
                warnings.push(`Aviso: Implante colocado sobre pieza ${toothStr} sin evento previo explícito de ausencia.`);
            }
            projectedData[toothStr] = {
                general: { id: "implante_bueno" }
            };
            eventsApplied++;
            continue;
        }

        // CASO C: ROOT_CANAL_COMPLETED (Endodoncia: Coexiste con la corona/superficies)
        if (effectType === EFFECT_TYPES.ROOT_CANAL_COMPLETED) {
            toothCurrent.general = { id: "endodoncia_buena" };
            eventsApplied++;
            continue;
        }

        // CASO D: CROWN_COMPLETED (Corona: Reemplaza aspecto coronario pero respeta endodoncia radicular)
        if (effectType === EFFECT_TYPES.CROWN_COMPLETED) {
            // Si tenía endodoncia radicular, se preserva en general
            const hadEndo = toothCurrent.general?.id === "endodoncia_buena";
            // Limpiar facetas coronarias individuales porque ahora están cubiertas por la corona
            delete toothCurrent.center;
            delete toothCurrent.top;
            delete toothCurrent.bottom;
            delete toothCurrent.left;
            delete toothCurrent.right;
            
            toothCurrent.general = hadEndo 
                ? { id: "corona_buena", endodoncia: true } 
                : { id: "corona_buena" };
            eventsApplied++;
            continue;
        }

        // CASO E: Efectos por superficie (RESTORATION_COMPLETED, AMALGAM_COMPLETED, SEALANT_COMPLETED, VENEER_COMPLETED)
        const surfaces = normalizeSurfaces(evt.superficies);
        if (surfaces.length === 0) {
            warnings.push(`Evento de superficie sin caras válidas para diente ${toothStr}.`);
            eventsIgnored++;
            continue;
        }

        surfaces.forEach(s => {
            if (s !== "Completo") {
                toothCurrent[s] = {
                    id: evt.estado_nuevo || definition.resultToolId
                };
            } else {
                // Si la superficie era "Completo" o toda la pieza
                ["center", "top", "bottom", "left", "right"].forEach(facet => {
                    toothCurrent[facet] = {
                        id: evt.estado_nuevo || definition.resultToolId
                    };
                });
            }
        });

        eventsApplied++;
    }

    return {
        data: projectedData,
        metadata: {
            eventsApplied,
            eventsIgnored,
            warnings
        }
    };
}
