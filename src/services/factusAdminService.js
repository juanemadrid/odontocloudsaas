// src/services/factusAdminService.js
import supabase from "../lib/supabaseClient";
import { GLOBAL_CONFIG_TENANT_ID, getTenants } from "./adminService";

/**
 * Guardar credenciales de Factus API y paquete de cuota para una clínica específica
 */
export const saveClinicFactusConfig = async (tenantId, configData) => {
  try {
    const { data: existingRow } = await supabase
      .from("website_config")
      .select("config")
      .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
      .maybeSingle();

    const registeredTenants = existingRow?.config?.registered_tenants || [];
    const updatedTenants = registeredTenants.map(t => {
      if (t.id === tenantId) {
        return {
          ...t,
          facturacionCuota: Number(configData.facturacionCuota) || 0,
          facturacionPlan: configData.facturacionPlan || "personalizado",
          factusClientId: (configData.factusClientId || "").trim(),
          factusClientSecret: (configData.factusClientSecret || "").trim(),
          factusUsername: (configData.factusUsername || "").trim(),
          factusPassword: (configData.factusPassword || "").trim(),
          factusNumberingRangeId: (configData.factusNumberingRangeId || "").trim(),
          factusTestMode: configData.factusTestMode ?? true,
          hasFactusCreds: Boolean(configData.factusClientId && configData.factusClientSecret)
        };
      }
      return t;
    });

    const updatedConfig = {
      ...(existingRow?.config || {}),
      registered_tenants: updatedTenants,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from("website_config")
      .upsert({
        tenant_id: GLOBAL_CONFIG_TENANT_ID,
        config: updatedConfig,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error al guardar credenciales de Factus en Supabase:", e);
    throw e;
  }
};

/**
 * Obtener credenciales centralizadas globales de Factus
 */
export const getFactusAdminCredentials = async () => {
  try {
    const { data: row } = await supabase
      .from("website_config")
      .select("config")
      .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
      .maybeSingle();

    const d = row?.config?.facturacion || {};
    if (!d.factusClientId || !d.factusClientSecret) return null;
    return {
      factusClientId: d.factusClientId,
      factusClientSecret: d.factusClientSecret,
      factusUsername: d.factusUsername,
      factusPassword: d.factusPassword,
      factusTestMode: d.factusTestMode ?? true,
      factusNumberingRangeId: d.factusNumberingRangeId || null,
    };
  } catch (e) {
    console.error("Error al obtener credenciales de Factus desde Supabase:", e);
    return null;
  }
};

/**
 * Guardar credenciales centralizadas globales de Factus
 */
export const saveFactusAdminCredentials = async (data) => {
  try {
    const { data: existing } = await supabase
      .from("website_config")
      .select("config")
      .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
      .maybeSingle();

    const updatedConfig = {
      ...(existing?.config || {}),
      facturacion: {
        ...(existing?.config?.facturacion || {}),
        ...data,
        updatedAt: new Date().toISOString()
      }
    };

    const { error } = await supabase
      .from("website_config")
      .upsert({
        tenant_id: GLOBAL_CONFIG_TENANT_ID,
        config: updatedConfig,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (e) {
    console.error("Error al guardar credenciales de Factus en Supabase:", e);
    throw e;
  }
};

/**
 * Obtener estadísticas globales de facturación
 */
export const getFactusAdminStats = async () => {
  try {
    const tenants = await getTenants();

    const totalAsignado = tenants.reduce((acc, t) => acc + (t.facturacionCuota || 0), 0);
    const totalUsado = tenants.reduce((acc, t) => acc + (t.facturacionUsadas || 0), 0);

    return {
      totalComprado: totalAsignado,
      totalAsignado,
      totalUsado,
      disponiblesPool: Math.max(0, totalAsignado - totalUsado),
      tenants: tenants.map(t => ({
        id: t.id,
        nombre: t.name || t.nombre,
        cuota: t.facturacionCuota || 0,
        usadas: t.facturacionUsadas || 0,
        disponibles: Math.max(0, (t.facturacionCuota || 0) - (t.facturacionUsadas || 0)),
        plan: t.planId || "free",
        hasFactusCreds: t.hasFactusCreds
      }))
    };
  } catch (e) {
    console.error("Error al obtener estadísticas de facturación:", e);
    return {
      totalComprado: 0,
      totalAsignado: 0,
      totalUsado: 0,
      disponiblesPool: 0,
      tenants: []
    };
  }
};

export const getFactusCredentialsForTenant = async (tenantId) => {
  try {
    const tenants = await getTenants();
    if (Array.isArray(tenants) && tenants.length > 0) {
      if (tenantId) {
        const found = tenants.find(t => t.id === tenantId);
        if (found && found.factusClientId && found.factusClientSecret) {
          return {
            factusClientId:         found.factusClientId,
            factusClientSecret:     found.factusClientSecret,
            factusUsername:         found.factusUsername,
            factusPassword:         found.factusPassword,
            factusTestMode:         found.factusTestMode !== undefined ? found.factusTestMode : true,
            factusNumberingRangeId: found.factusNumberingRangeId || null,
          };
        }
      }

      // Si no se encuentra el ID exacto o la clínica no tiene credenciales únicas, usar las credenciales registradas activas
      const anyWithCreds = tenants.find(t => t.factusClientId && t.factusClientSecret);
      if (anyWithCreds) {
        return {
          factusClientId:         anyWithCreds.factusClientId,
          factusClientSecret:     anyWithCreds.factusClientSecret,
          factusUsername:         anyWithCreds.factusUsername,
          factusPassword:         anyWithCreds.factusPassword,
          factusTestMode:         anyWithCreds.factusTestMode !== undefined ? anyWithCreds.factusTestMode : true,
          factusNumberingRangeId: anyWithCreds.factusNumberingRangeId || null,
        };
      }
    }

    // Fallback: website_config propio del tenant
    if (tenantId) {
      const { data: row } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const d = row?.config?.facturacion || row?.config || {};
      if (d.factusClientId && d.factusClientSecret) {
        return {
          factusClientId:         d.factusClientId,
          factusClientSecret:     d.factusClientSecret,
          factusUsername:         d.factusUsername,
          factusPassword:         d.factusPassword,
          factusTestMode:         d.factusTestMode !== undefined ? d.factusTestMode : true,
          factusNumberingRangeId: d.factusNumberingRangeId || null,
        };
      }
    }

    // Fallback: credenciales centralizadas globales
    return await getFactusAdminCredentials();
  } catch (e) {
    console.error("Error al obtener credenciales de Factus para el inquilino:", e);
    return await getFactusAdminCredentials();
  }
};

export const canTenantEmit = async (tenantId) => {
  try {
    const creds = await getFactusCredentialsForTenant(tenantId);
    if (!creds) return false;

    const tenants = await getTenants();
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant && tenant.facturacionCuota > 0) {
      const usadas = tenant.facturacionUsadas || 0;
      if (usadas >= tenant.facturacionCuota) {
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error("Error al verificar cuota del inquilino:", e);
    return true;
  }
};

export const getSucursalQuota = async (sucursalId, tenantId) => {
  try {
    const tenants = await getTenants();
    const tenant = tenants.find(t => t.id === tenantId) || tenants[0];
    if (tenant) {
      const cuota = tenant.facturacionCuota || 500;
      const usadas = tenant.facturacionUsadas || 0;
      return {
        facturacionCuota: cuota,
        facturacionUsadas: usadas,
        disponibles: Math.max(0, cuota - usadas),
        facturacionPlan: tenant.planId || "Clínica Profesional"
      };
    }
  } catch (e) {
    console.error("Error al obtener cuota de sucursal/tenant:", e);
  }
  return {
    facturacionCuota: 500,
    facturacionUsadas: 0,
    disponibles: 500,
    facturacionPlan: "Clínica Profesional"
  };
};

export const consumeOneInvoice = async (tenantId) => {
  try {
    const { data: existingRow } = await supabase
      .from("website_config")
      .select("config")
      .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
      .maybeSingle();

    const registeredTenants = existingRow?.config?.registered_tenants || [];
    const updatedTenants = registeredTenants.map(t => {
      if (t.id === tenantId) {
        return {
          ...t,
          facturacionUsadas: (t.facturacionUsadas || 0) + 1
        };
      }
      return t;
    });

    await supabase
      .from("website_config")
      .upsert({
        tenant_id: GLOBAL_CONFIG_TENANT_ID,
        config: {
          ...(existingRow?.config || {}),
          registered_tenants: updatedTenants,
          updatedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });
  } catch (e) {
    console.error("Error al descontar cuota de factura:", e);
  }
};

export const saveTenantFactusConfig = saveClinicFactusConfig;
export const assignQuotaToTenant = async (tenantId, quota) => {
  return saveClinicFactusConfig(tenantId, { facturacionCuota: quota });
};
export const consumeInvoiceQuota = consumeOneInvoice;

