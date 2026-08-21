// src/modules/pacientes/components/CitasTab.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
    FiCalendar, FiClock, FiUser, FiMapPin, FiPlus, FiSearch, FiPrinter, 
    FiDownload, FiEdit2, FiTrash2, FiMessageCircle, FiCheck, FiX, FiAlertCircle, FiLock
} from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { useAgenda } from "../../agenda/hooks/useAgenda";
import supabase from "../../../lib/supabaseClient";
import * as XLSX from "xlsx";
import AppointmentModal from "../../agenda/components/AppointmentModal";
import { openWhatsAppWebDirect, getActiveClinicName } from "../../../services/WhatsAppService";

export const normalizeStatus = (status) => {
    if (!status) return "programada";
    const s = String(status).toLowerCase().trim().replace(/[\s_-]+/g, "_");
    if (s.includes("cancel")) return "cancelada";
    if (s.includes("atend") || s.includes("complet")) return "atendida";
    if (s.includes("confirm")) return "confirmada";
    if (s.includes("sala") || s.includes("arrived") || s.includes("espera")) return "en_sala";
    if (s.includes("no_asist") || s.includes("no_show") || s.includes("inasist")) return "no_asistio";
    if (s.includes("prog") || s.includes("pend") || s.includes("sin_confirm")) return "programada";
    return s;
};

/**
 * Determina si una cita tiene más de 1 mes de antigüedad (cerrada / no modificable)
 */
export const isAppointmentLocked = (apt) => {
    if (!apt) return false;
    const rawDate = apt.fecha_inicio || apt.start || apt.fecha;
    if (!rawDate) return false;
    const aptDate = new Date(rawDate);
    if (isNaN(aptDate.getTime())) return false;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);

    return aptDate < oneMonthAgo;
};

const STATUS_COLORS = {
    programada: "bg-sky-50 text-sky-700 border-sky-200",
    confirmada: "bg-emerald-50 text-emerald-700 border-emerald-200",
    en_sala: "bg-purple-50 text-purple-700 border-purple-200",
    atendida: "bg-teal-50 text-teal-700 border-teal-200",
    cancelada: "bg-rose-50 text-rose-700 border-rose-200",
    no_asistio: "bg-amber-50 text-amber-700 border-amber-200"
};

const STATUS_LABELS = {
    programada: "Programada",
    confirmada: "Confirmada",
    en_sala: "En sala",
    atendida: "Atendida",
    cancelada: "Cancelada",
    no_asistio: "No asistió"
};

const STATUS_OPTIONS = [
    { value: "programada", label: "Programada" },
    { value: "confirmada", label: "Confirmada" },
    { value: "en_sala", label: "En sala" },
    { value: "atendida", label: "Atendida" },
    { value: "cancelada", label: "Cancelada" },
    { value: "no_asistio", label: "No asistió" }
];

