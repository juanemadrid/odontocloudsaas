import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
// supabase/functions/_shared/resendEmail.ts
// [INLINED RESEND EMAIL HELPERS]

export interface WelcomeEmailParams {
  tenantId?: string | null;
  clinicName: string;
  adminName: string;
  adminEmail: string;
  planName?: string;
  setupPasswordUrl: string;
  initiatedBy?: string; // 'system' o email del superadmin
}

export interface SendEmailResult {
  success: boolean;
  resendId?: string;
  error?: string;
  logId?: string;
}

const DEFAULT_SENDER = "OdontoCloud <bienvenido@odontocloudcolombia.com>";
const ODONTOCLOUD_APP_URL = "https://odontocloudcolombia.com";

const formatPlanLabel = (plan?: string): string => {
  const p = String(plan || "").toLowerCase();
  if (p.includes("enterprise") || p.includes("empresa")) return "Plan Corporativo / Enterprise";
  if (p.includes("pro") || p.includes("clinica")) return "Plan Profesional";
  if (p.includes("trial") || p.includes("prueba") || p.includes("free")) return "Plan de Prueba (30 Días)";
  return plan ? plan.toUpperCase() : "Plan Estándar";
};

export const generateWelcomeEmailText = ({
  clinicName,
  adminName,
  adminEmail,
  planName,
  setupPasswordUrl,
}: {
  clinicName: string;
  adminName: string;
  adminEmail: string;
  planName: string;
  setupPasswordUrl: string;
}): string => {
  const safeClinicName = clinicName || "Tu Clínica Dental";
  const safeAdminName = adminName || "Administrador";

  return `¡Hola, ${safeAdminName}! Te damos la bienvenida oficial a OdontoCloud.

Nos alegra que hayas elegido OdontoCloud para potenciar la gestión y el crecimiento de tu clínica: ${safeClinicName}.

A partir de hoy, cuentas con la solución más moderna e intuitiva para administrar tu consulta:
- Agenda médica interactiva y recordatorios.
- Historia clínica odontológica con odontograma digital.
- Facturación electrónica DIAN / Factus y reportes RIPS / SISPRO.
- Control de presupuestos, pagos y caja en tiempo real.

--------------------------------------------------
TUS DATOS DE ACCESO:
- Clínica: ${safeClinicName}
- Administrador: ${safeAdminName}
- Correo de ingreso: ${adminEmail}
- Plan activado: ${formatPlanLabel(planName)}
- Portal web: ${ODONTOCLOUD_APP_URL}
--------------------------------------------------

PASO OBLIGATORIO - CREA TU CONTRASEÑA DE ACCESO:
Ingresa al siguiente enlace protegido para crear tu clave de ingreso:
${setupPasswordUrl}

(Por tu seguridad, este enlace es de un solo uso y expirará en las próximas 24 horas).

¿NECESITAS AYUDA PARA EMPEZAR?
Nuestro equipo de soporte técnico y acompañamiento clínico está disponible para ti:
- Correo de Soporte: soporte@odontocloudcolombia.com
- Sitio Oficial: ${ODONTOCLOUD_APP_URL}

OdontoCloud Colombia — Transformación Digital Odontológica`;
};

