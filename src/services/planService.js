// src/services/planService.js
import supabase from "../lib/supabaseClient";

export const createPlan = async (planData) => {
    try {
        const { data: patient } = await supabase
            .from("pacientes")
            .select("tenant_id")
            .eq("id", planData.patientId || planData.paciente_id)
            .maybeSingle();

        const tenantId = patient?.tenant_id || planData.tenant_id || planData.inquilino;
        if (!tenantId) throw new Error("Tenant ID no encontrado para el plan de tratamiento");

        const payload = {
            tenant_id: tenantId,
            paciente_id: planData.patientId || planData.paciente_id,
            nombre: planData.title || planData.nombre || "Plan de Tratamiento",
            total: Number(planData.total || planData.costoTotal || 0),
            estado: planData.status || "draft",
            detalles: planData.items || []
        };

        const { data, error } = await supabase
            .from("treatment_plans")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            ...data,
            title: data.nombre,
            costoTotal: data.total,
            items: data.detalles || [],
            date: new Date(data.created_at)
        };
    } catch (error) {
        console.error("Error creating plan in Supabase:", error);
        throw error;
    }
};

export const getPlansByPatient = async (patientId) => {
    if (!patientId) return [];
    try {
        const { data, error } = await supabase
            .from("treatment_plans")
            .select("*")
            .eq("paciente_id", patientId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return (data || []).map(p => ({
            id: p.id,
            ...p,
            title: p.nombre,
            costoTotal: p.total,
            status: p.estado,
            items: p.detalles || [],
            date: new Date(p.created_at)
        }));
    } catch (error) {
        console.error("Error getting plans from Supabase:", error);
        return [];
    }
};

export const updatePlan = async (planId, planData) => {
    try {
        const payload = {};
        if (planData.title || planData.nombre) payload.nombre = planData.title || planData.nombre;
        if (planData.total !== undefined || planData.costoTotal !== undefined) payload.total = Number(planData.total ?? planData.costoTotal);
        if (planData.status || planData.estado) payload.estado = planData.status || planData.estado;
        if (planData.items) payload.detalles = planData.items;

        const { data, error } = await supabase
            .from("treatment_plans")
            .update(payload)
            .eq("id", planId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error updating plan in Supabase:", error);
        throw error;
    }
};

export const deletePlan = async (planId) => {
    if (!planId) return;
    const { error } = await supabase
        .from("treatment_plans")
        .delete()
        .eq("id", planId);

    if (error) throw error;
};

export const updatePlanStatus = async (planId, status) => {
    return updatePlan(planId, { status });
};
