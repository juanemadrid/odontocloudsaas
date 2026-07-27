// src/services/configPersistenceService.js
import supabase from "../lib/supabaseClient";

/**
 * Servicio unificado de persistencia para todos los submódulos de Configuración en Supabase.
 * Soporta tablas dedicadas en PostgreSQL y sincronización con el JSON website_config.
 */

// ── 1. Obtener lista de ítems de configuración ──
export const getConfigItems = async (tenantId, configKey, tableName) => {
    if (!tenantId) return [];

    try {
        let tableData = [];

        // A. Intentar consultar la tabla dedicada en Supabase PostgreSQL
        if (tableName) {
            const { data, error, status } = await supabase
                .from(tableName)
                .select("*")
                .eq("tenant_id", tenantId);

            if (!error && status === 200 && Array.isArray(data) && data.length > 0) {
                tableData = data.map(d => ({
                    id: d.id,
                    nombre: d.nombre || d.name || "",
                    ...d
                }));
            }
        }

        // B. Siempre consultar website_config (aquí se sincronizan TODOS los campos, incluidos permisos)
        const { data: cfgRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        const wcData = Array.isArray(cfgRow?.config?.[configKey]) ? cfgRow.config[configKey] : [];

        // C. Si hay datos en la tabla dedicada, fusionar con website_config para recuperar campos extra
        if (tableData.length > 0) {
            return tableData.map(item => {
                const wcItem = wcData.find(w => w.id === item.id);
                if (!wcItem) return item;
                // wcItem tiene todos los campos guardados (incl. permisos).
                // Los campos de la tabla dedicada tienen prioridad, pero si permisos no está en la tabla, viene de wcItem.
                return {
                    ...wcItem,   // base: todo lo de website_config
                    ...item,     // override: campos de la tabla dedicada
                    permisos: item.permisos ?? wcItem.permisos  // permisos: tabla primero, fallback a wcItem
                };
            });
        }

        // D. Fallback: si no hay tabla dedicada o está vacía, usar website_config
        if (wcData.length > 0) return wcData;

        return [];
    } catch (err) {
        console.error(`Error al obtener ${configKey} desde Supabase:`, err);
        return [];
    }
};


// ── 2. Guardar / Editar ítem de configuración ──
export const saveConfigItem = async (tenantId, configKey, tableName, itemData) => {
    if (!tenantId) throw new Error("Falta el identificador de la clínica.");

    const id = itemData.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
    const now = new Date().toISOString();

    const payload = {
        ...itemData,
        id,
        tenant_id: tenantId,
        actualizado: now
    };

    let savedInTable = false;

    // A. Guardar en la tabla dedicada si existe
    if (tableName) {
        try {
            if (itemData.id) {
                const { error, status } = await supabase
                    .from(tableName)
                    .update(payload)
                    .eq("id", itemData.id);
                if (!error && status < 300) savedInTable = true;
            } else {
                const { error, status } = await supabase
                    .from(tableName)
                    .insert([{ ...payload, created_at: now }]);
                if (!error && status < 300) savedInTable = true;
            }
        } catch (e) {
            console.warn(`No se pudo guardar en tabla ${tableName}, guardando en website_config JSON:`, e.message);
        }
    }

    // B. Siempre sincronizar en website_config JSON
    try {
        const { data: cfgRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        const currentConfig = cfgRow?.config || {};
        const currentList = Array.isArray(currentConfig[configKey]) ? currentConfig[configKey] : [];

        let updatedList;
        const exists = currentList.some(i => i.id === id);
        if (exists) {
            updatedList = currentList.map(i => i.id === id ? { ...i, ...payload } : i);
        } else {
            updatedList = [...currentList, payload];
        }

        const newConfig = {
            ...currentConfig,
            [configKey]: updatedList,
            updatedAt: now
        };

        const { error: upsertErr } = await supabase
            .from("website_config")
            .upsert({ tenant_id: tenantId, config: newConfig }, { onConflict: "tenant_id" });

        if (upsertErr) throw upsertErr;
    } catch (err) {
        console.error(`Error al guardar ${configKey} en website_config:`, err);
        if (!savedInTable) throw err;
    }

    return payload;
};

// ── 3. ELIMINAR ítem de configuración de Supabase ──
export const deleteConfigItem = async (tenantId, configKey, tableName, id) => {
    if (!tenantId || !id) throw new Error("Falta el identificador de la clínica o del ítem.");

    let deletedFromTable = false;

    // A. Eliminar de la tabla dedicada si existe
    if (tableName) {
        try {
            const { error, status } = await supabase
                .from(tableName)
                .delete()
                .eq("id", id);
            if (!error && status < 300) deletedFromTable = true;
        } catch (e) {
            console.warn(`No se pudo eliminar de la tabla ${tableName}:`, e.message);
        }
    }

    // B. Eliminar de website_config JSON
    try {
        const { data: cfgRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        if (cfgRow?.config) {
            const currentConfig = cfgRow.config;
            const currentList = Array.isArray(currentConfig[configKey]) ? currentConfig[configKey] : [];
            const filteredList = currentList.filter(i => i.id !== id);

            const newConfig = {
                ...currentConfig,
                [configKey]: filteredList,
                updatedAt: new Date().toISOString()
            };

            const { error: upsertErr } = await supabase
                .from("website_config")
                .upsert({ tenant_id: tenantId, config: newConfig }, { onConflict: "tenant_id" });

            if (upsertErr) throw upsertErr;
        }
    } catch (err) {
        console.error(`Error al eliminar ${configKey} de website_config:`, err);
        if (!deletedFromTable) throw err;
    }

    return { success: true, id };
};

export default {
    getConfigItems,
    saveConfigItem,
    deleteConfigItem
};
