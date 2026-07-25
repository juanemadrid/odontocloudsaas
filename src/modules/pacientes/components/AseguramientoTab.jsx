import React from "react";
import { FiShield, FiFileText } from "react-icons/fi";

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

export default function AseguramientoTab({ patient }) {
    return (
        <div className="flex flex-col gap-8 p-4 md:p-10 animate-fadeIn bg-white rounded-[32px] m-4 border border-slate-100 shadow-sm max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                    <FiShield size={20} />
                </div>
                <div>
                     <h4 className="text-[14px] font-black text-slate-700 uppercase tracking-tight">Aseguramiento y Convenios</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Información de pólizas y cobertura médica</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <InfoField label="Nombre de la EPS" value={patient.nombreEps} required />
                <InfoField label="Tipo de Vinculación" value={patient.tipoVinculacion} required />
                <InfoField label="Póliza de Salud" value={patient.polizaSalud} />
                <InfoField label="Convenio / Beneficio" value={patient.convenioBeneficio} />
                <InfoField label="Convenio de Pago" value={patient.convenioPago} />
            </div>

            <div className="mt-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                    <FiFileText className="text-slate-400" />
                    <h5 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Resumen de Contrato</h5>
                </div>
                <p className="text-[12px] font-bold text-slate-500 uppercase leading-relaxed">
                    Este paciente se encuentra vinculado bajo el régimen <span className="text-blue-600">{patient.tipoVinculacion || 'CONTRIBUTIVO'}</span> a través de <span className="text-blue-600">{patient.nombreEps || 'PARTICULAR'}</span>. 
                    {patient.polizaSalud ? ` Cuenta con la póliza #${patient.polizaSalud}.` : ' No registra pólizas adicionales.'}
                </p>
            </div>
        </div>
    );
}
