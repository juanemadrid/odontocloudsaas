import { useAuth } from "../context/AuthContext";
import { isSubscriptionExpired } from "../utils/subscriptionHelper";

/**
 * Hook to check if the current user has permission for a specific feature and action.
 * 
 * @param {string} moduleName - The name of the module (e.g., "Agenda", "Pacientes")
 * @param {string} featureName - The specific feature/row (e.g., "Exportar a excel", "Historia clínica")
 * @param {string} action - The action column (e.g., "consultar", "crear", "editar", "eliminar")
 * @returns {boolean} - True if allowed, False otherwise.
 */
export function usePermissions() {
    const { userProfile } = useAuth();

    const can = (moduleName, featureName, action = "consultar") => {
        const rawRol = (userProfile?.role || userProfile?.rol || "").trim().toLowerCase();

        // 1. Superadmin bypass (siempre tiene acceso a todo)
        if (rawRol === "superadmin" || rawRol === "super_admin") return true;

        // 2. Suscripción vencida
        if (isSubscriptionExpired(userProfile?.tenant)) return false;

        // 3. Verificación de Plan especial para "Editor Web"
        if (featureName === "Editor Web") {
            const hasPlan = userProfile?.tenant?.planId === "trial" ||
                userProfile?.tenant?.features?.includes("CMS") ||
                userProfile?.tenant?.plan?.label?.toLowerCase().includes("corporativo") ||
                userProfile?.tenant?.plan?.label?.toLowerCase().includes("premium") ||
                userProfile?.tenant?.requestedPlan?.toLowerCase().includes("corporativo") ||
                userProfile?.tenant?.requestedPlan?.toLowerCase().includes("premium");

            if (!hasPlan) return false;
        }

        const normalizeKey = (str) => {
            return (str || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
        };

        const queryFeatureKey = normalizeKey(featureName);
        const queryModuleKey = normalizeKey(moduleName);

        // 4. EVALUAR PERMISOS DEL PERFIL DEL USUARIO (Prioridad Máxima)
        if (userProfile?.permisos) {
            const perms = userProfile.permisos;

            // Compatibilidad 1: Si permisos es un Array de strings ["Agenda", "Pacientes"]
            if (Array.isArray(perms)) {
                const normArray = perms.map(normalizeKey);
                const hasMatch = normArray.includes(queryFeatureKey) || normArray.includes(queryModuleKey);
                if (hasMatch) return true;
                // Si hay un perfil asignado como Array y no coincide, se deniega
                return false;
            }

            // Compatibilidad 2: Si permisos es un Objeto { "Historia clinica": { consultar: true, ... } }
            if (typeof perms === 'object' && perms !== null) {
                // Prioridad 1: Coincidencia exacta de la función específica
                let matchKey = Object.keys(perms).find(k => normalizeKey(k) === queryFeatureKey);
                
                // Prioridad 2: Coincidencia del nombre del módulo general
                if (!matchKey) {
                    matchKey = Object.keys(perms).find(k => normalizeKey(k) === queryModuleKey);
                }

                if (matchKey) {
                    const val = perms[matchKey];
                    if (typeof val === 'boolean') return val;
                    if (typeof val === 'object' && val !== null) {
                        if (typeof val[action] !== 'undefined') return !!val[action];
                        // Si la acción específica no está definida, verificar si la función tiene alguna acción habilitada
                        return Object.values(val).some(Boolean);
                    }
                }
            }
        }

        // 5. FALLBACK: Si no hay matriz de permisos configurada explícitamente para este perfil
        const isAdmin = rawRol.includes("admin");
        if (isAdmin) return true;

        const isDoctor = rawRol.includes("doctor") || rawRol.includes("odontolog") || rawRol.includes("odontólog");
        if (isDoctor) {
            const allowed = ["Agenda", "Pacientes", "Odontograma", "Documentos clínicos", "Historia clínica", "Evoluciones", "Plan tratamiento", "Medicamentos"];
            const normAllowed = allowed.map(normalizeKey);
            if (normAllowed.includes(queryFeatureKey) || normAllowed.includes(queryModuleKey)) return true;
        }

        const isRecep = rawRol.includes("recepc") || rawRol.includes("auxiliar") || rawRol.includes("administrativ");
        if (isRecep) {
            const allowed = ["Agenda", "Pacientes", "Caja", "Convenios"];
            const normAllowed = allowed.map(normalizeKey);
            if (normAllowed.includes(queryFeatureKey) || normAllowed.includes(queryModuleKey)) return true;
        }

        return false;
    };

    return { can };
}
