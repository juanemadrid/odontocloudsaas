import supabaseClient from "../../../lib/supabaseClient.js";

export const FEATURE_FLAG_KEY = "ENABLE_FEV_RIPS_0948";

/**
 * Verifica si el módulo FEV-RIPS (Resolución 948 de 2026 / Documento Técnico 1 v003)
 * está habilitado para un inquilino (tenant) específico.
 * 
 * Regla de negocio crítica:
 * - Valor por defecto: FALSE para TODOS los inquilinos.
 * - No depende de una variable global única que pueda encender todas las instituciones.
 * - Requiere un registro explícito en public.tenant_feature_flags con enabled = true para el tenant_id.
 *
 * @param {string} tenantId - UUID del inquilino
 * @returns {Promise<boolean>}
 */
export async function isFevRips0948Enabled(tenantId) {
  if (!tenantId) return false;

  try {
    const client = globalThis.__supabase || supabaseClient;
    const { data, error } = await client
      .from("tenant_feature_flags")
      .select("enabled")
      .eq("tenant_id", tenantId)
      .eq("feature_key", FEATURE_FLAG_KEY)
      .maybeSingle();

    if (error) {
      console.warn("isFevRips0948Enabled: error consultando flag:", error.message);
      return false;
    }

    return Boolean(data?.enabled === true);
  } catch (err) {
    console.error("isFevRips0948Enabled exception:", err);
    return false;
  }
}

/**
 * Actualiza el estado del feature flag para un tenant específico (solo administradores autorizados).
 * 
 * @param {string} tenantId 
 * @param {boolean} enabled 
 * @param {object} config 
 * @returns {Promise<boolean>}
 */
export async function setFevRips0948Enabled(tenantId, enabled, config = {}) {
  if (!tenantId) throw new Error("tenantId es requerido.");

  const client = globalThis.__supabase || supabaseClient;
  const { data, error } = await client
    .from("tenant_feature_flags")
    .upsert({
      tenant_id: tenantId,
      feature_key: FEATURE_FLAG_KEY,
      enabled: Boolean(enabled),
      config: config || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,feature_key" })
    .select("enabled")
    .single();

  if (error) throw error;
  return Boolean(data?.enabled);
}

export default {
  FEATURE_FLAG_KEY,
  isFevRips0948Enabled,
  setFevRips0948Enabled,
};
