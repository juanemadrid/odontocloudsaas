import React, { useState, useEffect } from "react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { COLLECTIONS } from "../../../utils/listaPreciosApi";

export default function PlanSelector({ onClose, onSelect }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [term, setTerm] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            // Usamos la colección centralizada "catalogo_procedimientos"
            const q = query(collection(db, COLLECTIONS.catalogo_procedimientos), limit(50));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = items.filter(i =>
        (i.nombre || "").toLowerCase().includes(term.toLowerCase()) ||
        (i.codigo || "").toLowerCase().includes(term.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animation-fade-in">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animation-slide-up">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
                    <div>
                        <h3 className="text-xl font-display font-bold text-slate-800">Seleccionar Tratamiento</h3>
                        <p className="text-sm text-slate-500">Busca y selecciona un procedimiento del catálogo</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-red-500 transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                            placeholder="Buscar por código o nombre..."
                            value={term}
                            onChange={e => setTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <span className="text-sm font-medium">Cargando catálogo...</span>
                        </div>
                    )}

                    {!loading && filtered.length === 0 && (
                        <div className="text-center py-12">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📂</div>
                            <h4 className="text-slate-600 font-bold">No se encontraron resultados</h4>
                            <p className="text-slate-400 text-sm mt-1">Intenta con otro término de búsqueda.</p>

                            <div className="mt-6 p-4 bg-blue-50 rounded-lg mx-8 text-xs text-blue-700 text-left">
                                <strong>Tip:</strong> Verifica que la colección <code>{COLLECTIONS.catalogo_procedimientos}</code> tenga datos en Firebase.
                            </div>
                        </div>
                    )}

                    {!loading && filtered.map(item => (
                        <button
                            key={item.id}
                            className="w-full text-left p-3 hover:bg-blue-50 rounded-xl transition-all duration-200 group border border-transparent hover:border-blue-100 flex justify-between items-center mb-1"
                            onClick={() => onSelect({
                                titulo: item.nombre || item.descripcion || "Item sin nombre",
                                costo: Number(item.precio || item.valor || 0)
                            })}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition">
                                    Tx
                                </div>
                                <div>
                                    <div className="font-bold text-slate-700 group-hover:text-blue-700 transition">
                                        {item.nombre || item.descripcion}
                                    </div>
                                    {item.codigo && (
                                        <div className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                            {item.codigo}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition font-display">
                                    ${Number(item.precio || item.valor || 0).toLocaleString("es-CO")}
                                </div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Precio Base</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
                    Mostrando {filtered.length} resultados
                </div>
            </div>
        </div>
    );
}
