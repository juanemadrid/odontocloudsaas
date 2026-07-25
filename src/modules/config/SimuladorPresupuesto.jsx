import React, { useState, useEffect } from "react";
import { FiPlus, FiTrash2, FiSave, FiCheckCircle, FiDollarSign, FiUser, FiCalendar, FiPackage } from "react-icons/fi";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function SimuladorPresupuesto() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [items, setItems] = useState([]);
    const [planes, setPlanes] = useState([]);
    const [loadingPlanes, setLoadingPlanes] = useState(false);
    const [showPlanesModal, setShowPlanesModal] = useState(false);
    const [loadingItems, setLoadingItems] = useState(false);

    // Fetch Planes
    useEffect(() => {
        const fetchPlanes = async () => {
            if (!inquilino) return;
            setLoadingPlanes(true);
            try {
                const snap = await getDocs(query(
                    collection(db, "planes"),
                    where("inquilino", "==", inquilino)
                ));
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setPlanes(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingPlanes(false);
            }
        };
        fetchPlanes();
    }, [inquilino]);

    const cargarPlan = async (plan) => {
        setLoadingItems(true);
        try {
            const snap = await getDocs(collection(db, "planes", plan.id, "planes_items"));
            const planItems = snap.docs.map(d => d.data());
            
            if (planItems.length === 0) {
                alert("Este plan no tiene ítems configurados.");
                return;
            }

            // Inyectar al presupuesto
            const newItems = planItems.map(it => ({
                id: Math.random().toString(36).substr(2, 9),
                codigo: it.codigo,
                nombre: it.nombre,
                precio: Number(it.precio || 0),
                cantidad: Number(it.cantidad || 1),
                descuento: Number(it.descuento || 0),
                total: Number(it.total || 0)
            }));

            setItems(prev => [...prev, ...newItems]);
            setShowPlanesModal(false);
        } catch (e) {
            console.error(e);
            alert("Error cargando los ítems del plan.");
        } finally {
            setLoadingItems(false);
        }
    };

    const handleRemove = (id) => {
        setItems(prev => prev.filter(it => it.id !== id));
    };

    const granTotal = items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);

    return (
        <div className="p-4 w-full max-w-5xl mx-auto space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <FiUser size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Simulador de Presupuesto</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Añade un paciente (Demo) y carga tarifas</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Paciente</label>
                        <input className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none" value="María Perez (Simulación)" readOnly />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Fecha Cotización</label>
                        <div className="relative">
                            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none" value={new Date().toLocaleDateString("es-CO")} readOnly />
                        </div>
                    </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6">
                    <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-200">
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Ítems del Presupuesto</h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowPlanesModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-blue-200"
                            >
                                <FiPackage /> Cargar Combo / Plan
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-0 overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Código</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Detalle</th>
                                    <th className="px-6 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Cant.</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">V. Unit</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Desc.</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Total</th>
                                    <th className="px-6 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Acc</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                                            No hay ítems registrados. Simula ingresando uno utilizando un Plan.
                                        </td>
                                    </tr>
                                ) : items.map((it) => (
                                    <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 border-b border-slate-50 text-xs font-bold text-slate-400 font-mono">{it.codigo}</td>
                                        <td className="px-6 py-3 border-b border-slate-50 text-sm font-black text-slate-700 uppercase">{it.nombre}</td>
                                        <td className="px-6 py-3 border-b border-slate-50 text-center"><span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-bold">{it.cantidad}</span></td>
                                        <td className="px-6 py-3 border-b border-slate-50 text-right text-sm font-bold text-slate-500 font-mono">{COP.format(it.precio)}</td>
                                        <td className="px-6 py-3 border-b border-slate-50 text-right text-sm font-bold text-red-400 font-mono">{it.descuento > 0 ? COP.format(it.descuento) : "-"}</td>
                                        <td className="px-6 py-3 border-b border-slate-50 text-right text-sm font-black text-blue-600 font-mono">{COP.format(it.total)}</td>
                                        <td className="px-6 py-3 border-b border-slate-50 text-center">
                                            <button onClick={() => handleRemove(it.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                                                <FiTrash2 />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="text-right space-y-1">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Total a Pagar</p>
                        <p className="text-3xl font-black text-emerald-600 font-mono">{COP.format(granTotal)}</p>
                    </div>
                </div>
            </div>

            {/* Modal de Planes */}
            {showPlanesModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[999] animate-in fade-in p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-white/40 ring-1 ring-black/5 animate-in zoom-in-95">
                        <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <FiPackage className="text-blue-500" /> Seleccionar Plan / Paquete
                            </h3>
                        </div>
                        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                            {loadingPlanes ? (
                                <div className="p-10 text-center text-slate-400 font-bold animate-pulse">Cargando planes...</div>
                            ) : planes.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 font-bold">No tienes planes configurados. Ve a "Planes" en configuración para armar uno.</div>
                            ) : planes.map(p => (
                                <div key={p.id} onClick={() => cargarPlan(p)} className="flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 rounded-2xl cursor-pointer transition-all group">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight group-hover:text-blue-700 transition-colors">{p.nombre}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.listaNombre || p.listaId}</p>
                                    </div>
                                    <div className="text-blue-400 group-hover:text-blue-600 transition-colors">
                                        {loadingItems ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div> : <FiPlus size={20} />}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
                            <button onClick={() => setShowPlanesModal(false)} className="px-6 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-700">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
