// src/modules/pacientes/components/CitasTab.jsx
import React, { useState, useEffect, useMemo } from "react";
import { 
    FiCalendar, FiClock, FiUser, FiMapPin, FiPlus, FiSearch, FiPrinter, 
    FiDownload, FiEdit2, FiTrash2, FiMessageCircle, FiCheck, FiX, FiAlertCircle 
} from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import supabase from "../../../lib/supabaseClient";
import * as XLSX from "xlsx";
import AppointmentModal from "../../agenda/components/AppointmentModal";
import { openWhatsAppWebDirect } from "../../../services/WhatsAppService";
import { getConfigItems } from "../../../services/configPersistenceService";
import { createAppointment, updateAppointment, deleteAppointment } from "../../../services/appointmentService";

const STATUS_COLORS = {
    programada: "bg-sky-50 text-sky-700 border-sky-200",
    confirmada: "bg-emerald-50 text-emerald-700 border-emerald-200",
    en_sala: "bg-purple-50 text-purple-700 border-purple-200",
    atendida: "bg-teal-50 text-teal-700 border-teal-200",
    cancelada: "bg-rose-50 text-rose-700 border-rose-200",
    no_asistio: "bg-amber-50 text-amber-700 border-amber-200",
    // Standard capitalized fallbacks
    PROGRAMADA: "bg-sky-50 text-sky-700 border-sky-200",
    CONFIRMADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "EN SALA": "bg-purple-50 text-purple-700 border-purple-200",
    ATENDIDA: "bg-teal-50 text-teal-700 border-teal-200",
    CANCELADA: "bg-rose-50 text-rose-700 border-rose-200",
    "NO ASISTIÓ": "bg-amber-50 text-amber-700 border-amber-200"
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
    const inquilino = userProfile?.inquilino || patient?.inquilino || patient?.tenant_id;

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Catalogs for display and modal
    const [doctors, setDoctors] = useState([]);
    const [chairs, setChairs] = useState([]);
    const [branches, setBranches] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [entities, setEntities] = useState([]);
    const [priceList, setPriceList] = useState([]);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingApt, setEditingApt] = useState(null);

    // Fetch patient appointments & catalogs
    const loadData = async () => {
        if (!patient?.id || !inquilino) return;
        setLoading(true);
        try {
            // 1. Fetch appointments for this patient
            const { data: aptsData, error: aptsError } = await supabase
                .from("citas")
                .select("*, profesional:profesionales(nombre_completo, especialidad)")
                .eq("tenant_id", inquilino)
                .eq("paciente_id", patient.id)
                .order("fecha_inicio", { ascending: false });

            if (aptsError) {
                console.error("Error fetching patient appointments:", aptsError);
            }

            // 2. Fetch catalogs for appointment modal and labels
            const [profRes, chairsRes, branchesRes, specRes, entRes, priceRes, profilesRes] = await Promise.all([
                supabase.from("profesionales").select("*").eq("tenant_id", inquilino),
                getConfigItems(inquilino, "recursos_fisicos", "consultorios"),
                getConfigItems(inquilino, "sucursales", "sucursales"),
                getConfigItems(inquilino, "especialidades", "especialidades"),
                supabase.from("entidades").select("*").eq("tenant_id", inquilino),
                getConfigItems(inquilino, "listas_precios", "listas_precios"),
                supabase.from("profiles").select("*").eq("tenant_id", inquilino)
            ]);

            // Combine doctors
            const doctorsMap = new Map();
            (profRes.data || []).forEach(d => {
                if (d.activo !== false) {
                    doctorsMap.set(d.id, {
                        id: d.id,
                        nombre: d.nombre_completo || d.nombre || "",
                        especialidad: d.especialidad || "Odontología",
                        email: d.correo || d.email || "",
                        telefono: d.telefono || ""
                    });
                }
            });
            (profilesRes.data || []).forEach(p => {
                if (p.activo !== false && !doctorsMap.has(p.id)) {
                    doctorsMap.set(p.id, {
                        id: p.id,
                        nombre: p.full_name || p.nombre || p.email || "",
                        especialidad: p.especialidad || "Odontología",
                        email: p.email || "",
                        telefono: p.telefono || ""
                    });
                }
            });

            setDoctors(Array.from(doctorsMap.values()));
            setChairs(chairsRes || []);
            setBranches(branchesRes || []);
            setSpecialties(specRes || []);
            setEntities(entRes.data || []);
            setPriceList(priceRes || []);
            setAppointments(aptsData || []);
        } catch (err) {
            console.error("Error loading patient appointments data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [patient?.id, inquilino]);

    // Helpers to resolve names
    const getDoctorName = (apt) => {
        if (apt.profesional?.nombre_completo) return apt.profesional.nombre_completo;
        const doc = doctors.find(d => d.id === apt.profesional_id);
        return doc?.nombre || apt.profesional_nombre || "Profesional no asignado";
    };

    const getChairName = (apt) => {
        const chairId = apt.consultorio_id || apt.recurso_id;
        const chair = chairs.find(c => c.id === chairId);
        return chair?.nombre || chair?.name || apt.consultorio_nombre || (chairId ? `Consultorio ${chairId}` : "Sin espacio físico");
    };

    const getBranchName = (apt) => {
        const branchId = apt.sucursal_id;
        const branch = branches.find(b => b.id === branchId);
        return branch?.nombre || branch?.name || userProfile?.clinica || "Sede Principal";
    };

    // Filter appointments
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
    const handleStatusChange = async (aptId, newStatus) => {
        try {
            await updateAppointment(inquilino, aptId, { status: newStatus, estado: newStatus });
            setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, estado: newStatus } : a));
            toast?.success ? toast.success("Estado de cita actualizado") : alert("Estado de cita actualizado");
        } catch (err) {
            console.error("Error updating status:", err);
            toast?.error ? toast.error("Error al actualizar estado: " + err.message) : alert("Error: " + err.message);
        }
    };

    // Delete appointment
    const handleDelete = async (aptId) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta cita del historial?")) return;
        try {
            await deleteAppointment(inquilino, aptId);
            setAppointments(prev => prev.filter(a => a.id !== aptId));
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
                const start = new Date(apt.fecha_inicio);
                const end = new Date(apt.fecha_fin);
                return {
                    "FECHA": start.toLocaleDateString("es-CO"),
                    "HORA INICIO": start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    "HORA FIN": end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    "PROFESIONAL": getDoctorName(apt),
                    "ESPACIO FÍSICO": getChairName(apt),
                    "SUCURSAL": getBranchName(apt),
                    "MOTIVO / COMENTARIO": apt.motivo || apt.notas || "",
                    "ESTADO": apt.estado || "Programada"
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

    // Open new appointment modal prefilled for this patient
    const handleOpenNew = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");

        setEditingApt({
            isNewPatient: false,
            pacienteId: patient.id,
            pacienteNombre: patient.nombreCompleto || `${patient.nombres || ''} ${patient.apellidos || ''}`.trim(),
            doctorId: doctors[0]?.id || "",
            consultorioId: chairs[0]?.id || "",
            sucursalId: branches[0]?.id || "",
            fecha: `${yyyy}-${mm}-${dd}`,
            hora: `${hh}:${min}`,
            duracion: 30,
            motivo: "Valoración",
            comentario: "",
            status: "programada"
        });
        setModalOpen(true);
    };

    // Open edit appointment modal
    const handleOpenEdit = (apt) => {
        const start = new Date(apt.fecha_inicio);
        const end = new Date(apt.fecha_fin);
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
            pacienteNombre: patient.nombreCompleto || `${patient.nombres || ''} ${patient.apellidos || ''}`.trim(),
            doctorId: apt.profesional_id || "",
            consultorioId: apt.consultorio_id || "",
            sucursalId: apt.sucursal_id || branches[0]?.id || "",
            fecha: `${yyyy}-${mm}-${dd}`,
            hora: `${hh}:${min}`,
            duracion: durationMinutes,
            motivo: apt.motivo || "",
            comentario: apt.notas || "",
            status: apt.estado || "programada"
        });
        setModalOpen(true);
    };

    // Save callback from AppointmentModal
    const handleSaveApt = async (aptData) => {
        try {
            const startDateTime = new Date(`${aptData.fecha}T${aptData.hora}`);
            const endDateTime = new Date(startDateTime.getTime() + (aptData.duracion || 30) * 60000);

            const payload = {
                doctorId: aptData.doctorId,
                pacienteId: patient.id,
                roomId: aptData.consultorioId,
                consultorioId: aptData.consultorioId,
                sucursalId: aptData.sucursalId,
                start: startDateTime,
                end: endDateTime,
                motivo: aptData.motivo || "Consulta",
                notas: aptData.comentario || "",
                status: aptData.status || "programada"
            };

            if (aptData.id) {
                await updateAppointment(inquilino, aptData.id, payload);
                toast?.success ? toast.success("Cita actualizada exitosamente") : alert("Cita actualizada");
            } else {
                await createAppointment(inquilino, payload);
                toast?.success ? toast.success("Cita programada exitosamente") : alert("Cita programada");
            }

            setModalOpen(false);
            setEditingApt(null);
            loadData();
        } catch (err) {
            console.error("Error saving appointment:", err);
            toast?.error ? toast.error("Error al guardar cita: " + err.message) : alert("Error: " + err.message);
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
                            <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Citas del Paciente</h1>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline-block">
                                - Pacientes - Citas
                            </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500">Historial y programación de turnos y consultas para este paciente</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search bar */}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar citas..."
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

            {/* Table of Appointments */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="py-3 px-4 w-40">Fecha / Hora</th>
                                <th className="py-3 px-4">Profesional</th>
                                <th className="py-3 px-4 w-44">Espacio Físico</th>
                                <th className="py-3 px-4 w-48">Sucursal</th>
                                <th className="py-3 px-4">Comentario / Motivo</th>
                                <th className="py-3 px-4 w-36 text-center">Estado</th>
                                <th className="py-3 px-4 w-24 text-right">Acciones</th>
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
                                            <p className="text-sm font-black text-slate-700 uppercase tracking-tight">No hay citas registradas</p>
                                            <p className="text-xs text-slate-400 max-w-sm">Este paciente aún no tiene citas en su historial. Puedes agendar una haciendo clic en el botón verde superior.</p>
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
                                    const start = new Date(apt.fecha_inicio);
                                    const end = new Date(apt.fecha_fin);
                                    const dateFormatted = start.toLocaleDateString("es-CO", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "2-digit"
                                    });
                                    const startTime = start.toLocaleTimeString("es-CO", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true
                                    });
                                    const endTime = end.toLocaleTimeString("es-CO", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true
                                    });

                                    const currentStatus = (apt.estado || "programada").toLowerCase();
                                    const statusStyle = STATUS_COLORS[currentStatus] || "bg-slate-100 text-slate-600 border-slate-200";

                                    return (
                                        <tr key={apt.id} className="hover:bg-slate-50/60 transition-colors">
                                            {/* Fecha / Hora */}
                                            <td className="py-3 px-4 font-mono">
                                                <div className="font-black text-slate-800 text-xs">
                                                    {dateFormatted}
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
                                                    value={currentStatus}
                                                    onChange={(e) => handleStatusChange(apt.id, e.target.value)}
                                                    className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border cursor-pointer outline-none transition-all ${statusStyle}`}
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
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* WhatsApp reminder */}
                                                    {patient.telefono || patient.celular ? (
                                                        <button
                                                            onClick={() => openWhatsAppWebDirect({
                                                                phone: patient.telefono || patient.celular,
                                                                patientName: patient.nombreCompleto || patient.nombres,
                                                                dateStr: dateFormatted,
                                                                timeStr: startTime,
                                                                doctorName: getDoctorName(apt),
                                                                clinicName: userProfile?.clinica || "OdontoCloud"
                                                            })}
                                                            className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 flex items-center justify-center transition-all shadow-xs cursor-pointer border-0"
                                                            title="Enviar recordatorio de WhatsApp"
                                                        >
                                                            <FiMessageCircle size={14} />
                                                        </button>
                                                    ) : null}

                                                    <button
                                                        onClick={() => handleOpenEdit(apt)}
                                                        className="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 flex items-center justify-center transition-all shadow-xs cursor-pointer border-0"
                                                        title="Editar cita"
                                                    >
                                                        <FiEdit2 size={14} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(apt.id)}
                                                        className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 flex items-center justify-center transition-all shadow-xs cursor-pointer border-0"
                                                        title="Eliminar cita"
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
            </div>

            {/* Modal for creating / editing appointment */}
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
                        handleDelete(id);
                        setModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
