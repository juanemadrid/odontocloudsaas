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

    const can = (moduleName, featureName, action) => {
        // 1. Superadmin bypass
        const rawRol = (userProfile?.role || userProfile?.rol || "").trim().toLowerCase();
        
        const isAdmin = rawRol.includes("admin");
        const isDoctor = rawRol.includes("doctor") || rawRol.includes("odontolog") || rawRol.includes("odontólog");
        const isRecep = rawRol.includes("recepc") || rawRol.includes("auxiliar") || rawRol.includes("administrativ");

        if (rawRol === "superadmin" || rawRol === "super_admin") return true;

        // 2. Subscription Check
        if (isSubscriptionExpired(userProfile?.tenant)) return false;

        // 3. Special "Editor Web" Plan Check
        if (featureName === "Editor Web") {
            const hasPlan = userProfile?.tenant?.planId === "trial" ||
                userProfile?.tenant?.features?.includes("CMS") ||
                userProfile?.tenant?.plan?.label?.toLowerCase().includes("corporativo") ||
                userProfile?.tenant?.plan?.label?.toLowerCase().includes("premium") ||
                userProfile?.tenant?.requestedPlan?.toLowerCase().includes("corporativo") ||
                userProfile?.tenant?.requestedPlan?.toLowerCase().includes("premium");

            if (!hasPlan) return false;
        }

        // 4. Trial Bypass Logic (Full Software Access 30 days)
        if (userProfile?.tenant?.planId === "trial") {
            const softwareFeatures = [
                "Agenda", "Paciente", "Odontograma", "Documentos clínicos",
                "Historia clínica", "Gestion Facturas", "Inventario",
                "Gestion Reportes", "Gestion Configuración", "Parámetros",
                "Sucursales", "Almacenes", "Lista precios", "Usuarios", "Perfiles"
            ];

            if (isAdmin) {
                if (featureName !== "Editor Web") return true;
            }

            if (softwareFeatures.includes(featureName) || moduleName === "Configuración") return true;
        }

        // 5. Normalization helper for key comparisons
        const normalizeKey = (str) => {
            return (str || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
        };

        const queryKey = normalizeKey(featureName);

        // 6. Find and load permissions for this feature if profile has custom permissions loaded
        const featurePerms = (() => {
            if (!userProfile?.permisos) return null;

            // Compatibilidad 1: Si permisos es un Array ["Agenda", "Pacientes"]
            if (Array.isArray(userProfile.permisos)) {
                const normArray = userProfile.permisos.map(normalizeKey);
                const hasMatch = normArray.includes(queryKey) || normArray.includes(normalizeKey(moduleName));
                return hasMatch ? { consultar: true, crear: true, editar: true, eliminar: true } : null;
            }

            // Compatibilidad 2: Si permisos es un Objeto
            const perms = userProfile.permisos;
            const keyMatch = Object.keys(perms).find(
                k => normalizeKey(k) === queryKey || normalizeKey(k) === normalizeKey(moduleName)
            );
            
            if (keyMatch) {
                const val = perms[keyMatch];
                if (typeof val === 'boolean') return val ? { consultar: true, crear: true, editar: true, eliminar: true } : null;
                if (typeof val === 'object' && val !== null) return val;
            }

            return null;
        })();

        if (featurePerms) {
            if (typeof featurePerms[action] !== 'undefined') return !!featurePerms[action];
            return true; // Por defecto permitido si el módulo/feature está asignado
        }

        // 7. Fallback a permisos predeterminados si no se encontraron permisos personalizados
        if (isAdmin) return true;

        if (isDoctor) {
            const allowed = ["Agenda", "Pacientes", "Odontograma", "Documentos clínicos", "Historia clínica"];
            const normAllowed = allowed.map(normalizeKey);
            if (normAllowed.includes(queryKey) && action === "consultar") return true;
            if (moduleName === "Agenda" && action === "consultar") return true;
            if (moduleName === "Pacientes" && action === "consultar") return true;
            if (featureName === "Agenda" || featureName === "Paciente") return true;
        }

        if (isRecep) {
            const allowed = ["Agenda", "Pacientes", "Gestion Facturas", "Gestion Reportes", "Caja", "Gestion Administración"];
            const normAllowed = allowed.map(normalizeKey);
            if (normAllowed.includes(queryKey) && action === "consultar") return true;
            if (moduleName === "Configuración") return true;
            if (moduleName === "Agenda" && action === "consultar") return true;
            if (moduleName === "Pacientes" && action === "consultar") return true;
            if (moduleName === "Caja" && action === "consultar") return true;
            if (moduleName === "Administración" && (queryKey === normalizeKey("Gestion Facturas") || queryKey === normalizeKey("Gestion Administración"))) return true;
        }

        return false;
    };



    return { can };
}
