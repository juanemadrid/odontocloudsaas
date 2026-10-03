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
                .replace(/&/g, " y ")
                .replace(/[^a-z0-9]/g, " ")
                .replace(/\s+/g, " ")
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
                return hasMatch;
            }

            // Compatibilidad 2: Si permisos es un Objeto { "Historia clinica": { consultar: true, ... } }
            if (typeof perms === 'object' && perms !== null) {
                const permKeys = Object.keys(perms);

                if (permKeys.length > 0) {
                    // Prioridad 1: Coincidencia exacta de la función específica
                    let matchKey = permKeys.find(k => normalizeKey(k) === queryFeatureKey);

                    // Prioridad 2: Coincidencia aproximada/parcial de la función
                    if (!matchKey && queryFeatureKey) {
                        matchKey = permKeys.find(k => {
                            const nk = normalizeKey(k);
                            return nk.includes(queryFeatureKey) || queryFeatureKey.includes(nk);
                        });
                    }

                    // Prioridad 3: Coincidencia del nombre del módulo general
                    if (!matchKey && queryModuleKey) {
                        matchKey = permKeys.find(k => normalizeKey(k) === queryModuleKey);
                    }

                    if (matchKey) {
                        const val = perms[matchKey];
                        if (typeof val === 'boolean') return val;
                        if (typeof val === 'object' && val !== null) {
                            if (typeof val[action] !== 'undefined') return !!val[action];
                            // Si la acción específica no está definida y la acción requerida es consultar,
                            // verificar si la función tiene alguna acción habilitada
                            if (action === "consultar") {
                                return Object.values(val).some(Boolean);
                            }
                            return !!val[action];
                        }
                    }

                    // Si el perfil tiene matriz de permisos configurada y la función/módulo no fue otorgada
                    // o fue revocada, el acceso está terminantemente denegado.
                    return false;
                }
            }
        }

        // 5. FALLBACK: ÚNICAMENTE si el usuario NO tiene matriz de permisos configurada
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
