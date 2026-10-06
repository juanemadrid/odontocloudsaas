import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// CORS ESTRICTO (ALLOWLIST PRODUCCIÓN + DESARROLLO LOCAL SIN FALLBACK)
// ============================================================================
const ALLOWED_ORIGINS = new Set([
  "https://odontocloudcolombia.com",
  "https://www.odontocloudcolombia.com",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function handleCors(request: Request): {
  isAllowed: boolean;
  corsHeaders: Record<string, string>;
} {
  const origin = request.headers.get("Origin");

  // Invocación directa sin encabezado Origin (curl de auditoría o server-to-server)
  if (!origin) {
    return {
      isAllowed: true,
      corsHeaders: {},
    };
  }

  // Si el Origin está en la lista permitida: se devuelve exactamente ese Origin
  if (ALLOWED_ORIGINS.has(origin)) {
    return {
      isAllowed: true,
      corsHeaders: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
  }

  // Origin NO permitido: se rechaza estrictamente sin encabezado Access-Control-Allow-Origin
  return {
    isAllowed: false,
    corsHeaders: {},
  };
}

const GLOBAL_CONFIG_TENANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const json = (body: unknown, status = 200, corsHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ============================================================================
// RATE LIMIT EN MEMORIA (10 SOLICITUDES / MINUTO)
// ============================================================================
const RATE_LIMIT_MAX_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_PER_MINUTE) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ============================================================================
// ASERCIONES DE SEGURIDAD Y PRIVACIDAD
// ============================================================================

// 1. Cero secretos en cualquier nivel de respuesta
export function assertNoSecrets(obj: any, path = ""): void {
  if (!obj || typeof obj !== "object") return;
  const forbiddenPatterns = /password|secret|token|key|credential|client_secret|refresh/i;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (forbiddenPatterns.test(key)) {
      throw new Error(`VIOLACIÓN DE SEGURIDAD: Campo sensible detectado en respuesta: ${currentPath}`);
    }
    if (typeof value === "object" && value !== null) {
      assertNoSecrets(value, currentPath);
    }
  }
}

// 2. Cero PII en el payload llm_sanitized (para la futura IA)
export function assertNoPii(obj: any, path = ""): void {
  if (!obj || typeof obj !== "object") return;
  const forbiddenPatterns = /email|admin_email|recipient_email|full_name|user_name|telefono|phone|nit|cedula|document|password|secret|token|key|credential/i;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (forbiddenPatterns.test(key)) {
      throw new Error(`VIOLACIÓN DE PRIVACIDAD: Campo sensible/PII detectado en llm_sanitized: ${currentPath}`);
    }
    if (typeof value === "object" && value !== null) {
      assertNoPii(value, currentPath);
    }
  }
}

// ============================================================================
// LÓGICA UNIFICADA DE CLÍNICAS (IDÉNTICA A adminService.getTenants / TenantsPanelV2)
// ============================================================================
async function getUnifiedTenants(admin: ReturnType<typeof createClient>) {
  const [{ data: dbTenants, error: tErr }, { data: configRow }] =
    await Promise.all([
      admin
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("website_config")
        .select("config")
        .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
        .maybeSingle(),
    ]);

  if (tErr) {
    console.warn("Aviso al consultar tenants:", tErr.message);
  }

  const savedTenants = Array.isArray(configRow?.config?.registered_tenants)
    ? configRow.config.registered_tenants
    : [];

  const tenantsMap = new Map<
    string,
    {
      id: string;
      nombre: string;
      activo: boolean;
      plan: string;
      subscription_end_date: string | null;
      source: "tenants" | "registered_tenants" | "merged";
    }
  >();

  // 1. Mapear desde la tabla tenants de PostgreSQL
  for (const t of dbTenants || []) {
    if (t.id === GLOBAL_CONFIG_TENANT_ID) continue;
    const idKey = String(t.id);
    const paramEndDate =
      t.parametros?.subscription_end_date || t.subscription_end_date || null;

    tenantsMap.set(idKey, {
      id: idKey,
      nombre: t.nombre || "Clínica sin nombre",
      activo: t.activo !== false,
      plan: t.plan || t.parametros?.plan_id || "Básico",
      subscription_end_date: paramEndDate,
      source: "tenants",
    });
  }

  // 2. Fusionar desde website_config.registered_tenants (igual que TenantsPanelV2)
  for (const t of savedTenants) {
    if (!t || !t.id || t.id === GLOBAL_CONFIG_TENANT_ID) continue;
    const idKey = String(t.id);
    const existing = tenantsMap.get(idKey);
    const source = existing ? "merged" : "registered_tenants";
    const isActive =
      t.activo !== false && (existing ? existing.activo !== false : true);

    tenantsMap.set(idKey, {
      id: idKey,
      nombre: t.nombre || t.name || existing?.nombre || "Clínica sin nombre",
      activo: isActive,
      plan: t.plan || t.planId || existing?.plan || "Básico",
      subscription_end_date:
        t.subscriptionEndDate || existing?.subscription_end_date || null,
      source,
    });
  }

  return Array.from(tenantsMap.values());
}

// ============================================================================
// PAGINACIÓN DEFENSIVA DE auth.users CON INDICADOR DE TRUNCADO
// ============================================================================
async function listAllAuthUsers(admin: ReturnType<typeof createClient>) {
  let page = 1;
  const perPage = 100;
  const MAX_USERS_LIMIT = 2000;
  const allUsers: Array<{ id: string; email?: string; last_sign_in_at?: string }> = [];
  let isTruncated = false;

  while (allUsers.length < MAX_USERS_LIMIT) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users || data.users.length === 0) break;

    for (const u of data.users) {
      allUsers.push({
        id: u.id,
        email: u.email,
        last_sign_in_at: u.last_sign_in_at,
      });
      if (allUsers.length >= MAX_USERS_LIMIT) {
        isTruncated = true;
        break;
      }
    }

    if (data.users.length < perPage || isTruncated) break;
    page += 1;
  }

  return { users: allUsers, truncated: isTruncated };
}

