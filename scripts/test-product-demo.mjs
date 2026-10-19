import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard the public demo's dependency boundary: no authentication, services,
// database clients, or operational modules may enter its component graph.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const visited = new Set();
function inspect(relative) {
  const filename = path.resolve(root, relative);
  if (visited.has(filename)) return;
  visited.add(filename);
  const source = fs.readFileSync(filename, 'utf8');
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(|\bsupabase\b/, relative);
  for (const match of source.matchAll(/(?:import|export)\s+[\s\S]*?\sfrom\s*["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const base = path.resolve(path.dirname(filename), specifier);
    const dependency = ['', '.jsx', '.js', '.ts'].map(ext => base + ext).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(dependency, `Unresolved import: ${relative} → ${specifier}`);
    if (dependency.endsWith('.css')) continue;
    const local = path.relative(root, dependency).replaceAll('\\', '/');
    assert.doesNotMatch(local, /^src\/(?:lib|services|context|hooks)\//, `Operational dependency: ${local}`);
    inspect(local);
  }
}
inspect('src/pages/landing/ProductDemo.jsx');
const demo = fs.readFileSync(path.join(root, 'src/pages/landing/ProductDemo.jsx'), 'utf8');
assert.match(demo, /<div inert="" className="product-demo-inert"/);
assert.match(demo, /autoFocus=\{false\}/);
assert.match(demo, /onCancel=\{\(\) => setExpanded\(false\)\}/);
for (const [module, view] of [
  ['src/modules/agenda/Agenda.jsx', 'AgendaHeading'],
  ['src/modules/pacientes/components/PatientList.jsx', 'PatientListView'],
  ['src/modules/caja/Caja.jsx', 'CajaListView'],
  ['src/components/dashboard/DashboardHome.jsx', 'DashboardWelcome'],
  ['src/modules/administracion/AdministracionRouter.jsx', 'AdministrationMenu'],
  ['src/modules/reportes/Reportes.jsx', 'ReportsMenu'],
]) {
  assert.ok(fs.readFileSync(path.join(root, module), 'utf8').includes(`<${view}`), `${view} must remain shared with the live module`);
}
console.log(`PASS: ${visited.size} demo dependencies isolated; shared views, read-only boundary, focus and dismissal guards verified.`);
