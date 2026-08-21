import supabase from "../lib/supabaseClient";

const extractFunctionError = async (error) => {
  let message = error?.message || "No fue posible completar la operacion de usuarios.";
  try {
    const details = await error?.context?.json();
    message = details?.error || message;
  } catch {
    // Algunas respuestas de Functions no incluyen un cuerpo JSON.
  }
  return message;
};

/**
 * Toda operacion que afecta Supabase Auth pasa por la Edge Function autenticada.
 * No existe fallback en el navegador: fallar de forma segura evita crear perfiles
 * huerfanos o permitir cambios de rol/contrasena sin autorizacion del servidor.
 */
const invokeAdminUsers = async (action, payload = {}) => {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...payload },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  if (!data?.success) {
    throw new Error(data?.error || "La operacion de usuarios fue rechazada.");
  }
  return data;
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