// ============================================================================
// HERRAMIENTAS DE SOLO LECTURA (DOBLE NIVEL: ADMIN INTERNO vs LLM SANITIZADO)
// ============================================================================

// 1. get_clinics_summary
async function getClinicsSummary(admin: ReturnType<typeof createClient>) {
  const [clinics, requestsRes] = await Promise.all([
    getUnifiedTenants(admin),
    admin
      .from("subscription_requests")
      .select("id")
      .eq("status", "pending"),
  ]);

  const totalClinics = clinics.length;
  const activeClinics = clinics.filter((c) => c.activo === true).length;
  const inactiveClinics = totalClinics - activeClinics;
  const pendingRequests = requestsRes.data ? requestsRes.data.length : 0;

  const internal_admin = {
    total_clinics: totalClinics,
    active_clinics: activeClinics,
    inactive_clinics: inactiveClinics,
    pending_subscription_requests: pendingRequests,
    clinicas: clinics.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      activo: c.activo,
      plan: c.plan,
      source: c.source,
    })),
  };

  const llm_sanitized = {
    total_clinics: totalClinics,
    active_clinics: activeClinics,
    inactive_clinics: inactiveClinics,
    pending_subscription_requests: pendingRequests,
  };

  assertNoSecrets(internal_admin);
  assertNoSecrets(llm_sanitized);
  assertNoPii(llm_sanitized);

  return {
    tool: "get_clinics_summary",
    internal_admin,
    llm_sanitized,
    timestamp: new Date().toISOString(),
  };
}

// 2. get_expiring_clinics
async function getExpiringClinics(admin: ReturnType<typeof createClient>, days = 30) {
  const clinics = await getUnifiedTenants(admin);
  const now = new Date();
  const thresholdMs = days * 24 * 60 * 60 * 1000;

  const expiringList: Array<{
    id: string;
    nombre: string;
    plan: string;
    subscription_end_date: string;
    dias_restantes: number;
    estado: "vencida" | "proxima_a_vencer";
    source: string;
  }> = [];

  for (const c of clinics) {
    if (!c.activo || !c.subscription_end_date) continue;
    const endDate = new Date(c.subscription_end_date);
    if (isNaN(endDate.getTime())) continue;

    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (diffMs <= thresholdMs) {
      expiringList.push({
        id: c.id,
        nombre: c.nombre,
        plan: c.plan,
        subscription_end_date: endDate.toISOString().split("T")[0],
        dias_restantes: diffDays,
        estado: diffDays < 0 ? "vencida" : "proxima_a_vencer",
        source: c.source,
      });
    }
  }

  expiringList.sort((a, b) => a.dias_restantes - b.dias_restantes);

  const internal_admin = {
    dias_ventana: days,
    total_en_riesgo: expiringList.length,
    clinicas: expiringList,
  };

  const llm_sanitized = {
    dias_ventana: days,
    total_en_riesgo: expiringList.length,
    clinicas: expiringList.map((c, idx) => ({
      clinica_index: idx + 1,
      plan: c.plan,
      dias_restantes: c.dias_restantes,
      estado: c.estado,
    })),
  };

  assertNoSecrets(internal_admin);
  assertNoSecrets(llm_sanitized);
  assertNoPii(llm_sanitized);

  return {
    tool: "get_expiring_clinics",
    internal_admin,
    llm_sanitized,
    timestamp: new Date().toISOString(),
  };
}

