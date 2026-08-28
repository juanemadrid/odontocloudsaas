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

const normalizeRole = (value: unknown) =>
  String(value || "").trim().toLowerCase();

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

    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Debes iniciar sesion.");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      throw new HttpError(401, "La sesion no es valida o expiro.");
    }

    const { data: caller, error: profileError } = await admin
      .from("profiles")
      .select("tenant_id, role, activo")
      .eq("id", authData.user.id)
      .single();
    if (profileError || !caller || caller.activo !== true) {
      throw new HttpError(403, "Tu perfil no esta autorizado.");
    }

    const role = normalizeRole(caller.role);
    const isSuperadmin = role === "superadmin";
    if (!isSuperadmin && !["admin", "administrador"].includes(role)) {
      throw new HttpError(403, "Solo un administrador puede gestionar credenciales.");
    }

    const body = await request.json();
    const action = String(body?.action || "");
    const requestedTenant = String(body?.tenantId || caller.tenant_id || "");
    const tenantId = isSuperadmin ? requestedTenant : String(caller.tenant_id || "");
    if (!tenantId) throw new HttpError(400, "La clinica es obligatoria.");
    if (!isSuperadmin && tenantId !== String(caller.tenant_id)) {
      throw new HttpError(403, "No puedes gestionar credenciales de otra clinica.");
    }

    const { data: row, error: readError } = await admin
      .from("tenant_secrets")
      .select("sispro_config")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (readError) throw readError;
    const current = row?.sispro_config || {};

    if (action === "get_sispro_config") {
      return json({
        success: true,
        config: {
          sisproUsuario: current.sisproUsuario || "",
          sisproTipoDoc: current.sisproTipoDoc || "CC",
          codigoPrestador: current.codigoPrestador || "",
          hasPassword: Boolean(current.sisproPassword),
        },
      });
    }

    if (action === "get_sispro_password") {
      return json({
        success: true,
        password: String(current.sisproPassword || ""),
      });
    }

    if (action === "configure_sispro") {
      const input = body?.config || {};
      const password = String(input.sisproPassword || "");
      const nextConfig = {
        sisproUsuario: String(input.sisproUsuario || "").trim().slice(0, 120),
        sisproTipoDoc: String(input.sisproTipoDoc || "CC").trim().slice(0, 30),
        codigoPrestador: String(input.codigoPrestador || "").trim().slice(0, 120),
        sisproPassword: password
          ? password.slice(0, 256)
          : String(current.sisproPassword || ""),
      };

      const { error: saveError } = await admin
        .from("tenant_secrets")
        .upsert({
          tenant_id: tenantId,
          sispro_config: nextConfig,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" });
      if (saveError) throw saveError;

      return json({
        success: true,
        configured: Boolean(nextConfig.sisproUsuario && nextConfig.sisproPassword),
      });
    }

    throw new HttpError(400, "Operacion desconocida.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    console.error("tenant-secrets:", message);
    return json({ success: false, error: message }, status);
  }
});
