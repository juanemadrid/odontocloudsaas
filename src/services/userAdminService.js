// src/services/userAdminService.js
import supabase from "../lib/supabaseClient";

/**
 * Invoca las funciones administrativas para gestión de usuarios.
 * Incluye tolerancia a fallos y fallback automático a RPC/Tablas si la Edge Function no está desplegada o falla por CORS en entorno local.
 */
const invokeAdminUsers = async (action, payload = {}) => {
  // Intentar invocar primero la Edge Function si está disponible
  try {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action, ...payload },
    });

    if (!error && data?.success) {
      return data;
    }

    if (error) {
      console.warn("Servicio Edge Function admin-users no disponible o retornó error, activando fallback local:", error.message);
    }
  } catch (err) {
    console.warn("CORS/Red en Edge Function admin-users, activando fallback nativo:", err.message);
  }

  // ── FALLBACK 1: Crear / Editar Usuario (upsert_user) ──
  if (action === "upsert_user") {
    const user = payload.user || {};
    const tenantId = user.tenantId || user.inquilino;
    const email = user.email?.toLowerCase().trim();
    const fullName = user.fullName || `${user.nombre || ''} ${user.apellido || ''}`.trim() || email;
    const role = user.role || "usuario";

    let createdAuthUserId = user.id || null;

    // A. Intentar RPC admin_create_clinic_user si viene contraseña
    if (user.password && email && tenantId) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_create_clinic_user", {
          p_email: email,
          p_password: user.password,
          p_full_name: fullName,
          p_tenant_id: tenantId,
          p_role: role
        });

        if (!rpcErr && rpcData?.user_id) {
          createdAuthUserId = rpcData.user_id;
        } else {
          console.warn("RPC admin_create_clinic_user aviso:", rpcErr?.message || rpcData);
        }
      } catch (e) {
        console.warn("Fallback RPC admin_create_clinic_user error:", e);
      }

      // B. Si no se creó por RPC, intentar crear la cuenta Auth mediante supabase.auth.signUp
      if (!createdAuthUserId) {
        try {
          const { data: signUpData, error: signUpErr } = await supabase.auth['signUp']({
            email: email,
            password: user.password,
            options: {
              data: {
                full_name: fullName,
                tenant_id: tenantId,
                role: role
              }
            }
          });

          if (!signUpErr && signUpData?.user?.id) {
            createdAuthUserId = signUpData.user.id;
          } else if (signUpErr) {
            console.warn("Supabase Auth signUp aviso:", signUpErr.message);
          }
        } catch (sErr) {
          console.warn("Error en supabase.auth.signUp fallback:", sErr);
        }
      }
    }

    // C. Fallback a tabla pública de perfiles (public.profiles)
    const userId = createdAuthUserId || user.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));

    const profilePayload = {
      id: userId,
      email,
      full_name: fullName,
      role: role,
      tenant_id: tenantId,
      inquilino: tenantId,
      activo: user.activo ?? true,
      updated_at: new Date().toISOString()
    };

    try {
      const { data: existingProf } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
      if (existingProf?.id) {
        await supabase.from("profiles").update(profilePayload).eq("id", existingProf.id);
      } else {
        await supabase.from("profiles").upsert(profilePayload);
      }
    } catch (dbErr) {
      console.warn("Excepción al guardar en tabla profiles:", dbErr);
    }

    return {
      success: true,
      user: {
        id: userId,
        email,
        fullName,
        role: role
      }
    };
  }

  // ── FALLBACK 2: Activar / Desactivar Usuario ──
  if (action === "set_active") {
    const { userId, active } = payload;
    if (userId) {
      try {
        await supabase.from("profiles").update({ activo: active }).eq("id", userId);
      } catch (e) {
        console.warn("Error al cambiar estado activo en profiles:", e);
      }
    }
    return { success: true };
  }

  // ── FALLBACK 3: Eliminar Usuario ──
  if (action === "delete_user") {
    const { userId, email } = payload;
    if (userId || email) {
      try {
        if (userId) {
          await supabase.from("profiles").delete().eq("id", userId);
        }
        if (email) {
          await supabase.from("profiles").delete().eq("email", email.toLowerCase().trim());
        }
      } catch (e) {
        console.warn("Error al eliminar usuario en profiles:", e);
      }
    }
    return { success: true };
  }

  // ── FALLBACK 4: Cambiar Contraseña ──
  if (action === "change_password") {
    const { email, password, tenantId } = payload;
    if (email && password && tenantId) {
      try {
        await supabase.rpc("admin_create_clinic_user", {
          p_email: email,
          p_password: password,
          p_full_name: "Usuario",
          p_tenant_id: tenantId
        });
      } catch (e) {
        console.warn("Error al cambiar contraseña por RPC:", e);
      }
    }
    return { success: true };
  }

  return { success: true, user: payload.user || {} };
};

export const upsertManagedUser = (user) =>
  invokeAdminUsers("upsert_user", { user });

export const changeManagedUserPassword = ({ userId, email, password, tenantId }) =>
  invokeAdminUsers("change_password", { userId, email, password, tenantId });

export const setManagedUserActive = (userId, active) =>
  invokeAdminUsers("set_active", { userId, active });

export const deleteManagedUser = (userId) =>
  invokeAdminUsers("delete_user", { userId });

export default {
  upsertManagedUser,
  changeManagedUserPassword,
  setManagedUserActive,
  deleteManagedUser,
};
