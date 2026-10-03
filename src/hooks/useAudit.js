import supabase from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const isUuid = (val) => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export function useAudit() {
    const { user, userProfile } = useAuth();

    const logAction = async (patientId, actionType, details, userId, userName) => {
        try {
            const rawUserId = userId || userProfile?.id || userProfile?.uid || user?.id || user?.uid;
            const finalUserId = isUuid(rawUserId) ? rawUserId : null;
            const finalUserName = userName || userProfile?.nombre || userProfile?.nombreCompleto || user?.email || "Sistema";
            const rawTenant = userProfile?.tenant_id || userProfile?.inquilino || userProfile?.tenantId;
            const tenantId = isUuid(rawTenant) ? rawTenant : null;
            if (!tenantId) return;

            const safePatientId = isUuid(patientId) ? patientId : null;

            await supabase.from("audit_logs").insert([{
                patient_id: safePatientId,
                tenant_id: tenantId,
                inquilino: tenantId,
                action: String(actionType || "ACTION").slice(0, 100),
                details: {
                    ...(typeof details === "object" && details !== null ? details : { info: details }),
                    performed_by_name: finalUserName,
                    performed_by_role: userProfile?.rol || userProfile?.role || "usuario"
                },
                performed_by: finalUserId,
                device_info: {
                    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
                },
                created_at: new Date().toISOString()
            }]);
        } catch {
            // Silently swallow to avoid blocking UI actions or spamming console
        }
    };

    return { logAction };
}
