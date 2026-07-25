import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown } from 'react-icons/fi';

const defaultSaaSFaqs = [
    {
        question: "¿Mis datos están seguros en OdontoCloud?",
        answer: "Absolutamente. Utilizamos encriptación de grado bancario (AES-256) y servidores de alta disponibilidad en Google Cloud. Realizamos copias de seguridad automáticas cada 24 horas para garantizar que tu información nunca se pierda."
    },
    {
        question: "¿Puedo migrar mis datos desde otro software?",
        answer: "Sí, nuestro equipo técnico te acompaña en la migración de tus pacientes, historias clínicas y catálogos. Soportamos importaciones desde Excel y otros formatos estándar sin costo adicional en planes anuales."
    },
    {
        question: "¿Funciona OdontoCloud sin conexión a internet?",
        answer: "OdontoCloud es 100% en la nube para permitirte el acceso desde cualquier lugar. Sin embargo, nuestra arquitectura está optimizada para funcionar incluso con conexiones lentas o móviles (4G/5G)."
    },
    {
        question: "¿Qué tipo de soporte técnico ofrecen?",
        answer: "Ofrecemos soporte preventivo y correctivo vía WhatsApp, ticket y correo electrónico. Los planes Profesionales y Empresariales cuentan con soporte prioritario y un Account Manager dedicado."
    },
    {
        question: "¿Hay contratos de permanencia?",
        answer: "No. En OdontoCloud creemos en la libertad. Puedes cancelar tu suscripción en cualquier momento sin penalizaciones. Tus datos siempre te pertenecen y podrás exportarlos si decides retirarte."
    }
];

const defaultClinicalFaqs = [
    {
        question: "¿Cómo puedo agendar mi primera cita?",
        answer: "Puedes agendar tu cita fácilmente a través de nuestro portal de pacientes, haciendo clic en el botón 'Agendar Cita', o contactándonos directamente por WhatsApp. Te confirmaremos la disponibilidad en minutos."
    },
    {
        question: "¿Qué convenios de medicina prepagada aceptan?",
        answer: "Trabajamos con las principales entidades de medicina prepagada y seguros dentales. Te recomendamos consultarnos vía WhatsApp con tu carnet para verificar la cobertura exacta de tu plan."
    },
    {
        question: "¿Cuentan con todas las especialidades dentales?",
        answer: "Sí, disponemos de un equipo multidisciplinario que cubre desde odontología general hasta ortodoncia, implantología, diseño de sonrisa y odontopediatría, garantizando una atención integral en un solo lugar."
    },
    {
        question: "¿Cuáles son los métodos de pago disponibles?",
        answer: "Aceptamos todas las tarjetas de crédito y débito, transferencias bancarias, y ofrecemos planes de financiamiento directo para tratamientos de ortodoncia e implantes."
    },
    {
        question: "¿Es seguro asistir a consulta presencial?",
        answer: "Cumplimos con los más estrictos protocolos de bioseguridad y esterilización avalados por la secretaría de salud, garantizando un entorno seguro y protegido para todos nuestros pacientes."
    }
];

export default function FAQSection({ config, dark = false, simpleView = false }) {
    const [activeIndex, setActiveIndex] = useState(null);
    const isMaster = config?.isMaster;

    const currentFaqs = (config?.faqs && config.faqs.length > 0)
        ? config.faqs
        : (isMaster ? defaultSaaSFaqs : defaultClinicalFaqs);

    const toggleFaq = (index) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    return (
        <section id="faq" className={`py-12 relative overflow-hidden ${dark ? 'bg-transparent' : 'bg-white'}`}>
            <div className={`container mx-auto px-6 max-w-4xl relative z-10 ${simpleView ? 'mt-0' : ''}`}>
                {!simpleView && (
                    <div className="text-center mb-16">
                        <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className={`inline-block px-4 py-1.5 font-black tracking-[0.2em] text-[10px] uppercase mb-6 rounded-full border shadow-sm bg-blue-50 text-blue-600 border-blue-100/50`}
                        >
                            Soporte & Documentación
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className={`text-4xl md:text-5xl font-display font-black mb-8 tracking-tighter ${dark ? 'text-white' : 'text-slate-900'}`}
                        >
                            Preguntas <span className={`underline decoration-4 underline-offset-8 ${dark ? 'text-sky-400 decoration-sky-900' : 'text-blue-600 decoration-blue-200'}`}>Frecuentes</span>
                        </motion.h2>
                        <p className={`text-xl font-medium max-w-2xl mx-auto leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-500'}`}>
                            {isMaster
                                ? "Todo lo que necesitas saber sobre la plataforma líder en gestión dental, explicado de forma clara."
                                : `Resolvemos tus dudas principales sobre nuestra atención y servicios en ${config?.name || 'la clínica'}.`
                            }
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {currentFaqs.map((faq, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className={`group border-2 rounded-[2rem] transition-all duration-500 overflow-hidden ${activeIndex === i
                                ? (dark ? 'border-sky-500/50 bg-white/10 shadow-[0_0_30px_rgba(14,165,233,0.15)] scale-[1.02]' : 'border-blue-500 bg-white shadow-2xl shadow-blue-500/10 scale-[1.02]')
                                : (dark ? 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20' : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/50')
                                }`}
                        >
                            <button
                                onClick={() => toggleFaq(i)}
                                className="w-full flex items-center justify-between p-8 text-left focus:outline-none"
                            >
                                <span className={`text-xl font-black tracking-tight transition-colors duration-300 ${activeIndex === i
                                    ? (dark ? 'text-sky-400' : 'text-blue-500')
                                    : (dark ? 'text-white group-hover:text-sky-200' : 'text-slate-800')
                                    }`}>
                                    {faq.question}
                                </span>
                                <motion.div
                                    animate={{
                                        rotate: activeIndex === i ? 180 : 0,
                                        backgroundColor: activeIndex === i ? (dark ? 'rgba(14,165,233,0.2)' : '#3b82f6') : (dark ? 'rgba(255,255,255,0.1)' : '#f1f5f9'),
                                        color: activeIndex === i ? (dark ? '#38bdf8' : '#ffffff') : (dark ? '#94a3b8' : '#64748b')
                                    }}
                                    transition={{ duration: 0.4, ease: "backOut" }}
                                    className="shrink-0 ml-6 w-10 h-10 rounded-xl flex items-center justify-center shadow-inner"
                                >
                                    <FiChevronDown size={22} />
                                </motion.div>
                            </button>

                            <AnimatePresence>
                                {activeIndex === i && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className={`p-8 pt-0 leading-relaxed font-medium text-lg ${dark ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Background Ornaments */}
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-50/50 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-48 -left-24 w-64 h-64 bg-amber-50/30 rounded-full blur-[80px] pointer-events-none" />
        </section>
    );
}
