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
            tipoDocumento: p.tipo_documento || p.tipoDocumento || "CC",
            tipo_documento: p.tipo_documento || p.tipoDocumento || "CC",
            nroDocumento: p.documento || p.nroDocumento || "",
            documento: p.documento || p.nroDocumento || "",
            nombreCompleto: `${p.nombres || ""} ${p.apellidos || ""}`.trim() || p.nombreCompleto || "",
            celular: p.telefono || p.celular || "",
            telefono: p.telefono || p.celular || "",
            fechaNacimiento: p.fecha_nacimiento || p.fechaNacimiento || "",
            fecha_nacimiento: p.fecha_nacimiento || p.fechaNacimiento || "",
            sexo: p.genero || p.sexo || "No especificado",
            genero: p.genero || p.sexo || "No especificado",
            actualizado: p.created_at || p.updated_at
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
            tipoDocumento: p.tipo_documento || p.tipoDocumento || "CC",
            tipo_documento: p.tipo_documento || p.tipoDocumento || "CC",
            nroDocumento: p.documento || p.nroDocumento || "",
            documento: p.documento || p.nroDocumento || "",
            nombreCompleto: `${p.nombres || ""} ${p.apellidos || ""}`.trim() || p.nombreCompleto || "",
            celular: p.telefono || p.celular || "",
            telefono: p.telefono || p.celular || "",
            fechaNacimiento: p.fecha_nacimiento || p.fechaNacimiento || "",
            fecha_nacimiento: p.fecha_nacimiento || p.fechaNacimiento || "",
            sexo: p.genero || p.sexo || "No especificado",
            genero: p.genero || p.sexo || "No especificado"
        }));
    } catch (err) {
        console.error("Error en searchPatients de Supabase:", err);
        return [];
    }
};

export const getPatientById = async (id) => {
    console.log("🔍 getPatientById - Buscando paciente con ID:", id);
    if (!id) return null;
    try {
        const { data, error } = await supabase
            .from("pacientes")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) {
            console.error("❌ Error de Supabase:", error);
            throw error;
        }
        if (!data) {
            console.warn("⚠️ No se encontró paciente con ID:", id);
            return null;
        }

        console.log("✅ Paciente encontrado en Supabase:", data);

        return {
            ...data,
            // Mapeo de nombres de campos (Supabase → Frontend)
            tipoDocumento: data.tipo_documento || data.tipoDocumento || "CC",
            tipo_documento: data.tipo_documento || data.tipoDocumento || "CC",
            nroDocumento: data.documento || data.nroDocumento || "",
            documento: data.documento || data.nroDocumento || "",
            nroHistoria: data.nro_historia || data.nroHistoria || data.documento || "",
            nombreCompleto: `${data.nombres || ""} ${data.apellidos || ""}`.trim() || data.nombreCompleto || "",
            fechaIngreso: data.fecha_ingreso || data.fechaIngreso || "",
            fecha_ingreso: data.fecha_ingreso || data.fechaIngreso || "",
            fechaNacimiento: data.fecha_nacimiento || data.fechaNacimiento || "",
            fecha_nacimiento: data.fecha_nacimiento || data.fechaNacimiento || "",
            sexo: data.genero || data.sexo || "No especificado",
            genero: data.genero || data.sexo || "No especificado",
            estadoCivil: data.estado_civil || data.estadoCivil || "",
            estado_civil: data.estado_civil || data.estadoCivil || "",
            esExtranjero: data.es_extranjero || data.esExtranjero || false,
            permitePublicidad: data.permite_publicidad ?? data.permitePublicidad ?? true,
            registroCompleto: data.registro_completo ?? data.registroCompleto ?? true,
            registro_completo: data.registro_completo ?? data.registroCompleto ?? true,
            // Ubicación
            paisNacimiento: data.pais_nacimiento || data.paisNacimiento || "Colombia",
            pais_nacimiento: data.pais_nacimiento || data.paisNacimiento || "Colombia",
            ciudadNacimiento: data.ciudad_nacimiento || data.ciudadNacimiento || "",
            ciudad_nacimiento: data.ciudad_nacimiento || data.ciudadNacimiento || "",
            paisDomicilio: data.pais_domicilio || data.paisDomicilio || "Colombia",
            pais_domicilio: data.pais_domicilio || data.paisDomicilio || "Colombia",
            ciudadDomicilio: data.ciudad_domicilio || data.ciudadDomicilio || data.ciudad || "",
            ciudad_domicilio: data.ciudad_domicilio || data.ciudadDomicilio || data.ciudad || "",
            barrio: data.barrio || "",
            lugarResidencia: data.lugar_residencia || data.lugarResidencia || data.direccion || "",
            lugar_residencia: data.lugar_residencia || data.lugarResidencia || data.direccion || "",
            estrato: data.estrato || "",
            zonaResidencial: data.zona_residencial || data.zonaResidencial || data.zona || "Urbana",
            zona_residencial: data.zona_residencial || data.zonaResidencial || data.zona || "Urbana",
            // Contacto
            celular: data.telefono || data.celular || "",
            telefono: data.telefono || data.celular || "",
            prefijoCelular: data.prefijo_celular || data.prefijoCelular || "+57",
            telDomicilio: data.telefono_domicilio || data.telDomicilio || "",
            telefonoDomicilio: data.telefono_domicilio || data.telefonoDomicilio || "",
            telOficina: data.telefono_oficina || data.telOficina || "",
            telefonoOficina: data.telefono_oficina || data.telefonoOficina || "",
            extension: data.extension || "",
            email: data.email || data.correo || "",
            correo: data.email || data.correo || "",
            ocupacion: data.ocupacion || "",
            // EPS
            nombreEps: data.eps || data.nombreEps || "",
            tipoVinculacion: data.tipo_afiliacion || data.tipoVinculacion || "",
            tipo_afiliacion: data.tipo_afiliacion || data.tipoVinculacion || "",
            polizaSalud: data.poliza_salud || data.polizaSalud || "",
            planId: data.plan_id || data.planId || "",
            planNombre: data.plan_nombre || data.planNombre || "",
            // Marketing
            convenioBeneficio: data.convenio_beneficio || data.convenioBeneficio || "",
            convenioPago: data.convenio_pago || data.convenioPago || "",
            comoConocio: data.como_conocio || data.comoConocio || data.comoNosConocio || "",
            comoNosConocio: data.como_conocio || data.comoConocio || data.comoNosConocio || "",
            campania: data.campania || "",
            remitidoPorType: data.remitido_por_type || data.remitidoPorType || "Libre",
            remitidoPorValue: data.remitido_por_value || data.remitidoPorValue || "",
            asesorComercialType: data.asesor_comercial_type || data.asesorComercialType || "Libre",
            asesorComercialValue: data.asesor_comercial_value || data.asesorComercialValue || "",
            // Profesional
            profesionalId: data.profesional_id || data.profesionalId || "",
            profesionalNombre: data.profesional_nombre || data.profesionalNombre || "",
            // Responsable
            nombreResponsable: data.nombre_responsable || data.nombreResponsable || "",
            parentesco: data.parentesco || "",
            celularResponsable: data.celular_responsable || data.celularResponsable || "",
            telefonoResponsable: data.telefono_responsable || data.telefonoResponsable || "",
            emailResponsable: data.email_responsable || data.emailResponsable || "",
            // Acompañante
            nombreAcompanante: data.nombre_acompanante || data.nombreAcompanante || "",
            telefonoAcompanante: data.telefono_acompanante || data.telefonoAcompanante || "",
            // Alertas y notas
            alertas: data.alertas || "",
            notas: data.notas || "",
            // Foto
            fotoUrl: data.foto_url || data.fotoUrl || ""
        };
    } catch (e) {
        console.error("❌ Error al obtener paciente por ID:", e);
        return null;
    }
};

