/**
 * Helper to check if a tenant's subscription has expired.
 * Checks both status and expiration date.
 */
export const isSubscriptionExpired = (tenant) => {
    if (!tenant) return false;
    
    // Check status directly
    if (tenant.subscriptionStatus === "expired") return true;

    // Check expiration date
    if (tenant.subscriptionEndDate) {
        let endDate;
        const ts = tenant.subscriptionEndDate;
        if (ts.toDate) {
            endDate = ts.toDate();
        } else if (ts.seconds) {
            endDate = new Date(ts.seconds * 1000);
        } else {
            endDate = new Date(ts);
        }
        return endDate < new Date();
    }
    return false;
};

/**
 * Helper to check if a tenant has been manually suspended.
 */
export const isTenantSuspended = (tenant) => {
    if (!tenant) return false;
    return tenant.status === "suspended";
};

/**
 * Helper to check if a tenant's access should be blocked entirely.
 * Either because of manual suspension or subscription expiration.
 */
export const isAccessBlocked = (tenant) => {
    return isTenantSuspended(tenant) || isSubscriptionExpired(tenant);
};

/**
 * Helper to check if a tenant / user profile has access to Facturación Electrónica DIAN.
 *
 * Rules:
 * - Superadmin always has access.
 * - Trial, Demo, Free, and Consultorio have 0 electronic invoices by default (NO access),
 *   unless explicitly granted includeFacturacion: true and quota > 0.
 * - If includeFacturacion === false, returns false immediately.
 * - If includeFacturacion === true or facturacionCuota > 0, returns true.
 * - Plan Clinica and Enterprise return true.
 */
export const hasElectronicInvoicingAccess = (userProfileOrTenant) => {
    if (!userProfileOrTenant) return false;

    // Check if userProfile is passed or tenant directly
    const role = (userProfileOrTenant.role || userProfileOrTenant.rol || "").toString().toLowerCase();
    const email = (userProfileOrTenant.email || "").toString().toLowerCase();
    if (email === "madridsystem@outlook.es" || role === "superadmin") {
        return true;
    }

    const tenant = userProfileOrTenant.tenant || userProfileOrTenant;
    const plan = tenant.plan || {};
    const planId = (tenant.planId || plan.id || tenant.plan || "").toString().toLowerCase().trim();

    // 1. Explicit exclusion of trial/demo/free
    if (planId === "trial" || planId === "demo" || planId === "free") {
        const cuota = Number(tenant.facturacionCuota ?? tenant.parametros?.facturacionCuota ?? 0);
        return Boolean(tenant.includeFacturacion && cuota > 0);
    }

    // 2. Direct boolean check if defined on plan or tenant
    if (typeof tenant.includeFacturacion === "boolean" && !tenant.includeFacturacion) {
        return false;
    }
    if (typeof plan.includeFacturacion === "boolean" && !plan.includeFacturacion) {
        return false;
    }

    // 3. Check cuota / quota
    const cuota = Number(tenant.facturacionCuota ?? tenant.parametros?.facturacionCuota ?? plan.facturasIncluidas ?? 0);
    if (tenant.includeFacturacion === true || plan.includeFacturacion === true) {
        return true;
    }
    if (cuota > 0) {
        return true;
    }

    // 4. Fallback on plan ID names
    if (planId.includes("clinica") || planId.includes("pro") || planId.includes("enterprise") || planId.includes("corporativo")) {
        return true;
    }

    return false;
};

