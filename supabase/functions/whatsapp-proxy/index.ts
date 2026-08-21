import { createClient } from "npm:@supabase/supabase-js@2";

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

const normalizePhone = (raw: unknown) => {
  let phone = String(raw || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = phone.slice(1);
  if (phone.length === 10 && !phone.startsWith("57")) phone = "57" + phone;
  if (phone.length < 10 || phone.length > 15) {
    throw new HttpError(400, "El numero de telefono no es valido.");
  }
  return phone;
};

const safeText = (value: unknown, max = 160) =>
  String(value || "").trim().slice(0, max);

const hashValue = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (request) => {
  let admin: ReturnType<typeof createClient> | null = null;
  let auditTenantId: string | null = null;
  let auditUserId: string | null = null;
  let auditAction = "unknown";
  let auditRecipientHash = "";
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Metodo no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const token = Deno.env.get("WA_TOKEN") || "";
    const phoneId = Deno.env.get("WA_PHONE_ID") || "";
    const graphVersion = Deno.env.get("WA_GRAPH_API_VERSION") || "";
    if (!supabaseUrl || !serviceRoleKey) throw new HttpError(500, "Backend no configurado.");

    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new HttpError(401, "Sesion requerida.");
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(
      authorization.slice("Bearer ".length),
    );
    if (authError || !authData.user) throw new HttpError(401, "Sesion invalida.");

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("tenant_id, activo")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError || !profile?.activo || !profile.tenant_id) {
      throw new HttpError(403, "Usuario inactivo o sin clinica.");
    }
    auditTenantId = profile.tenant_id;
    auditUserId = authData.user.id;

    const body = await request.json();
    const action = String(body?.action || "");
    auditAction = action;
    if (action === "status") {
      return json({ success: true, configured: Boolean(token && phoneId && graphVersion) });
    }
    if (!token || !phoneId || !graphVersion) {
      throw new HttpError(409, "WhatsApp Business no esta configurado en el backend.");
    }

    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("outbound_message_log")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id)
      .eq("user_id", authData.user.id)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count || 0) >= 30) {
      throw new HttpError(429, "Demasiados mensajes. Espera un minuto e intenta de nuevo.");
    }

    const to = normalizePhone(body?.to);
    auditRecipientHash = await hashValue(to);
    let messageBody: Record<string, unknown>;

    if (action === "send_confirmation" || action === "send_reminder") {
      const details = body?.details || {};
      const parameters = [
        safeText(details.name || "Paciente"),
        safeText(details.date || "-"),
        safeText(details.time || "-"),
      ];
      let templateName = Deno.env.get("WA_TEMPLATE_RECORDATORIO") || "cita_recordatorio";
      if (action === "send_confirmation") {
        parameters.push(safeText(details.doctor || "su odontologo"));
        templateName = Deno.env.get("WA_TEMPLATE_CONFIRMACION") || "cita_confirmacion";
      }
      messageBody = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: Deno.env.get("WA_TEMPLATE_LANGUAGE") || "es_CO" },
          components: [{
            type: "body",
            parameters: parameters.map((text) => ({ type: "text", text })),
          }],
        },
      };
    } else if (action === "send_text") {
      const message = safeText(body?.message, 1000);
      if (!message) throw new HttpError(400, "El mensaje no puede estar vacio.");
      messageBody = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      };
    } else {
      throw new HttpError(400, "Accion no soportada.");
    }

    const apiUrl = "https://graph.facebook.com/" + graphVersion + "/" +
      encodeURIComponent(phoneId) + "/messages";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(messageBody),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new HttpError(response.status, result?.error?.message || "WhatsApp rechazo el mensaje.");
    }

    const { error: logError } = await admin.from("outbound_message_log").insert({
      tenant_id: profile.tenant_id,
      user_id: authData.user.id,
      channel: "whatsapp",
      recipient_hash: auditRecipientHash,
    });
    if (logError) console.error("whatsapp message log:", logError.message);


    const messageId = result?.messages?.[0]?.id || null;
    const { error: auditError } = await admin.from("audit_logs").insert({
      tenant_id: auditTenantId,
      inquilino: auditTenantId,
      performed_by: auditUserId,
      action: "WHATSAPP_SENT",
      details: { action: auditAction, recipientHash: auditRecipientHash, messageId },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      device_info: { userAgent: safeText(request.headers.get("user-agent"), 240) || null },
    });
    if (auditError) console.error("whatsapp audit log:", auditError.message);
    return json({
      success: true,
      messageId,
      to,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    console.error("whatsapp-proxy:", message);
    if (admin && auditTenantId && auditUserId && auditAction !== "status") {
      const { error: auditError } = await admin.from("audit_logs").insert({
        tenant_id: auditTenantId,
        inquilino: auditTenantId,
        performed_by: auditUserId,
        action: "WHATSAPP_ERROR",
        details: {
          action: auditAction,
          recipientHash: auditRecipientHash || null,
          status,
          message: safeText(message, 500),
        },
      });
      if (auditError) console.error("whatsapp audit error log:", auditError.message);
    }
    return json({ success: false, error: message }, status);
  }
});
