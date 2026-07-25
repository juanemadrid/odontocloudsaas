import React, { useState } from "react";
import LiquidacionPendientes from "./LiquidacionPendientes";
import LiquidacionDetalle from "./LiquidacionDetalle";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { FiFileText, FiDollarSign, FiClock, FiCheckCircle } from "react-icons/fi";

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
  } catch { return "—"; }
};

export default function Liquidaciones() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [activeTab, setActiveTab] = useState("pendientes"); // "pendientes" or "generados"
    const [currentView, setCurrentView] = useState("list"); // "list" or "detalle"
    
    // Selection state for detail view
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [dateRange, setDateRange] = useState({ desde: "", hasta: "" });

    // Historical liquidations list
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const loadHistory = async () => {
        if (!inquilino) return;
        setLoadingHistory(true);
        try {
            const q = query(
                collection(db, "liquidaciones"),
                where("inquilino", "==", inquilino)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setHistory(list);
        } catch (e) {
            console.error("Error loading liquidations history:", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    React.useEffect(() => {
        if (activeTab === "generados") {
            loadHistory();
        }
    }, [activeTab, inquilino]);

    const handleSelectDoctorForDetail = (doctor, dates) => {
        setSelectedDoctor(doctor);
        setDateRange(dates);
        setCurrentView("detalle");
    };

    if (currentView === "detalle" && selectedDoctor) {
        return (
            <LiquidacionDetalle 
                doctor={selectedDoctor}
                dateRange={dateRange}
                onBack={() => {
                    setCurrentView("list");
                    loadHistory();
                }}
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
                        className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all ${
                            activeTab === "pendientes"
                                ? "bg-purple-50 text-purple-700 shadow-sm border border-purple-100/20"
                                : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        <FiClock size={16} />
                        Pendientes
                    </button>
                    <button
                        onClick={() => setActiveTab("generados")}
                        className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all ${
                            activeTab === "generados"
                                ? "bg-purple-50 text-purple-700 shadow-sm border border-purple-100/20"
                                : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        <FiCheckCircle size={16} />
                        Generados / Pagados
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === "pendientes" ? (
                    <LiquidacionPendientes onSelectDoctor={handleSelectDoctorForDetail} />
                ) : (
                    <div className="max-w-[1200px] mx-auto space-y-6">
                        <div className="mb-6">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Historial de Liquidaciones</h2>
                            <p className="text-xs text-slate-400 font-medium">Registro de comisiones calculadas y pagadas a los profesionales médicos.</p>
                        </div>

                        {loadingHistory ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                                <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando Historial...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center gap-2 bg-white rounded-[28px] border border-slate-100 shadow-sm">
                                <span className="text-4xl">🧾</span>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">No hay liquidaciones generadas.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Generación</th>
                                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Profesional</th>
                                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Período Liquidado</th>
                                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Recaudado Total</th>
                                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Neto Pagado</th>
                                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Registrado Por</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {history.map((h) => (
                                                <tr key={h.id} className="hover:bg-slate-50/30 transition-colors">
                                                    <td className="py-4 px-6 text-xs font-bold text-slate-500 whitespace-nowrap">
                                                        {formatDateOnly(h.createdAt)}
                                                    </td>
                                                    <td className="py-4 px-6 text-xs font-black text-slate-700">
                                                        {h.profesionalNombre}
                                                    </td>
                                                    <td className="py-4 px-6 text-xs font-bold text-slate-400 whitespace-nowrap">
                                                        {h.fechaInicio} al {h.fechaFin}
                                                    </td>
                                                    <td className="py-4 px-6 text-xs font-black text-slate-700 text-right whitespace-nowrap">
                                                        {fmt(h.totalRecaudado)}
                                                    </td>
                                                    <td className="py-4 px-6 text-xs font-black text-purple-600 text-right whitespace-nowrap">
                                                        {fmt(h.totalPagar)}
                                                    </td>
                                                    <td className="py-4 px-6 text-center whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider leading-none bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                            {h.estado || "Pagado"}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-xs text-slate-500 font-bold whitespace-nowrap">
                                                        {h.registradoPor || "—"}
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
        </div>
    );
}
