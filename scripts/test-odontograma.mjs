import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    getDentitionVisibility,
    getVisibleToothNumbers,
    inferToothSurface,
    normalizeDentitionType,
} from '../src/modules/odontograma/utils/odontogramInteraction.mjs';
import {
    buildLesionPath,
    buildMaterialPath,
    buildOtherMarkPath,
    buildSealantPath,
    getSurfaceMarkScale,
    getToothSurfaceAnchor,
    getToothKind,
    getTreatmentVisual,
} from '../src/modules/odontograma/utils/treatmentVisuals.mjs';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');

assert.equal(normalizeDentitionType('permanente'), 'adulto');
assert.equal(normalizeDentitionType('temporal'), 'nino');
assert.equal(normalizeDentitionType('mixta'), 'completo');
assert.deepEqual(getDentitionVisibility('completo'), {
    type: 'completo',
    showPermanent: true,
    showTemporary: true,
});
assert.equal(getVisibleToothNumbers('adulto').length, 32);
assert.equal(getVisibleToothNumbers('nino').length, 20);
assert.equal(getVisibleToothNumbers('completo').length, 52);
assert.equal(new Set(getVisibleToothNumbers('completo')).size, 52);

const lowerPoint = (x, y) => inferToothSurface({ x, y, width: 100, height: 100, isUpper: false });
assert.equal(lowerPoint(50, 21), 'center');
assert.equal(lowerPoint(50, 1), 'top');
assert.equal(lowerPoint(50, 41), 'bottom');
assert.equal(lowerPoint(5, 21), 'left');
assert.equal(lowerPoint(95, 21), 'right');
assert.equal(lowerPoint(50, 80), 'top');

const upperPoint = (x, y) => inferToothSurface({ x, y, width: 100, height: 100, isUpper: true });
assert.equal(upperPoint(50, 79), 'center');
assert.equal(upperPoint(50, 59), 'top');
assert.equal(upperPoint(50, 99), 'bottom');
assert.equal(upperPoint(5, 79), 'left');
assert.equal(upperPoint(95, 79), 'right');
assert.equal(upperPoint(50, 20), 'top');

assert.equal(getTreatmentVisual('caries').mode, 'lesion');
assert.equal(getTreatmentVisual('caries').scope, 'surface');
assert.deepEqual(
    { fill: getTreatmentVisual('amalgama_des').fill, alert: getTreatmentVisual('amalgama_des').alert },
    { fill: '#2563EB', alert: '#EF4444' },
);
assert.deepEqual(
    { fill: getTreatmentVisual('rest_desadaptado').fill, alert: getTreatmentVisual('rest_desadaptado').alert },
    { fill: '#2DD4BF', alert: '#EF4444' },
);
const allTreatmentIds = [
    'caries', 'amalgama_des', 'fractura', 'corona_buena', 'perno_bueno', 'plomba',
    'rest_adaptado', 'diente_sano', 'corona_des', 'ausente', 'perno_malo', 'otras',
    'rest_desadaptado', 'sellante_bueno', 'endodoncia_buena', 'extraccion',
    'implante_bueno', 'amalgama_ok', 'sellante_des', 'endodoncia_mala', 'implante_malo',
];
allTreatmentIds.forEach((toolId) => {
    assert.equal(getTreatmentVisual(toolId).isFallback, undefined, `${toolId} no tiene lenguaje visual propio.`);
});
assert.equal(getToothKind(16), 'molar');
assert.equal(getToothKind(43), 'canine');
assert.equal(getToothKind(31), 'incisor');
assert.equal(getToothKind(84), 'molar');
assert.deepEqual(getToothSurfaceAnchor('center', 46), [50, 18]);
assert.deepEqual(getToothSurfaceAnchor('top', 46), [33, 51]);
assert.deepEqual(getToothSurfaceAnchor('bottom', 46), [67, 51]);
assert.deepEqual(getToothSurfaceAnchor('center', 16), [50, 82]);
assert.deepEqual(getToothSurfaceAnchor('top', 16), [33, 49]);
assert.deepEqual(getToothSurfaceAnchor('bottom', 16), [67, 49]);
assert.notDeepEqual(getToothSurfaceAnchor('top', 46), getToothSurfaceAnchor('center', 46));
assert.notDeepEqual(getToothSurfaceAnchor('bottom', 46), getToothSurfaceAnchor('center', 46));
assert.equal(getSurfaceMarkScale(1), 1);
assert.equal(getSurfaceMarkScale(2), 0.76);
assert.equal(getSurfaceMarkScale(3), 0.64);
assert.equal(getSurfaceMarkScale(5), 0.5);
assert.notEqual(buildLesionPath('top', 46, 0.64), buildLesionPath('center', 46, 0.64));
assert.notEqual(buildLesionPath('bottom', 46, 0.64), buildLesionPath('center', 46, 0.64));
assert.match(buildMaterialPath('center', 43, 'canine', 'amalgam'), /^M /);
assert.notEqual(
    buildMaterialPath('top', 43, 'canine', 'amalgam', 0),
    buildMaterialPath('top', 43, 'canine', 'amalgam', 6),
    'La alerta desadaptada no deja un margen orgánico alrededor del material.',
);
assert.notEqual(buildMaterialPath('center', 34, 'premolar', 'filling'), buildMaterialPath('center', 36, 'molar', 'restoration'));
assert.match(buildLesionPath('center', 16), /^M /);
assert.match(buildSealantPath('center'), /Q/);
assert.match(buildOtherMarkPath('center'), /^M /);
assert.notEqual(buildLesionPath('center', 16), buildLesionPath('center', 17));

