import React, { useState, useMemo, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
    FiHome, FiCalendar, FiUsers, FiFileText, FiBox,
    FiActivity, FiSettings, FiLogOut, FiMenu, FiX, FiClock, FiCheckCircle, FiLayout, FiPieChart, FiGrid, FiSearch, FiDollarSign, FiBriefcase, FiBell, FiCheck, FiSlash, FiUser, FiMessageSquare,
    FiAlertCircle
} from "react-icons/fi";
import logo from "/assets/logo.png"; // Asegúrate de que esta ruta sea correcta
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, addDoc } from "firebase/firestore";

import { usePermissions } from "../hooks/usePermissions";
import CommandPalette from "../components/CommandPalette";

import UserProfileModal from "../components/UserProfileModal";

export default function DashboardLayout({ children, title, subtitle, basePath = "/dashboard_admin" }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [pendingNavigationPath, setPendingNavigationPath] = useState(null);
    const [collapsedDesktop, setCollapsedDesktop] = useState(() => {
        try {
            return localStorage.getItem('oc_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const handleOpenProfile = () => setProfileModalOpen(true);
        window.addEventListener("open-user-profile", handleOpenProfile);
        return () => window.removeEventListener("open-user-profile", handleOpenProfile);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('oc_sidebar_collapsed', collapsedDesktop);
        } catch {}
    }, [collapsedDesktop]);

    const { logout, user, userProfile } = useAuth();
    const { can } = usePermissions();
    const navigate = useNavigate();
    const location = useLocation();

    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notificaciones, setNotificaciones] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null); // notificación seleccionada para confirmar/rechazar
    const [processingRequest, setProcessingRequest] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const inquilino = userProfile?.inquilino;

    useEffect(() => {
        if (!inquilino) return;
        const q = query(
            collection(db, "notificaciones"),
            where("inquilino", "==", inquilino),
            where("target", "==", "admin"),
            orderBy("createdAt", "desc"),
            limit(15)
        );
        const unsub = onSnapshot(q, snap => {
            setNotificaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [inquilino]);



    const handleConfirmRequest = async () => {
        if (!selectedRequest) return;
        setProcessingRequest(true);
        try {
            // Marcar la solicitud como confirmada
            await updateDoc(doc(db, "notificaciones", selectedRequest.id), {
                estado: "confirmada",
                read: true
            });

            // Notificar al paciente que su cita fue confirmada
            await addDoc(collection(db, "notificaciones"), {
                inquilino,
                target: "patient",
                title: "Cita Confirmada ✅",
                message: `Tu solicitud de cita para el ${selectedRequest.fechaSolicitada || "la fecha solicitada"} ha sido confirmada. Pronto te contactaremos con los detalles.`,
                type: "appointment_confirmed",
                pacienteId: selectedRequest.pacienteId,
                read: false,
                createdAt: new Date().toISOString()
            });

            setSelectedRequest(null);
            setNotificationsOpen(false);

            // Navegar a la agenda y abrir el modal con datos prellenados
            navigate(`${basePath}/agenda`);
            // Pequeño delay para que la agenda cargue antes de disparar el evento
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent("open-new-appointment", {
                    detail: {
                        pacienteId: selectedRequest.pacienteId,
                        pacienteNombre: selectedRequest.pacienteNombre || selectedRequest.message?.split(" ha solicitado")[0] || "",
                        fecha: selectedRequest.fechaSolicitada || "",
                        motivo: selectedRequest.motivo || "",
                    }
                }));
            }, 500);

        } catch (e) {
            console.error("Error confirmando solicitud:", e);
        } finally {
            setProcessingRequest(false);
        }
    };

    const handleRejectRequest = async () => {
        if (!selectedRequest) return;
        setProcessingRequest(true);
        try {
            // Marcar la solicitud como rechazada
            await updateDoc(doc(db, "notificaciones", selectedRequest.id), {
                estado: "rechazada",
                read: true
            });

            // Notificar al paciente que no hay disponibilidad
            const motivo = rejectReason.trim() || "no hay disponibilidad en esa fecha";
            await addDoc(collection(db, "notificaciones"), {
                inquilino,
                target: "patient",
                title: "Solicitud de Cita No Disponible ⚠️",
                message: `Lo sentimos, tu solicitud de cita para el ${selectedRequest.fechaSolicitada || "la fecha solicitada"} no pudo ser confirmada porque ${motivo}. Por favor solicita otra fecha o contáctanos.`,
                type: "appointment_rejected",
                pacienteId: selectedRequest.pacienteId,
                read: false,
                createdAt: new Date().toISOString()
            });

            setSelectedRequest(null);
            setRejectReason("");
        } catch (e) {
            console.error("Error rechazando solicitud:", e);
        } finally {
            setProcessingRequest(false);
        }
    };

    // Calculate Trial Days
    const trialDaysRemaining = useMemo(() => {
        if (userProfile?.tenant?.planId !== "trial" || !userProfile?.tenant?.subscriptionEndDate) return null;

        const end = userProfile.tenant.subscriptionEndDate.toDate
            ? userProfile.tenant.subscriptionEndDate.toDate()
            : new Date(userProfile.tenant.subscriptionEndDate);
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }, [userProfile]);

    const subscriptionDates = useMemo(() => {
        if (!userProfile?.tenant?.subscriptionEndDate) return null;
        const end = userProfile.tenant.subscriptionEndDate.toDate
            ? userProfile.tenant.subscriptionEndDate.toDate()
            : new Date(userProfile.tenant.subscriptionEndDate);

        // Start date might be in createdAt
        const start = userProfile.tenant.createdAt?.toDate
            ? userProfile.tenant.createdAt.toDate()
            : (userProfile.tenant.createdAt ? new Date(userProfile.tenant.createdAt) : new Date());

        return {
            start: start.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
            end: end.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
        };
    }, [userProfile]);

    const handleLogout = async () => {
        if (window.hasUnsavedChanges) {
            const confirmLeave = window.confirm("Tienes cambios sin guardar. ¿Seguro que deseas cerrar sesión y perderlos?");
            if (!confirmLeave) return;
            window.hasUnsavedChanges = false;
        }
        await logout();
        navigate("/login");
    };

    const navItems = [
        { id: 'Inicio', icon: FiGrid, label: 'INICIO' },
        { id: 'agenda', icon: FiCalendar, label: 'AGENDA' },
        { id: 'pacientes', icon: FiUsers, label: 'PACIENTES' },
        { id: 'caja', icon: FiDollarSign, label: 'CAJA' },
        { id: 'administracion', icon: FiBriefcase, label: 'ADMINISTRACIÓN' },
        { id: 'reportes', icon: FiPieChart, label: 'REPORTES' },
        { id: 'config', icon: FiSettings, label: 'CONFIGURACIÓN' }
    ];

    const filteredNavItems = useMemo(() => {
        return navItems.filter(item => {
            if (item.id === 'Inicio') return true;
            if (item.id === 'agenda') return can("Agenda", "Agenda", "consultar");
            if (item.id === 'pacientes') return can("Pacientes", "Paciente", "consultar");
            if (item.id === 'caja') return can("Caja", "Caja", "consultar");
            if (item.id === 'administracion') return can("Administración", "Gestion Administración", "consultar");
            if (item.id === 'reportes') return can("Reportes", "Gestion Reportes", "consultar");
            if (item.id === 'config') return can("Configuración", "Gestion Configuración", "consultar");
            return true;
        });
    }, [userProfile, can]);

    const handleNavClick = (id) => {
        setSidebarOpen(false);
        const safeBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
        const path = id === 'Inicio' ? safeBasePath : `${safeBasePath}/${id}`;
        
        if (window.hasUnsavedChanges) {
            setPendingNavigationPath(path);
            return;
        }

        // Dispatch reset event for active module resetting
        const lowerId = String(id).toLowerCase();
        window.dispatchEvent(new CustomEvent(`reset-module-${lowerId}`));
        
        navigate(path);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-x-hidden relative">
            {/* Advanced Background Decoration */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
                style={{ backgroundImage: `radial-gradient(#2563eb 0.5px, transparent 0.5px)`, backgroundSize: '24px 24px' }} />

            <div className="fixed top-0 right-0 w-[1000px] h-[1000px] bg-blue-50/40 rounded-full blur-[140px] -mr-[500px] -mt-[500px] pointer-events-none animate-pulse duration-[10s]" />
            <div className="fixed bottom-0 left-0 w-[800px] h-[800px] bg-indigo-50/20 rounded-full blur-[120px] -ml-[400px] -mb-[400px] pointer-events-none" />

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-500"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Top Navigation Bar / Hamburger for Desktop */}
            <div className="hidden lg:flex fixed top-4 left-4 z-[60]">
                <button
                    onClick={() => setCollapsedDesktop(!collapsedDesktop)}
                    className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/60 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"
                    title={collapsedDesktop ? "Expandir menú" : "Contraer menú"}
                >
                    <FiMenu size={18} />
                </button>
            </div>

            {/* Sidebar - Slender Pro v3.0 (Advanced Glassmorphism) */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-50 bg-white/40 backdrop-blur-[40px] border-r border-slate-200/40 shadow-[10px_0_50px_rgba(0,0,0,0.02)]
          ${sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}
          ${collapsedDesktop ? "lg:w-20" : "lg:w-64"} w-64
          transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
        `}
            >
                <div className="h-full flex flex-col relative overflow-hidden">
                    {/* Interior Glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    {/* Logo Area - Clinic Focus */}
                    <div className={`px-4 py-5 relative shrink-0 border-b border-slate-100/50 bg-slate-50/30 flex flex-col items-center justify-center min-h-[120px] transition-all duration-500 ${collapsedDesktop ? 'mt-10' : ''}`}>
                        <div className="flex flex-col items-center gap-4 group cursor-pointer transition-all duration-500" onClick={() => handleNavClick('Inicio')}>
                            <div className={`${collapsedDesktop ? 'w-10 h-10 rounded-lg' : 'w-20 h-20 rounded-2xl'} bg-white border border-slate-100 shadow-xl flex items-center justify-center overflow-hidden group-hover:scale-105 group-hover:rotate-1 transition-all duration-500 shrink-0`}>
                                {userProfile?.rol === 'superadmin' ? (
                                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white font-black text-xl lg:text-3xl italic tracking-tighter">M</div>
                                ) : userProfile?.tenant?.logo ? (
                                    <img src={userProfile.tenant.logo} alt="Logo" className="max-h-full max-w-full object-contain p-1 lg:p-2" />
                                ) : (
                                    <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-black text-xl lg:text-2xl italic tracking-tighter">
                                        {(userProfile?.tenant?.nombreComercial || "O").substring(0, 1).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className={`flex flex-col items-center text-center overflow-hidden transition-all duration-500 ${collapsedDesktop ? 'w-0 opacity-0 h-0 hidden' : 'w-auto opacity-100 h-auto'}`}>
                                <h1 className="text-xl font-black text-slate-800 tracking-tighter leading-none uppercase truncate max-w-[200px]">
                                    {userProfile?.rol === 'superadmin' 
                                        ? "OdontoCloud Central" 
                                        : (userProfile?.tenant?.nombreComercial || "ODONTOCLOUD")}
                                </h1>
                                {userProfile?.tenant?.nit && (
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/50">NIT: {userProfile.tenant.nit}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Navigation - High Density Slender Pro v2 */}
                    <nav className="flex-1 px-3 py-3 relative z-10 overflow-x-hidden overflow-y-auto custom-scrollbar">
                        {/* Global Search */}
                        <div className="mb-4">
                            <div className="px-1 flex justify-center">
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
                                    className={`flex items-center justify-center transition-all duration-300 group shadow-sm bg-slate-100/50 hover:bg-blue-50 border border-slate-200/40 hover:border-blue-200 text-slate-400 hover:text-blue-600 ${collapsedDesktop ? 'w-10 h-10 rounded-xl px-0' : 'w-full gap-3 px-4 py-2.5 rounded-xl'}`}
                                    title="Buscar..."
                                >
                                    <FiSearch className="text-slate-400 group-hover:text-blue-600 shrink-0" size={16} />
                                    {!collapsedDesktop && (
                                        <>
                                            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Buscar...</span>
                                            <div className="ml-auto flex gap-1 opacity-40 group-hover:opacity-100 shrink-0">
                                                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[8px] font-bold text-slate-500">Ctrl</kbd>
                                                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[8px] font-bold text-slate-500">K</kbd>
                                            </div>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Menú Principal Section Header */}
                        <div className={`px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-3 flex items-center justify-center lg:justify-between gap-2 overflow-hidden transition-all duration-500 ${collapsedDesktop ? 'opacity-0 h-0 hidden' : 'opacity-100 h-auto'}`}>
                            <span className="whitespace-nowrap">Menú Principal</span>
                        </div>
                        
                        <div className="space-y-2">
                            {filteredNavItems.map((item) => {
                                const safeBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
                                const fullPath = item.id === 'Inicio' ? safeBasePath : `${safeBasePath}/${item.id}`;
                                const isActive = location.pathname === fullPath || (item.id !== 'Inicio' && location.pathname.startsWith(fullPath));

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNavClick(item.id)}
                                        title={collapsedDesktop ? item.label : ""}
                                        className={`
                                            relative flex items-center ${collapsedDesktop ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 w-full py-2.5 px-4'} rounded-xl transition-all duration-300 group
                                            ${isActive
                                                ? 'bg-blue-600/5 text-blue-600'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                                        `}
                                    >
                                        {/* Active Indicator Bar */}
                                        {isActive && !collapsedDesktop && (
                                            <div className="absolute left-0 w-1 bg-blue-600 rounded-r-full h-5" />
                                        )}
                                        <item.icon className={`text-lg shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-blue-600' : ''}`} />
                                        {!collapsedDesktop && (
                                            <span className={`text-[11px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${isActive ? 'text-blue-600' : ''}`}>
                                                {item.label}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>



                    {/* User Profile / Logout - Refined v2 */}
                    <div className="p-4 relative group/user mt-auto flex flex-col gap-2 justify-center">
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/80 to-transparent" />

                        <button
                            onClick={() => setProfileModalOpen(true)}
                            title={collapsedDesktop ? "Perfil de usuario / Firma" : ""}
                            className={`flex items-center justify-center transition-all duration-300 active:scale-95 group shadow-sm bg-blue-50/50 border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white ${collapsedDesktop ? 'w-10 h-10 rounded-xl px-0' : 'w-full gap-3 px-5 py-3 rounded-[18px]'}`}
                        >
                            <FiUser className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                            {!collapsedDesktop && (
                                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Perfil de usuario</span>
                            )}
                        </button>

                        <button
                            onClick={handleLogout}
                            title={collapsedDesktop ? "Cerrar sesión" : ""}
                            className={`flex items-center justify-center transition-all duration-300 active:scale-95 group shadow-sm bg-red-50/50 border border-red-100 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 ${collapsedDesktop ? 'w-10 h-10 rounded-xl px-0' : 'w-full gap-3 px-5 py-3 rounded-[18px]'}`}
                        >
                            <FiLogOut className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1" />
                            {!collapsedDesktop && (
                                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Cerrar sesión</span>
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 min-h-screen relative z-1 transition-all duration-500 ${collapsedDesktop ? 'lg:pl-20' : 'lg:pl-64'}`}>
                {/* Mobile Header */}
                <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 lg:hidden flex items-center justify-between px-6 h-16 sticky top-0 z-40">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500"
                    >
                        <FiMenu size={20} />
                    </button>
                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">
                        {(title || "Escritorio")}
                    </span>
                    <div className="w-10" />
                </header>

                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <div className="max-w-[1600px] mx-auto">
                        {(title || subtitle) && (
                            <div className="mb-10 space-y-1">
                                {title && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{title}</h1>
                                    </div>
                                )}
                                {subtitle && <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest opacity-80 pl-4">{subtitle}</p>}
                            </div>
                        )}

                        <div className="">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
            <CommandPalette />
            <UserProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />

            {/* Notifications Slide-over Panel */}
            {notificationsOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    {/* Backdrop overlay */}
                    <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-xs transition-opacity" onClick={() => setNotificationsOpen(false)} />
                    
                    {/* Panel content */}
                    <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full border-l border-slate-100 animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between p-6 border-b border-slate-50 bg-slate-50/50">
                            <h2 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                                <FiBell className="text-blue-600" size={14} /> Centro de Notificaciones
                            </h2>
                            <button onClick={() => setNotificationsOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
                                <FiX size={18} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {notificaciones.length === 0 ? (
                                <div className="text-center py-20 space-y-3">
                                    <div className="text-4xl text-slate-300">🔔</div>
                                    <p className="text-slate-400 text-xs italic">No hay notificaciones recientes.</p>
                                </div>
                            ) : (
                                notificaciones.map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => n.type === "appointment_request" && n.estado !== "confirmada" && n.estado !== "rechazada" && setSelectedRequest(n)}
                                        className={`p-4 rounded-2xl border transition-all ${n.read ? 'bg-slate-50 border-slate-100' : 'bg-blue-50/40 border-blue-100 shadow-sm'} ${n.type === "appointment_request" && n.estado !== "confirmada" && n.estado !== "rechazada" ? 'cursor-pointer hover:border-blue-300 hover:shadow-md' : ''}`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <h4 className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wide">{n.title}</h4>
                                            <span className="text-[9px] text-slate-400 font-bold">
                                                {n.createdAt ? new Date(n.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 text-xs leading-relaxed">{n.message}</p>
                                        {/* Badge de estado para solicitudes */}
                                        {n.type === "appointment_request" && (
                                            <div className="mt-2 flex items-center gap-2">
                                                {n.estado === "confirmada" ? (
                                                    <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✅ Confirmada</span>
                                                ) : n.estado === "rechazada" ? (
                                                    <span className="text-[9px] font-black uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">❌ Rechazada</span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full animate-pulse">⏳ Pendiente — Toca para gestionar</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Gestionar Solicitud de Cita */}
            {selectedRequest && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        {/* Header */}
                        <div className="bg-blue-600 px-8 py-6 text-white">
                            <div className="flex items-center gap-3 mb-1">
                                <FiCalendar size={22} />
                                <h3 className="text-lg font-black uppercase tracking-tight">Solicitud de Cita</h3>
                            </div>
                            <p className="text-blue-200 text-xs">Revisa los datos y decide si confirmar o rechazar</p>
                        </div>

                        {/* Datos de la solicitud */}
                        <div className="px-8 py-6 space-y-3">
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
                                <div className="flex items-center gap-3">
                                    <FiUser className="text-blue-500 shrink-0" size={16} />
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Paciente</p>
                                        <p className="text-sm font-bold text-slate-800">{selectedRequest.pacienteNombre || selectedRequest.message?.split(" ha solicitado")[0] || "Sin nombre"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <FiCalendar className="text-blue-500 shrink-0" size={16} />
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha solicitada</p>
                                        <p className="text-sm font-bold text-slate-800">{selectedRequest.fechaSolicitada || "Ver mensaje abajo"}</p>
                                    </div>
                                </div>
                                {(selectedRequest.motivo || selectedRequest.message) && (
                                    <div className="flex items-start gap-3">
                                        <FiMessageSquare className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Motivo / Mensaje</p>
                                            <p className="text-sm font-bold text-slate-800">{selectedRequest.motivo || selectedRequest.message}</p>
                                        </div>
                                    </div>
                                )}
                                {selectedRequest.pacienteCelular && (
                                    <div className="flex items-center gap-3">
                                        <FiUsers className="text-blue-500 shrink-0" size={16} />
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Celular</p>
                                            <p className="text-sm font-bold text-slate-800">{selectedRequest.pacienteCelular}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Motivo de rechazo (opcional) */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                                    Motivo de rechazo (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Ej: No hay disponibilidad ese día..."
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="px-8 pb-8 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setSelectedRequest(null); setRejectReason(""); }}
                                className="px-4 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={handleRejectRequest}
                                disabled={processingRequest}
                                className="px-4 py-3 rounded-2xl bg-red-50 border-2 border-red-200 text-red-600 font-black text-xs uppercase tracking-wider hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <FiSlash size={14} /> Rechazar
                            </button>
                            <button
                                onClick={handleConfirmRequest}
                                disabled={processingRequest}
                                className="col-span-2 px-4 py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-sm uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 disabled:opacity-50"
                            >
                                {processingRequest ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <><FiCheck size={16} /> Confirmar y ver Agenda</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmación para descarte de cambios pendientes */}
            {pendingNavigationPath && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-[32px] max-w-md w-full p-8 border border-slate-100 shadow-2xl animate-scaleIn relative overflow-hidden flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                            <FiAlertCircle size={32} strokeWidth={2.5} />
                        </div>
                        
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                            ¿Descartar Cambios?
                        </h3>
                        
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed mb-6">
                            Tienes cambios sin guardar. Si sales ahora, perderás todas las modificaciones realizadas en el paciente.
                        </p>

                        <div className="flex flex-col gap-3 w-full">
                            <button
                                type="button"
                                onClick={() => {
                                    window.hasUnsavedChanges = false;
                                    const path = pendingNavigationPath;
                                    setPendingNavigationPath(null);
                                    
                                    // Parse the id from path
                                    const segments = path.split("/");
                                    const lastSegment = segments[segments.length - 1];
                                    const id = lastSegment === "dashboard_admin" ? "Inicio" : lastSegment;
                                    
                                    const lowerId = String(id).toLowerCase();
                                    window.dispatchEvent(new CustomEvent(`reset-module-${lowerId}`));
                                    
                                    navigate(path);
                                }}
                                className="w-full py-3 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                Descartar y Salir
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => setPendingNavigationPath(null)}
                                className="w-full py-3 bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                            >
                                Seguir Editando
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
