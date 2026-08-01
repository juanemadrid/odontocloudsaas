/**
 * useConfig.js
 * Hook con caché en memoria para leer website_config UNA SOLA VEZ por sesión.
 * Reduce drásticamente el egreso de Supabase (antes: 5-10 lecturas por pantalla → ahora: 1).
 *
 * TTL: 5 minutos. Se puede forzar recarga con refreshConfig().
 */
import { useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Cache module-level (sobrevive re-renders, se limpia cuando se recarga la página)
const configCache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

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

        const cached = configCache[tenantId];
        const now = Date.now();

        // Si hay caché válida (menos de 5 min), usarla sin query
        if (!force && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
            setConfig(cached.data);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data } = await supabase
                .from('website_config')
                .select('config')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            const cfg = data?.config || {};
            configCache[tenantId] = { data: cfg, timestamp: now };
            setConfig(cfg);
        } catch (e) {
            console.warn('[useConfig] Error fetching config:', e);
            setConfig(configCache[tenantId]?.data || {});
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    // Exportar función para forzar recarga (ej. después de un upsert)
    const refreshConfig = useCallback(() => {
        if (tenantId) delete configCache[tenantId];
        fetchConfig(true);
    }, [tenantId, fetchConfig]);

    return { config, loading, refreshConfig };
}

/**
 * Versión imperativa para uso fuera de componentes React (ej. en services/).
 * Retorna la config cacheada o la carga desde Supabase.
 */
export async function getConfigCached(tenantId) {
    if (!tenantId) return {};

    const cached = configCache[tenantId];
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const { data } = await supabase
            .from('website_config')
            .select('config')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        const cfg = data?.config || {};
        configCache[tenantId] = { data: cfg, timestamp: now };
        return cfg;
    } catch (e) {
        console.warn('[getConfigCached] Error:', e);
        return cached?.data || {};
    }
}

/**
 * Invalida la caché de un tenant (llamar después de guardar website_config).
 */
export function invalidateConfigCache(tenantId) {
    if (tenantId) delete configCache[tenantId];
}
