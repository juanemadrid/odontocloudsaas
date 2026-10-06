/**
 * src/modules/odontograma/services/__tests__/runEngineTests.js
 * Script de validación automatizada para los 10 casos de prueba obligatorios de Fase 2A.
 */

import { getSuggestedProcedures, discriminateCode, validateDentition } from '../clinicalSuggestionEngine.js';

// Catálogo de prueba realista representativo de clínicas odontológicas
const testCatalog = [
    {
        id: "p1",
        codigo: "232101",
        nombre: "Restauración en resina de fotocurado una superficie posterior",
        precio: 120000,
        categoria: "OPERATORIA DENTAL",
        genera_rips: true
    },
    {
        id: "p2",
        codigo: "232102",
        nombre: "Restauración en resina de fotocurado dos superficies posterior",
        precio: 160000,
        categoria: "OPERATORIA DENTAL",
        genera_rips: true
    },
    {
        id: "p3",
        codigo: "232103",
        nombre: "Restauración en resina de fotocurado tres o más superficies posterior",
        precio: 210000,
        categoria: "OPERATORIA DENTAL",
        genera_rips: true
    },
    {
        id: "p4",
        codigo: "232104",
        nombre: "Obturación en ionómero de vidrio autocurado posterior",
        precio: 95000,
        categoria: "OPERATORIA DENTAL",
        genera_rips: true
    },
    {
        id: "p5",
        codigo: "232105",
        nombre: "Restauración estética en resina sector anterior",
        precio: 140000,
        categoria: "ESTETICA DENTAL",
        genera_rips: true
    },
    {
        id: "p6",
        codigo: "232108",
        nombre: "Restauración en resina de fotocurado diente temporal",
        precio: 85000,
        categoria: "ODONTOPEDIATRIA",
        genera_rips: true
    },
    {
        id: "p7",
        codigo: "RES-001", // Código interno (no es CUPS de 6 caracteres)
        nombre: "Restauración en resina simple posterior promo",
        precio: 110000,
        categoria: "OPERATORIA",
        genera_rips: true // Genera RIPS pero carece de CUPS válido -> Debe emitir hasCupsWarning
    },
    {
        id: "p8",
        codigo: "KIT-01", // Código interno
        nombre: "Kit de cepillo y seda dental",
        precio: 25000,
        categoria: "PREVENCION",
        genera_rips: false // No genera RIPS -> No debe emitir warning
    },
    {
        id: "p9",
        codigo: "230101",
        nombre: "Exodoncia simple de diente permanente",
        precio: 90000,
        categoria: "CIRUGIA ORAL",
        genera_rips: true
    }
];

console.log("=================================================================");
console.log("EJECUTANDO TEST SUITE: CLINICAL SUGGESTION ENGINE (FASE 2A)");
console.log("=================================================================\n");

let passedCount = 0;
let totalCount = 10;

// CASO 1: Caries Diente 16 Adulto 1 superficie
console.log("--- CASO 1: Caries Diente 16 Adulto (1 superficie) ---");
const res1 = getSuggestedProcedures({
    hallazgo: "caries",
    diente: "16",
    numSuperficies: 1,
    tipoDenticion: "adulto"
}, testCatalog);

const c1Top = res1.suggestions[0];
const c1Pass = c1Top && c1Top.procedure.id === "p1" && c1Top.score >= 35;
console.log(`Top 1 sugerido: ${c1Top?.procedure?.nombre} (Puntaje: ${c1Top?.score})`);
console.log(`Resultado: ${c1Pass ? "PASS" : "FAIL"}\n`);
if (c1Pass) passedCount++;

// CASO 2: Caries Diente 16 Adulto 2 superficies
console.log("--- CASO 2: Caries Diente 16 Adulto (2 superficies) ---");
const res2 = getSuggestedProcedures({
    hallazgo: "caries",
    diente: "16",
    numSuperficies: 2,
    tipoDenticion: "adulto"
}, testCatalog);

const c2Top = res2.suggestions[0];
const c2Pass = c2Top && c2Top.procedure.id === "p2" && c2Top.score >= 35;
console.log(`Top 1 sugerido: ${c2Top?.procedure?.nombre} (Puntaje: ${c2Top?.score})`);
console.log(`Resultado: ${c2Pass ? "PASS" : "FAIL"}\n`);
if (c2Pass) passedCount++;

// CASO 3: Caries Diente 54 Infantil
console.log("--- CASO 3: Caries Diente 54 Infantil (Dentición Temporal) ---");
const res3 = getSuggestedProcedures({
    hallazgo: "caries",
    diente: "54",
    numSuperficies: 1,
    tipoDenticion: "infantil"
}, testCatalog);

const c3Top = res3.suggestions[0];
const c3Pass = c3Top && c3Top.procedure.id === "p6" && c3Top.score >= 35;
console.log(`Top 1 sugerido: ${c3Top?.procedure?.nombre} (Puntaje: ${c3Top?.score})`);
console.log(`Resultado: ${c3Pass ? "PASS" : "FAIL"}\n`);
if (c3Pass) passedCount++;

// CASO 4: Contradicción: tipoDenticion = adulto, Diente = 54
console.log("--- CASO 4: Contradicción anatómica (tipoDenticion: adulto con diente 54) ---");
const res4 = getSuggestedProcedures({
    hallazgo: "caries",
    diente: "54",
    numSuperficies: 1,
    tipoDenticion: "adulto"
}, testCatalog);

