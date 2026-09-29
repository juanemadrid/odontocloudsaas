import React, { useState } from "react";
import {
  FiArrowRight, FiPlay, FiCalendar, FiUsers,
  FiFileText, FiBell, FiCloud, FiCheck, FiSearch,
  FiSettings, FiBarChart2, FiDollarSign
} from "react-icons/fi";
import DocumentationModal from "../../components/landing/DocumentationModal";

export default function OdontoCloudMasterLanding({ config = {}, onShowTrial }) {
  const [showDocModal, setShowDocModal] = useState(false);
  const [isMonitorHovered, setIsMonitorHovered] = useState(false);

  const phone = (config.contactPhone || "3015768935").replace(/\D/g, "");
  const logoUrl = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/logo.png`;
  const clinicHeroBg = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/clinic_hero_bg.jpg`;
  const dentistImg = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/dentist_tablet.jpg`;
  const doctorImg = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/doctor_carolina.jpg`;
  const teethSuperior = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/dontograma/permanente/superior.png`;
  const teethInferior = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/assets/dontograma/permanente/inferior.png`;

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
    <div className="w-full bg-[#F5F8FE] text-slate-900 font-sans selection:bg-blue-500/20 selection:text-blue-700 overflow-x-hidden">
           {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION (PANTALLA COMPLETA 100VH — SOLO HERO)
          ───────────────────────────────────────────────────────────── */}
      <section 
        id="inicio" 
        className="relative w-full min-h-[calc(100vh-5rem)] lg:min-h-screen flex items-center pt-28 sm:pt-32 lg:pt-24 xl:pt-28 pb-10 sm:pb-14 overflow-hidden bg-gradient-to-b from-[#E6F0FD] via-[#EEF5FE] to-[#F5F8FE]"
      >
        {/* Fondo fotográfico y resplandores azulados médicos */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src={clinicHeroBg}
            alt="Clínica OdontoCloud"
            className="w-full h-full object-cover object-right opacity-30 mix-blend-multiply filter saturate-150"
          />
          <div className="absolute -top-32 right-10 w-[700px] 2xl:w-[900px] h-[650px] 2xl:h-[800px] bg-gradient-to-br from-blue-500/25 via-sky-400/20 to-blue-600/15 rounded-full blur-[140px]" />
          <div className="absolute top-20 left-0 w-[600px] 2xl:w-[800px] h-[600px] bg-gradient-to-tr from-cyan-400/20 via-blue-500/15 to-transparent rounded-full blur-[130px]" />
          <div className="absolute bottom-0 right-1/4 w-[750px] h-[350px] bg-blue-600/15 rounded-full blur-[120px]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#E6F0FD]/95 via-[#EEF5FE]/80 to-transparent" />
        </div>

        <div className="w-full max-w-[1680px] 2xl:max-w-[2100px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative z-10 py-3 lg:py-6 2xl:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-12 2xl:gap-16 items-center">
            
            {/* COLUMNA IZQUIERDA: Titular, Beneficios y CTAs */}
            <div className="lg:col-span-5 text-left space-y-3 lg:space-y-4 xl:space-y-5 2xl:space-y-6">
              
              {/* Badge Azul Superior (Con espacio garantizado debajo del header) */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/25 text-[#2563EB] text-xs 2xl:text-sm font-black tracking-wide shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
                <span>Software Odontológico en la Nube</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[34px] xl:text-[44px] 2xl:text-[58px] font-sans font-black text-slate-900 tracking-tight leading-[1.14]">
                Gestiona tu clínica dental de forma{" "}
                <span className="text-[#2563EB] drop-shadow-xs">simple y profesional</span>
              </h1>

              <p className="text-sm sm:text-base lg:text-[14px] xl:text-base 2xl:text-xl text-slate-600 leading-relaxed font-normal max-w-lg xl:max-w-xl 2xl:max-w-2xl">
                Agenda, historia clínica, odontograma, facturación electrónica y más. Todo en un solo lugar, accesible desde cualquier dispositivo.
              </p>

              {/* Botones de Acción */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
                <button
                  onClick={handleDemo}
                  className="px-6 sm:px-7 2xl:px-9 py-3 sm:py-3.5 2xl:py-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full font-bold text-sm sm:text-base 2xl:text-lg shadow-lg shadow-blue-600/30 transition-all duration-200 transform hover:-translate-y-0.5 flex items-center gap-2 group cursor-pointer border-0"
                >
                  <span>Solicitar demostración gratuita</span>
                  <FiArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  onClick={() => setShowDocModal(true)}
                  className="px-5 sm:px-6 2xl:px-8 py-3 sm:py-3.5 2xl:py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full font-bold text-sm sm:text-base 2xl:text-lg shadow-sm hover:shadow transition-all duration-200 flex items-center gap-2 cursor-pointer"
                >
                  <FiPlay size={13} className="text-[#2563EB] fill-[#2563EB]" />
                  <span>Ver video (2 min)</span>
                </button>
              </div>

              {/* 3 Insignias de Confianza */}
              <div className="pt-1.5 flex flex-wrap items-center gap-4 sm:gap-6 text-slate-700 text-xs sm:text-sm 2xl:text-base font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                    ✓
                  </div>
                  <span>100% en la nube</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                    ✓
                  </div>
                  <span>Seguro y confiable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                    ✓
                  </div>
                  <span>Soporte en español</span>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA:
                - En Desktop: Monitor Laptop Panorámico 16:10 (aprovecha el ancho sin estirarse a lo alto)
                - Celular estilizado a un lado sin tapar datos
            */}
            <div className="lg:col-span-7 relative w-full flex justify-center items-center py-2">
              
              {/* Brillo Azul Clínico de Fondo */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/25 via-sky-400/20 to-blue-600/15 rounded-full blur-[110px] pointer-events-none scale-105" />

              {/* ══════════════════════════════════════════════════════════════
                  A) VISTA ESCRITORIO (>= lg): LAPTOP MACBOOK PRO PANORÁMICO
                  ══════════════════════════════════════════════════════════════ */}
              <div className="hidden lg:block relative w-full max-w-[660px] lg:max-w-[740px] xl:max-w-[880px] 2xl:max-w-[1100px]">
                
                {/* CONTENEDOR LAPTOP MACBOOK PRO */}
                <div 
                  onMouseEnter={() => setIsMonitorHovered(true)}
                  onMouseLeave={() => setIsMonitorHovered(false)}
                  className="peer/laptop relative z-20 transition-all duration-300"
                >
                  <div className="relative w-full bg-gradient-to-b from-[#E2E8F0] via-[#CBD5E1] to-[#94A3B8] rounded-[22px] xl:rounded-[26px] p-2.5 xl:p-3 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.4)] border border-slate-300">
                    
                    {/* Marco de Pantalla Negro Vidriado */}
                    <div className="bg-slate-950 rounded-[16px] xl:rounded-[20px] p-2 xl:p-2.5 pt-1.5 shadow-2xl">
                      {/* Cámara Web HD y sensor */}
                      <div className="flex items-center justify-center gap-1.5 mb-1.5">
                        <div className="w-2 h-2 rounded-full bg-slate-800 border border-slate-700/60" />
                        <div className="w-1 h-1 rounded-full bg-emerald-500/80 animate-pulse" />
                      </div>

                      {/* Pantalla del Sistema OdontoCloud */}
                      <div className="w-full bg-[#F8FAFC] rounded-lg xl:rounded-xl overflow-hidden text-left text-slate-800 select-none border border-slate-200">
                        
                        {/* Barra Superior del Sistema (Blindada contra desbordamientos) */}
                        <div className="h-10 xl:h-11 bg-white border-b border-slate-150 px-3.5 xl:px-4 flex items-center justify-between overflow-hidden">
                          {/* Marca del Sistema */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                              🦷
                            </div>
                            <span className="font-black text-xs xl:text-sm tracking-tight text-slate-900 flex items-center shrink-0">
                              <span>Odonto</span>
                              <span className="text-[#2563EB]">Cloud</span>
                            </span>
                          </div>

                          {/* Estado, Notificaciones y Perfil */}
                          <div className="flex items-center gap-2.5 xl:gap-3.5 shrink-0">
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9.5px] xl:text-[10px] font-bold border border-emerald-100 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>En línea</span>
                            </div>
                            <div className="relative text-slate-400 shrink-0">
                              <FiBell size={13} />
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
                            </div>
                            <div className="flex items-center gap-2 pl-2.5 border-l border-slate-200 shrink-0">
                              <div className="w-5.5 h-5.5 xl:w-6 xl:h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[9.5px] xl:text-[10px] font-bold shadow-xs shrink-0">
                                JM
                              </div>
                              <div className="text-[9.5px] xl:text-[10px] leading-tight text-left">
                                <span className="font-bold text-slate-800 block whitespace-nowrap">Juan Madrid</span>
                                <span className="text-[8px] text-slate-400 block whitespace-nowrap">Administrador</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Cuerpo: Menú Lateral + Tablero con Altura Vertical Cómoda */}
                        <div className="flex min-h-[350px] lg:min-h-[380px] xl:min-h-[430px] 2xl:min-h-[490px]">
                          
                          {/* Menú Lateral */}
                          <div className="w-28 xl:w-34 2xl:w-38 bg-white border-r border-slate-150 p-2 xl:p-2.5 space-y-1 shrink-0">
                            <div className="px-2 py-1 mb-1.5 bg-slate-50 rounded-lg border border-slate-150 flex items-center gap-1.5 text-[8.5px] text-slate-400">
                              <FiSearch size={9} />
                              <span>Buscar...</span>
                            </div>

                            <div className="text-[7.5px] font-bold uppercase text-slate-400 px-2 py-0.5 tracking-wider">
                              MENÚ PRINCIPAL
                            </div>

                            <div className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white font-bold text-[9.5px] xl:text-[11px] flex items-center gap-2 shadow-sm shadow-blue-500/30">
                              <span>●</span>
                              <span>INICIO</span>
                            </div>

                            {[
                              { name: "AGENDA", icon: <FiCalendar size={11} /> },
                              { name: "PACIENTES", icon: <FiUsers size={11} /> },
                              { name: "CAJA", icon: <FiDollarSign size={11} /> },
                              { name: "ADMINISTRACIÓN", icon: <FiSettings size={11} /> },
                              { name: "REPORTES", icon: <FiBarChart2 size={11} /> }
                            ].map((item, idx) => (
                              <div key={idx} className="px-2.5 py-1.5 text-[9px] xl:text-[10.5px] font-semibold text-slate-600 hover:text-blue-600 cursor-default rounded-lg flex items-center gap-2 transition-colors">
                                <span>{item.icon}</span>
                                <span>{item.name}</span>
                              </div>
                            ))}
                          </div>

                          {/* Área de Trabajo Principal Panorámica y Espaciosa */}
                          <div className="flex-1 p-2.5 xl:p-3.5 2xl:p-4.5 space-y-2.5 xl:space-y-3.5 bg-[#F8FAFC]">
                            
                            {/* Banner de Bienvenida Azul Clínico */}
                            <div className="rounded-xl bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0284C7] px-3.5 py-2.5 xl:py-3 text-white shadow-md shadow-blue-500/20 flex items-center justify-between">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-[8px] xl:text-[9px] font-bold uppercase tracking-wider text-blue-100">
                                  <span className="bg-white/20 px-1.5 py-0.2 rounded">ADMINISTRADOR</span>
                                  <span>•</span>
                                  <span>Clínica Central</span>
                                </div>
                                <h4 className="text-xs xl:text-sm font-black text-white">¡Buenas tardes, Juan! 👋</h4>
                              </div>
                              <span className="text-[8.5px] xl:text-[9.5px] text-blue-100 bg-white/10 px-2.5 py-0.5 rounded-full font-medium hidden sm:inline-block">
                                Panel OdontoCloud
                              </span>
                            </div>

                            {/* 4 Tarjetas de Métricas con Altura y Respiración */}
                            <div className="grid grid-cols-4 gap-2 xl:gap-2.5">
                              <div className="bg-white p-2 xl:p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[10px]">
                                    <FiCalendar />
                                  </div>
                                  <span className="text-xs xl:text-sm 2xl:text-base font-black text-slate-900">12</span>
                                </div>
                                <span className="text-[8px] xl:text-[9px] text-slate-500 block pt-1">Citas hoy</span>
                              </div>

                              <div className="bg-white p-2 xl:p-2.5 rounded-xl border border-sky-100 shadow-2xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded bg-sky-50 text-sky-600 flex items-center justify-center text-[10px]">
                                    <FiUsers />
                                  </div>
                                  <span className="text-xs xl:text-sm 2xl:text-base font-black text-slate-900">28</span>
                                </div>
                                <span className="text-[8px] xl:text-[9px] text-slate-500 block pt-1">Pacientes activos</span>
                              </div>

                              <div className="bg-white p-2 xl:p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-black">
                                    $
                                  </div>
                                  <span className="text-xs xl:text-sm 2xl:text-base font-black text-emerald-600">$1.450.000</span>
                                </div>
                                <span className="text-[8px] xl:text-[9px] text-slate-500 block pt-1">Ingresos mes</span>
                              </div>

                              <div className="bg-white p-2 xl:p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]">
                                    <FiCheck />
                                  </div>
                                  <span className="text-xs xl:text-sm 2xl:text-base font-black text-indigo-600">98%</span>
                                </div>
                                <span className="text-[8px] xl:text-[9px] text-slate-500 block pt-1">Eficiencia</span>
                              </div>
                            </div>

                            {/* Agenda + Gráficas Clínicas (Alineación Amplia y Vertical) */}
                            <div className="grid grid-cols-12 gap-2 xl:gap-2.5">
                              
                              {/* Agenda del día */}
                              <div className="col-span-7 bg-white p-2.5 xl:p-3 rounded-xl border border-slate-150 shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                  <span className="text-[10.5px] xl:text-[11.5px] font-bold text-slate-900">Agenda del día</span>
                                  <span className="text-[9px] xl:text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">
                                    Ver agenda →
                                  </span>
                                </div>

                                <div className="space-y-1 xl:space-y-1.5">
                                  {[
                                    { time: "08:00", name: "María López", svc: "Limpieza dental", badge: "En atención", bg: "bg-blue-50 text-blue-600" },
                                    { time: "09:30", name: "Carlos Ramírez", svc: "Control ortodoncia", badge: "Confirmada", bg: "bg-emerald-50 text-emerald-600" },
                                    { time: "11:00", name: "Ana Torres", svc: "Restauración resina", badge: "Confirmada", bg: "bg-emerald-50 text-emerald-600" },
                                    { time: "14:00", name: "Luis Gómez", svc: "Valoración inicial", badge: "Pendiente", bg: "bg-amber-50 text-amber-600" }
                                  ].map((a, i) => (
                                    <div key={i} className="flex items-center justify-between text-[9px] xl:text-[10px] py-1 border-b border-slate-50 last:border-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-400">{a.time}</span>
                                        <div>
                                          <span className="font-bold text-slate-800 block leading-tight">{a.name}</span>
                                          <span className="text-[8px] xl:text-[9px] text-slate-400 block leading-none pt-0.5">{a.svc}</span>
                                        </div>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${a.bg}`}>
                                        {a.badge}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Columna Derecha: Gráfica de Barras Azules + Donut */}
                              <div className="col-span-5 flex flex-col gap-2 xl:gap-2.5">
                                
                                {/* Gráfica de Barras Azules: Ingresos Mensuales con Altura */}
                                <div className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-2xs">
                                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-800">Ingresos</span>
                                    <span className="text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded">+18.5%</span>
                                  </div>
                                  <div className="flex items-end justify-between h-14 xl:h-16 px-1 pt-1 gap-1.5">
                                    {[
                                      { h: "35%", val: "May" },
                                      { h: "50%", val: "Jun" },
                                      { h: "45%", val: "Jul" },
                                      { h: "70%", val: "Ago" },
                                      { h: "90%", val: "Sep" },
                                      { h: "100%", val: "Oct", active: true }
                                    ].map((bar, bi) => (
                                      <div key={bi} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                                        <div 
                                          style={{ height: bar.h }} 
                                          className={`w-full rounded-t-sm ${bar.active ? 'bg-gradient-to-t from-blue-600 to-sky-400 shadow-xs' : 'bg-blue-100 hover:bg-blue-200'}`} 
                                        />
                                        <span className="text-[7px] text-slate-400">{bar.val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Donut Tratamientos con Mayor Tamaño */}
                                <div className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-2xs flex items-center justify-between">
                                  <div className="flex items-center justify-center shrink-0">
                                    <svg className="w-12 h-12 xl:w-13 xl:h-13 transform -rotate-90" viewBox="0 0 36 36">
                                      <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="5" />
                                      <circle cx="18" cy="18" r="14" fill="none" stroke="#2563EB" strokeWidth="5" strokeDasharray="40 60" strokeDashoffset="0" />
                                      <circle cx="18" cy="18" r="14" fill="none" stroke="#F97316" strokeWidth="5" strokeDasharray="30 70" strokeDashoffset="-40" />
                                      <circle cx="18" cy="18" r="14" fill="none" stroke="#06B6D4" strokeWidth="5" strokeDasharray="20 80" strokeDashoffset="-70" />
                                      <circle cx="18" cy="18" r="14" fill="none" stroke="#94A3B8" strokeWidth="5" strokeDasharray="10 90" strokeDashoffset="-90" />
                                    </svg>
                                  </div>
                                  <div className="space-y-1 text-[8.5px] pl-2 flex-1">
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />Preventivos</span>
                                      <span className="font-bold text-slate-800">40%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />Resinas</span>
                                      <span className="font-bold text-slate-800">30%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />Ortodoncia</span>
                                      <span className="font-bold text-slate-800">20%</span>
                                    </div>
                                  </div>
                                </div>

                              </div>

                            </div>

                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Base / Teclado inferior MacBook Pro Panorámico */}
                    <div className="relative w-[102%] -ml-[1%] h-3.5 xl:h-4 bg-gradient-to-b from-[#E2E8F0] via-[#CBD5E1] to-[#94A3B8] rounded-b-xl shadow-xl flex items-start justify-center border-t border-slate-300">
                      {/* Muesca de apertura central (Notch de MacBook) */}
                      <div className="w-24 xl:w-32 h-1 xl:h-1.5 bg-slate-400/80 rounded-b-md shadow-inner" />
                    </div>
                  </div>

                  {/* Sombra de apoyo en escritorio */}
                  <div className="w-[96%] mx-auto h-3 bg-slate-900/15 rounded-full blur-md -mt-1" />
                </div>

                {/* 
                  SMARTPHONE INTERACTIVO SLENDER (Desktop):
                  - Por defecto: al frente del monitor (z-30).
                  - Al pasar el cursor sobre el monitor: se oculta suavemente detrás (z-10, deslizamiento lateral).
                  - Al pasar el cursor sobre el móvil o hacer clic: regresa inmediatamente al frente (z-30).
                */}
                <div 
                  onMouseEnter={() => setIsMonitorHovered(false)}
                  onClick={() => setIsMonitorHovered(false)}
                  className={`absolute -bottom-4 lg:-bottom-6 -left-8 lg:-left-12 xl:-left-16 2xl:-left-20 w-[145px] lg:w-[160px] xl:w-[185px] 2xl:w-[210px] transition-all duration-500 ease-in-out cursor-pointer z-30 peer-hover/laptop:z-10 peer-hover/laptop:-translate-x-12 peer-hover/laptop:translate-y-4 peer-hover/laptop:opacity-40 peer-hover/laptop:scale-90 hover:!z-30 hover:!translate-x-0 hover:!translate-y-0 hover:!opacity-100 hover:!scale-100 shadow-2xl ${
                    isMonitorHovered 
                      ? "z-10 -translate-x-12 translate-y-4 opacity-40 scale-90" 
                      : ""
                  }`}
                  title={isMonitorHovered ? "Haz clic para traer el móvil al frente" : "Pasa el mouse sobre el monitor para ocultar el móvil"}
                >
                  
                  {/* Chasis Titánio Gris Espacial Realista */}
                  <div className="relative bg-[#1c1d22] rounded-[32px] xl:rounded-[38px] p-2 xl:p-2.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6),0_10px_20px_-5px_rgba(37,99,235,0.3)] border-[2.5px] border-[#383a42] ring-1 ring-white/10">
                    
                    {/* Botones de Hardware Laterales */}
                    <div className="absolute -left-1 top-16 w-0.5 h-7 bg-slate-600 rounded-l" />
                    <div className="absolute -left-1 top-25 w-0.5 h-7 bg-slate-600 rounded-l" />
                    <div className="absolute -right-1 top-20 w-0.5 h-10 bg-slate-600 rounded-r" />

                    {/* Dynamic Island */}
                    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-16 xl:w-20 h-3.5 xl:h-4 bg-black rounded-full z-40 flex items-center justify-between px-1.5 shadow-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0a0d1a] border border-blue-900/60 flex items-center justify-center">
                        <div className="w-0.5 h-0.5 rounded-full bg-blue-500/40" />
                      </div>
                      <div className="w-1 h-1 rounded-full bg-[#151518]" />
                    </div>

                    {/* Pantalla del Teléfono */}
                    <div className="relative bg-white rounded-[26px] xl:rounded-[30px] pt-6 pb-2.5 px-2.5 text-left text-slate-800 space-y-1.5 border border-slate-200 overflow-hidden shadow-inner">
                      
                      {/* Reflejo Vidriado de Pantalla */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent rounded-[26px] xl:rounded-[30px] z-30" />

                      {/* Barra de Estado iOS (Hora, Wifi, Batería) */}
                      <div className="flex items-center justify-between text-[8px] text-slate-800 font-bold px-0.5">
                        <span>9:41</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[7px]">5G</span>
                          <span className="text-[8px]">📶</span>
                          <div className="w-4 h-2 border border-slate-700 rounded-2xs p-0.5 flex items-center">
                            <div className="w-full h-full bg-emerald-500 rounded-3xs" />
                          </div>
                        </div>
                      </div>

                      {/* Header App Móvil con Avatar Real */}
                      <div className="flex items-center justify-between pt-0.5 pb-1 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-[9px] shadow-xs">
                            JM
                          </div>
                          <div>
                            <span className="text-[10px] xl:text-[11px] font-black text-slate-900 block leading-tight">¡Hola, Juan!</span>
                            <span className="text-[7.5px] xl:text-[8.5px] text-blue-600 font-bold flex items-center gap-0.5">
                              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                              OdontoCloud Móvil
                            </span>
                          </div>
                        </div>
                        <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 relative">
                          <FiBell size={10} />
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
                        </div>
                      </div>

                      {/* Resumen Rápido de Métricas */}
                      <div className="grid grid-cols-3 gap-1 py-0.5">
                        <div className="bg-blue-50/80 p-1 rounded-lg text-center border border-blue-100">
                          <span className="text-[9px] xl:text-[10px] font-black text-blue-700 block">12</span>
                          <span className="text-[6.5px] text-slate-500 font-bold">Citas</span>
                        </div>
                        <div className="bg-sky-50/80 p-1 rounded-lg text-center border border-sky-100">
                          <span className="text-[9px] xl:text-[10px] font-black text-sky-700 block">28</span>
                          <span className="text-[6.5px] text-slate-500 font-bold">Pac.</span>
                        </div>
                        <div className="bg-emerald-50/80 p-1 rounded-lg text-center border border-emerald-100">
                          <span className="text-[9px] xl:text-[10px] font-black text-emerald-700 block">$1.4M</span>
                          <span className="text-[6.5px] text-slate-500 font-bold">Ingr.</span>
                        </div>
                      </div>

                      {/* Próxima Cita Activa */}
                      <div className="p-1.5 xl:p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
                        <div className="flex items-center justify-between text-[7px] font-bold text-blue-100 mb-0.5">
                          <span>PRÓXIMO PACIENTE</span>
                          <span className="px-1 py-0.2 rounded-full bg-white/20 text-white text-[6.5px]">08:30 AM</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[9.5px] xl:text-[10.5px] font-black text-white block">María López</span>
                            <span className="text-[7.5px] xl:text-[8px] text-blue-100">Limpieza dental</span>
                          </div>
                          <span className="text-xs">🦷</span>
                        </div>
                      </div>

                      {/* Botones de Acceso Rápido 2x2 */}
                      <div className="grid grid-cols-2 gap-1 pt-0.5">
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-150 flex items-center gap-1 hover:bg-blue-50 transition-colors">
                          <span className="text-[11px]">📅</span>
                          <div className="leading-tight">
                            <span className="text-[8.5px] font-bold text-slate-800 block">Agenda</span>
                            <span className="text-[6.5px] text-blue-600 font-bold">4 hoy</span>
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-150 flex items-center gap-1 hover:bg-blue-50 transition-colors">
                          <span className="text-[11px]">🦷</span>
                          <div className="leading-tight">
                            <span className="text-[8.5px] font-bold text-slate-800 block">Odonto</span>
                            <span className="text-[6.5px] text-blue-600 font-bold">HD 3D</span>
                          </div>
                        </div>
                      </div>

                      {/* Barra de Navegación Móvil Inferior */}
                      <div className="pt-1 border-t border-slate-150 flex items-center justify-around text-[8px] font-bold text-slate-400">
                        <span className="text-[#2563EB]">Inicio</span>
                        <span>Agenda</span>
                        <span>Pacientes</span>
                        <span>Caja</span>
                      </div>

                      {/* Home Indicator Bar */}
                      <div className="w-16 h-0.5 bg-slate-800 rounded-full mx-auto mt-0.5" />

                    </div>
                  </div>
                </div>

              </div>

              {/* ══════════════════════════════════════════════════════════════
                  B) VISTA PANTALLA CHICA (MÓVIL Y TABLET < lg):
                     TELÉFONO INTELIGENTE CENTRADO, ADAPTATIVO Y ELEGANTE
                  ══════════════════════════════════════════════════════════════ */}
              <div className="block lg:hidden w-full max-w-[280px] sm:max-w-[310px] mx-auto mt-3 sm:mt-5">
                
                {/* Chasis Titánio Móvil */}
                <div className="relative bg-[#1c1d22] rounded-[40px] p-2.5 sm:p-3 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.55),0_10px_20px_-5px_rgba(37,99,235,0.3)] border-[2.5px] border-[#383a42] ring-1 ring-white/10">
                  
                  {/* Botones de Hardware Laterales */}
                  <div className="absolute -left-1 top-20 w-0.5 h-8 bg-slate-600 rounded-l" />
                  <div className="absolute -left-1 top-30 w-0.5 h-8 bg-slate-600 rounded-l" />
                  <div className="absolute -right-1 top-24 w-0.5 h-11 bg-slate-600 rounded-r" />

                  {/* Dynamic Island */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-22 h-4.5 bg-black rounded-full z-40 flex items-center justify-between px-2 shadow-md">
                    <div className="w-2 h-2 rounded-full bg-[#0a0d1a] border border-blue-900/60 flex items-center justify-center">
                      <div className="w-0.5 h-0.5 rounded-full bg-blue-500/40" />
                    </div>
                    <div className="w-1 h-1 rounded-full bg-[#151518]" />
                  </div>

                  {/* Pantalla del Celular */}
                  <div className="relative bg-white rounded-[32px] pt-7 pb-3 px-3 text-left text-slate-800 space-y-2 border border-slate-200 overflow-hidden shadow-inner">
                    
                    {/* Reflejo Vidriado */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent rounded-[32px] z-30" />

                    {/* Barra de Estado */}
                    <div className="flex items-center justify-between text-[9px] text-slate-800 font-bold px-1">
                      <span>9:41</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px]">5G</span>
                        <span className="text-[9px]">📶</span>
                        <div className="w-4.5 h-2 border border-slate-700 rounded-2xs p-0.5 flex items-center">
                          <div className="w-full h-full bg-emerald-500 rounded-3xs" />
                        </div>
                      </div>
                    </div>

                    {/* Header App Móvil */}
                    <div className="flex items-center justify-between pt-0.5 pb-1 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                          JM
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 block leading-tight">¡Hola, Dr. Juan! 👋</span>
                          <span className="text-[8.5px] text-blue-600 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            OdontoCloud Móvil
                          </span>
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 relative">
                        <FiBell size={12} />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
                      </div>
                    </div>

                    {/* Métricas Móvil */}
                    <div className="grid grid-cols-3 gap-1.5 py-1">
                      <div className="bg-blue-50/80 p-1.5 rounded-xl text-center border border-blue-100">
                        <span className="text-xs font-black text-blue-700 block">12</span>
                        <span className="text-[7.5px] text-slate-500 font-bold">Citas</span>
                      </div>
                      <div className="bg-sky-50/80 p-1.5 rounded-xl text-center border border-sky-100">
                        <span className="text-xs font-black text-sky-700 block">28</span>
                        <span className="text-[7.5px] text-slate-500 font-bold">Pacientes</span>
                      </div>
                      <div className="bg-emerald-50/80 p-1.5 rounded-xl text-center border border-emerald-100">
                        <span className="text-xs font-black text-emerald-700 block">$1.4M</span>
                        <span className="text-[7.5px] text-slate-500 font-bold">Ingresos</span>
                      </div>
                    </div>

                    {/* Próxima Cita Activa */}
                    <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
                      <div className="flex items-center justify-between text-[7.5px] font-bold text-blue-100 mb-0.5">
                        <span>PRÓXIMO PACIENTE (08:30 AM)</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[7.5px]">En atención</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-white block">María López</span>
                          <span className="text-[8.5px] text-blue-100">Limpieza dental</span>
                        </div>
                        <span className="text-sm">🦷</span>
                      </div>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-150 flex items-center gap-1.5 hover:bg-blue-50 transition-colors">
                        <span className="text-xs">📅</span>
                        <div className="leading-tight">
                          <span className="text-[9.5px] font-bold text-slate-800 block">Agenda</span>
                          <span className="text-[7.5px] text-blue-600 font-bold">4 citas hoy</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-150 flex items-center gap-1.5 hover:bg-blue-50 transition-colors">
                        <span className="text-xs">🦷</span>
                        <div className="leading-tight">
                          <span className="text-[9.5px] font-bold text-slate-800 block">Odontograma</span>
                          <span className="text-[7.5px] text-blue-600 font-bold">HD 3D</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-150 flex items-center gap-1.5 hover:bg-blue-50 transition-colors">
                        <span className="text-xs">👥</span>
                        <div className="leading-tight">
                          <span className="text-[9.5px] font-bold text-slate-800 block">Pacientes</span>
                          <span className="text-[7.5px] text-blue-600 font-bold">Historias</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-150 flex items-center gap-1.5 hover:bg-blue-50 transition-colors">
                        <span className="text-xs">📄</span>
                        <div className="leading-tight">
                          <span className="text-[9.5px] font-bold text-slate-800 block">Facturación</span>
                          <span className="text-[7.5px] text-emerald-600 font-bold">DIAN al día</span>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Navegación Móvil */}
                    <div className="pt-1.5 border-t border-slate-150 flex items-center justify-around text-[9px] font-bold text-slate-400">
                      <span className="text-[#2563EB]">Inicio</span>
                      <span>Agenda</span>
                      <span>Pacientes</span>
                      <span>Caja</span>
                    </div>

                    {/* Home Indicator Bar */}
                    <div className="w-20 h-1 bg-slate-800 rounded-full mx-auto mt-1" />

                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. CUATRO TARJETAS DE FUNCIONES CLAVE (SECCIÓN INFERIOR CON SCROLL)
          ───────────────────────────────────────────────────────────── */}
      <section id="funciones" className="py-20 sm:py-28 bg-[#F0F6FE] border-t border-blue-100/60 scroll-mt-24">
        <div className="w-full max-w-[1720px] 2xl:max-w-[1850px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8 text-left">
            
            {/* Tarjeta 1: Agenda inteligente */}
            <div className="bg-white/95 backdrop-blur-sm p-7 xl:p-8 2xl:p-9 rounded-3xl border border-blue-100 shadow-[0_10px_30px_-10px_rgba(37,99,235,0.08)] hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.2)] hover:-translate-y-1.5 transition-all duration-300">
              <div className="w-13 h-13 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center text-2xl mb-5 shadow-xs">
                <FiCalendar />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-2">
                Agenda inteligente
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                Organiza tus citas de forma fácil y rápida.
              </p>
            </div>

            {/* Tarjeta 2: Historia clínica y odontograma */}
            <div className="bg-white/95 backdrop-blur-sm p-7 xl:p-8 2xl:p-9 rounded-3xl border border-purple-100 shadow-[0_10px_30px_-10px_rgba(147,51,234,0.08)] hover:shadow-[0_20px_40px_-15px_rgba(147,51,234,0.2)] hover:-translate-y-1.5 transition-all duration-300">
              <div className="w-13 h-13 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-5 shadow-xs">
                <span>🦷</span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-2">
                Historia clínica y odontograma
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                Registra, visualiza y da seguimiento completo a tus pacientes.
              </p>
            </div>

            {/* Tarjeta 3: Facturación electrónica */}
            <div className="bg-white/95 backdrop-blur-sm p-7 xl:p-8 2xl:p-9 rounded-3xl border border-emerald-100 shadow-[0_10px_30px_-10px_rgba(5,150,105,0.08)] hover:shadow-[0_20px_40px_-15px_rgba(5,150,105,0.2)] hover:-translate-y-1.5 transition-all duration-300">
              <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-5 shadow-xs">
                <FiFileText />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-2">
                Facturación electrónica
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                Cumple con la DIAN sin complicaciones.
              </p>
            </div>

            {/* Tarjeta 4: Recordatorios automáticos */}
            <div className="bg-white/95 backdrop-blur-sm p-7 xl:p-8 2xl:p-9 rounded-3xl border border-indigo-100 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.08)] hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.2)] hover:-translate-y-1.5 transition-all duration-300">
              <div className="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mb-5 shadow-xs">
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
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. "MÁS QUE UN SOFTWARE" SHOWCASE SECTION
          (Fondo de Color Suave y Odontograma Original)
          ───────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-[#F5F8FE] via-white to-[#F0F6FE] border-t border-blue-50">
        <div className="w-full max-w-[1720px] 2xl:max-w-[1850px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 xl:gap-20 items-center">
            
            {/* Izquierda: Imagen de Doctora con Tablet y Odontograma */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-[32px] sm:rounded-[40px] overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] w-full max-w-[640px] xl:max-w-[720px] mx-auto">
                <img
                  src={dentistImg}
                  alt="Doctora OdontoCloud"
                  className="w-full h-full object-cover object-[18%_center]"
                />
                
                {/* Tarjeta Flotante Historia Clínica con Arcadas Reales (Ubicada a la derecha sin tapar el rostro) */}
                <div className="absolute top-4 right-3 sm:top-6 sm:right-4 bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl border border-blue-100 max-w-[220px] sm:max-w-[250px] xl:max-w-[270px] z-10">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-150">
                    <div className="flex items-center gap-1.5">
                      <span className="text-blue-600 text-sm">🦷</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-800">Historia Clínica</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold">
                      Odontograma HD
                    </span>
                  </div>

                  {/* Diagrama de Arcadas de OdontoCloud */}
                  <div className="p-2 sm:p-2.5 bg-gradient-to-b from-blue-50/50 to-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="text-[8.5px] text-blue-600 font-extrabold uppercase tracking-wider text-center">
                      Arcada Superior
                    </div>
                    <img
                      src={teethSuperior}
                      alt="Arcada Superior Odontograma"
                      className="w-full h-auto object-contain max-h-9 mx-auto drop-shadow-2xs"
                    />

                    <div className="w-full h-[1px] bg-blue-200/60 my-0.5" />

                    <div className="text-[8.5px] text-blue-600 font-extrabold uppercase tracking-wider text-center">
                      Arcada Inferior
                    </div>
                    <img
                      src={teethInferior}
                      alt="Arcada Inferior Odontograma"
                      className="w-full h-auto object-contain max-h-9 mx-auto drop-shadow-2xs"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Derecha: Textos y Lista de Verificación */}
            <div className="lg:col-span-6 text-left space-y-6 sm:space-y-8">
              <span className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-[#2563EB] text-xs font-black uppercase tracking-wider">
                MÁS QUE UN SOFTWARE
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
                Centraliza, simplifica y haz crecer tu clínica
              </h2>

              <p className="text-base sm:text-lg xl:text-xl text-slate-600 leading-relaxed font-normal">
                OdontoCloud te permite enfocarte en lo más importante: tus pacientes. Ahorra tiempo, mejora la experiencia en tu clínica y cumple con la normativa colombiana.
              </p>

              {/* Lista con checks circulares azules */}
              <div className="space-y-4 sm:space-y-5 pt-2">
                {[
                  "Todo en la nube, desde cualquier dispositivo",
                  "Cumplimiento con la DIAN (facturación electrónica)",
                  "Mejora la experiencia de tus pacientes",
                  "Soporte en español, siempre que lo necesites"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3.5 sm:gap-4">
                    <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md shadow-blue-500/30">
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
          4. TESTIMONIO DESTACADO (Dra. Carolina Mejía)
          ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-[#F0F6FE] to-white border-y border-blue-100/60">
        <div className="w-full max-w-[1240px] xl:max-w-[1400px] 2xl:max-w-[1550px] mx-auto px-4 sm:px-8">
          <div className="bg-white rounded-3xl sm:rounded-[36px] p-8 sm:p-10 xl:p-12 shadow-xl shadow-blue-900/5 border border-blue-100 flex flex-col md:flex-row items-center gap-8 xl:gap-12 text-left">
            
            {/* Foto de la Doctora */}
            <img
              src={doctorImg}
              alt="Dra. Carolina Mejía"
              className="w-20 h-20 sm:w-24 sm:h-24 xl:w-28 xl:h-28 rounded-full object-cover border-4 border-blue-200 shadow-md shrink-0"
            />

            {/* Cita */}
            <div className="flex-1 space-y-2">
              <p className="text-slate-700 text-sm sm:text-base xl:text-lg leading-relaxed italic font-medium">
                “OdontoCloud ha simplificado la gestión de nuestra clínica. La agenda, la historia clínica y la facturación funcionan de forma perfecta. Nos ha permitido ahorrar tiempo y brindar una mejor experiencia a nuestros pacientes.”
              </p>
            </div>

            {/* Calificación y Autor */}
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
          5. BANNER FINAL CTA (Degradado Azul Veteado con Brillo Aurora)
          ───────────────────────────────────────────────────────────── */}
      <section id="contacto" className="py-16 sm:py-24 bg-white">
        <div className="w-full max-w-[1240px] xl:max-w-[1400px] 2xl:max-w-[1550px] mx-auto px-4 sm:px-8">
          
          {/* Contenedor Azul con Ondas y Destellos */}
          <div className="relative rounded-3xl sm:rounded-[40px] bg-gradient-to-r from-[#031538] via-[#0A2E7A] to-[#1249C7] p-8 sm:p-14 xl:p-16 text-white shadow-2xl shadow-blue-900/40 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 border border-blue-400/30">
            
            {/* Veteado de luces y ondas luminosas de fondo */}
            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-cyan-400/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1)_1px,_transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none" />

            {/* Texto a la izquierda */}
            <div className="flex items-center gap-5 text-left z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-white text-3xl shrink-0 hidden sm:flex shadow-inner">
                <FiCloud />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-white leading-tight drop-shadow-md">
                  ¿Listo para llevar tu clínica al siguiente nivel?
                </h3>
                <p className="text-sm sm:text-base xl:text-lg text-blue-100 font-normal">
                  Descubre cómo OdontoCloud puede transformar tu clínica.
                </p>
              </div>
            </div>

            {/* Botón a la derecha */}
            <div className="z-10 shrink-0">
              <button
                onClick={handleDemo}
                className="px-8 sm:px-9 py-4 sm:py-5 bg-white hover:bg-blue-50 text-[#0A2E7A] rounded-full font-black text-sm sm:text-base xl:text-lg shadow-2xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2.5 group cursor-pointer border-0"
              >
                <span>Solicitar demostración gratuita</span>
                <FiArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Modal de Video / Demostración */}
      {showDocModal && <DocumentationModal onClose={() => setShowDocModal(false)} />}
    </div>
  );
}
