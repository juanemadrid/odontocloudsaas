// src/services/configPersistenceService.js
import supabase from "../lib/supabaseClient";
import { getConfigCached, setConfigCache } from "../hooks/useConfig";

/**
 * Persistencia unificada de configuración por clínica.
 * website_config conserva el modelo completo y las tablas dedicadas reciben
 * únicamente las columnas que realmente existen en PostgreSQL.
 */

const TABLE_PAYLOAD_BUILDERS = {
    bancos: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        nombre: item.nombre || "",
        tipo_cuenta: item.tipo_cuenta || item.tipoCuenta || "Ahorros",
        numero_cuenta: item.numero_cuenta || item.numeroCuenta || "",
        activo: item.activo !== false,
    }),
    consecutivos: (item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        tipo: item.tipo || item.nombre || "general",
        prefijo: item.prefijo || item.fvPrefijo || item.fePrefijoFactura || "",
        ultimo_numero: Number(
            item.ultimo_numero ?? item.contReciboCaja ?? item.fvNumActual ?? item.feNumActual ?? 0
        ) || 0,
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
    const config = await getConfigCached(tenantId);
    return config?.[configKey] ?? fallbackValue;
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
    const updatedConfig = data || {
        ...(await getConfigCached(tenantId)),
        [configKey]: value,
        updatedAt: new Date().toISOString(),
    };
    setConfigCache(tenantId, updatedConfig);
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

    const updatedConfig = data || {
        ...(await getConfigCached(tenantId)),
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    setConfigCache(tenantId, updatedConfig);
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

        const currentConfig = await getConfigCached(tenantId);
        const configData = Array.isArray(currentConfig?.[configKey])
            ? currentConfig[configKey]
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
        const tablePayload = TABLE_PAYLOAD_BUILDERS[tableName](payload);
        // Upsert keeps the operational table synchronized even when the item
        // previously existed only inside website_config JSON.
        const query = supabase
            .from(tableName)
            .upsert([tablePayload], { onConflict: "id" });
        const { error } = await query;
        if (error) throw error;
    }

    const currentConfig = await getConfigCached(tenantId);
    const currentList = Array.isArray(currentConfig?.[configKey])
        ? currentConfig[configKey]
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

    if (isPersistedTable(tableName)) {
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq("id", id)
            .eq("tenant_id", tenantId);
        if (error) throw error;
    }

    const currentConfig = await getConfigCached(tenantId);
    const currentList = Array.isArray(currentConfig?.[configKey])
        ? currentConfig[configKey]
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