export const createOrUpdatePatient = async (tenantId, patientData, isNew = false, photoFile = null) => {
    console.log("💾 createOrUpdatePatient - Iniciando guardado");
    console.log("📋 Datos recibidos:", { tenantId, isNew, patientId: patientData.id, patientData });
    
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
        tipo_documento: patientData.tipoDocumento || patientData.tipo_documento || "CC",
        documento: documento,
        nombres: patientData.nombres || patientData.nombreCompleto?.split(" ")[0] || "",
        apellidos: patientData.apellidos || patientData.nombreCompleto?.split(" ").slice(1).join(" ") || "",
        nro_historia: patientData.nroHistoria || documento,
        fecha_ingreso: patientData.fechaIngreso || new Date().toISOString().slice(0, 10),
        fecha_nacimiento: patientData.fechaNacimiento || patientData.fecha_nacimiento || null,
        genero: patientData.genero || patientData.sexo || "No especificado",
        estado_civil: patientData.estadoCivil || patientData.estado_civil || "",
        es_extranjero: patientData.esExtranjero || false,
        permite_publicidad: patientData.permitePublicidad ?? true,
        registro_completo: patientData.registroCompleto ?? true,
        // Ubicación y contacto
        pais_nacimiento: patientData.paisNacimiento || patientData.pais_nacimiento || "Colombia",
        ciudad_nacimiento: patientData.ciudadNacimiento || patientData.ciudad_nacimiento || "",
        pais_domicilio: patientData.paisDomicilio || patientData.pais_domicilio || "Colombia",
        ciudad_domicilio: patientData.ciudadDomicilio || patientData.ciudad_domicilio || "",
        ciudad: patientData.ciudad || patientData.ciudadDomicilio || patientData.ciudad_domicilio || "",
        barrio: patientData.barrio || "",
        direccion: patientData.direccion || patientData.lugarResidencia || patientData.lugar_residencia || "",
        lugar_residencia: patientData.lugarResidencia || patientData.lugar_residencia || patientData.direccion || "",
        estrato: patientData.estrato || "",
        zona_residencial: patientData.zonaResidencial || patientData.zona_residencial || patientData.zona || "Urbana",
        // Teléfonos y contacto
        telefono: patientData.celular || patientData.telefono || "",
        prefijo_celular: patientData.prefijoCelular || "+57",
        telefono_domicilio: patientData.telDomicilio || patientData.telefonoDomicilio || "",
        telefono_oficina: patientData.telOficina || patientData.telefonoOficina || "",
        extension: patientData.extension || "",
        email: patientData.email || patientData.correo || "",
        ocupacion: patientData.ocupacion || "",
        // EPS y aseguramiento
        eps: patientData.nombreEps || patientData.eps || "",
        tipo_afiliacion: patientData.tipoVinculacion || patientData.tipoAfiliacion || patientData.tipo_afiliacion || "",
        poliza_salud: patientData.polizaSalud || "",
        plan_id: patientData.planId || "",
        plan_nombre: patientData.planNombre || "",
        // Marketing
        convenio_beneficio: patientData.convenioBeneficio || "",
        convenio_pago: patientData.convenioPago || "",
        como_conocio: patientData.comoConocio || patientData.comoNosConocio || "",
        campania: patientData.campania || "",
        remitido_por_type: patientData.remitidoPorType || "Libre",
        remitido_por_value: patientData.remitidoPorValue || "",
        asesor_comercial_type: patientData.asesorComercialType || "Libre",
        asesor_comercial_value: patientData.asesorComercialValue || "",
        // Profesional asignado
        profesional_id: patientData.profesionalId || "",
        profesional_nombre: patientData.profesionalNombre || "",
        // Responsable
        nombre_responsable: patientData.nombreResponsable || "",
        parentesco: patientData.parentesco || "",
        celular_responsable: patientData.celularResponsable || "",
        telefono_responsable: patientData.telefonoResponsable || "",
        email_responsable: patientData.emailResponsable || "",
        // Acompañante
        nombre_acompanante: patientData.nombreAcompanante || "",
        telefono_acompanante: patientData.telefonoAcompanante || "",
        // Alertas y notas
        alertas: patientData.alertas || "",
        notas: patientData.notas || "",
        // Foto
        foto_url: fotoUrl || patientData.fotoUrl || "",
        // Metadata
        historial_medico: patientData.historialMedico || patientData.historial_medico || {},
        contacto_emergencia: patientData.contactoEmergencia || patientData.contacto_emergencia || {},
        activo: patientData.activo ?? true,
        updated_at: new Date().toISOString()
    };

    console.log("📦 Payload para Supabase:", payload);

    let resultData;
    if (patientData.id && !isNew) {
        // Actualización por ID
        console.log("🔄 Actualizando paciente existente ID:", patientData.id);
        const { data, error } = await supabase
            .from("pacientes")
            .update(payload)
            .eq("id", patientData.id)
            .select()
            .single();

        if (error) {
            console.error("❌ Error actualizando en Supabase:", error);
            throw error;
        }
        resultData = data;
        console.log("✅ Paciente actualizado en Supabase:", resultData);
    } else {
        // Inserción de nuevo paciente
        console.log("➕ Insertando nuevo paciente");
        const { data, error } = await supabase
            .from("pacientes")
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error("❌ Error insertando en Supabase:", error);
            throw error;
        }
        resultData = data;
        console.log("✅ Nuevo paciente creado en Supabase:", resultData);
    }

    return {
        ...resultData,
        tipoDocumento: resultData.tipo_documento || resultData.tipoDocumento || "CC",
        tipo_documento: resultData.tipo_documento || resultData.tipoDocumento || "CC",
        nroDocumento: resultData.documento || resultData.nroDocumento || "",
        documento: resultData.documento || resultData.nroDocumento || "",
        nombreCompleto: `${resultData.nombres || ""} ${resultData.apellidos || ""}`.trim() || resultData.nombreCompleto || "",
        celular: resultData.telefono || resultData.celular || "",
        telefono: resultData.telefono || resultData.celular || "",
        fechaNacimiento: resultData.fecha_nacimiento || resultData.fechaNacimiento || "",
        fecha_nacimiento: resultData.fecha_nacimiento || resultData.fechaNacimiento || "",
        sexo: resultData.genero || resultData.sexo || "No especificado",
        genero: resultData.genero || resultData.sexo || "No especificado",
        lugarResidencia: resultData.direccion || resultData.lugarResidencia || "",
        ciudadDomicilio: resultData.ciudad || resultData.ciudadDomicilio || "",
        nombreEps: resultData.eps || resultData.nombreEps || "",
        tipoVinculacion: resultData.tipo_afiliacion || resultData.tipoVinculacion || "",
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
