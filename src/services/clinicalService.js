// src/services/clinicalService.js
import supabase from "../lib/supabaseClient";

// --- ANAMNESIS ---
export const saveAnamnesis = async (patientId, data) => {
    if (!patientId) throw new Error("Patient ID is required");
    try {
        // Read existing medical history JSONB
        const { data: patient, error: fetchErr } = await supabase
            .from("pacientes")
            .select("historial_medico")
            .eq("id", patientId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;

        const updatedHistory = {
            ...(patient?.historial_medico || {}),
            anamnesis: {
                ...data,
                updatedAt: new Date().toISOString()
            }
        };

        const { error: updateErr } = await supabase
            .from("pacientes")
            .update({ historial_medico: updatedHistory })
            .eq("id", patientId);

        if (updateErr) throw updateErr;
        return true;
    } catch (error) {
        console.error("Error saving anamnesis:", error);
        throw error;
    }
};

export const getAnamnesis = async (patientId) => {
    if (!patientId) return {};
    try {
        const { data, error } = await supabase
            .from("pacientes")
            .select("historial_medico")
            .eq("id", patientId)
            .maybeSingle();

        if (error) throw error;
        return data?.historial_medico?.anamnesis || {};
    } catch (error) {
        console.error("Error fetching anamnesis:", error);
        return {};
    }
};

// --- PHYSICAL EXAM ---
export const savePhysicalExam = async (patientId, data) => {
    if (!patientId) throw new Error("Patient ID is required");
    try {
        const { data: patient, error: fetchErr } = await supabase
            .from("pacientes")
            .select("historial_medico")
            .eq("id", patientId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;

        const updatedHistory = {
            ...(patient?.historial_medico || {}),
            examen_fisico: {
                ...data,
                updatedAt: new Date().toISOString()
            }
        };

        const { error: updateErr } = await supabase
            .from("pacientes")
            .update({ historial_medico: updatedHistory })
            .eq("id", patientId);

        if (updateErr) throw updateErr;
        return true;
    } catch (error) {
        console.error("Error saving physical exam:", error);
        throw error;
    }
};

export const getPhysicalExam = async (patientId) => {
    if (!patientId) return {};
    try {
        const { data, error } = await supabase
            .from("pacientes")
            .select("historial_medico")
            .eq("id", patientId)
            .maybeSingle();

        if (error) throw error;
        return data?.historial_medico?.examen_fisico || {};
    } catch (error) {
        console.error("Error fetching physical exam:", error);
        return {};
    }
};

// --- ODONTOGRAM SNAPSHOTS ---
export const saveOdontogramSnapshot = async (patientId, type, data) => {
    if (!patientId) throw new Error("Patient ID is required");
    try {
        const { data: patient } = await supabase
            .from("pacientes")
            .select("tenant_id")
            .eq("id", patientId)
            .maybeSingle();

        const tenantId = patient?.tenant_id;
        if (!tenantId) throw new Error("Tenant ID no encontrado para el paciente");

        const { error } = await supabase
            .from("odontogramas")
            .insert([{
                tenant_id: tenantId,
                paciente_id: patientId,
                data: data,
                observaciones: `Snapshot de odontograma (${type})`,
                estado: "Abierto"
            }]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error saving odontogram:", error);
        throw error;
    }
};

export const getOdontogramSnapshot = async (patientId, type) => {
    if (!patientId) return {};
    try {
        const { data, error } = await supabase
            .from("odontogramas")
            .select("data")
            .eq("paciente_id", patientId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data?.data || {};
    } catch (error) {
        console.error("Error fetching odontogram:", error);
        return {};
    }
};

export const subscribeToOdontogramSnapshot = (patientId, type, callback) => {
    if (!patientId) return () => {};

    getOdontogramSnapshot(patientId, type).then(callback);

    const channel = supabase
        .channel(`odontograma-${patientId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'odontogramas', filter: `paciente_id=eq.${patientId}` },
            () => {
                getOdontogramSnapshot(patientId, type).then(callback);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};
