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

export const configureSispro = async (tenantId, config) => {
  const data = await invokeTenantSecrets("configure_sispro", { tenantId, config });
  return data.configured === true;
};

export default {
  getSisproConfig,
  configureSispro,
};
