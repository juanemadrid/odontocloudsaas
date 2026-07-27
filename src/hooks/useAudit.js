import supabase from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export function useAudit() {
    const { user, userProfile } = useAuth();

    const logAction = async (patientId, actionType, details, userId, userName) => {
        try {
            const finalUserId = userId || userProfile?.uid || user?.uid || "unknown";
            const finalUserName = userName || userProfile?.nombre || userProfile?.nombreCompleto || user?.email || "Sistema";
            const tenantId = userProfile?.inquilino || "global";

            await supabase.from("audit_logs").insert([{
                patient_id: patientId || "system",
                tenant_id: tenantId,
                inquilino: tenantId,
                action: actionType,
                details: details || {},
                created_at: new Date().toISOString(),
                performed_by: {
                    uid: finalUserId,
                    name: finalUserName,
                    role: userProfile?.rol || "usuario"
                },
                device_info: navigator.userAgent
            }]);
            console.log("Audit log create:", actionType);
        } catch (error) {
            console.error("Error creating audit log:", error);
        }
    };

    return { logAction };
}
