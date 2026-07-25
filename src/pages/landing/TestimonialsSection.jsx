import React from 'react';
import { motion } from 'framer-motion';
import { FiStar, FiUser, FiActivity, FiMessageCircle } from 'react-icons/fi';

const defaultTestimonials = [
    {
        name: "Dr. Roberto Mendoza",
        role: "Director Clínico",
        text: "Implementar OdontoCloud fue la mejor decisión administrativa que hemos tomado. Pasamos de usar papel a tener el control total de nuestra sucursal de forma digital.",
        image: "https://randomuser.me/api/portraits/men/32.jpg",
        stars: 5
    },
    {
        name: "Dra. Lucia Arias",
        role: "Ortodoncista",
        text: "El odontograma 3D no tiene comparación. Mis pacientes entienden mucho mejor sus presupuestos y la tasa de aceptación de tratamientos subió notablemente.",
        image: "https://randomuser.me/api/portraits/women/44.jpg",
        stars: 5
    },
    {
        name: "Carlos Rodriguez",
        role: "Gerente de Operaciones",
        text: "La facturación electrónica integrada nos ahorró horas de trabajo manual. El soporte es increíble y siempre están actualizando la plataforma.",
        image: "https://randomuser.me/api/portraits/men/67.jpg",
        stars: 5
    }
];

export default function TestimonialsSection({ config, dark = false }) {
    const isMaster = config?.isMaster;
    const testimonials = config?.testimonials?.length > 0 ? config.testimonials : defaultTestimonials;

    return (
        <section className={`py-32 relative overflow-hidden ${dark ? 'bg-[var(--viva-blue)]' : 'bg-slate-50'}`}>
            {/* Background Decorations */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className={`absolute width-[100vw] height-[100vh] top-0 left-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]`}></div>
                <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sky-500/5 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[100px] rounded-full" />
            </div>

            <div className="container relative z-10 mx-auto px-6 max-w-7xl">
                <div className="text-center mb-20 max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-block"
                    >
                        <span className="px-4 py-1.5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold uppercase tracking-widest mb-6 inline-block border border-sky-200">
                            {isMaster ? "Experiencias Reales" : "Testimonios"}
                        </span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className={`text-4xl md:text-6xl font-black mb-6 ${dark ? 'text-white' : 'text-slate-900'} tracking-tight leading-tight`}
                    >
                        {config?.testimonialsTitle || (isMaster ? "Lo que dicen los directores clínicos" : "Historias que nos inspiran")}
                    </motion.h2>
                    <p className={`text-xl ${dark ? 'text-slate-400' : 'text-slate-500'} font-light max-w-2xl mx-auto`}>
                        Únete a miles de profesionales que ya han transformado su gestión clínica con nuestra tecnología.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            whileHover={{ y: -10 }}
                            transition={{ delay: i * 0.1 }}
                            className={`p-10 rounded-[2.5rem] relative transition-all duration-500 group
                                ${dark
                                    ? 'glass-premium'
                                    : 'bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-[0_40px_60px_-15px_rgba(0,0,0,0.1)]'
                                }
                            `}
                        >
                            {/* Quote Icon */}
                            <div className="absolute top-8 right-8 text-6xl font-serif text-sky-500/10 pointer-events-none group-hover:text-sky-500/20 transition-colors">"</div>

                            <div className="flex gap-1 mb-6">
                                {[...Array(t.stars)].map((_, si) => (
                                    <FiStar key={si} className="text-amber-400 fill-amber-400 text-lg drop-shadow-sm" />
                                ))}
                            </div>

                            <p className={`mb-8 text-lg leading-relaxed relative z-10 font-medium ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                                "{t.text}"
                            </p>

                            <div className="flex items-center gap-4 mt-auto pt-6 border-t border-slate-100/10">
                                <div className="relative">
                                     <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-sky-500/20 shadow-md group-hover:border-sky-500 transition-colors flex items-center justify-center">
                                         {t.image ? (
                                             <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                                         ) : (
                                             <div className="w-full h-full bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-lg">{t.name?.charAt(0) || "P"}</div>
                                         )}
                                     </div>
                                    <div className="absolute -bottom-1 -right-1 bg-sky-500 text-white p-1 rounded-full border-2 border-white">
                                        <FiActivity size={10} />
                                    </div>
                                </div>
                                <div>
                                    <h4 className={`font-bold text-lg ${dark ? 'text-white' : 'text-slate-900'}`}>{t.name}</h4>
                                    <span className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-sky-400' : 'text-sky-600'}`}>{t.role}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {/* CTA Card (Replaces generic CTA) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        whileHover={{ scale: 1.02 }}
                        className="relative p-10 rounded-[2.5rem] flex flex-col justify-center text-center shadow-2xl overflow-hidden group min-h-[300px]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-600 to-indigo-700 z-0"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>

                        <div className="relative z-10 text-white flex flex-col h-full justify-center items-center">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                                <FiMessageCircle size={32} className="text-white" />
                            </div>

                            <h3 className="text-3xl font-black mb-3">¿Dudas?</h3>
                            <p className="mb-8 text-sky-100 text-lg leading-relaxed">Habla con nuestros expertos para un plan a tu medida.</p>

                            <button className="w-full bg-white text-indigo-900 font-black py-4 px-8 rounded-xl shadow-xl hover:shadow-2xl transition-all active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-2 group-hover:gap-3">
                                Solicitar Asesoría <span>→</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
