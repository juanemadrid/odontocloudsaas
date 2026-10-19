import React, { useState } from "react";
import {
  FiArrowRight, FiPlay, FiCalendar, FiFileText, FiBell, FiCloud
} from "react-icons/fi";
import DocumentationModal from "../../components/landing/DocumentationModal";
import "./master-hero.css";
import ProductDemo from "./ProductDemo";

export default function OdontoCloudMasterLanding({ config = {}, onShowTrial }) {
  const [showDocModal, setShowDocModal] = useState(false);

  const phone = (config.contactPhone || "3015768935").replace(/\D/g, "");
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
        className="master-hero relative w-full min-h-[calc(100vh-5rem)] lg:min-h-screen flex items-center pt-28 sm:pt-32 lg:pt-24 xl:pt-28 pb-10 sm:pb-14 overflow-hidden bg-gradient-to-b from-[#E6F0FD] via-[#EEF5FE] to-[#F5F8FE]"
      >
        {/* Fondo fotográfico y resplandores azulados médicos */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src={clinicHeroBg}
            alt="Clínica OdontoCloud"
            className="w-full h-full object-cover object-right opacity-[0.18] mix-blend-multiply"
          />
          <div className="absolute -top-32 right-10 w-[700px] 2xl:w-[900px] h-[650px] 2xl:h-[800px] bg-gradient-to-br from-blue-500/25 via-sky-400/20 to-blue-600/15 rounded-full blur-[140px]" />
          <div className="absolute top-20 left-0 w-[600px] 2xl:w-[800px] h-[600px] bg-gradient-to-tr from-cyan-400/20 via-blue-500/15 to-transparent rounded-full blur-[130px]" />
          <div className="absolute bottom-0 right-1/4 w-[750px] h-[350px] bg-blue-600/15 rounded-full blur-[120px]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#F5F9FF]/95 via-[#F3F8FF]/85 to-white/30" />
        </div>

        <div className="master-hero__container w-full max-w-[1680px] 2xl:max-w-[2100px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative z-10 py-3 lg:py-6 2xl:py-8">
          <div className="master-hero__grid grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-12 2xl:gap-16 items-center">
            
            {/* COLUMNA IZQUIERDA: Titular, Beneficios y CTAs */}
            <div className="master-hero__copy lg:col-span-5 text-left space-y-3 lg:space-y-4 xl:space-y-5 2xl:space-y-6">
              
              {/* Badge Azul Superior (Con espacio garantizado debajo del header) */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/25 text-[#2563EB] text-xs 2xl:text-sm font-black tracking-wide shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
                <span>Software Odontológico en la Nube</span>
              </div>

              <h1 className="master-hero__title text-3xl sm:text-4xl md:text-5xl lg:text-[34px] xl:text-[44px] 2xl:text-[58px] font-sans font-black text-slate-900 tracking-tight leading-[1.14]">
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

            {/* Pantallas reales con datos locales de ejemplo. */}
            <div className="master-hero__devices relative w-full min-w-0">
              <div className="relative bg-gradient-to-b from-slate-200 to-slate-400 rounded-[24px] p-2.5 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.3)] border border-slate-300">
                <div className="bg-slate-950 rounded-[18px] p-2 pt-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mx-auto mb-2" />
                  <div className="rounded-lg overflow-hidden"><ProductDemo /></div>
                </div>
                <div className="w-28 h-1 bg-slate-400 rounded-b-md mx-auto" />
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
