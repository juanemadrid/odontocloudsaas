import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/landing.css";
import "../styles/inner.css";
import "../styles/modern.css";

export default function VivaHeader({ config = {}, isPreview = false, overlay = false }) {
    const { user, userProfile } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();
    const { clinicSlug } = useParams();
    const slug = clinicSlug || config?.slug;
    const clinicBase = slug ? `/c/${slug}` : "";
    const isMaster = config?.isMaster === true || (!clinicSlug && !location.pathname.startsWith('/c/'));

    // FAIL-SAFE: Never render on dashboard/superadmin internal routes
    const isDashboard = /dashboard|superadmin|admin_/.test(location.pathname.toLowerCase());
    if (isDashboard) return null;

    useEffect(() => {
        setMobileMenuOpen(false);
        setScrolled(false);
    }, [location]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

    const isTransparent = overlay && !scrolled && !mobileMenuOpen;

    const navClasses = `
        viva-navbar sticky top-0 z-50 transition-all duration-500
        ${isTransparent
            ? 'bg-transparent border-transparent'
            : 'glass-premium-light shadow-sm'
        }
    `;

    const getDashboardPath = () => {
        if (!userProfile?.rol) return "/login";
        const r = userProfile.rol.toLowerCase();
        if (r === "superadmin") return "/superadmin";
        if (r === "administrador" || r.includes("admin") || r.includes("soporte")) return "/dashboard_admin";
        if (r === "doctor" || r.includes("doctor") || r.includes("odontologo")) return "/dashboard_doctor";
        if (r === "recepcionista" || r.includes("recep") || r.includes("auxiliar")) return "/dashboard_recepcion";
        return "/dashboard_recepcion";
    };

    const handleNavClick = (e, item) => {
        e.preventDefault();
        
        if (isPreview) {
            // In preview mode, scroll within the iframe
            const sectionMap = {
                "inicio": "inicio",
                "sobre nosotros": "nosotros",
                "nosotros": "nosotros",
                "servicios": "servicios",
                "sedes": "sedes",
                "contacto": "contacto",
                "portal": "contacto"
            };
            const lower = item.name.toLowerCase();
            const targetId = sectionMap[lower] || "inicio";
            const el = document.getElementById(targetId) || document.getElementById("inicio");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }

        if (isMaster) {
            if (item.path.startsWith('/#') || item.path.startsWith('#')) {
                const hash = item.path.includes('#') ? '#' + item.path.split('#')[1] : item.path;
                if (location.pathname === '/' || location.pathname === '/odontocloudsaas' || location.pathname === '/odontocloudsaas/') {
                    const el = document.querySelector(hash);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    navigate(`/${hash}`);
                }
            } else {
                navigate(item.path);
            }
        } else {
            // Clinic: always navigate to a dedicated page
            navigate(item.path);
        }
    };

    const menuItems = isMaster
        ? [
            { name: 'Inicio', path: '/' },
            { name: 'Funcionalidades', path: '/funcionalidades' },
            { name: 'Precios', path: '/planes' },
            { name: 'Recursos', path: '/faq' }
        ]
        : [
            { name: 'Inicio', path: `${clinicBase}` },
            { name: 'Sobre Nosotros', path: `${clinicBase}/nosotros` },
            { name: 'Servicios', path: `${clinicBase}/servicios` },
            { name: 'Sedes', path: `${clinicBase}/sedes` },
        ];

    const displayName = config?.name && config.name !== "Clínica Dental" && config.name !== "Nombre de tu Clínica"
        ? config.name
        : (userProfile?.empresaNombre || userProfile?.tenant?.name || config?.tenantName || config?.name || "ATM");

    const sloganText = config?.slogan || (isMaster ? "Software Odontológico Multi-Sede" : "Salud Oral & Odontología Especializada");

    const brandColorStyle = config?.brandTextColor || (config?.primaryColor && config.primaryColor !== "#38bdf8" ? config.primaryColor : "#0f172a");

    return (
        <header className="fixed top-0 left-0 w-full z-[100] transition-all duration-300">
            <nav className={`${navClasses} h-20 flex items-center`}>
                <div className="w-full mx-auto px-4 md:px-8 flex justify-between items-center h-full max-w-[1600px]">

                    {/* LEFT: LOGO & CLINIC / APP BRANDING */}
                    <div 
                        className="flex-shrink-0 flex items-center gap-3.5 cursor-pointer group" 
                        onClick={() => {
                            if (isPreview) return;
                            navigate(isMaster ? '/' : (clinicBase || '/'));
                        }}
                    >
                        {isMaster ? (
                            <div className="flex items-center gap-2.5">
                                <img
                                    src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/assets/logo.png`}
                                    alt="OdontoCloud Logo"
                                    className="h-8 md:h-10 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
                                />
                                <div className="flex flex-col justify-center text-left">
                                    <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none font-sans flex items-center">
                                        <span className="text-slate-900 font-black">Odonto</span>
                                        <span className="text-blue-600 font-black">Cloud</span>
                                    </h1>
                                </div>
                            </div>
                        ) : (
                            <>
                                {config?.logo && config.logo !== "/assets/logo.png" ? (
                                    <div className="relative p-1 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/60 shadow-sm group-hover:shadow-md transition-all group-hover:scale-105">
                                        <img
                                            src={config.logo}
                                            alt={displayName}
                                            className="h-10 md:h-12 w-auto object-contain max-w-[140px]"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                ) : (
                                    <div
                        className="w-10 h-10 rounded-2xl text-white flex items-center justify-center font-black text-base shadow-md shrink-0 group-hover:scale-105 transition-transform"
                        style={{ background: config?.primaryColor || '#1e3a8a' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2C9.2 2 7 4.2 7 7c0 1.5.6 3 1.3 4.3L7 21h1l1-4h6l1 4h1l-1.3-9.7C15.4 10 16 8.5 16 7c0-2.8-2.2-5-4-5z"/>
                        </svg>
                    </div>
                                )}

                                <div className="flex flex-col justify-center text-left">
                                    <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none font-sans flex items-center gap-1.5">
                                        <span 
                                            className="font-black tracking-tight drop-shadow-sm transition-colors duration-300"
                                            style={{
                                                color: isTransparent ? '#ffffff' : brandColorStyle
                                            }}
                                        >
                                            {displayName}
                                        </span>
                                    </h1>
                                    <span 
                                        className="text-[9px] font-extrabold tracking-wider uppercase opacity-75 mt-0.5"
                                        style={{ color: isTransparent ? '#e2e8f0' : '#64748b' }}
                                    >
                                        {sloganText}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* RIGHT: NAVIGATION + ACTIONS */}
                    <div className="hidden lg:flex items-center gap-8">
                        <div className="flex items-center gap-7">
                            {menuItems.map((item) => (
                                <a
                                    key={item.name}
                                    href={item.path}
                                    onClick={(e) => handleNavClick(e, item)}
                                    className="text-xs font-bold tracking-wide text-slate-700 hover:text-blue-600 transition-colors py-2 relative group cursor-pointer"
                                >
                                    {item.name}
                                    <span className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full rounded-full transition-all duration-300 bg-blue-600"></span>
                                </a>
                            ))}
                        </div>

                        {/* RIGHT ACTIONS */}
                        <div className="flex items-center gap-4 border-l border-slate-200/80 pl-6">
                            {isMaster ? (
                                <Link 
                                    to={user ? getDashboardPath() : "/login"} 
                                    className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
                                >
                                    {user ? "Mi Cuenta" : "Iniciar Sesión"}
                                </Link>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (isPreview) {
                                            alert("En vista previa: simula el acceso al portal de pacientes de tu clínica.");
                                            return;
                                        }
                                        const portalUrl = clinicBase ? `${clinicBase}/portal` : (slug ? `/c/${slug}/portal` : "/portal");
                                        navigate(portalUrl);
                                    }}
                                    className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors bg-transparent border-0 cursor-pointer"
                                >
                                    Acceso Pacientes
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    if (isPreview) {
                                        const phone = (config.contactPhone || "3015768935").replace(/\D/g, "");
                                        const msg = encodeURIComponent(`Hola, quisiera solicitar información o agendar una cita en ${displayName}.`);
                                        window.open(`https://wa.me/57${phone}?text=${msg}`, '_blank');
                                        return;
                                    }
                                    if (isMaster) {
                                        if (user) {
                                            navigate(getDashboardPath());
                                        } else {
                                            const phone = (config.contactPhone || "3015768935").replace(/\D/g, "");
                                            const msg = encodeURIComponent("Hola, quisiera solicitar una demostración de OdontoCloud.");
                                            window.open(`https://wa.me/57${phone}?text=${msg}`, '_blank');
                                        }
                                    } else {
                                        const phone = (config.contactPhone || "3015768935").replace(/\D/g, "");
                                        const msg = encodeURIComponent(`Hola, quisiera agendar una cita de valoración en ${displayName}.`);
                                        window.open(`https://wa.me/57${phone}?text=${msg}`, '_blank');
                                    }
                                }}
                                className="px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-lg shadow-blue-500/25 transition-all duration-200 transform hover:scale-105 flex items-center gap-2 cursor-pointer border-0"
                                style={{
                                    backgroundColor: isMaster ? '#2563eb' : (config?.primaryColor || '#1e3a8a')
                                }}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>{isMaster ? (user ? "Mi Panel" : "Solicitar Demo") : (config.heroBtn1Text || "Agendar Cita")}</span>
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

                {/* MOBILE MENU */}
                <div className={`lg:hidden absolute top-full left-0 w-full glass-premium-light border-t border-white/50 shadow-2xl transition-all duration-300 origin-top overflow-hidden ${mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="viva-container flex flex-col p-6 gap-2 text-left">
                        {menuItems.map((item) => (
                            <a
                                key={item.name}
                                href={item.path}
                                onClick={(e) => {
                                    setMobileMenuOpen(false);
                                    handleNavClick(e, item);
                                }}
                                className="text-sm font-bold uppercase tracking-wider text-slate-700 hover:text-blue-600 py-3 border-b border-slate-100/50 flex justify-between items-center group cursor-pointer"
                            >
                                {item.name}
                                <span className="text-slate-300 group-hover:text-blue-600">→</span>
                            </a>
                        ))}
                        <button
                            onClick={() => {
                                setMobileMenuOpen(false);
                                const phone = (config.contactPhone || "3015768935").replace(/\D/g, "");
                                const msg = encodeURIComponent(`Hola, quisiera agendar una cita en ${displayName}.`);
                                window.open(`https://wa.me/57${phone}?text=${msg}`, '_blank');
                            }}
                            className="mt-4 w-full bg-blue-600 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl border-0 cursor-pointer"
                        >
                            {isMaster ? "Solicitar Demostración" : "Agendar Cita Ahora"}
                        </button>
                    </div>
                </div>
            </nav>
        </header>
    );
}
