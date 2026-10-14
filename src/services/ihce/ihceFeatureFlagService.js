import supabaseClient from "../../lib/supabaseClient.js";

export const IHCE_FEATURE_FLAG_KEY = "ENABLE_IHCE_MINSALUD";

/**
 * Verifica si el módulo de interoperabilidad IHCE está habilitado para una clínica específica.
 * @param {string} tenantId - UUID de la clínica
 * @returns {Promise<boolean>}
 */
export async function isIhceEnabled(tenantId) {
  if (!tenantId) return false;

  try {
    const client = globalThis.__supabase || supabaseClient;
    const { data, error } = await client
      .from("tenant_feature_flags")
      .select("enabled")
      .eq("tenant_id", tenantId)
      .eq("feature_key", IHCE_FEATURE_FLAG_KEY)
      .maybeSingle();

    if (error) {
      console.warn("isIhceEnabled: error consultando flag:", error.message);
      return false;
    }

    return Boolean(data?.enabled === true);
  } catch (err) {
    console.error("isIhceEnabled exception:", err);
    return false;
  }
}

/**
 * Actualiza el feature flag de IHCE para una clínica específica (Uso exclusivo SuperAdmin).
 * @param {string} tenantId 
 * @param {boolean} enabled 
 * @returns {Promise<boolean>}
 */
export async function setIhceEnabled(tenantId, enabled) {
  if (!tenantId) throw new Error("tenantId es requerido.");

  const client = globalThis.__supabase || supabaseClient;
  const { error } = await client
    .from("tenant_feature_flags")
    .upsert({
      tenant_id: tenantId,
      feature_key: IHCE_FEATURE_FLAG_KEY,
      enabled: Boolean(enabled),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id, feature_key" });

  if (error) throw error;

  // Sincronizar también con la bandera is_active de ihce_configurations si existe
  try {
    await client
      .from("ihce_configurations")
      .update({
        is_active: Boolean(enabled),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);
  } catch (syncErr) {
    console.warn("Aviso al sincronizar con ihce_configurations:", syncErr?.message);
  }

  return true;
}
