import React from "react";
import { FiFileText, FiUsers, FiCalendar, FiBriefcase, FiTrash2, FiActivity, FiShield, FiCheckSquare, FiChevronRight } from "react-icons/fi";
export const ADMIN_MODULES = [
  { id: "facturacion", label: "Facturación", desc: "Facturas y notas crédito", icon: FiFileText, color: "bg-blue-50 text-blue-600" },
  { id: "convenios", label: "Convenios", desc: "Descuentos y listas", icon: FiCheckSquare, color: "bg-emerald-50 text-emerald-600" },
  { id: "agenda", label: "Gestión Agenda", desc: "Turnos y horarios", icon: FiCalendar, color: "bg-indigo-50 text-indigo-600" },
  { id: "terceros", label: "Terceros", desc: "Proveedores y clientes", icon: FiUsers, color: "bg-purple-50 text-purple-600" },
  { id: "residuos", label: "Residuos Hosp.", desc: "Gestión ambiental", icon: FiTrash2, color: "bg-rose-50 text-rose-600" },
  { id: "rips", label: "RIPS JSON", desc: "Archivos Res. 2275", icon: FiActivity, color: "bg-teal-50 text-teal-600" },
  { id: "esterilizacion", label: "Esterilización", desc: "Cargas de autoclaves", icon: FiShield, color: "bg-violet-50 text-violet-600" },
];
export default function AdministrationMenu({filteredModules = ADMIN_MODULES, setSelectedModule = () => {}}) { return (
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
              {filteredModules.length} Submódulos
            </span>
          </div>

          {/* Grid Compacto de 4 Columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filteredModules.map((item) => {
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
); }
