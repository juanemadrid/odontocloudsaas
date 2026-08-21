import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const authContext = read("src/context/AuthContext.jsx");
const login = read("src/pages/Login.jsx");
const sourceCorpus = [
  read("src/modules/reportes/views/ReporteUsoPlataforma.jsx"),
  read("src/modules/reportes/views/ReporteSistema.jsx"),
  read("src/modules/reportes/views/ReporteLogErroresFacturacion.jsx"),
  read("src/modules/reportes/views/ReporteLogWhatsApp.jsx"),
  read("src/modules/config/PestanaEditor.jsx"),
  read("src/modules/config/ConfigEmpresa.jsx"),
  read("src/modules/reportes/views/ReporteLogInteroperabilidad.jsx"),
  read("src/modules/pacientes/components/PatientRxTab.jsx"),
].join("\n");
const dashboard = read("src/pages/Dashboard.jsx");
const reportService = read("src/services/reportDataService.js");
const factusProxy = read("supabase/functions/factus-proxy/index.ts");
const whatsappProxy = read("supabase/functions/whatsapp-proxy/index.ts");
const planList = read("src/modules/pacientes/components/PlanList.jsx");

assert(!/2e573a5a-70b2-4175-8332-4ebfa9bc0836|atmdental@gmail\.com/i.test(authContext + login),
  "Autenticación todavía contiene una clínica o correo privilegiado fijo.");
assert(!/check_user_tenant_active/.test(login),
  "Login todavía consulta el estado del usuario antes de autenticarlo.");
assert(!/\.from\(["'](?:egresos|facturas_errores|whatsapp_logs|ihce_logs)["']\)/.test(sourceCorpus),
  "Un reporte todavía consulta una tabla inexistente o heredada.");
assert(!/if\s*\(\s*listData\.length\s*===\s*0\s*\)/.test(sourceCorpus),
  "Un reporte todavía reemplaza resultados vacíos con datos ficticios.");
assert(/MAX_REPORT_ROWS\s*=\s*2000/.test(reportService) && /\.limit\(/.test(reportService),
  "El servicio de reportes no limita el volumen descargado.");
assert(/\.eq\(["']tenant_id["'],\s*tenantId\)/.test(reportService),
  "El servicio de reportes no fuerza el aislamiento por clínica.");
assert(!/path:\s*`tenants\/\$\{userProfile\.inquilino\}/.test(sourceCorpus),
  "La carga del logo no coincide con la ruta autorizada por Storage RLS.");
assert(!/import\s+(?:Agenda|Pacientes|ConfigRouter|AdministracionRouter)\s+from/.test(dashboard)
    && /React\.lazy\(\(\) => import\("\.\.\/modules\/pacientes\/Pacientes"\)\)/.test(dashboard),
  "Los módulos privados dejaron de cargarse bajo demanda.");
assert(statSync(join(root, "assets/logo.png")).size < 200_000
    && statSync(join(root, "assets/fondo.png")).size < 1_200_000,
  "Las imágenes del acceso exceden el presupuesto de transferencia.");
assert(!/url\s*:\s*uploaded\.signedUrl|archivo\.url\s*=\s*uploaded\.signedUrl/.test(sourceCorpus),
  "Una URL firmada temporal todavía se persiste como referencia permanente.");
assert(/FACTUS_ERROR/.test(factusProxy) && /performed_by/.test(factusProxy),
  "Factus no registra fallos sanitizados en audit_logs.");
assert(/WHATSAPP_SENT/.test(whatsappProxy) && /WHATSAPP_ERROR/.test(whatsappProxy),
  "WhatsApp no registra envíos y errores en audit_logs.");
assert(!/\b(?:entity_type|user_agent)\s*:/.test(whatsappProxy),
  "WhatsApp intenta insertar columnas inexistentes en audit_logs.");
assert(/performed_by\s*:\s*auditUserId/.test(whatsappProxy) && /recipientHash/.test(whatsappProxy),
  "WhatsApp no usa el esquema real o el formato consumido por el reporte.");
assert(/JSON\.parse\(payment\.notas\)/.test(planList)
    && /planId:\s*metadata\.planId\s*\|\|\s*payment\.planId\s*\|\|\s*payment\.plan_id/.test(planList),
  "La lista de planes no interpreta el planId almacenado dentro de pagos.notas.");

if (failures.length) {
  console.error("\nFALLÓ la verificación de producción:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Producción: controles críticos de autenticación, reportes, almacenamiento y auditoría OK.");