const c4Pass = res4.suggestions.length === 0 && res4.metadata.reason === "DENTITION_MISMATCH";
console.log(`Sugerencias: ${res4.suggestions.length} | Metadata Reason: ${res4.metadata.reason}`);
console.log(`Resultado: ${c4Pass ? "PASS" : "FAIL"}\n`);
if (c4Pass) passedCount++;

// CASO 5: Hallazgo ambiguo: fractura
console.log("--- CASO 5: Hallazgo ambiguo (fractura) ---");
const res5 = getSuggestedProcedures({
    hallazgo: "fractura",
    diente: "11",
    numSuperficies: 1,
    tipoDenticion: "adulto"
}, testCatalog);

const c5Pass = res5.suggestions.length === 0 && res5.metadata.reason === "AMBIGUOUS_CLINICAL_FINDING";
console.log(`Sugerencias: ${res5.suggestions.length} | Metadata Reason: ${res5.metadata.reason}`);
console.log(`Resultado: ${c5Pass ? "PASS" : "FAIL"}\n`);
if (c5Pass) passedCount++;

// CASO 6: Catálogo vacío
console.log("--- CASO 6: Catálogo vacío ---");
const res6 = getSuggestedProcedures({
    hallazgo: "caries",
    diente: "16",
    numSuperficies: 1,
    tipoDenticion: "adulto"
}, []);

const c6Pass = res6.suggestions.length === 0 && res6.metadata.reason === "EMPTY_CATALOG";
console.log(`Sugerencias: ${res6.suggestions.length} | Metadata Reason: ${res6.metadata.reason}`);
console.log(`Resultado: ${c6Pass ? "PASS" : "FAIL"}\n`);
if (c6Pass) passedCount++;

// CASO 7: Procedimiento con genera_rips=true y código interno RES-001
console.log("--- CASO 7: Procedimiento con genera_rips=true y código interno RES-001 ---");
const res7 = getSuggestedProcedures({
    hallazgo: "caries",
    diente: "16",
    numSuperficies: 1,
    tipoDenticion: "adulto"
}, [testCatalog.find(i => i.id === "p7")]);

const c7Item = res7.suggestions[0];
const c7Pass = c7Item && c7Item.hasCupsWarning === true && c7Item.cupsCandidate === null && c7Item.internalCode === "RES-001";
console.log(`Candidato: ${c7Item?.procedure?.nombre} | hasCupsWarning: ${c7Item?.hasCupsWarning} | internalCode: ${c7Item?.internalCode}`);
console.log(`Resultado: ${c7Pass ? "PASS" : "FAIL"}\n`);
if (c7Pass) passedCount++;

// CASO 8: Procedimiento con genera_rips=false y código interno
console.log("--- CASO 8: Procedimiento con genera_rips=false y código interno KIT-01 ---");
const { cupsCandidate: c8Cups, internalCode: c8Internal } = discriminateCode("KIT-01");
const c8Pass = c8Cups === null && c8Internal === "KIT-01";
console.log(`KIT-01 -> cupsCandidate: ${c8Cups} | internalCode: ${c8Internal}`);
console.log(`Resultado: ${c8Pass ? "PASS" : "FAIL"}\n`);
if (c8Pass) passedCount++;

// CASO 9: Varios candidatos similares -> Máximo 3 sugerencias ordenadas
console.log("--- CASO 9: Varios candidatos similares -> Límite top 3 ordenado ---");
const res9 = getSuggestedProcedures({
    hallazgo: "caries",
    diente: "16",
    numSuperficies: 1,
    tipoDenticion: "adulto"
}, testCatalog);

const c9Count = res9.suggestions.length;
const c9Sorted = res9.suggestions.every((item, idx, arr) => idx === 0 || arr[idx - 1].score >= item.score);
const c9Pass = c9Count <= 3 && c9Count > 0 && c9Sorted;
console.log(`Cantidad retornada: ${c9Count} (esperado <= 3) | ¿Orden descendente estricto?: ${c9Sorted}`);
res9.suggestions.forEach((s, i) => console.log(`  #${i + 1}: ${s.procedure.nombre} (Score: ${s.score})`));
console.log(`Resultado: ${c9Pass ? "PASS" : "FAIL"}\n`);
if (c9Pass) passedCount++;

// CASO 10: Determinismo idéntico en ejecuciones consecutivas
console.log("--- CASO 10: Prueba de determinismo idéntico en 100 iteraciones ---");
let deterministic = true;
const firstJson = JSON.stringify(getSuggestedProcedures({
    hallazgo: "caries",
    diente: "16",
    numSuperficies: 1,
    tipoDenticion: "adulto"
}, testCatalog));

for (let i = 0; i < 100; i++) {
    const nextJson = JSON.stringify(getSuggestedProcedures({
        hallazgo: "caries",
        diente: "16",
        numSuperficies: 1,
        tipoDenticion: "adulto"
    }, testCatalog));
    if (nextJson !== firstJson) {
        deterministic = false;
        break;
    }
}
console.log(`100 iteraciones idénticas: ${deterministic}`);
console.log(`Resultado: ${deterministic ? "PASS" : "FAIL"}\n`);
if (deterministic) passedCount++;

console.log("=================================================================");
console.log(`TOTAL CASOS DE PRUEBA: ${passedCount}/${totalCount} PASARON SATISFACTORIAMENTE`);
console.log("=================================================================");
