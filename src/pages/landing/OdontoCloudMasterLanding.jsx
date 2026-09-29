import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FiArrowRight, FiPlay, FiCheck, FiCalendar, FiUsers,
  FiFileText, FiBell, FiChevronDown, FiShield, FiCloud,
  FiHeadphones, FiCheckCircle, FiStar
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
    <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-500/20 selection:text-blue-700">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION
          ───────────────────────────────────────────────────────────── */}
      <section id="inicio" className="relative w-full pt-28 sm:pt-36 pb-16 overflow-hidden bg-gradient-to-b from-[#F5F8FF] via-[#FAFCFF] to-white">
        {/* Soft background ambient glows */}
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-32 left-10 w-[450px] h-[450px] bg-sky-300/10 rounded-full blur-[130px] pointer-events-none" />

        <div className="container mx-auto px-4 md:px-8 max-w-[1400px] relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center mb-16">
            
            {/* LEFT: Headline & Value Proposition */}
            <div className="lg:col-span-5 text-left space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-[46px] xl:text-[52px] font-sans font-black text-slate-900 tracking-tight leading-[1.15]">
                Gestiona tu clínica dental de forma{" "}
                <span className="text-[#2563EB]">simple y profesional</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-xl">
                Agenda, historia clínica, odontograma, facturación electrónica y más. Todo en un solo lugar, accesible desde cualquier dispositivo.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={handleDemo}
                  className="px-6 py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full font-bold text-sm shadow-md shadow-blue-500/20 transition-all duration-200 transform hover:-translate-y-0.5 flex items-center gap-2 group cursor-pointer border-0"
                >
                  <span>Solicitar demostración gratuita</span>
                  <FiArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  onClick={() => setShowDocModal(true)}
                  className="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full font-bold text-sm shadow-xs transition-all duration-200 flex items-center gap-2 cursor-pointer"
                >
                  <FiPlay size={13} className="text-[#2563EB] fill-[#2563EB]" />
                  <span>Ver video (2 min)</span>
                </button>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 flex flex-wrap items-center gap-6 text-slate-600 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                  <span>100% en la nube</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                  <span>Seguro y confiable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                  <span>Soporte en español</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Laptop & Smartphone Mockup Composition */}
            <div className="lg:col-span-7 relative w-full flex justify-center items-center py-4">
              
              {/* LAPTOP CONTAINER */}
              <div className="relative w-full max-w-[680px] bg-slate-900 rounded-[22px] p-2 sm:p-2.5 shadow-2xl shadow-slate-900/25 border border-slate-800">
                {/* Camera dot */}
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mx-auto mb-1.5 opacity-80" />

                {/* Laptop Screen */}
                <div className="w-full bg-[#FAFCFE] rounded-xl overflow-hidden border border-slate-200/80 text-left text-slate-800 select-none shadow-inner">
                  
                  {/* Mockup Topbar */}
                  <div className="h-10 bg-white border-b border-slate-150 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={logoUrl} alt="OdontoCloud" className="h-6 w-auto object-contain" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <FiBell size={13} className="text-slate-400" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
                      </div>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-150">
                        <img
                          src="https://images.unsplash.com/photo-1594824813633-82556a310e52?auto=format&fit=crop&q=80&w=120"
                          alt="Dra. Garcia"
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <div className="text-[10px] leading-tight">
                          <span className="font-bold text-slate-800 block">Dra. Garcia</span>
                          <span className="text-[8px] text-slate-400">Clínica Dental</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mockup Body with Sidebar & Dashboard Content */}
                  <div className="flex min-h-[330px]">
                    {/* Sidebar */}
                    <div className="w-28 sm:w-32 bg-white border-r border-slate-150 p-2 sm:p-2.5 space-y-1 shrink-0 hidden sm:block">
                      <div className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[10px] flex items-center gap-1.5 shadow-xs">
                        <span>•</span>
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
                        <div key={idx} className="px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:text-blue-600 cursor-default">
                          {item.name}
                        </div>
                      ))}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-3 sm:p-4 space-y-3 bg-[#FAFCFE]">
                      
                      {/* Greeting & Date */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">¡Hola, Dra. Garcia!</h4>
                          <p className="text-[9px] sm:text-[10px] text-slate-400">Aquí tienes un resumen de tu clínica hoy.</p>
                        </div>
                        <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-medium text-slate-500 shadow-2xs flex items-center gap-1">
                          <span>Hoy, 26 de enero de 2026</span>
                          <span>▾</span>
                        </div>
                      </div>

                      {/* 3 Metric Cards */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-150 shadow-2xs">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-4 h-4 rounded bg-purple-50 text-purple-600 flex items-center justify-center text-[9px]">
                              <FiCalendar size={9} />
                            </div>
                            <span className="text-xs sm:text-sm font-black text-slate-900">12</span>
                          </div>
                          <span className="text-[9px] text-slate-500 block leading-none">Citas hoy</span>
                        </div>

                        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-150 shadow-2xs">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-4 h-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[9px]">
                              <FiUsers size={9} />
                            </div>
                            <span className="text-xs sm:text-sm font-black text-slate-900">28</span>
                          </div>
                          <span className="text-[9px] text-slate-500 block leading-none">Pacientes activos</span>
                        </div>

                        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-150 shadow-2xs">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-4 h-4 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center text-[9px]">
                              $
                            </div>
                            <span className="text-xs sm:text-sm font-black text-emerald-600">$1.450.000</span>
                          </div>
                          <span className="text-[9px] text-slate-500 block leading-none">Ingresos del mes</span>
                        </div>
                      </div>

                      {/* 2-Column Section: Agenda & Donut Chart */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-0.5">
                        
                        {/* Agenda de hoy */}
                        <div className="sm:col-span-7 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-150 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="text-[10px] font-bold text-slate-800">Agenda de hoy</span>
                            <span className="text-[9px] font-bold text-blue-600 flex items-center gap-0.5">
                              Ver agenda →
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { time: "08:00", name: "María López", svc: "Limpieza dental", badge: "En atención", bg: "bg-blue-50 text-blue-600" },
                              { time: "09:30", name: "Carlos Ramírez", svc: "Control ortodoncia", badge: "Confirmada", bg: "bg-emerald-50 text-emerald-600" },
                              { time: "11:00", name: "Ana Torres", svc: "Restauración resina", badge: "Confirmada", bg: "bg-emerald-50 text-emerald-600" },
                              { time: "14:00", name: "Luis Alejandro Gómez", svc: "Valoración inicial", badge: "Pendiente", bg: "bg-amber-50 text-amber-600" }
                            ].map((a, i) => (
                              <div key={i} className="flex items-center justify-between text-[9px] py-0.5 border-b border-slate-50 last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-400">{a.time}</span>
                                  <div>
                                    <span className="font-bold text-slate-800 block leading-tight">{a.name}</span>
                                    <span className="text-[8px] text-slate-400 block leading-none">{a.svc}</span>
                                  </div>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${a.bg}`}>
                                  {a.badge}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Distribución de Tratamientos (Donut Chart) */}
                        <div className="sm:col-span-5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-150 shadow-2xs flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-slate-800 pb-1 border-b border-slate-100 block">
                            Distribución de tratamientos
                          </span>

                          <div className="flex items-center justify-center my-1">
                            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="5" />
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#2563EB" strokeWidth="5" strokeDasharray="35 65" strokeDashoffset="0" />
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#F97316" strokeWidth="5" strokeDasharray="26 74" strokeDashoffset="-35" />
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#06B6D4" strokeWidth="5" strokeDasharray="18 82" strokeDashoffset="-61" />
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#94A3B8" strokeWidth="5" strokeDasharray="9 91" strokeDashoffset="-79" />
                            </svg>
                          </div>

                          <div className="space-y-1 text-[8px]">
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />Preventivos</span>
                              <span className="font-bold">40%</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />Restauradores</span>
                              <span className="font-bold">30%</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />Ortodoncia</span>
                              <span className="font-bold">20%</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />Otros</span>
                              <span className="font-bold">10%</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>

                {/* Laptop bottom bar & notch */}
                <div className="w-20 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
              </div>

              {/* SMARTPHONE OVERLAY (in front of laptop, bottom-left) */}
              <div className="absolute -bottom-6 -left-2 sm:left-2 w-[140px] sm:w-[170px] bg-slate-900 rounded-[28px] p-2 shadow-2xl shadow-blue-900/30 border-2 border-slate-700 hidden xs:block">
                {/* Speaker pill */}
                <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-1.5" />
                
                {/* Phone screen */}
                <div className="bg-white rounded-[20px] p-2.5 text-left text-slate-800 space-y-2 border border-slate-100 shadow-inner">
                  <div className="text-center pt-0.5">
                    <span className="text-[10px] font-black text-slate-900 block leading-tight">Hola, Dra. Garcia</span>
                    <span className="text-[7px] text-slate-400">Tu clínica en un solo lugar</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {[
                      { icon: "📅", label: "Agenda" },
                      { icon: "👥", label: "Pacientes" },
                      { icon: "🦷", label: "Odontograma" },
                      { icon: "📄", label: "Facturación" }
                    ].map((btn, i) => (
                      <div key={i} className="p-1.5 rounded-lg bg-slate-50 border border-slate-150 flex items-center gap-1.5">
                        <span className="text-[9px]">{btn.icon}</span>
                        <span className="text-[8px] font-bold text-slate-700">{btn.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-around text-[7px] text-slate-400">
                    <span className="text-blue-600 font-bold">Inicio</span>
                    <span>Pacientes</span>
                    <span>Agenda</span>
                    <span>Más</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* ─────────────────────────────────────────────────────────────
              2. FOUR FEATURE CARDS
              ───────────────────────────────────────────────────────────── */}
          <div id="funciones" className="pt-6 pb-16 scroll-mt-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
              
              {/* Card 1: Agenda inteligente */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-4">
                  <FiCalendar />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1.5">
                  Agenda inteligente
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Organiza tus citas de forma fácil y rápida.
                </p>
              </div>

              {/* Card 2: Historia clínica y odontograma */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl mb-4">
                  <span>🦷</span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1.5">
                  Historia clínica y odontograma
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Registra, visualiza y da seguimiento completo a tus pacientes.
                </p>
              </div>

              {/* Card 3: Facturación electrónica */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mb-4">
                  <FiFileText />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1.5">
                  Facturación electrónica
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Cumple con la DIAN sin complicaciones.
                </p>
              </div>

              {/* Card 4: Recordatorios automáticos */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-xl mb-4">
                  <FiBell />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1.5">
                  Recordatorios automáticos
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Envía confirmaciones de citas por WhatsApp y SMS.
                </p>
              </div>

            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. CLINICS TRUST BAR (Social Proof)
              ───────────────────────────────────────────────────────────── */}
          <div className="pt-4 pb-14 border-t border-slate-100 text-center">
            <p className="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase mb-8">
              MÁS DE 200 CLÍNICAS EN COLOMBIA CONFÍAN EN ODONTOCLOUD
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-center max-w-4xl mx-auto">
              
              <div className="flex items-center justify-center gap-2.5 px-4 py-2 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-2xl text-slate-400">🦷</span>
                <div className="text-left">
                  <span className="font-extrabold text-slate-700 text-xs block leading-tight">Sonrisa Total</span>
                  <span className="text-[9px] tracking-wider text-slate-400 uppercase block">CLÍNICA DENTAL</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2.5 px-4 py-2 border-l-0 md:border-l border-slate-200 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-2xl text-slate-400">🤍</span>
                <div className="text-left">
                  <span className="font-extrabold text-slate-700 text-xs block leading-tight">Dentisalud</span>
                  <span className="text-[9px] tracking-wider text-slate-400 uppercase block">Odontología Especializada</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2.5 px-4 py-2 border-l-0 md:border-l border-slate-200 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-2xl text-slate-400">🎯</span>
                <div className="text-left">
                  <span className="font-extrabold text-slate-700 text-xs block leading-tight">OralCare</span>
                  <span className="text-[9px] tracking-wider text-slate-400 uppercase block">CENTRO ODONTOLÓGICO</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2.5 px-4 py-2 border-l-0 md:border-l border-slate-200 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-2xl text-slate-400">🛡️</span>
                <div className="text-left">
                  <span className="font-extrabold text-slate-700 text-xs block leading-tight">VitalDent</span>
                  <span className="text-[9px] tracking-wider text-slate-400 uppercase block">CLÍNICA DENTAL</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. "MÁS QUE UN SOFTWARE" SHOWCASE SECTION
          ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-8 max-w-[1400px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            
            {/* Left: Professional Dentist Photo + Floating Odontograma Card */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-100 aspect-[4/3] max-w-[560px] mx-auto">
                <img
                  src={dentistImg}
                  alt="Doctora OdontoCloud"
                  className="w-full h-full object-cover"
                />
                
                {/* Floating "Historia Clínica & Odontograma" Card */}
                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-4 shadow-xl border border-slate-150 max-w-[280px] sm:max-w-[320px]">
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100">
                    <span className="text-blue-600 text-sm">🦷</span>
                    <span className="text-xs font-bold text-slate-800">Historia Clínica</span>
                  </div>

                  {/* Odontograma arch illustration */}
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
                    <div className="flex justify-center gap-1 text-[10px]">
                      {["🦷","🦷","🦷","🦷","🦷","🦷","🦷","🦷"].map((t, idx) => (
                        <span key={idx} className={idx === 2 ? "text-amber-500 font-bold" : idx === 5 ? "text-blue-500 font-bold" : "text-slate-400"}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="w-full h-[1px] bg-slate-200 my-1" />
                    <div className="flex justify-center gap-1 text-[10px]">
                      {["🦷","🦷","🦷","🦷","🦷","🦷","🦷","🦷"].map((t, idx) => (
                        <span key={idx} className="text-slate-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right: Copy & Checklist */}
            <div className="lg:col-span-6 text-left space-y-6">
              <span className="inline-block px-3.5 py-1.5 rounded-full bg-blue-50 text-[#2563EB] text-[11px] font-black uppercase tracking-wider">
                MÁS QUE UN SOFTWARE
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Centraliza, simplifica y haz crecer tu clínica
              </h2>

              <p className="text-base text-slate-600 leading-relaxed font-normal">
                OdontoCloud te permite enfocarte en lo más importante: tus pacientes. Ahorra tiempo, mejora la experiencia en tu clínica y cumple con la normativa colombiana.
              </p>

              {/* Checklist */}
              <div className="space-y-3.5 pt-2">
                {[
                  "Todo en la nube, desde cualquier dispositivo",
                  "Cumplimiento con la DIAN (facturación electrónica)",
                  "Mejora la experiencia de tus pacientes",
                  "Soporte en español, siempre que lo necesites"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs shrink-0 shadow-xs">
                      ✓
                    </div>
                    <span className="text-sm font-semibold text-slate-800">
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
          5. HIGHLIGHTED TESTIMONIAL
          ───────────────────────────────────────────────────────────── */}
      <section className="py-14 bg-slate-50/60 border-y border-slate-100">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-150 flex flex-col md:flex-row items-center gap-6 text-left">
            
            {/* Avatar */}
            <img
              src={doctorImg}
              alt="Dra. Carolina Mejía"
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-blue-100 shadow-xs shrink-0"
            />

            {/* Quote */}
            <div className="flex-1 space-y-1">
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed italic">
                “OdontoCloud ha simplificado la gestión de nuestra clínica. La agenda, la historia clínica y la facturación funcionan de forma perfecta. Nos ha permitido ahorrar tiempo y brindar una mejor experiencia a nuestros pacientes.”
              </p>
            </div>

            {/* Author & Rating */}
            <div className="md:border-l md:border-slate-200 md:pl-6 text-left shrink-0 space-y-1">
              <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
                Dra. Carolina Mejía
              </span>
              <span className="text-[11px] text-slate-400 block">
                Clínica Sonrisa Total – Medellín
              </span>
              <div className="flex items-center gap-0.5 text-amber-400 text-xs pt-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. BOTTOM CTA BANNER
          ───────────────────────────────────────────────────────────── */}
      <section id="contacto" className="py-16 bg-white">
        <div className="container mx-auto px-4 md:px-8 max-w-6xl">
          <div className="relative rounded-3xl bg-gradient-to-r from-[#0B1E4D] via-[#0E2766] to-[#123180] p-8 sm:p-12 text-white shadow-2xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            
            {/* Cloud watermark decoration */}
            <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute right-0 top-0 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

            {/* Left Content */}
            <div className="flex items-center gap-4 text-left z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white text-2xl shrink-0 hidden sm:flex">
                <FiCloud />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  ¿Listo para llevar tu clínica al siguiente nivel?
                </h3>
                <p className="text-xs sm:text-sm text-blue-200/90 font-normal">
                  Descubre cómo OdontoCloud puede transformar tu clínica.
                </p>
              </div>
            </div>

            {/* Right Button */}
            <div className="z-10 shrink-0">
              <button
                onClick={handleDemo}
                className="px-7 py-4 bg-white hover:bg-slate-50 text-[#0B1E4D] rounded-full font-bold text-xs sm:text-sm shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2 group cursor-pointer border-0"
              >
                <span>Solicitar demostración gratuita</span>
                <FiArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Video / Documentation Modal */}
      {showDocModal && <DocumentationModal onClose={() => setShowDocModal(false)} />}
    </div>
  );
}
