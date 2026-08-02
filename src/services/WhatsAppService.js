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

export async function sendConfirmacion(cita) {
    const phone = cita.celularPaciente || cita.telefono || cita.celular || "";
    const details = {
        name: cita.pacienteNombre || cita.nombrePaciente || "Paciente",
        date: cita.fecha || cita.fechaStr || "-",
        time: cita.horaInicio || cita.hora || "-",
        doctor: cita.doctorName || cita.dentista || "su odontologo"
    };
    try {
        return await invokeWhatsApp("send_confirmation", { to: phone, details });
    } catch (error) {
        if (import.meta.env.DEV) return simulateSend(phone, "CONFIRMACION", details);
        throw error;
    }
}

export async function sendRecordatorio(cita) {
    const phone = cita.celularPaciente || cita.telefono || cita.celular || "";
    const details = {
        name: cita.pacienteNombre || cita.nombrePaciente || "Paciente",
        date: cita.fecha || cita.fechaStr || "-",
        time: cita.horaInicio || cita.hora || "-"
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
 */
export function openWhatsAppWebDirect(cita, clinicName = "Clínica Dental") {
    const rawPhone = (cita.celular || cita.telefono || cita.celularPaciente || cita.telefonoPaciente || cita.pacienteCelular || cita.pacienteTelefono || cita.phone || cita.mobile || "").toString().trim();
    const phone = normalizePhone(rawPhone);
    const nombre = cita.pacienteNombre || cita.nombrePaciente || cita.nombreCompleto || cita.paciente || "Paciente";
    
    let fechaStr = "—";
    if (cita.start) {
        const d = cita.start instanceof Date ? cita.start : new Date(cita.start);
        fechaStr = d.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } else if (cita.fecha) {
        fechaStr = cita.fecha;
    }

    let horaStr = "—";
    if (cita.start) {
        const d = cita.start instanceof Date ? cita.start : new Date(cita.start);
        horaStr = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    } else if (cita.horaInicio || cita.hora) {
        horaStr = cita.horaInicio || cita.hora;
    }

    const doctor = cita.doctorName || cita.doctorDisplayName || cita.dentista || cita.doctor || "su Odontólogo Tratante";

    const textMessage = `Hola *${nombre}*, te saludamos de *${clinicName}*.\n\nTe recordamos tu cita odontológica programada:\n\n• *Fecha:* ${fechaStr}\n• *Hora:* ${horaStr}\n• *Profesional:* ${doctor}\n\nPor favor responde a este mensaje confirmando tu asistencia. ¡Te esperamos!`;

    const encodedText = encodeURIComponent(textMessage);
    const waUrl = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}` : `https://api.whatsapp.com/send?text=${encodedText}`;
    
    const win = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = waUrl;
    }
}

