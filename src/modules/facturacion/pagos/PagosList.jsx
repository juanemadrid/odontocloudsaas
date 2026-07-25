import React, { useState, useEffect, useCallback } from "react";
import { FiCreditCard, FiSearch, FiCalendar, FiPrinter, FiTrash2 } from "react-icons/fi";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";

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

export default function PagosList({ onNew }) {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";
  const [loading, setLoading] = useState(true);
  const [pagos, setPagos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0];
  });
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split("T")[0]);

  const parseLocalDate = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };

  const loadData = useCallback(async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      const q = query(collection(db, "pagos_proveedor"), where("inquilino", "==", inquilino));
      const snap = await getDocs(q);
      const start = parseLocalDate(fechaInicio); start.setHours(0,0,0,0);
      const end = parseLocalDate(fechaFin); end.setHours(23,59,59,999);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => {
          if (!p.fecha) return false;
          const ts = p.fecha.toDate ? p.fecha.toDate().getTime() : new Date(p.fecha).getTime();
          return ts >= start.getTime() && ts <= end.getTime();
        })
        .sort((a, b) => {
          const ta = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha).getTime();
          const tb = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha).getTime();
          return tb - ta;
        });
      setPagos(list);
    } catch (e) {
      console.error("Error loading pagos:", e);
    } finally {
      setLoading(false);
    }
  }, [inquilino, fechaInicio, fechaFin]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = pagos.filter(p =>
    (p.proveedor || p.tercero || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.concepto || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Filter Card */}
      <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Inicial</label>
            <div className="relative">
              <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="date" className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Final</label>
            <div className="relative">
              <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="date" className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscar</label>
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Proveedor o concepto..." className="w-full h-11 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-blue-500 transition-all"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={loadData} className="h-11 flex items-center justify-center gap-2 bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] transition-all active:scale-95 shadow">
            <FiSearch /> Buscar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[550px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 pl-8">Fecha</th>
                <th className="px-6 py-4">Proveedor</th>
                <th className="px-6 py-4">Concepto</th>
                <th className="px-6 py-4">Medio de pago</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-[#8cc33f] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando pagos...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                        <FiCreditCard className="text-slate-300" size={28} />
                      </div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No se encontraron pagos</p>
                      <p className="text-[11px] text-slate-400">Registra los pagos a proveedores y terceros</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4 pl-8 font-semibold text-slate-500">{fmtDate(p.fecha)}</td>
                  <td className="px-6 py-4 font-bold text-slate-800 uppercase">{p.proveedor || p.tercero || "—"}</td>
                  <td className="px-6 py-4 text-slate-600">{p.concepto || "—"}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {p.medioPago || "Efectivo"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 font-mono">{fmt(p.monto)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm" title="Imprimir">
                        <FiPrinter size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
