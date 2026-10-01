import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { dispatchWelcomeEmail } from "../_shared/resendEmail.ts";

const GLOBAL_CONFIG_TENANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const ODONTOCLOUD_RESET_URL = "https://odontocloudcolombia.com/reset-password";

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

/**
 * Validador estricto de autenticación SuperAdmin para acciones protegidas.
 * No confía en parámetros enviados por el cliente: valida la firma criptográfica
 * del JWT contra Supabase Auth y consulta el rol y estado activo en la BD.
 */
const verifySuperadminCaller = async (
  request: Request,
  admin: SupabaseClient
) => {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new HttpError(401, "Debes iniciar sesión con privilegios de SuperAdmin.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new HttpError(401, "Token de autenticación faltante o inválido.");
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    throw new HttpError(401, "La sesión no es válida o ha expirado.");
  }

  const { data: profile, error: profError } = await admin
    .from("profiles")
    .select("id, role, activo, email")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (
    profError ||
    !profile ||
    profile.activo !== true ||
    String(profile.role || "").trim().toLowerCase() !== "superadmin"
  ) {
    throw new HttpError(403, "Acceso denegado: se requieren privilegios activos de SuperAdmin.");
  }

  return { callerUser: authData.user, callerProfile: profile };
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

    // ──────────────────────────────────────────────────────────────────────────
    // 1. ACCIÓN PÚBLICA: Solicitud de registro desde la Landing (Rate-limited)
    // ──────────────────────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────────────────────
    // 2. PROTECCIÓN ESTRICTA: Todas las demás acciones requieren SuperAdmin
    // ──────────────────────────────────────────────────────────────────────────
    const { callerProfile } = await verifySuperadminCaller(request, admin);

    // ──────────────────────────────────────────────────────────────────────────
    // 3. REENVIAR CORREO DE BIENVENIDA (Manual por SuperAdmin)
    // ──────────────────────────────────────────────────────────────────────────
    if (action === "resend_welcome_email") {
      const tenantId = String(body?.tenantId || "").trim();
      const adminEmailTarget = String(body?.adminEmail || "").trim().toLowerCase();

      if (!tenantId && !adminEmailTarget) {
        throw new HttpError(400, "El ID de la clinica o el correo es obligatorio.");
      }

      let tenantQuery = admin.from("tenants").select("id, nombre, plan");
      if (tenantId) tenantQuery = tenantQuery.eq("id", tenantId);
      const { data: targetTenant, error: tErr } = await tenantQuery.maybeSingle();
      if (tErr || !targetTenant) {
        throw new HttpError(404, "No se encontro la clinica especificada.");
      }

      let profQuery = admin
        .from("profiles")
        .select("id, email, full_name, role, tenant_id")
        .eq("tenant_id", targetTenant.id);
      if (adminEmailTarget) profQuery = profQuery.eq("email", adminEmailTarget);
      const { data: targetProfiles, error: pErr } = await profQuery;

      const targetProfile =
        (targetProfiles || []).find((p) =>
          String(p.role || "").toLowerCase().includes("admin")
        ) || targetProfiles?.[0];

      if (!targetProfile || !targetProfile.email) {
        throw new HttpError(404, "No se encontro un usuario administrador para esta clinica.");
      }

      const targetEmail = targetProfile.email.toLowerCase();
      const targetName = targetProfile.full_name || `Administrador ${targetTenant.nombre}`;

      // Protección contra flood / reenvíos dobles accidentales (mínimo 60s entre envíos)
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { data: recentLogs } = await admin
        .from("email_logs")
        .select("id, status, created_at")
        .eq("recipient_email", targetEmail)
        .eq("template_type", "welcome_clinic")
        .gte("created_at", sixtySecondsAgo)
        .limit(1);

      if (recentLogs && recentLogs.length > 0) {
        throw new HttpError(
          429,
          "Ya se envio un correo a este destinatario hace menos de 1 minuto. Espera un momento antes de reenviar."
        );
      }

      // Generar nuevo enlace de recuperación seguro
      let setupPasswordUrl = ODONTOCLOUD_RESET_URL;
      try {
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: targetEmail,
          options: { redirectTo: ODONTOCLOUD_RESET_URL },
        });
        if (!linkErr && linkData?.properties?.action_link) {
          setupPasswordUrl = linkData.properties.action_link;
        } else if (linkErr) {
          console.warn("generateLink error:", linkErr.message);
        }
      } catch (linkGenErr) {
        console.warn("Exception generating password link:", linkGenErr);
      }

      // Disparar envío con Resend y registrar en email_logs
      const sendResult = await dispatchWelcomeEmail(admin, {
        tenantId: targetTenant.id,
        clinicName: targetTenant.nombre,
        adminName: targetName,
        adminEmail: targetEmail,
        planName: targetTenant.plan || "standard",
        setupPasswordUrl,
        initiatedBy: callerProfile.email || "superadmin",
      });

      if (!sendResult.success) {
        throw new HttpError(502, `No se pudo enviar el correo mediante Resend: ${sendResult.error}`);
      }

      return json({
        success: true,
        message: `Correo de bienvenida reenviado exitosamente a ${targetEmail}.`,
        resendId: sendResult.resendId,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. RECHAZAR SOLICITUD
    // ──────────────────────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────────────────────
    // 5. ELIMINAR CLÍNICA
    // ──────────────────────────────────────────────────────────────────────────
    if (action === "delete_clinic") {
      const tenantId = String(body?.tenantId || "");
      if (!tenantId) throw new HttpError(400, "El ID de la clinica es obligatorio.");

      // 1. Obtener todos los perfiles vinculados a la clínica
      const { data: clinicProfiles } = await admin
        .from("profiles")
        .select("id, email")
        .eq("tenant_id", tenantId);

      // 2. Eliminar cada usuario de Supabase Auth (auth.users)
      if (clinicProfiles && clinicProfiles.length > 0) {
        for (const p of clinicProfiles) {
          try {
            await admin.auth.admin.deleteUser(p.id);
          } catch (delAuthErr) {
            console.warn("No se pudo eliminar auth user:", p.id, delAuthErr);
          }
        }
        await admin.from("profiles").delete().eq("tenant_id", tenantId);
      }

      // 3. Eliminar recursos físicos asociados
      await admin.from("sucursales").delete().eq("tenant_id", tenantId);
      await admin.from("consultorios").delete().eq("tenant_id", tenantId);

      // 4. Eliminar de la tabla tenants
      await admin.from("tenants").delete().eq("id", tenantId);

      // 5. Eliminar de website_config.registered_tenants
      const { data: globalRow } = await admin
        .from("website_config")
        .select("config")
        .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
        .maybeSingle();

      if (globalRow?.config?.registered_tenants) {
        const currentList = Array.isArray(globalRow.config.registered_tenants)
          ? globalRow.config.registered_tenants
          : [];
        const updatedTenants = currentList.filter(
          (t: Record<string, unknown>) => String(t?.id) !== tenantId
        );
        await admin.from("website_config").upsert({
          tenant_id: GLOBAL_CONFIG_TENANT_ID,
          config: {
            ...globalRow.config,
            registered_tenants: updatedTenants,
          },
          updated_at: new Date().toISOString(),
        });
      }

      return json({ success: true, message: "Clinica y usuarios eliminados completamente." });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. APROBAR SOLICITUD O CREAR CLÍNICA DIRECTA
    // ──────────────────────────────────────────────────────────────────────────
    let requestId = "";
    let requestRow: Record<string, unknown> | null = null;

    if (action === "approve_request") {
      requestId = String(body?.requestId || "");
      if (!requestId) throw new HttpError(400, "La solicitud es obligatoria.");

      // Protección de idempotencia: sólo procesar si está estrictamente en pending
      const { data, error } = await admin
        .from("subscription_requests")
        .select("*")
        .eq("id", requestId)
        .eq("status", "pending")
        .maybeSingle();

      if (error || !data) {
        throw new HttpError(409, "La solicitud ya fue procesada anteriormente o no existe.");
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

    // Validar si el correo ya existe en auth.users
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      const existingUser = data.users.find((u) => u.email?.toLowerCase() === adminEmail);
      if (existingUser) {
        // Verificar si este usuario pertenece a una clínica REAL y ACTIVA
        const { data: prof } = await admin
          .from("profiles")
          .select("id, tenant_id, activo, role")
          .eq("id", existingUser.id)
          .maybeSingle();

        let tenantIsActive = false;
        if (prof?.tenant_id) {
          const { data: activeTenant } = await admin
            .from("tenants")
            .select("id, activo")
            .eq("id", prof.tenant_id)
            .maybeSingle();
          if (activeTenant && activeTenant.activo !== false) {
            tenantIsActive = true;
          }
        }

        if (tenantIsActive) {
          throw new HttpError(409, "El correo ya tiene una cuenta registrada con una clínica activa.");
        } else {
          // La clínica anterior fue eliminada o el usuario quedó huérfano. Purgar.
          try {
            await admin.auth.admin.deleteUser(existingUser.id);
            await admin.from("profiles").delete().eq("id", existingUser.id);
          } catch (purgeErr) {
            console.warn("No se pudo purgar usuario huérfano:", purgeErr);
          }
        }
      }
      if (data.users.length < 100) break;
    }

    // A. Crear registro en tabla tenants
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

    // B. Crear usuario en auth.users
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

    // C. Crear perfil en profiles
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

    // D. Crear sede y consultorio por defecto
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

    // E. Actualizar catálogo en website_config
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

    // F. Finalizar solicitud si venía de un submit_request
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

    // ──────────────────────────────────────────────────────────────────────────
    // G. ENVÍO DE CORREO AUTOMÁTICO DE BIENVENIDA (Completamente Desacoplado)
    // ──────────────────────────────────────────────────────────────────────────
    // Se ejecuta estrictamente después de que la clínica y el usuario ya están
    // creados y consolidados. Si Resend llegara a fallar, la creación de la clínica
    // NO se revertirá.
    try {
      let setupPasswordUrl = ODONTOCLOUD_RESET_URL;
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: adminEmail,
        options: { redirectTo: ODONTOCLOUD_RESET_URL },
      });
      if (!linkErr && linkData?.properties?.action_link) {
        setupPasswordUrl = linkData.properties.action_link;
      } else if (linkErr) {
        console.warn("generateLink error:", linkErr.message);
      }

      await dispatchWelcomeEmail(admin, {
        tenantId: tenant.id,
        clinicName,
        adminName,
        adminEmail,
        planName: plan,
        setupPasswordUrl,
        initiatedBy: callerProfile.email || "superadmin",
      });
    } catch (emailDispatchErr) {
      // Capturamos el error aquí para que jamás rompa el retorno exitoso de la creación
      console.error("register-clinic welcome email warning:", emailDispatchErr);
    }

    return json({
      success: true,
      tenantId: tenant.id,
      user: { id: createdUserId, email: adminEmail },
    }, 201);
  } catch (error) {
    // Si falló ANTES de completar la creación, se limpian recursos parciales
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
