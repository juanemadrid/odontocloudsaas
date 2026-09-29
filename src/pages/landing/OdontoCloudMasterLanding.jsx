import React, { useState } from "react";
import {
  FiArrowRight, FiPlay, FiCalendar, FiUsers,
  FiFileText, FiBell, FiCloud, FiCheck
} from "react-icons/fi";
import DocumentationModal from "../../components/landing/DocumentationModal";

export default function OdontoCloudMasterLanding({ config = {}, onShowTrial }) {
  const [showDocModal, setShowDocModal] = useState(false);

  const phone = (config.contactPhone || "3015768935").replace(/\D/g, "");
  const logoUrl = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/logo.png`;
  const dentistImg = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/dentist_tablet.jpg`;
  const doctorImg = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/doctor_carolina.jpg`;

  const handleDemo = () => {
    if (onShowTrial) {
      onShowTrial();
    } else {
      const msg = encodeURIComponent(
        "Hola, estoy interesado en una demostración gratuita de OdontoCloud Colombia para mi clínica dental."
      );
      window.open(`https://wa.me/57${phone}?text=${msg}`, "_blank");
    }
  };

  return (
    <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-500/20 selection:text-blue-700 overflow-x-hidden">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION (100% Fluid & Adaptative for Wide Screens)
          ───────────────────────────────────────────────────────────── */}
      <section id="inicio" className="relative w-full pt-28 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 overflow-hidden bg-gradient-to-b from-[#F3F7FF] via-[#F9FBFF] to-white">
        {/* Soft background ambient glows */}
        <div className="absolute top-0 right-1/4 w-[700px] 2xl:w-[900px] h-[600px] 2xl:h-[800px] bg-blue-500/10 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute top-40 left-10 w-[500px] 2xl:w-[700px] h-[500px] 2xl:h-[700px] bg-sky-400/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="w-full max-w-[1720px] 2xl:max-w-[1850px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-14 2xl:gap-20 items-center">
            
            {/* LEFT COLUMN: Headings, CTAs and Trust badges */}
            <div className="lg:col-span-6 xl:col-span-5 text-left space-y-6 sm:space-y-8">
              <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl 2xl:text-[68px] font-sans font-black text-slate-900 tracking-tight leading-[1.12]">
                Gestiona tu clínica dental de forma{" "}
                <span className="text-[#2563EB]">simple y profesional</span>
              </h1>

              <p className="text-base sm:text-lg xl:text-xl 2xl:text-2xl text-slate-600 leading-relaxed font-normal max-w-xl 2xl:max-w-2xl">
                Agenda, historia clínica, odontograma, facturación electrónica y más. Todo en un solo lugar, accesible desde cualquier dispositivo.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={handleDemo}
                  className="px-7 sm:px-8 py-4 sm:py-4.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full font-bold text-sm sm:text-base 2xl:text-lg shadow-lg shadow-blue-500/25 transition-all duration-200 transform hover:-translate-y-0.5 flex items-center gap-2.5 group cursor-pointer border-0"
                >
                  <span>Solicitar demostración gratuita</span>
                  <FiArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  onClick={() => setShowDocModal(true)}
                  className="px-6 sm:px-7 py-4 sm:py-4.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full font-bold text-sm sm:text-base 2xl:text-lg shadow-xs transition-all duration-200 flex items-center gap-2.5 cursor-pointer"
                >
                  <FiPlay size={14} className="text-[#2563EB] fill-[#2563EB]" />
                  <span>Ver video (2 min)</span>
                </button>
              </div>

              {/* 3 Trust Badges */}
              <div className="pt-4 sm:pt-6 flex flex-wrap items-center gap-6 sm:gap-8 text-slate-600 text-xs sm:text-sm font-semibold">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                  <span>100% en la nube</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                  <span>Seguro y confiable</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                  <span>Soporte en español</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: MacBook & Smartphone Mockup Composition */}
            <div className="lg:col-span-6 xl:col-span-7 relative w-full flex justify-center items-center py-4">
              
              {/* LAPTOP CONTAINER (Realistic MacBook / Air Style) */}
              <div className="relative w-full max-w-[720px] xl:max-w-[820px] 2xl:max-w-[940px] bg-[#E2E8F0] rounded-[24px] sm:rounded-[28px] p-2.5 sm:p-3 shadow-2xl shadow-slate-900/20 border border-slate-300">
                {/* Display Bezel */}
                <div className="bg-slate-950 rounded-[18px] sm:rounded-[22px] p-2 sm:p-3 pt-2 shadow-inner">
                  {/* WebCam dot */}
                  <div className="w-2 h-2 rounded-full bg-slate-800 mx-auto mb-2 border border-slate-700/60" />

                  {/* Inner Screen */}
                  <div className="w-full bg-[#FAFCFE] rounded-lg sm:rounded-xl overflow-hidden text-left text-slate-800 select-none border border-slate-200">
                    
                    {/* Screen Topbar */}
                    <div className="h-11 sm:h-12 bg-white border-b border-slate-150 px-4 sm:px-5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img src={logoUrl} alt="OdontoCloud" className="h-7 sm:h-8 w-auto object-contain" />
                        <span className="font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 flex items-center">
                          <span>Odonto</span>
                          <span className="text-[#2563EB]">Cloud</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="relative text-slate-400 hover:text-slate-600">
                          <FiBell size={15} />
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500" />
                        </div>
                        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                          <img
                            src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=150"
                            alt="Dra. Garcia"
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-slate-200"
                          />
                          <div className="text-[10px] sm:text-xs leading-tight">
                            <span className="font-bold text-slate-800 block">Dra. Garcia</span>
                            <span className="text-[8px] sm:text-[9px] text-slate-400">Clínica Dental</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Screen Body: Sidebar + Main Content */}
                    <div className="flex min-h-[380px] sm:min-h-[440px] xl:min-h-[480px]">
                      
                      {/* Sidebar */}
                      <div className="w-32 sm:w-38 xl:w-42 bg-white border-r border-slate-150 p-2 sm:p-3 space-y-1 shrink-0 hidden sm:block">
                        <div className="px-3 py-2 rounded-xl bg-[#2563EB] text-white font-bold text-xs flex items-center gap-2 shadow-xs">
                          <span>●</span>
                          <span>Inicio</span>
                        </div>
                        {[
                          { name: "Agenda" },
                          { name: "Pacientes" },
                          { name: "Historia Clínica" },
                          { name: "Odontograma" },
                          { name: "Facturación" },
                          { name: "Inventario" },
                          { name: "Reportes" }
                        ].map((item, idx) => (
                          <div key={idx} className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 cursor-default rounded-lg transition-colors">
                            {item.name}
                          </div>
                        ))}
                      </div>

                      {/* Main Dashboard Area */}
                      <div className="flex-1 p-3.5 sm:p-5 xl:p-6 space-y-3.5 sm:space-y-4 bg-[#F8FAFC]">
                        
                        {/* Header: Greeting & Date Selector */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm sm:text-base xl:text-lg font-black text-slate-900 leading-tight">¡Hola, Dra. Garcia!</h4>
                            <p className="text-[10px] sm:text-xs text-slate-400">Aquí tienes un resumen de tu clínica hoy.</p>
                          </div>
                          <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] sm:text-xs font-medium text-slate-600 shadow-2xs flex items-center gap-1.5">
                            <span>Hoy, 26 de enero de 2026</span>
                            <span>▾</span>
                          </div>
                        </div>

                        {/* 3 Metric Cards */}
                        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-150 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs">
                                <FiCalendar />
                              </div>
                              <span className="text-base sm:text-xl xl:text-2xl font-black text-slate-900">12</span>
                            </div>
                            <span className="text-[10px] sm:text-xs text-slate-500 block">Citas hoy</span>
                          </div>

                          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-150 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                                <FiUsers />
                              </div>
                              <span className="text-base sm:text-xl xl:text-2xl font-black text-slate-900">28</span>
                            </div>
                            <span className="text-[10px] sm:text-xs text-slate-500 block">Pacientes activos</span>
                          </div>

                          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-150 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black">
                                $
                              </div>
                              <span className="text-sm sm:text-lg xl:text-xl font-black text-emerald-600">$1.450.000</span>
                            </div>
                            <span className="text-[10px] sm:text-xs text-slate-500 block">Ingresos del mes</span>
                          </div>
                        </div>

                        {/* 2-Column Split: Agenda + Donut Chart */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 pt-1">
                          
                          {/* Agenda de hoy */}
                          <div className="sm:col-span-7 bg-white p-3 sm:p-4 rounded-2xl border border-slate-150 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <span className="text-xs sm:text-sm font-bold text-slate-900">Agenda de hoy</span>
                              <span className="text-[10px] sm:text-xs font-bold text-blue-600 hover:underline cursor-pointer">
                                Ver agenda →
                              </span>
                            </div>

                            <div className="space-y-2">
                              {[
                                { time: "08:00", name: "María López", svc: "Limpieza dental", badge: "En atención", bg: "bg-blue-50 text-blue-600 border border-blue-100" },
                                { time: "09:30", Carlos: "Carlos Ramírez", name: "Carlos Ramírez", svc: "Control ortodoncia", badge: "Confirmada", bg: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
                                { time: "11:00", name: "Ana Torres", svc: "Restauración resina", badge: "Confirmada", bg: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
                                { time: "14:00", name: "Luis Alejandro Gómez", svc: "Valoración inicial", badge: "Pendiente", bg: "bg-amber-50 text-amber-600 border border-amber-100" }
                              ].map((a, i) => (
                                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-bold text-slate-400 text-[11px]">{a.time}</span>
                                    <div>
                                      <span className="font-bold text-slate-800 block text-[11px] sm:text-xs leading-tight">{a.name}</span>
                                      <span className="text-[9px] sm:text-[10px] text-slate-400 block leading-tight">{a.svc}</span>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold ${a.bg}`}>
                                    {a.badge}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Distribución de Tratamientos (Donut Chart) */}
                          <div className="sm:col-span-5 bg-white p-3 sm:p-4 rounded-2xl border border-slate-150 shadow-2xs flex flex-col justify-between">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 block">
                              Distribución de tratamientos
                            </span>

                            <div className="flex items-center justify-center my-2">
                              <svg className="w-20 h-20 sm:w-24 sm:h-24 transform -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="5" />
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#2563EB" strokeWidth="5" strokeDasharray="40 60" strokeDashoffset="0" />
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#F97316" strokeWidth="5" strokeDasharray="30 70" strokeDashoffset="-40" />
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#06B6D4" strokeWidth="5" strokeDasharray="20 80" strokeDashoffset="-70" />
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#94A3B8" strokeWidth="5" strokeDasharray="10 90" strokeDashoffset="-90" />
                              </svg>
                            </div>

                            <div className="space-y-1.5 text-[10px] sm:text-xs">
                              <div className="flex items-center justify-between text-slate-600">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2563EB]" />Preventivos</span>
                                <span className="font-bold">40%</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F97316]" />Restauradores</span>
                                <span className="font-bold">30%</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#06B6D4]" />Ortodoncia</span>
                                <span className="font-bold">20%</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#94A3B8]" />Otros</span>
                                <span className="font-bold">10%</span>
                              </div>
                            </div>
                          </div>

                        </div>

                      </div>
                    </div>

                  </div>
                </div>

                {/* Laptop metallic bottom bezel & notch */}
                <div className="w-24 sm:w-28 h-1.5 bg-slate-400 rounded-full mx-auto mt-2" />
              </div>

              {/* SMARTPHONE OVERLAY (in front of laptop on bottom-left) */}
              <div className="absolute -bottom-8 -left-2 sm:left-4 xl:left-8 w-[160px] sm:w-[190px] xl:w-[210px] bg-slate-900 rounded-[32px] sm:rounded-[36px] p-2 sm:p-2.5 shadow-2xl shadow-blue-950/40 border-2 border-slate-700 hidden xs:block z-20">
                {/* Speaker notch */}
                <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-2" />
                
                {/* Phone screen */}
                <div className="bg-white rounded-[24px] sm:rounded-[28px] p-3 text-left text-slate-800 space-y-2.5 border border-slate-100 shadow-inner">
                  <div className="text-center pt-1">
                    <span className="text-xs font-black text-slate-900 block leading-tight">Hola, Dra. Garcia</span>
                    <span className="text-[8px] sm:text-[9px] text-slate-400">Tu clínica en un solo lugar</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {[
                      { icon: "📅", label: "Agenda" },
                      { icon: "👥", label: "Pacientes" },
                      { icon: "🦷", label: "Odontograma" },
                      { icon: "📄", label: "Facturación" }
                    ].map((btn, i) => (
                      <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-150 flex items-center gap-2 hover:bg-blue-50 transition-colors">
                        <span className="text-xs">{btn.icon}</span>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-800">{btn.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-around text-[9px] text-slate-400">
                    <span className="text-[#2563EB] font-bold">Inicio</span>
                    <span>Pacientes</span>
                    <span>Agenda</span>
                    <span>Más</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* ─────────────────────────────────────────────────────────────
              2. FOUR FEATURE CARDS (Directly below hero, fluid width)
              ───────────────────────────────────────────────────────────── */}
          <div id="funciones" className="pt-10 sm:pt-16 pb-12 scroll-mt-28">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8 text-left">
              
              {/* Card 1: Agenda inteligente */}
              <div className="bg-white p-7 xl:p-8 2xl:p-9 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                <div className="w-13 h-13 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center text-2xl mb-5">
                  <FiCalendar />
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-2">
                  Agenda inteligente
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  Organiza tus citas de forma fácil y rápida.
                </p>
              </div>

              {/* Card 2: Historia clínica y odontograma */}
              <div className="bg-white p-7 xl:p-8 2xl:p-9 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                <div className="w-13 h-13 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-5">
                  <span>🦷</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-2">
                  Historia clínica y odontograma
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  Registra, visualiza y da seguimiento completo a tus pacientes.
                </p>
              </div>

              {/* Card 3: Facturación electrónica */}
              <div className="bg-white p-7 xl:p-8 2xl:p-9 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-5">
                  <FiFileText />
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-2">
                  Facturación electrónica
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  Cumple con la DIAN sin complicaciones.
                </p>
              </div>

              {/* Card 4: Recordatorios automáticos */}
              <div className="bg-white p-7 xl:p-8 2xl:p-9 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                <div className="w-13 h-13 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center text-2xl mb-5">
                  <FiBell />
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-2">
                  Recordatorios automáticos
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  Envía confirmaciones de citas por WhatsApp y SMS.
                </p>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. "MÁS QUE UN SOFTWARE" SHOWCASE SECTION
          ───────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-white border-t border-slate-100">
        <div className="w-full max-w-[1720px] 2xl:max-w-[1850px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 xl:gap-20 items-center">
            
            {/* Left: Professional Dentist Image + Vector Odontograma Card */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-[32px] sm:rounded-[40px] overflow-hidden shadow-2xl border border-slate-150 aspect-[4/3] w-full max-w-[640px] xl:max-w-[720px] mx-auto">
                <img
                  src={dentistImg}
                  alt="Doctora OdontoCloud"
                  className="w-full h-full object-cover"
                />
                
                {/* Floating "Historia Clínica" Vector Odontograma Card */}
                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-200/80 max-w-[280px] sm:max-w-[340px] xl:max-w-[380px]">
                  <div className="flex items-center gap-2.5 pb-2.5 mb-2.5 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                      🦷
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800">Historia Clínica</span>
                  </div>

                  {/* Clean SVG Vector Dental Odontograma Arch */}
                  <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/70">
                    {/* Upper Arch (16 teeth) */}
                    <div className="flex items-center justify-center gap-1 sm:gap-1.5 py-1">
                      {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map((t, idx) => {
                        const isTreated = idx === 2 || idx === 12;
                        const isPending = idx === 4;
                        return (
                          <div key={t} className="flex flex-col items-center">
                            <div className={`w-3.5 h-4 sm:w-4 sm:h-5 rounded-t-sm border flex items-center justify-center transition-all ${
                              isTreated
                                ? "bg-blue-500 border-blue-600"
                                : isPending
                                ? "bg-amber-400 border-amber-500"
                                : "bg-white border-slate-300 hover:border-blue-400"
                            }`}>
                              {(isTreated || isPending) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                              )}
                            </div>
                            <span className="text-[6px] sm:text-[7px] text-slate-400 mt-0.5">{t}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="w-full h-[1px] bg-slate-200/80 my-2" />

                    {/* Lower Arch (16 teeth) */}
                    <div className="flex items-center justify-center gap-1 sm:gap-1.5 py-1">
                      {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map((t, idx) => {
                        const isTreated = idx === 10;
                        return (
                          <div key={t} className="flex flex-col items-center">
                            <div className={`w-3.5 h-4 sm:w-4 sm:h-5 rounded-b-sm border flex items-center justify-center transition-all ${
                              isTreated
                                ? "bg-emerald-500 border-emerald-600"
                                : "bg-white border-slate-300 hover:border-blue-400"
                            }`}>
                              {isTreated && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                              )}
                            </div>
                            <span className="text-[6px] sm:text-[7px] text-slate-400 mt-0.5">{t}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right: Copy & Checklist */}
            <div className="lg:col-span-6 text-left space-y-6 sm:space-y-8">
              <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 text-[#2563EB] text-xs font-black uppercase tracking-wider">
                MÁS QUE UN SOFTWARE
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
                Centraliza, simplifica y haz crecer tu clínica
              </h2>

              <p className="text-base sm:text-lg xl:text-xl text-slate-600 leading-relaxed font-normal">
                OdontoCloud te permite enfocarte en lo más importante: tus pacientes. Ahorra tiempo, mejora la experiencia en tu clínica y cumple con la normativa colombiana.
              </p>

              {/* Checklist */}
              <div className="space-y-4 sm:space-y-5 pt-2">
                {[
                  "Todo en la nube, desde cualquier dispositivo",
                  "Cumplimiento con la DIAN (facturación electrónica)",
                  "Mejora la experiencia de tus pacientes",
                  "Soporte en español, siempre que lo necesites"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3.5 sm:gap-4">
                    <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm shadow-blue-500/30">
                      ✓
                    </div>
                    <span className="text-sm sm:text-base xl:text-lg font-bold text-slate-800">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. HIGHLIGHTED TESTIMONIAL (Horizontal Card)
          ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-[#F8FAFC] border-y border-slate-150">
        <div className="w-full max-w-[1240px] xl:max-w-[1400px] 2xl:max-w-[1550px] mx-auto px-4 sm:px-8">
          <div className="bg-white rounded-3xl sm:rounded-[36px] p-8 sm:p-10 xl:p-12 shadow-md border border-slate-200/80 flex flex-col md:flex-row items-center gap-8 xl:gap-12 text-left">
            
            {/* Avatar */}
            <img
              src={doctorImg}
              alt="Dra. Carolina Mejía"
              className="w-20 h-20 sm:w-24 sm:h-24 xl:w-28 xl:h-28 rounded-full object-cover border-4 border-blue-100 shadow-md shrink-0"
            />

            {/* Quote */}
            <div className="flex-1 space-y-2">
              <p className="text-slate-700 text-sm sm:text-base xl:text-lg leading-relaxed italic font-medium">
                “OdontoCloud ha simplificado la gestión de nuestra clínica. La agenda, la historia clínica y la facturación funcionan de forma perfecta. Nos ha permitido ahorrar tiempo y brindar una mejor experiencia a nuestros pacientes.”
              </p>
            </div>

            {/* Author & Rating */}
            <div className="md:border-l md:border-slate-200 md:pl-8 text-left shrink-0 space-y-1.5">
              <span className="text-base sm:text-lg xl:text-xl font-black text-slate-900 block leading-tight">
                Dra. Carolina Mejía
              </span>
              <span className="text-xs sm:text-sm text-slate-500 block">
                Clínica Sonrisa Total – Medellín
              </span>
              <div className="flex items-center gap-1 text-amber-400 text-sm xl:text-base pt-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. BOTTOM CTA BANNER (Vibrant deep blue)
          ───────────────────────────────────────────────────────────── */}
      <section id="contacto" className="py-16 sm:py-24 bg-white">
        <div className="w-full max-w-[1240px] xl:max-w-[1400px] 2xl:max-w-[1550px] mx-auto px-4 sm:px-8">
          <div className="relative rounded-3xl sm:rounded-[40px] bg-gradient-to-r from-[#08183E] via-[#0A225B] to-[#122D77] p-8 sm:p-14 xl:p-16 text-white shadow-2xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            
            {/* Watermark decorations */}
            <div className="absolute -left-12 -bottom-12 w-56 h-56 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-0 top-0 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

            {/* Left Content */}
            <div className="flex items-center gap-5 text-left z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white text-3xl shrink-0 hidden sm:flex">
                <FiCloud />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-white leading-tight">
                  ¿Listo para llevar tu clínica al siguiente nivel?
                </h3>
                <p className="text-sm sm:text-base xl:text-lg text-blue-200/90 font-normal">
                  Descubre cómo OdontoCloud puede transformar tu clínica.
                </p>
              </div>
            </div>

            {/* Right Button */}
            <div className="z-10 shrink-0">
              <button
                onClick={handleDemo}
                className="px-8 sm:px-9 py-4 sm:py-5 bg-white hover:bg-slate-50 text-[#08183E] rounded-full font-bold text-sm sm:text-base xl:text-lg shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2.5 group cursor-pointer border-0"
              >
                <span>Solicitar demostración gratuita</span>
                <FiArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Video Modal */}
      {showDocModal && <DocumentationModal onClose={() => setShowDocModal(false)} />}
    </div>
  );
}
