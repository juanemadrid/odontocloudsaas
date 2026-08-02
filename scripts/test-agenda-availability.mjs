import assert from "node:assert/strict";
import { calculateWorkingIntervals, generateAvailableSlots, normalizeScheduleRow, parseTimeToMinutes } from "../src/services/agendaAvailabilityRules.mjs";

const row = (values) => normalizeScheduleRow({ activo: true, ...values });
const base = {
  professionalWeekly: [row({ usuario_id: "doctor-1", dia: "Lunes", hora_inicio: "08:00", hora_fin: "12:00" })],
  professionalOpen: [], professionalBlocked: [],
  roomWeekly: [row({ consultorio_id: "room-1", dia: "Lunes", hora_inicio: "10:00", hora_fin: "14:00" })],
  roomOpen: [], roomBlocked: [],
  busyAppointments: [],
};
const monday = "2026-08-03";

assert.equal(parseTimeToMinutes("12:00 AM"), 0);
assert.equal(parseTimeToMinutes("1:30 PM"), 810);
assert.equal(parseTimeToMinutes("25:00"), null);
assert.deepEqual(calculateWorkingIntervals({ date: monday, roomId: "room-1", schedules: base }).intervals, [{ start: 600, end: 720 }]);
assert.equal(calculateWorkingIntervals({ date: monday, roomId: "room-1", schedules: { ...base, roomWeekly: [] } }).code, "ROOM_SCHEDULE_REQUIRED");
assert.equal(calculateWorkingIntervals({ date: monday, roomId: "room-1", schedules: { ...base, professionalWeekly: [] } }).code, "PROFESSIONAL_SCHEDULE_REQUIRED");

const blocked = {
  ...base,
  professionalBlocked: [row({ usuario_id: "doctor-1", fecha: monday, hora_inicio: "10:30", hora_fin: "11:00" })],
};
assert.deepEqual(calculateWorkingIntervals({ date: monday, roomId: "room-1", schedules: blocked }).intervals, [
  { start: 600, end: 630 }, { start: 660, end: 720 },
]);
assert.deepEqual(generateAvailableSlots({ date: monday, roomId: "room-1", durationMinutes: 30, schedules: blocked }).slots, ["10:00", "11:00", "11:30"]);

const withAppointments = {
  ...base,
  busyAppointments: [
    { fecha_inicio: "2026-08-03T10:30:00-05:00", fecha_fin: "2026-08-03T11:00:00-05:00", estado: "CONFIRMADA" },
    { fecha_inicio: "2026-08-03T11:30:00-05:00", fecha_fin: "2026-08-03T12:00:00-05:00", estado: "CANCELADA" },
  ],
};
assert.deepEqual(
  generateAvailableSlots({ date: monday, roomId: "room-1", durationMinutes: 30, schedules: withAppointments }).slots,
  ["10:00", "11:00", "11:30"],
);

const exception = {
  ...base,
  professionalOpen: [row({ usuario_id: "doctor-1", fecha: monday, hora_inicio: "13:00", hora_fin: "15:00" })],
  roomOpen: [row({ consultorio_id: "room-1", fecha: monday, hora_inicio: "14:00", hora_fin: "16:00" })],
};
assert.deepEqual(calculateWorkingIntervals({ date: monday, roomId: "room-1", schedules: exception }).intervals, [{ start: 840, end: 900 }]);

const otherRoomOnly = {
  ...base,
  professionalWeekly: [row({ usuario_id: "doctor-1", consultorio_id: "room-2", dia: "Lunes", hora_inicio: "08:00", hora_fin: "12:00" })],
};
assert.equal(calculateWorkingIntervals({ date: monday, roomId: "room-1", schedules: otherRoomOnly }).code, "NO_COMMON_AVAILABILITY");

console.log("Agenda availability tests passed (strict professional + room intersection)." );