// 3. get_recent_activity
async function getRecentActivity(admin: ReturnType<typeof createClient>) {
  const [profilesRes, authResult, clinics] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, role, tenant_id")
      .neq("tenant_id", GLOBAL_CONFIG_TENANT_ID),
    listAllAuthUsers(admin),
    getUnifiedTenants(admin),
  ]);

  const clinicsMap = new Map<string, string>();
  for (const c of clinics) {
    clinicsMap.set(c.id, c.nombre);
  }

  const authUserMap = new Map<string, { last_sign_in_at?: string; email?: string }>();
  for (const u of authResult.users) {
    authUserMap.set(u.id, {
      last_sign_in_at: u.last_sign_in_at,
      email: u.email,
    });
  }

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const activeClinicsLast24h = new Set<string>();

  const adminRecentLogins: Array<{
    clinic_name: string;
    user_name: string;
    role: string;
    last_sign_in_at: string;
  }> = [];

  const sanitizedRecentLogins: Array<{
    role: string;
    last_sign_in_at: string;
  }> = [];

  for (const p of profilesRes.data || []) {
    if (!p.tenant_id) continue;
    const authData = authUserMap.get(p.id);
    if (!authData?.last_sign_in_at) continue;

    const signInTs = new Date(authData.last_sign_in_at).getTime();
    if (now - signInTs <= oneDayMs) {
      activeClinicsLast24h.add(String(p.tenant_id));
    }

    adminRecentLogins.push({
      clinic_name: clinicsMap.get(String(p.tenant_id)) || "Clínica",
      user_name: p.full_name || p.email || "Usuario",
      role: p.role || "usuario",
      last_sign_in_at: authData.last_sign_in_at,
    });

    sanitizedRecentLogins.push({
      role: p.role || "usuario",
      last_sign_in_at: authData.last_sign_in_at,
    });
  }

  adminRecentLogins.sort(
    (a, b) => new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime()
  );

  sanitizedRecentLogins.sort(
    (a, b) => new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime()
  );

  const internal_admin = {
    total_usuarios_consultados: authResult.users.length,
    truncated: authResult.truncated,
    clinicas_activas_ultimas_24h: activeClinicsLast24h.size,
    ultimos_ingresos: adminRecentLogins.slice(0, 8),
  };

  const llm_sanitized = {
    total_usuarios_consultados: authResult.users.length,
    truncated: authResult.truncated,
    clinicas_activas_ultimas_24h: activeClinicsLast24h.size,
    ultimos_ingresos: sanitizedRecentLogins.slice(0, 8),
  };

  assertNoSecrets(internal_admin);
  assertNoSecrets(llm_sanitized);
  assertNoPii(llm_sanitized);

  return {
    tool: "get_recent_activity",
    internal_admin,
    llm_sanitized,
    timestamp: new Date().toISOString(),
  };
}

