import React from "react";
import { motion } from "framer-motion";
import { FiArrowRight, FiPhone, FiMapPin, FiClock } from "react-icons/fi";
import { ClinicPageHero, useClinicConfig } from "./ClinicPageShared";

export default function ClinicSedesPage() {
    const { config } = useClinicConfig();

    const clinicPrimary = config?.primaryColor || "#1e3a8a";
    const clinicAccent = clinicPrimary; // single-color design
    const clinicPhone = (config?.contactPhone || "3015768935").replace(/\D/g, "");
    const clinicName = config?.name || "Nuestra Clínica";

    const handleCita = (sedeName) => {
        const msg = encodeURIComponent(`Hola, quisiera solicitar una cita en ${sedeName || clinicName}.`);
        window.open(`https://wa.me/57${clinicPhone}?text=${msg}`, '_blank');
    };

    const locations = config?.locations?.length > 0
        ? config.locations
        : [{
            name: config?.locationName || "Sede Principal",
            address: config?.address || "Consulta nuestra dirección",
            phone: config?.contactPhone || "",
            schedule: config?.schedule || "Lun - Vie: 7:00 AM - 7:00 PM · Sáb: 8:00 AM - 1:00 PM",
            image: config?.locationImage || "",
            mapUrl: config?.mapUrl || "",
        }];

    return (
        <div className="min-h-screen bg-white">
            <ClinicPageHero
                config={config}
                badge="Nuestras Sedes"
                title="Estamos cerca de ti"
                subtitle={`Encuentra la sede de ${clinicName} más conveniente para ti y tu familia.`}
            />

            {/* Locations */}
            <section className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {locations.map((sede, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden"
                            >
                                {/* Image */}
                                <div className="h-52 relative overflow-hidden">
                                    {sede.image ? (
                                        <img
                                            src={sede.image}
                                            alt={sede.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div
                                            className="w-full h-full flex items-center justify-center text-7xl"
                                            style={{ background: `${clinicPrimary}12` }}
                                        >
                                            🏥
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent flex items-end p-6">
                                        <div>
                                            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">
                                                {i === 0 ? "Sede Principal" : `Sede ${i + 1}`}
                                            </p>
                                            <h3 className="text-white text-xl font-black">{sede.name}</h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="p-7 space-y-5">
                                    {sede.address && (
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: `${clinicPrimary}12` }}
                                            >
                                                <FiMapPin size={18} style={{ color: clinicPrimary }} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección</p>
                                                <p className="text-sm text-slate-700 font-semibold leading-snug">{sede.address}</p>
                                            </div>
                                        </div>
                                    )}

                                    {sede.schedule && (
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: `${clinicPrimary}15` }}
                                            >
                                                <FiClock size={18} style={{ color: clinicPrimary }} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Horario</p>
                                                <p className="text-sm text-slate-700 font-semibold leading-snug">{sede.schedule}</p>
                                            </div>
                                        </div>
                                    )}

                                    {sede.phone && (
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: '#22c55e15' }}
                                            >
                                                <FiPhone size={18} className="text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</p>
                                                <a
                                                    href={`tel:${sede.phone}`}
                                                    className="text-sm font-black hover:opacity-80 transition-opacity"
                                                    style={{ color: clinicPrimary }}
                                                >
                                                    {sede.phone}
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => handleCita(sede.name)}
                                            className="flex-1 py-3.5 rounded-2xl text-white font-black text-sm transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
                                            style={{ background: clinicPrimary }}
                                        >
                                            📅 Agendar aquí
                                        </button>
                                        {sede.mapUrl && (
                                            <a
                                                href={sede.mapUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-4 py-3.5 rounded-2xl border-2 font-black text-sm transition-all hover:bg-slate-50 flex items-center justify-center"
                                                style={{ borderColor: `${clinicPrimary}30`, color: clinicPrimary }}
                                            >
                                                🗺️
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {/* Coming Soon card */}
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: locations.length * 0.1 }}
                            className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-10 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]"
                        >
                            <div className="text-5xl opacity-30">🏗️</div>
                            <div>
                                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-amber-100 text-amber-700 mb-3">Próximamente</span>
                                <h3 className="text-xl font-black text-slate-400 mb-2">Nueva Sede</h3>
                                <p className="text-sm text-slate-400">Estamos creciendo para estar más cerca de ti.</p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Contact CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-16 rounded-3xl p-10 md:p-14 text-center relative overflow-hidden"
                        style={{ background: clinicPrimary }}
                    >
                        <div className="absolute inset-0 opacity-[0.06] text-[200px] flex items-center justify-center select-none pointer-events-none leading-none">📍</div>
                        <div className="relative z-10">
                            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">¿Tienes alguna pregunta?</h2>
                            <p className="text-white/70 mb-8 max-w-xl mx-auto">Contáctanos y te ayudamos a encontrar la sede más conveniente para ti.</p>
                            <button
                                onClick={() => handleCita()}
                                className="inline-flex items-center gap-3 px-10 py-4 bg-white rounded-2xl font-black text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all"
                                style={{ color: clinicPrimary }}
                            >
                                💬 Contactar por WhatsApp
                                <FiArrowRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
