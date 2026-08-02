// src/services/appointmentService.js
import supabase from "../lib/supabaseClient";
import { assertAppointmentAvailability } from "./agendaAvailabilityService";

/**
 * Subscribe to appointments for a given date or range using Supabase Realtime & Queries
 */
export const subscribeToAppointments = (tenantId, date, viewType, callback) => {
    if (!tenantId) {
        callback([]);
        return () => {};
    }

    const d = new Date(date);
    let start, end;

    if (viewType === 'month') {
        start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0).toISOString();
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    } else {
        const s = new Date(d);
        s.setHours(0, 0, 0, 0);
        const e = new Date(d);
        e.setHours(23, 59, 59, 999);
        start = s.toISOString();
        end = e.toISOString();
    }

    // Fetch initial appointments
    const fetchAppointments = async () => {
        try {
            const { data, error } = await supabase
                .from("citas")
                .select("*, paciente:pacientes(nombres, apellidos, documento, telefono)")
                .eq("tenant_id", tenantId)
                .gte("fecha_inicio", start)
                .lte("fecha_inicio", end);

            if (error) throw error;

            const appointments = (data || []).map(c => ({
                id: c.id,
                ...c,
                doctorId: c.profesional_id,
                patientId: c.paciente_id,
                paciente: c.paciente ? `${c.paciente.nombres} ${c.paciente.apellidos}` : c.motivo,
                celular: c.paciente?.telefono || "",
                start: new Date(c.fecha_inicio),
                end: new Date(c.fecha_fin),
                status: c.estado
            }));

            callback(appointments);
        } catch (err) {
            console.error("Error al obtener citas de Supabase:", err);
            callback([]);
        }
    };

    fetchAppointments();

    // Supabase Realtime Subscription
    const channel = supabase
        .channel(`citas-realtime-${tenantId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'citas', filter: `tenant_id=eq.${tenantId}` },
            () => {
                fetchAppointments();
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

export const checkConflict = async (tenantId, doctorId, start, end, excludeId = null) => {
    if (!tenantId || !doctorId) return false;

    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(23, 59, 59, 999);

    try {
        let query = supabase
            .from("citas")
            .select("id, fecha_inicio, fecha_fin")
            .eq("tenant_id", tenantId)
            .eq("profesional_id", doctorId)
            .gte("fecha_inicio", dayStart.toISOString())
            .lte("fecha_inicio", dayEnd.toISOString());

        if (excludeId) {
            query = query.neq("id", excludeId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const newStart = new Date(start).getTime();
        const newEnd = new Date(end).getTime();

        return (data || []).some(c => {
            const existingStart = new Date(c.fecha_inicio).getTime();
            const existingEnd = new Date(c.fecha_fin).getTime();
            return newStart < existingEnd && newEnd > existingStart;
        });
    } catch (e) {
        console.error("Error en checkConflict:", e);
        return false;
    }
};

export const createAppointment = async (tenantId, appointmentData) => {
    if (!tenantId) throw new Error("Tenant ID requerido");
    const { doctorId, pacienteId, start, end, motivo, notas } = appointmentData;
    const roomId = appointmentData.roomId || appointmentData.consultorioId;

    if (!start || !end) throw new Error("Horario de inicio y fin requeridos");
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (startDate >= endDate) throw new Error("La hora de inicio debe ser anterior a la de fin");

    await assertAppointmentAvailability({
        tenantId,
        professionalId: doctorId,
        roomId,
        start: startDate,
        end: endDate,
    });

    const payload = {
        tenant_id: tenantId,
        paciente_id: pacienteId || null,
        profesional_id: doctorId || null,
        consultorio_id: roomId || null,
        fecha_inicio: startDate.toISOString(),
        fecha_fin: endDate.toISOString(),
        estado: appointmentData.status || "programada",
        motivo: motivo || "Consulta odontológica",
        notas: notas || ""
    };

    const { data, error } = await supabase
        .from("citas")
        .insert([payload])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        ...data,
        start: new Date(data.fecha_inicio),
        end: new Date(data.fecha_fin)
    };
};

export const updateAppointment = async (tenantId, id, appointmentData) => {
    if (!tenantId || !id) throw new Error("Tenant ID e ID de cita requeridos");

    const payload = {};
    if (appointmentData.doctorId !== undefined) payload.profesional_id = appointmentData.doctorId;
    if (appointmentData.pacienteId !== undefined) payload.paciente_id = appointmentData.pacienteId;
    if (appointmentData.roomId !== undefined || appointmentData.consultorioId !== undefined) payload.consultorio_id = appointmentData.roomId || appointmentData.consultorioId;
    if (appointmentData.start) payload.fecha_inicio = new Date(appointmentData.start).toISOString();
    if (appointmentData.end) payload.fecha_fin = new Date(appointmentData.end).toISOString();
    if (appointmentData.status || appointmentData.estado) payload.estado = appointmentData.status || appointmentData.estado;
    if (appointmentData.motivo !== undefined) payload.motivo = appointmentData.motivo;
    if (appointmentData.notas !== undefined) payload.notas = appointmentData.notas;

    const { data: current, error: currentError } = await supabase
        .from("citas")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .single();
    if (currentError) throw currentError;

    const nextStatus = String(payload.estado || current.estado || "").toLowerCase();
    const cancelled = ["cancelada", "cancelado", "cancelled"].includes(nextStatus);
    const schedulingChanged = ["doctorId", "roomId", "consultorioId", "start", "end"]
        .some((field) => Object.prototype.hasOwnProperty.call(appointmentData, field));
    if (schedulingChanged && !cancelled) {
        await assertAppointmentAvailability({
            tenantId,
            professionalId: payload.profesional_id || current.profesional_id,
            roomId: payload.consultorio_id || current.consultorio_id,
            start: payload.fecha_inicio || current.fecha_inicio,
            end: payload.fecha_fin || current.fecha_fin,
            excludeId: id,
        });
    }

    const { data, error } = await supabase
        .from("citas")
        .update(payload)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        ...data,
        start: new Date(data.fecha_inicio),
        end: new Date(data.fecha_fin)
    };
};

export const deleteAppointment = async (tenantId, id) => {
    if (!tenantId || !id) throw new Error("Tenant ID e ID de cita requeridos");
    const { error } = await supabase
        .from("citas")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", id);

    if (error) throw error;
};