export const generateWelcomeEmailHtml = ({
  clinicName,
  adminName,
  adminEmail,
  planName,
  setupPasswordUrl,
}: {
  clinicName: string;
  adminName: string;
  adminEmail: string;
  planName: string;
  setupPasswordUrl: string;
}): string => {
  const safeClinicName = clinicName || "Tu Clínica Dental";
  const safeAdminName = adminName || "Administrador";
  const safeEmail = adminEmail;
  const safePlan = formatPlanLabel(planName);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenido a OdontoCloud!</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0F172A;">

  <!-- Preheader oculto para vista previa -->
  <div style="display: none; font-size: 1px; color: #F8FAFC; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Tu clínica ${safeClinicName} ya está lista en OdontoCloud. Haz clic aquí para activar tu acceso y establecer tu contraseña.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F8FAFC; padding: 40px 16px;">
    <tr>
      <td align="center">
        
        <!-- Tarjeta Principal -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 35px -8px rgba(15, 23, 42, 0.1); border: 1px solid #E2E8F0;">
          
          <!-- Cabecera con Logo Oficial -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #F1F5F9;">
              <a href="${ODONTOCLOUD_APP_URL}" target="_blank" style="display: inline-block; text-decoration: none;">
                <img src="https://odontocloudcolombia.com/assets/logo.png" alt="OdontoCloud" width="190" style="display: block; margin: 0 auto; max-width: 190px; height: auto; border: 0;" />
              </a>
            </td>
          </tr>

          <!-- Banner de Bienvenida compatible con Outlook Word Engine -->
          <tr>
            <td bgcolor="#0284C7" style="background-color: #0284C7; background: linear-gradient(135deg, #0284C7 0%, #0369A1 50%, #0F172A 100%); padding: 36px 32px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 4px 14px; border-radius: 20px; margin-bottom: 12px;">
                <span style="color: #FFFFFF; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                  ✨ ¡Tu clínica ahora está en la nube!
                </span>
              </div>
              <h1 style="margin: 0; color: #FFFFFF !important; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.3;">
                ¡Bienvenido a OdontoCloud!
              </h1>
              <p style="margin: 8px 0 0 0; color: #E0F2FE !important; font-size: 15px; line-height: 1.5; font-weight: 500;">
                La plataforma odontológica integral diseñada para hacer crecer tu consultorio.
              </p>
            </td>
          </tr>

          <!-- Contenido Central -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              
              <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0F172A; font-weight: 700;">
                Hola, <span style="color: #0284C7;">${safeAdminName}</span> 👋
              </h2>

              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Es un gusto darte la bienvenida. Nos complace confirmarte que la cuenta de tu clínica <strong>${safeClinicName}</strong> ha sido creada y activada con éxito.
              </p>

              <!-- Tarjeta de Datos de la Cuenta -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 22px 24px;">
                    <div style="font-size: 12px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                      📋 Resumen de tu suscripción
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; width: 40%; font-weight: 600;">
                          Clínica:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0F172A; font-weight: 700;">
                          ${safeClinicName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; font-weight: 600;">
                          Administrador:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0F172A; font-weight: 600;">
                          ${safeAdminName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; font-weight: 600;">
                          Usuario / Email:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0284C7; font-weight: 700;">
                          ${safeEmail}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; font-weight: 600;">
                          Plan Habilitado:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0F172A; font-weight: 700;">
                          <span style="display: inline-block; background-color: #E0F2FE; color: #0369A1; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 800;">
                            ${safePlan}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; font-weight: 600;">
                          Estado:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #059669; font-weight: 700;">
                          ● Activa y Operativa
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botón Principal de Llamado a la Acción -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; font-weight: 600;">
                      Para comenzar a utilizar tu clínica, activa tu contraseña aquí:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#0284C7" style="border-radius: 12px; background-color: #0284C7; background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%); box-shadow: 0 6px 20px -2px rgba(2, 132, 199, 0.45);">
                          <a href="${setupPasswordUrl}" target="_blank" style="display: inline-block; background-color: #0284C7; padding: 16px 36px; font-size: 16px; font-weight: 800; color: #FFFFFF !important; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">
                            🚀 Activar mi Cuenta y Crear Contraseña
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #94A3B8;">
                      Este enlace es de uso único y privado para tu cuenta.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- 3 Pasos para Empezar -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 14px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 13px; font-weight: 800; color: #166534; margin-bottom: 12px;">
                      🎯 Próximos 3 pasos recomendados:
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #15803D; line-height: 1.5;">
                          <strong>1.</strong> Define tu contraseña con el botón superior.<br>
                          <strong>2.</strong> Agrega tus consultorios / sillones y el equipo de odontólogos.<br>
                          <strong>3.</strong> ¡Empieza a registrar pacientes, agendar turnos y usar el odontograma!
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Asistencia y Soporte Humano -->
              <div style="border-top: 1px solid #E2E8F0; padding-top: 24px; font-size: 14px; color: #475569; line-height: 1.6;">
                <p style="margin: 0 0 8px 0; font-weight: 700; color: #0F172A; font-size: 15px;">
                  ¿Tienes dudas o necesitas acompañamiento para tu clínica?
                </p>
                <p style="margin: 0 0 16px 0; color: #64748B; font-size: 13px;">
                  Puedes <strong>responder directamente a este correo</strong> o ingresar a nuestro portal oficial para recibir asistencia de nuestro equipo de soporte.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <a href="${ODONTOCLOUD_APP_URL}" target="_blank" style="display: inline-block; background-color: #F8FAFC; color: #0284C7; font-weight: 700; font-size: 13px; padding: 10px 20px; border-radius: 8px; text-decoration: none; border: 1px solid #BAE6FD;">
                        🌐 Ir a OdontoCloud Colombia
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748B; font-weight: 700;">
                OdontoCloud Colombia — Transformación Digital Odontológica
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8; line-height: 1.5;">
                Recibes este correo porque se activó tu cuenta en la plataforma odontológica.<br>
                OdontoCloud jamás te solicitará contraseñas confidenciales por este medio.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
};

/**
 * Envía el correo de bienvenida usando la API REST de Resend y registra la auditoría en email_logs.
 * Garantiza que NO se expongan tokens ni enlaces en la base de datos (email_logs).
 */
export const dispatchWelcomeEmail = async (
  adminClient: SupabaseClient,
  params: WelcomeEmailParams
): Promise<SendEmailResult> => {
  const {
    tenantId,
    clinicName,
    adminName,
    adminEmail,
    planName,
    setupPasswordUrl,
    initiatedBy = "system",
  } = params;

  let resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey && Deno.env.get("SMTP_PASS")?.startsWith("re_")) {
    resendApiKey = Deno.env.get("SMTP_PASS");
  }
  if (!resendApiKey) {
    try {
      const { data: globalCfg } = await adminClient
        .from("website_config")
        .select("config")
        .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
        .maybeSingle();
      resendApiKey = globalCfg?.config?.resend_api_key || globalCfg?.config?.RESEND_API_KEY;
    } catch {
      // Ignorar si website_config no está disponible
    }
  }
  if (!resendApiKey) {
    try {
      const { data: sec } = await adminClient
        .from("tenant_secrets")
        .select("resend_api_key")
        .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
        .maybeSingle();
      resendApiKey = (sec as { resend_api_key?: string } | null)?.resend_api_key;
    } catch {
      // Ignorar si tenant_secrets no tiene columna
    }
  }
  const subject = `¡Bienvenido a OdontoCloud! - Configura tu acceso a ${clinicName || "tu clínica"}`;

  // 1. Crear registro inicial en estado 'pending' (para auditoría e idempotencia)
  let logId: string | undefined;
  try {
    const { data: logRow, error: logInsertError } = await adminClient
      .from("email_logs")
      .insert({
        tenant_id: tenantId || null,
        recipient_email: adminEmail,
        recipient_name: adminName,
        subject,
        template_type: "welcome_clinic",
        status: "pending",
        initiated_by: initiatedBy,
        metadata: {
          clinic_name: clinicName,
          plan: planName || "standard",
          context: "welcome_activation",
        },
      })
      .select("id")
      .single();

    if (!logInsertError && logRow) {
      logId = logRow.id;
    }
  } catch (logErr) {
    console.warn("No se pudo insertar log preliminar en email_logs:", logErr);
  }

  // 2. Si no hay RESEND_API_KEY configurada, marcar log como failed y salir sin crash
  if (!resendApiKey) {
    const errorMsg = "RESEND_API_KEY no está configurada en los secretos de la Edge Function.";
    console.error("dispatchWelcomeEmail error:", errorMsg);

    if (logId) {
      await adminClient
        .from("email_logs")
        .update({
          status: "failed",
          error_message: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    return { success: false, error: errorMsg, logId };
  }

  // 3. Compilar HTML y Texto plano (vital para filtros antispam)
  const htmlContent = generateWelcomeEmailHtml({
    clinicName,
    adminName,
    adminEmail,
    planName: planName || "standard",
    setupPasswordUrl,
  });

  const textContent = generateWelcomeEmailText({
    clinicName,
    adminName,
    adminEmail,
    planName: planName || "standard",
    setupPasswordUrl,
  });

  // 4. Invocación a Resend REST API con timeout de 10s
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: DEFAULT_SENDER,
        reply_to: Deno.env.get("SUPPORT_REPLY_TO_EMAIL") || "madridsystem@outlook.es",
        to: [adminEmail],
        subject,
        html: htmlContent,
        text: textContent,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const resJson = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg =
        resJson?.message ||
        resJson?.error ||
        `Error HTTP ${response.status} de Resend`;
      console.error("Resend API rejected email:", errMsg);

      if (logId) {
        await adminClient
          .from("email_logs")
          .update({
            status: "failed",
            error_message: String(errMsg).slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      return { success: false, error: errMsg, logId };
    }

    // 5. Envío exitoso
    const resendId = resJson?.id;
    if (logId) {
      await adminClient
        .from("email_logs")
        .update({
          status: "sent",
          resend_id: resendId || null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return { success: true, resendId, logId };
  } catch (networkErr: unknown) {
    const errMsg =
      networkErr instanceof Error ? networkErr.message : "Error de red al conectar con Resend";
    console.error("Exception sending via Resend:", errMsg);

    if (logId) {
      await adminClient
        .from("email_logs")
        .update({
          status: "failed",
          error_message: errMsg.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return { success: false, error: errMsg, logId };
  }
};


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
