import supabase from "../lib/supabaseClient";

/**
 * Cache compartida de configuracion por clinica.
 *
 * La configuracion historica vive en un unico JSONB que puede contener logos,
 * firmas y catalogos grandes. La mayoria de pantallas solo necesita una clave,
 * por lo que las lecturas por seccion evitan descargar el documento completo.
 */
const fullConfigCache = new Map();
const fullConfigRequests = new Map();
const sectionCache = new Map();
const sectionRequests = new Map();

const CACHE_TTL_MS = 5 * 60 * 1000;
const CONFIG_KEY_PATTERN = /^[a-z0-9_]{1,80}$/;

const isFresh = (entry) =>
    Boolean(entry && (Date.now() - entry.timestamp) < CACHE_TTL_MS);

const sectionId = (tenantId, configKey) => `${tenantId}:${configKey}`;

const validateConfigKey = (configKey) => {
    if (!CONFIG_KEY_PATTERN.test(configKey || "")) {
        throw new Error("La sección de configuración no es válida.");
    }
    return configKey;
};

const cacheSection = (tenantId, configKey, value, timestamp = Date.now()) => {
    sectionCache.set(sectionId(tenantId, configKey), {
        data: value,
        timestamp,
    });

    const fullEntry = fullConfigCache.get(tenantId);
    if (fullEntry) {
        fullConfigCache.set(tenantId, {
            data: {
                ...(fullEntry.data || {}),
                [configKey]: value,
            },
            timestamp,
        });
    }
};

export const loadConfig = async (tenantId, force = false) => {
    if (!tenantId) return {};

    const cached = fullConfigCache.get(tenantId);
    if (!force && isFresh(cached)) return cached.data;
    if (!force && fullConfigRequests.has(tenantId)) {
        return fullConfigRequests.get(tenantId);
    }

    const request = (async () => {
        const { data, error } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        if (error) throw error;

        const config = data?.config || {};
        const timestamp = Date.now();
        fullConfigCache.set(tenantId, { data: config, timestamp });
        Object.entries(config).forEach(([key, value]) => {
            if (CONFIG_KEY_PATTERN.test(key)) {
                sectionCache.set(sectionId(tenantId, key), { data: value, timestamp });
            }
        });
        return config;
    })();

    fullConfigRequests.set(tenantId, request);
    try {
        return await request;
    } finally {
        if (fullConfigRequests.get(tenantId) === request) {
            fullConfigRequests.delete(tenantId);
        }
    }
};

export const loadConfigSection = async (
    tenantId,
    configKey,
    fallbackValue = null,
    force = false
) => {
    if (!tenantId) return fallbackValue;
    validateConfigKey(configKey);

    const fullEntry = fullConfigCache.get(tenantId);
    if (!force && isFresh(fullEntry) && Object.hasOwn(fullEntry.data || {}, configKey)) {
        return fullEntry.data[configKey];
    }

    const id = sectionId(tenantId, configKey);
    const cached = sectionCache.get(id);
    if (!force && isFresh(cached)) return cached.data;
    if (!force && sectionRequests.has(id)) return sectionRequests.get(id);

    const request = (async () => {
        const { data, error } = await supabase
            .from("website_config")
            .select(`value:config->${configKey}`)
            .eq("tenant_id", tenantId)
            .maybeSingle();

        if (error) throw error;
        const value = data?.value ?? fallbackValue;
        cacheSection(tenantId, configKey, value);
        return value;
    })();

    sectionRequests.set(id, request);
    try {
        return await request;
    } finally {
        if (sectionRequests.get(id) === request) {
            sectionRequests.delete(id);
        }
    }
};

export const loadConfigSections = async (tenantId, configKeys, force = false) => {
    if (!tenantId) return {};
    const keys = [...new Set((configKeys || []).map(validateConfigKey))];
    if (!keys.length) return {};

    const result = {};
    const missing = [];

    for (const key of keys) {
        const fullEntry = fullConfigCache.get(tenantId);
        const cached = sectionCache.get(sectionId(tenantId, key));
        if (!force && isFresh(fullEntry) && Object.hasOwn(fullEntry.data || {}, key)) {
            result[key] = fullEntry.data[key];
        } else if (!force && isFresh(cached)) {
            result[key] = cached.data;
        } else {
            missing.push(key);
        }
    }

    if (!missing.length) return result;

    const select = missing
        .map((key, index) => `section_${index}:config->${key}`)
        .join(",");
    const { data, error } = await supabase
        .from("website_config")
        .select(select)
        .eq("tenant_id", tenantId)
        .maybeSingle();

    if (error) throw error;
    missing.forEach((key, index) => {
        const value = data?.[`section_${index}`] ?? null;
        result[key] = value;
        cacheSection(tenantId, key, value);
    });
    return result;
};

export async function getConfigCached(tenantId) {
    if (!tenantId) return {};
    try {
        return await loadConfig(tenantId);
    } catch (error) {
        console.warn("[getConfigCached] Error:", error);
        return fullConfigCache.get(tenantId)?.data || {};
    }
}

export async function getConfigSectionCached(
    tenantId,
    configKey,
    fallbackValue = null,
    force = false
) {
    try {
        return await loadConfigSection(tenantId, configKey, fallbackValue, force);
    } catch (error) {
        console.warn(`[getConfigSectionCached:${configKey}] Error:`, error);
        return sectionCache.get(sectionId(tenantId, configKey))?.data ?? fallbackValue;
    }
}

export async function getConfigSectionsCached(tenantId, configKeys, force = false) {
    try {
        return await loadConfigSections(tenantId, configKeys, force);
    } catch (error) {
        console.warn("[getConfigSectionsCached] Error:", error);
        return Object.fromEntries(
            (configKeys || []).map((key) => [
                key,
                sectionCache.get(sectionId(tenantId, key))?.data ?? null,
            ])
        );
    }
}

export function setConfigCache(tenantId, config) {
    if (!tenantId) return;
    const timestamp = Date.now();
    const normalized = config || {};
    fullConfigCache.set(tenantId, { data: normalized, timestamp });
    Object.entries(normalized).forEach(([key, value]) => {
        if (CONFIG_KEY_PATTERN.test(key)) {
            sectionCache.set(sectionId(tenantId, key), { data: value, timestamp });
        }
    });
}

export function setConfigSectionCache(tenantId, configKey, value) {
    if (!tenantId) return;
    validateConfigKey(configKey);
    cacheSection(tenantId, configKey, value);
}

export function setConfigSectionsCache(tenantId, patch) {
    if (!tenantId || !patch || typeof patch !== "object" || Array.isArray(patch)) return;
    Object.entries(patch).forEach(([key, value]) => {
        if (CONFIG_KEY_PATTERN.test(key)) cacheSection(tenantId, key, value);
    });
}

export function invalidateConfigCache(tenantId, configKey = null) {
    if (!tenantId) return;
    if (configKey) {
        validateConfigKey(configKey);
        sectionCache.delete(sectionId(tenantId, configKey));
        fullConfigCache.delete(tenantId);
        return;
    }

    fullConfigCache.delete(tenantId);
    for (const key of sectionCache.keys()) {
        if (key.startsWith(`${tenantId}:`)) sectionCache.delete(key);
    }
}
