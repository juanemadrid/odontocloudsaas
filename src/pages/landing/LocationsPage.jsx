import React from "react";
import { Helmet } from "react-helmet-async";

export default function LocationsPage() {
    return (
        <React.Fragment>
            <Helmet>
                <title>Sedes y Horarios | OdontoCloud</title>
                <meta name="description" content="Visítanos en nuestras sedes. Horarios extendidos para tu comodidad." />
            </Helmet>

            <div className="pt-32 pb-20 bg-slate-50 min-h-screen">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-amber-500 font-bold uppercase tracking-widest text-sm">¿DÓNDE ENCONTRARNOS?</span>
                        <h1 className="text-4xl md:text-5xl font-display font-bold text-[#022a63] mt-4 mb-6">
                            Sedes y Horarios
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            Estamos ubicados estratégicamente para estar siempre cerca de ti. Cita previa requerida en todas nuestras sedes.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Sede Principal */}
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100 hover:shadow-xl transition-shadow">
                            <div className="h-48 bg-slate-200 bg-[url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center relative">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                                    <h3 className="text-white text-2xl font-bold">Sede Principal - Norte</h3>
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">📍</div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">Dirección</h4>
                                            <p className="text-slate-600">Calle 100 # 15-20, Edificio OdontoTower. Consultorio 505.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">⏰</div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">Horarios de Atención</h4>
                                            <p className="text-slate-600">Lunes a Viernes: 7:00 AM - 7:00 PM</p>
                                            <p className="text-slate-600">Sábados: 8:00 AM - 1:00 PM</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">📞</div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">Contacto Directo</h4>
                                            <p className="text-slate-600">+57 601 234 5678</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8">
                                    <a
                                        href="https://maps.google.com"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block w-full text-center py-3 border-2 border-[#022a63] text-[#022a63] font-bold rounded-lg hover:bg-[#022a63] hover:text-white transition-colors uppercase text-sm tracking-wide"
                                    >
                                        Ver en Google Maps
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Sede Chapinero (Placeholder) */}
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100 hover:shadow-xl transition-shadow opacity-60 grayscale hover:grayscale-0 hover:opacity-100 cursor-pointer group">
                            <div className="h-48 bg-slate-200 bg-[url('https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center relative">
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <span className="bg-amber-400 text-[#022a63] font-bold px-4 py-1 rounded-full text-sm uppercase shadow-lg transform -rotate-3 group-hover:rotate-0 transition-transform">
                                        Próximamente
                                    </span>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                                    <h3 className="text-white text-2xl font-bold">Nueva Sede - Chapinero</h3>
                                </div>
                            </div>
                            <div className="p-8">
                                <p className="text-slate-600 text-center italic">
                                    Muy pronto estaremos más cerca de ti en nuestra nueva sede con tecnología 100% digital.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}
