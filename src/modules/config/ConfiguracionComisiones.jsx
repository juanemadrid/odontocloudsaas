import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { FiUsers, FiPercent, FiShield, FiRefreshCw, FiCheck, FiMoreHorizontal } from "react-icons/fi";

const Avatar = ({ name }) => {
  const initials = name
    ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "DR";
  const colors = [
    "bg-blue-500", "bg-indigo-500", "bg-violet-500", 
    "bg-emerald-500", "bg-rose-500", "bg-amber-500"
  ];
  const color = colors[name ? name.length % colors.length : 0];
  
  return (
    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white font-black text-xs shadow-lg shadow-black/10 shrink-0`}>
      {initials}
    </div>
  );
};

export default function ConfiguracionComisiones() {
    const { userProfile } = useAuth();
    const [doctores, setDoctores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);

    // Load doctors from Firestore
    useEffect(() => {
        if (!userProfile?.inquilino) return;
        const loadData = async () => {
            try {
                setLoading(true);
                const q = query(
                    collection(db, "config_profesionales"),
                    where("inquilino", "==", userProfile.inquilino)
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setDoctores(docs);
            } catch (err) {
                console.error("Error cargando profesionales:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [userProfile]);

    const handleUpdate = async (id, field, value) => {
        const numVal = Math.min(100, Math.max(0, Number(value)));
        setSavingId(`${id}-${field}`);
        try {
            const ref = doc(db, "config_profesionales", id);
            await updateDoc(ref, { [field]: numVal });

            // Optimistic update
            setDoctores(prev => prev.map(d => d.id === id ? { ...d, [field]: numVal } : d));
            
            // Show check for a moment
            setTimeout(() => setSavingId(null), 1000);
        } catch (err) {
            console.error("Error actualizando comisión:", err);
            setSavingId(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            
            {/* Elite Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <FiShield className="text-blue-600" />
                        <span>Configuración</span>
                        <span className="text-slate-200">/</span>
                        <span className="text-slate-800">Cálculo de Comisiones</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight leading-none">
                        Gestión de <span className="text-blue-600">Comisiones</span>
                    </h2>
                    <p className="text-[13px] font-medium text-slate-400">Define los porcentajes de ganancia para cada profesional de la clínica.</p>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="h-12 px-6 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl text-[12px] font-black text-slate-600 uppercase tracking-widest hover:bg-white hover:border-blue-500/30 hover:text-blue-600 transition-all active:scale-95 shadow-sm"
                >
                  <FiRefreshCw size={16} /> Actualizar Datos
                </button>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Profesional</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Comisión Gral.</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Comisión Espec.</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Analizando profesionales...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : doctores.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-20 text-center">
                                        <div className="bg-slate-50 rounded-3xl p-10 inline-flex flex-col items-center gap-3 max-w-sm">
                                            <FiUsers size={40} className="text-slate-200" />
                                            <h3 className="text-[14px] font-black text-slate-700 uppercase">Sin doctores configurados</h3>
                                            <p className="text-[12px] text-slate-400 leading-relaxed font-medium">Debes registrar profesionales en el módulo correspondiente para asignarles comisiones.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                doctores.map(doc => (
                                    <tr key={doc.id} className="hover:bg-blue-50/30 transition-all group">
                                        <td className="px-8 py-5 align-middle">
                                            <div className="flex items-center gap-4">
                                                <Avatar name={doc.nombre} />
                                                <div>
                                                    <div className="text-[14px] font-black text-slate-800 uppercase tracking-tight">{doc.nombre}</div>
                                                    <div className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">{doc.especialidad || "General"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-8 py-5 align-middle">
                                            <div className="flex justify-center">
                                                <div className="relative group/input">
                                                    <input
                                                        type="number"
                                                        className="w-24 h-12 bg-slate-50 border border-slate-200 rounded-2xl text-center text-[15px] font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono pl-6"
                                                        value={doc.comisionGeneral || 0}
                                                        onChange={(e) => handleUpdate(doc.id, 'comisionGeneral', e.target.value)}
                                                    />
                                                    <FiPercent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-blue-500" size={14} />
                                                    {savingId === `${doc.id}-comisionGeneral` && (
                                                        <div className="absolute -right-8 top-1/2 -translate-y-1/2 text-emerald-500 animate-in zoom-in">
                                                            <FiCheck size={18} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-8 py-5 align-middle">
                                            <div className="flex justify-center">
                                                <div className="relative group/input">
                                                    <input
                                                        type="number"
                                                        className="w-24 h-12 bg-slate-50 border border-slate-200 rounded-2xl text-center text-[15px] font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono pl-6"
                                                        value={doc.comisionEspecialista || 0}
                                                        onChange={(e) => handleUpdate(doc.id, 'comisionEspecialista', e.target.value)}
                                                    />
                                                    <FiPercent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-blue-500" size={14} />
                                                    {savingId === `${doc.id}-comisionEspecialista` && (
                                                        <div className="absolute -right-8 top-1/2 -translate-y-1/2 text-emerald-500 animate-in zoom-in">
                                                            <FiCheck size={18} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-8 py-5 align-middle text-right">
                                            <button className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-300 hover:text-slate-600 transition-all">
                                                <FiMoreHorizontal size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