// 4. get_factus_usage_summary (Reutilizando la fuente canónica factus-proxy/status)
async function getFactusUsageSummary(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  userToken: string
) {
  const clinics = await getUnifiedTenants(admin);

  const statuses = await Promise.all(
    clinics.map(async (c) => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/factus-proxy`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${userToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "status", tenantId: c.id }),
        });

        if (!response.ok) {
          return {
            id: c.id,
            nombre: c.nombre,
            configured: false,
            environment: "desconocido",
            cuota: 0,
            usadas: 0,
            disponibles: 0,
          };
        }

        const data = await response.json();
        const configured = data?.configured === true;
        const testMode = data?.factusTestMode !== false;
        const cuota = Number(data?.facturacionCuota || 0);
        const usadas = Number(data?.facturacionUsadas || 0);
        const disponibles = Math.max(0, cuota - usadas);

        return {
          id: c.id,
          nombre: c.nombre,
          configured,
          environment: configured ? (testMode ? "sandbox" : "production") : "no_configurado",
          cuota,
          usadas,
          disponibles,
        };
      } catch (_e) {
        return {
          id: c.id,
          nombre: c.nombre,
          configured: false,
          environment: "error_consulta",
          cuota: 0,
          usadas: 0,
          disponibles: 0,
        };
      }
    })
  );

  let totalCuota = 0;
  let totalUsadas = 0;
  let clinicasConfiguradas = 0;
  let produccionCount = 0;
  let sandboxCount = 0;
  const clinicasCercaDelLimiteAdmin: Array<{
    id: string;
    nombre: string;
    cuota: number;
    usadas: number;
    disponibles: number;
  }> = [];

  for (const s of statuses) {
    if (s.configured) {
      clinicasConfiguradas += 1;
      totalCuota += s.cuota;
      totalUsadas += s.usadas;

      if (s.environment === "production") produccionCount += 1;
      if (s.environment === "sandbox") sandboxCount += 1;

      if (s.cuota > 0 && (s.disponibles <= 20 || s.disponibles / s.cuota < 0.15)) {
        clinicasCercaDelLimiteAdmin.push({
          id: s.id,
          nombre: s.nombre,
          cuota: s.cuota,
          usadas: s.usadas,
          disponibles: s.disponibles,
        });
      }
    }
  }

  const internal_admin = {
    clinicas_con_factus: clinicasConfiguradas,
    total_folios_asignados: totalCuota,
    total_folios_usados: totalUsadas,
    total_folios_disponibles: Math.max(0, totalCuota - totalUsadas),
    produccion: produccionCount,
    sandbox: sandboxCount,
    cantidad_cerca_del_limite: clinicasCercaDelLimiteAdmin.length,
    clinicas_cerca_del_limite: clinicasCercaDelLimiteAdmin,
    clinicas: statuses.map((s) => ({
      nombre: s.nombre,
      configured: s.configured,
      ...(s.configured ? { environment: s.environment } : {}),
      cuota: s.cuota,
      usadas: s.usadas,
      disponibles: s.disponibles,
    })),
  };

  const llm_sanitized = {
    clinicas_con_factus: clinicasConfiguradas,
    total_folios_asignados: totalCuota,
    total_folios_usados: totalUsadas,
    total_folios_disponibles: Math.max(0, totalCuota - totalUsadas),
    produccion: produccionCount,
    sandbox: sandboxCount,
    cantidad_cerca_del_limite: clinicasCercaDelLimiteAdmin.length,
  };

  assertNoSecrets(internal_admin);
  assertNoSecrets(llm_sanitized);
  assertNoPii(llm_sanitized);

  return {
    tool: "get_factus_usage_summary",
    internal_admin,
    llm_sanitized,
    timestamp: new Date().toISOString(),
  };
}

// 5. get_subscription_requests_pending
async function getSubscriptionRequestsPending(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("subscription_requests")
    .select("id, tenant_name, admin_name, admin_email, requested_plan_id, requested_plan_name, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error al consultar solicitudes: ${error.message}`);
  }

  const requests = data || [];

  const internal_admin = {
    total_pendientes: requests.length,
    solicitudes: requests.map((r) => ({
      id: r.id,
      tenant_name: r.tenant_name,
      admin_name: r.admin_name,
      admin_email: r.admin_email,
      requested_plan_name: r.requested_plan_name || r.requested_plan_id,
      created_at: r.created_at,
    })),
  };

  const llm_sanitized = {
    total_pendientes: requests.length,
    solicitudes: requests.map((r) => ({
      plan_solicitado: r.requested_plan_name || r.requested_plan_id,
      created_at: r.created_at,
    })),
  };

  assertNoSecrets(internal_admin);
  assertNoSecrets(llm_sanitized);
  assertNoPii(llm_sanitized);

  return {
    tool: "get_subscription_requests_pending",
    internal_admin,
    llm_sanitized,
    timestamp: new Date().toISOString(),
  };
}

// 6. get_recent_email_issues
async function getRecentEmailIssues(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("email_logs")
    .select("id, tenant_id, recipient_email, subject, template_type, status, error_message, sent_at, created_at")
    .or("status.eq.failed,error_message.not.is.null")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return {
      tool: "get_recent_email_issues",
      estado: "error_de_lectura",
      detalle: error.message,
      internal_admin: { total_fallidos_recientes: 0, incidentes: [] },
      llm_sanitized: { total_fallidos_recientes: 0 },
      timestamp: new Date().toISOString(),
    };
  }

  const issues = data || [];

  const internal_admin = {
    total_fallidos_recientes: issues.length,
    incidentes: issues.map((log) => ({
      id: log.id,
      recipient_email: log.recipient_email,
      subject: log.subject,
      error_message: log.error_message || "Fallo sin mensaje",
      created_at: log.created_at,
    })),
  };

  const llm_sanitized = {
    total_fallidos_recientes: issues.length,
    incidentes: issues.map((log) => ({
      tipo_plantilla: log.template_type,
      error_resumido: "Error de entrega",
      created_at: log.created_at,
    })),
  };

  assertNoSecrets(internal_admin);
  assertNoSecrets(llm_sanitized);
  assertNoPii(llm_sanitized);

  return {
    tool: "get_recent_email_issues",
    internal_admin,
    llm_sanitized,
    timestamp: new Date().toISOString(),
  };
}

