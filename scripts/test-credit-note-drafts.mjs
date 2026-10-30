// Los borradores de notas crédito que no salieron se ocultan cuando ya hay una nota aceptada después.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// La función se evalúa desde el archivo real del módulo (sin React ni base de datos).
const source = await readFile(new URL('../src/modules/facturacion/nota/BillingNotesModule.jsx', import.meta.url), 'utf8');
const start = source.indexOf('const noteTime = ');
const end = source.indexOf('export default function BillingNotesModule(');
assert.ok(start > 0 && end > start);
const code = source.slice(start, end).replace('export function supersededDraftIds', 'function supersededDraftIds');
const supersededDraftIds = new Function(code + '\nreturn supersededDraftIds;')();

const notes = [
  { id: 'nc2', factura_id: 'fcev1347', dian_status: 'ACCEPTED', cude: 'a'.repeat(96), created_at: '2026-10-30T18:50:00Z' },
  { id: 'draft', factura_id: 'fcev1347', dian_status: 'DRAFT', cude: null, created_at: '2026-10-30T18:40:00Z' },
  { id: 'nc1', factura_id: 'fcev1345', dian_status: 'ACCEPTED', cude: 'b'.repeat(96), created_at: '2026-10-30T11:44:00Z' },
  { id: 'otro', factura_id: 'fcev1344', dian_status: 'DRAFT', cude: null, created_at: '2026-10-30T12:00:00Z' },
  { id: 'nuevo', factura_id: 'fcev1345', dian_status: 'DRAFT', cude: null, created_at: '2026-10-30T19:00:00Z' },
  { id: 'duda', factura_id: 'fcev1347', dian_status: 'INDETERMINATE', cude: null, created_at: '2026-10-30T18:45:00Z' },
];
const hidden = supersededDraftIds(notes);
assert.deepEqual([...hidden], ['draft']);
console.log('PASS: solo se oculta el borrador ya reemplazado; no se ocultan notas aceptadas, en duda, ni borradores sin reemplazo.');
assert.ok(source.includes('Mostrar borradores de intentos que ya fueron reemplazados'));
console.log('PASS: los borradores ocultos se pueden volver a ver con la casilla.');
