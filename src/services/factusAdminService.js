import { getTenants } from "./adminService";
import {
  configureFactus,
  getFactusStatus
} from "./factusProxyService";

const toCompatibilityCredentials = (status) => {
  if (!status?.configured) return null;
  return {
    factusClientId: "server-managed",
    factusClientSecret: "server-managed",
    factusUsername: "server-managed",
    factusPassword: "server-managed",
    factusTestMode: status.factusTestMode !== false,
    factusNumberingRangeId: status.factusNumberingRangeId || null,
    facturacionCuota: Number(status.facturacionCuota || 0),
    facturacionUsadas: Number(status.facturacionUsadas || 0),
    facturacionPlan: status.facturacionPlan || "personalizado",
    serverManaged: true
  };
};

export const saveClinicFactusConfig = async (tenantId, configData) => {
  await configureFactus(tenantId, configData);
  return true;
};

export const getFactusAdminCredentials = async () => {
  try {
    return toCompatibilityCredentials(await getFactusStatus());
  } catch (error) {
    console.error("Error al consultar el estado global de Factus:", error);
    return null;
  }
};

export const saveFactusAdminCredentials = async (data) => {
  await configureFactus(null, data);
  return true;
};

export const getFactusAdminStats = async () => {
  try {
    const tenants = await getTenants();
    const rows = await Promise.all(tenants.map(async tenant => {
      try {
        const status = await getFactusStatus(tenant.id);
        const cuota = Number(status.facturacionCuota || 0);
        const usadas = Number(status.facturacionUsadas || 0);
        return {
          id: tenant.id,
          nombre: tenant.name || tenant.nombre,
          cuota,
          usadas,
          disponibles: Math.max(0, cuota - usadas),
          plan: tenant.planId || "free",
          hasFactusCreds: status.configured === true
        };
      } catch {
        return {
          id: tenant.id,
          nombre: tenant.name || tenant.nombre,
          cuota: 0,
          usadas: 0,
          disponibles: 0,
          plan: tenant.planId || "free",
          hasFactusCreds: false
        };
      }
    }));

    const totalAsignado = rows.reduce((sum, row) => sum + row.cuota, 0);
    const totalUsado = rows.reduce((sum, row) => sum + row.usadas, 0);
    return {
      totalComprado: totalAsignado,
      totalAsignado,
      totalUsado,
      disponiblesPool: Math.max(0, totalAsignado - totalUsado),
      tenants: rows
    };
  } catch (error) {
    console.error("Error al obtener estadísticas de facturación:", error);
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
    return toCompatibilityCredentials(await getFactusStatus(tenantId));
  } catch (error) {
    // Factus Edge Function puede no estar desplegada — no es un error crítico
    return null;
  }
};

export const canTenantEmit = async (tenantId) => {
  try {
    const status = await getFactusStatus(tenantId);
    if (!status.configured) return false;
    const cuota = Number(status.facturacionCuota || 0);
    const usadas = Number(status.facturacionUsadas || 0);
    return cuota <= 0 || usadas < cuota;
  } catch (error) {
    console.error("Error al verificar cuota del inquilino:", error);
    return false;
  }
};

export const getSucursalQuota = async (_sucursalId, tenantId) => {
  try {
    const status = await getFactusStatus(tenantId);
    const cuota = Number(status.facturacionCuota || 0);
    const usadas = Number(status.facturacionUsadas || 0);
    return {
      facturacionCuota: cuota,
      facturacionUsadas: usadas,
      disponibles: Math.max(0, cuota - usadas),
      facturacionPlan: status.facturacionPlan || "personalizado",
      configured: status.configured === true,
      factusTestMode: status.factusTestMode !== false,
      factusNumberingRangeId: status.factusNumberingRangeId || null
    };
  } catch (error) {
    console.error("Error al obtener cuota de Factus:", error);
    return {
      facturacionCuota: 0,
      facturacionUsadas: 0,
      disponibles: 0,
      facturacionPlan: "Sin configurar",
      configured: false,
      factusTestMode: true,
      factusNumberingRangeId: null
    };
  }
};

// El proxy descuenta la cuota de forma central después de una emisión exitosa.
export const consumeOneInvoice = async () => true;

export const saveTenantFactusConfig = saveClinicFactusConfig;
export const assignQuotaToTenant = async (tenantId, quota) =>
  saveClinicFactusConfig(tenantId, { facturacionCuota: quota });
export const consumeInvoiceQuota = consumeOneInvoice;
