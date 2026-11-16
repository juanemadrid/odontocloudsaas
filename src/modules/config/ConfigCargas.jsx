import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiUpload, FiInfo, FiDatabase, FiUsers, FiActivity, FiArrowRight } from "react-icons/fi";
import ImportadorPacientes from "../pacientes/components/ImportadorPacientes";

// Cargas masivas: cada carga usa el importador que realmente alimenta el sistema.
//   - Pacientes: el importador completo del módulo Pacientes (historia, celular, demografía, evita duplicados).
//   - Procedimientos y precios: el «Importar Excel» de Configuración → Lista de precios.
// La carga de productos se habilitará cuando el inventario esté listo.

export default function ConfigCargas() {
    const navigate = useNavigate();
    const [showPacientes, setShowPacientes] = useState(false);

    const cards = [
        {
            id: "pacientes",
            label: "Pacientes",
            description: "Migración masiva de pacientes desde Excel: identificación, nombres, historia, celular, correo y demografía. Descarga la plantilla dentro del importador.",
            icon: FiUsers,
            action: "Abrir importador",
            onClick: () => setShowPacientes(true),
            actionIcon: FiUpload,
        },
        {
            id: "precios",
            label: "Procedimientos y precios",
            description: "Los procedimientos y sus precios se cargan en cada lista de precios, con el botón «Importar Excel».",
            icon: FiActivity,
            action: "Ir a Lista de precios",
            onClick: () => navigate("/dashboard_admin/config/listas-precios"),
            actionIcon: FiArrowRight,
        },
    ];

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiDatabase size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Cargas Masivas de Datos</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Importación masiva de pacientes y de procedimientos con sus precios</p>
                    </div>
                </div>
            </div>

            {/* Import Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cards.map((item) => {
                    const IconComponent = item.icon;
                    const ActionIcon = item.actionIcon;
                    return (
                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
                            <div className="space-y-2">
                                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <IconComponent size={18} />
                                </div>
                                <h3 className="text-[14px] font-bold text-slate-800">{item.label}</h3>
                                <p className="text-[11px] text-slate-500 leading-relaxed">{item.description}</p>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={item.onClick}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-[11px] font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-0"
                                >
                                    <ActionIcon size={13} />
                                    <span>{item.action}</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Guide Footer */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    <FiInfo size={15} />
                </div>
                <div className="space-y-1 text-[11px] text-slate-600">
                    <span className="font-bold text-slate-800 block">Recomendaciones para el cargue masivo:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                        <li>Usa la plantilla de Excel (.xlsx) de cada importador.</li>
                        <li>Verifica que las columnas no tengan celdas combinadas ni fórmulas.</li>
                        <li>Los documentos de identidad deben ser únicos: el importador no duplica pacientes que ya existen.</li>
                    </ul>
                </div>
            </div>

            {showPacientes && (
                <ImportadorPacientes
                    onComplete={() => {}}
                    onClose={() => setShowPacientes(false)}
                />
            )}
        </div>
    );
}
