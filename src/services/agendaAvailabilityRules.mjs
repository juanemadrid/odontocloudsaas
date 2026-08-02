const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const CLINIC_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const normalizeAgendaText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

export const parseTimeToMinutes = (value) => {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  const match12 = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    let hours = Number(match12[1]);
    const minutes = Number(match12[2]);
    if (minutes > 59 || hours < 1 || hours > 12) return null;
    const suffix = match12[3].toUpperCase();
    if (suffix === "PM" && hours < 12) hours += 12;
    if (suffix === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const match24 = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match24) return null;
  const hours = Number(match24[1]);
  const minutes = Number(match24[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
};

export const normalizeScheduleRow = (row = {}) => ({
  ...row,
  tenantId: row.tenant_id || row.tenantId,
  professionalId: row.usuario_id || row.professionalId || null,
  roomId: row.consultorio_id || row.roomId || row.recursoId || null,
  day: row.dia || row.day || null,
  date: row.fecha || row.date || null,
  startTime: row.hora_inicio || row.horaInicio || row.startTime || null,
  endTime: row.hora_fin || row.horaFin || row.endTime || null,
  active: row.activo ?? row.active ?? true,
});

const toInterval = (row) => {
  const start = parseTimeToMinutes(row.startTime);
  const end = parseTimeToMinutes(row.endTime);
  return start != null && end != null && start < end ? { start, end } : null;
};

const intervalsForDate = ({ weekly, open, dateString, dayName, roomId, professional }) => {
  const applicable = (row) => !professional || !row.roomId || String(row.roomId) === String(roomId);
  const activeOpen = open.filter((row) => row.active && row.date === dateString && applicable(row));
  const source = activeOpen.length ? activeOpen : weekly.filter((row) => (
    row.active && applicable(row) && normalizeAgendaText(row.day) === normalizeAgendaText(dayName)
  ));
  return source.map(toInterval).filter(Boolean);
};

const intersectIntervals = (left, right) => left.flatMap((a) => right.map((b) => ({
  start: Math.max(a.start, b.start),
  end: Math.min(a.end, b.end),
})).filter((interval) => interval.start < interval.end));

const subtractIntervals = (intervals, blocked) => blocked.reduce((current, block) => current.flatMap((interval) => {
  if (block.end <= interval.start || block.start >= interval.end) return [interval];
  const pieces = [];
  if (block.start > interval.start) pieces.push({ start: interval.start, end: block.start });
  if (block.end < interval.end) pieces.push({ start: block.end, end: interval.end });
  return pieces;
}), intervals);

const emptySchedules = {
  professionalWeekly: [], professionalOpen: [], professionalBlocked: [],
  roomWeekly: [], roomOpen: [], roomBlocked: [], busyAppointments: [],
};

export const calculateWorkingIntervals = ({ date, roomId, schedules = emptySchedules }) => {
  const data = { ...emptySchedules, ...schedules };
  const dateObject = date instanceof Date ? date : new Date(`${date}T00:00:00`);
  if (Number.isNaN(dateObject.getTime())) throw new Error("Fecha inválida para calcular disponibilidad.");
  const dateString = `${dateObject.getFullYear()}-${String(dateObject.getMonth() + 1).padStart(2, "0")}-${String(dateObject.getDate()).padStart(2, "0")}`;
  const dayName = DAY_NAMES[dateObject.getDay()];
  const professionalConfigured = data.professionalWeekly.some((row) => row.active) || data.professionalOpen.some((row) => row.active);
  const roomConfigured = data.roomWeekly.some((row) => row.active) || data.roomOpen.some((row) => row.active);
  if (!professionalConfigured) return { ok: false, code: "PROFESSIONAL_SCHEDULE_REQUIRED", message: "El profesional no tiene un horario de atención configurado.", intervals: [] };
  if (!roomConfigured) return { ok: false, code: "ROOM_SCHEDULE_REQUIRED", message: "El consultorio no tiene un horario de atención configurado.", intervals: [] };

  const professionalIntervals = intervalsForDate({ weekly: data.professionalWeekly, open: data.professionalOpen, dateString, dayName, roomId, professional: true });
  const roomIntervals = intervalsForDate({ weekly: data.roomWeekly, open: data.roomOpen, dateString, dayName, roomId, professional: false });
  const blocked = [...data.professionalBlocked, ...data.roomBlocked]
    .filter((row) => row.active && row.date === dateString && (
      (row.professionalId && (!row.roomId || String(row.roomId) === String(roomId)))
      || (!row.professionalId && String(row.roomId) === String(roomId))
    ))
    .map(toInterval)
    .filter(Boolean);
  const intervals = subtractIntervals(intersectIntervals(professionalIntervals, roomIntervals), blocked);
  if (!intervals.length) return { ok: false, code: "NO_COMMON_AVAILABILITY", message: "El profesional y el consultorio no tienen disponibilidad coincidente para esta fecha.", intervals: [] };
  return { ok: true, code: "AVAILABLE", message: "Horario disponible.", intervals };
};

const busyIntervalsForDate = (appointments, dateString) => appointments
  .filter((appointment) => !["cancelada", "cancelado", "cancelled"].includes(normalizeAgendaText(appointment.estado || appointment.status)))
  .map((appointment) => {
    const startDate = new Date(appointment.fecha_inicio || appointment.start);
    const endDate = new Date(appointment.fecha_fin || appointment.end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    const start = Object.fromEntries(CLINIC_DATE_TIME_FORMATTER.formatToParts(startDate).map(({ type, value }) => [type, value]));
    const end = Object.fromEntries(CLINIC_DATE_TIME_FORMATTER.formatToParts(endDate).map(({ type, value }) => [type, value]));
    const appointmentDate = `${start.year}-${start.month}-${start.day}`;
    if (appointmentDate !== dateString) return null;
    return {
      start: Number(start.hour) * 60 + Number(start.minute),
      end: Number(end.hour) * 60 + Number(end.minute),
    };
  })
  .filter((interval) => interval && interval.start < interval.end);

export const generateAvailableSlots = ({ date, roomId, durationMinutes = 30, schedules }) => {
  const availability = calculateWorkingIntervals({ date, roomId, schedules });
  if (!availability.ok) return { ...availability, slots: [] };
  const duration = Math.max(5, Number(durationMinutes) || 30);
  const dateObject = date instanceof Date ? date : new Date(`${date}T00:00:00`);
  const dateString = `${dateObject.getFullYear()}-${String(dateObject.getMonth() + 1).padStart(2, "0")}-${String(dateObject.getDate()).padStart(2, "0")}`;
  const busy = busyIntervalsForDate(schedules?.busyAppointments || [], dateString);
  const slots = availability.intervals.flatMap((interval) => {
    const values = [];
    for (let minute = interval.start; minute + duration <= interval.end; minute += duration) {
      if (!busy.some((appointment) => minute < appointment.end && minute + duration > appointment.start)) {
        values.push(`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
      }
    }
    return values;
  });
  return { ...availability, slots };
};