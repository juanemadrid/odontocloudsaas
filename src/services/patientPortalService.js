import supabase from "../lib/supabaseClient";

const SESSION_KEY = "odc_patient_portal_token";
const SESSION_SLUG_KEY = "odc_patient_portal_slug";

const invokePortal = async (action, payload = {}) => {
  const { data, error } = await supabase.functions.invoke("patient-portal", {
    body: { action, ...payload },
  });
  if (error) {
    let message = error.message || "No fue posible contactar el portal.";
    try {
      const details = await error.context?.json();
      message = details?.error || message;
    } catch {
      // La respuesta no siempre incluye JSON.
    }
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error || "La solicitud fue rechazada.");
  return data;
};

export const loginPatientPortal = async ({
  document,
  birthDate,
  tenantId,
  clinicSlug,
}) => {
  const result = await invokePortal("login", {
    document,
    birthDate,
    tenantId,
    clinicSlug,
  });
  sessionStorage.setItem(SESSION_KEY, result.sessionToken);
  sessionStorage.setItem(SESSION_SLUG_KEY, clinicSlug || "");
  return result.data;
};

export const resumePatientPortal = async (clinicSlug) => {
  const storedSlug = sessionStorage.getItem(SESSION_SLUG_KEY) || "";
  if ((clinicSlug || "") !== storedSlug) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_SLUG_KEY);
    return null;
  }
  const sessionToken = sessionStorage.getItem(SESSION_KEY);
  if (!sessionToken) return null;
  const result = await invokePortal("get_data", { sessionToken });
  return result.data;
};

export const requestPatientAppointment = (appointment) => {
  const sessionToken = sessionStorage.getItem(SESSION_KEY);
  if (!sessionToken) throw new Error("La sesion del portal expiro.");
  return invokePortal("request_appointment", { sessionToken, ...appointment });
};

export const logoutPatientPortal = async () => {
  const sessionToken = sessionStorage.getItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_SLUG_KEY);
  if (!sessionToken) return;
  try {
    await invokePortal("logout", { sessionToken });
  } catch {
    // El cierre local prevalece si la sesión ya expiró.
  }
};
