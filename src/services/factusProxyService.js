import supabase from "../lib/supabaseClient";

export const invokeFactusProxy = async (action, payload = {}) => {
  const { data, error } = await supabase.functions.invoke("factus-proxy", {
    body: { action, ...payload },
  });

  if (error) {
    let message = error.message || "No fue posible contactar el servicio Factus.";
    try {
      const details = await error.context?.json();
      message = details?.error || message;
    } catch {
      // La respuesta no siempre incluye JSON.
    }
    throw new Error(message);
  }

  if (!data?.success) {
    throw new Error(data?.error || "La operacion Factus fue rechazada.");
  }
  return data;
};

export const getFactusStatus = (tenantId) =>
  invokeFactusProxy("status", tenantId ? { tenantId } : {});

export const configureFactus = (tenantId, config) =>
  invokeFactusProxy("configure", { tenantId, config });

export const testFactusCredentials = (config) =>
  invokeFactusProxy("test", { config });

export const getFactusRanges = () =>
  invokeFactusProxy("ranges");

export const sendFactusBill = (payload) =>
  invokeFactusProxy("send_bill", { payload });

export const downloadFactusPdf = (billNumber) =>
  invokeFactusProxy("download_pdf", { billNumber });
