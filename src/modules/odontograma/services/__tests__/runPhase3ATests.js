/**
 * src/modules/odontograma/services/__tests__/runPhase3ATests.js
 * Suite de Pruebas Unitarias Automatizadas para Fase 3A.
 * Ejecutable directamente con: node runPhase3ATests.js
 */

import {
    calculateOdontogramTransition,
    projectCurrentOdontogram,
    inferEffectType
} from "../clinicalOdontogramTransitionEngine.js";
import { EFFECT_TYPES } from "../odontogramEffectRules.js";

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
}

console.log("=================================================================");
console.log("EJECUTANDO TEST SUITE: MOTOR PURO DE TRANSICIONES (FASE 3A)");
console.log("=================================================================\n");

// --- CASO 1: Caries 16 Oclusal + RESTORATION_COMPLETED center ---
console.log("--- CASO 1: Caries 16 Oclusal + RESTORATION_COMPLETED center ---");
const baseCase1 = {
    "16": {
        center: { id: "caries" }
    }
};
const eventsCase1 = [
    {
        id: "evt-1",
        diente: "16",
        superficies: ["center"],
        effect_type: EFFECT_TYPES.RESTORATION_COMPLETED,
        estado_nuevo: "rest_adaptado",
        fecha_evento: "2026-10-12T10:00:00Z"
    }
];
const resCase1 = projectCurrentOdontogram(baseCase1, eventsCase1);
assert(resCase1.data["16"].center.id === "rest_adaptado", "El centro del 16 debe ser rest_adaptado");
assert(resCase1.metadata.eventsApplied === 1, "Debe aplicar 1 evento");
console.log(`Estado 16 center: ${resCase1.data["16"].center.id} (Esperado: rest_adaptado) -> PASS`);


// --- CASO 2: Caries 16 Oclusal + Mesial + restaurar solamente Oclusal ---
console.log("\n--- CASO 2: Caries 16 Oclusal + Mesial + restaurar solamente Oclusal ---");
const baseCase2 = {
    "16": {
        center: { id: "caries" },
        left: { id: "caries" } // Mesial
    }
};
const eventsCase2 = [
    {
        id: "evt-2",
        diente: "16",
        superficies: ["center"], // Solo oclusal
        effect_type: EFFECT_TYPES.RESTORATION_COMPLETED,
        estado_nuevo: "rest_adaptado",
        fecha_evento: "2026-10-12T10:00:00Z"
    }
];
const resCase2 = projectCurrentOdontogram(baseCase2, eventsCase2);
assert(resCase2.data["16"].center.id === "rest_adaptado", "Oclusal debe estar restaurada");
assert(resCase2.data["16"].left.id === "caries", "Mesial debe permanecer con caries activa");
console.log(`16 center: ${resCase2.data["16"].center.id} | 16 left (Mesial): ${resCase2.data["16"].left.id} -> PASS`);


// --- CASO 3: Exodoncia diente 16 ---
console.log("\n--- CASO 3: Exodoncia diente 16 (Efecto general destructivo) ---");
const baseCase3 = {
    "16": {
        center: { id: "caries" },
        top: { id: "amalgama_des" }
    }
};
const eventsCase3 = [
    {
        id: "evt-3",
        diente: "16",
        superficies: ["Completo"],
        effect_type: EFFECT_TYPES.EXTRACTION_COMPLETED,
        estado_nuevo: "ausente",
        fecha_evento: "2026-10-15T10:00:00Z"
    }
];
const resCase3 = projectCurrentOdontogram(baseCase3, eventsCase3);
assert(resCase3.data["16"].general.id === "ausente", "El estado general debe ser ausente");
assert(resCase3.data["16"].center === undefined, "Las superficies previas deben haberse eliminado");
assert(resCase3.data["16"].top === undefined, "Las superficies previas deben haberse eliminado");
console.log(`16 general: ${resCase3.data["16"].general.id} | Facetas eliminadas -> PASS`);


