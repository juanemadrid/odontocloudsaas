import React from "react";
import { motion } from "framer-motion";
import { FiArrowRight, FiTarget, FiEye, FiHeart, FiCpu, FiShield, FiAward } from "react-icons/fi";
import { ClinicPageHero, useClinicConfig } from "./ClinicPageShared";

export default function ClinicNosotrosPage() {
    const { config } = useClinicConfig();

    const clinicPrimary = config?.primaryColor || "#1e3a8a";
    const clinicPhone = (config?.contactPhone || "3015768935").replace(/\D/g, "");
    const clinicName = config?.name || "Nuestra Clínica";

    const handleCita = () => {
        const msg = encodeURIComponent(`Hola, quisiera solicitar una cita en ${clinicName}.`);
        window.open(`https://wa.me/57${clinicPhone}?text=${msg}`, '_blank');
    };

    // Authentic dental office picture
    const dentalOfficePhoto = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=1200";

    const teamMembers = config?.team || [];

    const values = [
        {
            icon: FiHeart,
            title: "Calidez Humana",
            desc: "Brindamos un trato cercano, empático y respetuoso para que te sientas cómodo en cada visita."
        },
        {
            icon: FiCpu,
            title: "Tecnología Avanzada",
            desc: "Equipamiento de última generación para diagnósticos precisos e intervenciones eficientes."
        },
        {
            icon: FiShield,
            title: "Bioseguridad Estricta",
            desc: "Protocolos rigurosos de esterilización e higiene para tu máxima protección y tranquilidad."
        },
        {
            icon: FiAward,
            title: "Excelencia Clínica",
            desc: "Especialistas en constante formación para ofrecerte siempre los mejores tratamientos."
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <ClinicPageHero
                config={config}
                badge="Sobre Nosotros"
                title={`Conoce a ${clinicName}`}
                subtitle={config?.identitySubtitle || "Un equipo de especialistas dedicados a cuidar tu salud oral con la máxima precisión, tecnología y calidez."}
            />

            {/* Content Container */}
            <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">

                {/* 1. Historia / Misión & Visión */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    {/* Dental Photo */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative"
                    >
                        <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white aspect-[4/3]">
                            <img
                                src={dentalOfficePhoto}
                                alt={`Consultorio Odontológico ${clinicName}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </motion.div>

                    {/* Text & Cards */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="space-y-8"
                    >
                        <div>
                            <span
                                className="text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full inline-block mb-4"
                                style={{ background: `${clinicPrimary}12`, color: clinicPrimary }}
                            >
                                Nuestra Historia
                            </span>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight mb-4">
                                {config?.identityTitle || "Sobre Nuestra Clínica"}
                            </h2>
                            <p className="text-slate-600 text-base leading-relaxed">
                                {config?.identityDesc || `En ${clinicName} entendemos que cada paciente es único. Nuestro objetivo es brindar un acompañamiento integral en la prevención, restauración y estética de tu salud oral con trato humano.`}
                            </p>
                        </div>

                        {/* Misión & Visión */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: clinicPrimary }}>
                                    <FiTarget size={22} />
                                </div>
                                <h4 className="font-black text-slate-900 text-lg">Misión</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    {config?.mission || "Brindar atención odontológica integral con calidez y profesionalismo, utilizando tecnología de vanguardia para garantizar la salud de nuestros pacientes."}
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: clinicPrimary }}>
                                    <FiEye size={22} />
                                </div>
                                <h4 className="font-black text-slate-900 text-lg">Visión</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    {config?.vision || "Ser reconocidos como la clínica líder en cuidado oral de la región, destacándonos por la excelencia en el servicio y el compromiso con la comunidad."}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* 2. Valores Rediseñados */}
                <section>
                    <div className="text-center max-w-2xl mx-auto mb-14">
                        <span
                            className="inline-block text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full mb-3"
                            style={{ background: `${clinicPrimary}12`, color: clinicPrimary }}
                        >
                            Nuestros Valores
                        </span>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900">Lo que nos define</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {values.map((v, i) => {
                            const IconComponent = v.icon;
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.08 }}
                                    className="p-7 rounded-3xl border border-slate-200/80 bg-white shadow-sm flex items-start gap-5 hover:border-slate-300 transition-all"
                                >
                                    <div
                                        className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-white shadow-md"
                                        style={{ background: clinicPrimary }}
                                    >
                                        <IconComponent size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-black text-slate-900 text-lg">{v.title}</h3>
                                        <p className="text-sm text-slate-600 leading-relaxed">{v.desc}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>

                {/* 3. Equipo Especializado si existe */}
                {teamMembers.length > 0 && (
                    <section>
                        <div className="text-center max-w-xl mx-auto mb-14">
                            <span
                                className="inline-block text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full mb-3"
                                style={{ background: `${clinicPrimary}12`, color: clinicPrimary }}
                            >
                                Nuestro Equipo
                            </span>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900">Los profesionales que te cuidan</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {teamMembers.map((member, i) => (
                                <div key={i} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                                    <div className="h-56 bg-slate-100 relative">
                                        {member.image ? (
                                            <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                                                {clinicName}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6">
                                        <h3 className="font-black text-slate-900 text-lg mb-1">{member.name}</h3>
                                        <p className="text-sm font-bold mb-2" style={{ color: clinicPrimary }}>{member.role || member.specialty || "Especialista"}</p>
                                        {member.bio && <p className="text-xs text-slate-500 leading-relaxed">{member.bio}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 4. Estadísticas con marca de agua odontológica (diente reconocible) */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="rounded-3xl p-10 md:p-14 text-white shadow-2xl relative overflow-hidden"
                    style={{ background: clinicPrimary }}
                >
                    {/* Marca de agua de diente dental clara y sutil */}
                    <div className="absolute inset-0 opacity-[0.08] pointer-events-none select-none flex items-center justify-around overflow-hidden text-[160px] leading-none">
                        <span>🦷</span>
                        <span className="hidden md:inline">🦷</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center relative z-10">
                        {[
                            { val: config?.stat1Value || "500+", label: config?.stat1Label || "Pacientes felices" },
                            { val: config?.stat2Value || "10+", label: config?.stat2Label || "Años de experiencia" },
                            { val: config?.stat3Value || "98%", label: config?.stat3Label || "Satisfacción" },
                            { val: config?.stat4Value || "8+", label: config?.stat4Label || "Especialidades" },
                        ].map((s, i) => (
                            <div key={i} className="space-y-1">
                                <p className="text-4xl md:text-5xl font-black">{s.val}</p>
                                <p className="text-white/80 text-sm font-semibold">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* 5. CTA Final con textura odontológica sutil */}
                <section className="rounded-3xl overflow-hidden relative text-center py-16 px-8 bg-slate-900 text-white shadow-xl">
                    <div className="absolute inset-0 opacity-[0.06] pointer-events-none select-none flex items-center justify-center text-[200px] leading-none">
                        🦷
                    </div>
                    <div className="relative z-10">
                        <p className="text-xs font-black uppercase tracking-widest mb-3 text-white/60">¿Listo?</p>
                        <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Agenda tu cita hoy</h2>
                        <p className="text-white/50 mb-8 max-w-xl mx-auto">Descubre por qué somos la clínica de confianza de cientos de familias. Primera consulta de valoración sin costo.</p>
                        <button
                            onClick={handleCita}
                            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg hover:opacity-90 active:scale-95 transition-all"
                            style={{ background: clinicPrimary }}
                        >
                            Agendar Cita por WhatsApp
                            <FiArrowRight size={15} />
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
}
