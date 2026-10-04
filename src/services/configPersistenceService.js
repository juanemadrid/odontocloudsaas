// src/services/configPersistenceService.js
import supabase from "../lib/supabaseClient";
import {
    getConfigSectionCached,
    setConfigSectionCache,
    setConfigSectionsCache,
} from "./configCacheService";

/**
 * Persistencia unificada de configuración por clínica.
 * website_config conserva el modelo completo y las tablas dedicadas reciben
 * únicamente las columnas que realmente existen en PostgreSQL.
 */
const isUUID = (str) =>
    typeof str === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const TABLE_PAYLOAD_BUILDERS = {
    bancos: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        nombre: item.nombre || "",
        tipo_cuenta: item.tipo_cuenta || item.tipoCuenta || "Ahorros",
        numero_cuenta: item.numero_cuenta || item.numeroCuenta || "",
        activo: item.activo !== false,
    }),
    consultorios: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        sucursal_id: item.sucursal_id || item.sucursalId || null,
        nombre: item.nombre || "",
        ubicacion: item.ubicacion || item.descripcion || "",
        activo: item.activo !== false,
    }),
    especialidades: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        nombre: item.nombre || "",
        descripcion: item.descripcion || "",
        activo: item.activo !== false,
    }),
    listas_precios: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        nombre: item.nombre || "",
        descripcion: item.descripcion || "",
        activa: item.activa !== false,
    }),
    sucursales: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        nombre: item.nombre || "",
        direccion: item.direccion || "",
        telefono: item.telefono || item.telCelular || "",
        activo: item.activo !== false,
    }),
    medicamentos: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        tipo: item.tipo || "Otros",
        codigo: item.codigo || "",
        principio_activo: item.principio_activo || item.nombre || "",
        nombre: item.nombre || item.principio_activo || "",
        descripcion: item.descripcion || "",
        marca: item.marca || "",
    }),
    planes_formulacion: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        nombre: item.nombre || "",
        descripcion: item.descripcion || "",
        medicamentos: item.medicamentos || [],
    }),
};

const isPersistedTable = (tableName) => Boolean(TABLE_PAYLOAD_BUILDERS[tableName]);

export const getConfigSection = async (tenantId, configKey, fallbackValue = null) => {
    if (!tenantId) return fallbackValue;
    return getConfigSectionCached(tenantId, configKey, fallbackValue);
};

export const saveConfigSection = async (tenantId, configKey, value) => {
    if (!tenantId) throw new Error("Falta el identificador de la clínica.");
    if (!/^[a-z0-9_]{1,80}$/.test(configKey || "")) {
        throw new Error("La sección de configuración no es válida.");
    }

    const { data, error } = await supabase.rpc("set_tenant_config_section", {
        p_tenant_id: tenantId,
        p_key: configKey,
        p_value: value,
    });

    if (error) throw error;
    const updatedConfig = data && typeof data === "object"
        ? data
        : { [configKey]: value, updatedAt: new Date().toISOString() };
    setConfigSectionCache(tenantId, configKey, updatedConfig?.[configKey] ?? value);
    return updatedConfig;
};

export const saveConfigPatch = async (tenantId, patch) => {
    if (!tenantId) throw new Error("Falta el identificador de la clínica.");
    if (!patch || Array.isArray(patch) || typeof patch !== "object") {
        throw new Error("El parche de configuración no es válido.");
    }

    const { data, error } = await supabase.rpc("merge_tenant_config", {
        p_tenant_id: tenantId,
        p_patch: patch,
    });
    if (error) throw error;

    const updatedConfig = data && typeof data === "object"
        ? data
        : { ...patch, updatedAt: new Date().toISOString() };
    setConfigSectionsCache(tenantId, { ...patch, ...updatedConfig });
    return updatedConfig;
};

