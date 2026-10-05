// src/services/resourceService.js
import supabase from "../lib/supabaseClient";
import { 
    getConfigItems, 
    saveConfigItem, 
    deleteConfigItem,
    getConfigSection,
    saveConfigPatch
} from "./configPersistenceService";

import { isDoctorUser } from "../utils/doctorHelpers";

export const getDoctors = async (tenantId) => {
    if (!tenantId) return [];
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("tenant_id", tenantId);

        if (error) throw error;

        return (data || [])
            .filter(d => isDoctorUser(d))
            .map(d => ({
                id: d.id,
                nombre: d.full_name || d.nombreCompleto || d.email,
                name: d.full_name || d.nombreCompleto || d.email,
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
export const DEFAULT_SPECIALTIES = [
    { nombre: "Ortodoncia", descripcion: "Corrección y alineación de la posición dental y oclusión" },
    { nombre: "Endodoncia", descripcion: "Tratamiento de conductos radiculares y pulpa dental" },
    { nombre: "Periodoncia", descripcion: "Tratamiento de encías y tejidos de soporte dental" },
    { nombre: "Odontopediatría", descripcion: "Atención odontológica integral en niños y adolescentes" },
    { nombre: "Cirugía Oral", descripcion: "Procedimientos quirúrgicos en cavidad oral y maxilares" },
    { nombre: "Estética Dental", descripcion: "Diseño de sonrisa, blanqueamiento y cosmética dental" }
];

export const seedDefaultSpecialties = async (tenantId) => {
    if (!tenantId) return [];
    try {
        const seededList = DEFAULT_SPECIALTIES.map(s => ({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            nombre: s.nombre,
            descripcion: s.descripcion,
            activo: true,
            actualizado: new Date().toISOString()
        }));

        await saveConfigPatch(tenantId, {
            especialidades: seededList,
            especialidades_initialized: true
        });

        try {
            const tablePayloads = seededList.map(item => ({
                id: item.id,
                tenant_id: tenantId,
                nombre: item.nombre,
                descripcion: item.descripcion,
                activo: true
            }));
            await supabase.from("especialidades").upsert(tablePayloads, { onConflict: "id" });
        } catch (tableErr) {
            console.warn("Aviso al sincronizar tabla especialidades:", tableErr);
        }

        return seededList;
    } catch (err) {
        console.error("Error al sembrar especialidades predeterminadas:", err);
        return DEFAULT_SPECIALTIES.map((s, idx) => ({ id: String(idx + 1), ...s }));
    }
};

export const getSpecialties = async (tenantId) => {
    if (!tenantId) return [];
    
    // 1. Obtener registros persistidos en la base de datos
    const items = await getConfigItems(tenantId, "especialidades", "especialidades");
    if (items.length > 0) return items;

    // 2. Si no hay ítems, verificar si la sección ya fue inicializada explícitamente en la clínica
    const isInitialized = await getConfigSection(tenantId, "especialidades_initialized", false);
    if (isInitialized) {
        // La clínica ya fue inicializada y el usuario eliminó todos los registros intencionalmente
        return [];
    }

    // 3. Primera vez: Sembrar automáticamente en la base de datos para que sean reales y persistentes
    return await seedDefaultSpecialties(tenantId);
};

export const subscribeToSpecialties = (tenantId, callback) => {
    getSpecialties(tenantId).then(callback);
    return () => {};
};

export const createSpecialty = async (tenantId, data) => {
    const res = await saveConfigItem(tenantId, "especialidades", "especialidades", data);
    await saveConfigPatch(tenantId, { especialidades_initialized: true }).catch(() => {});
    return res;
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
    const items = await getConfigItems(tenantId, "categorias", null);
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
    return await saveConfigItem(tenantId, "categorias", null, data);
};

export const updateCategory = async (tenantId, id, data) => {
    return await saveConfigItem(tenantId, "categorias", null, { id, ...data });
};

export const deleteCategory = async (tenantId, id) => {
    return await deleteConfigItem(tenantId, "categorias", null, id);
};
