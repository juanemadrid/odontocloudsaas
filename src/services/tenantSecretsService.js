import supabase from "../lib/supabaseClient";

const invokeTenantSecrets = async (action, payload = {}) => {
  const { data, error } = await supabase.functions.invoke("tenant-secrets", {
    body: { action, ...payload },
  });

  if (error) {
    let message = error.message || "No fue posible gestionar las credenciales privadas.";
    try {
      const details = await error.context?.json();
      message = details?.error || message;
    } catch {
      // La respuesta de Functions puede no incluir JSON.
    }
    throw new Error(message);
  }
  if (!data?.success) {
    throw new Error(data?.error || "La operacion de credenciales fue rechazada.");
  }
  return data;
};

export const getSisproConfig = async (tenantId) => {
  const data = await invokeTenantSecrets("get_sispro_config", { tenantId });
  return data.config || {};
};

/**
 * @deprecated Por directriz de seguridad Fase 1 (Resolución 948), las contraseñas
 * nunca se devuelven al frontend. Utilice getSisproConfig para verificar si está configurada.
 */
export const getSisproPassword = async () => {
  console.warn("Seguridad: la consulta de contraseña SISPRO está deshabilitada en el cliente.");
  return "";
};

export const configureSispro = async (tenantId, config) => {
  const data = await invokeTenantSecrets("configure_sispro", { tenantId, config });
  return data.configured === true;
};

export const getDoctorSisproStatus = async (tenantId, doctorId) => {
  if (!tenantId || !doctorId) return { configured: false };
  const data = await invokeTenantSecrets("get_doctor_sispro_status", { tenantId, doctorId });
  return { configured: Boolean(data?.configured) };
};

export const configureDoctorSispro = async (tenantId, doctorId, sisproPassword) => {
  if (!tenantId || !doctorId) throw new Error("tenantId y doctorId son requeridos.");
  const data = await invokeTenantSecrets("configure_doctor_sispro", {
    tenantId,
    doctorId,
    sisproPassword: sisproPassword || "",
  });
  return data.configured === true;
};

export const deleteDoctorSispro = async (tenantId, doctorId) => {
  if (!tenantId || !doctorId) throw new Error("tenantId y doctorId son requeridos.");
  const data = await invokeTenantSecrets("delete_doctor_sispro", { tenantId, doctorId });
  return data.success === true;
};

export default {
  getSisproConfig,
  getSisproPassword,
  configureSispro,
  getDoctorSisproStatus,
  configureDoctorSispro,
  deleteDoctorSispro,
};
