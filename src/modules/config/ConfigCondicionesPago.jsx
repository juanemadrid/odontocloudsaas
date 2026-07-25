import React, { useState, useEffect } from "react";
import {
    FiPlus, FiSearch, FiEdit2, FiTrash2, FiSave, FiCreditCard, FiX, FiCheck
} from "react-icons/fi";
import {
    collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const COLLECTION_NAME = "condiciones_pago";

export default function ConfigCondicionesPago() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchItems();
    }, [userProfile]);

    const fetchItems = async () => {
        if (!userProfile?.inquilino) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "tenants", userProfile.inquilino, COLLECTION_NAME),
                orderBy("nombre", "asc")
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setItems(list);
        } catch (error) {
            console.error("Error fetching payment conditions:", error);
            if (toast?.error) toast.error("Error al cargar condiciones de pago");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setCurrentItem({ ...item });
        } else {
            setCurrentItem({ nombre: "", admiteCredito: false });
        }
        setModalOpen(true);
    };

    const handleDelete = async (item) => {
        if (window.confirm(`¿Estás seguro de eliminar la condición "${item.nombre}"?`)) {
            try {
                await deleteDoc(doc(db, "tenants", userProfile.inquilino, COLLECTION_NAME, item.id));
                if (toast?.success) toast.success("Eliminado correctamente");
                fetchItems();
            } catch (error) {
                console.error("Error deleting:", error);
                if (toast?.error) toast.error("Error al eliminar");
            }
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!currentItem?.nombre?.trim()) {
            if (toast?.warning) toast.warning("El nombre es obligatorio");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                nombre: currentItem.nombre.trim(),
                admiteCredito: !!currentItem.admiteCredito,
                updatedAt: serverTimestamp()
            };

            if (currentItem.id) {
                await updateDoc(doc(db, "tenants", userProfile.inquilino, COLLECTION_NAME, currentItem.id), payload);
                if (toast?.success) toast.success("Actualizado correctamente");
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, "tenants", userProfile.inquilino, COLLECTION_NAME), payload);
                if (toast?.success) toast.success("Creado correctamente");
            }
            setModalOpen(false);
            fetchItems();
        } catch (error) {
            console.error("Error saving:", error);
            if (toast?.error) toast.error("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const filteredItems = items.filter(i =>
        i.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header / Search Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiCreditCard size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Condiciones de Pago</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Políticas de cobro, plazos y admisión de crédito para pacientes</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar política de pago..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva Política</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Nombre de la Condición</th>
                            <th className="py-2.5 px-4 text-center">Admisión de Crédito</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Sincronizando políticas de pago...
                                </td>
                            </tr>
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron condiciones de pago registradas
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                💳
                                            </div>
                                            <span className="font-bold text-slate-800">{item.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                        {item.admiteCredito ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                <FiCheck size={10} /> Admite Crédito
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                                Sólo Contado
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleOpenModal(item)}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Condición"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Condición"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Form */}
            {modalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <FiCreditCard size={15} />
                                </div>
                                <h3 className="text-[14px] font-bold text-slate-800">
                                    {currentItem?.id ? "Editar Política de Pago" : "Nueva Política de Pago"}
                                </h3>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre de la Condición *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. Contado 100%, Crédito 30 días, 50% Anticipo"
                                    value={currentItem?.nombre || ""}
                                    onChange={(e) => setCurrentItem({ ...currentItem, nombre: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    autoFocus
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="admiteCredito"
                                    checked={!!currentItem?.admiteCredito}
                                    onChange={(e) => setCurrentItem({ ...currentItem, admiteCredito: e.target.checked })}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                />
                                <label htmlFor="admiteCredito" className="text-[12px] font-semibold text-slate-700 cursor-pointer">
                                    Admite venta a crédito / pago diferido
                                </label>
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-1.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 bg-white cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                                >
                                    {saving ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <FiSave size={15} />
                                    )}
                                    <span>{saving ? "Guardando..." : "Guardar Política"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