// --- CASO 4: Endodoncia completada en pieza con restauración existente ---
console.log("\n--- CASO 4: Endodoncia completada en pieza con restauración existente (Coexistencia) ---");
const baseCase4 = {
    "16": {
        center: { id: "rest_adaptado" },
        general: { id: "endodoncia_indicada" }
    }
};
const eventsCase4 = [
    {
        id: "evt-4",
        diente: "16",
        effect_type: EFFECT_TYPES.ROOT_CANAL_COMPLETED,
        estado_nuevo: "endodoncia_buena",
        fecha_evento: "2026-10-18T10:00:00Z"
    }
];
const resCase4 = projectCurrentOdontogram(baseCase4, eventsCase4);
assert(resCase4.data["16"].general.id === "endodoncia_buena", "General debe ser endodoncia_buena");
assert(resCase4.data["16"].center.id === "rest_adaptado", "La restauración coronaria debe preservarse intacta");
console.log(`16 general: ${resCase4.data["16"].general.id} | 16 center: ${resCase4.data["16"].center.id} -> PASS`);


// --- CASO 5: PROCEDURE_IN_PROGRESS ---
console.log("\n--- CASO 5: PROCEDURE_IN_PROGRESS (Sin resolución definitiva) ---");
const baseCase5 = {
    "16": {
        center: { id: "caries" }
    }
};
const eventsCase5 = [
    {
        id: "evt-5",
        diente: "16",
        superficies: ["center"],
        effect_type: EFFECT_TYPES.PROCEDURE_IN_PROGRESS,
        fecha_evento: "2026-10-20T10:00:00Z"
    }
];
const resCase5 = projectCurrentOdontogram(baseCase5, eventsCase5);
assert(resCase5.data["16"].center.id === "caries", "El hallazgo debe permanecer sin cambio definitivo");
console.log(`16 center sigue con: ${resCase5.data["16"].center.id} -> PASS`);


// --- CASO 6: NO_OP ---
console.log("\n--- CASO 6: NO_OP (Consultas/Rx: cero mutación) ---");
const baseCase6 = {
    "16": {
        center: { id: "caries" }
    }
};
const eventsCase6 = [
    {
        id: "evt-6",
        diente: "16",
        effect_type: EFFECT_TYPES.NO_OP,
        fecha_evento: "2026-10-21T10:00:00Z"
    }
];
const resCase6 = projectCurrentOdontogram(baseCase6, eventsCase6);
assert(JSON.stringify(resCase6.data) === JSON.stringify(baseCase6), "El odontograma debe ser 100% idéntico");
console.log(`Odontograma inalterado ante NO_OP -> PASS`);


// --- CASO 7: Evento anulado ---
console.log("\n--- CASO 7: Evento con estado_evento = 'anulado' ---");
const baseCase7 = {
    "16": {
        center: { id: "caries" }
    }
};
const eventsCase7 = [
    {
        id: "evt-7",
        diente: "16",
        superficies: ["center"],
        effect_type: EFFECT_TYPES.RESTORATION_COMPLETED,
        estado_nuevo: "rest_adaptado",
        estado_evento: "anulado", // Anulado
        fecha_evento: "2026-10-22T10:00:00Z"
    }
];
const resCase7 = projectCurrentOdontogram(baseCase7, eventsCase7);
assert(resCase7.data["16"].center.id === "caries", "El evento anulado no debe surtir efecto");
assert(resCase7.metadata.eventsIgnored === 1, "Debe registrar 1 evento ignorado");
console.log(`Evento anulado ignorado correctamente -> PASS`);


// --- CASO 8: Dos eventos cronológicos (Caries -> Restauración -> Corona) ---
console.log("\n--- CASO 8: Progresión temporal (Caries -> Restauración -> Corona) ---");
const baseCase8 = {
    "16": {
        center: { id: "caries" }
    }
};
const eventsCase8 = [
    {
        id: "evt-8a",
        diente: "16",
        superficies: ["center"],
        effect_type: EFFECT_TYPES.RESTORATION_COMPLETED,
        estado_nuevo: "rest_adaptado",
        fecha_evento: "2026-10-10T10:00:00Z"
    },
    {
        id: "evt-8b",
        diente: "16",
        effect_type: EFFECT_TYPES.CROWN_COMPLETED,
        estado_nuevo: "corona_buena",
        fecha_evento: "2026-10-25T10:00:00Z"
    }
];
const resCase8 = projectCurrentOdontogram(baseCase8, eventsCase8);
assert(resCase8.data["16"].general.id === "corona_buena", "El estado final debe reflejar el último evento (corona)");
console.log(`Estado final 16: ${resCase8.data["16"].general.id} -> PASS`);


