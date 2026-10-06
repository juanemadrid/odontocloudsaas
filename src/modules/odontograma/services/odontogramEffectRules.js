/**
 * src/modules/odontograma/services/odontogramEffectRules.js
 * Definición pura de reglas, ontología y efectos odontológicos (Fase 3A).
 * 
 * REGLAS ARQUITECTÓNICAS:
 * 1. Cero dependencias de base de datos o Supabase.
 * 2. Cero colores hexadecimales en la lógica semántica clínica.
 * 3. Cero códigos CUPS hardcodeados como fuentes de verdad.
 */

/**
 * Catálogo de tipos de efectos odontológicos estructurados autorizados.
 */
export const EFFECT_TYPES = {
    RESTORATION_COMPLETED: "RESTORATION_COMPLETED",
    AMALGAM_COMPLETED: "AMALGAM_COMPLETED",
    SEALANT_COMPLETED: "SEALANT_COMPLETED",
    CROWN_COMPLETED: "CROWN_COMPLETED",
    VENEER_COMPLETED: "VENEER_COMPLETED",
    ROOT_CANAL_COMPLETED: "ROOT_CANAL_COMPLETED",
    EXTRACTION_COMPLETED: "EXTRACTION_COMPLETED",
    IMPLANT_COMPLETED: "IMPLANT_COMPLETED",
    PROCEDURE_IN_PROGRESS: "PROCEDURE_IN_PROGRESS",
    NO_OP: "NO_OP"
};

/**
 * Matriz semántica de configuración de efectos odontológicos.
 * Define el ámbito anatómico, el toolId visual resultante en el odontograma,
 * y las reglas de resolución y reemplazo.
 */
export const EFFECT_DEFINITIONS = {
    [EFFECT_TYPES.RESTORATION_COMPLETED]: {
        scope: "surface",
        resultToolId: "rest_adaptado",
        defaultResolvesFinding: true,
        replacesWholeTooth: false,
        coexistsWithGeneral: true,
        label: "Restauración definitiva adaptada"
    },
    [EFFECT_TYPES.AMALGAM_COMPLETED]: {
        scope: "surface",
        resultToolId: "amalgama_ok",
        defaultResolvesFinding: true,
        replacesWholeTooth: false,
        coexistsWithGeneral: true,
        label: "Amalgama adaptada"
    },
    [EFFECT_TYPES.SEALANT_COMPLETED]: {
        scope: "surface",
        resultToolId: "sellante_bueno",
        defaultResolvesFinding: true,
        replacesWholeTooth: false,
        coexistsWithGeneral: true,
        label: "Sellante adaptado"
    },
    [EFFECT_TYPES.CROWN_COMPLETED]: {
        scope: "tooth",
        resultToolId: "corona_buena",
        defaultResolvesFinding: true,
        replacesWholeTooth: false, // Cubre corona pero no destruye endodoncia previa
        coexistsWithGeneral: true,
        label: "Corona protésica adaptada"
    },
    [EFFECT_TYPES.VENEER_COMPLETED]: {
        scope: "surface",
        resultToolId: "carilla_adap",
        defaultResolvesFinding: true,
        replacesWholeTooth: false,
        coexistsWithGeneral: true,
        label: "Carilla estética adaptada"
    },
    [EFFECT_TYPES.ROOT_CANAL_COMPLETED]: {
        scope: "general",
        resultToolId: "endodoncia_buena",
        defaultResolvesFinding: true,
        replacesWholeTooth: false, // Radicular: coexiste perfectamente con restauraciones coronarias
        coexistsWithGeneral: false, // Ocupa el slot general radicular
        label: "Endodoncia finalizada satisfactoriamente"
    },
    [EFFECT_TYPES.EXTRACTION_COMPLETED]: {
        scope: "general",
        resultToolId: "ausente",
        defaultResolvesFinding: true,
        replacesWholeTooth: true, // Destructivo: elimina todas las facetas previas
        coexistsWithGeneral: false,
        label: "Diente extraído / ausente"
    },
    [EFFECT_TYPES.IMPLANT_COMPLETED]: {
        scope: "general",
        resultToolId: "implante_bueno",
        defaultResolvesFinding: true,
        replacesWholeTooth: true,
        coexistsWithGeneral: false,
        label: "Implante oseointegrado adaptado"
    },
    [EFFECT_TYPES.PROCEDURE_IN_PROGRESS]: {
        scope: "none",
        resultToolId: null,
        defaultResolvesFinding: false,
        replacesWholeTooth: false,
        coexistsWithGeneral: true,
        label: "Procedimiento clínico en curso (no definitivo)"
    },
    [EFFECT_TYPES.NO_OP]: {
        scope: "none",
        resultToolId: null,
        defaultResolvesFinding: false,
        replacesWholeTooth: false,
        coexistsWithGeneral: true,
        label: "Sin efecto sobre el odontograma gráfico"
    }
};

/**
 * Superficies anatómicas canónicas válidas en el odontograma.
 */
export const VALID_CANONICAL_SURFACES = ["center", "top", "bottom", "left", "right", "Completo"];

/**
 * Normaliza nombres coloquiales, clínicos o abreviaturas a las facetas canónicas.
 * @param {string|Array<string>} surfaceInput 
 * @returns {Array<string>} Lista de superficies canónicas válidas sin duplicados
 */
export function normalizeSurfaces(surfaceInput) {
    if (!surfaceInput) return [];

    const rawList = Array.isArray(surfaceInput) 
        ? surfaceInput 
        : String(surfaceInput).split(/[\/,\+;\-]/);

    const result = new Set();

    for (const item of rawList) {
        const s = String(item).toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (!s || s === "---" || s === "general") continue;

        if (s.includes("oclusal") || s.includes("incisal") || s === "center" || s === "c" || s === "o" || s === "i") {
            result.add("center");
        } else if (s.includes("vestibular") || s === "top" || s === "v") {
            result.add("top");
        } else if (s.includes("palatina") || s.includes("lingual") || s === "bottom" || s === "p" || s === "l") {
            result.add("bottom");
        } else if (s.includes("mesial") || s === "left" || s === "m") {
            result.add("left");
        } else if (s.includes("distal") || s === "right" || s === "d") {
            result.add("right");
        } else if (s.includes("completo") || s.includes("todas") || s.includes("pieza")) {
            result.add("Completo");
        } else if (VALID_CANONICAL_SURFACES.includes(item)) {
            result.add(item);
        }
    }

    return Array.from(result);
}
