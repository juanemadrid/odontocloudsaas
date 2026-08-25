// src/modules/facturacion/facturascompra/FacturasCompraList.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
    FiPlus, FiSearch, FiCalendar, FiPrinter, FiEye, FiTrash2, 
    FiMoreVertical, FiHome, FiInfo, FiCheckSquare, FiSquare, 
    FiX, FiDollarSign, FiCheck, FiFileText
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function FacturasCompraList({ onNew }) {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";

  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Rango de fechas por defecto
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date(); 
    d.setDate(1); // Primer día del mes actual
    return d.toISOString().split("T")[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split("T")[0]);

  // Selección de facturas con checkbox
  const [selectedFacturaId, setSelectedFacturaId] = useState(null);

  // Modal Asociar Egreso
  const [showAsociarModal, setShowAsociarModal] = useState(false);
  const [facturaToAsociar, setFacturaToAsociar] = useState(null);
  const [valorAPagar, setValorAPagar] = useState("");
  const [selectedEgresoId, setSelectedEgresoId] = useState("");
  const [disponibleEgreso, setDisponibleEgreso] = useState(0);
  const [egresosList, setEgresosList] = useState([]);
  const [savingEgreso, setSavingEgreso] = useState(false);

  // Modal Ver Detalle Factura
  const [viewingFactura, setViewingFactura] = useState(null);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const parseLocalDate = (s) => { 
    if (!s) return new Date();
    const [y, m, d] = s.split("-").map(Number); 
    return new Date(y, m - 1, d); 
  };

  const loadData = useCallback(async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      let list = [];
      try {
        const { data } = await supabase
          .from("facturas_compra")
          .select("*")
          .eq("tenant_id", inquilino);
        if (data && data.length > 0) list = data;
      } catch (e) {}

      if (list.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        list = cfgRow?.config?.facturas_compra || [];
      }

      // Cargar egresos/pagos para el modal de asociación
      try {
        const { data: pDb } = await supabase
          .from("pagos_proveedor")
          .select("*")
          .eq("tenant_id", inquilino);
        if (pDb && pDb.length > 0) {
          setEgresosList(pDb);
        }
      } catch (e) {}

      const start = parseLocalDate(fechaInicio); 
      start.setHours(0, 0, 0, 0);
      const end = parseLocalDate(fechaFin); 
      end.setHours(23, 59, 59, 999);

      const filteredByDate = (list || [])
        .filter(f => {
          if (!f.fecha && !f.created_at) return true;
          const ts = new Date(f.fecha || f.created_at).getTime();
          return ts >= start.getTime() && ts <= end.getTime();
        })
        .sort((a, b) => new Date(b.fecha || b.created_at || 0).getTime() - new Date(a.fecha || a.created_at || 0).getTime());

      setFacturas(filteredByDate);
    } catch (e) {
      console.error("Error loading facturas compra:", e);
    } finally {
      setLoading(false);
    }
  }, [inquilino, fechaInicio, fechaFin]);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  // Filtrar facturas por término de búsqueda
  const filteredFacturas = useMemo(() => {
    return facturas.filter(f => {
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      const prov = (f.proveedor || f.tercero || "").toLowerCase();
      const doc = (f.nroFactura || f.documentoNumero || f.id || "").toLowerCase();
      const tipo = (f.tipoDoc || f.tipoDocumento || "").toLowerCase();
      const medio = (f.medioPago || "").toLowerCase();
      return prov.includes(q) || doc.includes(q) || tipo.includes(q) || medio.includes(q);
    });
  }, [facturas, searchTerm]);

  // Paginación
  const totalPages = Math.ceil(filteredFacturas.length / itemsPerPage) || 1;
  const paginatedFacturas = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredFacturas.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredFacturas, currentPage]);

  // Cálculo de días restantes para vencimiento
  const calcularVencimiento = (factura) => {
    if (!factura.fecha) return 0;
    const cond = factura.condicionPago || "";
    let diasPlazo = 0;
    if (cond.includes("8")) diasPlazo = 8;
    else if (cond.includes("15")) diasPlazo = 15;
    else if (cond.includes("30")) diasPlazo = 30;
    else if (cond.includes("45")) diasPlazo = 45;
    else if (cond.includes("60")) diasPlazo = 60;
    else if (cond.includes("90")) diasPlazo = 90;

    const fechaFac = new Date(factura.fecha);
    const fechaVence = new Date(fechaFac);
    fechaVence.setDate(fechaVence.getDate() + diasPlazo);
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaVence.setHours(0, 0, 0, 0);

    const diffTime = fechaVence.getTime() - hoy.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Manejar apertura de Modal Asociar Egreso
  const handleOpenAsociarModal = () => {
    if (!selectedFacturaId) {
      toast.error("Solo debe seleccionar una factura para asociar el egreso");
      return;
    }
    const targetFactura = facturas.find(f => f.id === selectedFacturaId);
    if (!targetFactura) {
      toast.error("Seleccione una factura válida");
      return;
    }

    const pendiente = targetFactura.saldoPendiente !== undefined 
      ? targetFactura.saldoPendiente 
      : (targetFactura.totalNeto || targetFactura.total || 0);

    setFacturaToAsociar(targetFactura);
    setValorAPagar(String(pendiente));
    setSelectedEgresoId("");
    setDisponibleEgreso(0);
    setShowAsociarModal(true);
  };

  // Manejar cambio en el selector de egresos
  const handleEgresoSelectChange = (egresoId) => {
    setSelectedEgresoId(egresoId);
    const egresoObj = egresosList.find(e => String(e.id) === String(egresoId));
    if (egresoObj) {
      const disp = egresoObj.monto || egresoObj.total || 0;
      setDisponibleEgreso(disp);
    } else {
      setDisponibleEgreso(0);
    }
  };

  // Guardar Asociación de Egreso
  const handleSaveAsociacion = async () => {
    if (!selectedEgresoId) {
      toast.error("Seleccione un egreso para asociar");
      return;
    }
    const pagoNum = parseFloat(valorAPagar) || 0;
    if (pagoNum <= 0) {
      toast.error("El valor a pagar debe ser mayor a 0");
      return;
    }

    setSavingEgreso(true);
    try {
      const selectedEgreso = egresosList.find(e => String(e.id) === String(selectedEgresoId));
      const currentPendiente = facturaToAsociar.saldoPendiente !== undefined 
        ? facturaToAsociar.saldoPendiente 
        : (facturaToAsociar.totalNeto || facturaToAsociar.total || 0);
      
      const nuevoSaldo = Math.max(0, currentPendiente - pagoNum);
      const nuevoEstado = nuevoSaldo === 0 ? "Pagada" : "Parcial";

      const updatedFactura = {
        ...facturaToAsociar,
        saldoPendiente: nuevoSaldo,
        estado: nuevoEstado,
        egresoAsociadoId: selectedEgresoId,
        egresoAsociadoDoc: selectedEgreso?.nroPago || selectedEgreso?.id,
        valorPagado: (facturaToAsociar.valorPagado || 0) + pagoNum
      };

      // 1. Actualizar en Supabase
      try {
        await supabase
          .from("facturas_compra")
          .update({
            saldoPendiente: nuevoSaldo,
            estado: nuevoEstado,
            egresoAsociadoId: selectedEgresoId
          })
          .eq("id", facturaToAsociar.id);
      } catch (e) {}

      // 2. Sincronizar en website_config
      try {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();

        const currentCfg = cfgRow?.config || {};
        const currentFacturas = currentCfg.facturas_compra || [];
        const nextFacturas = currentFacturas.map(f => f.id === facturaToAsociar.id ? updatedFactura : f);
        currentCfg.facturas_compra = nextFacturas;

        await supabase
          .from("website_config")
          .upsert({ tenant_id: inquilino, config: currentCfg });
      } catch (e) {}

      // Actualizar estado local
      setFacturas(prev => prev.map(f => f.id === facturaToAsociar.id ? updatedFactura : f));
      toast.success("Egreso asociado correctamente ✅");
      setShowAsociarModal(false);
      setSelectedFacturaId(null);
    } catch (err) {
      console.error("Error asociando egreso:", err);
      toast.error("Error al asociar el egreso");
    } finally {
      setSavingEgreso(false);
    }
  };

  // Eliminar Factura
  const handleDeleteFactura = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar esta factura de compra?")) return;
    try {
      try {
        await supabase.from("facturas_compra").delete().eq("id", id);
      } catch (e) {}

      try {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();

        const currentCfg = cfgRow?.config || {};
        currentCfg.facturas_compra = (currentCfg.facturas_compra || []).filter(f => f.id !== id);

        await supabase
          .from("website_config")
          .upsert({ tenant_id: inquilino, config: currentCfg });
      } catch (e) {}

      setFacturas(prev => prev.filter(f => f.id !== id));
      if (selectedFacturaId === id) setSelectedFacturaId(null);
      toast.success("Factura de compra eliminada");
    } catch (err) {
      console.error("Error deleting factura:", err);
      toast.error("Error al eliminar la factura");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-fadeIn font-sans text-slate-700">
      
      {/* Header & Breadcrumb OralDrive */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Facturas de compra</h1>
            <span title="Módulo de Facturas de Compra y Documentos Soporte" className="text-slate-400 cursor-help">
              <FiInfo size={14} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <FiHome className="text-slate-400" size={13} />
            <span>Facturación</span>
            <span>›</span>
            <span className="text-slate-700 font-semibold">Facturas de compra</span>
          </div>
        </div>

        {onNew && (
          <button
            onClick={onNew}
            className="px-6 py-2.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95 cursor-pointer self-start md:self-auto"
          >
            <FiPlus size={16} /> + Nueva factura compra
          </button>
        )}
      </div>

      {/* Card 1: Filtros de Fecha y Búsqueda */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium text-slate-600 ml-0.5">Fecha Inicial</label>
            <div className="relative">
              <input 
                type="date" 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={fechaInicio} 
                onChange={e => setFechaInicio(e.target.value)} 
              />
            </div>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium text-slate-600 ml-0.5">Fecha Final</label>
            <div className="relative">
              <input 
                type="date" 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={fechaFin} 
                onChange={e => setFechaFin(e.target.value)} 
              />
            </div>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <button 
              onClick={loadData} 
              className="h-10 px-8 flex items-center justify-center gap-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              Buscar
            </button>
          </div>

        </div>
      </div>

      {/* Barra de Acciones de Tabla & Botón Asociar Egreso */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAsociarModal}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
              selectedFacturaId 
                ? "bg-[#8dc63f] hover:bg-[#7cb035] text-white active:scale-95" 
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            + Asociar egreso
          </button>
          <span className="text-xs text-slate-400 italic hidden md:inline">
            Arrastre una columna aquí para agrupar por ella
          </span>
        </div>

        {/* Buscador Rápido de Tabla */}
        <div className="relative w-full md:w-72">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Buscar en tabla..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:border-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Card 2: Tabla de Facturas de Compra */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <span className="sr-only">Seleccionar</span>
                </th>
                <th className="py-3 px-4">Doc.</th>
                <th className="py-3 px-4">Tipo doc.</th>
                <th className="py-3 px-4">Rec./Ter.</th>
                <th className="py-3 px-4">Medio de pago</th>
                <th className="py-3 px-4">Referencia</th>
                <th className="py-3 px-4 text-center">Vence en</th>
                <th className="py-3 px-4 text-right">T. Doc.</th>
                <th className="py-3 px-4 text-center w-16">...</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#8dc63f] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold text-slate-400">Cargando facturas de compra...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedFacturas.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-slate-400 italic">
                    No se encontraron facturas de compra registradas en el rango de fechas seleccionado.
                  </td>
                </tr>
              ) : (
                paginatedFacturas.map(f => {
                  const diasVence = calcularVencimiento(f);
                  const isSelected = selectedFacturaId === f.id;
                  const totalDoc = f.totalNeto !== undefined ? f.totalNeto : (f.total || f.subtotal || 0);

                  return (
                    <tr 
                      key={f.id} 
                      onClick={() => setSelectedFacturaId(isSelected ? null : f.id)}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                        isSelected ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      {/* Checkbox de Selección */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedFacturaId(isSelected ? null : f.id)}
                          className="text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {isSelected ? (
                            <FiCheckSquare className="text-[#8dc63f]" size={16} />
                          ) : (
                            <FiSquare size={16} />
                          )}
                        </button>
                      </td>

                      {/* Doc. */}
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {f.nroFactura || f.documentoNumero || f.id?.slice(0, 10) || "—"}
                      </td>

                      {/* Tipo doc. */}
                      <td className="py-3 px-4 text-slate-600">
                        {f.tipoDoc || f.tipoDocumento || (f.docSoporteDian ? "Documento soporte" : "Factura de compra")}
                      </td>

                      {/* Rec./Ter. */}
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {f.proveedor || f.tercero || "—"}
                      </td>

                      {/* Medio de pago */}
                      <td className="py-3 px-4 text-slate-600">
                        {f.medioPago || "Efectivo"}
                      </td>

                      {/* Referencia */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {f.referencia || f.prefijo || "—"}
                      </td>

                      {/* Vence en */}
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                          diasVence < 0 
                            ? "bg-rose-50 text-rose-600" 
                            : diasVence === 0 
                              ? "bg-amber-50 text-amber-600" 
                              : "bg-emerald-50 text-emerald-600"
                        }`}>
                          {diasVence}
                        </span>
                      </td>

                      {/* T. Doc. */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {fmt(totalDoc)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingFactura(f)}
                            className="w-7 h-7 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
                            title="Ver detalle"
                          >
                            <FiEye size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteFactura(f.id)}
                            className="w-7 h-7 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                            title="Eliminar"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginador OralDrive */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
          <span>Mostrando {paginatedFacturas.length} de {filteredFacturas.length} facturas</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                  currentPage === p
                    ? "bg-[#8dc63f] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ASOCIAR EGRESO                                     */}
      {/* ========================================================= */}
      {showAsociarModal && facturaToAsociar && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Egreso a asociar</h3>
              <button
                onClick={() => setShowAsociarModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Pendiente factura */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <label className="col-span-4 text-right font-medium text-slate-600">
                  Pendiente factura
                </label>
                <div className="col-span-8">
                  <input
                    type="text"
                    readOnly
                    value={fmt(facturaToAsociar.saldoPendiente !== undefined ? facturaToAsociar.saldoPendiente : (facturaToAsociar.totalNeto || facturaToAsociar.total || 0))}
                    className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 font-bold select-none cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              {/* Valor a pagar * */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <label className="col-span-4 text-right font-medium text-slate-600">
                  Valor a pagar <span className="text-rose-500">*</span>
                </label>
                <div className="col-span-8">
                  <input
                    type="number"
                    min="0"
                    value={valorAPagar}
                    onChange={(e) => setValorAPagar(e.target.value)}
                    placeholder="Valor a pagar..."
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 font-bold focus:border-blue-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Egreso * */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <label className="col-span-4 text-right font-medium text-slate-600">
                  Egreso <span className="text-rose-500">*</span>
                </label>
                <div className="col-span-8 flex items-center gap-2">
                  <select
                    value={selectedEgresoId}
                    onChange={(e) => handleEgresoSelectChange(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="">Seleccione...</option>
                    {egresosList.map(eg => (
                      <option key={eg.id} value={eg.id}>
                        {eg.nroPago || eg.id} - {eg.proveedor || eg.tercero || "Egreso"} ({fmt(eg.monto || eg.total)})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      toast.info("Para crear un nuevo egreso ve al módulo de Pagos");
                    }}
                    className="w-8 h-8 rounded bg-[#8dc63f] hover:bg-[#7cb035] text-white flex items-center justify-center transition-all shadow-xs shrink-0"
                    title="Nuevo Egreso"
                  >
                    <FiPlus size={16} />
                  </button>
                </div>
              </div>

              {/* Disponible egreso */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <label className="col-span-4 text-right font-medium text-slate-600">
                  Disponible egreso
                </label>
                <div className="col-span-8">
                  <input
                    type="text"
                    readOnly
                    value={fmt(disponibleEgreso)}
                    className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 select-none cursor-not-allowed outline-none font-semibold"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveAsociacion}
                  disabled={savingEgreso}
                  className="px-6 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {savingEgreso ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAsociarModal(false)}
                  className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VER DETALLE FACTURA                                */}
      {/* ========================================================= */}
      {viewingFactura && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Detalle Factura #{viewingFactura.nroFactura || viewingFactura.id}
                </h3>
                <span className="text-xs text-slate-500">
                  {viewingFactura.tipoDoc || "Factura de compra"} • Fecha: {fmtDate(viewingFactura.fecha)}
                </span>
              </div>
              <button
                onClick={() => setViewingFactura(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium block">Tercero / Proveedor</span>
                  <span className="font-bold text-slate-800 text-sm">{viewingFactura.proveedor || viewingFactura.tercero}</span>
                  {viewingFactura.documentoTercero && (
                    <span className="text-slate-500 block text-[11px]">Doc: {viewingFactura.documentoTercero}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Condición & Medio</span>
                  <span className="font-bold text-slate-800">{viewingFactura.condicionPago || "Contado"}</span>
                  <span className="text-slate-500 block text-[11px]">Medio: {viewingFactura.medioPago || "Efectivo"}</span>
                </div>
              </div>

              {/* Conceptos */}
              <div>
                <h4 className="font-bold text-slate-700 mb-2">Conceptos</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Concepto</th>
                        <th className="p-2.5 text-center">Cant.</th>
                        <th className="p-2.5 text-right">P. Unitario</th>
                        <th className="p-2.5 text-right">Descuento</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(viewingFactura.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5">
                            <span className="font-semibold text-slate-800 block">{it.concepto}</span>
                            {it.descripcion && <span className="text-slate-400 text-[10px]">{it.descripcion}</span>}
                          </td>
                          <td className="p-2.5 text-center">{it.cantidad || 1}</td>
                          <td className="p-2.5 text-right">{fmt(it.precioUnitario)}</td>
                          <td className="p-2.5 text-right">{fmt(it.descuento)}</td>
                          <td className="p-2.5 text-right font-bold">{fmt(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1 text-right">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{fmt(viewingFactura.subtotal || viewingFactura.total)}</span>
                  </div>
                  {viewingFactura.totalAnticipos > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Anticipos:</span>
                      <span className="font-semibold">-{fmt(viewingFactura.totalAnticipos)}</span>
                    </div>
                  )}
                  {viewingFactura.totalRetenciones > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Retenciones:</span>
                      <span className="font-semibold">-{fmt(viewingFactura.totalRetenciones)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
                    <span>Total a Pagar:</span>
                    <span>{fmt(viewingFactura.totalNeto || viewingFactura.total)}</span>
                  </div>
                </div>
              </div>

              {viewingFactura.observaciones && (
                <div className="p-3 bg-slate-50 rounded-lg text-slate-600 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Observaciones:</span>
                  {viewingFactura.observaciones}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FiPrinter size={14} /> Imprimir Comprobante
                </button>
                <button
                  onClick={() => setViewingFactura(null)}
                  className="px-5 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg font-bold transition-all shadow-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
