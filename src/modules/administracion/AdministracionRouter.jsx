import React, { useState, useEffect } from "react";
import { 
  FiFileText, FiUsers, FiCalendar, FiBriefcase, 
  FiThermometer, FiTrash2, FiBox, FiActivity, 
  FiPlusSquare, FiShield, FiCheckSquare, FiPieChart, FiArrowLeft, FiChevronRight
} from "react-icons/fi";

// Sub-views
import FacturacionHub from "./views/FacturacionHub";
import Inventario from "../inventario/Inventario";
import RipsGenerator from "../rips/RipsGenerator";
import GestionAgenda from "./views/GestionAgenda";
import Terceros from "./views/Terceros";
import Convenios from "./views/Convenios";
import Campanas from "./views/Campanas";
import TemperaturaHumedad from "./views/TemperaturaHumedad";
import MedicamentosHub from "../medicamentos/MedicamentosHub";
import ResiduosHub from "../residuos/ResiduosHub";
import Esterilizacion from "../esterilizacion/Esterilizacion";

const ADMIN_MODULES = [
  { id: "facturacion", label: "Facturación", desc: "Facturas y notas crédito", icon: FiFileText, color: "bg-blue-50 text-blue-600" },
  { id: "convenios", label: "Convenios", desc: "Descuentos y listas", icon: FiCheckSquare, color: "bg-emerald-50 text-emerald-600" },
  { id: "agenda", label: "Gestión Agenda", desc: "Turnos y horarios", icon: FiCalendar, color: "bg-indigo-50 text-indigo-600" },
  { id: "terceros", label: "Terceros", desc: "Proveedores y clientes", icon: FiUsers, color: "bg-purple-50 text-purple-600" },
  { id: "campanas", label: "Campañas", desc: "Estrategias comerciales", icon: FiPieChart, color: "bg-amber-50 text-amber-600" },
  { id: "temp", label: "Temp. y Humedad", desc: "Cadena de frío", icon: FiThermometer, color: "bg-cyan-50 text-cyan-600" },
  { id: "residuos", label: "Residuos Hosp.", desc: "Gestión ambiental", icon: FiTrash2, color: "bg-rose-50 text-rose-600" },
  { id: "inventario", label: "Inventario", desc: "Control de insumos", icon: FiBox, color: "bg-slate-900 text-white" },
  { id: "rips", label: "RIPS JSON", desc: "Archivos Res. 2275", icon: FiActivity, color: "bg-teal-50 text-teal-600" },
  { id: "medicamentos", label: "Medicamentos", desc: "Recetas y vademécum", icon: FiPlusSquare, color: "bg-sky-50 text-sky-600" },
  { id: "esterilizacion", label: "Esterilización", desc: "Cargas de autoclaves", icon: FiShield, color: "bg-violet-50 text-violet-600" },
];

export default function AdministracionRouter() {
  const [selectedModule, setSelectedModule] = useState(null);

  // Escuchar evento de reset desde el menú lateral principal
  useEffect(() => {
    const handleReset = () => {
      setSelectedModule(null);
    };
    window.addEventListener("reset-module-administracion", handleReset);
    return () => window.removeEventListener("reset-module-administracion", handleReset);
  }, []);

  const activeItem = ADMIN_MODULES.find(m => m.id === selectedModule);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* ─── CASO 1: VISTA DE MÓDULO SELECCIONADO ─── */}
      {selectedModule ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Toolbar Superior de Navegación del Módulo */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedModule(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors border border-slate-200 cursor-pointer"
                title="Volver al menú de administración"
              >
                <FiArrowLeft size={14} />
                <span>Menú de Administración</span>
              </button>

              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center gap-2">
                {activeItem && (
                  <div className={`w-7 h-7 rounded-lg ${activeItem.color} flex items-center justify-center font-bold`}>
                    <activeItem.icon size={15} />
                  </div>
                )}
                <h1 className="text-[14px] font-bold text-slate-800 tracking-tight uppercase">
                  {activeItem?.label}
                </h1>
              </div>
            </div>
          </div>

          {/* Renderizado de la Sub-Vista */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-h-[600px]">
            {selectedModule === "facturacion" && <FacturacionHub />}
            {selectedModule === "inventario" && <Inventario />}
            {selectedModule === "rips" && <RipsGenerator />}
            {selectedModule === "agenda" && <GestionAgenda />}
            {selectedModule === "terceros" && <Terceros />}
            {selectedModule === "convenios" && <Convenios />}
            {selectedModule === "campanas" && <Campanas />}
            {selectedModule === "temp" && <TemperaturaHumedad />}
            {selectedModule === "medicamentos" && <MedicamentosHub />}
            {selectedModule === "residuos" && <ResiduosHub />}
            {selectedModule === "esterilizacion" && <Esterilizacion />}
          </div>
        </div>
      ) : (
        /* ─── CASO 2: MENÚ PRINCIPAL DE ADMINISTRACIÓN COMPACTO ─── */
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Header Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FiBriefcase size={16} />
              </div>
              <div>
                <h1 className="text-[14px] font-bold text-slate-800 tracking-tight">Módulos de Administración</h1>
                <p className="text-[11px] text-slate-500 font-medium">Seleccione el área operativa que desea gestionar</p>
              </div>
            </div>

            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              11 Submódulos
            </span>
          </div>

          {/* Grid Compacto de 4 Columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {ADMIN_MODULES.map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedModule(item.id)}
                  className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:shadow-sm hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between group gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center font-bold shrink-0 transition-transform group-hover:scale-105`}>
                      <IconComp size={16} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-[12px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors uppercase truncate">
                        {item.label}
                      </h2>
                      <span className="text-[10px] text-slate-400 font-medium truncate block">
                        {item.desc}
                      </span>
                    </div>
                  </div>

                  <FiChevronRight className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" size={15} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