// --- CASO 9: Exodoncia -> intento posterior de restauración ---
console.log("\n--- CASO 9: Transición inválida (Restauración sobre diente ausente) ---");
const baseCase9 = {
    "16": {
        general: { id: "ausente" }
    }
};
const eventsCase9 = [
    {
        id: "evt-9",
        diente: "16",
        superficies: ["center"],
        effect_type: EFFECT_TYPES.RESTORATION_COMPLETED,
        estado_nuevo: "rest_adaptado",
        fecha_evento: "2026-10-28T10:00:00Z"
    }
];
const resCase9 = projectCurrentOdontogram(baseCase9, eventsCase9);
assert(resCase9.data["16"].general.id === "ausente", "El diente debe seguir ausente");
assert(resCase9.metadata.warnings.length > 0, "Debe emitir advertencia de conflicto");
console.log(`Conflicto detectado con éxito: ${resCase9.metadata.warnings[0]} -> PASS`);


// --- CASO 10: Ausente -> IMPLANT_COMPLETED ---
console.log("\n--- CASO 10: Espacio edéntulo -> IMPLANT_COMPLETED ---");
const baseCase10 = {
    "16": {
        general: { id: "ausente" }
    }
};
const eventsCase10 = [
    {
        id: "evt-10",
        diente: "16",
        effect_type: EFFECT_TYPES.IMPLANT_COMPLETED,
        estado_nuevo: "implante_bueno",
        fecha_evento: "2026-11-01T10:00:00Z"
    }
];
const resCase10 = projectCurrentOdontogram(baseCase10, eventsCase10);
assert(resCase10.data["16"].general.id === "implante_bueno", "El estado debe ser implante_bueno");
console.log(`16 transicionó a: ${resCase10.data["16"].general.id} -> PASS`);


// --- CASO 11: Múltiples dientes y superficies (Aislamiento absoluto) ---
console.log("\n--- CASO 11: Múltiples piezas tratadas independientemente ---");
const baseCase11 = {
    "16": { center: { id: "caries" } },
    "26": { top: { id: "caries" } },
    "36": { center: { id: "amalgama_des" } }
};
const eventsCase11 = [
    { id: "e1", diente: "16", superficies: ["center"], effect_type: EFFECT_TYPES.RESTORATION_COMPLETED, fecha_evento: "2026-11-02T10:00:00Z" },
    { id: "e2", diente: "36", superficies: ["center"], effect_type: EFFECT_TYPES.AMALGAM_COMPLETED, fecha_evento: "2026-11-02T11:00:00Z" }
];
const resCase11 = projectCurrentOdontogram(baseCase11, eventsCase11);
assert(resCase11.data["16"].center.id === "rest_adaptado", "16 center debe estar restaurado");
assert(resCase11.data["36"].center.id === "amalgama_ok", "36 center debe ser amalgama_ok");
assert(resCase11.data["26"].top.id === "caries", "26 top no debe haberse alterado");
console.log(`Aislamiento perfecto entre piezas 16, 26 y 36 -> PASS`);


// --- CASO 12: Base vacía ---
console.log("\n--- CASO 12: Base vacía (Paciente nuevo sin hallazgos previos) ---");
const resCase12 = projectCurrentOdontogram({}, [
    { id: "e12", diente: "11", superficies: ["center"], effect_type: EFFECT_TYPES.SEALANT_COMPLETED, fecha_evento: "2026-11-03T10:00:00Z" }
]);
assert(resCase12.data["11"].center.id === "sellante_bueno", "Debe poder proyectar sobre base vacía");
console.log(`Base vacía manejada limpiamente -> PASS`);


// --- CASO 13: Evento con effect_type desconocido ---
console.log("\n--- CASO 13: Evento con effect_type desconocido ---");
const resCase13 = projectCurrentOdontogram(baseCase1, [
    { id: "e13", diente: "16", effect_type: "EFECTO_INVENTADO", fecha_evento: "2026-11-04T10:00:00Z" }
]);
assert(resCase13.metadata.eventsIgnored === 1, "Debe ignorar el evento desconocido");
assert(resCase13.metadata.warnings.length > 0, "Debe generar warning");
console.log(`Efecto desconocido ignorado con advertencia estructurada -> PASS`);


