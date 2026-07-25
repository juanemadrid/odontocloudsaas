import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";

export function useAudit() {
    const { user, userProfile } = useAuth();

    const logAction = async (patientId, actionType, details, userId, userName) => {
        try {
            const finalUserId = userId || userProfile?.uid || user?.uid || "unknown";
            const finalUserName = userName || userProfile?.nombre || userProfile?.nombreCompleto || user?.email || "Sistema";
            const tenantId = userProfile?.inquilino || "global";

            await addDoc(collection(db, "audit_logs"), {
                patientId: patientId || "system",
                tenantId,
                action: actionType,
                details: details || {},
                timestamp: serverTimestamp(),
                performedBy: {
                    uid: finalUserId,
                    name: finalUserName,
                    role: userProfile?.rol || "usuario"
                },
                deviceInfo: navigator.userAgent
            });
            console.log("Audit log create:", actionType);
        } catch (error) {
            console.error("Error creating audit log:", error);
            // No bloquear la app si falla el log, pero reportar
        }
    };

    return { logAction };
}