export const getConfigItems = async (tenantId, configKey, tableName) => {
    if (!tenantId) return [];

    try {
        let tableData = [];

        if (isPersistedTable(tableName)) {
            try {
                const { data, error, status } = await supabase
                    .from(tableName)
                    .select("*")
                    .eq("tenant_id", tenantId);

                if (error) throw error;
                if (status >= 200 && status < 300 && Array.isArray(data)) {
                    tableData = data.map(item => ({
                        id: item.id,
                        nombre: item.nombre || item.name || "",
                        ...item,
                    }));
                }
            } catch (error) {
                console.warn(
                    `No se pudo leer la tabla ${tableName}; se usará la configuración de la clínica:`,
                    error.message
                );
            }
        }

        const currentSection = await getConfigSection(tenantId, configKey, []);
        const configData = Array.isArray(currentSection)
            ? currentSection
            : [];

        // Unión completa: los registros que existen solo en JSON no desaparecen
        // cuando la tabla dedicada ya contiene otros registros.
        const merged = new Map();
        configData.forEach(item => merged.set(String(item.id), item));
        tableData.forEach(item => {
            const key = String(item.id);
            const configItem = merged.get(key) || {};
            const resolvedNombre = item.nombre || configItem.nombre || item.name || configItem.name || item.tipo || configItem.tipo || "";
            merged.set(key, {
                ...configItem,
                ...item,
                nombre: resolvedNombre,
                permisos: item.permisos ?? configItem.permisos,
            });
        });

        return Array.from(merged.values());
    } catch (error) {
        console.error(`Error al obtener ${configKey} desde Supabase:`, error);
        throw error;
    }
};

export const saveConfigItem = async (tenantId, configKey, tableName, itemData) => {
    if (!tenantId) throw new Error("Falta el identificador de la clínica.");

    const id = itemData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const payload = {
        ...itemData,
        id,
        tenant_id: tenantId,
        actualizado: now,
    };

    if (isPersistedTable(tableName)) {
        try {
            const tablePayload = TABLE_PAYLOAD_BUILDERS[tableName](payload);
            if (tablePayload && isUUID(tablePayload.id)) {
                const query = supabase
                    .from(tableName)
                    .upsert([tablePayload], { onConflict: "id" });
                const { error } = await query;
                if (error) {
                    console.warn(`No se pudo sincronizar en tabla ${tableName}:`, error.message);
                }
            } else {
                console.warn(`Omitiendo sincronización en tabla ${tableName}: ID no es un UUID válido (${payload.id})`);
            }
        } catch (tableErr) {
            console.warn(`Error al sincronizar en tabla ${tableName}:`, tableErr.message);
        }
    }

    const currentSection = await getConfigSection(tenantId, configKey, []);
    const currentList = Array.isArray(currentSection)
        ? currentSection
        : [];
    const exists = currentList.some(item => item.id === id);
    const updatedList = exists
        ? currentList.map(item => item.id === id ? { ...item, ...payload } : item)
        : [...currentList, payload];

    await saveConfigSection(tenantId, configKey, updatedList);
    return payload;
};

export const deleteConfigItem = async (tenantId, configKey, tableName, id) => {
    if (!tenantId || !id) {
        throw new Error("Falta el identificador de la clínica o del ítem.");
    }

    if (isPersistedTable(tableName) && isUUID(id)) {
        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq("id", id)
                .eq("tenant_id", tenantId);
            if (error) {
                console.warn(`No se pudo eliminar de la tabla ${tableName}:`, error.message);
            }
        } catch (delErr) {
            console.warn(`Error al eliminar de la tabla ${tableName}:`, delErr.message);
        }
    }

    const currentSection = await getConfigSection(tenantId, configKey, []);
    const currentList = Array.isArray(currentSection)
        ? currentSection
        : [];
    await saveConfigSection(
        tenantId,
        configKey,
        currentList.filter(item => item.id !== id)
    );

    return { success: true, id };
};

export default {
    getConfigItems,
    getConfigSection,
    saveConfigSection,
    saveConfigPatch,
    saveConfigItem,
    deleteConfigItem,
};
