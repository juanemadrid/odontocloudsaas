import React from "react";
import { FiTrendingUp, FiSearch, FiTarget } from "react-icons/fi";

const InfoField = ({ label, value, required }) => (
    <div className="flex flex-col gap-1.5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/20 transition-colors px-2">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <div className="text-[13px] font-black text-slate-800 uppercase tracking-tight">
            {value || "---"}
        </div>
    </div>
);

export default function MarketingTab({ patient }) {
    return (
        <div className="flex flex-col gap-8 p-4 md:p-10 animate-fadeIn bg-white rounded-[32px] m-4 border border-slate-100 shadow-sm max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
                    <FiTrendingUp size={20} />
                </div>
                <div>
                     <h4 className="text-[14px] font-black text-slate-700 uppercase tracking-tight">Estrategia de Mercadeo</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Origen y captación del paciente</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <InfoField label="Convenio / Beneficio" value={patient.convenioBeneficio} />
                <InfoField label="Convenio de Pago" value={patient.convenioPago} />
                <InfoField label="¿Cómo nos conoció?" value={patient.comoConocio} required />
                <InfoField label="Campaña Relacionada" value={patient.campania} />
                <InfoField label="Remitido por" value={`${patient.remitidoPorType || ''} ${patient.remitidoPorValue || ''}`.trim()} />
                <InfoField label="Asesor comercial" value={`${patient.asesorComercialType || ''} ${patient.asesorComercialValue || ''}`.trim()} />
                <InfoField label="Permite Publicidad" value={patient.permitePublicidad !== false ? "SÍ" : "NO"} />
            </div>

            <div className="mt-6 p-8 bg-indigo-600 rounded-[24px] text-white shadow-xl shadow-indigo-100 flex items-center gap-6 overflow-hidden relative">
                <FiTarget className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/10">
                    <FiSearch size={24} />
                </div>
                <div className="flex-1">
                    <h5 className="text-[14px] font-black uppercase tracking-tight mb-1">Impacto de Captación</h5>
                    <p className="text-[12px] font-bold opacity-80 leading-relaxed uppercase">
                        El paciente ingresó al sistema vía <span className="underline decoration-indigo-300 decoration-2">{patient.comoConocio || 'REFERENCIA DIRECTA'}</span>.
                        {patient.campania ? ` Asociado a la campaña: ${patient.campania}.` : ' No asociado a campañas activas.'}
                        {patient.asesorComercialValue ? ` Asignado al asesor: ${patient.asesorComercialValue}.` : ''}
                    </p>
                </div>
            </div>
        </div>
    );
}
