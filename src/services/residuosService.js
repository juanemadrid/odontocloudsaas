import supabase from "../lib/supabaseClient.js";
import { getConfigSection, saveConfigSection } from "./configPersistenceService.js";
import { setConfigSectionCache } from "./configCacheService.js";

export const DEFAULT_RESIDUES = [
    { id: "tr_anatomopatologicos", nombre: "Anatomopatológicos", color: "Rojo" },
    { id: "tr_animales", nombre: "Animales", color: "Rojo" },
    { id: "tr_aprovechables", nombre: "Aprovechables", color: "Blanco" },
    { id: "tr_biosanitarios", nombre: "Biosanitarios", color: "Rojo" },
    { id: "tr_corrosivos", nombre: "Corrosivos", color: "Rojo" },
    { id: "tr_cortopunzantes", nombre: "Cortopunzantes", color: "Rojo" },
    { id: "tr_explosivos", nombre: "Explosivos", color: "Rojo" },
    { id: "tr_inflamables", nombre: "Inflamables", color: "Rojo" },
    { id: "tr_no_aprovechables", nombre: "No aprovechables", color: "Negro" },
    { id: "tr_ordinarios", nombre: "Ordinarios", color: "Verde" },
    { id: "tr_radiactivos", nombre: "Radiactivos", color: "Rojo" },
    { id: "tr_reactivos", nombre: "Reactivos", color: "Rojo" },
    { id: "tr_toxicos", nombre: "Tóxicos", color: "Rojo" }
];

