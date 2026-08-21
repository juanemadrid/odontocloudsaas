/**
 * Cache compartida de website_config por tenant.
 * Deduplica solicitudes simultaneas y evita descargar el mismo JSON en cada modulo.
 */
import { useState, useEffect, useCallback } from "react";
import supabase from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const configCache = {};
const configRequests = {};
const CACHE_TTL_MS = 5 * 60 * 1000;

const isFresh = (entry) =>
    entry && (Date.now() - entry.timestamp) < CACHE_TTL_MS;

const loadConfig = async (tenantId, force = false) => {
    if (!tenantId) return {};

    const cached = configCache[tenantId];
    if (!force && isFresh(cached)) return cached.data;
    if (!force && configRequests[tenantId]) return configRequests[tenantId];

    const request = (async () => {
        const { data, error } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        if (error) throw error;
        const config = data?.config || {};
        configCache[tenantId] = { data: config, timestamp: Date.now() };
        return config;
    })();

    configRequests[tenantId] = request;
    try {
        return await request;
    } finally {
        if (configRequests[tenantId] === request) {
            delete configRequests[tenantId];
        }
    }
};

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
            setConfig(configCache[tenantId]?.data || {});
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

export async function getConfigCached(tenantId) {
    if (!tenantId) return {};

    try {
        return await loadConfig(tenantId);
    } catch (error) {
        console.warn("[getConfigCached] Error:", error);
        return configCache[tenantId]?.data || {};
    }
}

export function setConfigCache(tenantId, config) {
    if (!tenantId) return;
    configCache[tenantId] = {
        data: config || {},
        timestamp: Date.now(),
    };
}

export function invalidateConfigCache(tenantId) {
    if (tenantId) delete configCache[tenantId];
}
