import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/landing.css";
import "../styles/inner.css";
import "../styles/modern.css";


// SVG Icons
const IconPhone = () => (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
);
const IconMap = () => (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
);
const IconFacebook = () => (<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" /></svg>);
const IconInstagram = () => (<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4c0 3.2-2.6 5.8-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8C2 4.6 4.6 2 7.8 2zm-.2 2c-2.1 0-3.8 1.7-3.8 3.8v8.4c0 2.1 1.7 3.8 3.8 3.8h8.4c2.1 0 3.8-1.7 3.8-3.8V7.8c0-2.1-1.7-3.8-3.8-3.8H7.6zM12 7c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5zm0 2c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm5.25-1.5c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75z" /></svg>);
const IconDownload = () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);

export default function VivaHeader({ config, isPreview = false, overlay = false }) {
    const { user, userProfile, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const location = useLocation();
    const { clinicSlug } = useParams();
    const slug = clinicSlug || config?.slug;
    const clinicBase = slug ? `/c/${slug}` : "";

    // FAIL-SAFE: Never render on dashboard/superadmin routes
    const isDashboard = /dashboard|superadmin|admin_/.test(location.pathname.toLowerCase());
    if (isDashboard) return null;

    // Close Menu and Reset Scroll state on Route Change
    useEffect(() => {
        setMobileMenuOpen(false);
        setScrolled(false);
    }, [location]);

    // Handle Scroll
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);

        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    };

    // Correction: Better detection for subpath hosting
    const isHomePath = location.pathname === "/" || location.pathname === import.meta.env.BASE_URL || (import.meta.env.BASE_URL !== '/' && location.pathname === import.meta.env.BASE_URL.replace(/\/$/, ''));

    // Transparent if overlay is on, not scrolled, no menu
    const isTransparent = overlay && !scrolled && !mobileMenuOpen;

    // Premium Glass Logic
    const navClasses = `
        viva-navbar sticky top-0 z-50 transition-all duration-500
        ${isTransparent
            ? 'bg-transparent border-transparent'
            : 'glass-premium-light' // Use new premium class
        }
    `;

    const primaryColor = config?.primaryColor || "#38bdf8"; // Default cyan-400

    const textColor = isTransparent ? "text-white" : "text-slate-800";
    const logoTextColor = isTransparent ? "text-white" : "text-[var(--viva-blue)]";

    const getDashboardPath = () => {
        if (!userProfile?.rol) return "/login";
        const r = userProfile.rol.toLowerCase();
        if (r === "superadmin") return "/superadmin";
        if (r === "administrador" || r.includes("admin") || r.includes("soporte")) return "/dashboard_admin";
        if (r === "doctor" || r.includes("doctor") || r.includes("odontologo")) return "/dashboard_doctor";
        if (r === "recepcionista" || r.includes("recep") || r.includes("auxiliar")) return "/dashboard_recepcion";
        return "/dashboard_recepcion"; // Fallback safe
    };

    return (
        <header className="fixed top-0 left-0 w-full z-[100] transition-all duration-300">
            {/* 2. NAVBAR */}
            <nav className={`${navClasses} h-20 flex items-center`}>
                <div className="w-full mx-auto px-4 md:px-8 flex justify-between items-center h-full max-w-[1600px]">

                    {/* LEFT: LOGO */}
                    <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer group" onClick={() => navigate(config?.isMaster ? '/' : (clinicBase || '/'))}>
                        {config?.logo && config.logo !== "/assets/logo.png" && (
                            <img
                                src={config.logo}
                                alt="Logo"
                                className={`h-10 md:h-12 w-auto object-contain transition-all duration-500 group-hover:scale-105 ${!isTransparent && 'opacity-90'}`}
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        )}
                        <div className="flex flex-col justify-center">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-none font-sans">
                                {config?.isMaster ? (
                                    <>
                                        <span className="text-slate-900">Odonto</span>
                                        <span className="text-blue-600">Cloud</span>
                                    </>
                                ) : (
                                    <span className="text-slate-900">{config?.appTitle || config?.name || "OdontoCloud"}</span>
                                )}
                            </h1>
                        </div>
                    </div>

                    {/* RIGHT: NAVIGATION + ACTIONS */}
                    <div className="hidden lg:flex items-center gap-8">
                        {/* MENU LINKS */}
                        {/* MENU LINKS (EXACT MATCH TO REFERENCE IMAGE) */}
                        <div className="flex items-center gap-7">
                            {(config?.isMaster ? [
                                { name: 'Inicio', path: '#inicio' },
                                { name: 'Funcionalidades', path: '#funcionalidades' },
                                { name: 'Beneficios', path: '/servicios' },
                                { name: 'Precios', path: '/planes' },
                                { name: 'Recursos', path: '/faq' }
                            ] : [
                                { name: 'Inicio', path: clinicBase || '/' },
                                { name: 'Sobre Nosotros', path: `${clinicBase}/nosotros` },
                                { name: 'Servicios', path: `${clinicBase}/servicios` },
                                { name: 'Sedes', path: `${clinicBase}/sedes` },
                                { name: 'Portal', path: `${clinicBase}/portal` }
                            ]).map((item) => {
                                if (item.isMasterOnly && !config?.isMaster) return null;
                                const isAnchor = item.path.startsWith('#');
                                return (
                                    <a
                                        key={item.name}
                                        href={item.path}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (isAnchor) {
                                                const scrollToEl = () => {
                                                    const el = document.querySelector(item.path);
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                };
                                                // If not on home page, navigate first then scroll
                                                const basePath = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
                                                const isHome = location.pathname === '/' || location.pathname === basePath || location.pathname === basePath + '/';
                                                if (!isHome) {
                                                    navigate('/');
                                                    setTimeout(scrollToEl, 500);
                                                } else {
                                                    scrollToEl();
                                                }
                                            } else {
                                                navigate(item.path);
                                            }
                                        }}
                                        className="text-xs font-bold tracking-wide text-slate-700 hover:text-blue-600 transition-colors py-2 relative group"
                                    >
                                        {item.name}
                                        <span className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full rounded-full transition-all duration-300 bg-blue-600"></span>
                                    </a>
                                );
                            })}
                        </div>

                        {/* RIGHT ACTIONS: INICIAR SESIÓN + SOLICITAR DEMO / MI PANEL */}
                        <div className="flex items-center gap-4 border-l border-slate-200/80 pl-6">
                            <Link 
                                to={user ? getDashboardPath() : "/login"} 
                                className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
                            >
                                {user ? "Mi Cuenta" : "Iniciar Sesión"}
                            </Link>

                            <button
                                onClick={() => {
                                    if (isPreview) {
                                        alert("Acceso a demo inactivo en la vista previa del editor.");
                                        return;
                                    }
                                    if (user) {
                                        navigate(getDashboardPath());
                                    } else if (config?.isMaster) {
                                        const phone = config.contactPhone || "3015768935";
                                        const msg = encodeURIComponent("Hola, quisiera solicitar una demostración de OdontoCloud.");
                                        window.open(`https://wa.me/57${phone}?text=${msg}`, '_blank');
                                    } else {
                                        navigate('/login');
                                    }
                                }}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>{user ? "Mi Panel" : "Solicitar Demo"}</span>
                            </button>
                        </div>
                    </div>

                    {/* MOBILE TOGGLE */}
                    <button onClick={toggleMobileMenu} className={`lg:hidden ml-auto p-2 rounded-lg transition-colors ${isTransparent ? 'text-white hover:bg-white/10' : 'text-slate-800 hover:bg-slate-100'}`}>
                        {mobileMenuOpen ? (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        )}
                    </button>
                </div>

                {/* MOBILE MENU - GLASSMROPHISM */}
                <div className={`lg:hidden absolute top-full left-0 w-full glass-premium-light border-t border-white/50 shadow-2xl transition-all duration-300 origin-top overflow-hidden ${mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="viva-container flex flex-col p-6 gap-2">
                        {[
                            { name: 'Inicio', path: config?.isMaster ? '/' : (clinicBase || '/') },
                            { name: 'Funcionalidades', path: config?.isMaster ? '/servicios' : `${clinicBase}/servicios` },
                            { name: 'Planes', path: '/planes', isMasterOnly: true },
                            { name: 'FAQ', path: config?.isMaster ? '/faq' : `${clinicBase}/faq` }
                        ].map((item) => {
                            if (item.isMasterOnly && !config?.isMaster) return null;
                            return (
                                <Link
                                    key={item.name}
                                    to={isPreview ? "#" : item.path}
                                    onClick={(e) => {
                                        setMobileMenuOpen(false);
                                        if (isPreview) {
                                            e.preventDefault();
                                            const lowerName = item.name.toLowerCase();
                                            let targetTab = "hero";
                                            if (lowerName.includes("nosotros")) targetTab = "identity";
                                            else if (lowerName.includes("servicio") || lowerName.includes("funcionalidad")) targetTab = "services";
                                            else if (lowerName.includes("sede")) targetTab = "identity";
                                            else if (lowerName.includes("planes") || lowerName.includes("faq")) targetTab = "hero";
                                            
                                            localStorage.setItem("odc_cms_preview_active_tab", targetTab);
                                            window.dispatchEvent(new Event("storage"));
                                        }
                                    }}
                                    className="text-sm font-bold uppercase tracking-wider text-slate-700 hover:text-cyan-600 py-3 border-b border-slate-100/50 flex justify-between items-center group"
                                >
                                    {item.name}
                                    <span className="text-slate-300 group-hover:text-cyan-500">→</span>
                                </Link>
                            );
                        })}
                        <button
                            onClick={() => {
                                setMobileMenuOpen(false);
                                if (isPreview) {
                                    alert("El acceso a tu panel de clínica está inactivo en la vista previa del editor.");
                                    return;
                                }
                                navigate(getDashboardPath());
                            }}
                            className="mt-4 w-full bg-[var(--viva-blue)] text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-900 shadow-xl"
                        >
                            Ir a Mi Panel
                        </button>
                    </div>
                </div>
            </nav>
        </header>
    );
}
