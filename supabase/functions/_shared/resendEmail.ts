// supabase/functions/_shared/resendEmail.ts
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

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
const ODONTOCLOUD_RESET_URL = "https://odontocloudcolombia.com/reset-password";
const PUBLIC_KONG_URL = "https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io";

export function sanitizeActionLink(actionLink?: string): string {
  if (!actionLink) return ODONTOCLOUD_RESET_URL;
  try {
    const raw = new URL(actionLink);
    const token = raw.searchParams.get("token") || raw.searchParams.get("token_hash");
    const type = raw.searchParams.get("type") || "recovery";
    if (token) {
      // Retorna DIRECTAMENTE el enlace a la app sin pasar por el 302 de GoTrue
      return `${ODONTOCLOUD_RESET_URL}?token_hash=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`;
    }
    return ODONTOCLOUD_RESET_URL;
  } catch (_e) {
    const match = actionLink.match(/[?&](?:token|token_hash)=([^&]+)/);
    if (match) {
      return `${ODONTOCLOUD_RESET_URL}?token_hash=${match[1]}&type=recovery`;
    }
    return ODONTOCLOUD_RESET_URL;
  }
}

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

          <!-- Banner de Bienvenida: Alto Contraste y 100% Legible en Móvil -->
          <tr>
            <td bgcolor="#0A2540" style="background-color: #0A2540; padding: 36px 24px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 12px auto;">
                <tr>
                  <td style="background-color: #1E3A8A; border: 1px solid #3B82F6; padding: 5px 14px; border-radius: 20px; text-align: center;">
                    <span style="color: #93C5FD; font-size: 11px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">
                      ✨ ¡Tu clínica ahora está en la nube!
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; color: #FFFFFF !important; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.35; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                ¡Bienvenido a OdontoCloud!
              </h1>
              <p style="margin: 10px 0 0 0; color: #F1F5F9 !important; font-size: 15px; line-height: 1.5; font-weight: 500;">
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
                        <td align="center" bgcolor="#0284C7" style="border-radius: 12px; background-color: #0284C7; box-shadow: 0 6px 20px -2px rgba(2, 132, 199, 0.45);">
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

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
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
