import { useAuth } from "../context/AuthContext";

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
        const rolActual = (userProfile?.rol || "").trim().toLowerCase();
        if (rolActual === "superadmin") return true;

        // 2. Subscription Check
        if (userProfile?.subscriptionStatus === "expired") return false;

        // 3. Special "Editor Web" Plan Check
        // CMS access is restricted to Premium/Corporativo plans or specific feature enablement.
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
        // If the tenant is on a trial plan and is an administrator, grant access to core features.
        if (userProfile?.tenant?.planId === "trial") {
            const softwareFeatures = [
                "Agenda", "Paciente", "Odontograma", "Documentos clínicos",
                "Historia clínica", "Gestion Facturas", "Inventario",
                "Gestion Reportes", "Gestion Configuración", "Parámetros",
                "Sucursales", "Almacenes", "Lista precios", "Usuarios", "Perfiles"
            ];

            if (rolActual === "administrador") {
                // Even in trial, we check "Editor Web" plan (handled in step 3)
                // But for everything else, admin has access in trial.
                if (featureName !== "Editor Web") return true;
            }

            // For non-admin in trial, we still check softwareFeatures
            if (softwareFeatures.includes(featureName) || moduleName === "Configuración") return true;
        }

        // 5. Check if user has a loaded profile with permissions
        if (!userProfile?.permisos) return false;

        const featurePerms = userProfile.permisos[featureName];
        if (!featurePerms) {
            // FALLBACK FOR LEGACY ROLES (if no specific profile connected)
            const rol = rolActual;

            if (rol === "administrador") return true;

            if (rol === "doctor" || rol === "odontologo") {
                const allowed = ["Agenda", "Pacientes", "Odontograma", "Documentos clínicos", "Historia clínica"];
                if (allowed.includes(featureName) && action === "consultar") return true;
                if (moduleName === "Agenda" && action === "consultar") return true;
                if (moduleName === "Pacientes" && action === "consultar") return true;
            }

            if (rol === "recepcionista" || rol === "auxiliar") {
                const allowed = ["Agenda", "Pacientes", "Gestion Facturas", "Gestion Reportes"];
                if (allowed.includes(featureName) && action === "consultar") return true;
                if (moduleName === "Configuración") return true;
                if (moduleName === "Agenda" && action === "consultar") return true;
                if (moduleName === "Pacientes" && action === "consultar") return true;
                if (moduleName === "Administración" && featureName === "Gestion Facturas") return true;
            }

            return false;
        }

        return !!featurePerms[action];
    };

    return { can };
}
