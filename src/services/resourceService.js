// src/services/resourceService.js
import supabase from "../lib/supabaseClient";

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

export const subscribeToSpecialties = (tenantId, callback) => {
    callback([
        { id: "1", nombre: "Ortodoncia" },
        { id: "2", nombre: "Endodoncia" },
        { id: "3", nombre: "Periodoncia" },
        { id: "4", nombre: "Odontopediatría" },
        { id: "5", nombre: "Cirugía Oral" },
        { id: "6", nombre: "Estética Dental" }
    ]);
    return () => {};
};

export const createSpecialty = async (tenantId, data) => true;
export const updateSpecialty = async (id, data) => true;
export const deleteSpecialty = async (id) => true;

export const subscribeToCategories = (tenantId, callback) => {
    callback([
        { id: "1", nombre: "Restauración" },
        { id: "2", nombre: "Cirugía" },
        { id: "3", nombre: "Desinfección" },
        { id: "4", nombre: "Material de Impresión" }
    ]);
    return () => {};
};

export const createCategory = async (tenantId, data) => true;
export const updateCategory = async (id, data) => true;
export const deleteCategory = async (id) => true;
