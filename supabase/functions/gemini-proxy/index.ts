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

const allowedModels = new Set([
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]);

Deno.serve(async (request) => {
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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
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
      throw new HttpError(403, "Tu perfil no puede utilizar el servicio de IA.");
    }

    const body = await request.json();
    const action = String(body?.action || "generate");
    const fallbackKey = Deno.env.get("GEMINI_API_KEY") || "";

    const { data: secretRow, error: secretError } = await admin
      .from("tenant_secrets")
      .select("gemini_api_key")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (secretError) throw secretError;

    if (action === "status") {
      return json({ success: true, configured: Boolean(secretRow?.gemini_api_key || fallbackKey) });
    }

    if (action === "configure") {
      const role = String(profile.role || "").trim().toLowerCase();
      if (!["admin", "administrador", "superadmin"].includes(role)) {
        throw new HttpError(403, "Solo un administrador puede configurar la clave de IA.");
      }

      const apiKey = String(body?.apiKey || "").trim();
      if (apiKey.length < 20 || apiKey.length > 200 || /\s/.test(apiKey)) {
        throw new HttpError(400, "La clave de Gemini no tiene un formato valido.");
      }

      const { error } = await admin.from("tenant_secrets").upsert({
        tenant_id: profile.tenant_id,
        gemini_api_key: apiKey,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id" });
      if (error) throw error;
      return json({ success: true, configured: true });
    }

    if (action !== "generate") {
      throw new HttpError(400, "Operacion desconocida.");
    }

    const apiKey = secretRow?.gemini_api_key || fallbackKey;
    if (!apiKey) throw new HttpError(409, "La clinica no tiene una clave de Gemini configurada.");

    const contents = body?.contents;
    const serializedContents = JSON.stringify(contents || []);
    if (!Array.isArray(contents) || serializedContents.length > 200000) {
      throw new HttpError(400, "La solicitud de IA es invalida o demasiado grande.");
    }

    const requestedModel = String(body?.model || "gemini-2.5-flash");
    const model = allowedModels.has(requestedModel) ? requestedModel : "gemini-2.5-flash";
    const requestedConfig = body?.generationConfig || {};
    const generationConfig = {
      temperature: Math.min(1, Math.max(0, Number(requestedConfig.temperature ?? 0))),
      maxOutputTokens: Math.min(8192, Math.max(128, Number(requestedConfig.maxOutputTokens || 2000))),
      ...(requestedConfig.responseMimeType === "application/json"
        ? { responseMimeType: "application/json" }
        : {}),
    };

    const googleResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) +
        ":generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({ contents, generationConfig }),
      },
    );

    const responseBody = await googleResponse.json().catch(() => ({}));
    if (!googleResponse.ok) {
      const externalMessage = responseBody?.error?.message || "El proveedor de IA rechazo la solicitud.";
      throw new HttpError(googleResponse.status, externalMessage);
    }

    return json({ success: true, result: responseBody });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    console.error("gemini-proxy:", message);
    return json({ success: false, error: message }, status);
  }
});
