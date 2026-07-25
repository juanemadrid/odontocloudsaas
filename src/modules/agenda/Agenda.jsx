import React, { useState, useMemo } from "react";
import { FiHome, FiList, FiGrid, FiPrinter, FiDownload, FiPlus, FiSettings, FiPieChart, FiMenu, FiX, FiCalendar, FiClock, FiUser, FiMapPin } from "react-icons/fi";
import { useAgenda } from "./hooks/useAgenda";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AgendaWeeklyView from "./components/AgendaWeeklyView"; // New Weekly View
import AgendaDetailView from "./components/AgendaDetailView"; // New Detail View
import AgendaDailyTable from "./components/AgendaDailyTable";
import AgendaSidebar from "./components/AgendaSidebar";
import AppointmentModal from "./components/AppointmentModal";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { sendConfirmation, openWhatsAppWebDirect } from "../../services/WhatsAppService";

export default function Agenda() {
    const { userProfile } = useAuth(); // NEW: Access clinic info
    const { can } = usePermissions();
    const {
        selectedDate, setSelectedDate,
        viewMode, setViewMode,
        doctors, appointments,
        branches, chairs,
        specialties, entities, priceList, patientsMap,
        createAppointment, updateAppointment, deleteAppointment,
        filters
    } = useAgenda();

    const [modalOpen, setModalOpen] = useState(false);
    const [editingApt, setEditingApt] = useState(null);
    const [slotData, setSlotData] = useState(null);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancellingAptId, setCancellingAptId] = useState(null);

    // Escuchar el evento de reset desde el sidebar
    React.useEffect(() => {
        const handleReset = () => {
            setModalOpen(false);
            setEditingApt(null);
            setSlotData(null);
            setCancelModalOpen(false);
            setCancellingAptId(null);
        };
        window.addEventListener("reset-module-agenda", handleReset);
        return () => {
            window.removeEventListener("reset-module-agenda", handleReset);
        };
    }, []);

    // Escuchar evento para abrir nueva cita con datos prellenados (ej. desde notificaciones)
    React.useEffect(() => {
        const handleOpenNewAppointment = (e) => {
            const data = e.detail || {};
            // Convertir fecha string a objeto Date para start
            let start = null;
            if (data.fecha) {
                start = new Date(data.fecha + "T08:00:00");
            }
            setEditingApt(null);
            setSlotData({
                start: start || new Date(),
                pacienteId: data.pacienteId || "",
                pacienteNombre: data.pacienteNombre || "",
                comentario: data.motivo || "",
                fecha: data.fecha || "",
            });
            setModalOpen(true);
        };
        window.addEventListener("open-new-appointment", handleOpenNewAppointment);
        return () => {
            window.removeEventListener("open-new-appointment", handleOpenNewAppointment);
        };
    }, []);

    // --- Metrics Calculation ---
    const occupancyPercentage = useMemo(() => {
        if (!appointments || appointments.length === 0) return 0;

        // Simple estimation: 8am - 8pm (12 hours) * 60 = 720 mins capacity per day per doctor
        // For this MVP, let's assume 1 doctor capacity for simplicity or use doctors.length
        const totalCapacityMins = 12 * 60 * (doctors.length || 1);

        // Filter appointments for the selected date (approximate for daily view)
        const dailyApts = appointments.filter(a => new Date(a.start).toDateString() === selectedDate.toDateString());

        const totalDuration = dailyApts.reduce((acc, curr) => {
            const start = new Date(curr.start);
            const end = new Date(curr.end);
            return acc + (end - start) / 60000;
        }, 0);

        return Math.min(100, Math.round((totalDuration / totalCapacityMins) * 100));
    }, [appointments, selectedDate, doctors]);

    const handleSlotClick = (doctorId, time, dateOverride) => {
        if (!can("Agenda", "Agenda", "crear")) {
            toast.error("No tienes permisos para crear citas");
            return;
        }
        const [hh, mm] = time.split(":").map(Number);
        const start = dateOverride ? new Date(dateOverride) : new Date(selectedDate);
        start.setHours(hh, mm, 0, 0);

        setSlotData({ doctorId, start });
        setEditingApt(null);
        setModalOpen(true);
    };

    const handleEventClick = (apt) => {
        setEditingApt(apt);
        setSlotData(null);
        setModalOpen(true);
    };

    const handleSave = async (data) => {
        if (editingApt) {
            if (!can("Agenda", "Agenda", "editar")) {
                toast.error("No tienes permisos para editar citas");
                return;
            }
            await updateAppointment(editingApt.id, data);
        } else {
            if (!can("Agenda", "Agenda", "crear")) {
                toast.error("No tienes permisos para crear citas");
                return;
            }
            await createAppointment(data);
        }
        setModalOpen(false);
    };

    const handleDelete = async (id, skipConfirm = false) => {
        if (!can("Agenda", "Agenda", "eliminar")) {
            toast.error("No tienes permisos para eliminar citas");
            return;
        }
        const targetId = typeof id === "string" ? id : editingApt?.id;
        console.log("handleDelete called. id parameter:", id, "targetId:", targetId, "skipConfirm:", skipConfirm);
        if (!targetId) {
            toast.error("No se encontró el ID de la cita a eliminar");
            return;
        }

        if (skipConfirm || window.confirm("¿Está seguro que quiere eliminar esta cita?")) {
            try {
                await deleteAppointment(targetId);
                toast.success("Cita eliminada correctamente");
                setModalOpen(false);
            } catch (error) {
                console.error("Error deleting appointment:", error);
                toast.error("Error al eliminar cita: " + error.message);
            }
        }
    };

    const handleWhatsApp = (cita) => {
        const targetCita = cita || editingApt;
        if (!targetCita) {
            toast.error("No se ha seleccionado ninguna cita");
            return;
        }
        openWhatsAppWebDirect(targetCita, userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "Clínica Dental");
        toast.success("Abriendo WhatsApp con mensaje de recordatorio...");
    };

    const changeDate = (days) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d);
    };

    const handleDownload = async (actionType = "download") => {
        if (appointments.length === 0) {
            toast.error("No hay citas para exportar en esta fecha");
            return;
        }

        const toastId = toast.loading(
            actionType === "print"
                ? "Preparando vista de impresión institucional..."
                : "Generando documento PDF institucional..."
        );
        
        try {
            // 1. Create a hidden container for PDF generation with refined styling
            const printElement = document.createElement("div");
            printElement.className = "pdf-export-container";
            printElement.style.position = "absolute";
            printElement.style.left = "-9999px";
            printElement.style.top = "0";
            printElement.style.width = "1200px"; // Increased width for better column distribution
            printElement.style.padding = "60px";
            printElement.style.backgroundColor = "white";
            printElement.style.color = "#1e293b";
            printElement.style.fontFamily = "'Inter', sans-serif";
            
            const rawLogoUrl = userProfile?.tenant?.logo || "";
            const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const logoUrl = (isLocalDev && rawLogoUrl && rawLogoUrl.includes('firebasestorage.googleapis.com'))
                ? `/odontocloud-react/api/proxy-logo?url=${encodeURIComponent(rawLogoUrl)}`
                : rawLogoUrl;

            // 2. Build a CUSTOM professional header for the PDF (Matching Budget/Receipt premium style)
            const logoHTML = logoUrl 
                ? `<img src="${logoUrl}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 16px;" crossOrigin="anonymous" />`
                : `<div style="width: 80px; height: 80px; background: #2563eb; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px; font-weight: 900;">${userProfile?.tenant?.nombre?.substring(0, 1) || "O"}</div>`;

            const headerHTML = `
                <div style="position: relative; padding-bottom: 25px; margin-bottom: 35px; border-bottom: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start;">
                    <!-- Sleek Gradient Bar -->
                    <div style="position: absolute; top: -60px; left: -60px; right: -60px; height: 8px; background: linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa);"></div>
                    
                    <div style="display: flex; gap: 20px; align-items: center;">
                        ${logoHTML}
                        <div>
                            <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "Clínica Dental"}</h1>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Nit:</strong> ${userProfile?.tenant?.nit || "---"}</p>
                            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b; font-weight: 500;"><strong style="color: #94a3b8; font-size: 8px; text-transform: uppercase; margin-right: 5px;">Dirección:</strong> ${userProfile?.tenant?.direccion || "---"}</p>
                            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b; font-weight: 500;"><strong style="color: #94a3b8; font-size: 8px; text-transform: uppercase; margin-right: 5px;">Tel:</strong> ${userProfile?.tenant?.telefono || "---"} <span style="color: #cbd5e1; margin: 0 5px;">|</span> <strong style="color: #94a3b8; font-size: 8px; text-transform: uppercase; margin-right: 5px;">Email:</strong> ${userProfile?.tenant?.email || "---"}</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                        <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 12px 25px; border-radius: 14px; text-align: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.05);">
                            <span style="font-size: 11px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; display: block;">Reporte de Agenda</span>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 9px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7px; text-transform: uppercase; margin-right: 5px;">Fecha de Agenda:</strong> ${selectedDate.toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p style="margin: 2px 0 0 0; font-size: 9px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7px; text-transform: uppercase; margin-right: 5px;">Emisión:</strong> ${new Date().toLocaleDateString("es-CO", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                    </div>
                </div>
            `;

            // 3. Clone and clean the table
            const tableContainer = document.querySelector(".flex-1.overflow-y-auto.custom-scrollbar.bg-white")?.cloneNode(true);
            if (tableContainer) {
                // REMOVE TRUNCATION AND FIXED WIDTHS FOR PDF
                tableContainer.querySelectorAll(".no-print").forEach(el => el.remove());
                
                // FORCE SHOW PRINT-ONLY ELEMENTS (LIKE STATUS)
                tableContainer.querySelectorAll(".print-only").forEach(el => {
                    el.style.display = "inline-block";
                    el.style.visibility = "visible";
                    el.style.opacity = "1";
                    el.style.fontSize = "10px";
                    el.style.fontWeight = "900";
                    el.style.padding = "4px 10px";
                    el.style.borderRadius = "6px";
                    el.style.textAlign = "center";
                    el.style.minWidth = "100px";
                    
                    // Detect background color from Tailwind classes to apply inline for PDF
                    if (el.className.includes("bg-blue-100")) { el.style.backgroundColor = "#dbeafe"; el.style.color = "#1d4ed8"; el.style.borderColor = "#bfdbfe"; }
                    else if (el.className.includes("bg-emerald-100")) { el.style.backgroundColor = "#d1fae5"; el.style.color = "#047857"; el.style.borderColor = "#a7f3d0"; }
                    else if (el.className.includes("bg-orange-100")) { el.style.backgroundColor = "#ffedd5"; el.style.color = "#c2410c"; el.style.borderColor = "#fed7aa"; }
                    else if (el.className.includes("bg-rose-100")) { el.style.backgroundColor = "#ffe4e6"; el.style.color = "#be123c"; el.style.borderColor = "#fecdd3"; }
                    else if (el.className.includes("bg-purple-100")) { el.style.backgroundColor = "#f3e8ff"; el.style.color = "#7e22ce"; el.style.borderColor = "#e9d5ff"; }
                    else if (el.className.includes("bg-lime-100")) { el.style.backgroundColor = "#f7fee7"; el.style.color = "#4d7c0f"; el.style.borderColor = "#d9f99d"; }
                    else if (el.className.includes("bg-slate-300")) { el.style.backgroundColor = "#cbd5e1"; el.style.color = "#1e293b"; el.style.borderColor = "#94a3b8"; }
                    else { el.style.backgroundColor = "#f1f5f9"; el.style.color = "#475569"; el.style.borderColor = "#e2e8f0"; }
                });
                
                // Clear all classes that might restrict width or truncate
                tableContainer.querySelectorAll("*").forEach(el => {
                    el.classList.remove("truncate", "whitespace-nowrap", "max-w-[80px]", "max-w-[70px]", "max-w-[100px]", "max-w-[400px]");
                    if (el.className.includes("max-w-")) {
                        el.style.maxWidth = "none";
                    }
                });
                
                const table = tableContainer.querySelector("table");
                if (table) {
                    table.style.width = "100%";
                    table.style.borderCollapse = "separate";
                    table.style.borderSpacing = "0 8px"; // Add spacing between rows for clarity
                    table.style.tableLayout = "auto";
                    
                    const ths = table.querySelectorAll("th");
                    ths.forEach(th => {
                        th.style.backgroundColor = "#f8fafc";
                        th.style.color = "#475569";
                        th.style.fontSize = "13px";
                        th.style.padding = "20px 15px";
                        th.style.textAlign = "left";
                        th.style.borderBottom = "2px solid #e2e8f0";
                        th.style.fontWeight = "900";
                        th.style.textTransform = "uppercase";
                        th.style.letterSpacing = "1px";
                    });

                    const rows = table.querySelectorAll("tbody tr");
                    rows.forEach(row => {
                        row.style.backgroundColor = "white";
                    });

                    const tds = table.querySelectorAll("td");
                    tds.forEach((td, idx) => {
                        td.style.padding = "18px 15px";
                        td.style.borderBottom = "1px solid #f1f5f9";
                        td.style.fontSize = "14px";
                        td.style.color = "#1e293b";
                        td.style.verticalAlign = "middle";
                        
                        // Apply specific styles based on column content
                        const text = td.innerText.toLowerCase();
                        
                        const pTags = td.querySelectorAll("p");
                        pTags.forEach(p => {
                            p.style.margin = "0";
                            p.style.whiteSpace = "normal"; // Wrap names and comments
                            p.style.overflow = "visible";
                            p.style.fontSize = "14px";
                            p.style.lineHeight = "1.4";
                            p.style.fontWeight = "700";
                            if (p.classList.contains("text-blue-600")) {
                                p.style.color = "#2563eb";
                                p.style.fontSize = "15px";
                                p.style.fontWeight = "900";
                            }
                        });

                        const spans = td.querySelectorAll("span");
                        spans.forEach(span => {
                            span.style.whiteSpace = "normal";
                            span.style.fontSize = "13px";
                            span.style.display = "block";
                            span.style.maxWidth = "none";
                        });
                    });
                }
            }

            // 4. Build Footer (Matching Budget/Receipt signature blocks)
            const footerHTML = `
                <div style="margin-top: 80px; display: flex; justify-content: space-between; gap: 80px; padding: 0 30px;">
                    <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Firma del Profesional</p>
                        <p style="margin: 4px 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Sello y Registro Médico</p>
                    </div>
                    <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Responsable de Agenda</p>
                        <p style="margin: 4px 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Generado por: ${(userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email || "Administrador").toUpperCase()}</p>
                    </div>
                </div>
                <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                    <p style="margin: 0; font-size: 9px; color: #cbd5e1; font-weight: 800; text-transform: uppercase; letter-spacing: 4px;">
                        Documento oficial generado por OdontoCloud Elite Pro
                    </p>
                </div>
            `;

            // Assemble everything
            printElement.innerHTML = headerHTML + tableContainer.innerHTML + footerHTML;
            document.body.appendChild(printElement);

            // Wait for all images to load before rendering canvas
            const images = printElement.querySelectorAll("img");
            await Promise.all(Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));

            // 5. High-quality Capture
            const canvas = await html2canvas(printElement, {
                scale: 2.5, // High resolution matching budget/receipt
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
                windowWidth: 1200 // Match element width
            });

            // 6. Professional PDF Construction
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'a4'
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            
            if (actionType === "print") {
                const pdfBlob = pdf.output('bloburl');
                window.open(pdfBlob, '_blank');
                toast.success("Vista de impresión generada con éxito", { id: toastId });
            } else {
                const dateStr = selectedDate.toISOString().split('T')[0];
                pdf.save(`Reporte_Agenda_${userProfile?.tenant?.nombre?.replace(/\s+/g, '_')}_${dateStr}.pdf`);
                toast.success("Documento PDF institucional generado con éxito", { id: toastId });
            }
            
            // Cleanup
            document.body.removeChild(printElement);
        } catch (error) {
            console.error("Error generating professional PDF:", error);
            toast.error("Error al procesar el documento institucional", { id: toastId });
        }
    };

    return (
        <div className="flex flex-col bg-slate-50 h-[calc(100vh-60px)] overflow-hidden">
            {/* 🖨️ PRINT ONLY HEADER (Premium Institutional Look) */}
            <div className="print-only w-full mb-6 pb-4 border-b-2 border-blue-600">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        {userProfile?.tenant?.logo ? (
                            <img 
                                src={userProfile.tenant.logo} 
                                alt="Logo" 
                                className="w-16 h-16 object-contain rounded-xl" 
                            />
                        ) : (
                            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-black">
                                {userProfile?.tenant?.nombre?.substring(0, 1) || "O"}
                            </div>
                        )}
                        <div className="space-y-0.5">
                            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                {userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || userProfile?.tenant?.name || "OdontoCloud Clínica"}
                            </h1>
                            <p className="text-[9pt] text-slate-500 font-bold uppercase tracking-wide">
                                NIT: {userProfile?.tenant?.nit || "NIT NO CONFIGURADO"}
                            </p>
                            <p className="text-[9pt] text-slate-500 font-medium uppercase truncate max-w-[400px]">
                                {userProfile?.tenant?.direccion || userProfile?.tenant?.address || "DIRECCIÓN NO CONFIGURADA"}
                            </p>
                            <div className="flex gap-4">
                                <p className="text-[8pt] text-slate-400 font-bold uppercase">
                                    TEL: {userProfile?.tenant?.telefono || userProfile?.tenant?.phone || "---"}
                                </p>
                                <p className="text-[8pt] text-slate-400 font-bold uppercase">
                                    EMAIL: {userProfile?.tenant?.email || "---"}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="text-right space-y-1">
                        <div className="text-[10pt] font-black text-blue-700 uppercase tracking-widest">
                            {selectedDate.toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <p className="text-[8pt] font-black text-slate-400 uppercase tracking-[0.1em]">Reporte de Agenda Diaria</p>
                    </div>
                </div>
            </div>

            {/* ✍️ PRINT ONLY FOOTER (Signatures) */}
            <div className="print-only w-full mt-20">
                <div className="grid grid-cols-2 gap-20">
                    <div className="border-t border-slate-300 pt-4">
                        <p className="text-[9pt] font-black text-slate-800 uppercase">Firma del Profesional</p>
                        <p className="text-[8pt] text-slate-400 font-bold uppercase mt-1">Sello y Registro Médico</p>
                    </div>
                    <div className="border-t border-slate-300 pt-4">
                        <p className="text-[9pt] font-black text-slate-800 uppercase">Responsable de Agenda</p>
                        <p className="text-[8pt] text-slate-400 font-bold uppercase mt-1">Generado por: {userProfile?.nombre || userProfile?.email}</p>
                    </div>
                </div>
                <div className="mt-16 text-center">
                    <p className="text-[7pt] text-slate-300 font-bold uppercase tracking-widest">
                        Este documento es un reporte oficial generado por el sistema OdontoCloud el {new Date().toLocaleString()}
                    </p>
                </div>
            </div>

            {/* HEADER AREA (Top Level - Match Pacientes Alignment) */}
            <div className="px-2 md:px-4 lg:px-6 pb-2 shrink-0 no-print">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <FiHome className="text-blue-600" />
                                <span>Institucional</span>
                                <span className="text-slate-200">/</span>
                                <span className="text-slate-800">Agenda</span>
                            </div>
                            <div className="flex items-end gap-4">
                                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight leading-none">
                                    Gestión <span className="text-blue-600">Citas</span>
                                </h2>
                                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full border border-blue-100 mb-1">
                                    <FiPieChart className="text-blue-600" size={12} />
                                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                        Ocupación: {occupancyPercentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-12 h-1.5 bg-blue-600 rounded-full" />
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => handleDownload("print")}
                                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-90"
                                title="Imprimir Agenda"
                            >
                                <FiPrinter size={18} />
                            </button>
                            <button 
                                onClick={() => handleDownload("download")}
                                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-90"
                                title="Descargar Reporte PDF"
                            >
                                <FiDownload size={18} />
                            </button>
                            {can("Agenda", "Agenda", "crear") && (
                                <button 
                                    onClick={() => {
                                        setEditingApt(null);
                                        setSlotData(null);
                                        setModalOpen(true);
                                    }}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-[18px] font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                                >
                                    <FiPlus size={18} /> Nueva Cita
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT ROW (Sidebar + View) */}
            <div className="flex flex-1 min-h-0 px-2 md:px-4 lg:px-6 pb-6 relative">
                {/* 1. SIDEBAR (Collapsible) */}
                <div className={`
                    transition-all duration-500 ease-in-out overflow-hidden no-print
                    ${sidebarVisible ? 'w-64 opacity-100 pr-4' : 'w-0 opacity-0 pr-0'}
                    hidden md:flex flex-col h-full
                `}>
                    <div className="min-w-[240px]">
                        <AgendaSidebar
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                            doctors={doctors}
                            selectedDoctor={filters.filterDocId}
                            onSelectDoctor={filters.setFilterDocId}
                            branches={branches}
                            selectedBranch={filters.filterBranchId}
                            onSelectBranch={filters.setFilterBranchId}
                            chairs={chairs}
                            appointments={appointments}
                        />
                    </div>
                </div>

                {/* 2. MAIN CONTENT */}
                <div className="flex-1 flex flex-col h-full min-w-0 gap-4">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between bg-white p-2 rounded-[22px] shadow-sm border border-slate-100 shrink-0 no-print">
                        <div className="flex items-center gap-2 pl-2">
                            {/* Hamburger Button */}
                            <button 
                                onClick={() => setSidebarVisible(!sidebarVisible)}
                                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 mr-2
                                    ${sidebarVisible 
                                        ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                                        : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'}`}
                                title={sidebarVisible ? "Ocultar calendario" : "Mostrar calendario"}
                            >
                                {sidebarVisible ? <FiX size={18} /> : <FiMenu size={18} />}
                            </button>

                            <button onClick={() => changeDate(-1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90">◀</button>
                            <div className="min-w-[220px] text-center font-black text-slate-700 text-[12px] uppercase tracking-[0.1em]">
                                {selectedDate.toLocaleDateString("es-CO", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                            <button onClick={() => changeDate(1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90">▶</button>
                            <button onClick={() => setSelectedDate(new Date())} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95">
                                Hoy
                            </button>
                        </div>

                        <div className="flex bg-slate-100/50 p-1 rounded-[14px] border border-slate-100">
                            <button
                                onClick={() => setViewMode('day')}
                                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <FiList size={14} /> Día
                            </button>
                            <button
                                onClick={() => setViewMode('week')}
                                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <FiGrid size={14} /> Semana
                            </button>
                            <button
                                onClick={() => setViewMode('detail')}
                                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'detail' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <FiSettings size={14} /> Detalle
                            </button>
                        </div>
                    </div>

                    {/* VIEW AREA */}
                    <div className="flex-1 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden relative">
                        {viewMode === 'day' && (
                            <AgendaDailyTable
                                appointments={appointments}
                                doctors={doctors}
                                branches={branches}
                                chairs={chairs}
                                patientsMap={patientsMap}
                                sidebarVisible={sidebarVisible}
                                onEventClick={handleEventClick}
                                onUpdateStatus={async (id, status) => {
                                    if (!can("Agenda", "Agenda", "editar")) {
                                        toast.error("No tienes permisos para editar citas");
                                        return;
                                    }
                                    if (status === 'cancelled') {
                                        setCancellingAptId(id);
                                        setCancelModalOpen(true);
                                    } else {
                                        try {
                                            await updateAppointment(id, { status });
                                            toast.success("Estado de cita actualizado");
                                        } catch (err) {
                                            toast.error("Error al actualizar estado: " + err.message);
                                        }
                                    }
                                }}
                                onWhatsApp={(apt) => {
                                    handleWhatsApp(apt);
                                }}
                            />
                        )}
                        {viewMode === 'week' && <AgendaWeeklyView date={selectedDate} appointments={appointments} onSlotClick={handleSlotClick} onEventClick={handleEventClick} doctors={doctors} />}
                        {viewMode === 'detail' && <AgendaDetailView appointments={appointments} doctors={doctors} />}
                    </div>
                </div>
            </div>

            <AppointmentModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                initialData={editingApt || slotData || { start: new Date() }}
                doctors={doctors}
                chairs={chairs}
                branches={branches}
                specialties={specialties}
                entities={entities}
                priceList={priceList}
                onSave={handleSave}
                onDelete={handleDelete}
            />

            <Modal
                isOpen={cancelModalOpen}
                onClose={() => { setCancelModalOpen(false); setCancellingAptId(null); }}
                title="Confirmar Cancelación de Cita"
                size="sm"
                footer={
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => { setCancelModalOpen(false); setCancellingAptId(null); }}
                        >
                            No, Conservar
                        </Button>
                        <Button
                            variant="danger"
                            onClick={async () => {
                                if (cancellingAptId) {
                                    try {
                                        await updateAppointment(cancellingAptId, { 
                                            status: 'cancelled',
                                            estado: 'CANCELADO'
                                        });
                                        toast.success("Cita cancelada correctamente");
                                    } catch (err) {
                                        toast.error("Error al cancelar cita: " + err.message);
                                    }
                                }
                                setCancelModalOpen(false);
                                setCancellingAptId(null);
                            }}
                        >
                            Sí, Cancelar
                        </Button>
                    </div>
                }
            >
                <div className="py-2">
                    <p className="text-slate-600 text-sm font-semibold text-center leading-relaxed">
                        ¿Estás seguro de que deseas cancelar esta cita? Esta acción liberará el espacio en la agenda para que otros pacientes puedan programar citas en este horario.
                    </p>
                </div>
            </Modal>
        </div>
    );
}
