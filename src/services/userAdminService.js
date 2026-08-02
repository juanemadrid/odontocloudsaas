import supabase from "../lib/supabaseClient";

const invokeAdminUsers = async (action, payload = {}) => {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...payload },
  });

  if (error) {
    let message = error.message || "No fue posible completar la operacion administrativa.";
    try {
      const details = await error.context?.json();
      message = details?.error || message;
    } catch {
      // La respuesta no siempre incluye un cuerpo JSON.
    }
    throw new Error(message);
  }

  if (!data?.success) {
    throw new Error(data?.error || "La operacion administrativa fue rechazada.");
  }

  return data;
};

export const upsertManagedUser = (user) =>
  invokeAdminUsers("upsert_user", { user });

export const changeManagedUserPassword = ({ userId, email, password }) =>
  invokeAdminUsers("change_password", { userId, email, password });

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
