import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

const COLORS = [
    "Amarillo", "Azul", "Beige", "Blanco", "Gris", "Negro", "Púrpura", "Rojo", "Verde"
];

const DEFAULT_RESIDUES = [
    { nombre: "Anatomopatológicos", color: "Rojo" },
    { nombre: "Animales", color: "Rojo" },
    { nombre: "Aprovechables", color: "Blanco" },
    { nombre: "Biosanitarios", color: "Rojo" },
    { nombre: "Corrosivos", color: "Rojo" },
    { nombre: "Cortopunzantes", color: "Rojo" },
    { nombre: "Explosivos", color: "Rojo" },
    { nombre: "Inflamables", color: "Rojo" },
    { nombre: "No aprovechables", color: "Negro" },
    { nombre: "Ordinarios", color: "Verde" },
    { nombre: "Radiactivos", color: "Rojo" },
    { nombre: "Reactivos", color: "Rojo" },
    { nombre: "Tóxicos", color: "Rojo" }
];

export default function ConfigurarResiduos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [activeSubTab, setActiveSubTab] = useState("tipos"); // "tipos" o "indicadores_config"
    const [loading, setLoading] = useState(true);
    const [residues, setResidues] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [nombre, setNombre] = useState("");
    const [color, setColor] = useState("Rojo");
    const [saving, setSaving] = useState(false);

    const loadResidues = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const q = query(collection(db, "tipos_residuos"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // If empty, pre-populate default Colombian waste types
            if (list.length === 0) {
                const batch = writeBatch(db);
                const colRef = collection(db, "tipos_residuos");
                const createdList = [];
                for (const item of DEFAULT_RESIDUES) {
                    const newDocRef = doc(colRef);
                    const newItem = {
                        nombre: item.nombre,
                        color: item.color,
                        inquilino,
                        createdAt: new Date()
                    };
                    batch.set(newDocRef, newItem);
                    createdList.push({ id: newDocRef.id, ...newItem });
                }
                await batch.commit();
                list = createdList;
                toast.success("Se cargaron los tipos de residuos por defecto");
            }

            setResidues(list.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        } catch (e) {
            console.error("Error loading residues types:", e);
            toast.error("Error al cargar los tipos de residuos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadResidues();
    }, [inquilino]);

    const handleOpenAdd = () => {
        setEditId(null);
        setNombre("");
        setColor("Rojo");
        setShowModal(true);
    };

    const handleOpenEdit = (item) => {
        setEditId(item.id);
        setNombre(item.nombre);
        setColor(item.color);
        setShowModal(true);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!nombre.trim()) {
            toast.error("El nombre del residuo es obligatorio.");
            return;
        }

        setSaving(true);
        try {
            const data = {
                nombre: nombre.trim(),
                color,
                inquilino,
                updatedAt: new Date()
            };

            if (editId) {
                await updateDoc(doc(db, "tipos_residuos", editId), data);
                toast.success("Tipo de residuo actualizado");
                setResidues(prev => prev.map(r => r.id === editId ? { ...r, ...data } : r).sort((a, b) => a.nombre.localeCompare(b.nombre)));
            } else {
                const docRef = await addDoc(collection(db, "tipos_residuos"), {
                    ...data,
                    createdAt: new Date()
                });
                toast.success("Tipo de residuo agregado");
                setResidues(prev => [...prev, { id: docRef.id, ...data }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            }
            setShowModal(false);
        } catch (err) {
            console.error("Error saving residue:", err);
            toast.error("Error al guardar el tipo de residuo");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar este tipo de residuo?")) return;
        try {
            await deleteDoc(doc(db, "tipos_residuos", id));
            toast.success("Tipo de residuo eliminado");
            setResidues(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            console.error("Error deleting residue:", e);
            toast.error("Error al eliminar el tipo de residuo");
        }
    };

    const filteredResidues = useMemo(() => {
        return residues.filter(r => 
            (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [residues, searchTerm]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Tabs choices */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveSubTab("tipos")}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                        activeSubTab === "tipos"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                >
                    Tipos de residuos
                </button>
                <button
                    onClick={() => setActiveSubTab("indicadores")}
                    className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                        activeSubTab === "indicadores"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                >
                    Indicadores
                </button>
            </div>

            {activeSubTab === "tipos" ? (
                <>
                    {/* Toolbar */}
                    <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="relative w-full max-w-md">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Buscar..."
                                className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleOpenAdd}
                            className="h-10 px-6 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 shrink-0"
                        >
                            <FiPlus className="mr-1.5" size={14} />
                            Agregar residuo
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-8 py-4">Nombre del residuo</th>
                                        <th className="px-6 py-4">Color</th>
                                        <th className="px-6 py-4 text-center pr-8 w-28">Opciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="3" className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando tipos de residuos...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredResidues.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="px-8 py-20 text-center text-slate-400 italic">
                                                No se encontraron registros.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredResidues.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-8 py-4 font-bold text-slate-800 uppercase tracking-tight">{item.nombre}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-500">{item.color}</td>
                                                <td className="px-6 py-4 text-center pr-8 flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => handleOpenEdit(item)}
                                                        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm"
                                                        title="Editar"
                                                    >
                                                        <FiEdit2 size={13} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(item.id)}
                                                        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all shadow-sm"
                                                        title="Eliminar"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm text-center py-20">
                    <p className="text-slate-400 italic text-sm">Los indicadores se calculan automáticamente en base a las cargas diarias reportadas.</p>
                </div>
            )}

            {/* Modal Dialog */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                {editId ? "Editar residuo" : "Nuevo residuo"}
                            </h3>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 flex items-center justify-center transition-all"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo de residuo *</label>
                                <input 
                                    type="text"
                                    placeholder="Ingrese el nombre del residuo"
                                    className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Color *</label>
                                <select
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer"
                                >
                                    {COLORS.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Buttons */}
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="h-10 px-6 rounded-full text-xs font-black uppercase tracking-widest text-slate-400 border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="h-10 px-8 rounded-full text-xs font-black uppercase tracking-widest text-white bg-[#8cc33f] hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95"
                                >
                                    {saving ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