// --- CASO 14: Eventos fuera de orden recibidos en array ---
console.log("\n--- CASO 14: Reordenamiento cronológico de eventos desordenados ---");
const disorderedEvents = [
    { id: "eB", diente: "16", effect_type: EFFECT_TYPES.CROWN_COMPLETED, fecha_evento: "2026-12-01T10:00:00Z" }, // Posterior
    { id: "eA", diente: "16", superficies: ["center"], effect_type: EFFECT_TYPES.RESTORATION_COMPLETED, fecha_evento: "2026-10-01T10:00:00Z" } // Anterior
];
const resCase14 = projectCurrentOdontogram(baseCase1, disorderedEvents);
assert(resCase14.data["16"].general.id === "corona_buena", "El estado final debe reflejar el evento cronológicamente posterior");
console.log(`Eventos desordenados resueltos en orden cronológico estricto -> PASS`);


// --- CASO 15: 100 ejecuciones idénticas (Determinismo) ---
console.log("\n--- CASO 15: Prueba de determinismo (100 ejecuciones idénticas) ---");
const firstRun = JSON.stringify(projectCurrentOdontogram(baseCase11, eventsCase11));
let allIdentical = true;
for (let i = 0; i < 100; i++) {
    const run = JSON.stringify(projectCurrentOdontogram(baseCase11, eventsCase11));
    if (run !== firstRun) {
        allIdentical = false;
        break;
    }
}
assert(allIdentical, "Las 100 ejecuciones deben ser estrictamente idénticas");
console.log(`Determinismo verificado en 100/100 iteraciones -> PASS`);


// --- CASO 16: Verificación de inmutabilidad del odontograma base ---
console.log("\n--- CASO 16: Prueba de inmutabilidad del objeto base original ---");
const deepOriginalBase = {
    "16": { center: { id: "caries" }, top: { id: "caries" } },
    "24": { left: { id: "fractura" } }
};
const baseSnapshot = JSON.stringify(deepOriginalBase);

// Ejecutar proyecciones complejas
projectCurrentOdontogram(deepOriginalBase, [
    { id: "ex1", diente: "16", effect_type: EFFECT_TYPES.EXTRACTION_COMPLETED, fecha_evento: "2026-10-01T10:00:00Z" },
    { id: "ex2", diente: "24", superficies: ["left"], effect_type: EFFECT_TYPES.RESTORATION_COMPLETED, fecha_evento: "2026-10-02T10:00:00Z" }
]);

const baseAfterExecution = JSON.stringify(deepOriginalBase);
assert(baseSnapshot === baseAfterExecution, "El objeto base original NO debe mutar jamás");
console.log(`Inmutabilidad absoluta: deepOriginalBase intacto al 100% -> PASS`);


// --- PRUEBA COMPLEMENTARIA: calculateOdontogramTransition ---
console.log("\n--- PRUEBA COMPLEMENTARIA: calculateOdontogramTransition ---");
const transitionRes = calculateOdontogramTransition({
    hallazgoOrigen: "caries",
    diente: "16",
    superficies: "Oclusal/Incisal",
    procedimientoNombre: "Restauración en resina fotocurado",
    resolveFinding: true,
    estadoActual: { "16": { center: { id: "caries" } } }
});
assert(transitionRes.valid === true, "La transición debe ser válida");
assert(transitionRes.effect_type === EFFECT_TYPES.RESTORATION_COMPLETED, "Efecto inferido debe ser RESTORATION_COMPLETED");
assert(transitionRes.surfaces.includes("center"), "Superficie canónica debe ser center");
assert(transitionRes.new_state.center === "rest_adaptado", "Nuevo estado debe ser rest_adaptado");
assert(transitionRes.resolves_finding === true, "Debe resolver hallazgo");
console.log(`calculateOdontogramTransition estructurada correctamente -> PASS`);

console.log("\n=================================================================");
console.log("TOTAL CASOS DE PRUEBA: 16/16 PASARON SATISFACTORIAMENTE");
console.log("=================================================================");
