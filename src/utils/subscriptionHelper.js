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
