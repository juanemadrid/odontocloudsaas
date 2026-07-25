import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { FiActivity, FiDownload, FiSearch, FiCheckCircle, FiClock, FiXCircle } from "react-icons/fi";
import { format } from "date-fns";

const StatBox = ({ title, value, icon: Icon, color, bg }) => (
  <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center text-2xl ${bg} ${color}`}>
      <Icon />
    </div>
    <div className="min-w-0">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 truncate">{title}</h4>
      <div className={`text-2xl font-black ${color} leading-none truncate`}>{value}</div>
    </div>
  </div>
);

export default function ReporteClinico() {
  const { userProfile } = useAuth();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    completadas: 0,
    canceladas: 0,
    pendientes: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        const q = query(collection(db, "agenda"), where("inquilino", "==", userProfile.inquilino));
        const snapshot = await getDocs(q);
        
        const data = [];
        let completadas = 0;
        let canceladas = 0;
        let pendientes = 0;

        snapshot.forEach(doc => {
          const c = { id: doc.id, ...doc.data() };
          data.push(c);

          const estado = (c.estado || "").toLowerCase();
          if (estado === "atendida" || estado === "completada") {
               completadas++;
          } else if (estado === "cancelada") {
               canceladas++;
          } else {
               pendientes++;
          }
        });

        data.sort((a, b) => {
            const dateA = new Date(`${a.fecha || '1970-01-01'}T${a.hora || '00:00'}`).getTime();
            const dateB = new Date(`${b.fecha || '1970-01-01'}T${b.hora || '00:00'}`).getTime();
            return dateB - dateA; // Descending
        });

        setCitas(data);
        setStats({
          total: data.length,
          completadas,
          canceladas,
          pendientes
        });
      } catch (error) {
        console.error("Error fetching citas:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile?.inquilino) {
        fetchData();
    }
  }, [userProfile?.inquilino]);

  const filtered = citas.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.nombrePaciente && c.nombrePaciente.toLowerCase().includes(term)) ||
      (c.dentista && c.dentista.toLowerCase().includes(term)) ||
      (c.motivo && c.motivo.toLowerCase().includes(term))
    );
  });

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ["Fecha", "Hora", "Paciente", "Procedimiento", "Doctor", "Estado"];
    const rows = filtered.map(c => [
      c.fecha || "—",
      c.hora || "—",
      `"${(c.nombrePaciente || "").replace(/"/g, "'")}"`,
      `"${(c.motivo || "").replace(/"/g, "'")}"`,
      `"${(c.dentista || "").replace(/"/g, "'")}"`,
      c.estado || "Pendiente"
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_clinico_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header and Actions */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-4 flex items-center justify-between gap-4 shrink-0 mb-6 mx-2 mt-2">
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-[24px] border border-slate-100">
          <div className="px-6 font-black text-slate-400 uppercase tracking-widest text-[11px]">
            Eficiencia Clínica
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Buscar cita, paciente, motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-11 pr-4 rounded-full border border-slate-200 text-[12px] outline-none w-[240px] bg-slate-50 text-slate-700 focus:bg-white focus:border-purple-500 transition-all font-bold placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-800 text-white hover:bg-slate-700 font-black text-[11px] uppercase tracking-[0.1em] transition-all shadow-lg shadow-slate-200"
          >
            <FiDownload size={16} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Main Form */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400">
             <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
             <div className="text-[13px] font-bold">Analizando eficiencia clínica...</div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatBox 
                title="Volumen Consultas" 
                value={stats.total} 
                icon={FiActivity} 
                color="text-indigo-600" 
                bg="bg-indigo-50" 
              />
              <StatBox 
                title="Atendidas" 
                value={stats.completadas} 
                icon={FiCheckCircle} 
                color="text-emerald-600" 
                bg="bg-emerald-50" 
              />
              <StatBox 
                title="Programadas" 
                value={stats.pendientes} 
                icon={FiClock} 
                color="text-amber-500" 
                bg="bg-amber-50" 
              />
              <StatBox 
                title="Canceladas" 
                value={stats.canceladas} 
                icon={FiXCircle} 
                color="text-rose-600" 
                bg="bg-rose-50" 
              />
            </div>

            {/* Detailed Table Box */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                   Log de Consultas
                   <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{filtered.length} Reg.</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Fecha y Hora</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Paciente</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Procedimiento</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Dr. / Tratante</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 border-b border-slate-50">
                          <div className="font-bold text-slate-800 text-[12px]">{c.fecha || "—"}</div>
                          {c.hora && <div className="text-[10px] font-bold text-slate-400 mt-1">{c.hora}</div>}
                        </td>
                        <td className="px-6 py-4 border-b border-slate-50">
                          <div className="font-bold text-slate-700 text-[13px]">{c.nombrePaciente || "—"}</div>
                        </td>
                        <td className="px-6 py-4 border-b border-slate-50">
                          <div className="font-medium text-slate-500 text-[12px] truncate max-w-[200px]">{c.motivo || "—"}</div>
                        </td>
                        <td className="px-6 py-4 border-b border-slate-50">
                          <div className="font-semibold text-slate-600 text-[12px]">{c.dentista || "—"}</div>
                        </td>
                        <td className="px-6 py-4 border-b border-slate-50 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              (c.estado || "").toLowerCase() === "atendida" || (c.estado || "").toLowerCase() === "completada"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                : (c.estado || "").toLowerCase() === "cancelada"
                                ? "bg-rose-50 text-rose-600 border border-rose-100"
                                : "bg-amber-50 text-amber-600 border border-amber-100"
                          }`}>
                              {c.estado || "Pendiente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-[12px] text-slate-400 font-bold">
                          No se encontraron consultas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
