import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { buildDashboardPath } from '../../../utils/dashboardBasePath';
import { FiClock, FiUser, FiHome, FiActivity, FiSearch, FiFilter, FiChevronDown, FiCalendar, FiSmartphone, FiEdit2 } from 'react-icons/fi';

const APPOINTMENT_STATUSES = [
    { id: 'pending', label: 'Sin Confirmar', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    { id: 'confirmed', label: 'Confirmada', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { id: 'attended', label: 'Atendido', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { id: 'urgencia', label: 'Urgencia', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    { id: 'sin-cont-web', label: 'Sin Cont. WEB', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    { id: 'no-show', label: 'No asiste', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    { id: 'cancelled', label: 'Cancelado', color: 'bg-slate-300 text-slate-800 border-slate-400' },
    { id: 'waiting', label: 'En espera', color: 'bg-lime-100 text-lime-700 border-lime-200' },
];

function StatusSelector({ currentStatus, onChange }) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef(null);
    const [dropdownStyle, setDropdownStyle] = useState({});

    useEffect(() => {
        if (open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: '160px',
                zIndex: 99999,
            });
        }
    }, [open]);

    const status = APPOINTMENT_STATUSES.find(s => s.id === currentStatus) || APPOINTMENT_STATUSES[0];
    const isCancelled = currentStatus === 'cancelled';

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={(e) => { e.stopPropagation(); if (!isCancelled) setOpen(!open); }}
                disabled={isCancelled}
                className={`flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-tight transition-all ${isCancelled ? 'opacity-80 cursor-not-allowed' : 'active:scale-95 cursor-pointer'} ${status.color} min-w-[100px]`}
            >
                <span>{status.label}</span>
                {!isCancelled && <FiChevronDown className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />}
            </button>

            {open && ReactDOM.createPortal(
                <>
                    <div className="fixed inset-0 z-[99998]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
                    <div 
                        style={dropdownStyle}
                        className="bg-white shadow-xl rounded-xl border border-slate-100 py-1 animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                        {APPOINTMENT_STATUSES.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(s.id);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center gap-2 ${currentStatus === s.id ? 'bg-blue-50/50' : ''}`}
                            >
                                <div className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]}`} />
                                {s.label}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

export default function AgendaDailyTable({ appointments, doctors, branches, chairs, patientsMap = {}, onEventClick, onUpdateStatus, onWhatsApp, sidebarVisible }) {
    const navigate = useNavigate();
    const location = useLocation();

    const formatTime = (date) => {
        if (!date) return "--:--";
        const d = new Date(date);
        return d.toLocaleTimeString("es-CO", { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const hydratedAppointments = useMemo(() => {
        return appointments.map(apt => {
            const doc = doctors.find(d => d.id === apt.doctorId);
            const branch = branches.find(b => b.id === apt.sucursalId);
            const chair = chairs.find(c => c.id === apt.consultorioId);
            
            // Hydrate live phone from patientsMap if available
            const pKey1 = apt.pacienteId ? String(apt.pacienteId).trim() : "";
            const pKey2 = apt.patientId ? String(apt.patientId).trim() : "";
            const pKey3 = apt.documento ? String(apt.documento).trim() : "";
            const pKey4 = apt.nroDocumento ? String(apt.nroDocumento).trim() : "";
            const pNameKey = (apt.paciente || apt.pacienteNombre || "").trim().toLowerCase();
            
            const livePatient = (pKey1 && patientsMap[pKey1]) ||
                                (pKey2 && patientsMap[pKey2]) ||
                                (pKey3 && patientsMap[pKey3]) ||
                                (pKey4 && patientsMap[pKey4]) ||
                                (pNameKey && patientsMap[pNameKey]) || null;
                                
            const liveCelular = livePatient?.celular || livePatient?.celularPaciente || livePatient?.telefono || livePatient?.telefonoPaciente || apt.celular || apt.celularPaciente || apt.telefono || "";

            let doctorDisplayName = "S/A";
            if (doc) {
                const firstName = (doc.nombre || doc.nombres || "").trim().split(/\s+/)[0];
                const firstLastName = (doc.apellido || doc.apellidos || "").trim().split(/\s+/)[0];
                doctorDisplayName = `${firstName} ${firstLastName}`.trim() || doc.nombre || "S/A";
            } else {
                const rawName = apt.doctor || apt.doctorName || "";
                if (rawName) {
                    const parts = rawName.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        doctorDisplayName = `${parts[0]} ${parts[1]}`;
                    } else {
                        doctorDisplayName = rawName;
                    }
                }
            }

            return {
                ...apt,
                celular: liveCelular,
                doctorDisplayName,
                sucursalDisplayName: branch?.nombre || apt.sucursal || apt.sucursalId || "PRINCIPAL",
                chairDisplayName: chair?.nombre || apt.consultorioName || apt.consultorioId || "BOX 1"
            };
        });
    }, [appointments, doctors, branches, chairs, patientsMap]);

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            <div className="h-full flex flex-col">
                <div className="w-full h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                        {hydratedAppointments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] opacity-40">
                                <FiCalendar className="text-slate-300 text-2xl mb-2" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin citas registradas</span>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <table className="w-full border-separate border-spacing-0">
                                    <thead className="bg-slate-50/50 sticky top-0 z-30">
                                        <tr className={`font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 transition-all ${sidebarVisible ? 'text-[9px]' : 'text-[11px]'}`}>
                                            <th className="py-4 px-4 text-left">Hora</th>
                                            <th className="py-4 px-2 text-left">Paciente</th>
                                            <th className="py-4 px-2 text-left">Doctor</th>
                                            <th className="py-4 px-2 text-left no-print">Sede</th>
                                            <th className="py-4 px-2 text-left">Espacio</th>
                                            <th className="py-4 px-2 text-left">Comentario</th>
                                            <th className="py-4 px-2 text-center">Estado</th>
                                            <th className="py-4 px-2 text-center no-print">Actual</th>
                                            <th className="py-4 px-6 text-right no-print">ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {hydratedAppointments.map((apt) => (
                                            <tr
                                                key={apt.id}
                                                className="hover:bg-blue-50/10 transition-all border-l-[3px] border-l-transparent hover:border-l-blue-600 group"
                                            >
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className={`font-black text-slate-800 transition-all print:text-blue-600 ${sidebarVisible ? 'text-[10px]' : 'text-[13px]'}`}>{formatTime(apt.start)}</span>
                                                        <span className={`text-slate-400 font-bold uppercase transition-all ${sidebarVisible ? 'text-[8px]' : 'text-[10px]'}`}>{formatTime(apt.end)}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <div className="flex flex-col min-w-[150px]">
                                                        <p 
                                                            className={`font-black text-blue-600 hover:underline cursor-pointer uppercase transition-all print:text-slate-800 print:whitespace-normal ${sidebarVisible ? 'text-[10px] truncate max-w-[150px]' : 'text-[13px] truncate max-w-[250px]'}`} 
                                                            onClick={() => {
                                                                const patientId = apt.pacienteId || apt.patientId;
                                                                if (patientId) {
                                                                    navigate(buildDashboardPath(`pacientes?id=${patientId}`));
                                                                } else {
                                                                    onEventClick(apt);
                                                                }
                                                            }} 
                                                            title={apt.paciente || apt.pacienteNombre}
                                                        >
                                                            {apt.paciente || apt.pacienteNombre || "S/N"}
                                                        </p>
                                                        <p className={`text-slate-400 font-bold tracking-tight truncate transition-all ${sidebarVisible ? 'text-[8px]' : 'text-[10px]'}`} title={apt.celular || apt.documento}>{apt.celular || apt.documento || "ID PENDIENTE"}</p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <span className={`font-black text-slate-600 uppercase transition-all block print:whitespace-normal ${sidebarVisible ? 'text-[9px] truncate max-w-[80px]' : 'text-[12px] truncate max-w-[120px]'}`} title={apt.doctorDisplayName}>{apt.doctorDisplayName}</span>
                                                </td>
                                                <td className="py-3 px-2 no-print">
                                                    <span className={`font-black text-slate-500 uppercase truncate block max-w-[70px] transition-all ${sidebarVisible ? 'text-[9px]' : 'text-[12px]'}`} title={apt.sucursalDisplayName}>{apt.sucursalDisplayName}</span>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <span className={`font-black text-slate-500 uppercase block bg-slate-50/50 px-2 py-0.5 rounded border border-slate-100/50 w-fit transition-all print:whitespace-normal ${sidebarVisible ? 'text-[9px] truncate max-w-[80px]' : 'text-[12px] truncate max-w-[120px]'}`} title={apt.chairDisplayName}>{apt.chairDisplayName}</span>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <span className={`text-slate-400 font-bold italic block uppercase transition-all print:whitespace-normal ${sidebarVisible ? 'text-[9px] truncate max-w-[100px]' : 'text-[12px] truncate max-w-[200px]'}`} title={apt.comentario}>{apt.comentario || "-"}</span>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <div className={`flex justify-center transition-all ${sidebarVisible ? 'scale-90' : 'scale-110'} origin-center no-print`}>
                                                        <StatusSelector
                                                            currentStatus={apt.status}
                                                            onChange={(newStatus) => onUpdateStatus?.(apt.id, newStatus)}
                                                        />
                                                    </div>
                                                    <div className={`print-only text-center uppercase font-black text-[9px] px-2 py-1 rounded-md border ${
                                                        APPOINTMENT_STATUSES.find(s => s.id === apt.status)?.color || 'bg-slate-50 text-slate-500 border-slate-100'
                                                    }`}>
                                                        {APPOINTMENT_STATUSES.find(s => s.id === apt.status)?.label || apt.status}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-center no-print">
                                                    <span className={`px-2 py-0.5 rounded-md font-black tracking-tight border uppercase transition-all ${sidebarVisible ? 'text-[8px]' : 'text-[11px]'} ${apt.pagoPendiente > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                        {apt.pagoPendiente > 0 ? `Deuda: $${apt.pagoPendiente.toLocaleString('es-CO')}` : 'Al día'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-6 text-right whitespace-nowrap no-print">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <a
                                                            href={(() => {
                                                                let rawPhone = (apt.celular || apt.telefono || apt.celularPaciente || apt.telefonoPaciente || apt.pacienteCelular || apt.pacienteTelefono || apt.phone || apt.mobile || "").toString().replace(/\D/g, "");
                                                                if (rawPhone.startsWith("0")) rawPhone = rawPhone.slice(1);
                                                                if (rawPhone.length === 10 && !rawPhone.startsWith("57")) {
                                                                    rawPhone = "57" + rawPhone;
                                                                }
                                                                const nombre = apt.paciente || apt.pacienteNombre || apt.nombrePaciente || apt.nombreCompleto || "Paciente";
                                                                
                                                                let fechaStr = "—";
                                                                if (apt.start) {
                                                                    const d = apt.start instanceof Date ? apt.start : new Date(apt.start);
                                                                    fechaStr = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
                                                                } else if (apt.fecha) {
                                                                    fechaStr = apt.fecha;
                                                                }

                                                                let horaStr = "—";
                                                                if (apt.start) {
                                                                    const d = apt.start instanceof Date ? apt.start : new Date(apt.start);
                                                                    horaStr = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
                                                                } else if (apt.horaInicio || apt.hora) {
                                                                    horaStr = apt.horaInicio || apt.hora;
                                                                }
                                                                const doctor = apt.doctorDisplayName || apt.doctorName || apt.dentista || apt.doctor || "su Odontólogo Tratante";
                                                                const textMessage = `Hola *${nombre}*, te saludamos de *CLINICA DENTAL*.\n\nTe recordamos tu cita odontológica programada:\n\n• *Fecha:* ${fechaStr}\n• *Hora:* ${horaStr}\n• *Profesional:* ${doctor}\n\nPor favor responde a este mensaje confirmando tu asistencia. ¡Te esperamos!`;

                                                                const encodedText = encodeURIComponent(textMessage);
                                                                return rawPhone ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodedText}` : `https://api.whatsapp.com/send?text=${encodedText}`;
                                                            })()}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-emerald-500 hover:text-emerald-600 transition-all hover:scale-110 p-1 flex items-center justify-center"
                                                            title="Enviar recordatorio por WhatsApp"
                                                        >
                                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217s.231.006.332.013c.101.007.237-.038.37.285.144.35.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.548-.68.115-.173.231-.144.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
                                                                <path d="M12.037 5c-3.835 0-6.953 3.118-6.954 6.956 0 1.587.537 3.047 1.442 4.212l-1.525 5.57 5.717-1.5c1.111.411 2.316.64 3.578.64 3.838 0 6.954-3.12 6.957-6.958C21.251 8.119 18.133 5 12.037 5zm0 12.651c-1.259 0-2.438-.346-3.441-.954l-.246-.149-2.31.606.617-2.253-.165-.262c-.653-1.037-1.002-2.249-1.002-3.483.001-3.415 2.779-6.194 6.195-6.194 3.415 0 6.192 2.78 6.193 6.196-.002 3.417-2.781 6.197-6.196 6.197z" />
                                                            </svg>
                                                        </a>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onEventClick(apt); }}
                                                            className="text-blue-500 hover:text-blue-600 transition-all hover:scale-110 p-1"
                                                            title="Editar"
                                                        >
                                                            <FiEdit2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Footer info - Hide in print */}
                                <div className="mt-auto p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between no-print">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registros:</span>
                                            <span className="text-[11px] font-black text-blue-600">{hydratedAppointments.length}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">
                                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-200" /> Sin confirmar</div>
                                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Confirmada</div>
                                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Atendido</div>
                                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> Urgencia</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] font-black text-blue-600/40 uppercase tracking-[0.2em]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                        OdontoCloud Live
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Summary Bar */}
            <div className="bg-slate-50 border-t border-slate-100 px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Registros: <span className="text-blue-600">{appointments.length}</span>
                    </span>
                    <div className="flex items-center gap-4 ml-4">
                        {APPOINTMENT_STATUSES.slice(0, 4).map(s => (
                            <div key={s.id} className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]}`} />
                                <span className="text-[9px] font-bold text-slate-400 uppercase">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">OdontoCloud Live</span>
                </div>
            </div>
        </div>
    );
}
