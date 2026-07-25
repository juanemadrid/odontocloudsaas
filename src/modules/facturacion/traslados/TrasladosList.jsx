import React, { useState, useEffect, useCallback } from "react";
import { FiRepeat, FiSearch, FiCalendar, FiPlus, FiFileText } from "react-icons/fi";
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

export default function TrasladosList({ onNew }) {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";
  const [loading, setLoading] = useState(true);
  const [traslados, setTraslados] = useState([]);
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
      const q = query(collection(db, "traslados"), where("inquilino", "==", inquilino));
      const snap = await getDocs(q);
      const start = parseLocalDate(fechaInicio); start.setHours(0,0,0,0);
      const end = parseLocalDate(fechaFin); end.setHours(23,59,59,999);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(t => {
          if (!t.fecha) return false;
          const ts = t.fecha.toDate ? t.fecha.toDate().getTime() : new Date(t.fecha).getTime();
          return ts >= start.getTime() && ts <= end.getTime();
        })
        .sort((a, b) => {
          const ta = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha).getTime();
          const tb = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha).getTime();
          return tb - ta;
        });
      setTraslados(list);
    } catch (e) {
      console.error("Error loading traslados:", e);
    } finally {
      setLoading(false);
    }
  }, [inquilino, fechaInicio, fechaFin]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = traslados.filter(t =>
    (t.origen || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.destino || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase())
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
              <input type="text" placeholder="Origen, destino o descripción..." className="w-full h-11 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-blue-500 transition-all"
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
                <th className="px-6 py-4">Origen</th>
                <th className="px-6 py-4">Destino</th>
                <th className="px-6 py-4">Descripción</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-[#8cc33f] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando traslados...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                        <FiRepeat className="text-slate-300" size={28} />
                      </div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No se encontraron traslados</p>
                      <p className="text-[11px] text-slate-400">Crea tu primer traslado entre cuentas</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4 pl-8 font-semibold text-slate-500">{fmtDate(t.fecha)}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{t.origen || "—"}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{t.destino || "—"}</td>
                  <td className="px-6 py-4 text-slate-500">{t.descripcion || "—"}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 font-mono">{fmt(t.monto)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      t.estado === "Anulado" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}>{t.estado || "Activo"}</span>
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
