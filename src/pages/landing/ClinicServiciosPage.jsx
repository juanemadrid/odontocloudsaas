import React from "react";
import { motion } from "framer-motion";
import { FiArrowRight } from "react-icons/fi";
import { ClinicPageHero, useClinicConfig } from "./ClinicPageShared";

export default function ClinicServiciosPage() {
    const { config } = useClinicConfig();

    const clinicPrimary = config?.primaryColor || "#1e3a8a";
    const clinicAccent = clinicPrimary; // single-color design
    const clinicPhone = (config?.contactPhone || "3015768935").replace(/\D/g, "");

    const handleCita = (svcName) => {
        const msg = encodeURIComponent(`Hola, quisiera solicitar una cita de ${svcName || 'valoración'} en ${config?.name || "la clínica"}.`);
        window.open(`https://wa.me/57${clinicPhone}?text=${msg}`, '_blank');
    };

    const services = config?.services?.length > 0 ? config.services : [
        { title: "Ortodoncia", desc: "Brackets estéticos y alineadores invisibles para una mordida perfecta y una sonrisa alineada.", icon: "🦷", detail: "Usamos tecnología de última generación para corregir problemas de alineación dental de manera cómoda y discreta." },
        { title: "Implantes Dentales", desc: "Prótesis fijas de alta calidad que devuelven tu sonrisa, funcionalidad masticatoria y confianza.", icon: "🔩", detail: "Nuestros implantes de titanio tienen una tasa de éxito superior al 97% y duran toda la vida." },
        { title: "Diseño de Sonrisa", desc: "Carillas de porcelana y blanqueamiento profesional para una sonrisa perfecta que proyecte confianza.", icon: "✨", detail: "Evaluamos tu estructura facial, color de piel y personalidad para diseñar la sonrisa ideal para ti." },
        { title: "Odontopediatría", desc: "Atención dental especializada, amigable y sin miedo para los más pequeños de la familia.", icon: "👶", detail: "Ambiente diseñado para niños, con técnicas de manejo de conducta que hacen la visita al dentista una experiencia positiva." },
        { title: "Limpieza Profunda", desc: "Profilaxis dental y eliminación de sarro para mantener encías y dientes en perfecto estado.", icon: "🛡️", detail: "Limpieza ultrasónica y pulido dental que elimina placa, sarro y manchas superficiales." },
        { title: "Urgencias Dentales", desc: "Atención inmediata para dolor agudo, fracturas o cualquier emergencia odontológica.", icon: "🚨", detail: "Disponibles para atender tu emergencia el mismo día. Llámanos o escríbenos por WhatsApp." },
        { title: "Endodoncia", desc: "Tratamiento de conductos para salvar dientes con infección o daño severo sin necesidad de extracción.", icon: "🔬", detail: "Con anestesia de última generación y técnicas rotatorias, el tratamiento es rápido e indoloro." },
        { title: "Cirugía Oral", desc: "Extracciones, cordales y cirugías menores realizadas por especialistas con mínima invasividad.", icon: "⚕️", detail: "Procedimientos quirúrgicos con sedación consciente para mayor comodidad del paciente." },
        { title: "Periodoncia", desc: "Tratamiento y prevención de enfermedades de las encías que afectan la salud oral general.", icon: "💚", detail: "Tratamos gingivitis, periodontitis y realizamos cirugías periodontales con excelentes resultados." },
    ];

    return (
        <div className="min-h-screen bg-white">
            <ClinicPageHero
                config={config}
                badge="Nuestros Servicios"
                title="Tratamientos para cada necesidad"
                subtitle={`En ${config?.name || "nuestra clínica"} contamos con especialistas en cada área de la odontología para brindarte la atención que mereces.`}
            />

            {/* Services Grid */}
            <section className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((svc, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.06 }}
                                className="group relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden p-8 flex flex-col"
                            >
                                {/* Color accent top bar */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ background: clinicPrimary }}
                                />

                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mb-6 transition-transform group-hover:scale-110"
                                    style={{ background: `${clinicPrimary}12` }}
                                >
                                    {svc.icon || "🦷"}
                                </div>

                                <h3 className="text-xl font-black text-slate-900 mb-3">{svc.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed flex-1">{svc.desc}</p>

                                {svc.detail && (
                                    <p className="text-xs text-slate-400 leading-relaxed mt-3 pt-3 border-t border-slate-100">
                                        {svc.detail}
                                    </p>
                                )}

                                <button
                                    onClick={() => handleCita(svc.title)}
                                    className="mt-6 flex items-center gap-2 text-sm font-bold transition-all group-hover:gap-3"
                                    style={{ color: clinicPrimary }}
                                >
                                    Agendar cita <FiArrowRight size={14} />
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    {/* Bottom CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-16 rounded-3xl overflow-hidden relative text-center py-14 px-8 bg-slate-900"
                    >
                        <div className="relative z-10">
                            <p className="text-xs font-black uppercase tracking-widest mb-3 text-white/60">Valoración gratuita</p>
                            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">¿No encuentras lo que buscas?</h2>
                            <p className="text-white/50 mb-8 max-w-xl mx-auto">Contáctanos y te orientamos sobre el tratamiento ideal para tu caso específico.</p>
                            <button
                                onClick={() => handleCita("valoración")}
                                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg hover:opacity-90 active:scale-95 transition-all"
                                style={{ background: clinicPrimary }}
                            >
                                Solicitar Valoración Gratuita
                                <FiArrowRight size={15} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
