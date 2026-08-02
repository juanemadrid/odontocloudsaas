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

    const body = await request.json();
    const adminEmail = String(body?.adminEmail || "").trim().toLowerCase();
    const adminPassword = String(body?.adminPassword || "");
    const adminName = String(body?.adminName || "").trim();
    const clinicName = String(body?.clinicName || "").trim();
    const plan = callerIsSuperadmin ? normalizePlan(body?.requestedPlan) : "free";
    const planDuration = body?.planDuration === "yearly" ? "yearly" : "monthly";
    const nit = String(body?.nit || "").trim().slice(0, 50);
    const phone = String(body?.telefono || "").trim().slice(0, 50);
    const address = String(body?.direccion || "").trim().slice(0, 250);
    const city = String(body?.ciudad || "").trim().slice(0, 120);
    const contactEmail = String(body?.contactEmail || adminEmail).trim().toLowerCase().slice(0, 254);

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

    const forwardedFor = request.headers.get("x-forwarded-for") || "unknown";
    if (!callerIsSuperadmin) {
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
    }

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
      full_name: adminName,
      email: adminEmail,
      role: "administrador",
      activo: true,
    });
    if (profileError) throw profileError;

    const { error: branchError } = await admin.from("sucursales").insert({
      tenant_id: tenant.id,
      nombre: "Sede Principal",
      activo: true,
    });
    if (branchError) throw branchError;

    const { error: officeError } = await admin.from("consultorios").insert({
      tenant_id: tenant.id,
      nombre: "Consultorio Principal",
      activo: true,
    });
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
      nit,
      telefono: phone,
      direccion: address,
      ciudad: city,
      contactEmail,
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
          ...existingTenants.filter((entry: any) => entry?.id !== tenant.id),
        ],
      },
      updated_at: new Date().toISOString(),
    });
    if (catalogError) throw catalogError;

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
        if (createdTenantId) {
          await cleanup.from("tenants").delete().eq("id", createdTenantId);
        }
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
