import { createClient } from "npm:@supabase/supabase-js@2";

const GLOBAL_CONFIG_TENANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hashValue = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const normalizePlan = (requested: unknown) => {
  const value = String(requested || "").toLowerCase();
  if (value.includes("empresa") || value.includes("enterprise")) return "enterprise";
  if (value.includes("pro") || value.includes("clinica")) return "pro";
  return "free";
};

const validateRegistration = ({
  adminEmail,
  adminPassword,
  adminName,
  clinicName,
}: {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  clinicName: string;
}) => {
  if (!clinicName || clinicName.length < 3 || clinicName.length > 120) {
    throw new HttpError(400, "El nombre de la clinica no es valido.");
  }
  if (!adminName || adminName.length < 3 || adminName.length > 120) {
    throw new HttpError(400, "El nombre del administrador no es valido.");
  }
  if (!adminEmail || !adminEmail.includes("@") || adminEmail.length > 254) {
    throw new HttpError(400, "El correo no es valido.");
  }
  if (adminPassword.length < 8 || adminPassword.length > 72) {
    throw new HttpError(400, "La contrasena debe tener entre 8 y 72 caracteres.");
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ success: false, error: "Metodo no permitido." }, 405);
  }

  let createdTenantId = "";
  let createdUserId = "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError(500, "La funcion no tiene configuradas sus credenciales internas.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = await request.json();
    const action = String(body?.action || "submit_request");

    let callerIsSuperadmin = false;
    const authorization = request.headers.get("Authorization") || "";
    if (authorization.startsWith("Bearer ")) {
      const token = authorization.slice("Bearer ".length);
      const { data: callerAuth } = await admin.auth.getUser(token);
      if (callerAuth.user) {
        const { data: callerProfile } = await admin
          .from("profiles")
          .select("role, activo")
          .eq("id", callerAuth.user.id)
          .maybeSingle();
        callerIsSuperadmin =
          callerProfile?.activo === true &&
          String(callerProfile?.role || "").trim().toLowerCase() === "superadmin";
      }
    }

    if (action === "submit_request") {
      const adminEmail = String(body?.adminEmail || "").trim().toLowerCase();
      const adminPassword = String(body?.adminPassword || "");
      const adminName = String(body?.adminName || "").trim();
      const clinicName = String(body?.clinicName || "").trim();
      const requestedPlanId = typeof body?.requestedPlan === "object"
        ? String(body.requestedPlan?.id || "trial")
        : String(body?.requestedPlan || "trial");
      const requestedPlanName = typeof body?.requestedPlan === "object"
        ? String(body.requestedPlan?.name || "Trial")
        : String(body?.requestedPlanName || body?.requestedPlan || "Trial");

      validateRegistration({ adminEmail, adminPassword, adminName, clinicName });

      const forwardedFor = request.headers.get("x-forwarded-for") || "unknown";
      const clientAddress = forwardedFor.split(",")[0].trim();
      const requestHash = await hashValue(clientAddress + ":" + adminEmail);
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { count, error: countError } = await admin
        .from("registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("request_hash", requestHash)
        .gte("attempted_at", since);
      if (countError) throw countError;
      if ((count || 0) >= 5) {
        throw new HttpError(429, "Demasiados intentos. Intenta de nuevo mas tarde.");
      }

      const { error: attemptError } = await admin
        .from("registration_attempts")
        .insert({ request_hash: requestHash });
      if (attemptError) throw attemptError;

      const { data: requestId, error: requestError } = await admin.rpc(
        "store_subscription_request",
        {
          p_admin_email: adminEmail,
          p_admin_password: adminPassword,
          p_admin_name: adminName,
          p_clinic_name: clinicName,
          p_requested_plan_id: requestedPlanId,
          p_requested_plan_name: requestedPlanName,
        },
      );
      if (requestError || !requestId) {
        throw requestError || new Error("No se pudo guardar la solicitud.");
      }

      return json({
        success: true,
        request: {
          id: requestId,
          tenantName: clinicName,
          adminName,
          adminEmail,
          requestedPlanId,
          requestedPlanName,
          status: "pending",
        },
      }, 201);
    }

    if (!callerIsSuperadmin) {
      throw new HttpError(403, "Solo el superadministrador puede gestionar clinicas.");
    }

    if (action === "reject_request") {
      const requestId = String(body?.requestId || "");
      if (!requestId) throw new HttpError(400, "La solicitud es obligatoria.");

      const { error } = await admin
        .from("subscription_requests")
        .update({
          status: "rejected",
          reject_reason: String(body?.reason || "").slice(0, 500),
          processed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("status", "pending");
      if (error) throw error;

      const { error: cleanupError } = await admin.rpc(
        "delete_subscription_request_password",
        { p_request_id: requestId },
      );
      if (cleanupError) throw cleanupError;
      return json({ success: true });
    }

    let requestId = "";
    let requestRow: Record<string, unknown> | null = null;
    if (action === "approve_request") {
      requestId = String(body?.requestId || "");
      if (!requestId) throw new HttpError(400, "La solicitud es obligatoria.");

      const { data, error } = await admin
        .from("subscription_requests")
        .select("*")
        .eq("id", requestId)
        .eq("status", "pending")
        .maybeSingle();
      if (error || !data) {
        throw new HttpError(404, "La solicitud pendiente no existe.");
      }
      requestRow = data;
    } else if (action !== "create_clinic") {
      throw new HttpError(400, "Operacion desconocida.");
    }

    const adminEmail = String(
      requestRow?.admin_email || body?.adminEmail || "",
    ).trim().toLowerCase();
    let adminPassword = String(body?.adminPassword || "");
    const adminName = String(
      requestRow?.admin_name || body?.adminName || "",
    ).trim();
    const clinicName = String(
      requestRow?.tenant_name || body?.clinicName || "",
    ).trim();
    const requestedPlan = requestRow?.requested_plan_id || body?.requestedPlan;
    const plan = normalizePlan(requestedPlan);
    const planDuration = body?.planDuration === "yearly" ? "yearly" : "monthly";

    if (requestId) {
      const { data: storedPassword, error: passwordError } = await admin.rpc(
        "get_subscription_request_password",
        { p_request_id: requestId },
      );
      if (passwordError || !storedPassword) {
        throw passwordError || new Error("La solicitud no conserva una contrasena valida.");
      }
      adminPassword = String(storedPassword);
    }

    validateRegistration({ adminEmail, adminPassword, adminName, clinicName });

    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      if (data.users.some((user) => user.email?.toLowerCase() === adminEmail)) {
        throw new HttpError(409, "El correo ya tiene una cuenta registrada.");
      }
      if (data.users.length < 100) break;
    }

    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        nombre: clinicName,
        nit: String(body?.nit || "").trim().slice(0, 50),
        telefono: String(body?.telefono || "").trim().slice(0, 50),
        direccion: String(body?.direccion || "").trim().slice(0, 250),
        ciudad: String(body?.ciudad || "").trim().slice(0, 120),
        plan,
        activo: true,
      })
      .select("id")
      .single();
    if (tenantError || !tenant) throw tenantError || new Error("No se pudo crear la clinica.");
    createdTenantId = tenant.id;

    const { data: authResult, error: authError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName },
      app_metadata: { role: "administrador", tenant_id: tenant.id },
    });
    if (authError || !authResult.user) {
      throw authError || new Error("No se pudo crear la cuenta.");
    }
    createdUserId = authResult.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: createdUserId,
      tenant_id: tenant.id,
      inquilino: tenant.id,
      full_name: adminName,
      email: adminEmail,
      role: "administrador",
      activo: true,
    });
    if (profileError) throw profileError;

    const [{ error: branchError }, { error: officeError }] = await Promise.all([
      admin.from("sucursales").insert({
        tenant_id: tenant.id,
        nombre: "Sede Principal",
        activo: true,
      }),
      admin.from("consultorios").insert({
        tenant_id: tenant.id,
        nombre: "Consultorio Principal",
        activo: true,
      }),
    ]);
    if (branchError) throw branchError;
    if (officeError) throw officeError;

    const createdAt = new Date();
    const subscriptionDays = planDuration === "yearly" ? 365 : 30;
    const subscriptionEndDate = new Date(
      createdAt.getTime() + subscriptionDays * 24 * 60 * 60 * 1000,
    );
    const invoiceQuota = plan === "enterprise" ? 2000 : plan === "pro" ? 500 : 100;
    const tenantEntry = {
      id: tenant.id,
      nombre: clinicName,
      nit: String(body?.nit || "").trim().slice(0, 50),
      telefono: String(body?.telefono || "").trim().slice(0, 50),
      direccion: String(body?.direccion || "").trim().slice(0, 250),
      ciudad: String(body?.ciudad || "").trim().slice(0, 120),
      contactEmail: String(body?.contactEmail || adminEmail).trim().toLowerCase().slice(0, 254),
      adminName,
      adminEmail,
      plan,
      planId: plan,
      planDuration,
      activo: true,
      facturacionCuota: invoiceQuota,
      facturacionUsadas: 0,
      created_at: createdAt.toISOString(),
      subscriptionEndDate: subscriptionEndDate.toISOString(),
    };

    const { data: globalRow, error: globalReadError } = await admin
      .from("website_config")
      .select("config")
      .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
      .maybeSingle();
    if (globalReadError) throw globalReadError;
    const existingConfig = globalRow?.config || {};
    const existingTenants = Array.isArray(existingConfig.registered_tenants)
      ? existingConfig.registered_tenants
      : [];
    const { error: catalogError } = await admin.from("website_config").upsert({
      tenant_id: GLOBAL_CONFIG_TENANT_ID,
      config: {
        ...existingConfig,
        registered_tenants: [
          tenantEntry,
          ...existingTenants.filter((entry: Record<string, unknown>) => entry?.id !== tenant.id),
        ],
      },
      updated_at: new Date().toISOString(),
    });
    if (catalogError) throw catalogError;

    if (requestId) {
      const { error: requestUpdateError } = await admin
        .from("subscription_requests")
        .update({ status: "approved", processed_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("status", "pending");
      if (requestUpdateError) throw requestUpdateError;

      const { error: secretCleanupError } = await admin.rpc(
        "delete_subscription_request_password",
        { p_request_id: requestId },
      );
      if (secretCleanupError) throw secretCleanupError;
    }

    return json({
      success: true,
      tenantId: tenant.id,
      user: { id: createdUserId, email: adminEmail },
    }, 201);
  } catch (error) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const cleanup = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        if (createdUserId) await cleanup.auth.admin.deleteUser(createdUserId);
        if (createdTenantId) await cleanup.from("tenants").delete().eq("id", createdTenantId);
      }
    } catch (cleanupError) {
      console.error("register-clinic cleanup:", cleanupError);
    }

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    console.error("register-clinic:", message);
    return json({ success: false, error: message }, status);
  }
});
