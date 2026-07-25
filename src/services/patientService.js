// src/services/patientService.js
import supabase from "../lib/supabaseClient";

// Utils
const normalize = (s) =>
    (s || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

// --- CRUD CON SUPABASE POSTGRESQL ---

export const getPatientsCount = async (tenantId) => {
    if (!tenantId) return 0;
    try {
        const { count, error } = await supabase
            .from("pacientes")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId);

        if (error) throw error;
        return count || 0;
    } catch (e) {
        console.warn("Error calculando el número total de pacientes:", e);
        return 0;
    }
};

export const getPatientsPage = async (tenantId, pageIndex = 0, pageSize = 20) => {
    if (!tenantId) return { patients: [], hasMore: false };

    try {
        const start = pageIndex * pageSize;
        const end = start + pageSize - 1;

        const { data, error, count } = await supabase
            .from("pacientes")
            .select("*", { count: "exact" })
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false })
            .range(start, end);

        if (error) throw error;

        // Normalización para compatibilidad con vistas de UI
        const patients = (data || []).map(p => ({
            ...p,
            nroDocumento: p.documento,
            nombreCompleto: `${p.nombres || ""} ${p.apellidos || ""}`.trim(),
            celular: p.telefono,
            actualizado: p.created_at
        }));

        return {
            patients,
            hasMore: count ? start + patients.length < count : false,
            totalCount: count || 0
        };
    } catch (e) {
        console.error("Error en getPatientsPage de Supabase:", e);
        return { patients: [], hasMore: false };
    }
};

export const searchPatients = async (tenantId, searchTerm, maxResults = 30) => {
    if (!tenantId) return [];
    const term = (searchTerm || "").trim();
    if (!term) return [];

    try {
        const { data, error } = await supabase
            .from("pacientes")
            .select("*")
            .eq("tenant_id", tenantId)
            .or(`nombres.ilike.%${term}%,apellidos.ilike.%${term}%,documento.ilike.%${term}%,telefono.ilike.%${term}%,email.ilike.%${term}%`)
            .limit(maxResults);

        if (error) throw error;

        return (data || []).map(p => ({
            ...p,
            nroDocumento: p.documento,
            nombreCompleto: `${p.nombres || ""} ${p.apellidos || ""}`.trim(),
            celular: p.telefono
        }));
    } catch (err) {
        console.error("Error en searchPatients de Supabase:", err);
        return [];
    }
};

export const getPatientById = async (id) => {
    if (!id) return null;
    try {
        const { data, error } = await supabase
            .from("pacientes")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
            ...data,
            nroDocumento: data.documento,
            nombreCompleto: `${data.nombres || ""} ${data.apellidos || ""}`.trim(),
            celular: data.telefono
        };
    } catch (e) {
        console.error("Error al obtener paciente por ID:", e);
        return null;
    }
};

export const createOrUpdatePatient = async (tenantId, patientData, isNew = false, photoFile = null) => {
    if (!tenantId) throw new Error("Tenant ID requerido");

    const documento = (patientData.nroDocumento || patientData.documento || "").trim();
    if (!documento) throw new Error("El documento del paciente es obligatorio.");

    // Subida opcional de imagen a Supabase Storage
    let fotoUrl = patientData.fotoUrl || "";
    if (photoFile) {
        try {
            fotoUrl = await uploadPatientPhoto(tenantId, documento, photoFile);
        } catch (storageErr) {
            console.warn("Error al subir foto a Supabase Storage:", storageErr);
        }
    }

    const payload = {
        tenant_id: tenantId,
        tipo_documento: patientData.tipoDocumento || "CC",
        documento: documento,
        nombres: patientData.nombres || patientData.nombreCompleto?.split(" ")[0] || "",
        apellidos: patientData.apellidos || patientData.nombreCompleto?.split(" ").slice(1).join(" ") || "",
        fecha_nacimiento: patientData.fechaNacimiento || null,
        genero: patientData.genero || "No especificado",
        telefono: patientData.celular || patientData.telefono || "",
        email: patientData.email || "",
        direccion: patientData.direccion || "",
        ciudad: patientData.ciudad || "",
        ocupacion: patientData.ocupacion || "",
        eps: patientData.eps || "",
        tipo_afiliacion: patientData.tipoAfiliacion || "",
        historial_medico: patientData.historialMedico || {},
        contacto_emergencia: patientData.contactoEmergencia || {},
        activo: patientData.activo ?? true
    };

    let resultData;
    if (patientData.id && !isNew) {
        // Actualización por ID
        const { data, error } = await supabase
            .from("pacientes")
            .update(payload)
            .eq("id", patientData.id)
            .select()
            .single();

        if (error) throw error;
        resultData = data;
    } else {
        // Inserción de nuevo paciente
        const { data, error } = await supabase
            .from("pacientes")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        resultData = data;
    }

    return {
        ...resultData,
        nroDocumento: resultData.documento,
        nombreCompleto: `${resultData.nombres || ""} ${resultData.apellidos || ""}`.trim(),
        celular: resultData.telefono
    };
};

export const deletePatient = async (id) => {
    if (!id) throw new Error("ID de paciente inválido");
    const { error } = await supabase
        .from("pacientes")
        .delete()
        .eq("id", id);

    if (error) throw error;
};

export const togglePatientActive = async (id, isActive) => {
    if (!id) return;
    const { error } = await supabase
        .from("pacientes")
        .update({ activo: isActive })
        .eq("id", id);

    if (error) throw error;
};

// --- Storage de Supabase ---

export const uploadPatientPhoto = async (tenantId, patientId, file) => {
    const fileExt = file.name.split(".").pop();
    const filePath = `pacientes/${tenantId}/${patientId}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from("adjuntos")
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        console.error("Error al subir imagen a Supabase Storage:", uploadError);
        throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
        .from("adjuntos")
        .getPublicUrl(filePath);

    return publicUrl;
};
