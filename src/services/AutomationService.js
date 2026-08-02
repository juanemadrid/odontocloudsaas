/**
 * AutomationService.js
 * 
 * ⚠️ NOTA: Sistema de webhooks n8n NO SE UTILIZARÁ en esta implementación.
 * Este servicio se mantiene para compatibilidad pero está deshabilitado por defecto.
 * 
 * Cualquier reactivacion futura debe implementarse mediante una Edge Function autenticada.
 *
 * Eventos disponibles (documentados para referencia):
 *   APPOINTMENT_CREATED | APPOINTMENT_UPDATED | APPOINTMENT_CANCELLED
 *   PATIENT_CREATED | PATIENT_UPDATED
 *   INVOICE_CREATED | INVOICE_PAID
 *   TREATMENT_PLAN_CREATED | TREATMENT_PLAN_UPDATED
 *   EVOLUTION_SAVED | STOCK_LOW
 *   PATIENT_NO_VISIT_30_DAYS | PATIENT_NO_VISIT_60_DAYS
 */

const N8N_ENABLED = false; // Integracion retirada del cliente por seguridad.

// Catálogo de eventos con metadatos
export const AUTOMATION_EVENTS = {
    // Agenda
    APPOINTMENT_CREATED:   { name: "APPOINTMENT_CREATED",   description: "Cita creada" },
    APPOINTMENT_UPDATED:   { name: "APPOINTMENT_UPDATED",   description: "Cita actualizada" },
    APPOINTMENT_CANCELLED: { name: "APPOINTMENT_CANCELLED", description: "Cita cancelada" },
    // Pacientes
    PATIENT_CREATED:       { name: "PATIENT_CREATED",       description: "Paciente registrado" },
    PATIENT_UPDATED:       { name: "PATIENT_UPDATED",       description: "Paciente actualizado" },
    // Facturación
    INVOICE_CREATED:       { name: "INVOICE_CREATED",       description: "Factura creada" },
    INVOICE_PAID:          { name: "INVOICE_PAID",          description: "Factura pagada" },
    // Clínico
    TREATMENT_PLAN_CREATED: { name: "TREATMENT_PLAN_CREATED", description: "Plan de tratamiento creado" },
    TREATMENT_PLAN_UPDATED: { name: "TREATMENT_PLAN_UPDATED", description: "Plan de tratamiento actualizado" },
    EVOLUTION_SAVED:        { name: "EVOLUTION_SAVED",        description: "Evolución clínica guardada" },
    // Inventario
    STOCK_LOW:             { name: "STOCK_LOW",             description: "Producto bajo stock mínimo" },
    // Retención de pacientes
    PATIENT_NO_VISIT_30_DAYS: { name: "PATIENT_NO_VISIT_30_DAYS", description: "Paciente sin visitar en 30 días" },
    PATIENT_NO_VISIT_60_DAYS: { name: "PATIENT_NO_VISIT_60_DAYS", description: "Paciente sin visitar en 60 días" },
};

/**
 * Despacha un evento al webhook configurado.
 * @param {string} eventName - Nombre del evento (usar AUTOMATION_EVENTS)
 * @param {Object} payload   - Datos del evento
 * @param {string} [webhookUrl] - URL alternativa (opcional, sobreescribe la variable de entorno)
 */
export async function dispatchAutomationEvent(eventName, _payload, _webhookUrl = "") {
    console.log(`[AutomationService] Evento ${eventName} registrado (n8n deshabilitado)`);
    return { success: true, reason: "n8n_disabled", eventName };
}

/**
 * Envía múltiples eventos en paralelo (fire-and-forget seguro).
 */
export async function dispatchMultiple(events = []) {
    return Promise.allSettled(
        events.map(({ name, payload }) => dispatchAutomationEvent(name, payload))
    );
}
