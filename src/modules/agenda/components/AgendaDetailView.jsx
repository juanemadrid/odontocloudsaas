import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
    FiCalendar, 
    FiDownload, 
    FiSearch, 
    FiHelpCircle, 
    FiClock, 
    FiUser, 
    FiMapPin, 
    FiActivity,
    FiCheckCircle,
    FiRefreshCw,
    FiPrinter,
    FiPercent,
    FiX
} from 'react-icons/fi';
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";

const ESTADOS_CITA = [
    { value: "", label: "Seleccione..." },
    { value: "SIN CONFIRMAR", label: "Sin confirmar" },
    { value: "CONFIRMADA", label: "Confirmada" },
    { value: "ATENDIDO", label: "Atendido" },
    { value: "URGENCIA", label: "Urgencia" },
    { value: "SIN CONT. WEB", label: "Sin cont. web" },
    { value: "NO ASISTE", label: "No asiste" },
    { value: "CANCELADO", label: "Cancelado" },
    { value: "EN ESPERA", label: "En espera" }
];

const CANCELLED_STATUSES = new Set(["CANCELADA", "CANCELADO", "CANCELLED", "NO ASISTE", "NO-SHOW"]);

export default function AgendaDetailView({ doctors = [], branches = [], chairs = [], specialties = [] }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    // Calcular inicio y fin de la semana actual por defecto
    const getInitialDates = () => {
        const today = new Date();
        const day = today.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        const start = new Date(today);
        start.setDate(today.getDate() + diff);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);

        return {
            start: format(start, "yyyy-MM-dd"),
            end: format(end, "yyyy-MM-dd")
        };
    };

    const initialDates = getInitialDates();

    // Filtros del formulario
    const [fechaInicial, setFechaInicial] = useState(initialDates.start);
    const [fechaFinal, setFechaFinal] = useState(initialDates.end);
    const [estado, setEstado] = useState("");
    const [recursoFisico, setRecursoFisico] = useState("");
    const [soloSinFuturasCitas, setSoloSinFuturasCitas] = useState(false);
    const [especialidad, setEspecialidad] = useState("");
    const [filtrarPor, setFiltrarPor] = useState("fecha_cita"); // 'fecha_cita' | 'fecha_creacion'
    const [profesional, setProfesional] = useState("");
    const [sucursal, setSucursal] = useState("");

    // Estado de datos (inicia en blanco hasta que el usuario pulse Buscar)
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [tableSearch, setTableSearch] = useState("");

    // Modal de Ocupación
    const [showOccupancyModal, setShowOccupancyModal] = useState(false);

    // Contenedor para impresión
    const printRef = useRef(null);

    // Ejecutar búsqueda con filtros
    const handleSearch = useCallback(async () => {
        if (!inquilino) return;
        setLoading(true);

        try {
            let query = supabase
                .from("citas")
                .select(`
                    *,
                    paciente:pacientes(id, documento, nombres, apellidos, telefono, email)
                `)
                .eq("tenant_id", inquilino);

            // Filtro por rango de fechas según "Filtrar por"
            if (fechaInicial) {
                const startIso = `${fechaInicial}T00:00:00.000Z`;
                if (filtrarPor === "fecha_creacion") {
                    query = query.gte("created_at", startIso);
                } else {
                    query = query.gte("fecha_inicio", startIso);
                }
            }

            if (fechaFinal) {
                const endIso = `${fechaFinal}T23:59:59.999Z`;
                if (filtrarPor === "fecha_creacion") {
                    query = query.lte("created_at", endIso);
                } else {
                    query = query.lte("fecha_inicio", endIso);
                }
            }

            if (profesional) {
                query = query.eq("profesional_id", profesional);
            }

            if (recursoFisico) {
                query = query.eq("consultorio_id", recursoFisico);
            }

            if (sucursal) {
                query = query.eq("sucursal_id", sucursal);
            }

            const { data: rawCitas, error } = await query;
            if (error) throw error;

            // Extraer IDs únicos de pacientes para calcular su próxima cita a futuro
            const patientIds = Array.from(new Set((rawCitas || []).map(c => c.paciente_id).filter(Boolean)));
            const patientAptsMap = new Map();

            if (patientIds.length > 0) {
                // Consultar todas las citas activas de estos pacientes ordenadas cronológicamente
                const { data: allPatientApts, error: futureErr } = await supabase
                    .from("citas")
                    .select("id, paciente_id, fecha_inicio, estado")
                    .eq("tenant_id", inquilino)
                    .in("paciente_id", patientIds)
                    .order("fecha_inicio", { ascending: true });

                if (!futureErr && allPatientApts) {
                    (allPatientApts || []).forEach(fa => {
                        const st = (fa.estado || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                        if (CANCELLED_STATUSES.has(st)) return;
                        if (!fa.paciente_id || !fa.fecha_inicio) return;

                        if (!patientAptsMap.has(fa.paciente_id)) {
                            patientAptsMap.set(fa.paciente_id, []);
                        }
                        patientAptsMap.get(fa.paciente_id).push({
                            id: fa.id,
                            date: new Date(fa.fecha_inicio)
                        });
                    });
                }
            }

            let filtered = (rawCitas || []).map(c => {
                const startObj = c.fecha_inicio ? new Date(c.fecha_inicio) : null;
                const endObj = c.fecha_fin ? new Date(c.fecha_fin) : null;
                const createdObj = c.created_at ? new Date(c.created_at) : null;

                const docObj = (doctors || []).find(d => String(d.id) === String(c.profesional_id));
                const chairObj = (chairs || []).find(ch => String(ch.id) === String(c.consultorio_id));
                const branchObj = (branches || []).find(b => String(b.id) === String(c.sucursal_id));

                const pac = c.paciente;
                const pacNombre = pac 
                    ? `${pac.nombres || ''} ${pac.apellidos || ''}`.trim() || c.motivo || "Paciente"
                    : (c.motivo || "Paciente");

                // Buscar la primera cita del paciente que sea estrictamente posterior a la cita actual
                let nextDate = null;
                if (c.paciente_id && startObj) {
                    const aptList = patientAptsMap.get(c.paciente_id) || [];
                    const nextApt = aptList.find(a => String(a.id) !== String(c.id) && a.date.getTime() > startObj.getTime());
                    if (nextApt) {
                        nextDate = nextApt.date;
                    }
                }

                return {
                    id: c.id,
                    fechaInicio: startObj,
                    fechaFin: endObj,
                    fechaCreacion: createdObj,
                    pacienteId: c.paciente_id,
                    pacienteNombre: pacNombre,
                    pacienteDoc: pac?.documento || c.nro_documento || "",
                    pacienteTipoDoc: pac?.tipo_documento || c.tipo_documento || "CC",
                    pacienteTel: pac?.telefono || c.celular || "",
                    pacienteEmail: pac?.email || "",
                    profesionalId: c.profesional_id,
                    profesionalNombre: docObj?.nombreCompleto || docObj?.nombre || "No asignado",
                    profesionalEspecialidad: docObj?.especialidad || (docObj?.especialidades ? docObj.especialidades.join(", ") : "General"),
                    consultorioId: c.consultorio_id,
                    consultorioNombre: chairObj?.nombre || "Sin consultorio",
                    sucursalId: c.sucursal_id,
                    sucursalNombre: branchObj?.nombre || "Global / Todas",
                    estado: (c.estado || "CONFIRMADA").toUpperCase(),
                    motivo: c.motivo || c.notas || "Consulta odontológica",
                    duracion: c.duracion || 30,
                    futuraCita: nextDate
                };
            });

            // Filtro por Estado
            if (estado) {
                const targetNorm = estado.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                filtered = filtered.filter(item => {
                    const itemNorm = (item.estado || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                    return itemNorm === targetNorm || itemNorm.includes(targetNorm) || targetNorm.includes(itemNorm);
                });
            }

            // Filtro por Especialidad
            if (especialidad) {
                const targetEsp = especialidad.toLowerCase();
                filtered = filtered.filter(item => {
                    const espStr = (item.profesionalEspecialidad || "").toLowerCase();
                    return espStr.includes(targetEsp);
                });
            }

            // Filtro: Solo mostrar pacientes sin futuras citas
            if (soloSinFuturasCitas) {
                filtered = filtered.filter(item => !item.futuraCita);
            }

            // Ordenar por fecha_inicio descendente
            filtered.sort((a, b) => (b.fechaInicio?.getTime() || 0) - (a.fechaInicio?.getTime() || 0));

            setResults(filtered);
            setHasSearched(true);
        } catch (err) {
            console.error("Error consultando detalle de agenda:", err);
            toast.error("Error al consultar reporte: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [inquilino, fechaInicial, fechaFinal, filtrarPor, profesional, recursoFisico, sucursal, estado, especialidad, soloSinFuturasCitas, doctors, chairs, branches]);

    // Filtrar resultados por término de búsqueda en la tabla
    const displayData = useMemo(() => {
        if (!tableSearch.trim()) return results;
        const q = tableSearch.toLowerCase().trim();
        return results.filter(item => 
            (item.pacienteNombre || "").toLowerCase().includes(q) ||
            (item.pacienteDoc || "").toLowerCase().includes(q) ||
            (item.profesionalNombre || "").toLowerCase().includes(q) ||
            (item.consultorioNombre || "").toLowerCase().includes(q) ||
            (item.sucursalNombre || "").toLowerCase().includes(q) ||
            (item.estado || "").toLowerCase().includes(q) ||
            (item.motivo || "").toLowerCase().includes(q)
        );
    }, [results, tableSearch]);

    // Cálculo del Porcentaje de Ocupación
    const occupancyPercentage = useMemo(() => {
        if (!results || results.length === 0) return "0.00";

        // Total de minutos ocupados en citas válidas (excluyendo canceladas y no asistencias)
        const validAppointments = results.filter(c => !CANCELLED_STATUSES.has(c.estado));
        const totalOccupiedMinutes = validAppointments.reduce((acc, c) => acc + (c.duracion || 30), 0);

        // Días de capacidad calculados entre fechaInicial y fechaFinal
        const startDate = fechaInicial ? new Date(fechaInicial) : new Date();
        const endDate = fechaFinal ? new Date(fechaFinal) : new Date();
        const diffTime = Math.max(0, endDate.getTime() - startDate.getTime());
        const totalDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

        // Capacidad teórica: 10 horas de atención al día (600 minutos) por consultorio/recurso disponible
        const totalChairs = Math.max(1, chairs.length || 1);
        const totalAvailableMinutes = totalDays * 10 * 60 * totalChairs;

        const calculated = (totalOccupiedMinutes / totalAvailableMinutes) * 100;
        return calculated.toFixed(2);
    }, [results, fechaInicial, fechaFinal, chairs]);

    // Exportar a Excel (.xlsx)
    const handleExportExcel = () => {
        if (results.length === 0) {
            toast.error("No hay datos disponibles para exportar. Realice una búsqueda primero.");
            return;
        }

        try {
            const excelRows = results.map(item => ({
                "Fecha Cita": item.fechaInicio ? format(item.fechaInicio, "dd/MM/yyyy") : "—",
                "Hora Inicio": item.fechaInicio ? format(item.fechaInicio, "hh:mm a") : "—",
                "Hora Fin": item.fechaFin ? format(item.fechaFin, "hh:mm a") : "—",
                "Fecha Creación": item.fechaCreacion ? format(item.fechaCreacion, "dd/MM/yyyy hh:mm a") : "—",
                "Paciente": item.pacienteNombre,
                "Tipo Documento": item.pacienteTipoDoc || "—",
                "Nro Documento": item.pacienteDoc || "—",
                "Teléfono": item.pacienteTel || "—",
                "Email": item.pacienteEmail || "—",
                "Profesional": item.profesionalNombre,
                "Especialidad": item.profesionalEspecialidad,
                "Consultorio": item.consultorioNombre,
                "Sucursal / Sede": item.sucursalNombre,
                "Estado": item.estado,
                "Futura Cita": item.futuraCita ? format(item.futuraCita, "dd/MM/yyyy hh:mm a") : ""
            }));

            const worksheet = XLSX.utils.json_to_sheet(excelRows);

            // Configurar anchos de columna automáticos
            const columnWidths = [
                { wch: 14 }, // Fecha Cita
                { wch: 12 }, // Hora Inicio
                { wch: 12 }, // Hora Fin
                { wch: 20 }, // Fecha Creacion
                { wch: 30 }, // Paciente
                { wch: 15 }, // Tipo Doc
                { wch: 16 }, // Nro Doc
                { wch: 15 }, // Telefono
                { wch: 25 }, // Email
                { wch: 25 }, // Profesional
                { wch: 20 }, // Especialidad
                { wch: 20 }, // Consultorio
                { wch: 22 }, // Sucursal
                { wch: 16 }, // Estado
                { wch: 24 }, // Futura Cita
            ];
            worksheet["!cols"] = columnWidths;

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle de Agenda");

            const fileName = `Reporte_Agenda_Detalle_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            toast.success("Reporte Excel descargado con éxito");
        } catch (err) {
            console.error("Error al exportar Excel:", err);
            toast.error("Error al generar archivo Excel: " + err.message);
        }
    };

    // Imprimir Reporte en Formato Institucional
    const handlePrint = () => {
        if (results.length === 0) {
            toast.error("No hay datos para imprimir. Realice una búsqueda primero.");
            return;
        }

        const selectedBranchName = sucursal 
            ? (branches.find(b => String(b.id) === String(sucursal))?.nombre || "Sucursal seleccionada")
            : (userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "Todas las sedes");

        const selectedDoctorName = profesional 
            ? (doctors.find(d => String(d.id) === String(profesional))?.nombreCompleto || doctors.find(d => String(d.id) === String(profesional))?.nombre || "Doctor seleccionado")
            : "Todos los doctores";

        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            toast.error("Permita las ventanas emergentes para imprimir el reporte.");
            return;
        }

        const rowsHtml = results.map(item => `
            <tr>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-align: left; vertical-align: middle;">
                    ${item.fechaInicio ? format(item.fechaInicio, "dd/MM/yy") : "—"} - ${item.fechaInicio ? format(item.fechaInicio, "h:mm a") : "—"} a ${item.fechaFin ? format(item.fechaFin, "h:mm a") : "—"}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-transform: uppercase; font-weight: bold; text-align: left; vertical-align: middle;">
                    ${item.pacienteNombre}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-align: left; vertical-align: middle;">
                    ${item.pacienteDoc || "—"}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-align: left; vertical-align: middle;">
                    ${item.pacienteTel || "—"}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-transform: uppercase; text-align: left; vertical-align: middle;">
                    ${item.profesionalNombre}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-transform: uppercase; text-align: left; vertical-align: middle;">
                    ${item.consultorioNombre}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-align: left; vertical-align: middle;">
                    ${item.motivo || "—"}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-transform: uppercase; text-align: center; vertical-align: middle;">
                    ${item.estado}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #333; font-size: 8.5pt; text-align: left; vertical-align: middle;">
                    ${item.futuraCita ? format(item.futuraCita, "dd/MM/yy h:mm a") : ""}
                </td>
            </tr>
        `).join('');

        const logoHtml = userProfile?.tenant?.logo 
            ? `<img src="${userProfile.tenant.logo}" alt="Logo" style="max-height: 70px; max-width: 220px; object-fit: contain; margin-bottom: 12px;" />`
            : `<h2 style="font-size: 20pt; font-weight: 900; margin: 0 0 10px 0; text-transform: uppercase; color: #222;">${userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "ATM Centro del Dolor Orofacial"}</h2>`;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reporte de Agenda</title>
                <style>
                    @page {
                        size: letter portrait;
                        margin: 12mm 10mm;
                    }
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        color: #111;
                        background: #fff;
                        margin: 0;
                        padding: 10px;
                    }
                    .header-container {
                        text-align: center;
                        margin-bottom: 18px;
                    }
                    .header-info-box {
                        width: 100%;
                        border-top: 1px solid #444;
                        border-bottom: 1px solid #444;
                        margin-bottom: 18px;
                        padding: 6px 0;
                        font-size: 9pt;
                    }
                    .header-info-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .header-info-table td {
                        padding: 2px 4px;
                    }
                    .report-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    .report-table th {
                        background-color: #ffffff;
                        border: 1px solid #333;
                        padding: 6px 8px;
                        font-size: 8.5pt;
                        font-weight: 900;
                        text-transform: uppercase;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    ${logoHtml}
                </div>

                <div class="header-info-box">
                    <table class="header-info-table">
                        <tr>
                            <td style="width: 80px; font-weight: bold;">Sede</td>
                            <td>: ${selectedBranchName}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">Doctor</td>
                            <td>: ${selectedDoctorName}</td>
                        </tr>
                    </table>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 14%;">Hora</th>
                            <th style="width: 18%;">Nombre paciente</th>
                            <th style="width: 11%;">Documento paciente</th>
                            <th style="width: 10%;">Celular paciente</th>
                            <th style="width: 13%;">Doctor</th>
                            <th style="width: 11%;">Espacio físico</th>
                            <th style="width: 8%;">Comentario</th>
                            <th style="width: 7%;">Estado</th>
                            <th style="width: 8%;">Próxima cita</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Helper para colores de estado
    const getStatusBadge = (st) => {
        const norm = (st || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
        if (norm === "CONFIRMADA") {
            return "bg-blue-50 text-blue-700 border-blue-200";
        }
        if (norm === "ATENDIDO") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        }
        if (norm === "SIN CONFIRMAR" || norm === "PENDIENTE") {
            return "bg-amber-50 text-amber-700 border-amber-200";
        }
        if (norm === "URGENCIA") {
            return "bg-purple-50 text-purple-700 border-purple-200";
        }
        if (norm === "CANCELADO" || norm === "CANCELADA" || norm === "NO ASISTE") {
            return "bg-rose-50 text-rose-700 border-rose-200";
        }
        return "bg-slate-100 text-slate-700 border-slate-200";
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-y-auto custom-scrollbar p-4 md:p-6 gap-5">
            {/* ─── 1. TOP HEADER ACTIONS ─── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <FiCalendar className="text-blue-600" />
                        Detalle y Reporte de Agenda
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Consulte, filtre y exporte el historial y programación de citas
                    </p>
                </div>

                <button
                    onClick={handleExportExcel}
                    disabled={loading || results.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#00a3e0] hover:bg-[#008ec4] text-white rounded-[14px] font-black text-[11px] uppercase tracking-wider transition-all shadow-md shadow-[#00a3e0]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FiDownload size={15} /> Generar reporte en excel
                </button>
            </div>

            {/* ─── 2. FILTER CARD (OralDrive Design Style) ─── */}
            <div className="bg-white rounded-[24px] border border-slate-200/70 shadow-sm p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
                    {/* Fila 1: Fecha inicial / Fecha final */}
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide flex items-center gap-1.5 shrink-0">
                            Fecha inicial
                            <span className="text-slate-400 hover:text-blue-500 cursor-pointer" title="Fecha inicial del rango de búsqueda">
                                <FiHelpCircle size={13} />
                            </span>
                        </label>
                        <div className="relative flex-1 max-w-xs">
                            <input
                                type="date"
                                value={fechaInicial}
                                onChange={(e) => setFechaInicial(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide shrink-0">
                            Fecha final
                        </label>
                        <div className="relative flex-1 max-w-xs">
                            <input
                                type="date"
                                value={fechaFinal}
                                onChange={(e) => setFechaFinal(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Fila 2: Estado / Recursos físicos */}
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide shrink-0">
                            Estado
                        </label>
                        <div className="flex-1 max-w-xs">
                            <select
                                value={estado}
                                onChange={(e) => setEstado(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all uppercase"
                            >
                                {ESTADOS_CITA.map(st => (
                                    <option key={st.value} value={st.value}>{st.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide shrink-0">
                            Recursos físicos
                        </label>
                        <div className="flex-1 max-w-xs">
                            <select
                                value={recursoFisico}
                                onChange={(e) => setRecursoFisico(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all uppercase"
                            >
                                <option value="">Seleccione...</option>
                                {chairs.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fila 3: Solo mostrar pacientes sin futuras citas / Especialidades */}
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide flex items-center gap-1.5 shrink-0">
                            Solo mostrar pacientes sin futuras citas
                            <span className="text-slate-400 hover:text-blue-500 cursor-pointer" title="Muestra únicamente citas de pacientes que no tienen ninguna cita posterior programada a partir de hoy">
                                <FiHelpCircle size={13} />
                            </span>
                        </label>
                        <div className="flex items-center justify-end flex-1 max-w-xs">
                            <button
                                type="button"
                                onClick={() => setSoloSinFuturasCitas(!soloSinFuturasCitas)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
                                    soloSinFuturasCitas ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
                                }`}
                            >
                                <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide shrink-0">
                            Especialidades
                        </label>
                        <div className="flex-1 max-w-xs">
                            <select
                                value={especialidad}
                                onChange={(e) => setEspecialidad(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all uppercase"
                            >
                                <option value="">Seleccione...</option>
                                {specialties.map(esp => (
                                    <option key={esp.id} value={esp.nombre || esp.id}>{esp.nombre || esp.id}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fila 4: Filtrar por / Profesionales */}
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide shrink-0">
                            Filtrar por
                        </label>
                        <div className="flex-1 max-w-xs">
                            <select
                                value={filtrarPor}
                                onChange={(e) => setFiltrarPor(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            >
                                <option value="fecha_cita">Fecha de la cita</option>
                                <option value="fecha_creacion">Fecha de creación de la cita</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide shrink-0">
                            Profesionales
                        </label>
                        <div className="flex-1 max-w-xs">
                            <select
                                value={profesional}
                                onChange={(e) => setProfesional(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all uppercase"
                            >
                                <option value="">Seleccione...</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.nombreCompleto || d.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fila 5: Sucursal / Botón Buscar */}
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-black text-slate-600 tracking-wide shrink-0">
                            Sucursal
                        </label>
                        <div className="flex-1 max-w-xs">
                            <select
                                value={sucursal}
                                onChange={(e) => setSucursal(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all uppercase"
                            >
                                <option value="">Seleccione...</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-end">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-8 py-2.5 bg-[#8cc33f] hover:bg-[#7db02b] text-white rounded-lg font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-[#8cc33f]/20 active:scale-95 flex items-center gap-2"
                        >
                            {loading ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Buscando...</>
                            ) : (
                                <><FiSearch size={14} /> Buscar</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── 3. RESULTS TABLE ─── */}
            <div className="bg-white rounded-[24px] border border-slate-200/70 shadow-sm overflow-hidden flex flex-col min-h-[350px]">
                {/* Table Action Bar (OralDrive Match: % Porcentaje, Impresora, Buscar) */}
                <div className="px-6 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="text-[11px] text-slate-400 font-medium italic">
                        Arrastre el encabezado de una columna aquí para agrupar por esa columna
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                        {/* Botón Porcentaje de Ocupación */}
                        <button
                            onClick={() => setShowOccupancyModal(true)}
                            disabled={!hasSearched || results.length === 0}
                            title="Porcentaje de ocupación"
                            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200"
                        >
                            %
                        </button>

                        {/* Botón Imprimir Reporte */}
                        <button
                            onClick={handlePrint}
                            disabled={!hasSearched || results.length === 0}
                            title="Imprimir reporte"
                            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200"
                        >
                            <FiPrinter size={15} />
                        </button>

                        {/* Buscador en la tabla */}
                        <div className="relative ml-2">
                            <FiSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 uppercase tracking-wider w-full sm:w-52"
                            />
                        </div>
                    </div>
                </div>

                {/* Table Area */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                                <th className="px-5 py-3.5 text-left">Fecha y Hora</th>
                                <th className="px-5 py-3.5 text-left">Paciente</th>
                                <th className="px-5 py-3.5 text-left">Profesional / Esp.</th>
                                <th className="px-5 py-3.5 text-left">Espacio / Sede</th>
                                <th className="px-5 py-3.5 text-center">Estado</th>
                                <th className="px-5 py-3.5 text-left">Futura cita</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {!hasSearched ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                                                <FiSearch size={22} />
                                            </div>
                                            <p className="text-[12px] font-black text-slate-700 uppercase tracking-wide">
                                                Seleccione los filtros y haga clic en Buscar
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-medium max-w-md">
                                                Defina el rango de fechas y los criterios deseados en el panel superior para generar la consulta detallada de la agenda.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                                Consultando agenda...
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                                No se encontraron citas con los filtros seleccionados
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                Pruebe ajustando el rango de fechas o los criterios de búsqueda
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayData.map((item) => (
                                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                        {/* Fecha y Hora */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 uppercase">
                                                    {item.fechaInicio ? format(item.fechaInicio, "dd/MM/yyyy") : "—"}
                                                </span>
                                                <span className="text-[10px] font-bold text-blue-600">
                                                    {item.fechaInicio ? format(item.fechaInicio, "hh:mm a") : "—"} ({item.duracion} min)
                                                </span>
                                                {item.fechaCreacion && (
                                                    <span className="text-[9px] font-medium text-slate-400" title="Fecha en que se registró la cita">
                                                        Reg: {format(item.fechaCreacion, "dd/MM/yy hh:mm a")}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Paciente */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 uppercase tracking-tight">
                                                    {item.pacienteNombre}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    {item.pacienteDoc ? `Doc: ${item.pacienteDoc}` : "Sin doc."}
                                                </span>
                                                {item.pacienteTel && (
                                                    <span className="text-[10px] text-slate-400">
                                                        Tel: {item.pacienteTel}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Profesional / Especialidad */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 uppercase">
                                                    {item.profesionalNombre}
                                                </span>
                                                <span className="text-[10px] font-medium text-slate-400 uppercase">
                                                    {item.profesionalEspecialidad}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Espacio / Sede */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 uppercase">
                                                    {item.consultorioNombre}
                                                </span>
                                                <span className="text-[10px] font-extrabold text-blue-600 uppercase">
                                                    {item.sucursalNombre}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Estado */}
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9.5px] font-black uppercase tracking-wider border ${getStatusBadge(item.estado)}`}>
                                                {item.estado}
                                            </span>
                                        </td>

                                        {/* Futura Cita */}
                                        <td className="px-5 py-3.5">
                                            {item.futuraCita ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 uppercase">
                                                        {format(item.futuraCita, "dd/MM/yyyy")}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-emerald-600">
                                                        {format(item.futuraCita, "hh:mm a")}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── 4. MODAL DE PORCENTAJE DE OCUPACIÓN (OralDrive Match) ─── */}
            {showOccupancyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-sm w-full p-6 text-center space-y-4">
                        <h3 className="text-base font-black text-slate-800 tracking-tight">
                            Porcentaje de ocupación
                        </h3>
                        <p className="text-xs font-bold text-slate-600 leading-relaxed">
                            El porcentaje de ocupación de la agenda es del{" "}
                            <span className="font-black text-slate-900">{occupancyPercentage}%</span>
                        </p>
                        <div className="pt-2">
                            <button
                                onClick={() => setShowOccupancyModal(false)}
                                className="px-8 py-2 bg-[#8cc33f] hover:bg-[#7db02b] text-white rounded-lg font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-[#8cc33f]/20 active:scale-95"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
