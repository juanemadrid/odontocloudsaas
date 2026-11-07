// Revisa que los catálogos CUPS que usa el sistema coincidan con el catálogo oficial completo.
// Uso: node scripts/test-cups-catalog.mjs
import assert from 'node:assert/strict';
import { CUPS_COMPLETO } from '../src/data/cupsCompleto.js';
import { CUPS_DENTAL_CODES } from '../src/data/cupsCodes.js';
import { CUPS_RIPS_2026_ENTRIES } from '../src/modules/rips/v003/catalogs/cupsRips2026.js';
import { DENTAL_CODES_MAP } from '../src/utils/ripsValidators.js';
import { CLINICAL_SPECIALTIES } from '../src/services/clinicalTemplatesService.js';

const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const official = new Map(CUPS_COMPLETO.filter(x => x.code).map(x => [x.code, plain(x.name)]));
let checks = 0;

for (const c of CUPS_DENTAL_CODES) {
  assert.ok(official.has(c.code), `catálogo de precios: ${c.code} no existe en CUPS`);
  assert.equal(plain(c.name), official.get(c.code), `catálogo de precios: ${c.code} tiene el nombre de otro procedimiento`);
  checks++;
}
assert.equal(new Set(CUPS_DENTAL_CODES.map(c => c.code)).size, CUPS_DENTAL_CODES.length, 'catálogo de precios: códigos repetidos');

for (const e of CUPS_RIPS_2026_ENTRIES.filter(e => e.codigo)) {
  assert.ok(official.has(e.codigo), `catálogo RIPS 2026: ${e.codigo} no existe en CUPS`);
  assert.equal(plain(e.descripcionOficial), official.get(e.codigo), `catálogo RIPS 2026: ${e.codigo} tiene otro nombre`);
  checks++;
}
for (const sp of CLINICAL_SPECIALTIES) for (const pr of sp.procedures || sp.procedimientos || []) {
  if (pr.cups) { assert.ok(official.has(pr.cups), `plantillas: ${pr.name} usa ${pr.cups}, que no existe`); checks++; }
}
for (const m of DENTAL_CODES_MAP) { assert.ok(official.has(m.cups), `sugerencias: ${m.cups} no existe en CUPS`); checks++; }

// El caso que se reportó: primera vez por especialista = 890204; 890303 es control por odontología general.
const byCode = new Map(CUPS_DENTAL_CODES.map(c => [c.code, c.name]));
assert.match(byCode.get('890204'), /PRIMERA VEZ POR OTRAS ESPECIALIDADES/);
assert.match(byCode.get('890303'), /CONTROL O DE SEGUIMIENTO POR ODONTOLOGIA GENERAL/);
assert.match(byCode.get('890304'), /CONTROL O DE SEGUIMIENTO POR OTRAS ESPECIALIDADES/);
assert.match(byCode.get('997301'), /DETARTRAJE SUPRAGINGIVAL/);
assert.match(byCode.get('237302'), /CONDUCTO RADICULAR EN DIENTE BIRRADICULAR/);

console.log(`OK: ${checks} códigos revisados contra el catálogo oficial.`);