// 7. get_payment_summary
async function getPaymentSummary(admin: ReturnType<typeof createClient>) {
  const [configRes, clinics] = await Promise.all([
    admin
      .from("website_config")
      .select("config")
      .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
      .maybeSingle(),
    getUnifiedTenants(admin),
  ]);

  const paymentMethods = configRes.data?.config?.payment_methods || [];
  const planCounts: Record<string, number> = {};

  for (const c of clinics) {
    if (!c.activo) continue;
    const planName = c.plan || "Sin plan";
    planCounts[planName] = (planCounts[planName] || 0) + 1;
  }

  const internal_admin = {
    metodos_pago_configurados: (paymentMethods || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      active: m.active !== false,
    })),
    distribucion_planes_activos: planCounts,
    transacciones_pasarela: "Información de transacciones en pasarela no disponible todavía (sin pasarela externa integrada)",
  };

  const llm_sanitized = {
    total_metodos_activos: (paymentMethods || []).filter((m: any) => m.active !== false).length,
    distribucion_planes_activos: planCounts,
    transacciones_pasarela: "Información de transacciones en pasarela no disponible todavía",
  };

  assertNoSecrets(internal_admin);
  assertNoSecrets(llm_sanitized);
  assertNoPii(llm_sanitized);

  return {
    tool: "get_payment_summary",
    internal_admin,
    llm_sanitized,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// SERVIDOR PRINCIPAL DE LA EDGE FUNCTION
// ============================================================================
const MAX_BODY_BYTES = 32 * 1024; // Límite defensivo de 32 KB

const VALID_ACTIONS = new Set([
  "get_dashboard_summary",
  "get_clinics_summary",
  "get_expiring_clinics",
  "get_recent_activity",
  "get_factus_usage_summary",
  "get_subscription_requests_pending",
  "get_recent_email_issues",
  "get_payment_summary",
]);

Deno.serve(async (request) => {
  const startTime = Date.now();
  let currentUserId: string | null = null;
  let currentAction: string | null = null;

  const { isAllowed, corsHeaders } = handleCors(request);

  // Si el Origin no está permitido: rechazar con 403 y SIN encabezado Access-Control-Allow-Origin
  if (!isAllowed) {
    return json({ success: false, error: "ORIGIN_NOT_ALLOWED", message: "Origen no autorizado para acceder a este servicio." }, 403, {});
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ success: false, error: "Método no permitido." }, 405, corsHeaders);
  }

  // C. Límite defensivo de tamaño de cuerpo (HTTP 413 PAYLOAD_TOO_LARGE)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return json(
      {
        success: false,
        error: "PAYLOAD_TOO_LARGE",
        message: "El cuerpo de la solicitud excede el límite permitido (32 KB).",
      },
      413,
      corsHeaders
    );
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return json(
        {
          success: false,
          error: "PAYLOAD_TOO_LARGE",
          message: "El cuerpo de la solicitud excede el límite permitido (32 KB).",
        },
        413,
        corsHeaders
      );
    }

    let body: any = {};
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return json(
          {
            success: false,
            error: "INVALID_JSON",
            message: "El cuerpo de la solicitud debe ser un JSON válido.",
          },
          400,
          corsHeaders
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError(500, "La función no tiene configuradas sus credenciales internas.");
    }

    // 1. Validar presencia de Bearer token
    const authorization = request.headers.get("Authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
      throw new HttpError(401, "Debes iniciar sesión para consultar este servicio.");
    }

    // 2. Validar autenticidad de la sesión
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData.user) {
      throw new HttpError(401, "La sesión no es válida o ha expirado.");
    }

    const userId = authData.user.id;
    currentUserId = userId;

    // 3. Validar rol y estado activo en la tabla profiles
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, activo, email")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new HttpError(403, "Perfil no encontrado en el sistema.");
    }

    if (profile.activo === false) {
      throw new HttpError(403, "Tu usuario se encuentra inactivo.");
    }

    const normalizedRole = String(profile.role || "").trim().toLowerCase();
    if (normalizedRole !== "superadmin") {
      throw new HttpError(403, "Acceso denegado: Esta función es exclusiva para el Superadministrador.");
    }

    // 4. Rate limit en memoria (10 req/min)
    if (!checkRateLimit(userId)) {
      return json(
        {
          success: false,
          error: "rate_limited",
          message: "Has superado el límite de consultas permitidas por minuto (máx 10 req/min). Por favor espera un momento.",
        },
        429,
        corsHeaders
      );
    }

    // B. Validación estricta de action
    const action = String(body?.action || "get_dashboard_summary");
    currentAction = action;

    if (!VALID_ACTIONS.has(action)) {
      return json(
        {
          success: false,
          error: "INVALID_ACTION",
          message: `Acción '${action}' no permitida o desconocida.`,
          available_actions: Array.from(VALID_ACTIONS),
        },
        400,
        corsHeaders
      );
    }

    // Enrutador de herramientas
    let responseData: any = null;

    switch (action) {
      case "get_clinics_summary": {
        responseData = await getClinicsSummary(adminClient);
        break;
      }

      case "get_expiring_clinics": {
        // A. Validación estricta del parámetro days (entero entre 1 y 365)
        let days = 30;
        if ("days" in body) {
          const rawDays = body.days;
          if (
            typeof rawDays !== "number" ||
            !Number.isInteger(rawDays) ||
            isNaN(rawDays) ||
            rawDays < 1 ||
            rawDays > 365
          ) {
            return json(
              {
                success: false,
                error: "INVALID_ARGUMENT",
                message: "El parámetro 'days' debe ser un número entero entre 1 y 365.",
              },
              400,
              corsHeaders
            );
          }
          days = rawDays;
        }
        responseData = await getExpiringClinics(adminClient, days);
        break;
      }

      case "get_recent_activity": {
        responseData = await getRecentActivity(adminClient);
        break;
      }

      case "get_factus_usage_summary": {
        responseData = await getFactusUsageSummary(adminClient, supabaseUrl, token);
        break;
      }

      case "get_subscription_requests_pending": {
        responseData = await getSubscriptionRequestsPending(adminClient);
        break;
      }

      case "get_recent_email_issues": {
        responseData = await getRecentEmailIssues(adminClient);
        break;
      }

      case "get_payment_summary": {
        responseData = await getPaymentSummary(adminClient);
        break;
      }

      case "get_dashboard_summary": {
        const [clinics, expiring, activity, factus, requests, emailIssues, payments] =
          await Promise.all([
            getClinicsSummary(adminClient).catch((e) => ({ error: e.message })),
            getExpiringClinics(adminClient, 30).catch((e) => ({ error: e.message })),
            getRecentActivity(adminClient).catch((e) => ({ error: e.message })),
            getFactusUsageSummary(adminClient, supabaseUrl, token).catch((e) => ({ error: e.message })),
            getSubscriptionRequestsPending(adminClient).catch((e) => ({ error: e.message })),
            getRecentEmailIssues(adminClient).catch((e) => ({ error: e.message })),
            getPaymentSummary(adminClient).catch((e) => ({ error: e.message })),
          ]);

        responseData = {
          clinics,
          expiring,
          activity,
          factus,
          requests,
          emailIssues,
          payments,
          servidor: {
            status: "no_disponible",
            mensaje: "Información de servidor no disponible todavía (sin agente de métricas en VPS)",
          },
          backups: {
            status: "no_disponible",
            mensaje: "Información de backups no disponible todavía (sin sonda de almacenamiento conectada)",
          },
          rips_global: {
            status: "no_disponible",
            mensaje: "Información de RIPS globales no disponible todavía",
          },
          timestamp: new Date().toISOString(),
        };
        break;
      }
    }

    // D. Logs mínimos sanitizados (cero tokens, cero secretos, cero payloads sensibles)
    console.log(
      JSON.stringify({
        user_id: currentUserId,
        action: currentAction,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        status: 200,
      })
    );

    return json({ success: true, data: responseData }, 200, corsHeaders);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err?.message || "Error interno del servidor.";

    console.error(
      JSON.stringify({
        user_id: currentUserId || "unauthenticated",
        action: currentAction || "unknown",
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        status,
      })
    );

    return json({ success: false, error: message }, status, corsHeaders);
  }
});