const toothSvg = read('src/modules/odontograma/components/ToothSVGInline.jsx');
const interactiveTooth = read('src/modules/odontograma/components/InteractiveTooth.jsx');
const generalToothMark = read('src/modules/odontograma/components/GeneralToothMark.jsx');
const odontograma = read('src/modules/odontograma/Odontograma.jsx');

assert.match(toothSvg, /inferToothSurface/,
    'El clic sobre el diente no usa detección de superficie.');
assert.match(toothSvg, /visual\.mode === 'lesion'/,
    'La caries no tiene una lesión orgánica propia.');
assert.match(toothSvg, /visual\.mode === 'sealant'/,
    'Los sellantes no tienen una marca lineal propia.');
assert.match(toothSvg, /visual\.mode === 'material'/,
    'Los materiales restauradores no tienen relleno interno propio.');
assert.match(toothSvg, /buildMaterialPath/,
    'Los materiales todavía usan tapas geométricas rígidas.');
assert.match(toothSvg, /data-general-crown/,
    'Las coronas no siguen el contorno real del sprite dental.');
assert.match(toothSvg, /getSurfaceMarkScale/,
    'Las marcas múltiples no reducen su tamaño para evitar superposiciones.');
assert.match(toothSvg, /data-active-surface-count/,
    'La capa clínica no expone cuántas superficies está representando.');
assert.match(toothSvg, /visual\.mode === 'other'/,
    'La categoría Otras no tiene símbolo propio.');
assert.doesNotMatch(toothSvg, /ToothBorderMarkings/,
    'Todavía se usa el borde PNG que generaba marcas deformadas.');
assert.match(toothSvg, /clipPath[\s\S]*paths\.crown/,
    'La pintura de superficies no está recortada a una corona anatómica.');
assert.match(generalToothMark, /data-symbol="healthy"/,
    'Diente sano no muestra una paloma clínica.');
assert.doesNotMatch(generalToothMark, /<circle cx="50" cy="20"/,
    'La paloma de diente sano todavía aparece deformada dentro de un círculo.');
['fracture', 'post', 'endo', 'implant'].forEach((symbol) => {
    assert.match(generalToothMark, new RegExp(`data-symbol=["'{]+${symbol}`), `${symbol} no tiene símbolo general propio.`);
});
assert.match(generalToothMark, /mode === 'absent' \|\| mode === 'extraction'/,
    'Ausente y extracción no tienen una representación diferenciada.');
assert.match(generalToothMark, /data-symbol=\{mode\}/,
    'Ausente y extracción no exponen un símbolo verificable.');
assert.match(toothSvg, /ZONE_LAYER_WIDTH[\s\S]*incisor/,
    'La capa SVG todavía usa el mismo ancho para molares e incisivos.');
assert.match(toothSvg, /handleZoneLayerClick/,
    'Los espacios entre zonas del SVG pueden bloquear el clic directo.');
assert.match(toothSvg, /data-tooth-number/,
    'Los dientes no exponen un identificador verificable para pruebas visuales.');
assert.doesNotMatch(interactiveTooth, /onZoneClick\(String\(numero\),\s*["']Completo["']\)/,
    'El clic directo todavía convierte hallazgos de superficie en pieza completa.');
assert.match(odontograma, /name="odontograma-superficie"/,
    'El selector de superficies no se comporta como un grupo exclusivo.');
assert.match(odontograma, /tipoDenticion[\s\S]*hallazgos|hallazgos[\s\S]*tipoDenticion/,
    'La dentición elegida no se persiste con el odontograma.');
assert.match(odontograma, /existingIndex[\s\S]*next\[existingIndex\]\s*=\s*nextItem/,
    'Los hallazgos repetidos todavía pueden duplicarse en el plan.');

console.log('Odontograma: superficies directas, dentición mixta y sincronización del plan OK.');
