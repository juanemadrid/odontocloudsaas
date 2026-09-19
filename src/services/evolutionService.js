// src/services/evolutionService.js
import supabase from "../lib/supabaseClient";
import { addToSyncQueue } from "./offlineStorageService";

export const addEvolution = async (evolutionData) => {
    try {
        const { data: patient } = await supabase
            .from("pacientes")
            .select("tenant_id")
            .eq("id", evolutionData.patientId || evolutionData.paciente_id)
            .maybeSingle();

        const tenantId = patient?.tenant_id || evolutionData.tenant_id;
        if (!tenantId) throw new Error("Tenant ID no encontrado para la evolución");

        const payload = {
            tenant_id: tenantId,
            paciente_id: evolutionData.patientId || evolutionData.paciente_id,
            profesional_id: evolutionData.doctorId || evolutionData.profesional_id || null,
            diagnostico: evolutionData.diagnostico || evolutionData.diagnosis || "",
            tratamiento: evolutionData.tratamiento || evolutionData.procedure || "",
            notas: evolutionData.notas || evolutionData.notes || "",
            procedimiento_cups: evolutionData.procedimiento_cups || evolutionData.cups || "",
            fecha: evolutionData.date ? new Date(evolutionData.date).toISOString() : new Date().toISOString()
        };

        const { data, error } = await supabase
            .from("evoluciones")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            ...data,
            date: new Date(data.fecha)
        };
    } catch (error) {
        console.warn("⚠️ Fallo al guardar evolución médica en Supabase. Guardando en almacenamiento local seguro:", error);
        const evoId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `evo_${Date.now()}`;
        const offlineRecord = {
            id: evoId,
            tenant_id: evolutionData.tenant_id || "default",
            paciente_id: evolutionData.patientId || evolutionData.paciente_id,
            profesional_id: evolutionData.doctorId || evolutionData.profesional_id || null,
            diagnostico: evolutionData.diagnostico || evolutionData.diagnosis || "",
            tratamiento: evolutionData.tratamiento || evolutionData.procedure || "",
            notas: evolutionData.notas || evolutionData.notes || "",
            procedimiento_cups: evolutionData.procedimiento_cups || evolutionData.cups || "",
            fecha: evolutionData.date ? new Date(evolutionData.date).toISOString() : new Date().toISOString(),
            _offline: true
        };

        await addToSyncQueue({
            tenant_id: offlineRecord.tenant_id,
            entity: "evoluciones",
            action: "upsert",
            payload: offlineRecord
        });

        return {
            ...offlineRecord,
            date: new Date(offlineRecord.fecha)
        };
    }
};

export const getEvolutionsByPatient = async (patientId) => {
    if (!patientId) return [];
    try {
        const { data, error } = await supabase
            .from("evoluciones")
            .select("*, profesional:profiles(full_name)")
            .eq("paciente_id", patientId)
            .order("fecha", { ascending: false });

        if (error) throw error;

        return (data || []).map(e => ({
            id: e.id,
            ...e,
            doctorName: e.profesional?.full_name || "Doctor",
            diagnosis: e.diagnostico,
            procedure: e.tratamiento,
            notes: e.notas,
            date: new Date(e.fecha || e.created_at)
        }));
    } catch (error) {
        console.error("Error getting evolutions from Supabase:", error);
        return [];
    }
};

export const deleteEvolution = async (id) => {
    if (!id) return;
    const { error } = await supabase
        .from("evoluciones")
        .delete()
        .eq("id", id);

    if (error) throw error;
};
