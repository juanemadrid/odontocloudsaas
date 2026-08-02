import supabase from "../lib/supabaseClient";
import {
  calculateWorkingIntervals,
  generateAvailableSlots,
  normalizeAgendaText,
  normalizeScheduleRow,
  parseTimeToMinutes,
} from "./agendaAvailabilityRules.mjs";

export { calculateWorkingIntervals, generateAvailableSlots, normalizeScheduleRow, parseTimeToMinutes };

const cancelledStates = new Set(["cancelada", "cancelado", "cancelled"]);
const uniqueRows = (rows) => {
  const seen = new Map();
  rows.map(normalizeScheduleRow).forEach((row) => {
    const key = row.id || [row.professionalId, row.roomId, row.day, row.date, row.startTime, row.endTime].join("|");
    seen.set(key, row);
  });
  return [...seen.values()];
};

const queryScheduleRows = async (table, tenantId, column, entityId) => {
  const { data, error } = await supabase.from(table).select("*").eq("tenant_id", tenantId).eq(column, entityId);
  if (error) throw new Error(`No fue posible consultar ${table}: ${error.message}`);
  return uniqueRows(data || []);
};

const queryBusyAppointments = async ({ tenantId, professionalId, roomId, start, end, excludeId = null }) => {
  let query = supabase.from("citas")
    .select("id, profesional_id, consultorio_id, fecha_inicio, fecha_fin, estado")
    .eq("tenant_id", tenantId)
    .lt("fecha_inicio", end.toISOString())
    .gt("fecha_fin", start.toISOString())
    .or(`profesional_id.eq.${professionalId},consultorio_id.eq.${roomId}`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw new Error(`No fue posible consultar las citas ocupadas: ${error.message}`);
  return (data || []).filter((row) => !cancelledStates.has(normalizeAgendaText(row.estado)));
};

export const loadSchedules = async ({ tenantId, professionalId, roomId, rangeStart = null, rangeEnd = null, excludeId = null }) => {
  if (!tenantId || !professionalId || !roomId) throw new Error("Clínica, profesional y consultorio son obligatorios.");
  const [professionalWeekly, professionalOpen, professionalBlocked, roomWeekly, roomOpen, roomBlocked, busyAppointments] = await Promise.all([
    queryScheduleRows("horarios_predefinidos", tenantId, "usuario_id", professionalId),
    queryScheduleRows("agenda_abierta", tenantId, "usuario_id", professionalId),
    queryScheduleRows("no_disponibles", tenantId, "usuario_id", professionalId),
    queryScheduleRows("horarios_predefinidos", tenantId, "consultorio_id", roomId),
    queryScheduleRows("agenda_abierta", tenantId, "consultorio_id", roomId),
    queryScheduleRows("no_disponibles", tenantId, "consultorio_id", roomId),
    rangeStart && rangeEnd
      ? queryBusyAppointments({ tenantId, professionalId, roomId, start: new Date(rangeStart), end: new Date(rangeEnd), excludeId })
      : Promise.resolve([]),
  ]);
  return {
    professionalWeekly,
    professionalOpen,
    professionalBlocked,
    roomWeekly: roomWeekly.filter((row) => !row.professionalId),
    roomOpen: roomOpen.filter((row) => !row.professionalId),
    roomBlocked: roomBlocked.filter((row) => !row.professionalId),
    busyAppointments,
  };
};

const missingAvailabilityRpcCodes = new Set(["PGRST202", "42883"]);

const validateWithDatabase = async ({ tenantId, professionalId, roomId, start, end, excludeId }) => {
  const { data, error } = await supabase.rpc("check_appointment_availability", {
    p_tenant_id: tenantId,
    p_professional_id: professionalId,
    p_room_id: roomId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_exclude_id: excludeId || null,
  });

  if (error) {
    if (missingAvailabilityRpcCodes.has(error.code)) {
      return null;
    }
    const validationError = new Error(`No fue posible validar la disponibilidad: ${error.message}`);
    validationError.code = error.code;
    throw validationError;
  }

  return data && typeof data === "object" ? data : null;
};

const findConflicts = (input) => queryBusyAppointments(input);

export const validateAppointmentAvailability = async ({ tenantId, professionalId, roomId, start, end, excludeId = null, schedules: suppliedSchedules = null, checkConflicts = true }) => {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (!tenantId || !professionalId || !roomId) return { ok: false, code: "REQUIRED_ASSIGNMENT", message: "Debe seleccionar un profesional y un consultorio." };
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) return { ok: false, code: "INVALID_RANGE", message: "El horario de inicio y fin de la cita no es válido." };
  if (startDate.toDateString() !== endDate.toDateString()) return { ok: false, code: "CROSS_DAY_APPOINTMENT", message: "La cita debe iniciar y terminar el mismo día." };

  // La función SQL comparte reglas con el trigger que protege INSERT/UPDATE.
  // El cálculo local se conserva como compatibilidad mientras se despliega la migración.
  if (!suppliedSchedules && checkConflicts) {
    const databaseResult = await validateWithDatabase({
      tenantId,
      professionalId,
      roomId,
      start: startDate,
      end: endDate,
      excludeId,
    });
    if (databaseResult) return databaseResult;
  }

  const schedules = suppliedSchedules || await loadSchedules({ tenantId, professionalId, roomId });
  const availability = calculateWorkingIntervals({ date: startDate, roomId, schedules });
  if (!availability.ok) return availability;
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  if (!availability.intervals.some((interval) => startMinutes >= interval.start && endMinutes <= interval.end)) {
    return { ok: false, code: "OUTSIDE_COMMON_SCHEDULE", message: "La cita debe quedar completamente dentro del horario coincidente del profesional y el consultorio.", intervals: availability.intervals };
  }
  if (checkConflicts) {
    const conflicts = await findConflicts({ tenantId, professionalId, roomId, start: startDate, end: endDate, excludeId });
    if (conflicts.some((row) => String(row.profesional_id) === String(professionalId))) return { ok: false, code: "PROFESSIONAL_CONFLICT", message: "El profesional ya tiene una cita que se cruza con este horario." };
    if (conflicts.some((row) => String(row.consultorio_id) === String(roomId))) return { ok: false, code: "ROOM_CONFLICT", message: "El consultorio ya está ocupado por otra cita en este horario." };
  }
  return availability;
};

export const assertAppointmentAvailability = async (input) => {
  const result = await validateAppointmentAvailability(input);
  if (!result.ok) {
    const error = new Error(result.message);
    error.code = result.code;
    throw error;
  }
  return result;
};