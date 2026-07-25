import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { MASTER_CONFIG } from "../constants/MasterConfig";
import { DEFAULT_CONFIG } from "../constants/DefaultConfig";

// Components
import HeroSection from "./landing/HeroSection";
import ServicesSection from "./landing/ServicesSection";
import PageHeader from "../components/common/PageHeader";
import TestimonialsSection from "./landing/TestimonialsSection";
import { getPlans } from "../services/adminService";
import { FiMessageCircle, FiAlertTriangle } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { isAccessBlocked } from "../utils/subscriptionHelper";
import TrialModal from "../components/landing/TrialModal";
import "../styles/modern.css";

export default function ModernLanding({ previewConfig, isMaster = false, section = null, activeTab = null }) {
    const { clinicSlug } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // Use master config as ultimate fallback or if explicitly told to be master
    const baseInitialConfig = isMaster ? MASTER_CONFIG : DEFAULT_CONFIG;

    // Allows previewing directly from CMS without fetching
    const [config, setConfig] = useState(previewConfig || baseInitialConfig);
    const [loading, setLoading] = useState(!previewConfig && !isMaster);
    const [plans, setPlans] = useState([]);
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState("");
    const [tenantInfo, setTenantInfo] = useState(null);

    useEffect(() => {
        if (!activeTab) return;
        const tabToIdMap = {
            hero: "inicio",
            style: "inicio",
            identity: "nosotros",
            services: "servicios",
            team: "equipo",
            testimonials: "testimonios",
            footer: "contacto",
            cta_final: "contacto"
        };
        const targetId = tabToIdMap[activeTab] || "inicio";
        setTimeout(() => {
            const el = document.getElementById(targetId) || document.getElementById("inicio");
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }, [activeTab]);

    useEffect(() => {
        // Handle Hash Scroll
        if (location.hash) {
            const id = location.hash.replace('#', '');
            setTimeout(() => {
                const element = document.getElementById(id);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, 300);
        }
    }, [location]);

    useEffect(() => {
        if (previewConfig) {
            setConfig({ ...previewConfig });
            setLoading(false);
            return;
        }

        const safetyTimer = setTimeout(() => {
            console.warn("⚠️ Landing Content Timeout - Forcing Display");
            setLoading(false);
        }, 3500);

        if (isMaster) {
            const loadMaster = async () => {
                if (!config.heroTitle) setLoading(true);
                try {
                    const { data: row } = await supabase
                        .from("website_config")
                        .select("config")
                        .eq("tenant_id", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
                        .maybeSingle();

                    if (row?.config) {
                        const dbData = row.config;
                        const cleanDbData = {};
                        const clinicalKeywords = ["agenda", "cita", "sonre", "clínica certificada", "especialistas", "odontolog", "sonrisa", "ortodoncia", "implante", "blanqueamiento", "limpieza", "nuestros servicios", "servicios"];

                        const isClinical = (val) => {
                            if (typeof val === 'string') {
                                const lowerVal = val.toLowerCase();
                                return clinicalKeywords.some(kw => lowerVal.includes(kw));
                            }
                            if (Array.isArray(val)) {
                                return val.some(item => isClinical(item));
                            }
                            if (val && typeof val === 'object') {
                                return Object.values(val).some(v => isClinical(v));
                            }
                            return false;
                        };

                        Object.keys(dbData).forEach(key => {
                            const val = dbData[key];
                            if (val && val !== "" && val !== "undefined") {
                                // Important: We allow slides and services even if they mention clinical words
                                // because they are part of the SaaS marketing strategy.
                                if (key === 'slides' || key === 'services' || !isClinical(val)) {
                                    cleanDbData[key] = val;
                                }
                            }
                        });

                        // Smart Merge for Slides: Keep what the user manually set, 
                        // but fill the rest with Master defaults to reach the new 5-slide goal.
                        const dbSlides = cleanDbData.slides || [];
                        const masterSlides = MASTER_CONFIG.slides || [];
                        const mergedSlides = [...dbSlides];

                        // If DB has fewer slides than Master, fill from Master starting from the next index
                        if (mergedSlides.length < masterSlides.length) {
                            for (let i = mergedSlides.length; i < masterSlides.length; i++) {
                                mergedSlides.push(masterSlides[i]);
                            }
                        }

                        setConfig({
                            ...MASTER_CONFIG,
                            ...cleanDbData,
                            name: MASTER_CONFIG.name,
                            heroTitle: cleanDbData.heroTitle || MASTER_CONFIG.heroTitle,
                            heroSubtitle: cleanDbData.heroSubtitle || MASTER_CONFIG.heroSubtitle,
                            heroBadgeText: cleanDbData.heroBadgeText || MASTER_CONFIG.heroBadgeText,
                            slides: mergedSlides,
                            services: cleanDbData.services || MASTER_CONFIG.services
                        });
                    } else {
                        setConfig(MASTER_CONFIG);
                    }

                    const dbPlans = await getPlans();
                    setPlans(dbPlans.filter(p => p.active !== false));
                } catch (e) {
                    console.error("Error loading master config:", e);
                    setConfig(MASTER_CONFIG);
                } finally {
                    setLoading(false);
                    clearTimeout(safetyTimer);
                }
            };
            loadMaster();
            return;
        }

        const loadContent = async () => {
            if (config.slug !== clinicSlug) setLoading(true);
            try {
                if (clinicSlug) {
                    const q = query(collection(db, "tenants"), where("slug", "==", clinicSlug));
                    const qSnap = await getDocs(q);

                    if (!qSnap.empty) {
                        const tenantData = qSnap.docs[0].data();
                        const inquilino = qSnap.docs[0].id;
                        setTenantInfo({ id: inquilino, ...tenantData });
                        const webRef = doc(db, "website_config", inquilino);
                        const webSnap = await getDoc(webRef);

                        if (webSnap.exists()) {
                            const data = webSnap.data();
                            const clinicName = tenantData.empresaNombre || tenantData.name || "Clínica Dental";

                            const isSoftwareTitle = (t) => !t || t.toLowerCase().includes("gestiona tu clínica") || t.toLowerCase().includes("software");
                            const heroTitle = isSoftwareTitle(data.heroTitle)
                                ? `Cuidamos de tu sonrisa con excelencia en ${clinicName}`
                                : data.heroTitle;

                            const heroSubtitle = (data.heroSubtitle || "").toLowerCase().includes("odontocloud es el software")
                                ? "La mejor atención odontológica con tecnología avanzada y un equipo especializado."
                                : (data.heroSubtitle || DEFAULT_CONFIG.heroSubtitle);

                            const heroBtn1Text = (data.heroBtn1Text || "").toLowerCase().includes("solicitar")
                                ? "Agendar Cita"
                                : (data.heroBtn1Text || DEFAULT_CONFIG.heroBtn1Text);

                            setConfig({
                                ...DEFAULT_CONFIG,
                                ...data,
                                name: clinicName,
                                heroTitle,
                                heroSubtitle,
                                heroBtn1Text,
                                slug: clinicSlug,
                                isMaster: false
                            });
                        } else {
                            const clinicName = tenantData.empresaNombre || tenantData.name || "Clínica Dental";
                            setConfig({
                                ...DEFAULT_CONFIG,
                                name: clinicName,
                                heroTitle: `Cuidamos de tu sonrisa con excelencia en ${clinicName}`,
                                heroSubtitle: "La mejor atención odontológica con tecnología avanzada y un equipo especializado.",
                                heroBtn1Text: "Agendar Cita",
                                slug: clinicSlug,
                                isMaster: false
                            });
                        }
                    } else {
                        setConfig(MASTER_CONFIG);
                    }
                } else {
                    const ref = doc(db, "website_config", "general");
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        setConfig({ ...DEFAULT_CONFIG, ...snap.data() });
                    }
                }
            } catch (error) {
                console.error("Error loading website config:", error);
            } finally {
                setLoading(false);
                clearTimeout(safetyTimer);
            }
        };
        loadContent();
    }, [previewConfig, isMaster, clinicSlug]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="animate-pulse flex space-x-2"><div className="h-3 w-3 bg-slate-200 rounded-full"></div><div className="h-3 w-3 bg-slate-200 rounded-full"></div></div></div>;

    if (clinicSlug && tenantInfo && isAccessBlocked(tenantInfo)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6 relative overflow-hidden font-sans">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opacity-80" />
                <div className="bg-slate-800/40 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-700/50 p-10 max-w-md w-full text-center space-y-6 relative z-10 animate-fade-in">
                    <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto text-rose-500 border border-rose-500/20">
                        <FiAlertTriangle size={32} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Sitio temporalmente inactivo</h2>
                        <p className="text-sm text-slate-400">
                            El sitio web de <strong>{tenantInfo.name || "la clínica"}</strong> no se encuentra disponible en este momento.
                        </p>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Si eres el administrador de esta clínica, ponte en contacto con soporte de OdontoCloud para reactivar tu cuenta.
                    </p>
                    <div className="border-t border-slate-700/50 pt-6">
                        <p className="text-xs text-indigo-400 font-bold tracking-widest uppercase">OdontoCloud Platform</p>
                    </div>
                </div>
            </div>
        );
    }

    const brandStyle = {
        '--color-primary': config.primaryColor || '#0f172a',
        '--color-accent': config.accentColor || '#3b82f6',
        fontFamily: config.fontFamily || 'Inter, sans-serif'
    };

    const heroKey = config?.name || 'master';
    const onShowTrial = (planName) => {
        if (!config.isMaster) {
            // Clinic Conversion: Redirect to WhatsApp or show contact
            const whatsappUrl = `https://wa.me/57${(config?.contactPhone || "3001234567").replace(/\D/g, '')}?text=Hola,%20quisiera%20agendar%20una%20cita%20en%20${config?.name || 'la clínica'}`;
            window.open(whatsappUrl, '_blank');
            return;
        }
        setSelectedPlan(planName || "Trial");
        setShowTrialModal(true);
    };

    return (
        <>
            <Helmet>
                <title>{config.seoTitle || DEFAULT_CONFIG.seoTitle}</title>
                <meta name="description" content={config.seoDesc || DEFAULT_CONFIG.seoDesc} />
            </Helmet>

            <main className="landing-mode min-h-screen selection:bg-cyan-500/30 selection:text-cyan-200" style={brandStyle}>
                {/* Show Hero ONLY if NO specific section is requested */}
                {!section && <HeroSection key={heroKey} config={config} onShowTrial={onShowTrial} />}

                {/* Services Section - Show if 'servicios' requested OR homepage */}
                {((!config.isMaster && !section) || section === 'servicios') && (
                    <div id="features" className={section === 'servicios' ? "min-h-screen bg-white" : ""}>
                        {/* Dedicated Page Header */}
                        {section === 'servicios' && (
                            <PageHeader
                                title="Nuestros Servicios"
                                subtitle="Excelencia Clínica"
                                bgImage={config.servicesHeroImage || "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=2000"}
                            />
                        )}

                        {/* Services Intro Section - Added for visual balance */}
                        {section === 'servicios' && (
                            <section className="py-20 bg-white border-b border-slate-50">
                                <div className="container mx-auto px-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                        <div className="space-y-6 order-2 lg:order-1">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-50 text-cyan-700 text-xs font-bold uppercase tracking-widest leading-none">
                                                Odontología Integral
                                            </div>
                                            <h2 className="text-4xl font-bold text-slate-900 leading-tight">
                                                Tecnología y experiencia a tu servicio
                                            </h2>
                                            <p className="text-lg text-slate-600 leading-relaxed font-light">
                                                En nuestra clínica, entendemos que cada sonrisa es única. Por eso, ofrecemos una gama completa de especialidades odontológicas bajo un mismo techo, coordinadas por profesionales expertos.
                                            </p>
                                            <ul className="space-y-3 pt-2">
                                                {[
                                                    "Equipos de última generación",
                                                    "Materiales certificados de alta calidad",
                                                    "Protocolos estrictos de bioseguridad"
                                                ].map((item, i) => (
                                                    <li key={i} className="flex items-center gap-3 text-slate-700">
                                                        <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-xs font-bold">✓</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="relative rounded-2xl overflow-hidden shadow-xl order-1 lg:order-2">
                                            <img
                                                src={config.servicesIntroImage || "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&q=80&w=800"}
                                                alt="Consultorio Odontológico"
                                                className="w-full h-auto object-cover aspect-[4/3] hover:scale-105 transition-transform duration-700"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}
                        <ServicesSection config={config} dark={section !== 'servicios'} onShowTrial={onShowTrial} hideTitle={false} />
                    </div>
                )}

                {/* Identity Section - Show if 'nosotros' requested OR homepage */}
                {(!config.isMaster && (config.mission || config.vision) && (!section || section === 'nosotros')) && (
                    <div className={section === 'nosotros' ? "min-h-screen bg-slate-50" : ""}>
                        {/* Dedicated Page Header */}
                        {section === 'nosotros' && (
                            <PageHeader
                                title="Nuestra Historia"
                                subtitle="Pasión por tu Sonrisa"
                                bgImage={config.identityHeroImage}
                            />
                        )}
                        <section id="nosotros" className={`relative overflow-hidden ${section === 'nosotros' ? "py-24" : "py-24"} bg-slate-50`}>
                            {/* Decorative Elements */}
                            <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-100/50 skew-x-12 translate-x-20 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                            <div className="container mx-auto px-6 relative z-10">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                                    {/* Left: Text Content */}
                                    <div className="space-y-8 order-2 lg:order-1">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-widest border border-blue-100">
                                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                            Nuestra Esencia
                                        </div>

                                        <h2 className="text-4xl md:text-5xl font-bold text-slate-800 leading-[1.15]">
                                            {config.identityTitle || "Comprometidos con tu Bienestar"}
                                        </h2>

                                        <p className="text-lg text-slate-600 leading-relaxed font-light">
                                            {config.identitySubtitle || "En nuestra clínica, fusionamos la tecnología más avanzada con un trato humano y personalizado para transformar no solo tu sonrisa, sino tu calidad de vida."}
                                        </p>

                                        {/* Mission/Vision Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
                                            {config.mission && (
                                                <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 hover:border-blue-100 transition-colors group">
                                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 text-2xl group-hover:scale-110 transition-transform">
                                                        🎯
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 mb-2">Misión</h4>
                                                    <p className="text-sm text-slate-500 leading-relaxed">{config.mission}</p>
                                                </div>
                                            )}

                                            {config.vision && (
                                                <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 hover:border-purple-100 transition-colors group">
                                                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4 text-2xl group-hover:scale-110 transition-transform">
                                                        👁️
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 mb-2">Visión</h4>
                                                    <p className="text-sm text-slate-500 leading-relaxed">{config.vision}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Visuals */}
                                    <div className="relative order-1 lg:order-2">
                                        <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white/50">
                                            <img
                                                src={config.identityHeroImage || "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800"}
                                                alt="Clinic Team"
                                                className="w-full h-auto object-cover aspect-[4/5] hover:scale-105 transition-transform duration-1000"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>

                                            {/* Name Reveal */}
                                            <div className="absolute bottom-0 left-0 p-8 w-full">
                                                <p className="text-white/80 text-sm font-bold uppercase tracking-wider mb-1">Equipo Médico</p>
                                                <p className="text-white text-2xl font-serif font-bold">{config.name || "Tu Clínica"}</p>
                                            </div>
                                        </div>

                                        {/* Floating Stats Badge */}
                                        <div className="absolute -bottom-8 -left-8 md:bottom-12 md:-left-12 bg-white p-6 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 max-w-[200px] animate-bounce-slow hidden md:block">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                                                    +15
                                                </div>
                                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider leading-tight">
                                                    Años de<br />Experiencia
                                                </div>
                                            </div>
                                        </div>

                                        {/* Decorative Dots */}
                                        <div className="absolute -top-12 -right-12 text-slate-200 pointer-events-none">
                                            <svg width="100" height="100" viewBox="0 0 100 100" fill="currentColor">
                                                <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                                    <circle cx="2" cy="2" r="2" />
                                                </pattern>
                                                <rect width="100" height="100" fill="url(#dots)" />
                                            </svg>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* Locations Section - Show if 'sedes' requested */}
                {(!config.isMaster && (!section || section === 'sedes')) && (
                    <div className={section === 'sedes' ? "min-h-screen bg-white" : ""}>
                        {/* Dedicated Page Header for Sedes */}
                        {section === 'sedes' && (
                            <PageHeader
                                title="Nuestras Sedes"
                                subtitle="Estamos cerca de ti"
                                bgImage="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2000"
                            />
                        )}

                        {/* Only show the content block if it's the dedicated page to avoid cluttering the home if not desired, 
                            OR if you want it on home too, remove the check. 
                            For now, let's show it on Home ONLY if explicitly desired, but standard pattern here is:
                            If (!section) -> Show everything? 
                            The user complained 'lo de sedes no muestra nada', implying they clicked the link.
                        */}
                        {(section === 'sedes') && (
                            <section id="sedes" className="py-20 bg-white">
                                <div className="container mx-auto px-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                                        {/* Content from LocationsPage.jsx adapted */}
                                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-xl transition-all group">
                                            <div className="h-48 rounded-xl bg-slate-200 mb-6 overflow-hidden relative">
                                                <img
                                                    src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800"
                                                    alt="Sede Principal"
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-4">
                                                    <span className="text-white font-bold text-lg">Sede Principal - Norte</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <span className="text-2xl">📍</span>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">Dirección</h4>
                                                        <p className="text-slate-600 text-sm">Calle 100 # 15-20, Edificio OdontoTower. Consultorio 505.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <span className="text-2xl">⏰</span>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">Horarios</h4>
                                                        <p className="text-slate-600 text-sm">Lunes a Viernes: 7:00 AM - 7:00 PM</p>
                                                        <p className="text-slate-600 text-sm">Sábados: 8:00 AM - 1:00 PM</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <span className="text-2xl">📞</span>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">Teléfono</h4>
                                                        <p className="text-slate-600 text-sm">+57 {config.contactPhone}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <a
                                                href="https://maps.google.com"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-6 block w-full text-center py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                                            >
                                                Ver en Mapa
                                            </a>
                                        </div>

                                        {/* Placeholder for expansion */}
                                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 opacity-60 relative overflow-hidden">
                                            <div className="absolute top-6 right-6 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest rotate-3 z-10">
                                                Próximamente
                                            </div>
                                            <div className="h-48 rounded-xl bg-slate-200 mb-6 flex items-center justify-center">
                                                <span className="text-4xl opacity-20">🏥</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-400 mb-2">Nueva Sede Sur</h3>
                                            <p className="text-slate-400 text-sm">Estamos trabajando para estar más cerca de ti.</p>
                                        </div>

                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* Testimonials - Homepage Only */}
                {!section && <TestimonialsSection config={config} dark={true} />}

                {/* Trial/CTA Section - Premium Dark Theme (Homepage Only) */}
                {!section && (
                    <section id="trial" className="py-24 relative overflow-hidden text-center">
                        {/* Background Glow */}
                        <div className="absolute inset-0 bg-[var(--viva-blue)] z-0" />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl bg-sky-500/10 blur-[120px] rounded-full pointer-events-none" />

                        <div className="container mx-auto px-6 relative z-10 max-w-4xl">
                            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-white drop-shadow-xl">
                                {config.ctaTitle || "¿Listo para transformar tu clínica?"}
                            </h2>
                            <p className="text-xl text-slate-400 mb-10 font-light leading-relaxed">
                                {config.ctaText || "Únete a la nueva era de la odontología digital. Sin contratos de permanencia, sin complicaciones."}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    onClick={onShowTrial}
                                    className="relative inline-block bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-4 px-12 rounded-full shadow-[0_10px_30px_-10px_rgba(14,165,233,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(14,165,233,0.6)] hover:-translate-y-1 transition-all uppercase tracking-widest text-sm"
                                >
                                    {config.ctaBtnText || (config.isMaster ? "COMENZAR PRUEBA GRATIS" : "AGENDAR CITA AHORA")}
                                </button>
                            </div>
                        </div>
                    </section>
                )}


                {/* TRIAL MODAL */}
                <TrialModal
                    isOpen={showTrialModal}
                    onClose={() => setShowTrialModal(false)}
                    initialPlan={selectedPlan}
                />
            </main>
        </>
    );
}
