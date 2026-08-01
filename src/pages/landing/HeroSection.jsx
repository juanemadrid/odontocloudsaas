import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  FiArrowRight, FiPlay, FiCheckCircle,
  FiCalendar, FiUser, FiFileText,
  FiDollarSign, FiBox, FiMessageSquare,
  FiSearch, FiBell, FiChevronDown, FiUsers
} from "react-icons/fi";
import DocumentationModal from "../../components/landing/DocumentationModal";
import { useNavigate, useParams } from 'react-router-dom';

export default function HeroSection({ config = {}, onShowTrial }) {
    const containerRef = useRef(null);
    const navigate = useNavigate();
    const [showDocModal, setShowDocModal] = useState(false);

    const isMaster = config.isMaster === true;

    // ════════════════════════════════════════════════════════════════════
    // ODONTOCLOUD MASTER HERO — Software marketing, for OdontoCloud SaaS
    // ════════════════════════════════════════════════════════════════════
    if (isMaster) {
        return (
            <section
                id="inicio"
                ref={containerRef}
                className="relative w-full bg-gradient-to-b from-[#F0F4FF] via-white to-white text-slate-900 overflow-hidden font-sans pb-20 pt-28 sm:pt-36 border-b border-slate-100"
            >
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-24 right-10 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[140px]" />
                    <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[140px]" />
                </div>

                <div className="container relative z-10 mx-auto px-4 md:px-8 max-w-[1400px]">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center mb-16">
                        <div className="lg:col-span-6 text-left space-y-6">
                            <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-display font-black text-slate-900 tracking-tight leading-[1.12]">
                                Gestiona tu clínica dental de forma <span className="text-[#2563EB] font-black">simple y profesional</span>
                            </h1>
                            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-xl">
                                OdontoCloud es el software en la nube que te ayuda a ahorrar tiempo, organizar tu clínica y brindar la mejor experiencia a tus pacientes.
                            </p>
                            <div className="flex flex-wrap items-center gap-4 pt-2">
                                <button
                                    onClick={() => {
                                        if (onShowTrial) onShowTrial();
                                        else {
                                            const phone = config.contactPhone || "3015768935";
                                            const msg = encodeURIComponent("Hola, estoy interesado en conocer más sobre OdontoCloud y quisiera solicitar una demostración del software.");
                                            window.open(`https://wa.me/57${phone}?text=${msg}`, '_blank');
                                        }
                                    }}
                                    className="px-8 py-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/25 transition-all duration-200 transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer border-0"
                                >
                                    <span>Solicitar Demostración</span>
                                    <FiArrowRight size={18} />
                                </button>
                                <button
                                    onClick={() => setShowDocModal(true)}
                                    className="px-6 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-sm shadow-sm transition-all duration-200 flex items-center gap-2 cursor-pointer"
                                >
                                    <FiPlay size={14} className="text-blue-600 fill-blue-600" />
                                    <span>Ver Video</span>
                                </button>
                            </div>
                            <div className="pt-6 flex flex-wrap items-center gap-6 text-slate-500 text-xs font-semibold border-t border-slate-200/80">
                                <div className="flex items-center gap-2"><span className="text-blue-600 font-bold">☁️</span><span>100% en la nube</span></div>
                                <div className="flex items-center gap-2"><span className="text-blue-600 font-bold">🔒</span><span>Seguro y confiable</span></div>
                                <div className="flex items-center gap-2"><span className="text-blue-600 font-bold">🎧</span><span>Soporte 24/7</span></div>
                            </div>
                        </div>

                        <div className="lg:col-span-6 relative w-full flex justify-center items-center py-4 [perspective:1200px]">
                            <div
                                className="relative w-full max-w-[620px] p-3.5 sm:p-5 rounded-[2.5rem] bg-gradient-to-tr from-blue-600/20 via-sky-400/15 to-indigo-600/25 border border-blue-200/70 shadow-2xl shadow-blue-500/20 backdrop-blur-xl"
                                style={{ transform: 'perspective(1200px) rotateY(-12deg) rotateX(3deg)', transformStyle: 'preserve-3d' }}
                            >
                                <div className="absolute -top-4 -left-3 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl px-4 py-2 rounded-2xl flex items-center gap-2.5 font-black text-xs text-slate-900">
                                    <img src={config.logo || `${import.meta.env.BASE_URL}assets/logo.png`} alt="OdontoCloud" className="h-6 w-auto object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-900 font-extrabold">Odonto</span>
                                        <span className="text-blue-600 font-black">Cloud</span>
                                    </div>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                                </div>
                                <div className="absolute -top-3.5 -right-3 z-30 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-1.5 rounded-full shadow-lg text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>Sistema Activo 24/7</span>
                                </div>
                                <div className="w-full bg-white border border-slate-200/90 rounded-3xl shadow-xl overflow-hidden text-left p-5 sm:p-6">
                                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">OC</div>
                                            <div className="relative">
                                                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="text" readOnly value="Buscar pacientes, citas..." className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 w-44 sm:w-56 outline-none pointer-events-none" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
                                            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[9px]">AD</div>
                                            <span className="text-[11px] font-bold text-slate-700">Administrador</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                                        {[
                                            { val: "24", label: "Citas hoy", icon: <FiCalendar size={10} />, bg: "bg-blue-100 text-blue-600" },
                                            { val: "128", label: "Pacientes activos", icon: <FiUsers size={10} />, bg: "bg-emerald-100 text-emerald-600" },
                                            { val: "$12.4k", label: "Ingresos mes", icon: <FiDollarSign size={10} />, bg: "bg-emerald-100 text-emerald-600", color: "text-emerald-600" },
                                            { val: "36", label: "Pendientes", icon: <FiBell size={10} />, bg: "bg-amber-100 text-amber-600", color: "text-amber-600" },
                                        ].map((s, i) => (
                                            <div key={i} className="bg-slate-50/80 p-3 rounded-2xl border border-slate-150">
                                                <div className={`text-xs font-black ${s.color || 'text-slate-800'}`}>{s.val}</div>
                                                <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{s.label}</div>
                                                <div className={`w-4 h-4 rounded-lg ${s.bg} flex items-center justify-center text-[9px] mt-1.5`}>{s.icon}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-150 space-y-2">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-0.5">
                                                <span>Agenda del día</span>
                                                <span className="text-[9px] text-slate-400 font-normal">Hoy</span>
                                            </div>
                                            {[
                                                { name: "María González", svc: "Limpieza Dental", badge: "Confirmado", bg: "bg-emerald-50 text-emerald-600" },
                                                { name: "Carlos Ramírez", svc: "Control Ortodoncia", badge: "En Proceso", bg: "bg-blue-50 text-blue-600" },
                                                { name: "Juan David López", svc: "Resina Compuesta", badge: "Pendiente", bg: "bg-amber-50 text-amber-600" },
                                            ].map((a, i) => (
                                                <div key={i} className="p-2 bg-white rounded-xl border border-slate-100 text-[10px] space-y-0.5">
                                                    <div className="font-bold text-slate-800">{a.name}</div>
                                                    <div className="text-[9px] text-slate-400">{a.svc}</div>
                                                    <span className={`inline-block px-1.5 py-0.5 ${a.bg} rounded text-[8px] font-bold`}>{a.badge}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-2.5">
                                            <div className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-150">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="font-bold text-slate-800">Resumen de ingresos</span>
                                                    <span className="text-[9px] font-extrabold text-emerald-600">+18.5%</span>
                                                </div>
                                                <div className="text-sm font-black text-slate-900">$12.450.000</div>
                                                <div className="h-6 w-full mt-1.5 bg-gradient-to-r from-blue-500/10 to-blue-500/30 rounded-lg" />
                                            </div>
                                            <div className="bg-slate-50/60 p-3 rounded-2xl border border-slate-150 text-[10px] space-y-1">
                                                <span className="font-bold text-slate-800 block text-[11px]">Distribución tratamientos</span>
                                                {[
                                                    { label: "Ortodoncia", pct: "30%", color: "bg-blue-600" },
                                                    { label: "Resinas", pct: "25%", color: "bg-sky-500" },
                                                    { label: "Limpieza", pct: "20%", color: "bg-teal-400" },
                                                ].map((t, i) => (
                                                    <div key={i} className="flex items-center justify-between text-slate-600 text-[9px]">
                                                        <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${t.color}`} />{t.label}</span>
                                                        <span className="font-bold">{t.pct}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="funcionalidades" className="pt-8 pb-14 scroll-mt-24">
                        <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 text-center mb-10">Todo lo que tu clínica necesita</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 text-left">
                            {[
                                { icon: <FiCalendar />, bg: "bg-blue-50 text-blue-600", title: "Agenda Inteligente", desc: "Citas, recordatorios y disponibilidad en tiempo real." },
                                { icon: <FiUser />, bg: "bg-emerald-50 text-emerald-600", title: "Historia Clínica", desc: "Fichas completas y seguras siempre disponibles." },
                                { icon: <span>🦷</span>, bg: "bg-purple-50 text-purple-600", title: "Odontograma 3D", desc: "Visualiza y registra tratamientos de forma interactiva." },
                                { icon: <FiDollarSign />, bg: "bg-amber-50 text-amber-600", title: "Facturación y Caja", desc: "Factura electrónicamente y controla tus ingresos fácilmente." },
                                { icon: <FiBox />, bg: "bg-sky-50 text-sky-600", title: "Inventario", desc: "Controla productos, stock y proveedores." },
                                { icon: <FiMessageSquare />, bg: "bg-emerald-50 text-emerald-600", title: "Recordatorios", desc: "Envía recordatorios automáticos por WhatsApp y SMS." },
                            ].map((f, i) => (
                                <div key={i} className="p-5 rounded-2xl bg-white border border-slate-150 shadow-sm hover:shadow-md transition-shadow">
                                    <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center text-lg mb-3`}>{f.icon}</div>
                                    <h3 className="text-xs font-extrabold text-slate-900 mb-1">{f.title}</h3>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {showDocModal && <DocumentationModal onClose={() => setShowDocModal(false)} />}
            </section>
        );
    }

    // ════════════════════════════════════════════════════════════════════
    // CLINIC WEBSITE HERO — Clean, patient-facing, professional design
    // Completely different from OdontoCloud's own marketing site
    // ════════════════════════════════════════════════════════════════════

    const { clinicSlug } = useParams();
    const slug = clinicSlug || config?.slug;
    const clinicBase = slug ? `/c/${slug}` : "";

    const clinicName = config.name || "Clínica Dental";
    const clinicSlogan = config.heroTitle || config.slogan || `Bienvenidos a ${clinicName}`;
    const clinicSubtitle = config.heroSubtitle || config.description || "Ofrecemos atención odontológica de alto nivel con tecnología de punta y un equipo comprometido con tu bienestar.";
    const clinicPhone = (config.contactPhone || "3015768935").replace(/\D/g, "");
    const clinicPrimary = config.primaryColor || "#1e3a8a";
    const clinicAccent = clinicPrimary; // single-color: no second accent
    const clinicHeroImage = config.heroImage || config.coverImage || "";

    const handleCita = () => {
        const msg = encodeURIComponent(`Hola, quisiera solicitar una cita en ${clinicName}.`);
        window.open(`https://wa.me/57${clinicPhone}?text=${msg}`, '_blank');
    };

    const scrollTo = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <section id="inicio" ref={containerRef} className="relative w-full overflow-hidden font-sans">

            {/* ── HERO ─────────────────────────────────────── */}
            <div
                className="relative min-h-screen flex items-center"
                style={{ paddingTop: '80px' }}
            >
                {/* Video background — always shown for clinic sites */}
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ zIndex: 0 }}
                >
                    <source src={`${import.meta.env.BASE_URL}video.mp4`} type="video/mp4" />
                </video>

                {/* Dark overlay for text legibility */}
                <div
                    className="absolute inset-0"
                    style={{
                        zIndex: 1,
                        background: clinicHeroImage
                            ? 'rgba(5,10,30,0.72)'
                            : 'linear-gradient(135deg, rgba(5,10,30,0.80) 0%, rgba(5,10,30,0.65) 60%, rgba(5,10,30,0.50) 100%)'
                    }}
                />

                {/* Optional: if clinic uploaded their own hero image, show it on top of video as secondary overlay */}
                {clinicHeroImage && (
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
                        style={{ backgroundImage: `url(${clinicHeroImage})`, zIndex: 1 }}
                    />
                )}

                {/* Content */}
                <div className="relative w-full max-w-7xl mx-auto px-6 md:px-12 py-20" style={{ zIndex: 2 }}>
                    <div className="max-w-3xl">
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border border-white/20 bg-white/10 backdrop-blur-sm"
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-white/90 text-xs font-bold uppercase tracking-widest">
                                {config.heroBadge || "Atención de Calidad · Tecnología Avanzada"}
                            </span>
                        </motion.div>

                        {/* Headline */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-5xl md:text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6"
                        >
                            {clinicSlogan}
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18 }}
                            className="text-white/75 text-lg md:text-xl leading-relaxed max-w-2xl mb-10"
                        >
                            {clinicSubtitle}
                        </motion.p>

                        {/* CTAs */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="flex flex-wrap gap-4"
                        >
                            <button
                                onClick={handleCita}
                                className="group flex items-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-black text-white shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
                                style={{ background: clinicPrimary, boxShadow: `0 8px 30px ${clinicPrimary}50` }}
                            >
                                <span>📅 {config.heroBtn1Text || "Agendar Cita Ahora"}</span>
                                <FiArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button
                                onClick={() => navigate(clinicBase ? `${clinicBase}/servicios` : "/servicios")}
                                className="flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white border-2 border-white/30 hover:bg-white/10 backdrop-blur-sm transition-all"
                            >
                                {config.heroBtn2Text || "Ver Nuestros Servicios"}
                            </button>
                        </motion.div>

                        {/* Quick contact */}
                        {(config.contactPhone || config.address) && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.35 }}
                                className="mt-10 pt-8 border-t border-white/15 flex flex-wrap gap-5"
                            >
                                {config.contactPhone && (
                                    <a href={`tel:${config.contactPhone}`} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-semibold transition-colors">
                                        <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-base">📞</span>
                                        {config.contactPhone}
                                    </a>
                                )}
                                {config.address && (
                                    <div className="flex items-center gap-2 text-white/70 text-sm font-semibold">
                                        <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-base">📍</span>
                                        {config.address}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>

            {/* Scroll hint */}
                <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-1.5 opacity-40 cursor-pointer"
                    style={{ zIndex: 2 }}
                >
                    <span className="text-white text-[10px] font-semibold tracking-widest uppercase">Explorar</span>
                    <FiChevronDown size={22} className="text-white" />
                </motion.div>
            </div>

            {/* ── QUICK ACCESS CARDS ───────────────────────── */}
            <div className="bg-white py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: clinicPrimary }}>
                            ¿Qué deseas conocer?
                        </p>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900">
                            Todo lo que necesitas saber
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        {[
                            {
                                icon: "🦷",
                                label: "Nuestros Servicios",
                                desc: "Ortodoncia, implantes, diseño de sonrisa y más tratamientos especializados.",
                                path: `${clinicBase}/servicios`
                            },
                            {
                                icon: "🏥",
                                label: "Sobre Nosotros",
                                desc: "Conoce nuestro equipo, misión y por qué somos la clínica de confianza de cientos de familias.",
                                path: `${clinicBase}/nosotros`
                            },
                            {
                                icon: "📍",
                                label: "Nuestras Sedes",
                                desc: "Horarios, direcciones y teléfonos de todos nuestros puntos de atención.",
                                path: `${clinicBase}/sedes`
                            },
                        ].map((card, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08 }}
                                onClick={() => navigate(card.path)}
                                className="group cursor-pointer bg-white rounded-3xl border-2 border-slate-100 hover:border-transparent shadow-sm hover:shadow-2xl transition-all duration-300 p-8 flex flex-col gap-5 relative overflow-hidden"
                            >
                                {/* Colored top bar on hover */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: clinicPrimary }}
                                />
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform"
                                    style={{ background: `${clinicPrimary}12` }}
                                >
                                    {card.icon}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-black text-slate-900 mb-2">{card.label}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
                                </div>
                                <div
                                    className="flex items-center gap-1.5 text-xs font-bold"
                                    style={{ color: clinicPrimary }}
                                >
                                    Ver más
                                    <FiArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── CONTACT / WHATSAPP STRIP ─────────────────── */}
            <div className="py-20 px-6" style={{ background: clinicPrimary }}>
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
                        ¿Tienes alguna pregunta?
                    </h2>
                    <p className="text-white/65 mb-8">
                        Contáctanos por WhatsApp y te respondemos de inmediato.
                    </p>
                    <button
                        onClick={handleCita}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-white rounded-xl font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all"
                        style={{ color: clinicPrimary }}
                    >
                        <span className="text-xl">💬</span>
                        Contactar por WhatsApp
                        <FiArrowRight size={16} />
                    </button>
                </div>
            </div>

            <DocumentationModal isOpen={showDocModal} onClose={() => setShowDocModal(false)} />
        </section>
    );
}

