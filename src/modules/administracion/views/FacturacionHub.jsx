import React, { useState } from "react";
import { 
  FiFileText, FiPlusCircle, FiMinusCircle, FiDollarSign, 
  FiRepeat, FiTruck, FiShoppingBag, FiLayers, FiCreditCard, FiArrowRight, FiChevronRight, FiPlus
} from "react-icons/fi";
import FinancialDashboard from "../../financiero/components/FinancialDashboard";
import ReciboCajaList from "../../facturacion/recibo/ReciboCajaList";
import ReciboCajaForm from "../../facturacion/recibo/ReciboCajaForm";
import SaldoFavorList from "../../facturacion/saldo/SaldoFavorList";
import SaldoFavorForm from "../../facturacion/saldo/SaldoFavorForm";
import NotaCreditoList from "../../facturacion/nota/NotaCreditoList";
import NotaCreditoForm from "../../facturacion/nota/NotaCreditoForm";
import NotaDebitoList from "../../facturacion/nota/NotaDebitoList";
import NotaDebitoForm from "../../facturacion/nota/NotaDebitoForm";
import Liquidaciones from "../../facturacion/liquidacion/Liquidaciones";
import TrasladosList from "../../facturacion/traslados/TrasladosList";
import PagosList from "../../facturacion/pagos/PagosList";
import OrdenesCompraList from "../../facturacion/ordenescompra/OrdenesCompraList";
import FacturasCompraList from "../../facturacion/facturascompra/FacturasCompraList";

const FACT_OPTIONS = [
  { id: "recibo",  label: "Recibo de caja",      icon: <FiFileText />,    color: "text-emerald-600", bg: "bg-emerald-50",   desc: "Comprobantes de ingreso de dinero" },
  { id: "saldo",   label: "Saldo a favor",        icon: <FiDollarSign />,  color: "text-teal-600",    bg: "bg-teal-50",      desc: "Gestión y abonos de saldos a favor" },
  { id: "nc",      label: "Nota crédito",         icon: <FiMinusCircle />, color: "text-rose-600",    bg: "bg-rose-50",      desc: "Anulaciones y descuentos" },
  { id: "nd",      label: "Nota débito",          icon: <FiPlusCircle />,  color: "text-orange-600",  bg: "bg-orange-50",    desc: "Incrementos de deuda" },
  { id: "liq",     label: "Liquidaciones",        icon: <FiLayers />,      color: "text-purple-600",  bg: "bg-purple-50",    desc: "Cierre de tratamientos y presupuestos" },
  { id: "tras",    label: "Traslados",            icon: <FiRepeat />,      color: "text-slate-600",   bg: "bg-slate-50",     desc: "Movimiento entre cuentas" },
  { id: "pagos",   label: "Pagos",                icon: <FiCreditCard />,  color: "text-indigo-600",  bg: "bg-indigo-50",    desc: "Gestión de egresos y proveedores" },
  { id: "oc",      label: "Ordenes de compra",    icon: <FiShoppingBag />, color: "text-cyan-600",    bg: "bg-cyan-50",      desc: "Solicitudes de insumos" },
  { id: "fv",      label: "Factura de venta",     icon: <FiDollarSign />,  color: "text-emerald-700", bg: "bg-emerald-100",  desc: "Facturación principal de servicios" },
  { id: "fc",      label: "Facturas de compra",   icon: <FiTruck />,       color: "text-amber-600",   bg: "bg-amber-50",     desc: "Registro de facturas recibidas" },
];

// Sub-views that have a "+Nuevo" button
const NEW_BUTTON_LABELS = {
  recibo:  "Nuevo Recibo de Caja",
  saldo:   "Nuevo Saldo a Favor",
  nc:      "Nueva Nota Crédito",
  nd:      "Nueva Nota Débito",
  tras:    "Nuevo Traslado",
  pagos:   "Nuevo Pago",
  oc:      "Nueva Orden de Compra",
  fc:      "Nueva Factura de Compra",
};

