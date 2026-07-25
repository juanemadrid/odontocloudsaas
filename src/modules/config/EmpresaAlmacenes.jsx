// src/modules/config/EmpresaAlmacenes.jsx
// ============================================================
// 🏬 Gestión de Almacenes - OdontoCloud
// Diseño compacto, limpio y estructurado sin desperdicio de espacio.
// ============================================================
import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiHome, FiBox, FiCheckCircle, FiXCircle, FiArrowLeft, FiSave } from "react-icons/fi";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

// Editor Component (Compact Modal or Card)
function AlmacenEditor({ item, onBack }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [form, setForm] = useState({
        nombre: item?.nombre || "",
        activo: item?.activo !== undefined ? item.activo : true,
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.nombre.trim()) return alert("El nombre del almacén es obligatorio");
        if (!inquilino) return alert("No se identificó el inquilino");

        setIsSaving(true);
        try {
            const payload = {
                nombre: form.nombre.trim(),
                activo: form.activo,
                inquilino,
                actualizado: new Date()
            };

            if (item?.id) {
                await updateDoc(doc(db, "almacenes", item.id), payload);
            } else {
                await addDoc(collection(db, "almacenes"), {
                    ...payload,
                    creado: new Date()
                });
            }
            onBack();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onBack}
                        className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-[15px] font-bold text-slate-800">
                            {item ? "Editar Almacén" : "Nuevo Almacén"}
                        </h2>
                        <p className="text-[11px] text-slate-500">Gestión de bodegas e inventario</p>
                    </div>
                </div>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre del Almacén *</label>
                    <input
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        name="nombre"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        placeholder="Ej. Bodega Principal"
                        autoFocus
                    />
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-slate-700">Estado Operativo</span>
                        <span className="text-[10px] text-slate-400">Disponible para asignación de stock</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={form.activo}
                            onChange={(e) => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 bg-white cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={15} />
                        )}
                        <span>{isSaving ? "Guardando..." : "Guardar"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

// List Component
export default function EmpresaAlmacenes() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Create/Edit state
    const [view, setView] = useState("list"); // list, editor
    const [editingItem, setEditingItem] = useState(null);

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "almacenes"),
                where("inquilino", "==", inquilino)
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setRows(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [inquilino]);

    const openNew = () => {
        setEditingItem(null);
        setView("editor");
    };

    const openEdit = (row) => {
        setEditingItem(row);
        setView("editor");
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`¿Eliminar almacén "${row.nombre}"?`)) return;
        try {
            await deleteDoc(doc(db, "almacenes", row.id));
            setRows(prev => prev.filter(r => r.id !== row.id));
        } catch (e) {
            console.error(e);
            alert("Error al eliminar");
        }
    };

    if (view === "editor") {
        return (
            <div className="p-4 md:p-6 max-w-6xl mx-auto">
                <AlmacenEditor item={editingItem} onBack={() => { setView("list"); fetchData(); }} />
            </div>
        );
    }

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
                        <FiBox size={20} />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-bold text-slate-800">Gestionar Almacenes</h1>
                        <p className="text-[12px] text-slate-500">Inventario y puntos de almacenamiento</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Búsqueda */}
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar almacén..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Nuevo Button */}
                    <button
                        onClick={openNew}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo almacén</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70">
                                <th className="py-2.5 px-4 text-left font-bold text-slate-600">Nombre del Almacén</th>
                                <th className="py-2.5 px-4 text-left font-bold text-slate-600">Estado</th>
                                <th className="py-2.5 px-4 text-right font-bold text-slate-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && rows.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-400">
                                        Cargando almacenes...
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                                        No hay almacenes registrados
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                        <td className="py-2.5 px-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center text-blue-600">
                                                    <FiHome size={14} />
                                                </div>
                                                <span className="font-semibold text-slate-800">{row.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            {row.activo ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                                                    <FiCheckCircle size={11} /> Disponible
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                                    <FiXCircle size={11} /> Inactivo
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openEdit(row)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Editar"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={14} />
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
        </div>
    );
}
