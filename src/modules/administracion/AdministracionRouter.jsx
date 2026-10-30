import React, { useState, useEffect, useMemo } from "react";
import { 
  FiFileText, FiUsers, FiCalendar, FiBriefcase, 
  FiTrash2, FiActivity, 
  FiShield, FiCheckSquare, FiArrowLeft, FiChevronRight
} from "react-icons/fi";
import { usePermissions } from "../../hooks/usePermissions";

// Sub-views
import FacturacionHub from "./views/FacturacionHub";
import RipsGenerator from "../rips/RipsGenerator";
import GestionAgenda from "./views/GestionAgenda";
import Terceros from "./views/Terceros";
import Convenios from "./views/Convenios";
import ResiduosHub from "../residuos/ResiduosHub";
import Esterilizacion from "../esterilizacion/Esterilizacion";

import AdministrationMenu, { ADMIN_MODULES } from "./AdministrationMenu";

import { useSearchParams } from "react-router-dom";

export default function AdministracionRouter() {
  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");

  const filteredModules = useMemo(() => {
    return ADMIN_MODULES.filter(item => {
      if (item.id === "facturacion") {
        return can("Administración", "Menú Facturación", "consultar") ||
               can("Administración", "Factura de venta", "consultar") ||
               can("Administración", "Recibo de caja", "consultar") ||
               can("Administración", "Liquidaciones", "consultar") ||
               can("Administración", "Saldos a favor", "consultar") ||
               can("Administración", "Pagos a proveedores", "consultar") ||
               can("Administración", "Facturas de compra", "consultar");
      }
      if (item.id === "convenios") return can("Administración", "Convenios", "consultar");
      if (item.id === "agenda") return can("Administración", "Gestion Agenda", "consultar");
      if (item.id === "terceros") return can("Administración", "Terceros", "consultar");
      if (item.id === "residuos") return can("Administración", "Residuos", "consultar");
      if (item.id === "rips") return can("Administración", "Rips", "consultar");
      if (item.id === "esterilizacion") return can("Administración", "Esterilizacion", "consultar");
      return true;
    });
  }, [can]);

  const [selectedModule, setSelectedModuleState] = useState(urlTab || null);

  const setSelectedModule = (mod) => {
    setSelectedModuleState(mod);
    if (mod) {
      sessionStorage.setItem("admin_tab", mod);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set("tab", mod);
        return next;
      });
    } else {
      sessionStorage.removeItem("admin_tab");
      sessionStorage.removeItem("fact_sub");
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete("tab");
        next.delete("sub");
        return next;
      });
    }
  };

  useEffect(() => {
    setSelectedModuleState(urlTab || null);
    if (!urlTab) {
      sessionStorage.removeItem("admin_tab");
      sessionStorage.removeItem("fact_sub");
    } else {
      sessionStorage.setItem("admin_tab", urlTab);
    }
  }, [urlTab]);

  // Escuchar evento de reset desde el menú lateral principal
  useEffect(() => {
    const handleReset = () => {
      setSelectedModule(null);
    };
    window.addEventListener("reset-module-administracion", handleReset);
    return () => window.removeEventListener("reset-module-administracion", handleReset);
  }, []);

  // Si el módulo seleccionado no está en los permitidos, resetear
  useEffect(() => {
    if (selectedModule && !filteredModules.some(m => m.id === selectedModule)) {
      setSelectedModule(null);
    }
  }, [selectedModule, filteredModules]);

  const activeItem = filteredModules.find(m => m.id === selectedModule);

  return (
    <div className="p-0 sm:p-4 max-w-6xl mx-auto space-y-3 sm:space-y-4">
      {/* ─── CASO 1: VISTA DE MÓDULO SELECCIONADO ─── */}
      {selectedModule && activeItem ? (
        <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-200">
          {/* Toolbar Superior de Navegación del Módulo */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedModule(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors border border-slate-200 cursor-pointer"
                title="Volver al menú de administración"
              >
                <FiArrowLeft size={14} />
                <span className="hidden sm:inline">Menú de Administración</span>
                <span className="sm:hidden">Menú</span>
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

          {/* Renderizado de la Sub-Vista (en teléfono sin marco extra, para ganar ancho) */}
          <div className="sm:bg-white sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-sm p-0 sm:p-4 min-h-[600px]">
            {selectedModule === "facturacion" && <FacturacionHub />}
            {selectedModule === "rips" && <RipsGenerator />}
            {selectedModule === "agenda" && <GestionAgenda />}
            {selectedModule === "terceros" && <Terceros />}
            {selectedModule === "convenios" && <Convenios />}
            {selectedModule === "residuos" && <ResiduosHub />}
            {selectedModule === "esterilizacion" && <Esterilizacion />}
          </div>
        </div>
      ) : (
        /* ─── CASO 2: MENÚ PRINCIPAL DE ADMINISTRACIÓN COMPACTO ─── */
        <AdministrationMenu filteredModules={filteredModules} setSelectedModule={setSelectedModule} />
      )}
    </div>
  );
}
