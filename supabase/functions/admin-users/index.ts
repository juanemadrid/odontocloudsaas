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

const normalizeRole = (role: unknown) =>
  String(role || "").trim().toLowerCase();

const adminRoles = new Set(["admin", "administrador", "superadmin"]);
const protectedRoles = new Set(["admin", "administrador", "superadmin"]);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    if (!token) {
      throw new HttpError(401, "Debes iniciar sesion.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      throw new HttpError(401, "La sesion no es valida o expiro.");
    }

    const callerId = authData.user.id;
    const { data: caller, error: callerError } = await admin
      .from("profiles")
      .select("id, tenant_id, role, activo")
      .eq("id", callerId)
      .single();

    if (callerError || !caller) {
      throw new HttpError(403, "Tu cuenta no tiene un perfil administrativo.");
    }
    if (caller.activo === false) {
      throw new HttpError(403, "Tu cuenta esta deshabilitada.");
    }

    const callerRole = normalizeRole(caller.role);
    const isSuperadmin = callerRole === "superadmin";
    if (!adminRoles.has(callerRole)) {
      throw new HttpError(403, "No tienes permisos para administrar usuarios.");
    }

    const body = await request.json();
    const action = String(body?.action || "");

    const getTargetProfile = async (userId: string) => {
      const { data, error } = await admin
        .from("profiles")
        .select("id, tenant_id, role, email, activo")
        .eq("id", userId)
        .single();
      if (error || !data) {
        throw new HttpError(404, "No se encontro el usuario solicitado.");
      }
      return data;
    };

    const assertTargetScope = (target: { tenant_id: string | null; role: string | null }) => {
      if (!isSuperadmin && target.tenant_id !== caller.tenant_id) {
        throw new HttpError(403, "No puedes administrar usuarios de otra clinica.");
      }
      if (!isSuperadmin && protectedRoles.has(normalizeRole(target.role))) {
        throw new HttpError(403, "Solo el superadministrador puede modificar administradores.");
      }
    };

    const findAuthUserByEmail = async (email: string) => {
      for (let page = 1; page <= 20; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) throw error;
        const found = data.users.find((candidate) =>
          candidate.email?.toLowerCase() === email.toLowerCase()
        );
        if (found) return found;
        if (data.users.length < 100) break;
      }
      return null;
    };

    if (action === "upsert_user") {
      const input = body?.user || {};
      const userId = input.id ? String(input.id) : null;
      const email = String(input.email || "").trim().toLowerCase();
      const password = input.password ? String(input.password) : "";
      const fullName = String(input.fullName || "").trim();
      const role = String(input.role || "odontologo").trim();
      const tenantId = isSuperadmin
        ? String(input.tenantId || caller.tenant_id || "")
        : String(caller.tenant_id || "");

      if (!tenantId) throw new HttpError(400, "La clinica es obligatoria.");
      if (!email || !email.includes("@")) throw new HttpError(400, "El correo no es valido.");
      if (!fullName) throw new HttpError(400, "El nombre es obligatorio.");
      if (password && password.length < 8) {
        throw new HttpError(400, "La contrasena debe tener al menos 8 caracteres.");
      }
      if (!userId && !password) {
        throw new HttpError(400, "La contrasena es obligatoria para un usuario nuevo.");
      }
      if (!isSuperadmin && normalizeRole(role) === "superadmin") {
        throw new HttpError(403, "No puedes asignar el rol superadministrador.");
      }

      let authUser;
      let created = false;

      if (userId) {
        const target = await getTargetProfile(userId);
        assertTargetScope(target);
        const attributes: Record<string, unknown> = {
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName },
          app_metadata: { role, tenant_id: tenantId },
        };
        if (password) attributes.password = password;

        const { data, error } = await admin.auth.admin.updateUserById(userId, attributes);
        if (error || !data.user) throw error || new Error("No se pudo actualizar Auth.");
        authUser = data.user;
      } else {
        const existing = await findAuthUserByEmail(email);
        if (existing) throw new HttpError(409, "El correo ya tiene una cuenta registrada.");

        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
          app_metadata: { role, tenant_id: tenantId },
        });
        if (error || !data.user) throw error || new Error("No se pudo crear el usuario.");
        authUser = data.user;
        created = true;
      }

      const profile = {
        id: authUser.id,
        tenant_id: tenantId,
        full_name: fullName,
        email,
        role,
        especialidad: input.especialidad || null,
        registro_medico: input.registroMedico || null,
        telefono: input.telefono || null,
        activo: input.activo !== false,
      };

      const { error: profileError } = await admin
        .from("profiles")
        .upsert(profile, { onConflict: "id" });

      if (profileError) {
        if (created) await admin.auth.admin.deleteUser(authUser.id);
        throw profileError;
      }

      return json({
        success: true,
        user: { id: authUser.id, email, fullName, role, tenantId },
      });
    }

    if (action === "change_password") {
      const password = String(body?.password || "");
      if (password.length < 8) {
        throw new HttpError(400, "La contrasena debe tener al menos 8 caracteres.");
      }

      let userId = body?.userId ? String(body.userId) : "";
      if (!userId && body?.email) {
        const authUser = await findAuthUserByEmail(String(body.email).trim().toLowerCase());
        userId = authUser?.id || "";
      }
      if (!userId) throw new HttpError(404, "No se encontro el usuario.");

      const target = await getTargetProfile(userId);
      assertTargetScope(target);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "set_active") {
      const userId = String(body?.userId || "");
      const active = body?.active === true;
      if (!userId) throw new HttpError(400, "El usuario es obligatorio.");
      if (userId === callerId && !active) {
        throw new HttpError(400, "No puedes deshabilitar tu propia cuenta.");
      }

      const target = await getTargetProfile(userId);
      assertTargetScope(target);
      const { error: profileError } = await admin
        .from("profiles")
        .update({ activo: active })
        .eq("id", userId);
      if (profileError) throw profileError;

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: active ? "none" : "876000h",
      });
      if (authUpdateError) throw authUpdateError;
      return json({ success: true });
    }

    if (action === "delete_user") {
      const userId = String(body?.userId || "");
      if (!userId) throw new HttpError(400, "El usuario es obligatorio.");
      if (userId === callerId) throw new HttpError(400, "No puedes eliminar tu propia cuenta.");

      const target = await getTargetProfile(userId);
      assertTargetScope(target);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ success: true });
    }

    throw new HttpError(400, "Operacion desconocida.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    console.error("admin-users:", message);
    return json({ success: false, error: message }, status);
  }
});
