import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { 
  FiArrowRight, FiPlay, FiCloud, FiLock, FiHeadphones, FiCheckCircle, 
  FiCalendar, FiUser, FiFileText, FiGrid, FiDollarSign, FiBox, FiMessageSquare,
  FiSearch, FiBell, FiChevronDown, FiTrendingUp, FiCheck, FiPieChart, FiUsers
} from "react-icons/fi";
import DocumentationModal from "../../components/landing/DocumentationModal";
import { useNavigate } from 'react-router-dom';

export default function HeroSection({ config = {}, onShowTrial }) {
    const containerRef = useRef(null);
    const navigate = useNavigate();
    const [showDocModal, setShowDocModal] = useState(false);

    const isMaster = config.isMaster !== false;

    return (
        <section
            id="inicio"
            ref={containerRef}
            className="relative w-full bg-white text-slate-900 overflow-hidden font-sans pb-20 border-b border-slate-100"
            style={{ paddingTop: '130px' }}
        >
            {/* Background Oval/Ellipse Blob on Right Side */}
            <div
                className="absolute pointer-events-none -z-0"
                style={{
                    top: "-10%",
                    right: "-8%",
                    width: "62%",
                    height: "120%",
                    background: "radial-gradient(ellipse at center, rgba(219,234,254,0.75) 0%, rgba(186,219,255,0.45) 45%, rgba(240,249,255,0.15) 75%, transparent 100%)",
                    borderRadius: "50%",
                }}
            ></div>

            <div className="container relative z-10 mx-auto px-4 md:px-8 max-w-[1400px]">

                {/* 1. HERO TOP - 2 COLUMNS RESPONSIVE LAYOUT */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center mb-20">
                    
                    {/* LEFT COLUMN: HEADLINE, SUBTITLE, CTAS & BADGES */}
                    <div className="lg:col-span-5 text-left space-y-6">
                        
                        {/* Top Pill Badge */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100/80 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                            <span className="text-xs font-bold text-blue-700 tracking-wide">
                                {config.heroBadgeText || (isMaster ? "Software Odontológico Todo en Uno" : "Clínica Odontológica Certificada")}
                            </span>
                        </div>

                        {/* Main Title */}
                        <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-display font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                            {config.heroTitle || "Gestiona tu clínica dental de forma simple y profesional"}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-lg">
                            {config.heroSubtitle || "OdontoCloud es el software en la nube que te ayuda a ahorrar tiempo, organizar tu clínica y brindar la mejor experiencia a tus pacientes."}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-4 pt-2">
                            <button
                                onClick={() => {
                                    const phone = config.contactPhone || "3015768935";
                                    const msg = encodeURIComponent("Hola, estoy interesado en conocer más sobre OdontoCloud y quisiera solicitar una demostración del software.");
                                    window.open(`https://wa.me/57${phone}?text=${msg}`, '_blank');
                                }}
                                className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/25 transition-all duration-200 transform hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                <span>{config.heroBtn1Text || "Solicitar Demostración"}</span>
                                <FiArrowRight size={18} />
                            </button>

                            <button
                                onClick={() => setShowDocModal(true)}
                                className="px-6 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 flex items-center gap-2"
                            >
                                <FiPlay size={14} className="text-blue-600 fill-blue-600" />
                                <span>{config.heroBtn2Text || "Ver Video"}</span>
                            </button>
                        </div>

                        {/* 3 Trust Badges */}
                        <div className="pt-6 flex flex-wrap items-center gap-6 text-slate-500 text-xs font-medium border-t border-slate-100">
                            <div className="flex items-center gap-2">
                                <FiCloud className="text-blue-500" size={16} />
                                <span>100% en la nube</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FiLock className="text-blue-500" size={16} />
                                <span>Seguro y confiable</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FiHeadphones className="text-blue-500" size={16} />
                                <span>Soporte 24/7</span>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: LARGE CRISP RESPONSIVE DASHBOARD MOCKUP CARD */}
                    <div className="lg:col-span-7 relative w-full">
                        
                        {/* Dashboard Mockup Frame */}
                        <div
                            className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-blue-500/10 overflow-hidden text-slate-800 text-left w-full transition-all duration-300"
                            style={{
                                transform: "perspective(1200px) rotateY(-14deg) rotateX(2deg)",
                                transformStyle: "preserve-3d",
                            }}
                        >
                            
                            {/* App Header Bar */}
                            <div className="px-4 md:px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">☁</div>
                                        <span className="font-extrabold text-sm tracking-tight text-slate-900">Odonto<span className="text-blue-600">Cloud</span></span>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-xs text-slate-400 w-56">
                                        <FiSearch size={14} />
                                        <span>Buscar pacientes, citas...</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative text-slate-400">
                                        <FiBell size={16} />
                                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
                                    </div>
                                    <div className="flex items-center gap-2 border-l pl-3 border-slate-100">
                                        <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600">JP</div>
                                        <div className="hidden sm:block text-[11px] leading-tight">
                                            <div className="font-bold text-slate-800">Dr. Juan Pérez</div>
                                            <div className="text-slate-400 text-[9px]">Administrador</div>
                                        </div>
                                        <FiChevronDown size={12} className="text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Main App Body */}
                            <div className="grid grid-cols-12 bg-slate-50/50">
                                
                                {/* Left Sidebar */}
                                <div className="col-span-3 bg-white border-r border-slate-100 p-2.5 hidden md:block space-y-1 text-[11px] font-semibold text-slate-500">
                                    <div className="px-3 py-1.5 bg-blue-50 text-blue-600 font-bold rounded-lg flex items-center gap-2">
                                        <FiGrid size={13} /> Dashboard
                                    </div>
                                    <div className="px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                        <FiCalendar size={13} /> Agenda
                                    </div>
                                    <div className="px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                        <FiUser size={13} /> Pacientes
                                    </div>
                                    <div className="px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                        <FiFileText size={13} /> Historia Clínica
                                    </div>
                                    <div className="px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                        <span className="text-xs">🦷</span> Odontograma
                                    </div>
                                    <div className="px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                        <FiDollarSign size={13} /> Caja
                                    </div>
                                    <div className="px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                        <FiBox size={13} /> Inventario
                                    </div>
                                    <div className="px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                        <FiFileText size={13} /> Facturación
                                    </div>
                                </div>

                                {/* Right Dashboard Content Area */}
                                <div className="col-span-12 md:col-span-9 p-4 space-y-3">
                                    
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-extrabold text-slate-800">Dashboard General</h3>
                                        <span className="text-[9px] text-slate-400 font-medium">Martes, 21 de Mayo 2026</span>
                                    </div>

                                    {/* 4 Stat Cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="text-xl font-extrabold text-slate-800">24</div>
                                            <div className="text-[9px] text-slate-400 font-medium mt-0.5">Citas hoy</div>
                                            <div className="mt-1.5 w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                                                <FiCalendar size={12} />
                                            </div>
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="text-xl font-extrabold text-slate-800">128</div>
                                            <div className="text-[9px] text-slate-400 font-medium mt-0.5">Pacientes activos</div>
                                            <div className="mt-1.5 w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                                                <FiUsers size={12} />
                                            </div>
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="text-sm font-extrabold text-emerald-600">$12.450k</div>
                                            <div className="text-[9px] text-slate-400 font-medium mt-0.5">Ingresos mes</div>
                                            <div className="mt-1.5 w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">$</div>
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="text-xl font-extrabold text-slate-800">36</div>
                                            <div className="text-[9px] text-slate-400 font-medium mt-0.5">Pendientes</div>
                                            <div className="mt-1.5 w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs">⏱</div>
                                        </div>
                                    </div>

                                    {/* Middle Dashboard Section: Agenda & Revenue & Distribution */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        
                                        {/* Agenda del Día List */}
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm space-y-1.5">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 mb-1">
                                                <span>Agenda del día</span>
                                                <span className="text-[8px] text-slate-400">Hoy</span>
                                            </div>
                                            <div className="space-y-1.5 text-[9px]">
                                                <div className="p-1.5 bg-slate-50 rounded-lg">
                                                    <div className="font-bold text-slate-800 text-[10px]">María González</div>
                                                    <div className="text-[8px] text-slate-400">Limpieza Dental</div>
                                                    <span className="mt-1 inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-bold">Confirmado</span>
                                                </div>
                                                <div className="p-1.5 bg-slate-50 rounded-lg">
                                                    <div className="font-bold text-slate-800 text-[10px]">Carlos Ramírez</div>
                                                    <div className="text-[8px] text-slate-400">Control Ortodoncia</div>
                                                    <span className="mt-1 inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] font-bold">En Proceso</span>
                                                </div>
                                                <div className="p-1.5 bg-slate-50 rounded-lg">
                                                    <div className="font-bold text-slate-800 text-[10px]">Juan David López</div>
                                                    <div className="text-[8px] text-slate-400">Resina Compuesta</div>
                                                    <span className="mt-1 inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[8px] font-bold">Pendiente</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Resumen de Ingresos Curve Chart */}
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm space-y-1">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                                                <span>Resumen de ingresos</span>
                                                <span className="text-[8px] text-emerald-600 font-bold">+18.5%</span>
                                            </div>
                                            <div className="text-[11px] font-extrabold text-slate-800">$ 12.450.000</div>
                                            <div className="h-16 w-full flex items-end">
                                                <svg className="w-full h-full overflow-visible" viewBox="0 0 200 60">
                                                    <defs>
                                                        <linearGradient id="gradRevenue2" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                                                        </linearGradient>
                                                    </defs>
                                                    <path d="M0,50 Q40,40 70,45 T130,20 T200,10 L200,60 L0,60 Z" fill="url(#gradRevenue2)" />
                                                    <path d="M0,50 Q40,40 70,45 T130,20 T200,10" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Distribución de Tratamientos Donut Chart */}
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm space-y-1.5 hidden sm:block">
                                            <div className="text-[10px] font-bold text-slate-700">Distribución tratamientos</div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <div className="w-12 h-12 relative flex items-center justify-center">
                                                    <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                                                        <path className="text-slate-100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                        <path className="text-blue-600" strokeDasharray="30, 100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                        <path className="text-emerald-500" strokeDasharray="25, 100" strokeDashoffset="-30" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                    </svg>
                                                </div>
                                                <div className="text-[8px] space-y-0.5 text-slate-500 font-medium">
                                                    <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Ortodoncia 30%</div>
                                                    <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Resinas 25%</div>
                                                    <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> Limpieza 20%</div>
                                                </div>
                                            </div>
                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>
                    </div>

                </div>

                {/* 2. "TODO LO QUE TU CLÍNICA NECESITA" - 6 FEATURE CARDS GRID */}
                <div id="funcionalidades" className="pt-8 pb-14 scroll-mt-24">
                    
                    <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 text-center mb-10">
                        Todo lo que tu clínica necesita
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 text-left">
                        
                        {/* Card 1: Agenda Inteligente */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg mb-3">
                                <FiCalendar />
                            </div>
                            <h3 className="text-xs font-extrabold text-slate-900 mb-1">Agenda Inteligente</h3>
                            <p className="text-[11px] text-slate-500 leading-relaxed">Citas, recordatorios y disponibilidad en tiempo real.</p>
                        </div>

                        {/* Card 2: Historia Clínica */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg mb-3">
                                <FiUser />
                            </div>
                            <h3 className="text-xs font-extrabold text-slate-900 mb-1">Historia Clínica</h3>
                            <p className="text-[11px] text-slate-500 leading-relaxed">Fichas completas y seguras siempre disponibles.</p>
                        </div>

                        {/* Card 3: Odontograma 3D */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg mb-3">
                                <span>🦷</span>
                            </div>
                            <h3 className="text-xs font-extrabold text-slate-900 mb-1">Odontograma 3D</h3>
                            <p className="text-[11px] text-slate-500 leading-relaxed">Visualiza y registra tratamientos de forma interactiva.</p>
                        </div>

                        {/* Card 4: Facturación y Caja */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg mb-3">
                                <FiDollarSign />
                            </div>
                            <h3 className="text-xs font-extrabold text-slate-900 mb-1">Facturación y Caja</h3>
                            <p className="text-[11px] text-slate-500 leading-relaxed">Factura electrónicamente y controla tus ingresos fácilmente.</p>
                        </div>

                        {/* Card 5: Inventario */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-lg mb-3">
                                <FiBox />
                            </div>
                            <h3 className="text-xs font-extrabold text-slate-900 mb-1">Inventario</h3>
                            <p className="text-[11px] text-slate-500 leading-relaxed">Controla productos, stock y proveedores.</p>
                        </div>

                        {/* Card 6: Recordatorios */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg mb-3">
                                <FiMessageSquare />
                            </div>
                            <h3 className="text-xs font-extrabold text-slate-900 mb-1">Recordatorios</h3>
                            <p className="text-[11px] text-slate-500 leading-relaxed">Envía recordatorios automáticos por WhatsApp y SMS.</p>
                        </div>

                    </div>
                </div>

                {/* 3. BOTTOM SOCIAL PROOF BANNER */}
                <div className="p-6 md:p-8 rounded-2xl bg-blue-50/50 border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4 text-left">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg shrink-0 shadow-md shadow-blue-500/20">
                            <FiCheckCircle />
                        </div>
                        <div>
                            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 mb-0.5">Más de 200 clínicas ya confían en OdontoCloud</h4>
                            <p className="text-xs text-slate-500">Únete a la transformación digital de la odontología.</p>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/servicios')}
                        className="px-5 py-2.5 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-600 font-bold text-xs rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-2"
                    >
                        <span>Conoce nuestras funcionalidades</span>
                        <FiArrowRight size={14} />
                    </button>
                </div>

            </div>

            <DocumentationModal
                isOpen={showDocModal}
                onClose={() => setShowDocModal(false)}
            />
        </section>
    );
}