const normalizeResidues = (list = [], tenantId = "") => {
    if (!Array.isArray(list)) return [];
    return list
        .filter(item => item && (item.nombre || item.name))
        .map((item, idx) => ({
            id: item.id || `tr_${idx}_${Date.now()}`,
            nombre: String(item.nombre || item.name || "").trim(),
            color: item.color || "Rojo",
            tenant_id: item.tenant_id || tenantId,
            created_at: item.created_at || new Date().toISOString()
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
};

/**
 * Obtiene los tipos de residuos configurados para la clínica.
 * Si aún no se han configurado o la lista está vacía, pre-inicializa
 * automáticamente los residuos estándar de Colombia y los persiste.
 */
export async function getTiposResiduos(tenantId, force = false) {
    if (!tenantId) return DEFAULT_RESIDUES;

    try {
        let list = null;

        // 1. Intentar desde la caché unificada / RPC
        try {
            const cached = await getConfigSection(tenantId, "tipos_residuos", null, force);
            if (Array.isArray(cached) && cached.length > 0) {
                list = cached;
            }
        } catch (e) {
            console.warn("[residuosService] getConfigSection notice:", e?.message);
        }

        // 2. Intentar desde tabla dedicada si existiera
        if (!list || list.length === 0) {
            try {
                const { data: snap } = await supabase
                    .from("tipos_residuos")
                    .select("*")
                    .eq("tenant_id", tenantId);
                if (snap && snap.length > 0) list = snap;
            } catch (_) {}
        }

        // 3. Fallback directo a website_config
        if (!list || list.length === 0) {
            try {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", tenantId)
                    .maybeSingle();
                const fromCfg = cfgRow?.config?.tipos_residuos;
                if (Array.isArray(fromCfg) && fromCfg.length > 0) {
                    list = fromCfg;
                }
            } catch (_) {}
        }

        // 4. Si aún no hay tipos configurados, inicializar los tipos por defecto y persistirlos
        if (!list || list.length === 0) {
            const defaultList = DEFAULT_RESIDUES.map((item, idx) => ({
                id: item.id || `tr_${idx}_${Date.now()}`,
                nombre: item.nombre,
                color: item.color,
                tenant_id: tenantId,
                created_at: new Date().toISOString()
            }));

            // Persistir de forma no bloqueante para sincronizar la clínica
            saveTiposResiduos(tenantId, defaultList).catch(err => {
                console.warn("[residuosService] Error auto-persisting default residues:", err);
            });

            return defaultList;
        }

        return normalizeResidues(list, tenantId);
    } catch (err) {
        console.error("[residuosService] Error loading tipos_residuos:", err);
        return DEFAULT_RESIDUES;
    }
}

/**
 * Guarda la lista completa de tipos de residuos de la clínica en website_config y caché.
 */
export async function saveTiposResiduos(tenantId, list = []) {
    if (!tenantId) throw new Error("Falta el identificador de la clínica.");
    const normalized = normalizeResidues(list, tenantId);

    // 1. Guardar con el mecanismo oficial saveConfigSection (RPC atómica y cache)
    try {
        await saveConfigSection(tenantId, "tipos_residuos", normalized);
    } catch (err) {
        console.warn("[residuosService] saveConfigSection error, intentando upsert directo:", err?.message);
        try {
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", tenantId)
                .maybeSingle();
            const currentConfig = cfgRow?.config || {};
            await supabase.from("website_config").upsert(
                { tenant_id: tenantId, config: { ...currentConfig, tipos_residuos: normalized } },
                { onConflict: "tenant_id" }
            );
            setConfigSectionCache(tenantId, "tipos_residuos", normalized);
        } catch (upsertErr) {
            console.error("[residuosService] Error en fallback upsert de tipos_residuos:", upsertErr);
            throw upsertErr;
        }
    }

    // 2. Disparar evento para mantener sincronizadas todas las pestañas abiertas
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("residuos_types_changed", {
                detail: { tenantId, types: normalized }
            })
        );
    }

    return normalized;
}

/**
 * Agrega o edita un tipo de residuo individual.
 */
export async function addOrUpdateTipoResiduo(tenantId, item) {
    if (!tenantId) throw new Error("Falta el identificador de la clínica.");
    if (!item?.nombre?.trim()) throw new Error("El nombre del residuo es requerido.");

    const currentList = await getTiposResiduos(tenantId, true);
    const trimmedName = item.nombre.trim();
    const itemId = item.id || `tr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newItem = {
        id: itemId,
        nombre: trimmedName,
        color: item.color || "Rojo",
        tenant_id: tenantId,
        updated_at: new Date().toISOString()
    };

    let updatedList;
    const existingIndex = currentList.findIndex(r => r.id === itemId);
    if (existingIndex >= 0) {
        updatedList = [...currentList];
        updatedList[existingIndex] = { ...currentList[existingIndex], ...newItem };
    } else {
        newItem.created_at = new Date().toISOString();
        updatedList = [newItem, ...currentList];
    }

    return await saveTiposResiduos(tenantId, updatedList);
}

/**
 * Elimina un tipo de residuo por ID.
 */
export async function deleteTipoResiduo(tenantId, id) {
    if (!tenantId || !id) return;
    const currentList = await getTiposResiduos(tenantId, true);
    const filtered = currentList.filter(r => r.id !== id);
    return await saveTiposResiduos(tenantId, filtered);
}

/**
 * Obtiene los registros / reportes diarios de residuos.
 */
export async function getRegistroResiduos(tenantId, force = false) {
    if (!tenantId) return [];

    try {
        let list = null;

        // 1. Intentar desde la caché unificada / RPC
        try {
            const cached = await getConfigSection(tenantId, "registro_residuos", null, force);
            if (Array.isArray(cached)) list = cached;
        } catch (_) {}

        // 2. Intentar desde tabla dedicada si existiera
        if (!list) {
            try {
                const { data: snap } = await supabase
                    .from("registro_residuos")
                    .select("*")
                    .eq("tenant_id", tenantId);
                if (snap && snap.length > 0) list = snap;
            } catch (_) {}
        }

        // 3. Fallback directo a website_config
        if (!list) {
            try {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", tenantId)
                    .maybeSingle();
                list = cfgRow?.config?.registro_residuos || [];
            } catch (_) {}
        }

        return Array.isArray(list) ? list : [];
    } catch (err) {
        console.error("[residuosService] Error loading registro_residuos:", err);
        return [];
    }
}

/**
 * Guarda un nuevo reporte de residuo o actualiza uno existente.
 */
export async function saveReporteResiduo(tenantId, reportItem) {
    if (!tenantId) throw new Error("Falta el identificador de la clínica.");
    if (!reportItem) return;

    const currentList = await getRegistroResiduos(tenantId, true);
    const reportId = reportItem.id || (crypto.randomUUID ? crypto.randomUUID() : `rep_${Date.now()}`);

    const itemToSave = {
        ...reportItem,
        id: reportId,
        tenant_id: tenantId,
        created_at: reportItem.created_at || new Date().toISOString()
    };

    const existingIndex = currentList.findIndex(r => r.id === reportId);
    let updatedList;
    if (existingIndex >= 0) {
        updatedList = [...currentList];
        updatedList[existingIndex] = itemToSave;
    } else {
        updatedList = [itemToSave, ...currentList];
    }

    // 1. Guardar en website_config / caché
    try {
        await saveConfigSection(tenantId, "registro_residuos", updatedList);
    } catch (err) {
        console.warn("[residuosService] saveConfigSection error on registro_residuos:", err?.message);
        try {
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", tenantId)
                .maybeSingle();
            const currentConfig = cfgRow?.config || {};
            await supabase.from("website_config").upsert(
                { tenant_id: tenantId, config: { ...currentConfig, registro_residuos: updatedList } },
                { onConflict: "tenant_id" }
            );
            setConfigSectionCache(tenantId, "registro_residuos", updatedList);
        } catch (upsertErr) {
            console.error("[residuosService] Error en fallback upsert de registro_residuos:", upsertErr);
        }
    }

    // 2. Intentar guardar en tabla dedicada si existiera
    try {
        await supabase.from("registro_residuos").upsert([itemToSave], { onConflict: "id" });
    } catch (_) {}

    // 3. Notificar evento para sincronizar vistas
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("residuos_logs_changed", {
                detail: { tenantId, logs: updatedList }
            })
        );
    }

    return itemToSave;
}

/**
 * Elimina un reporte de residuo por ID.
 */
export async function deleteReporteResiduo(tenantId, id) {
    if (!tenantId || !id) return;
    const currentList = await getRegistroResiduos(tenantId, true);
    const filtered = currentList.filter(r => r.id !== id);

    try {
        await saveConfigSection(tenantId, "registro_residuos", filtered);
    } catch (err) {
        try {
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", tenantId)
                .maybeSingle();
            const currentConfig = cfgRow?.config || {};
            await supabase.from("website_config").upsert(
                { tenant_id: tenantId, config: { ...currentConfig, registro_residuos: filtered } },
                { onConflict: "tenant_id" }
            );
            setConfigSectionCache(tenantId, "registro_residuos", filtered);
        } catch (_) {}
    }

    try {
        await supabase.from("registro_residuos").delete().eq("id", id);
    } catch (_) {}

    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("residuos_logs_changed", {
                detail: { tenantId, logs: filtered }
            })
        );
    }

    return filtered;
}
