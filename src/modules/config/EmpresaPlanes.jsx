import React, { useState, useEffect, useMemo } from "react";

import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiArrowLeft, FiSave, FiDollarSign, FiFileText } from "react-icons/fi";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

// Use the complex PlanEditor logic or similar if needed? 
// For now, let's implement the matching List View.
// We might need to import PlanEditor from Planes.jsx or refactor it out.
// To keep it simple and safe, I'll allow "Editing" to just show a "Not Implemented" or reuse existing if possible.
// Actually, I should probably copy the PlanEditor logic or make it accessible to avoid breaking functionality.
// For this step I will implement the LIST VIEW perfectly. I'll leave "Edit" as a placeholder or reuse logic.

// Helper for formatting date
const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
        if (isoString.seconds) return new Date(isoString.seconds * 1000).toLocaleString("es-CO");
        return new Date(isoString).toLocaleString("es-CO");
    } catch (e) {
        return isoString;
    }
};

// Utils
const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const normalize = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/* =========================================================================================
   SUB-COMPONENT: EDITOR DE PLAN (Reglas de negocio)
   ========================================================================================= */
function PlanEditor({ plan, listas, onBack, inquilino }) {
    const [items, setItems] = useState([]); // Items of the PLAN (exceptions/rules)
    const [loading, setLoading] = useState(false);
    const [baseItems, setBaseItems] = useState([]); // All items from the BASE LIST

    // Header Edit State
    const [head, setHead] = useState({ nombre: plan.nombre, listaId: plan.listaId });

    // Modal Add Item
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // --- 1. Fetch Plan Items & Base List Items ---
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Fetch Plan Items (rules)
                const qPlanResults = await getDocs(collection(db, "planes", plan.id, "planes_items"));
                setItems(qPlanResults.docs.map(d => ({ id: d.id, ...d.data() }))); // Store local state

                // Fetch Base List Items (subcollection 'items' of the list)
                if (plan.listaId) {
                    const qBase = await getDocs(collection(db, "listas_precios", plan.listaId, "items"));
                    setBaseItems(qBase.docs.map(d => ({ id: d.id, ...d.data() })));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [plan.id, plan.listaId]);

    // --- 2. Calculation Logic ---
    const recompute = (row) => {
        const precio = Number(row.precio || 0);
        const cantidad = Number(row.cantidad || 1);
        const descuento = Number(row.descuento || 0);

        // Total = (Precio * Cantidad) - Descuento
        // Ensure discount doesn't exceed subtotal
        const subtotal = precio * cantidad;
        const finalDiscount = Math.min(descuento, subtotal);

        return {
            ...row,
            cantidad: cantidad,
            descuento: descuento, // stored as value
            total: subtotal - finalDiscount
        };
    };

    const handleUpdateRow = (index, field, value) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = recompute({ ...next[index], [field]: value });
            return next;
        });
    };

    const handleSaveAll = async () => {
        if (!head.nombre.trim()) return alert("Nombre obligatorio");
        try {
            const listaObj = listas.find(l => l.id === head.listaId);
            await updateDoc(doc(db, "planes", plan.id), {
                nombre: head.nombre,
                listaId: head.listaId,
                listaNombre: listaObj?.nombre || "",
                inquilino,
                actualizado: serverTimestamp()
            });

            const batchPromises = items.map(async (it) => {
                const finalPayload = {
                    codigo: it.codigo,
                    nombre: it.nombre,
                    precio: Number(it.precio),
                    cantidad: Number(it.cantidad || 1),
                    descuento: Number(it.descuento || 0),
                    observaciones: it.observaciones || "",
                    total: Number(it.total),
                    actualizado: serverTimestamp()
                };

                if (it.id) { // Removed !it._isNew as it's redundant if it.id exists
                    await updateDoc(doc(db, "planes", plan.id, "planes_items", it.id), finalPayload);
                } else {
                    await addDoc(collection(db, "planes", plan.id, "planes_items"), {
                        ...finalPayload,
                        inquilino,
                        creado: serverTimestamp()
                    });
                }
            });

            await Promise.all(batchPromises);
            alert("Plan guardado correctamente");
            onBack();
        } catch (e) {
            console.error(e);
            alert("Error al guardar");
        }
    };

    const handleDeleteRow = async (index, id) => {
        if (!window.confirm("¿Quitar ítem del plan?")) return;
        if (id) {
            await deleteDoc(doc(db, "planes", plan.id, "planes_items", id));
        }
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    // --- 3. Add Item Logic ---
    const addItemToPlan = (baseItem) => {
        // Check if already exists
        if (items.find(i => i.codigo === baseItem.codigo)) {
            alert("El ítem ya está en el plan");
            return;
        }

        const newItem = recompute({
            _isNew: true,
            codigo: baseItem.codigo,
            nombre: baseItem.nombre,
            precio: baseItem.precio,
            cantidad: 1,
            descuento: 0,
            observaciones: "",
            total: baseItem.precio
        });

        setItems(prev => [...prev, newItem]);
        setShowAddModal(false);
        setSearchTerm("");
    };

    const filteredBaseItems = baseItems.filter(b =>
        (b.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.codigo || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 w-full max-w-6xl mx-auto relative transition-all duration-300">
            {loading && (
                <div className="absolute top-4 right-4 z-50">
                    <div className="w-4 h-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                </div>
            )}

            {/* Header: Institutional & Actions */}
            <div className="group/section bg-white rounded-[32px] border border-slate-200/50 shadow-[0_20px_60px_rgba(0,0,0,0.03)] hover:shadow-[0_35px_80px_rgba(0,0,0,0.06)] transition-all duration-700 overflow-hidden relative mb-6">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 shadow-[1px_0_10px_rgba(37,99,235,0.15)]"></div>

                <div className="bg-slate-50/50 backdrop-blur-sm px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all active:scale-90"
                        >
                            <FiArrowLeft size={18} />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-200">
                            <FiEdit2 className="text-white text-lg" />
                        </div>
                        <div className="flex flex-col">
                            <input
                                value={head.nombre}
                                onChange={e => setHead({ ...head, nombre: e.target.value })}
                                className="text-[18px] font-black text-slate-800 uppercase tracking-tighter bg-transparent border-none outline-none focus:ring-0 w-64 md:w-80"
                                placeholder="Nombre del Plan..."
                            />
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Configuración de Reglas y Excepciones</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95"
                        >
                            <FiPlus /> Ítems
                        </button>
                        <button
                            onClick={handleSaveAll}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
                        >
                            <FiSave /> Guardar
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="group/section bg-white rounded-[32px] border border-slate-200/50 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden relative">
                <div className="p-0 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/30">
                                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Cód.</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Nombre</th>
                                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Base</th>
                                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Cant.</th>
                                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Desc.</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Observaciones</th>
                                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Total</th>
                                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Acc.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <FiFileText size={40} className="text-slate-300" />
                                            <p className="text-sm font-bold text-slate-400">Sin ítems agregados al plan</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : items.map((it, idx) => (
                                <tr key={idx} className="group/row hover:bg-slate-50/50 transition-all duration-300">
                                    <td className="px-6 py-3 border-b border-slate-50">
                                        <span className="text-[11px] font-bold text-slate-400 font-mono tracking-tighter uppercase">{it.codigo}</span>
                                    </td>
                                    <td className="px-6 py-3 border-b border-slate-50">
                                        <span className="text-[14px] font-black text-slate-700 uppercase tracking-tight">{it.nombre}</span>
                                    </td>
                                    <td className="px-6 py-3 border-b border-slate-50 text-right">
                                        <span className="text-[13px] font-bold text-slate-500 font-mono">{COP.format(it.precio)}</span>
                                    </td>
                                    <td className="px-6 py-3 border-b border-slate-50">
                                        <input
                                            type="number" min={1}
                                            className="w-16 mx-auto px-2 py-1.5 bg-slate-100/50 border border-slate-200 rounded-lg text-xs font-black text-center text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                            value={it.cantidad}
                                            onChange={e => handleUpdateRow(idx, 'cantidad', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-6 py-3 border-b border-slate-50">
                                        <input
                                            type="number" min={0}
                                            className="w-24 ml-auto px-2 py-1.5 bg-slate-100/50 border border-slate-200 rounded-lg text-xs font-black text-right text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                            value={it.descuento}
                                            onChange={e => handleUpdateRow(idx, 'descuento', e.target.value)}
                                            placeholder="$ 0"
                                        />
                                    </td>
                                    <td className="px-6 py-3 border-b border-slate-50">
                                        <input
                                            className="w-full px-3 py-1.5 bg-slate-100/50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                            value={it.observaciones || ""}
                                            onChange={e => handleUpdateRow(idx, 'observaciones', e.target.value)}
                                            placeholder="..."
                                        />
                                    </td>
                                    <td className="px-6 py-3 border-b border-slate-50 text-right">
                                        <span className="text-[14px] font-black text-blue-600 font-mono">{COP.format(it.total)}</span>
                                    </td>
                                    <td className="px-6 py-3 border-b border-slate-50 text-center">
                                        <button
                                            onClick={() => handleDeleteRow(idx, it.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal - Modern Search */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[1200] p-4 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[32px] shadow-[0_50px_100px_rgba(0,0,0,0.15)] w-full max-w-2xl overflow-hidden border border-white/40 ring-1 ring-black/5 animate-in zoom-in-95 duration-500 flex flex-col max-h-[85vh]">
                        <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <FiPlus className="text-white text-lg" />
                                </div>
                                <div>
                                    <h3 className="text-[17px] font-black text-slate-800 uppercase tracking-widest">Agregar Ítems al Plan</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Búsqueda rápida en lista base</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 shrink-0">
                            <div className="relative group">
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-all font-black" />
                                <input
                                    className="w-full pl-12 pr-6 py-4 bg-slate-100/50 border border-slate-200 rounded-2xl text-[16px] font-extrabold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner-sm"
                                    placeholder="Nombre o código del producto..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full border-collapse">
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredBaseItems.map(b => (
                                            <tr
                                                key={b.id}
                                                className="hover:bg-blue-50/40 cursor-pointer transition-colors group/item"
                                                onClick={() => addItemToPlan(b)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-black text-slate-700 group-hover/item:text-blue-600 transition-colors uppercase tracking-tight">{b.nombre}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 font-mono">{b.codigo}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-[13px] font-black text-slate-600 font-mono">{COP.format(b.precio)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right w-12 text-blue-300 group-hover/item:text-blue-600 group-hover/item:translate-x-1 transition-all">
                                                    <FiPlus size={18} />
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredBaseItems.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-8 py-12 text-center text-[13px] font-bold text-slate-400 italic">
                                                    No se encontraron coincidencias
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-8 py-3 rounded-2xl text-[13px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-white transition-all active:scale-95 border border-transparent hover:border-slate-200"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default function EmpresaPlanes() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listas, setListas] = useState([]);

    // View State
    const [view, setView] = useState("list"); // list, editor
    const [selectedPlan, setSelectedPlan] = useState(null);

    // New Plan State (for quick create only)
    const [showNewModal, setShowNewModal] = useState(false);
    const [newPlanName, setNewPlanName] = useState("");
    const [newPlanListId, setNewPlanListId] = useState("");


    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            // Fetch Plans
            const snap = await getDocs(query(
                collection(db, "planes"),
                where("inquilino", "==", inquilino)
            ));
            const data = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort locally
            data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setRows(data);

            // Fetch Price Lists for mapping and creation
            const snapL = await getDocs(query(
                collection(db, "listas_precios"),
                where("inquilino", "==", inquilino)
            ));
            const listasData = snapL.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort locally
            listasData.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setListas(listasData);

        } catch (error) {
            console.error("Error fetching planes:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [inquilino]);

    const handleSave = async () => {
        if (!newPlanName.trim()) return alert("El nombre es obligatorio.");
        if (!newPlanListId) return alert("Selecciona una lista de precios.");

        try {
            const lista = listas.find(l => l.id === newPlanListId);

            await addDoc(collection(db, "planes"), {
                nombre: newPlanName.trim(),
                listaId: newPlanListId,
                listaNombre: lista?.nombre || "",
                inquilino,
                creado: serverTimestamp(),
                actualizado: serverTimestamp(),
            });
            alert("Plan creado exitosamente.");


            setShowNewModal(false);
            setNewPlanName("");
            setNewPlanListId("");
            fetchData(); // Reload
        } catch (e) {
            console.error(e);
            alert("Error al guardar plan");
        }
    };

    const openNew = () => {
        setNewPlanName("");
        setNewPlanListId("");
        setShowNewModal(true);
    };

    const openEdit = (row) => {
        setSelectedPlan(row);
        setView("editor");
    };

    if (view === "editor" && selectedPlan) {
        return <PlanEditor plan={selectedPlan} listas={listas} onBack={() => { setView("list"); setSelectedPlan(null); fetchData(); }} inquilino={inquilino} />;
    }

    const handleDelete = async (row) => {
        if (!window.confirm(`¿Eliminar el plan "${row.nombre}"?`)) return;
        try {
            await deleteDoc(doc(db, "planes", row.id));
            setRows(prev => prev.filter(r => r.id !== row.id));
        } catch (e) {
            console.error(e);
            alert("Error al eliminar");
        }
    };

    const filteredRows = rows.filter(r =>
        (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            {loading && (
                <div className="absolute top-4 right-4 z-50">
                    <div className="w-4 h-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                </div>
            )}

            {/* Header & Bar Acciones */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiFileText size={20} />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-bold text-slate-800">Planes de Venta</h1>
                        <p className="text-[12px] text-slate-500">Gestión de convenios y tarifas especiales</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Búsqueda */}
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar plan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Nuevo Plan Button */}
                    <button
                        onClick={openNew}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo plan</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[12px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70">
                                <th className="py-2.5 px-4 font-bold text-slate-600">Nombre</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600">Lista de Precios</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600">Actualización</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && rows.length === 0 ? (
                                [1, 2, 3].map((n) => (
                                    <tr key={n} className="animate-pulse">
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-100 rounded-lg" />
                                                <div className="h-4 bg-slate-100 rounded w-36" />
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="h-4 bg-slate-100 rounded w-28" />
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="h-4 bg-slate-100 rounded w-24" />
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50 text-right">
                                            <div className="flex justify-end gap-2">
                                                <div className="w-9 h-9 bg-slate-100 rounded-xl" />
                                                <div className="w-9 h-9 bg-slate-100 rounded-xl" />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <FiFileText size={40} className="text-slate-300" />
                                            <p className="text-sm font-bold text-slate-400">No hay planes registrados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="group/row hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-4 border-b border-slate-50 transition-all group-hover/row:translate-x-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover/row:scale-110 transition-transform duration-500">
                                                    <FiFileText size={14} />
                                                </div>
                                                <span className="text-[15px] font-black text-slate-700 uppercase tracking-tight">{row.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-400 opacity-50"></div>
                                                <span className="text-[13px] font-bold text-slate-500 uppercase tracking-tight">{row.listaNombre || row.listaId || "—"}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[11px] font-black text-slate-600 font-mono tracking-tighter uppercase">{formatDate(row.actualizado || row.creado)}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cronología</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openEdit(row)}
                                                    className="p-2.5 rounded-xl text-blue-500 hover:bg-blue-500 hover:text-white hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-90"
                                                >
                                                    <FiEdit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row)}
                                                    className="p-2.5 rounded-xl text-red-500 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-200 transition-all active:scale-90"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Creation Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-50/70 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <FiPlus size={16} />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-bold text-slate-800">Nuevo Plan</h3>
                                    <p className="text-[11px] text-slate-500">Creación de tarifario especial</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre Comercial *</label>
                                <input
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    value={newPlanName}
                                    onChange={e => setNewPlanName(e.target.value)}
                                    placeholder="Ej. Particular 2026"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Lista de Precios Base *</label>
                                <select
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    value={newPlanListId}
                                    onChange={e => setNewPlanListId(e.target.value)}
                                >
                                    <option value="">Seleccione...</option>
                                    {listas.map(l => (
                                        <option key={l.id} value={l.id}>{l.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => setShowNewModal(false)}
                                    className="px-4 py-2 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 bg-white cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer border-0"
                                >
                                    <FiPlus size={15} /> Crear Plan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
