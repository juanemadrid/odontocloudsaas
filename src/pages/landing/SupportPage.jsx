import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBook, FiCode, FiHelpCircle, FiMessageCircle, FiSearch, FiChevronRight, FiCopy, FiTerminal } from 'react-icons/fi';

export default function SupportPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('help'); // 'help' or 'api'

    const helpArticles = [
        {
            category: "Inicio",
            title: "Guía de Inicio Rápido",
            desc: "Aprende a configurar tu clínica en menos de 10 minutos: usuarios, sedes y especialidades.",
            icon: "🚀",
            slug: "guia-inicio-rapido"
        },
        {
            category: "Agenda",
            title: "Configuración de WhatsApp",
            desc: "Cómo activar los recordatorios automáticos y personalizar los mensajes de confirmación.",
            icon: "📱",
            slug: "configuracion-whatsapp"
        },
        {
            category: "Clínica",
            title: "Dominando el Odontograma 3D",
            desc: "Uso avanzado del visor interactivo para diagnósticos precisos y evoluciones gráficas.",
            icon: "🦷",
            slug: "odontograma-3d"
        },
        {
            category: "Finanzas",
            title: "Gestión de RIPS y Facturación",
            desc: "Todo sobre la normativa legal vigente y cómo exportar tus archivos RIPS sin errores.",
            icon: "🧾",
            slug: "gestion-rips"
        }
    ];
    // ... (rest of component)
    // In the map loop:
    <button
        onClick={() => navigate(`/soporte/articulo/${art.slug}`)}
        className="flex items-center gap-2 text-slate-900 font-bold group-hover:gap-4 transition-all cursor-pointer"
    >
        Leer artículo <FiChevronRight className="text-blue-500" />
    </button>

    const apiEndpoints = [
        {
            method: "GET",
            path: "/v1/patients",
            desc: "Recupera la lista completa de pacientes activos de tu clínica.",
            code: `curl -X GET "https://api.odontocloud.co/v1/patients" \\
  -H "Authorization: Bearer YOUR_API_KEY"`
        },
        {
            method: "POST",
            path: "/v1/appointments",
            desc: "Crea una nueva cita médica vinculada a un paciente y doctor específico.",
            code: `{
  "patient_id": "p_12345",
  "doctor_id": "d_67890",
  "start_time": "2026-02-15T09:00:00Z",
  "reason": "Limpieza profunda"
}`
        }
    ];

    return (
        <div className="pt-32 pb-20 bg-[#f8fafc] min-h-screen">
            <div className="container mx-auto px-6">
                <div className="max-w-5xl mx-auto">
                    {/* Header Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 mb-6 font-display">Soporte y Documentación</h1>
                        <p className="text-xl text-slate-600 font-light max-w-2xl mx-auto">
                            Todo lo que necesitas para dominar OdontoCloud y llevar tu gestión clínica al máximo nivel de eficiencia.
                        </p>

                        {/* Search Bar (Visual) */}
                        <div className="mt-10 relative max-w-xl mx-auto">
                            <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
                            <input
                                type="text"
                                placeholder="Busca guías, funcionalidades o endpoints..."
                                style={{ backgroundColor: '#ffffff', color: '#1e293b' }}
                                className="w-full bg-white border border-slate-200 shadow-lg shadow-slate-200/20 py-5 pl-14 pr-6 rounded-2xl text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            />
                        </div>
                    </motion.div>

                    {/* Tabs Navigation - NO DARK COLORS (FORCED) */}
                    <div className="flex justify-center gap-4 mb-12">
                        <button
                            onClick={() => setActiveTab('help')}
                            style={{ backgroundColor: activeTab === 'help' ? '#2563eb' : '#ffffff', color: activeTab === 'help' ? '#ffffff' : '#475569' }}
                            className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold transition-all ${activeTab === 'help' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            <FiHelpCircle /> Centro de Ayuda
                        </button>
                        <button
                            onClick={() => setActiveTab('api')}
                            style={{ backgroundColor: activeTab === 'api' ? '#2563eb' : '#ffffff', color: activeTab === 'api' ? '#ffffff' : '#475569' }}
                            className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold transition-all ${activeTab === 'api' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            <FiCode /> Referencia API
                        </button>
                    </div>

                    {/* Content Section */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'help' ? (
                            <motion.div
                                key="help"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="grid md:grid-cols-2 gap-6"
                            >
                                {helpArticles.map((art, i) => (
                                    <div key={i} style={{ backgroundColor: '#ffffff' }} className="group bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                                        <div className="text-3xl mb-4">{art.icon}</div>
                                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{art.category}</span>
                                        <h3 className="text-2xl font-bold text-slate-900 mt-2 mb-4 font-display">{art.title}</h3>
                                        <p className="text-slate-600 font-light mb-6">{art.desc}</p>
                                        <button
                                            onClick={() => navigate(`/soporte/articulo/${art.slug}`)}
                                            className="flex items-center gap-2 text-slate-900 font-bold group-hover:gap-4 transition-all cursor-pointer"
                                        >
                                            Leer artículo <FiChevronRight className="text-blue-500" />
                                        </button>
                                    </div>
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="api"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                {apiEndpoints.map((ep, i) => (
                                    <div key={i} style={{ backgroundColor: '#ffffff' }} className="bg-white rounded-[2rem] p-8 border border-slate-200 text-slate-900 shadow-sm">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <span className={`px-3 py-1 rounded-lg font-mono text-xs font-bold ${ep.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {ep.method}
                                                </span>
                                                <code className="text-slate-700 font-mono text-lg">{ep.path}</code>
                                            </div>
                                            <FiTerminal className="text-slate-400 text-2xl" />
                                        </div>
                                        <p className="text-slate-500 font-light mb-6 text-lg">{ep.desc}</p>
                                        <div className="relative group">
                                            <pre className="bg-slate-50 p-6 rounded-2xl font-mono text-sm text-slate-700 overflow-x-auto border border-slate-200">
                                                {ep.code}
                                            </pre>
                                            <button className="absolute top-4 right-4 p-2 bg-white hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 text-slate-500 opacity-0 group-hover:opacity-100">
                                                <FiCopy />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Bottom Support CTA - CLEAN WHITE */}
                    <div style={{ backgroundColor: '#ffffff' }} className="mt-20 bg-white border border-slate-200 rounded-[2.5rem] p-12 text-slate-900 relative overflow-hidden shadow-2xl">
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                            <div className="text-center md:text-left">
                                <h2 className="text-3xl font-display font-bold mb-4 text-slate-900">¿Necesitas soporte técnico humano?</h2>
                                <p className="text-slate-500 font-light max-w-md text-lg italic">
                                    "Nuestro compromiso no termina en el software. Estamos aquí para asegurar que tu clínica nunca se detenga."
                                </p>
                            </div>
                            <div className="flex flex-col gap-4 w-full md:w-auto">
                                <a
                                    href="https://wa.me/573001234567"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-blue-500 text-white px-10 py-5 rounded-full font-bold flex items-center justify-center gap-3 hover:bg-blue-600 hover:scale-105 transition-all shadow-xl shadow-blue-500/20"
                                >
                                    <FiMessageCircle size={22} />
                                    Hablar con Soporte 24/7
                                </a>
                                <div className="flex justify-center md:justify-start items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                    <span>Lunes - Domingo</span>
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                    <span>Respuesta &lt; 5 min</span>
                                </div>
                            </div>
                        </div>
                        {/* Decorative background shapes (Subtle for white theme) */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-50/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                    </div>
                </div>
            </div>
        </div>
    );
}
