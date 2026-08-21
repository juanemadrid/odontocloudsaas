import supabase from "../lib/supabaseClient";

/** Normaliza un numero a formato internacional sin el signo +. */
function normalizePhone(raw = "") {
    let phone = String(raw).replace(/\D/g, "");
    if (phone.startsWith("0")) phone = phone.slice(1);
    if (phone.length === 10 && !phone.startsWith("57")) phone = "57" + phone;
    return phone;
}

const simulateSend = (phone, type, payload) => {
    console.log(`[WhatsApp SIMULADO] -> ${type} a ${phone}`, payload);
    return Promise.resolve({ success: true, simulated: true, to: phone });
};

const invokeWhatsApp = async (action, payload = {}) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action, ...payload }
    });
    if (error) {
        let message = error.message || "No fue posible contactar WhatsApp.";
        try {
            const details = await error.context?.json();
            message = details?.error || message;
        } catch {
            // La respuesta no siempre contiene JSON.
        }
        throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "WhatsApp rechazo la operacion.");
    return data;
};

export const getWhatsAppStatus = async () => {
    try {
        const data = await invokeWhatsApp("status");
        return data.configured === true;
    } catch {
        return false;
    }
};

/**
 * Obtiene el nombre real de la clínica de la sesión actual
 */
export function getActiveClinicName(fallback = "") {
    if (fallback && fallback !== "Clínica Dental" && fallback !== "OdontoCloud" && fallback !== "Clínica") {
        return fallback;
    }

    try {
        // 1. Buscar en perfiles de sesión activa
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith("oc_user_profile_")) {
                const profile = JSON.parse(sessionStorage.getItem(key) || "{}");
                const name = profile.tenant?.nombreComercial || 
                             profile.tenant?.nombre || 
                             profile.tenantNombre || 
                             profile.clinica;
                if (name && name !== "Clínica Dental") return name;
            }
        }
    } catch (e) {}

    try {
        // 2. Buscar en sesión de respaldo odc_session
        const session = JSON.parse(localStorage.getItem("odc_session") || "{}");
        if (session.tenantName && session.tenantName !== "Clínica Dental") return session.tenantName;
        if (session.clinica && session.clinica !== "Clínica Dental") return session.clinica;
    } catch (e) {}

    return fallback || "Clínica Odontológica";
}

export async function sendConfirmacion(cita, clinicName = "") {
    const phone = cita.celularPaciente || cita.telefono || cita.celular || "";
    const activeClinic = getActiveClinicName(clinicName || cita.clinicName || cita.clinica);
    const details = {
        name: cita.pacienteNombre || cita.patientName || cita.nombrePaciente || cita.nombreCompleto || cita.paciente || "Paciente",
        date: cita.dateStr || cita.fecha || cita.fechaStr || "-",
        time: cita.timeStr || cita.horaInicio || cita.hora || "-",
        doctor: cita.doctorName || cita.doctor || cita.doctorDisplayName || cita.dentista || "su Odontólogo Tratante",
        clinic: activeClinic
    };
    try {
        return await invokeWhatsApp("send_confirmation", { to: phone, details });
    } catch (error) {
        if (import.meta.env.DEV) return simulateSend(phone, "CONFIRMACION", details);
        throw error;
    }
}

export async function sendRecordatorio(cita, clinicName = "") {
    const phone = cita.celularPaciente || cita.telefono || cita.celular || "";
    const activeClinic = getActiveClinicName(clinicName || cita.clinicName || cita.clinica);
    const details = {
        name: cita.pacienteNombre || cita.patientName || cita.nombrePaciente || cita.nombreCompleto || cita.paciente || "Paciente",
        date: cita.dateStr || cita.fecha || cita.fechaStr || "-",
        time: cita.timeStr || cita.horaInicio || cita.hora || "-",
        clinic: activeClinic
    };
    try {
        return await invokeWhatsApp("send_reminder", { to: phone, details });
    } catch (error) {
        if (import.meta.env.DEV) return simulateSend(phone, "RECORDATORIO", details);
        throw error;
    }
}

export async function sendTextMessage(toRaw, message) {
    try {
        return await invokeWhatsApp("send_text", { to: toRaw, message });
    } catch (error) {
        if (import.meta.env.DEV) return simulateSend(toRaw, "TEXT", { message });
        throw error;
    }
}

// Mantener compatibilidad con el nombre antiguo
export const sendConfirmation = sendConfirmacion;

/**
 * Abre directamente WhatsApp Web o App móvil con un mensaje de recordatorio de cita prellenado
 * y adaptado al nombre real de la clínica con la que se inició sesión.
 */
export function openWhatsAppWebDirect(cita = {}, clinicName = "") {
    const rawPhone = (
        cita.phone || cita.celular || cita.telefono || cita.celularPaciente || 
        cita.telefonoPaciente || cita.pacienteCelular || cita.pacienteTelefono || 
        cita.mobile || ""
    ).toString().trim();
    
    const phone = normalizePhone(rawPhone);
    const nombre = cita.patientName || cita.pacienteNombre || cita.nombrePaciente || 
                   cita.nombreCompleto || cita.nombre || cita.paciente || "Paciente";
    
    let fechaStr = "—";
    if (cita.dateStr) {
        fechaStr = cita.dateStr;
    } else if (cita.fechaStr) {
        fechaStr = cita.fechaStr;
    } else if (cita.start) {
        const d = cita.start instanceof Date ? cita.start : new Date(cita.start);
        if (!isNaN(d.getTime())) {
            fechaStr = d.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        } else if (cita.fecha) {
            fechaStr = cita.fecha;
        }
    } else if (cita.fecha) {
        fechaStr = cita.fecha;
    }

    let horaStr = "—";
    if (cita.timeStr) {
        horaStr = cita.timeStr;
    } else if (cita.horaStr) {
        horaStr = cita.horaStr;
    } else if (cita.start) {
        const d = cita.start instanceof Date ? cita.start : new Date(cita.start);
        if (!isNaN(d.getTime())) {
            horaStr = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
        } else if (cita.horaInicio || cita.hora) {
            horaStr = cita.horaInicio || cita.hora;
        }
    } else if (cita.horaInicio || cita.hora) {
        horaStr = cita.horaInicio || cita.hora;
    }

    const doctor = cita.doctorName || cita.doctorDisplayName || cita.doctor || 
                   cita.profesional || cita.dentista || "su Odontólogo Tratante";

    // Nombre dinámico adaptado a la clínica en sesión
    const resolvedClinicName = getActiveClinicName(
        clinicName || cita.clinicName || cita.clinica || cita.tenantNombre || cita.tenantName || ""
    );

    const textMessage = `Hola *${nombre}*, te saludamos de *${resolvedClinicName}*.\n\nTe recordamos tu cita odontológica programada:\n\n• *Fecha:* ${fechaStr}\n• *Hora:* ${horaStr}\n• *Profesional:* ${doctor}\n\nPor favor responde a este mensaje confirmando tu asistencia. ¡Te esperamos!`;

    const encodedText = encodeURIComponent(textMessage);
    const waUrl = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}` : `https://api.whatsapp.com/send?text=${encodedText}`;
    
    const win = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = waUrl;
    }
}
