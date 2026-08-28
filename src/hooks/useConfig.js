/**
 * Cache compartida de website_config por tenant.
 * Deduplica solicitudes simultaneas y evita descargar el mismo JSON en cada modulo.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
    getConfigCached,
    getConfigSectionCached,
    getConfigSectionsCached,
    invalidateConfigCache,
    loadConfig,
    setConfigCache,
    setConfigSectionCache,
    setConfigSectionsCache,
} from "../services/configCacheService";

export function useConfig() {
    const { userProfile } = useAuth();
    const tenantId = userProfile?.inquilino;
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchConfig = useCallback(async (force = false) => {
        if (!tenantId) {
            setConfig(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            setConfig(await loadConfig(tenantId, force));
        } catch (error) {
            console.warn("[useConfig] Error fetching config:", error);
            setConfig(await getConfigCached(tenantId));
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const refreshConfig = useCallback(() => {
        if (tenantId) delete configCache[tenantId];
        return fetchConfig(true);
    }, [tenantId, fetchConfig]);

    return { config, loading, refreshConfig };
}

// Reexportar mantiene compatibles los imports existentes mientras la cache
// queda disponible tambien para AuthContext sin una dependencia circular.
export {
    getConfigCached,
    getConfigSectionCached,
    getConfigSectionsCached,
    invalidateConfigCache,
    setConfigCache,
    setConfigSectionCache,
    setConfigSectionsCache,
};
