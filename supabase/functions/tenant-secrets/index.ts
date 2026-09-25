import { createClient } from "npm:@supabase/supabase-js@2";
import {
  encryptSecret,
  decryptSecret,
  decryptInstitutionalSisproSecret,
  decryptDoctorSisproSecret,
  EncryptedEnvelope,
} from "./crypto.ts";

export {
  encryptSecret,
  decryptSecret,
  decryptInstitutionalSisproSecret,
  decryptDoctorSisproSecret,
};
export type { EncryptedEnvelope };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const normalizeRole = (value: unknown) =>
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
      const hasPassword = Boolean(current.sisproPasswordEncrypted || current.sisproPassword);
      return json({
        success: true,
        config: {
          sisproUsuario: current.sisproUsuario || "",
          sisproTipoDoc: current.sisproTipoDoc || "CC",
          codigoPrestador: current.codigoPrestador || "",
          hasPassword,
          configured: Boolean(current.sisproUsuario && hasPassword),
        },
      });
    }

    if (action === "get_sispro_password") {
      // Regla estricta: nunca devolver contraseñas al frontend
      return json({
        success: false,
        error: "Por directriz de seguridad, la consulta de contraseñas en texto claro no está permitida.",
      }, 403);
    }

    if (action === "configure_sispro") {
      const input = body?.config || {};
      const rawPassword = String(input.sisproPassword || "");
      let envelope: EncryptedEnvelope | null = null;

      if (rawPassword.trim().length > 0) {
        const aad = `${tenantId}|sispro|institutional|v1`;
        envelope = await encryptSecret(rawPassword.slice(0, 256), aad);
      }

      const { error: rpcError } = await admin.rpc("set_tenant_sispro_institutional_config", {
        p_tenant_id: tenantId,
        p_usuario: String(input.sisproUsuario || "").trim().slice(0, 120),
        p_tipo_doc: String(input.sisproTipoDoc || "CC").trim().slice(0, 30),
        p_codigo_prestador: String(input.codigoPrestador || "").trim().slice(0, 120),
        p_password_encrypted: envelope,
      });

      if (rpcError) throw rpcError;

      const hasPass = Boolean(envelope || current.sisproPasswordEncrypted || current.sisproPassword);
      return json({
        success: true,
        configured: Boolean(input.sisproUsuario && hasPass),
      });
    }

    if (action === "get_doctor_sispro_status") {
      const doctorId = String(body?.doctorId || "").trim();
      if (!doctorId) throw new HttpError(400, "El doctorId es obligatorio.");

      const { data: targetProfile, error: targetError } = await admin
        .from("profiles")
        .select("id, tenant_id")
        .eq("id", doctorId)
        .maybeSingle();
      if (targetError || !targetProfile || String(targetProfile.tenant_id) !== tenantId) {
        throw new HttpError(404, "El profesional no pertenece a esta clínica.");
      }

      const doctorData = current.doctores?.[doctorId] || {};
      const configured = Boolean(doctorData.sisproPasswordEncrypted || doctorData.sisproPassword);
      return json({
        success: true,
        configured,
      });
    }

    if (action === "configure_doctor_sispro") {
      const doctorId = String(body?.doctorId || "").trim();
      if (!doctorId) throw new HttpError(400, "El doctorId es obligatorio.");

      const { data: targetProfile, error: targetError } = await admin
        .from("profiles")
        .select("id, tenant_id")
        .eq("id", doctorId)
        .maybeSingle();
      if (targetError || !targetProfile || String(targetProfile.tenant_id) !== tenantId) {
        throw new HttpError(404, "El profesional no pertenece a esta clínica.");
      }

      const rawPassword = String(body?.sisproPassword || "");
      if (!rawPassword.trim()) {
        throw new HttpError(400, "La contraseña de doctor es obligatoria para configurar.");
      }

      const aad = `${tenantId}|sispro|doctor|${doctorId}|v1`;
      const envelope = await encryptSecret(rawPassword.slice(0, 256), aad);

      const { error: rpcError } = await admin.rpc("set_tenant_doctor_sispro_secret", {
        p_tenant_id: tenantId,
        p_doctor_id: doctorId,
        p_password_encrypted: envelope,
      });

      if (rpcError) throw rpcError;

      return json({
        success: true,
        configured: true,
      });
    }

    if (action === "delete_doctor_sispro") {
      const doctorId = String(body?.doctorId || "").trim();
      if (!doctorId) throw new HttpError(400, "El doctorId es obligatorio.");

      const { data: targetProfile, error: targetError } = await admin
        .from("profiles")
        .select("id, tenant_id")
        .eq("id", doctorId)
        .maybeSingle();
      if (targetError || !targetProfile || String(targetProfile.tenant_id) !== tenantId) {
        throw new HttpError(404, "El profesional no pertenece a esta clínica.");
      }

      const { error: rpcError } = await admin.rpc("delete_tenant_doctor_sispro_secret", {
        p_tenant_id: tenantId,
        p_doctor_id: doctorId,
      });

      if (rpcError) throw rpcError;

      return json({
        success: true,
        configured: false,
      });
    }

    throw new HttpError(400, "Operacion desconocida.");
  } catch (error) {
    const status = (error && typeof error === "object" && "status" in error && typeof error.status === "number")
      ? error.status
      : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    console.error("tenant-secrets:", message);
    return json({ success: false, error: message }, status);
  }
});
