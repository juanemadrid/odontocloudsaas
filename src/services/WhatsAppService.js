/**
 * WhatsAppService.js
 * Envío real de mensajes via WhatsApp Business API (Meta Graph API).
 * Configuración en .env:
 *   VITE_WA_TOKEN      → Bearer token permanente de WhatsApp Business
 *   VITE_WA_PHONE_ID   → Phone Number ID de la cuenta de WA Business
 *   VITE_WA_TEMPLATE_CONFIRMACION  → Nombre del template de confirmación (ej: "cita_confirmacion")
 *   VITE_WA_TEMPLATE_RECORDATORIO  → Nombre del template de recordatorio (ej: "cita_recordatorio")
 *
 * Si las variables no están configuradas, el servicio cae en modo simulación
 * para no romper el flujo en desarrollo.
 */

const WA_TOKEN    = import.meta.env.VITE_WA_TOKEN    || "";
const WA_PHONE_ID = import.meta.env.VITE_WA_PHONE_ID || "";
const WA_API_URL  = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`;

const TEMPLATE_CONFIRMACION = import.meta.env.VITE_WA_TEMPLATE_CONFIRMACION || "cita_confirmacion";
const TEMPLATE_RECORDATORIO = import.meta.env.VITE_WA_TEMPLATE_RECORDATORIO || "cita_recordatorio";

/** Normaliza un número de teléfono a formato internacional sin el '+' */
function normalizePhone(raw = "") {
    let phone = raw.replace(/\D/g, ""); // quitar todo lo que no sea dígito
    if (phone.startsWith("0")) phone = phone.slice(1);
    if (phone.length === 10 && !phone.startsWith("57")) {
        phone = "57" + phone; // asumir Colombia si no tiene indicativo
    }
    return phone;
}

/** Envía un mensaje usando la Meta Graph API */
async function sendViaMetaAPI(toRaw, templateName, components = []) {
    const to = normalizePhone(toRaw);
    if (to.length < 10) throw new Error(`Número inválido: "${toRaw}"`);

    const body = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
            name: templateName,
            language: { code: "es_CO" },
            components
        }
    };

    const response = await fetch(WA_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WA_TOKEN}`
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        throw new Error(`WhatsApp API error: ${errMsg}`);
    }

    return { success: true, messageId: data.messages?.[0]?.id, to };
}

/** Simulación para desarrollo (cuando no hay credenciales) */
function simulateSend(phone, type, payload) {
    console.log(`[WhatsApp SIMULADO] → ${type} a ${phone}`, payload);
    return new Promise(resolve =>
        setTimeout(() => resolve({ success: true, simulated: true, to: phone }), 800)
    );
}

const isConfigured = () => WA_TOKEN && WA_PHONE_ID;

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envía confirmación de cita agendada.
 * Template esperado: variables {{1}}=nombre, {{2}}=fecha, {{3}}=hora, {{4}}=doctor
 */
export async function sendConfirmacion(cita) {
    const phone = cita.celularPaciente || cita.telefono || cita.celular || "";
    const nombre = cita.pacienteNombre || cita.nombrePaciente || "Paciente";
    const fecha  = cita.fecha || cita.fechaStr || "—";
    const hora   = cita.horaInicio || cita.hora || "—";
    const doctor = cita.doctorName || cita.dentista || "su odontólogo";

    if (!isConfigured()) {
        return simulateSend(phone, "CONFIRMACION", { nombre, fecha, hora });
    }

    const components = [{
        type: "body",
        parameters: [
            { type: "text", text: nombre },
            { type: "text", text: fecha },
            { type: "text", text: hora },
            { type: "text", text: doctor }
        ]
    }];

    return sendViaMetaAPI(phone, TEMPLATE_CONFIRMACION, components);
}

/**
 * Envía recordatorio de cita (llamar 24h antes).
 * Template esperado: variables {{1}}=nombre, {{2}}=fecha, {{3}}=hora
 */
export async function sendRecordatorio(cita) {
    const phone = cita.celularPaciente || cita.telefono || cita.celular || "";
    const nombre = cita.pacienteNombre || cita.nombrePaciente || "Paciente";
    const fecha  = cita.fecha || cita.fechaStr || "—";
    const hora   = cita.horaInicio || cita.hora || "—";

    if (!isConfigured()) {
        return simulateSend(phone, "RECORDATORIO", { nombre, fecha, hora });
    }

    const components = [{
        type: "body",
        parameters: [
            { type: "text", text: nombre },
            { type: "text", text: fecha },
            { type: "text", text: hora }
        ]
    }];

    return sendViaMetaAPI(phone, TEMPLATE_RECORDATORIO, components);
}

/**
 * Envía mensaje de texto libre (solo funciona con números en "sandbox" o aprobados).
 * Útil para responder a conversaciones iniciadas por el paciente en las últimas 24h.
 */
export async function sendTextMessage(toRaw, message) {
    const to = normalizePhone(toRaw);
    if (!isConfigured()) {
        return simulateSend(to, "TEXT", { message });
    }

    const body = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message }
    };

    const response = await fetch(WA_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WA_TOKEN}`
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || `HTTP ${response.status}`);
    }

    return { success: true, messageId: data.messages?.[0]?.id, to };
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