export default function CitasTab({ patient }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    const { can } = usePermissions();
    const inquilino = userProfile?.inquilino || patient?.inquilino || patient?.tenant_id;

    // Catalogs and handlers synced with Agenda module
    const {
        doctors,
        chairs,
        branches,
        specialties,
        entities,
        priceList,
        createAppointment,
        updateAppointment,
        deleteAppointment
    } = useAgenda();

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingApt, setEditingApt] = useState(null);

    // Filter appointments matching this patient by all available criteria
    const filterAndSetAppointments = useCallback((citasList) => {
        const targetId = String(patient?.id || "").trim();
        const targetUid = String(patient?.uid || "").trim();
        const targetDoc = String(patient?.nroDocumento || patient?.documento || "").trim().toLowerCase();
        const targetName = String(patient?.nombreCompleto || `${patient?.nombres || ''} ${patient?.apellidos || ''}`).trim().toLowerCase();
        const targetPhone = String(patient?.celular || patient?.telefono || "").trim().replace(/\D/g, "");

        const matched = (citasList || []).filter(c => {
            // 1. Direct paciente_id match
            const cPacId = String(c.paciente_id || c.pacienteId || c.patientId || c.paciente?.id || "").trim();
            if (targetId && cPacId && (cPacId === targetId || targetId === cPacId)) return true;
            if (targetUid && cPacId && (cPacId === targetUid || targetUid === cPacId)) return true;

            // 2. Document match
            const cDoc = String(c.paciente?.documento || c.documento || c.nroDocumento || "").trim().toLowerCase();
            if (targetDoc && cDoc && (cDoc === targetDoc || cDoc.includes(targetDoc) || targetDoc.includes(cDoc))) return true;

            // 3. Phone match (if at least 7 digits)
            const cPhone = String(c.paciente?.telefono || c.celular || c.telefono || "").trim().replace(/\D/g, "");
            if (targetPhone && targetPhone.length >= 7 && cPhone && cPhone.length >= 7 && (cPhone === targetPhone || targetPhone.includes(cPhone) || cPhone.includes(targetPhone))) return true;

            // 4. Name match
            const cJoinedName = c.paciente ? `${c.paciente.nombres || ''} ${c.paciente.apellidos || ''}`.trim().toLowerCase() : "";
            const cDirectName = String(c.pacienteNombre || c.paciente || "").trim().toLowerCase();
            const cMotivo = String(c.motivo || "").trim().toLowerCase();
            const cNotas = String(c.notas || "").trim().toLowerCase();

            if (targetName && targetName.length >= 3) {
                if (cJoinedName && (cJoinedName === targetName || cJoinedName.includes(targetName) || targetName.includes(cJoinedName))) return true;
                if (cDirectName && (cDirectName === targetName || cDirectName.includes(targetName) || targetName.includes(cDirectName))) return true;
                if (cMotivo && cMotivo.includes(targetName)) return true;
                if (cNotas && cNotas.includes(targetName)) return true;
            }

            return false;
        });

        // Format dates into Date objects if needed and sort descending (newest / future first)
        matched.sort((a, b) => {
            const timeA = new Date(a.fecha_inicio || a.start || 0).getTime();
            const timeB = new Date(b.fecha_inicio || b.start || 0).getTime();
            return timeB - timeA;
        });

        setAppointments(matched);
    }, [patient]);

    // Fetch all appointments for the tenant from Supabase and filter for this patient
    const loadPatientAppointments = useCallback(async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            // First try with joined paciente
            const { data: allCitas, error: aptsError } = await supabase
                .from("citas")
                .select("*, paciente:pacientes(id, nombres, apellidos, documento, telefono)")
                .eq("tenant_id", inquilino)
                .order("fecha_inicio", { ascending: false });

            if (aptsError) {
                console.warn("Retrying citas fetch with simple select:", aptsError);
                const { data: simpleCitas } = await supabase
                    .from("citas")
                    .select("*")
                    .eq("tenant_id", inquilino)
                    .order("fecha_inicio", { ascending: false });

                if (simpleCitas) {
                    filterAndSetAppointments(simpleCitas);
                    return;
                }
            }

            if (allCitas) {
                filterAndSetAppointments(allCitas);
            } else {
                setAppointments([]);
            }
        } catch (err) {
            console.error("Error loading patient appointments:", err);
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    }, [inquilino, filterAndSetAppointments]);

    // Initial load + Realtime synchronization for appointments
    useEffect(() => {
        loadPatientAppointments();

        if (!inquilino) return;

        const channel = supabase
            .channel(`citas-patient-feed-${inquilino}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'citas',
                    filter: `tenant_id=eq.${inquilino}`
                },
                () => {
                    loadPatientAppointments();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [inquilino, loadPatientAppointments]);

    // Helpers to resolve names
    const getDoctorName = (apt) => {
        const docId = apt.profesional_id || apt.doctorId || apt.doctor_id;
        const doc = doctors.find(d => String(d.id) === String(docId));
        if (doc) {
            return doc.nombreCompleto || `${doc.nombre || ''} ${doc.apellido || ''}`.trim() || doc.nombre;
        }
        return apt.profesional_nombre || apt.doctor || apt.doctorName || "Profesional no asignado";
    };

    const getChairName = (apt) => {
        const chairId = apt.consultorio_id || apt.recurso_id || apt.consultorioId || apt.sillonId;
        const chair = chairs.find(c => String(c.id) === String(chairId));
        return chair?.nombre || chair?.name || apt.consultorio_nombre || (chairId ? `Consultorio ${chairId}` : "Consultorio General");
    };

    const getBranchName = (apt) => {
        const branchId = apt.sucursal_id || apt.sucursalId;
        const branch = branches.find(b => String(b.id) === String(branchId));
        return branch?.nombre || branch?.name || userProfile?.clinica || "Sede Principal";
    };

    // Filter appointments by search term
    const filteredAppointments = useMemo(() => {
        if (!searchTerm.trim()) return appointments;
        const q = searchTerm.toLowerCase();
        return appointments.filter(apt => {
            const doc = getDoctorName(apt).toLowerCase();
            const chair = getChairName(apt).toLowerCase();
            const branch = getBranchName(apt).toLowerCase();
            const motivo = (apt.motivo || "").toLowerCase();
            const notas = (apt.notas || "").toLowerCase();
            const estado = (apt.estado || "").toLowerCase();
            return doc.includes(q) || chair.includes(q) || branch.includes(q) || motivo.includes(q) || notas.includes(q) || estado.includes(q);
        });
    }, [appointments, searchTerm, doctors, chairs, branches]);

    // Update appointment status directly
    const handleStatusChange = async (apt, newStatus) => {
        if (isAppointmentLocked(apt)) {
            toast?.warning ? toast.warning("Esta cita tiene más de 1 mes de antigüedad y se encuentra cerrada.") : alert("Cita cerrada: no se puede cambiar el estado.");
            return;
        }
        try {
            await updateAppointment(apt.id, { status: newStatus, estado: newStatus });
            setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, estado: newStatus } : a));
            toast?.success ? toast.success("Estado de cita actualizado") : alert("Estado de cita actualizado");
        } catch (err) {
            console.error("Error updating status:", err);
            toast?.error ? toast.error("Error al actualizar estado: " + err.message) : alert("Error: " + err.message);
        }
    };

    // Delete appointment
    const handleDeleteApt = async (apt) => {
        if (isAppointmentLocked(apt)) {
            toast?.error ? toast.error("No es posible eliminar citas con más de 1 mes de antigüedad.") : alert("No se puede eliminar una cita cerrada.");
            return;
        }
        if (!window.confirm("¿Seguro que deseas eliminar esta cita del historial?")) return;
        try {
            await deleteAppointment(apt.id);
            setAppointments(prev => prev.filter(a => a.id !== apt.id));
            if (toast?.success) toast.success("Cita eliminada correctamente");
        } catch (err) {
            console.error("Error deleting appointment:", err);
            if (toast?.error) toast.error("Error al eliminar: " + err.message);
        }
    };

    // Export to Excel
    const handleExportExcel = () => {
        if (appointments.length === 0) return;
        try {
            const exportData = appointments.map(apt => {
                const start = new Date(apt.fecha_inicio || apt.start);
                const end = new Date(apt.fecha_fin || apt.end);
                const normStatus = normalizeStatus(apt.estado);
                return {
                    "FECHA": start.toLocaleDateString("es-CO"),
                    "HORA INICIO": start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    "HORA FIN": end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    "PROFESIONAL": getDoctorName(apt),
                    "ESPACIO FÍSICO": getChairName(apt),
                    "SUCURSAL": getBranchName(apt),
                    "MOTIVO / COMENTARIO": apt.motivo || apt.notas || "",
                    "ESTADO": STATUS_LABELS[normStatus] || apt.estado || "Programada"
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Historial de Citas");
            const fileName = `CITAS_${(patient?.nombreCompleto || patient?.nombres || "PACIENTE").replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
            XLSX.writeFile(workbook, fileName);
        } catch (e) {
            console.error("Error exporting excel:", e);
        }
    };

    // Print
    const handlePrint = () => {
        window.print();
    };

    // Open new appointment modal prefilled with patient data
    const handleOpenNew = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");

        const firstDoc = doctors[0];
        const defaultChairId = firstDoc?.recursoPrincipal || 
            (Array.isArray(firstDoc?.espaciosFisicos) ? firstDoc.espaciosFisicos[0] : "") || 
            (chairs[0]?.id || "");

        setEditingApt({
            isNewPatient: false,
            pacienteId: patient.id,
            paciente: patient.nombreCompleto || `${patient.nombres || ''} ${patient.apellidos || ''}`.trim(),
            pacienteNombre: patient.nombreCompleto || `${patient.nombres || ''} ${patient.apellidos || ''}`.trim(),
            celular: patient.celular || patient.telefono || "",
            doctorId: firstDoc?.id || "",
            consultorioId: defaultChairId,
            sucursalId: branches[0]?.id || "",
            especialidadId: specialties[0]?.id || "",
            fecha: `${yyyy}-${mm}-${dd}`,
            hora: `${hh}:${min}`,
            duracion: 30,
            motivo: "Consulta odontológica",
            comentario: "",
            status: "confirmed"
        });
        setModalOpen(true);
    };

    // Open edit appointment modal
    const handleOpenEdit = (apt) => {
        if (isAppointmentLocked(apt)) {
            toast?.warning ? toast.warning("No se puede editar ni reprogramar una cita con más de 1 mes de antigüedad.") : alert("Cita cerrada: más de 1 mes.");
            return;
        }

        const start = new Date(apt.fecha_inicio || apt.start);
        const end = new Date(apt.fecha_fin || apt.end);
        const durationMinutes = Math.max(15, Math.round((end - start) / (1000 * 60)));

        const yyyy = start.getFullYear();
        const mm = String(start.getMonth() + 1).padStart(2, "0");
        const dd = String(start.getDate()).padStart(2, "0");
        const hh = String(start.getHours()).padStart(2, "0");
        const min = String(start.getMinutes()).padStart(2, "0");

        setEditingApt({
            id: apt.id,
            isNewPatient: false,
            pacienteId: patient.id,
            paciente: patient.nombreCompleto || `${patient.nombres || ''} ${patient.apellidos || ''}`.trim(),
            pacienteNombre: patient.nombreCompleto || `${patient.nombres || ''} ${patient.apellidos || ''}`.trim(),
            celular: patient.celular || patient.telefono || "",
            doctorId: apt.profesional_id || apt.doctorId || "",
            consultorioId: apt.consultorio_id || apt.consultorioId || "",
            sucursalId: apt.sucursal_id || apt.sucursalId || (branches[0]?.id || ""),
            especialidadId: apt.especialidad_id || "",
            entidadId: apt.entidad_id || "",
            fecha: `${yyyy}-${mm}-${dd}`,
            hora: `${hh}:${min}`,
            duracion: durationMinutes,
            motivo: apt.motivo || "",
            comentario: apt.notas || apt.motivo || "",
            status: normalizeStatus(apt.estado)
        });
        setModalOpen(true);
    };

    // Save callback from AppointmentModal
    const handleSaveApt = async (aptData) => {
        try {
            if (aptData.id) {
                await updateAppointment(aptData.id, aptData);
                toast?.success ? toast.success("Cita actualizada exitosamente") : alert("Cita actualizada");
            } else {
                await createAppointment(aptData);
                toast?.success ? toast.success("Cita programada exitosamente") : alert("Cita programada");
            }

            setModalOpen(false);
            setEditingApt(null);
            loadPatientAppointments();
        } catch (err) {
            console.error("Error saving appointment:", err);
            toast?.error ? toast.error(err.message || "Error al guardar cita") : alert("Error: " + err.message);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto animate-fadeIn">
            {/* Top Toolbar Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#8CC63F]/10 text-[#8CC63F] flex items-center justify-center font-bold shrink-0">
                        <FiCalendar size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Historial de Citas</h1>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline-block">
                                - Paciente
                            </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500">
                            Historial de turnos del paciente (límite de edición hasta 1 mes de antigüedad)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search bar */}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar en citas..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#8CC63F] transition-colors"
                        />
                    </div>

                    {/* Export to Excel */}
                    <button
                        onClick={handleExportExcel}
                        disabled={appointments.length === 0}
                        className="bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Exportar a Excel"
                    >
                        <FiDownload size={14} />
                    </button>

                    {/* Print */}
                    <button
                        onClick={handlePrint}
                        disabled={appointments.length === 0}
                        className="bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Imprimir historial de citas"
                    >
                        <FiPrinter size={14} />
                    </button>

                    {/* New Appointment Button */}
                    <button
                        onClick={handleOpenNew}
                        className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-[#8CC63F]/20 flex items-center gap-2 cursor-pointer border-0 active:scale-95 whitespace-nowrap"
                    >
                        <FiPlus size={16} strokeWidth={3} />
                        <span>Nueva Cita</span>
                    </button>
                </div>
            </div>

            {/* Table of Appointments with Scroll Limit (approx. 6-7 rows max-h) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs">
                            <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                <th className="py-3 px-4 w-40">Fecha / Hora</th>
                                <th className="py-3 px-4">Profesional</th>
                                <th className="py-3 px-4 w-44">Espacio Físico</th>
                                <th className="py-3 px-4 w-48">Sucursal</th>
                                <th className="py-3 px-4">Comentario / Motivo</th>
                                <th className="py-3 px-4 w-36 text-center">Estado</th>
                                <th className="py-3 px-4 w-28 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400 font-medium">
                                        <div className="w-6 h-6 border-2 border-[#8CC63F]/20 border-t-[#8CC63F] rounded-full animate-spin mx-auto mb-2" />
                                        Cargando historial de citas...
                                    </td>
                                </tr>
                            ) : filteredAppointments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-1">
                                                <FiCalendar size={28} />
                                            </div>
                                            <p className="text-sm font-black text-slate-700 uppercase tracking-tight">
                                                No hay citas registradas
                                            </p>
                                            <p className="text-xs text-slate-400 max-w-sm">
                                                Este paciente aún no tiene citas en su historial. Puedes agendar una haciendo clic en el botón superior.
                                            </p>
                                            <button
                                                onClick={handleOpenNew}
                                                className="mt-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-[#8CC63F]/20 flex items-center gap-2 cursor-pointer border-0"
                                            >
                                                <FiPlus size={14} strokeWidth={3} />
                                                <span>Agendar Primera Cita</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAppointments.map((apt) => {
                                    const start = new Date(apt.fecha_inicio || apt.start);
                                    const end = new Date(apt.fecha_fin || apt.end);
                                    const dateFormatted = isNaN(start.getTime()) 
                                        ? (apt.fecha || "Fecha no def.") 
                                        : start.toLocaleDateString("es-CO", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "2-digit"
                                        });
                                    const startTime = isNaN(start.getTime()) 
                                        ? (apt.horaInicio || apt.hora || "") 
                                        : start.toLocaleTimeString("es-CO", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true
                                        });
                                    const endTime = isNaN(end.getTime()) 
                                        ? (apt.horaFin || "") 
                                        : end.toLocaleTimeString("es-CO", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true
                                        });

                                    const normStatus = normalizeStatus(apt.estado);
                                    const statusStyle = STATUS_COLORS[normStatus] || "bg-slate-100 text-slate-600 border-slate-200";
                                    const isLocked = isAppointmentLocked(apt);

                                    return (
                                        <tr key={apt.id} className={`hover:bg-slate-50/60 transition-colors ${isLocked ? 'bg-slate-50/40 opacity-90' : ''}`}>
                                            {/* Fecha / Hora */}
                                            <td className="py-3 px-4 font-mono">
                                                <div className="flex items-center gap-1.5 font-black text-slate-800 text-xs">
                                                    {isLocked && <FiLock className="text-amber-500 shrink-0" size={11} title="Cita cerrada (+1 mes de antigüedad)" />}
                                                    <span>{dateFormatted}</span>
                                                </div>
                                                <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                                                    {startTime}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {endTime}
                                                </div>
                                            </td>

                                            {/* Profesional */}
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-800 uppercase">
                                                    {getDoctorName(apt)}
                                                </div>
                                                {apt.profesional?.especialidad && (
                                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                                                        {apt.profesional.especialidad}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Espacio físico */}
                                            <td className="py-3 px-4 font-semibold text-slate-600 uppercase text-xs">
                                                {getChairName(apt)}
                                            </td>

                                            {/* Sucursal */}
                                            <td className="py-3 px-4 font-semibold text-slate-600 uppercase text-xs">
                                                {getBranchName(apt)}
                                            </td>

                                            {/* Comentario / Motivo */}
                                            <td className="py-3 px-4">
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-xs text-slate-700 min-h-[44px] flex items-center">
                                                    {apt.motivo || apt.notas || <span className="text-slate-300 italic">Sin comentario</span>}
                                                </div>
                                            </td>

                                            {/* Estado Dropdown / Pill */}
                                            <td className="py-3 px-4 text-center">
                                                <select
                                                    value={normStatus}
                                                    disabled={isLocked}
                                                    onChange={(e) => handleStatusChange(apt, e.target.value)}
                                                    className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border outline-none transition-all ${
                                                        isLocked ? 'cursor-not-allowed opacity-75 border-slate-300 bg-slate-100 text-slate-600' : 'cursor-pointer ' + statusStyle
                                                    }`}
                                                    title={isLocked ? "Cita de más de 1 mes de antigüedad (Cerrada)" : "Cambiar estado"}
                                                >
                                                    {STATUS_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value} className="bg-white text-slate-800 normal-case font-bold">
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Acciones */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* WhatsApp reminder */}
                                                    {(patient?.telefono || patient?.celular || apt.celular || apt.telefono) ? (
                                                        <button
                                                            onClick={() => {
                                                                const activeClinic = userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || userProfile?.clinica || userProfile?.tenantNombre || "";
                                                                openWhatsAppWebDirect({
                                                                    phone: patient?.celular || patient?.telefono || apt.celular || apt.telefono,
                                                                    patientName: patient?.nombreCompleto || `${patient?.nombres || ''} ${patient?.apellidos || ''}`.trim() || apt.paciente || apt.pacienteNombre,
                                                                    dateStr: dateFormatted,
                                                                    timeStr: startTime,
                                                                    doctorName: getDoctorName(apt),
                                                                    clinicName: activeClinic
                                                                }, activeClinic);
                                                            }}
                                                            className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 flex items-center justify-center transition-all shadow-xs cursor-pointer border-0"
                                                            title="Enviar recordatorio de WhatsApp"
                                                        >
                                                            <FiMessageCircle size={14} />
                                                        </button>
                                                    ) : null}

                                                    {/* Editar Cita */}
                                                    <button
                                                        onClick={() => handleOpenEdit(apt)}
                                                        disabled={isLocked}
                                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-xs border-0 ${
                                                            isLocked 
                                                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50' 
                                                                : 'bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 cursor-pointer'
                                                        }`}
                                                        title={isLocked ? "Cita cerrada: No se puede editar (+1 mes de antigüedad)" : "Editar cita"}
                                                    >
                                                        <FiEdit2 size={14} />
                                                    </button>

                                                    {/* Eliminar Cita */}
                                                    <button
                                                        onClick={() => handleDeleteApt(apt)}
                                                        disabled={isLocked}
                                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-xs border-0 ${
                                                            isLocked 
                                                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50' 
                                                                : 'bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 cursor-pointer'
                                                        }`}
                                                        title={isLocked ? "Cita cerrada: No se puede eliminar (+1 mes de antigüedad)" : "Eliminar cita"}
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Counter Footer in Card */}
                {filteredAppointments.length > 0 && (
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-bold px-4">
                        <span>Total Citas: {filteredAppointments.length}</span>
                        <span className="text-[11px] text-slate-400">Las citas con candado tienen más de 1 mes y están protegidas contra cambios</span>
                    </div>
                )}
            </div>

            {/* Modal for creating / editing appointment (identical to Agenda modal) */}
            {modalOpen && (
                <AppointmentModal
                    isOpen={modalOpen}
                    onClose={() => {
                        setModalOpen(false);
                        setEditingApt(null);
                    }}
                    initialData={editingApt}
                    doctors={doctors}
                    chairs={chairs}
                    branches={branches}
                    specialties={specialties}
                    entities={entities}
                    priceList={priceList}
                    onSave={handleSaveApt}
                    onDelete={(id) => {
                        handleDeleteApt({ id, ...editingApt });
                        setModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
