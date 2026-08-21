import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFileSync(new URL(relativePath, root), "utf8");

const expectedSlugs = [
  "datos-basicos",
  "editor-web",
  "listas-precios",
  "planes",
  "consecutivos",
  "almacenes",
  "categorias-inventario",
  "sucursales",
  "bancos",
  "metodos-pago",
  "formulario-pacientes",
  "especialidades",
  "perfiles",
  "usuarios",
  "condiciones-pago",
  "parametros",
  "recursos-fisicos",
  "plantillas-clinicas",
  "pestanas-consulta",
  "cargas",
  "impuestos",
  "catalogo-cuentas",
  "facturacion-electronica",
  "suscripcion",
];

const layout = read("src/modules/config/ConfigLayout.jsx");
const router = read("src/modules/config/ConfigRouter.jsx");
const menuSlugs = [...layout.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1]);

assert.deepEqual(menuSlugs, expectedSlugs, "El menú visible de Configuración debe conservar sus 24 módulos y orden.");
for (const slug of expectedSlugs) {
  assert.match(router, new RegExp(`case ["']${slug}["']`), `Falta la ruta de Configuración: ${slug}`);
}

const persistence = read("src/services/configPersistenceService.js");
assert.match(persistence, /rpc\("set_tenant_config_section"/);
assert.match(persistence, /rpc\("merge_tenant_config"/);
assert.match(persistence, /\.eq\("tenant_id", tenantId\)/);
assert.match(persistence, /\.upsert\(\[tablePayload\], \{ onConflict: "id" \}\)/);
assert.doesNotMatch(persistence, /TABLES_WITH_CREATED_AT/);

const uploads = read("src/modules/config/ConfigCargas.jsx");
assert.match(uploads, /import\("xlsx"\)/);
assert.doesNotMatch(uploads, /cdn\.sheetjs\.com|unpkg\.com/);
assert.match(uploads, /catalogo_procedimientos/);
assert.match(uploads, /precio_costo/);
assert.match(uploads, /codigo_cups/);

const company = read("src/modules/config/ConfigEmpresa.jsx");
assert.match(company, /uploadOptimizedPublicFile/);
assert.match(company, /saveConfigSection/);
assert.doesNotMatch(company, /readAsDataURL/);

const users = read("src/modules/config/EmpresaUsuarios.jsx");
assert.match(users, /upsertManagedUser/);
assert.match(users, /saveConfigSection/);
const userDetailsPayload = users.match(/const userDetail = \{([\s\S]*?)\n\s*\};/)?.[1] || "";
assert.ok(userDetailsPayload, "No se encontró el payload público del usuario.");
assert.doesNotMatch(userDetailsPayload, /password/i);

const patientFormService = read("src/services/supabaseServices.js");
assert.match(patientFormService, /configuracionFormulariosService/);
assert.match(patientFormService, /saveConfigSection/);

const medicalTabs = read("src/modules/config/ConfigPestanasMedicas.jsx");
assert.match(medicalTabs, /saveConfigItem\(inquilino, "pestanas_medicas", null/);
assert.doesNotMatch(medicalTabs, /\.from\("pestanas_medicas"\)/);

const clinicalDocument = read("src/modules/pacientes/components/DocClinicoModal.jsx");
assert.match(clinicalDocument, /getConfigItems\([^,]+, "pestanas_medicas", null\)/);
assert.match(clinicalDocument, /pestanasMedicas/);

const accounts = read("src/modules/config/ConfigCatalogoCuentas.jsx");
assert.doesNotMatch(accounts, /\.from\("catalogo_cuentas"\)/);
assert.doesNotMatch(accounts, /_contabilidad/);

const subscription = read("src/modules/config/ConfigSuscripcion.jsx");
assert.match(subscription, /subscription_change_requests/);
assert.doesNotMatch(subscription, /collection\(|addDoc\(|subscription_requests/);

const factus = read("src/services/factusService.js");
assert.doesNotMatch(factus, /console\.log\([^\n]*(payload|invoice|ranges)/i);
assert.doesNotMatch(factus, /supabase\.from\("tenants"\)[\s\S]{0,200}(factus|client_secret|password)/i);

console.log(`Configuration integration checks passed (${expectedSlugs.length} visible modules).`);
