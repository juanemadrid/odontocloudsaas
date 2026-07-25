import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCheck, FiCalendar, FiFolder, FiBarChart2, FiPackage, FiGlobe, FiMonitor, FiUsers } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import FeatureDetailModal from "../../components/landing/FeatureDetailModal";
import { DEFAULT_CONFIG } from "../../constants/DefaultConfig";

const containerConfig = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemConfig = {
    hidden: { opacity: 0, y: 15 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: "easeOut" }
    }
};

export default function ServicesSection({ config, onShowTrial, dark = false, hideTitle = true }) {
    const isMaster = config?.isMaster;
    const hideHeader = config?.servicesSectionTitle === null || hideTitle;
    const navigate = useNavigate();
    const [selectedFeature, setSelectedFeature] = useState(null);

    const title = hideHeader ? null : (config?.servicesSectionTitle || (isMaster ? "Nuestros Módulos" : "Servicios Especializados"));

    const saasFeatures = [
        {
            title: "Gestión de Pacientes",
            desc: "Administración completa de historias clínicas, fichas de pacientes y evolución de tratamientos en un solo lugar.",
            icon: <FiUsers />,
            slug: "pacientes",
            longDesc: "Gestione toda la información de sus pacientes de forma centralizada y segura. Acceda a historias clínicas, planes de tratamiento, y evolución desde cualquier dispositivo.",
            benefits: ["Historia Clínica Unificada", "Fichas Personalizables", "Control de Evolución", "Documentos Digitales"]
        },
        {
            title: "Agenda Inteligente",
            desc: "Sistema de citas automatizado con recordatorios por WhatsApp para reducir el ausentismo.",
            icon: <FiCalendar />,
            slug: "agenda",
            longDesc: "Optimice su tiempo con nuestra agenda inteligente. Envíe recordatorios automáticos por WhatsApp y correo electrónico para confirmar citas y reducir el ausentismo.",
            benefits: ["Citas Online", "Recordatorios WhatsApp", "Lista de Espera", "Sincronización Google Calendar"]
        },
        {
            title: "Facturación Electrónica",
            desc: "Emite facturas DIAN cumpliendo con toda la normativa legal vigente de manera sencilla.",
            icon: <FiPackage />,
            slug: "facturacion",
            longDesc: "Cumpla con la normativa de la DIAN emitiendo facturas electrónicas directamente desde la plataforma. Simplifique su contabilidad y evite sanciones.",
            benefits: ["Facturación DIAN", "Notas Crédito/Débito", "Reportes Contables", "Envío Automático"]
        },
        {
            title: "Reportes Avanzados",
            desc: "Visualiza el rendimiento de tu clínica con métricas en tiempo real y reportes detallados.",
            icon: <FiBarChart2 />,
            slug: "reportes",
            longDesc: "Tome decisiones informadas con nuestro módulo de reportes. Analice ingresos, tratamientos realizados, desempeño de doctores y más, todo en tiempo real.",
            benefits: ["Dashboard Ejecutivo", "Reportes Financieros", "Métricas de Productividad", "Exportación a Excel/PDF"]
        },
        {
            title: "Inventario",
            desc: "Control total de insumos y materiales para evitar desabastecimientos.",
            icon: <FiFolder />,
            slug: "inventario",
            longDesc: "Mantenga su inventario bajo control. Registre entradas y salidas de materiales, controle fechas de vencimiento y reciba alertas de stock bajo.",
            benefits: ["Control de Stock", "Alertas de Vencimiento", "Proveedores", "Costeo de Tratamientos"]
        },
        {
            title: "Marketing Dental",
            desc: "Herramientas integradas para atraer y retener más pacientes.",
            icon: <FiGlobe />,
            slug: "marketing",
            longDesc: "Haga crecer su clínica con nuestras herramientas de marketing. Envíe campañas de correo, gestione promociones y fidelice a sus pacientes.",
            benefits: ["Campañas de Email", "Promociones", "CRM", "Seguimiento de Leads"]
        }
    ];

    let finalServices = (!isMaster && config?.services) ? config.services : saasFeatures;

    // Hydrate missing images from DEFAULT_CONFIG (Fix for tenants with old Firestore data)
    finalServices = finalServices.map(svc => {
        if (svc.image) return svc;
        const defaultSvc = DEFAULT_CONFIG?.services?.find(d =>
            d.title === svc.title ||
            d.title.toLowerCase().includes(svc.title.toLowerCase()) ||
            svc.title.toLowerCase().includes(d.title.toLowerCase())
        );
        return (defaultSvc?.image) ? { ...svc, image: defaultSvc.image } : svc;
    });

    const displayServices = finalServices;

    const handleServiceClick = (svc) => {
        setSelectedFeature(svc);
    };

    return (
        <section id="servicios" className={`py-12 relative ${dark ? 'bg-transparent' : 'bg-white'}`} style={{ backgroundColor: dark ? 'transparent' : '#ffffff' }}>
            <div className="container mx-auto px-6 max-w-7xl relative z-10">
                {/* Header removed as per user request to clean up interface
                {title && (
                    <div className="mb-16 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-100 text-sky-700 text-xs font-bold uppercase tracking-widest mb-6 border border-sky-200"
                        >
                            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                            {config?.servicesSectionBadge || "Funcionalidades Clave"}
                        </motion.div>

                        <h2 className={`text-3xl md:text-4xl font-display font-bold ${dark ? 'text-white drop-shadow-lg' : 'text-slate-900'}`}>
                            {title}
                        </h2>

                        {!hideTitle && (
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                                className={`text-xl font-light mt-6 max-w-3xl mx-auto ${dark ? 'text-slate-400' : 'text-slate-500'}`}
                            >
                                {config?.servicesSectionDesc || "Herramientas potentes y fáciles de usar diseñadas para la odontología moderna."}
                            </motion.p>
                        )}
                    </div>
                )} 
                */}

                <motion.div
                    variants={containerConfig}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {displayServices.map((svc, i) => (
                        <motion.div
                            key={i}
                            variants={itemConfig}
                            onClick={() => handleServiceClick(svc)}
                            className={`group relative p-8 rounded-[2.5rem] cursor-pointer transition-all duration-500 flex flex-col h-full
                                ${dark
                                    ? 'glass-premium border border-white/5 hover:bg-white/5 hover:-translate-y-2'
                                    : '!bg-white border border-slate-100 shadow-xl hover:shadow-2xl hover:-translate-y-4 hover:border-blue-100'
                                }
                            `}
                        >
                            {svc.image ? (
                                <div className="relative z-10 flex flex-col h-full rounded-[2rem] overflow-hidden">
                                    {/* Image Header */}
                                    <div className="h-64 -mx-8 -mt-8 mb-6 relative overflow-hidden">
                                        <img src={svc.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={svc.title} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
                                            <div className="text-white">
                                                <div className="text-4xl mb-2">{svc.icon}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className={`text-2xl font-serif font-bold mb-3 tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                                        {svc.title}
                                    </h3>

                                    <p className={`text-sm leading-relaxed mb-6 font-light flex-grow ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {svc.desc}
                                    </p>

                                    <div className={`mt-auto pt-4 border-t ${dark ? 'border-white/10' : 'border-slate-100'}`}>
                                        <div className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all ${dark ? 'text-sky-400' : 'text-indigo-600'}`}>
                                            Más Información <FiArrowRight />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center text-3xl mb-8 transition-all duration-300 shadow-sm group-hover:scale-110
                                        ${dark
                                            ? 'bg-white/10 text-sky-400 group-hover:bg-sky-500 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(14,165,233,0.4)]'
                                            : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-blue-200'
                                        }
                                    `}>
                                        {svc.icon}
                                    </div>

                                    <h3 className={`text-2xl font-bold mb-4 tracking-tight transition-colors ${dark ? 'text-white group-hover:text-sky-300' : 'text-slate-900 group-hover:text-blue-700'}`}>
                                        {svc.title}
                                    </h3>

                                    <p className={`text-base leading-relaxed mb-8 font-light flex-grow ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {svc.desc}
                                    </p>

                                    <div className={`mt-auto pt-4 border-t ${dark ? 'border-white/10' : 'border-slate-50'}`}>
                                        <div className={`text-xs font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all duration-300 group-hover:gap-4 ${dark ? 'text-sky-400 group-hover:text-sky-300' : 'text-blue-600'}`}>
                                            Explorar Detalles <FiArrowRight className="text-lg" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>
            </div>

            {/* Feature Modal */}
            <FeatureDetailModal
                feature={selectedFeature}
                isOpen={!!selectedFeature}
                onClose={() => setSelectedFeature(null)}
            />
        </section>
    );
}
