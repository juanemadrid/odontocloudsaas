// src/services/resourceService.js
import supabase from "../lib/supabaseClient";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "./configPersistenceService";

export const getDoctors = async (tenantId) => {
    if (!tenantId) return [];
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("tenant_id", tenantId)
            .in("role", ["odontologo", "administrador", "superadmin"]);

        if (error) throw error;

        return (data || []).map(d => ({
            id: d.id,
            nombre: d.full_name,
            name: d.full_name,
            role: d.role,
            activo: true
        }));
    } catch (e) {
        console.error("Error al obtener doctores de Supabase:", e);
        return [];
    }
};

export const subscribeToDoctors = (tenantId, callback) => {
    getDoctors(tenantId).then(callback);
    return () => {};
};

export const getChairs = async (tenantId) => {
    if (!tenantId) return [];
    try {
        const { data, error } = await supabase
            .from("consultorios")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("activo", true);

        if (error) throw error;

        return (data || []).map(c => ({
            id: c.id,
            nombre: c.nombre,
            name: c.nombre,
            activo: c.activo
        }));
    } catch (e) {
        console.error("Error al obtener consultorios de Supabase:", e);
        return [];
    }
};

export const subscribeToChairs = (tenantId, callback) => {
    getChairs(tenantId).then(callback);
    return () => {};
};

// ── ESPECIALIDADES ──
export const getSpecialties = async (tenantId) => {
    if (!tenantId) return [];
    const items = await getConfigItems(tenantId, "especialidades", "especialidades");
    if (items.length > 0) return items;
    return [
        { id: "1", nombre: "Ortodoncia" },
        { id: "2", nombre: "Endodoncia" },
        { id: "3", nombre: "Periodoncia" },
        { id: "4", nombre: "Odontopediatría" },
        { id: "5", nombre: "Cirugía Oral" },
        { id: "6", nombre: "Estética Dental" }
    ];
};

export const subscribeToSpecialties = (tenantId, callback) => {
    getSpecialties(tenantId).then(callback);
    return () => {};
};

export const createSpecialty = async (tenantId, data) => {
    return await saveConfigItem(tenantId, "especialidades", "especialidades", data);
};

export const updateSpecialty = async (tenantId, id, data) => {
    return await saveConfigItem(tenantId, "especialidades", "especialidades", { id, ...data });
};

export const deleteSpecialty = async (tenantId, id) => {
    return await deleteConfigItem(tenantId, "especialidades", "especialidades", id);
};

// ── CATEGORÍAS ──
export const getCategories = async (tenantId) => {
    if (!tenantId) return [];
    const items = await getConfigItems(tenantId, "categorias", "categorias");
    if (items.length > 0) return items;
    return [
        { id: "1", nombre: "Restauración" },
        { id: "2", nombre: "Cirugía" },
        { id: "3", nombre: "Desinfección" },
        { id: "4", nombre: "Material de Impresión" }
    ];
};

export const subscribeToCategories = (tenantId, callback) => {
    getCategories(tenantId).then(callback);
    return () => {};
};

export const createCategory = async (tenantId, data) => {
    return await saveConfigItem(tenantId, "categorias", "categorias", data);
};

export const updateCategory = async (tenantId, id, data) => {
    return await saveConfigItem(tenantId, "categorias", "categorias", { id, ...data });
};

export const deleteCategory = async (tenantId, id) => {
    return await deleteConfigItem(tenantId, "categorias", "categorias", id);
};
