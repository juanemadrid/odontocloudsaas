import React, { useState } from "react";
import FacturaElectronicaModule from "./electronica/FacturaElectronicaModule";
import ReciboCaja from "./recibo/ReciboCaja";
import NotaCredito from "./nota/NotaCredito";
import Liquidaciones from "./liquidacion/Liquidaciones";

const TABS = [
  { id: "electronica", label: "Facturas Electrónicas" },
  { id: "recibos", label: "Recibos de Caja" },
  { id: "notas", label: "Notas de Crédito" },
  { id: "liquidaciones", label: "Liquidaciones" },
];

export default function Facturacion() {
  const [activeTab, setActiveTab] = useState("electronica");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tab bar */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-2 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-5 py-2.5 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all duration-200
              ${activeTab === tab.id
                ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "electronica" && <FacturaElectronicaModule />}
        {activeTab === "recibos" && <ReciboCaja />}
        {activeTab === "notas" && <NotaCredito />}
        {activeTab === "liquidaciones" && <Liquidaciones />}
      </div>
    </div>
  );
}
