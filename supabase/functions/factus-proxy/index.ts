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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const factusError = (data: any, status: number) => {
  const errs = data?.data?.errors || data?.errors || data?.data?.error || data?.error;
  if (errs && typeof errs === "object") {
    return Object.entries(errs)
      .map(([field, messages]) => {
        const msg = Array.isArray(messages) ? messages.join(", ") : String(messages);
        return `${field}: ${msg}`;
      })
      .join(" | ");
  }
  if (typeof data?.data === "string") return data.data;
  return data?.message || data?.error_description || "Error Factus HTTP " + status;
};

const baseUrlFor = (testMode: boolean) =>
  testMode ? "https://api-sandbox.factus.com.co" : "https://api.factus.com.co";

Deno.serve(async (request) => {
  let admin: ReturnType<typeof createClient> | null = null;
  let auditTenantId: string | null = null;
  let auditUserId: string | null = null;
  let auditAction = "unknown";
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ success: false, error: "Metodo no permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError(500, "La funcion no tiene configuradas sus credenciales internas.");
    }

    const authorization = request.headers.get("Authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Debes iniciar sesion.");

    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new HttpError(401, "La sesion no es valida.");

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("tenant_id, role, activo")
      .eq("id", authData.user.id)
      .single();
    if (profileError || !profile || profile.activo === false || !profile.tenant_id) {
      throw new HttpError(403, "Tu perfil no puede utilizar facturacion electronica.");
    }

    const body = await request.json();
    const action = String(body?.action || "");
    auditAction = action;
    const role = String(profile.role || "").trim().toLowerCase();
    const isSuperadmin = role === "superadmin";
    const isAdmin = ["admin", "administrador", "superadmin"].includes(role);
    const tenantId = isSuperadmin && body?.tenantId
      ? String(body.tenantId)
      : String(profile.tenant_id);
    auditTenantId = tenantId;
    auditUserId = authData.user.id;

    if (!isSuperadmin && body?.tenantId && String(body.tenantId) !== String(profile.tenant_id)) {
      throw new HttpError(403, "No puedes usar credenciales de otra clinica.");
    }

    const readConfig = async () => {
      const { data, error } = await admin
        .from("tenant_secrets")
        .select("factus_config")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data?.factus_config || {};
    };

    const normalizeConfig = (input: any, existing: any = {}) => {
      const next = { ...existing };
      const stringFields = [
        "factusClientId",
        "factusClientSecret",
        "factusUsername",
        "factusPassword",
        "factusNumberingRangeId",
      ];
      for (const field of stringFields) {
        if (input?.[field] !== undefined && String(input[field]).trim()) {
          next[field] = String(input[field]).trim();
        }
      }
      if (input?.factusTestMode !== undefined) next.factusTestMode = input.factusTestMode === true;
      if (input?.facturacionCuota !== undefined) {
        next.facturacionCuota = Math.max(0, Number(input.facturacionCuota) || 0);
      }
      if (input?.facturacionUsadas !== undefined) {
        next.facturacionUsadas = Math.max(0, Number(input.facturacionUsadas) || 0);
      }
      if (input?.facturacionPlan !== undefined) {
        next.facturacionPlan = String(input.facturacionPlan || "personalizado");
      }
      return next;
    };

    const hasCredentials = (config: any) =>
      Boolean(
        config?.factusClientId &&
        config?.factusClientSecret &&
        config?.factusUsername &&
        config?.factusPassword
      );

    const fetchToken = async (config: any) => {
      if (!hasCredentials(config)) {
        throw new HttpError(409, "La clinica no tiene credenciales Factus completas.");
      }
      const params = new URLSearchParams({
        grant_type: "password",
        client_id: config.factusClientId,
        client_secret: config.factusClientSecret,
        username: config.factusUsername,
        password: config.factusPassword,
      });
      const response = await fetch(baseUrlFor(config.factusTestMode !== false) + "/oauth/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) {
        throw new HttpError(response.status, factusError(data, response.status));
      }
      return data.access_token as string;
    };

    const factusRequest = async (
      config: any,
      path: string,
      options: RequestInit = {},
      accept = "application/json",
    ) => {
      const accessToken = await fetchToken(config);
      const response = await fetch(baseUrlFor(config.factusTestMode !== false) + path, {
        ...options,
        headers: {
          Accept: accept,
          Authorization: "Bearer " + accessToken,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      return response;
    };

    if (action === "status") {
      const config = await readConfig();
      return json({
        success: true,
        configured: hasCredentials(config),
        factusTestMode: config.factusTestMode !== false,
        factusNumberingRangeId: config.factusNumberingRangeId || null,
        facturacionCuota: Number(config.facturacionCuota || 0),
        facturacionUsadas: Number(config.facturacionUsadas || 0),
        facturacionPlan: config.facturacionPlan || "personalizado",
      });
    }

    if (action === "configure") {
      if (!isAdmin) throw new HttpError(403, "Solo un administrador puede configurar Factus.");
      const existing = await readConfig();
      const config = normalizeConfig(body?.config || {}, existing);
      if (body?.clearCredentials === true) {
        delete config.factusClientId;
        delete config.factusClientSecret;
        delete config.factusUsername;
        delete config.factusPassword;
      }
      const { error } = await admin.from("tenant_secrets").upsert({
        tenant_id: tenantId,
        factus_config: config,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id" });
      if (error) throw error;
      return json({ success: true, configured: hasCredentials(config) });
    }

    if (action === "test") {
      if (!isAdmin) throw new HttpError(403, "Solo un administrador puede probar credenciales.");
      const existing = await readConfig();
      const config = normalizeConfig(body?.config || {}, existing);
      await fetchToken(config);
      return json({ success: true, message: "Conexion establecida con exito." });
    }

    const config = await readConfig();

    if (action === "ranges") {
      const response = await factusRequest(config, "/v2/numbering-ranges");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));
      return json({ success: true, result: data });
    }

    if (action === "send_bill") {
      const payload = body?.payload;
      const serialized = JSON.stringify(payload || {});
      if (!payload || serialized.length > 500000) {
        throw new HttpError(400, "La factura es invalida o demasiado grande.");
      }

      const quota = Number(config.facturacionCuota || 0);
      const used = Number(config.facturacionUsadas || 0);
      if (quota > 0 && used >= quota) {
        throw new HttpError(402, "La clinica alcanzo su cuota de facturas.");
      }

      const response = await factusRequest(config, "/v2/bills/validate", {
        method: "POST",
        body: serialized,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));

      await admin.from("tenant_secrets").update({
        factus_config: { ...config, facturacionUsadas: used + 1 },
        updated_at: new Date().toISOString(),
      }).eq("tenant_id", tenantId);

      return json({ success: true, result: data });
    }

    if (action === "download_pdf") {
      const billNumber = String(body?.billNumber || "");
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(billNumber)) {
        throw new HttpError(400, "El numero de factura no es valido.");
      }
      const response = await factusRequest(
        config,
        "/v2/bills/" + encodeURIComponent(billNumber) + "/download-pdf",
        {},
        "application/pdf",
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new HttpError(response.status, factusError(data, response.status));
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return json({ success: true, base64: btoa(binary), mimeType: "application/pdf" });
    }

    throw new HttpError(400, "Operacion desconocida.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    if (admin && auditTenantId && auditUserId && auditAction !== "status") {
      const { error: auditError } = await admin.from("audit_logs").insert({
        tenant_id: auditTenantId,
        inquilino: auditTenantId,
        performed_by: auditUserId,
        action: "FACTUS_ERROR",
        details: { action: auditAction, status, error: message.slice(0, 500) },
      });
      if (auditError) console.error("factus audit:", auditError.message);
    }
    console.error("factus-proxy:", message);
    return json({ success: false, error: message }, status);
  }
});