export default function FacturacionHub() {
  const [activeSubView, setActiveSubView] = useState(null);

  // ─── RENDERING SUB-VIEWS ───
  if (activeSubView) {
    let content = null;
    let title = "";

    if (activeSubView === "fv") {
      content = <FinancialDashboard />;
      title = "Facturación de Venta";
    } else if (activeSubView === "recibo") {
      content = <ReciboCajaList onNew={() => setActiveSubView("recibo_form")} />;
      title = "Recibo de Caja";
    } else if (activeSubView === "recibo_form") {
      content = <ReciboCajaForm onCancel={() => setActiveSubView("recibo")} onSuccess={() => setActiveSubView("recibo")} />;
      title = "Nuevo Recibo de Caja";
    } else if (activeSubView === "saldo") {
      content = <SaldoFavorList onNew={() => setActiveSubView("saldo_form")} />;
      title = "Saldo a Favor";
    } else if (activeSubView === "saldo_form") {
      content = <SaldoFavorForm onCancel={() => setActiveSubView("saldo")} onSuccess={() => setActiveSubView("saldo")} />;
      title = "Nuevo Saldo a Favor";
    } else if (activeSubView === "nc") {
      content = <NotaCreditoList onNew={() => setActiveSubView("nc_form")} />;
      title = "Nota de Crédito";
    } else if (activeSubView === "nc_form") {
      content = <NotaCreditoForm onCancel={() => setActiveSubView("nc")} onSuccess={() => setActiveSubView("nc")} />;
      title = "Nueva Nota de Crédito";
    } else if (activeSubView === "nd") {
      content = <NotaDebitoList onNew={() => setActiveSubView("nd_form")} />;
      title = "Nota de Débito";
    } else if (activeSubView === "nd_form") {
      content = <NotaDebitoForm onCancel={() => setActiveSubView("nd")} onSuccess={() => setActiveSubView("nd")} />;
      title = "Nueva Nota de Débito";
    } else if (activeSubView === "liq") {
      content = <Liquidaciones onBack={() => setActiveSubView(null)} />;
      title = "Liquidación de Comisiones";
    } else if (activeSubView === "tras") {
      content = <TrasladosList onNew={() => setActiveSubView("tras_form")} />;
      title = "Traslados";
    } else if (activeSubView === "pagos") {
      content = <PagosList onNew={() => setActiveSubView("pagos_form")} />;
      title = "Pagos a Proveedores";
    } else if (activeSubView === "oc") {
      content = <OrdenesCompraList onNew={() => setActiveSubView("oc_form")} />;
      title = "Órdenes de Compra";
    } else if (activeSubView === "fc") {
      content = <FacturasCompraList onNew={() => setActiveSubView("fc_form")} />;
      title = "Facturas de Compra";
    }

    // For form sub-views that are not yet built, show a coming-soon state
    const formViews = ["tras_form", "pagos_form", "oc_form", "fc_form"];
    if (!content && formViews.includes(activeSubView)) {
      const parentKey = activeSubView.replace("_form", "");
      const opt = FACT_OPTIONS.find(o => o.id === parentKey);
      content = (
        <div className="flex flex-col items-center justify-center h-80 gap-4">
          <div className={`w-16 h-16 rounded-2xl ${opt?.bg} ${opt?.color} flex items-center justify-center text-2xl`}>
            {opt?.icon}
          </div>
          <h3 className="text-base font-black text-slate-800 uppercase">Formulario en construcción</h3>
          <p className="text-sm text-slate-400 font-medium text-center max-w-xs">
            El formulario de registro de {opt?.label} estará disponible próximamente.
          </p>
          <button
            onClick={() => setActiveSubView(parentKey)}
            className="mt-2 h-10 px-6 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-all"
          >
            Volver al listado
          </button>
        </div>
      );
      title = `Nuevo – ${opt?.label || ""}`;
    }

    if (content) {
      // Determine the "parent" list key for back-navigation from form views
      const parentOfForm = activeSubView.endsWith("_form")
        ? activeSubView.replace("_form", "")
        : null;

      return (
        <div className="h-full flex flex-col animate-slideUp">
          {/* Sub-view Toolbar */}
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if (parentOfForm) setActiveSubView(parentOfForm);
                  else setActiveSubView(null);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                title="Volver"
              >
                <FiArrowRight className="rotate-180" size={14} />
                <span>Volver</span>
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Módulo de Facturación</span>
                <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">{title}</h2>
              </div>
            </div>

            {/* Header Action Buttons – only for list views */}
            {NEW_BUTTON_LABELS[activeSubView] && (
              <button 
                onClick={() => setActiveSubView(`${activeSubView}_form`)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0"
              >
                <FiPlus size={15} />
                <span>{NEW_BUTTON_LABELS[activeSubView]}</span>
              </button>
            )}
          </div>

          <div key={activeSubView} className="flex-1 overflow-y-auto bg-slate-50/30">
            {content}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* Header Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FiFileText size={16} />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-slate-800 tracking-tight uppercase">Centro de Facturación</h2>
            <p className="text-[11px] text-slate-500 font-medium">Seleccione el tipo de documento contable que desea gestionar</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
          {FACT_OPTIONS.length} Opciones
        </span>
      </div>

      {/* Grid Compacto Slender Pro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {FACT_OPTIONS.map((opt) => (
          <div
            key={opt.id}
            onClick={() => setActiveSubView(opt.id)}
            className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:shadow-sm hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between group gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg ${opt.bg} ${opt.color} flex items-center justify-center text-sm font-bold shrink-0 transition-transform group-hover:scale-105`}>
                {opt.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-[12px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors uppercase truncate">
                  {opt.label}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium truncate block">
                  {opt.desc}
                </span>
              </div>
            </div>
            <FiChevronRight className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" size={15} />
          </div>
        ))}
      </div>
    </div>
  );
}
