/**
 * Servicio de Validación y Gestión de Servicios REPS por Sede (Sucursal)
 * 
 * Regla de negocio crítica:
 * - codServicio NUNCA se deduce o infiere a partir de descripciones textuales.
 * - Cada atención o procedimiento debe vincularse explícitamente a un servicio
 *   previamente habilitado y configurado en esa sede específica (sucursal_servicios_reps).
 * - No se permite generar RIPS para un servicio que la sede no tenga habilitado.
 */

/**
 * Consulta los servicios REPS habilitados para una sede específica.
 * 
 * @param {string} tenantId 
 * @param {string} sucursalId 
 * @returns {Promise<Array<{ cod_servicio: string, nombre_servicio: string, habilitado: boolean }>>}
 */
export async function getSucursalServiciosHabilitados(tenantId, sucursalId) {
  if (!tenantId || !sucursalId) return [];

  const client = globalThis.__supabase || (await import("../../../lib/supabaseClient.js")).default;
  const { data, error } = await client
    .from("sucursal_servicios_reps")
    .select("cod_servicio, nombre_servicio, habilitado")
    .eq("tenant_id", tenantId)
    .eq("sucursal_id", sucursalId)
    .eq("habilitado", true);

  if (error) {
    console.error("Error consultando servicios REPS habilitados en sede:", error);
    return [];
  }

  return data || [];
}

/**
 * Verifica si un código de servicio REPS está efectivamente habilitado en la sede indicada.
 * 
 * @param {string} tenantId 
 * @param {string} sucursalId 
 * @param {string|number} codServicio 
 * @returns {Promise<boolean>}
 */
export async function isServiceHabilitadoEnSede(tenantId, sucursalId, codServicio) {
  if (!tenantId || !sucursalId || !codServicio) return false;

  const codStr = String(codServicio).trim();

  const client = globalThis.__supabase || (await import("../../../lib/supabaseClient.js")).default;
  const { data, error } = await client
    .from("sucursal_servicios_reps")
    .select("habilitado")
    .eq("tenant_id", tenantId)
    .eq("sucursal_id", sucursalId)
    .eq("cod_servicio", codStr)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean(data.habilitado === true);
}

/**
 * Valida un servicio REPS para una sede y genera mensaje de error si no está habilitado.
 * 
 * @param {string} tenantId 
 * @param {string} sucursalId 
 * @param {string|number} codServicio 
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export async function validateServiceAndSucursal(tenantId, sucursalId, codServicio) {
  if (!sucursalId) {
    return { valid: false, error: "La sede (sucursal) es obligatoria para reportar la atención." };
  }
  if (!codServicio) {
    return { valid: false, error: "El código de servicio REPS es obligatorio y no puede inferirse por texto." };
  }

  const codStr = String(codServicio).trim();
  const habilitado = await isServiceHabilitadoEnSede(tenantId, sucursalId, codStr);

  if (!habilitado) {
    return {
      valid: false,
      error: `El servicio REPS '${codStr}' NO se encuentra habilitado para la sede seleccionada. Debe configurarlo en la sede antes de generar RIPS.`,
    };
  }

  return { valid: true };
}

/**
 * Registra o actualiza la habilitación de un servicio REPS en una sede.
 * 
 * @param {string} tenantId 
 * @param {string} sucursalId 
 * @param {string|number} codServicio 
 * @param {string} nombreServicio 
 * @param {boolean} [habilitado=true] 
 * @returns {Promise<object>}
 */
export async function configureSucursalServicioReps(tenantId, sucursalId, codServicio, nombreServicio, habilitado = true) {
  if (!tenantId || !sucursalId || !codServicio) {
    throw new Error("tenantId, sucursalId y codServicio son obligatorios.");
  }

  const { data, error } = await supabase
    .from("sucursal_servicios_reps")
    .upsert({
      tenant_id: tenantId,
      sucursal_id: sucursalId,
      cod_servicio: String(codServicio).trim(),
      nombre_servicio: String(nombreServicio || "").trim(),
      habilitado: Boolean(habilitado),
      updated_at: new Date().toISOString(),
    }, { onConflict: "sucursal_id,cod_servicio" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export default {
  getSucursalServiciosHabilitados,
  isServiceHabilitadoEnSede,
  validateServiceAndSucursal,
  configureSucursalServicioReps,
};
