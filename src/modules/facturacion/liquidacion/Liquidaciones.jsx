import React, { useState, useEffect } from "react";
import LiquidacionPendientes from "./LiquidacionPendientes";
import LiquidacionDetalle from "./LiquidacionDetalle";
import LiquidacionViewerModal from "./LiquidacionViewerModal";
import LiquidacionPagarModal from "./LiquidacionPagarModal";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { getConfigSection } from "../../../services/configPersistenceService";
import { anularLiquidacionGenerada, pagarLiquidacion, getDoctoresParaLiquidacion } from "../../../services/liquidacionDoctorService";
import { 
    FiFileText, FiDollarSign, FiClock, FiCheckCircle, FiLayers, 
    FiEye, FiTrash2, FiCreditCard, FiPrinter, FiCalendar, FiFilter 
} from "react-icons/fi";
import { toast } from "sonner";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const formatDateOnly = (dObj) => {
  if (!dObj) return "—";
  try {
    const d = dObj.toDate ? dObj.toDate() : new Date(dObj);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch { return String(dObj); }
};

export default function Liquidaciones() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    // 3 Tabs as requested: "pendientes" | "generadas" | "pagadas"
    const [activeTab, setActiveTab] = useState("pendientes");
    const [currentView, setCurrentView] = useState("list"); // "list" or "detalle"
    
    // Selection state for detail view
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [dateRange, setDateRange] = useState({ desde: "", hasta: "" });
    const [preloadedItems, setPreloadedItems] = useState(null);

    // Liquidations list
    const [liquidacionesList, setLiquidacionesList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);

    // Modal viewers & actions
    const [viewingLiq, setViewingLiq] = useState(null);
    const [payingLiq, setPayingLiq] = useState(null);
    const [payingLoading, setPayingLoading] = useState(false);

    // Filters for "pagadas" tab
    const [filtroDocPagadas, setFiltroDocPagadas] = useState("");
    const [filtroFechaDesde, setFiltroFechaDesde] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 60); return d.toISOString().split("T")[0];
    });
    const [filtroFechaHasta, setFiltroFechaHasta] = useState(new Date().toISOString().split("T")[0]);
    const [doctoresCatalog, setDoctoresCatalog] = useState([]);

    const loadLiquidaciones = async () => {
        if (!inquilino) return;
        setLoadingList(true);
        try {
            let list = [];
            try {
                const { data } = await supabase
                    .from("liquidaciones")
                    .select("*")
                    .eq("tenant_id", inquilino)
                    .order("created_at", { ascending: false });
                if (data && data.length > 0) list = data;
            } catch (e) {}

            const cfgList = await getConfigSection(inquilino, "liquidaciones", []);
            
            // Merge deduplicating by id
            const mergedMap = new Map();
            (cfgList || []).forEach(l => mergedMap.set(l.id, l));
            (list || []).forEach(l => {
                if (mergedMap.has(l.id)) {
                    mergedMap.set(l.id, { ...mergedMap.get(l.id), ...l });
                } else {
                    mergedMap.set(l.id, l);
                }
            });

            const mergedList = Array.from(mergedMap.values());
            mergedList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            setLiquidacionesList(mergedList);
        } catch (e) {
            console.error("Error loading liquidations history:", e);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        loadLiquidaciones();
        if (inquilino) {
            getDoctoresParaLiquidacion(inquilino).then(docs => setDoctoresCatalog(docs));
        }
    }, [activeTab, inquilino]);

    const handleSelectDoctorForDetail = (doctor, dates, items = null) => {
        setSelectedDoctor(doctor);
        setDateRange(dates);
        setPreloadedItems(items);
        setCurrentView("detalle");
    };

    const handleLiquidacionGeneradaSuccess = () => {
        setCurrentView("list");
        setActiveTab("generadas");
        loadLiquidaciones();
        toast.success("✅ Liquidación generada exitosamente. Ahora se encuentra lista para su validación o pago.");
    };

    const handleAnular = async (liq) => {
        if (!window.confirm(`¿Seguro que deseas anular la liquidación de ${liq.profesionalNombre}? Los ítems volverán al estado de pendientes.`)) {
            return;
        }
        try {
            await anularLiquidacionGenerada(inquilino, liq.id);
            toast.success("Liquidación anulada con éxito. Los ítems han vuelto a estar pendientes.");
            setViewingLiq(null);
            loadLiquidaciones();
        } catch (e) {
            console.error("Error anulando liquidación:", e);
            toast.error("Error al anular la liquidación.");
        }
    };

    const handleConfirmPagar = async (pagoOptions) => {
        if (!payingLiq) return;
        setPayingLoading(true);
        try {
            await pagarLiquidacion(inquilino, payingLiq, pagoOptions, userProfile);
            toast.success(`✅ Liquidación pagada con éxito. Se generó el comprobante de egreso para ${payingLiq.profesionalNombre}.`);
            setPayingLiq(null);
            setViewingLiq(null);
            loadLiquidaciones();
            setActiveTab("pagadas");
        } catch (e) {
            console.error("Error al pagar liquidación:", e);
            toast.error("Error al registrar el pago de la liquidación.");
        } finally {
            setPayingLoading(false);
        }
    };

    // Filtered lists
    const liquidacionesGeneradas = liquidacionesList.filter(l => 
        (l.estado === "Generada" || l.estado === "Pendiente") && l.estado !== "Anulada"
    );

    const liquidacionesPagadas = liquidacionesList.filter(l => {
        if (l.estado !== "Pagada" && l.estado !== "Pagado") return false;
        
        // Filtro por doctor
        if (filtroDocPagadas && l.profesionalId !== filtroDocPagadas && l.profesionalNombre !== filtroDocPagadas) {
            return false;
        }

        // Filtro por fecha
        if (filtroFechaDesde && filtroFechaHasta) {
            const fTarget = new Date(l.fechaPago || l.created_at).getTime();
            const fIni = new Date(filtroFechaDesde + "T00:00:00").getTime();
            const fFin = new Date(filtroFechaHasta + "T23:59:59").getTime();
            if (fTarget < fIni || fTarget > fFin) return false;
        }

        return true;
    });

    if (currentView === "detalle" && selectedDoctor) {
        return (
            <LiquidacionDetalle 
                doctor={selectedDoctor}
                dateRange={dateRange}
                preloadedItems={preloadedItems}
                onBack={() => {
                    setCurrentView("list");
                    loadLiquidaciones();
                }}
                onSuccess={handleLiquidacionGeneradaSuccess}
            />
        );
    }

    return (
        <div className="flex h-full bg-slate-50/20">
            {/* Left Sidebar Menu */}
            <div className="w-[240px] bg-white border-r border-slate-100 flex flex-col shrink-0">
                <div className="p-6 border-b border-slate-100/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">MENÚ</span>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Liquidaciones</h3>
                </div>
                <div className="p-4 flex-1 space-y-1">
                    <button
                        onClick={() => setActiveTab("pendientes")}
                        className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all cursor-pointer ${
                            activeTab === "pendientes"
                                ? "bg-purple-50 text-purple-700 shadow-sm border border-purple-100/40"
                                : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        <FiClock size={16} />
                        Pendientes
                    </button>
                    <button
                        onClick={() => setActiveTab("generadas")}
                        className={`w-full h-11 px-4 rounded-2xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                            activeTab === "generadas"
                                ? "bg-purple-50 text-purple-700 shadow-sm border border-purple-100/40"
                                : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <FiLayers size={16} />
                            Generadas
                        </div>
                        {liquidacionesGeneradas.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white leading-none">
                                {liquidacionesGeneradas.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("pagadas")}
                        className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all cursor-pointer ${
                            activeTab === "pagadas"
                                ? "bg-purple-50 text-purple-700 shadow-sm border border-purple-100/40"
                                : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        <FiCheckCircle size={16} />
                        Pagadas
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                
                {/* 1. TAB: PENDIENTES */}
                {activeTab === "pendientes" && (
                    <LiquidacionPendientes onSelectDoctor={handleSelectDoctorForDetail} />
                )}

                {/* 2. TAB: GENERADAS */}
                {activeTab === "generadas" && (
                    <div className="max-w-[1200px] mx-auto space-y-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Liquidaciones Generadas</h2>
                            <p className="text-xs text-slate-400 font-medium">
                                Liquidaciones calculadas y validadas antes de realizar su pago. Puede visualizarlas, anularlas o pagarlas para generar el egreso.
                            </p>
                        </div>

                        {loadingList ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                                <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando Liquidaciones Generadas...</p>
                            </div>
                        ) : liquidacionesGeneradas.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center gap-2 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                                <span className="text-4xl">📑</span>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">
                                    No hay liquidaciones en estado "Generada" pendientes de pago.
                                </p>
                                <button
                                    onClick={() => setActiveTab("pendientes")}
                                    className="mt-3 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                                >
                                    Ir a Pendientes y Liquidar
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="py-4 px-6">Fecha Generación</th>
                                                <th className="py-4 px-6">Profesional</th>
                                                <th className="py-4 px-6">Período Liquidado</th>
                                                <th className="py-4 px-6 text-right">Procedimientos</th>
                                                <th className="py-4 px-6 text-right">Neto a Pagar</th>
                                                <th className="py-4 px-6 text-center">Estado</th>
                                                <th className="py-4 px-6 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {liquidacionesGeneradas.map((h) => (
                                                <tr key={h.id} className="hover:bg-slate-50/30 transition-colors">
                                                    <td className="py-4 px-6 font-bold text-slate-500 whitespace-nowrap">
                                                        {formatDateOnly(h.created_at || h.createdAt)}
                                                    </td>
                                                    <td className="py-4 px-6 font-black text-slate-800">
                                                        {h.profesionalNombre}
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-slate-400 whitespace-nowrap">
                                                        {h.fechaInicio} al {h.fechaFin}
                                                    </td>
                                                    <td className="py-4 px-6 font-black text-slate-700 text-right whitespace-nowrap">
                                                        {fmt(h.totalRecaudado || h.totalItemsValor)}
                                                    </td>
                                                    <td className="py-4 px-6 font-black text-purple-700 text-right whitespace-nowrap text-sm">
                                                        {fmt(h.totalPagar)}
                                                    </td>
                                                    <td className="py-4 px-6 text-center whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider leading-none bg-amber-50 text-amber-600 border border-amber-100">
                                                            Generada
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => setViewingLiq(h)}
                                                                className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                                title="Visualizar detalle"
                                                            >
                                                                <FiEye size={14} />
                                                                Ver
                                                            </button>
                                                            <button
                                                                onClick={() => handleAnular(h)}
                                                                className="h-8 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                                title="Anular para que vuelva a pendientes"
                                                            >
                                                                <FiTrash2 size={13} />
                                                                Anular
                                                            </button>
                                                            <button
                                                                onClick={() => setPayingLiq(h)}
                                                                className="h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                                                title="Pagar y generar comprobante de egreso"
                                                            >
                                                                <FiCreditCard size={13} />
                                                                Pagar
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. TAB: PAGADAS */}
                {activeTab === "pagadas" && (
                    <div className="max-w-[1200px] mx-auto space-y-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Liquidaciones Pagadas</h2>
                            <p className="text-xs text-slate-400 font-medium">
                                Histórico de comisiones pagadas a los profesionales médicos. Estos pagos también son visibles en Administración - Facturación - Pagos.
                            </p>
                        </div>

                        {/* Filters Bar */}
                        <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-end gap-4">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Desde</label>
                                    <input 
                                        type="date"
                                        value={filtroFechaDesde}
                                        onChange={e => setFiltroFechaDesde(e.target.value)}
                                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Hasta</label>
                                    <input 
                                        type="date"
                                        value={filtroFechaHasta}
                                        onChange={e => setFiltroFechaHasta(e.target.value)}
                                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Filtrar por doctor</label>
                                    <select
                                        value={filtroDocPagadas}
                                        onChange={e => setFiltroDocPagadas(e.target.value)}
                                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                    >
                                        <option value="">Todos los doctores</option>
                                        {doctoresCatalog.map(d => (
                                            <option key={d.id} value={d.id}>{d.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {loadingList ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                                <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando Historial...</p>
                            </div>
                        ) : liquidacionesPagadas.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center gap-2 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                                <span className="text-4xl">🧾</span>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">
                                    No hay liquidaciones pagadas registradas en el rango seleccionado.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="py-4 px-6">Fecha Pago</th>
                                                <th className="py-4 px-6">Profesional</th>
                                                <th className="py-4 px-6">Período Liquidado</th>
                                                <th className="py-4 px-6 text-right">Procedimientos</th>
                                                <th className="py-4 px-6 text-right">Neto Pagado</th>
                                                <th className="py-4 px-6 text-center">Nro. Egreso</th>
                                                <th className="py-4 px-6 text-center">Estado</th>
                                                <th className="py-4 px-6 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {liquidacionesPagadas.map((h) => (
                                                <tr key={h.id} className="hover:bg-slate-50/30 transition-colors">
                                                    <td className="py-4 px-6 font-bold text-slate-500 whitespace-nowrap">
                                                        {formatDateOnly(h.fechaPago || h.created_at)}
                                                    </td>
                                                    <td className="py-4 px-6 font-black text-slate-800">
                                                        {h.profesionalNombre}
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-slate-400 whitespace-nowrap">
                                                        {h.fechaInicio} al {h.fechaFin}
                                                    </td>
                                                    <td className="py-4 px-6 font-black text-slate-700 text-right whitespace-nowrap">
                                                        {fmt(h.totalRecaudado || h.totalItemsValor)}
                                                    </td>
                                                    <td className="py-4 px-6 font-black text-emerald-600 text-right whitespace-nowrap text-sm">
                                                        {fmt(h.totalPagar)}
                                                    </td>
                                                    <td className="py-4 px-6 text-center whitespace-nowrap font-mono text-slate-500 font-bold">
                                                        {h.pagoProveedorId ? `#${h.pagoProveedorId.slice(-6)}` : "—"}
                                                    </td>
                                                    <td className="py-4 px-6 text-center whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider leading-none bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                            Pagada
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right whitespace-nowrap">
                                                        <button
                                                            onClick={() => setViewingLiq(h)}
                                                            className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                                            title="Ver recibo y comprobante"
                                                        >
                                                            <FiEye size={14} />
                                                            Ver Comprobante
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Viewer Modal */}
            {viewingLiq && (
                <LiquidacionViewerModal
                    liquidacion={viewingLiq}
                    onClose={() => setViewingLiq(null)}
                    onPagar={(liq) => {
                        setViewingLiq(null);
                        setPayingLiq(liq);
                    }}
                    onAnular={handleAnular}
                />
            )}

            {/* Pagar Modal */}
            {payingLiq && (
                <LiquidacionPagarModal
                    liquidacion={payingLiq}
                    tenantId={inquilino}
                    onClose={() => setPayingLiq(null)}
                    onConfirm={handleConfirmPagar}
                    loading={payingLoading}
                />
            )}

        </div>
    );
}
