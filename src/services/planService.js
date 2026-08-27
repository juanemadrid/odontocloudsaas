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

        const type = planData.type || (planData.status === "approved" ? "plan" : "presupuesto");

        let nroConsecutivo = planData.nroConsecutivo || null;
        try {
            const { consumeNextConsecutivo, CONSECUTIVO_TYPES } = await import("./consecutivosService");
            const consField = type === "plan" ? CONSECUTIVO_TYPES.PLAN_TRATAMIENTO : CONSECUTIVO_TYPES.PRESUPUESTOS;
            nroConsecutivo = await consumeNextConsecutivo(tenantId, consField);
        } catch (e) {
            console.warn("No se pudo incrementar el consecutivo del plan:", e.message);
        }

        const detallesObj = {
            items: planData.items || [],
            type: type,
            profesional: planData.profesional || planData.profesionalNombre || "",
            profesionalId: planData.profesionalId || "",
            vigencia: planData.vigencia || 30,
            observaciones: planData.observaciones || "",
            cobertura: planData.cobertura || {},
            baseListId: planData.baseListId || "",
            nroConsecutivo: nroConsecutivo || null
        };

        const payload = {
            tenant_id: tenantId,
            paciente_id: planData.patientId || planData.paciente_id,
            nombre: planData.title || planData.nombre || (type === "plan" ? `Plan de Tratamiento${nroConsecutivo ? ` #${nroConsecutivo}` : ''}` : `Presupuesto${nroConsecutivo ? ` #${nroConsecutivo}` : ''}`),
            total: Number(planData.total || planData.costoTotal || 0),
            estado: planData.status || (type === "plan" ? "approved" : "draft"),
            detalles: detallesObj
        };

        const { data, error } = await supabase
            .from("treatment_plans")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        const d = data.detalles || {};
        return {
            id: data.id,
            ...data,
            title: data.nombre,
            costoTotal: data.total,
            status: data.estado,
            type: d.type || type,
            profesional: d.profesional || "",
            profesionalId: d.profesionalId || "",
            vigencia: d.vigencia || 30,
            observaciones: d.observaciones || "",
            cobertura: d.cobertura || {},
            baseListId: d.baseListId || "",
            items: d.items || [],
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

        return (data || []).map(p => {
            const d = p.detalles || {};
            const items = Array.isArray(d) ? d : (d.items || []);
            const type = d.type || (p.estado === "approved" || p.estado === "Finalizado" ? "plan" : "presupuesto");
            return {
                id: p.id,
                ...p,
                title: p.nombre,
                costoTotal: p.total,
                status: p.estado,
                type: type,
                profesional: d.profesional || p.profesional || "",
                profesionalId: d.profesionalId || p.profesional_id || "",
                vigencia: d.vigencia || 30,
                observaciones: d.observaciones || p.observaciones || "",
                cobertura: d.cobertura || {},
                baseListId: d.baseListId || "",
                items: items,
                date: new Date(p.created_at)
            };
        });
    } catch (error) {
        console.error("Error getting plans from Supabase:", error);
        return [];
    }
};

export const updatePlan = async (planId, planData) => {
    try {
        const { data: existing } = await supabase
            .from("treatment_plans")
            .select("detalles, nombre, total, estado")
            .eq("id", planId)
            .maybeSingle();

        const currentDetalles = existing?.detalles || {};
        const isArrayDetalles = Array.isArray(currentDetalles);
        const prevObj = isArrayDetalles ? { items: currentDetalles } : currentDetalles;

        const updatedDetalles = {
            ...prevObj,
            items: planData.items !== undefined ? planData.items : (prevObj.items || []),
            type: planData.type !== undefined ? planData.type : (prevObj.type || (planData.status === "approved" ? "plan" : "presupuesto")),
            profesional: planData.profesional !== undefined ? planData.profesional : (prevObj.profesional || ""),
            profesionalId: planData.profesionalId !== undefined ? planData.profesionalId : (prevObj.profesionalId || ""),
            vigencia: planData.vigencia !== undefined ? planData.vigencia : (prevObj.vigencia || 30),
            observaciones: planData.observaciones !== undefined ? planData.observaciones : (prevObj.observaciones || ""),
            cobertura: planData.cobertura !== undefined ? planData.cobertura : (prevObj.cobertura || {}),
            baseListId: planData.baseListId !== undefined ? planData.baseListId : (prevObj.baseListId || "")
        };

        const payload = {
            detalles: updatedDetalles
        };

        if (planData.title || planData.nombre) payload.nombre = planData.title || planData.nombre;
        if (planData.total !== undefined || planData.costoTotal !== undefined) payload.total = Number(planData.total ?? planData.costoTotal);
        if (planData.status || planData.estado) payload.estado = planData.status || planData.estado;

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

export const updatePlanStatus = async (planId, status, type = null) => {
    const payload = { status };
    if (type) payload.type = type;
    else if (status === "approved") payload.type = "plan";
    return updatePlan(planId, payload);
};
