import React, { useState, useMemo, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
    FiHome, FiCalendar, FiUsers, FiFileText, FiBox,
    FiActivity, FiSettings, FiLogOut, FiMenu, FiX, FiClock, FiCheckCircle, FiLayout, FiPieChart, FiGrid, FiSearch, FiDollarSign, FiBriefcase, FiBell, FiCheck, FiSlash, FiUser, FiMessageSquare,
    FiAlertCircle, FiHelpCircle
} from "react-icons/fi";
import logo from "/assets/logo.png"; // Asegúrate de que esta ruta sea correcta
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabaseClient";

import { usePermissions } from "../hooks/usePermissions";
import CommandPalette from "../components/CommandPalette";
import { getConfigSectionCached, invalidateConfigCache } from "../hooks/useConfig";

import UserProfileModal from "../components/UserProfileModal";
import SedeSelector from "../components/SedeSelector";
import OdontoHelpAssistantModal from "../components/OdontoHelpAssistantModal";

export default function DashboardLayout({ children, title, subtitle, basePath = "/dashboard_admin" }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [helpModalOpen, setHelpModalOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);
    const [pendingNavigationPath, setPendingNavigationPath] = useState(null);
    const [collapsedDesktop, setCollapsedDesktop] = useState(() => {
        try {
            return localStorage.getItem('oc_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

    const [clinicConfig, setClinicConfig] = useState(null);

    useEffect(() => {
        if (!inquilino) return;

        let cancelled = false;

        const fetchNotifications = async () => {
            try {
                const { data: notifData } = await supabase
                    .from("notificaciones")
                    .select("*")
                    .eq("tenant_id", inquilino)
                    .eq("target", "admin")
                    .order("created_at", { ascending: false })
                    .limit(15);

                if (!cancelled) setNotificaciones(notifData || []);
            } catch {
                if (!cancelled) setNotificaciones([]);
            }
        };

        const fetchClinicConfig = async (force = false) => {
            try {
                if (force) invalidateConfigCache(inquilino, "empresa_datos");

                const [tRes, companyConfig] = await Promise.all([
                    supabase
                        .from("tenants")
                        .select("id, nombre, direccion, telefono, logo_url, nit, plan, activo, parametros")
                        .eq("id", inquilino)
                        .maybeSingle(),
                    getConfigSectionCached(inquilino, "empresa_datos", {}, force),
                ]);

                if (cancelled) return;

                const tData = tRes.data || {};
                const cData = companyConfig || {};

                setClinicConfig({
                    ...cData,
                    ...tData,
                    logo_url: tData.logo_url || tData.logo || cData.logoUrl || ""
                });
            } catch {
                // Keep the last valid branding if a refresh fails temporarily.
            }
        };

        fetchNotifications();
        fetchClinicConfig();

        const handleTenantUpdated = () => {
            fetchClinicConfig(true);
        };
        window.addEventListener("tenant-updated", handleTenantUpdated);

        const channel = supabase
            .channel(`admin-notifs-${inquilino}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notificaciones', filter: `tenant_id=eq.${inquilino}` },
                fetchNotifications
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
            window.removeEventListener("tenant-updated", handleTenantUpdated);
        };
    }, [inquilino]);

    const displayLogo = clinicConfig?.logo_url || clinicConfig?.logoUrl || clinicConfig?.logo || userProfile?.tenant?.logo_url || userProfile?.tenant?.logo || "";
    const displayName = clinicConfig?.nombreComercial || clinicConfig?.nombre || clinicConfig?.name || userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "OdontoCloud";
    const displayNit = clinicConfig?.nit || userProfile?.tenant?.nit || "";



    const handleConfirmRequest = async () => {
        if (!selectedRequest) return;
        setProcessingRequest(true);
        try {
            await supabase.from("notificaciones").update({
                estado: "confirmada",
                read: true
            }).eq("id", selectedRequest.id);

            await supabase.from("notificaciones").insert([{
                tenant_id: inquilino,
                inquilino,
                target: "patient",
                title: "Cita Confirmada ✅",
                message: `Tu solicitud de cita para el ${selectedRequest.fechaSolicitada || "la fecha solicitada"} ha sido confirmada. Pronto te contactaremos con los detalles.`,
                type: "appointment_confirmed",
                paciente_id: selectedRequest.pacienteId,
                read: false,
                created_at: new Date().toISOString()
            }]);

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
            await supabase.from("notificaciones").update({
                estado: "rechazada",
                read: true
            }).eq("id", selectedRequest.id);

            const motivo = rejectReason.trim() || "no hay disponibilidad en esa fecha";
            await supabase.from("notificaciones").insert([{
                tenant_id: inquilino,
                inquilino,
                target: "patient",
                title: "Solicitud de Cita No Disponible ⚠️",
                message: `Lo sentimos, tu solicitud de cita para el ${selectedRequest.fechaSolicitada || "la fecha solicitada"} no pudo ser confirmada porque ${motivo}. Por favor solicita otra fecha o contáctanos.`,
                type: "appointment_rejected",
                paciente_id: selectedRequest.pacienteId,
                read: false,
                created_at: new Date().toISOString()
            }]);

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
        { id: 'reportes', icon: FiPieChart, label: 'REPORTES' }
    ];

    const filteredNavItems = useMemo(() => {
        return navItems.filter(item => {
            if (item.id === 'Inicio') return true;
            if (item.id === 'agenda') return can("Agenda", "Agenda", "consultar");
            if (item.id === 'pacientes') return can("Pacientes", "Paciente", "consultar");
            if (item.id === 'caja') return can("Caja", "Caja", "consultar");
            if (item.id === 'administracion') return can("Administración", "Gestion Administración", "consultar");
            if (item.id === 'reportes') return can("Reportes", "Gestion Reportes", "consultar");
            return true;
        });
    }, [userProfile, can]);

    const handleNavClick = (id) => {
        setSidebarOpen(false);
        const safeBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
        const path = id === 'Inicio' ? safeBasePath : `${safeBasePath}/${id}`;
        
        if (window.checkIncompletePatientNavigation) {
            const intercepted = window.checkIncompletePatientNavigation(path);
            if (intercepted) return;
        }

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
                                ) : displayLogo ? (
                                    <img src={displayLogo} alt="Logo" className="max-h-full max-w-full object-contain p-1 lg:p-2" />
                                ) : (
                                    <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-black text-xl lg:text-2xl italic tracking-tighter uppercase">
                                        {(displayName || "O").substring(0, 1).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className={`flex flex-col items-center text-center overflow-hidden transition-all duration-500 ${collapsedDesktop ? 'w-0 opacity-0 h-0 hidden' : 'w-auto opacity-100 h-auto'}`}>
                                <h1 className="text-sm font-black text-slate-800 tracking-tighter leading-snug uppercase truncate max-w-[200px]" title={displayName}>
                                    {userProfile?.rol === 'superadmin' 
                                        ? "OdontoCloud Central" 
                                        : displayName}
                                </h1>
                                {displayNit && (
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/50">NIT: {displayNit}</span>
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
                </div>
            </aside>

            {/* Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 min-h-screen relative z-1 transition-all duration-500 ${collapsedDesktop ? 'lg:pl-20' : 'lg:pl-64'}`}>
                {/* Top Header Bar - Multi-Sede & User Controls (Oral Drive Style) */}
                <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-30 shadow-xs px-4 sm:px-6 h-14 flex items-center justify-between">
                    {/* Left: Mobile Menu Toggle & Sede Selector */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/60 lg:hidden flex items-center justify-center text-slate-500 hover:text-slate-800"
                        >
                            <FiMenu size={18} />
                        </button>
                        <SedeSelector />
                    </div>

                    {/* Right: Quick actions & User identity */}
                    <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-600">
                        {/* Ayuda / Asistente IA */}
                        <button
                            type="button"
                            onClick={() => setHelpModalOpen(true)}
                            className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                            title="Centro de ayuda y asistente IA"
                        >
                            <FiHelpCircle size={15} className="text-blue-600" />
                            <span className="hidden sm:inline font-bold">Ayuda</span>
                        </button>

                        {/* Notificaciones */}
                        <button
                            type="button"
                            onClick={() => setNotificationsOpen(true)}
                            className="relative p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-50 cursor-pointer"
                            title="Notificaciones"
                        >
                            <FiBell size={16} />
                            {notificaciones.filter(n => !n.read).length > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                            )}
                        </button>

                        {/* Configuración rápida */}
                        <button
                            type="button"
                            onClick={() => navigate(`${basePath}/Configuracion`)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-50 cursor-pointer"
                            title="Configuración"
                        >
                            <FiSettings size={16} />
                        </button>

                        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                        {/* User Profile Dropdown */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                type="button"
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer select-none"
                            >
                                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-[10px] overflow-hidden shrink-0">
                                    {(userProfile?.foto_perfil || userProfile?.fotoPerfil || userProfile?.photoURL) ? (
                                        <img
                                            src={userProfile?.foto_perfil || userProfile?.fotoPerfil || userProfile?.photoURL}
                                            alt="Foto perfil"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        (userProfile?.full_name || userProfile?.nombre || user?.email || "U").charAt(0).toUpperCase()
                                    )}
                                </div>
                                <span className="hidden sm:inline-block font-bold text-[11px] text-slate-700 uppercase tracking-wide truncate max-w-[160px]">
                                    {userProfile?.full_name || userProfile?.nombre || user?.email?.split("@")[0] || "USUARIO"}
                                </span>
                            </button>

                            {/* Dropdown flotante de Perfil y Cerrar Sesión */}
                            {userMenuOpen && (
                                <div className="absolute right-0 top-10 z-50 animate-fadeIn min-w-[200px] bg-white rounded-xl shadow-2xl border border-slate-100 p-1.5 text-xs">
                                    <div className="px-3 py-2 border-b border-slate-50 flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs overflow-hidden shrink-0">
                                            {(userProfile?.foto_perfil || userProfile?.fotoPerfil || userProfile?.photoURL) ? (
                                                <img
                                                    src={userProfile?.foto_perfil || userProfile?.fotoPerfil || userProfile?.photoURL}
                                                    alt="Foto perfil"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                (userProfile?.full_name || userProfile?.nombre || user?.email || "U").charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="truncate">
                                            <div className="font-bold text-slate-800 truncate">
                                                {userProfile?.full_name || userProfile?.nombre || "Usuario"}
                                            </div>
                                            <div className="text-[10px] text-slate-400 truncate">
                                                {user?.email || ""}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="py-1 space-y-0.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                setProfileModalOpen(true);
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-slate-700 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FiUser size={13} className="text-blue-600" />
                                            <span>Mi Perfil & Firma</span>
                                        </button>

                                        <div className="h-px bg-slate-100 my-1" />

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                handleLogout();
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-rose-600 hover:bg-rose-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FiLogOut size={13} />
                                            <span>Cerrar sesión</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
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
            <OdontoHelpAssistantModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />

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
