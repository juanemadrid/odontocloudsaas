import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiStar, FiFolder, FiMessageCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';

export default function FeatureDetail() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { config } = useOutletContext() || {};
    const [feature, setFeature] = useState(null);

    // Default services fallback (duplicated from ServicesSection for safety if config is missing)
    const defaultSaaSServices = [
        {
            slug: "agenda",
            title: "Agenda Inteligente",
            desc: "Control total de citas con recordatorios automáticos por WhatsApp y micro-sync.",
            longDesc: "El motor de agendamiento más avanzado del mercado. Detecta huecos en la agenda, sugiere citas a pacientes en lista de espera y envía recordatorios automáticos por WhatsApp sin intervención humana. Reduce el ausentismo hasta en un 40% y optimiza el tiempo de tus sillones.",
            features: ["Recordatorios WhatsApp Automáticos", "Multi-especialista y Multi-sede", "Agenda Web para Pacientes", "Lista de Espera Inteligente"],
            benefits: ["Cero Inasistencias", "Mejor Organización del Tiempo", "Acceso Remoto 24/7", "Experiencia Premium para Pacientes"],
            color: "#3b82f6"
        },
        {
            slug: "historia-clinica",
            title: "Historia Clínica Digital",
            desc: "Acceso instantáneo a radiografías, evoluciones y anexos desde cualquier dispositivo.",
            longDesc: "Cumpla con la normativa vigente con historias clínicas 100% en la nube y seguras. Incluye odontograma 3D interactivo, periodontograma, consentimientos informados digitales y firma biométrica. Todo centralizado y accesible desde cualquier lugar.",
            features: ["Odontograma 3D Interactivo", "Carga de Imágenes y Rayos X", "Consentimientos Informados Digitales", "Firma Biométrica y Digital"],
            benefits: ["Cero Papel y Archivo Físico", "Información Centralizada y Segura", "Cumplimiento Normativo Total", "Acceso Rápido en Consulta"],
            color: "#06b6d4"
        },
        {
            slug: "finanzas",
            title: "Finanzas y Reportes",
            desc: "Control exacto de ingresos, egresos y comisiones de doctores con reportes automáticos.",
            longDesc: "Toma el control financiero de tu clínica. Conoce tu rentabilidad real, automatiza el cálculo de comisiones a odontólogos y supervisa tus cierres de caja diarios. Genera reportes detallados para la toma de decisiones estratégicas.",
            features: ["Reportes de Venta Detallados", "Cálculo Automático de Comisiones", "Gestión de Gastos y Proveedores", "Facturación Electrónica DIAN"],
            benefits: ["Claridad Financiera Total", "Ahorro de Tiempo Administrativo", "Prevención de Fugas de Dinero", "Toma de Decisiones Basada en Datos"],
            color: "#10b981"
        },
        {
            slug: "inventarios",
            title: "Inventario Digital",
            desc: "Gestión de materiales y alertas de stock bajo para que nunca interrumpas tu operación.",
            longDesc: "Evita el desabastecimiento y el vencimiento de insumos. Controla las entradas y salidas de materiales por bodega y asocia consumos a procedimientos específicos para un costeo preciso.",
            features: ["Control Multi-bodega", "Alertas de Stock Bajo y Vencimiento", "Kardex de Productos", "Consumo por Procedimiento"],
            benefits: ["Cero Desperdicio de Materiales", "Orden Operativo", "Compras Más Eficientes", "Costeo Exacto de Tratamientos"],
            color: "#f59e0b"
        },
        {
            slug: "portal",
            title: "Portal del Paciente",
            desc: "Tus pacientes pueden ver sus citas, facturas y evoluciones desde su propio acceso.",
            longDesc: "Fideliza a tus pacientes ofreciéndoles una experiencia digital superior. A través de su propio portal, podrán consultar sus próximas citas, descargar facturas, ver su plan de tratamiento y actualizar sus datos.",
            features: ["Descarga de Facturas y Presupuestos", "Historial de Citas y Tratamientos", "Documentos Compartidos", "Actualización de Datos"],
            benefits: ["Mejor Experiencia del Paciente", "Transparencia Total", "Ahorro de Tiempo en Recepción", "Imagen de Modernidad"],
            color: "#8b5cf6"
        },
        {
            slug: "marketing",
            title: "Página Web para Clínicas",
            desc: "Incluimos un sitio web profesional y moderno, conectado directamente con tu agenda.",
            longDesc: "No solo te damos un software, te damos una presencia digital. Tu suscripción incluye una página web moderna, optimizada para móviles y buscadores, conectada directamente a tu agenda para que los pacientes reserven online.",
            features: ["SEO Optimizado para Odontólogos", "Diseño Responsive y Moderno", "Reserva de Citas Online", "Integración con Redes Sociales"],
            benefits: ["Más Pacientes Nuevos", "Marca Profesional y Confiable", "Disponible 24/7 para Reservas", "Ahorro en Desarrollo Web"],
            color: "#ec4899"
        }
    ];

    useEffect(() => {
        // Scroll to top on mount
        window.scrollTo(0, 0);

        // Find feature in config or default list
        const services = config?.services || defaultSaaSServices;
        const found = services.find(s => s.slug === slug || s.title.toLowerCase().includes(slug?.replace(/-/g, ' ')));

        if (found) {
            setFeature(found);
        } else {
            // Try to fuzzy match if exact slug fails
            const fuzzy = services.find(s =>
                s.title.toLowerCase().includes("agenda") && slug.includes("agenda") ||
                s.title.toLowerCase().includes("historia") && slug.includes("historia") ||
                s.title.toLowerCase().includes("finanza") && slug.includes("finanza")
            );
            if (fuzzy) setFeature(fuzzy);
        }
    }, [slug, config]);

    if (!feature) {
        return (
            <div className="min-h-screen flex items-center justify-center pt-20">
                <div className="animate-pulse flex space-x-2">
                    <div className="h-3 w-3 bg-slate-200 rounded-full"></div>
                    <div className="h-3 w-3 bg-slate-200 rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-20 px-6 bg-slate-50 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none -mt-32 -mr-32" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none -mb-32 -ml-32" />

            <div className="container mx-auto max-w-5xl relative z-10">
                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-sky-600 transition-colors mb-8 font-bold text-sm uppercase tracking-widest group"
                >
                    <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" /> Volver
                </button>

                {/* Hero Content */}
                <div className="bg-white rounded-[3rem] shadow-xl p-8 md:p-14 border border-slate-100 relative overflow-hidden">
                    {/* Glossy Effect */}
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/50 via-transparent to-transparent pointer-events-none" />

                    <div className="flex flex-col md:flex-row gap-10 items-start">
                        {/* Icon */}
                        <div className="shrink-0 w-24 h-24 rounded-[2rem] bg-blue-50 text-blue-600 flex items-center justify-center text-5xl shadow-inner">
                            {/* Render icon if it's a component, otherwise generic */}
                            <FiStar />
                        </div>

                        <div className="flex-1">
                            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                                {feature.title}
                            </h1>
                            <p className="text-xl text-slate-500 font-light leading-relaxed max-w-3xl">
                                {feature.longDesc || feature.desc}
                            </p>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px w-full bg-slate-100 my-10" />

                    {/* Details Grid */}
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* Features List */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FiFolder className="text-lg" /> Características Principales
                            </h3>
                            <ul className="space-y-4">
                                {feature.features?.map((item, idx) => (
                                    <motion.li
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="flex items-start gap-3 text-slate-600 font-medium"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 text-xs mt-0.5">
                                            {idx + 1}
                                        </div>
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                        </div>

                        {/* Benefits List */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                <FiStar className="text-lg" /> Beneficios para tu Clínica
                            </h3>
                            <ul className="space-y-4">
                                {feature.benefits?.map((item, idx) => (
                                    <motion.li
                                        key={idx}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 + (idx * 0.1) }}
                                        className="flex items-start gap-3 text-slate-600 font-medium"
                                    >
                                        <FiCheck className="text-green-500 mt-1 shrink-0" />
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="text-slate-500 text-sm">
                            ¿Te interesa esta funcionalidad?
                        </div>
                        <button
                            onClick={() => window.open(`https://wa.me/573001234567?text=Hola,%20me%20interesa%20saber%20más%20sobre%20${feature.title}`, '_blank')}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-green-500/30 transition-all hover:-translate-y-1 flex items-center gap-2"
                        >
                            <FiMessageCircle /> Consultar por WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
