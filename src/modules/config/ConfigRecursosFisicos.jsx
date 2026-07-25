import React, { useState, useEffect } from "react";
import {
    FiPlus, FiSearch, FiEdit2, FiTrash2, FiSave, FiX, FiBox
} from "react-icons/fi";
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function ConfigRecursosFisicos() {
    const { userProfile } = useAuth();
    const toast = useToast();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const [formData, setFormData] = useState({
        nombre: "",
        descripcion: ""
    });

    useEffect(() => {
        if (userProfile?.inquilino) {
            loadItems();
        }
    }, [userProfile]);

    const loadItems = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, "tenants", userProfile.inquilino, "recursos_fisicos"),
                orderBy("nombre", "asc")
            );
            const querySnapshot = await getDocs(q);
            const docs = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setItems(docs);
        } catch (error) {
            console.error("Error loading resources:", error);
            if (toast?.error) toast.error("Error al cargar recursos físicos");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setCurrentItem(item);
            setFormData({
                nombre: item.nombre,
                descripcion: item.descripcion || ""
            });
        } else {
            setCurrentItem({ id: null });
            setFormData({ nombre: "", descripcion: "" });
        }
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setCurrentItem(null);
        setFormData({ nombre: "", descripcion: "" });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            if (toast?.warning) toast.warning("El nombre es obligatorio");
            return;
        }

        setSaving(true);
        try {
            const collectionRef = collection(db, "tenants", userProfile.inquilino, "recursos_fisicos");

            if (currentItem?.id) {
                await updateDoc(doc(collectionRef, currentItem.id), {
                    ...formData,
                    updatedAt: serverTimestamp()
                });
                if (toast?.success) toast.success("Recurso actualizado");
            } else {
                await addDoc(collectionRef, {
                    ...formData,
                    active: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                if (toast?.success) toast.success("Recurso creado");
            }

            handleCloseModal();
            loadItems();
        } catch (error) {
            console.error("Error saving resource:", error);
            if (toast?.error) toast.error("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar este recurso?")) return;

        setLoading(true);
        try {
            await deleteDoc(doc(db, "tenants", userProfile.inquilino, "recursos_fisicos", id));
            if (toast?.success) toast.success("Recurso eliminado");
            loadItems();
        } catch (error) {
            console.error("Error deleting resource:", error);
            if (toast?.error) toast.error("Error al eliminar");
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiBox size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Recursos Físicos</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Gestión de consultorios, sillas odontológicas y equipos de la clínica</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar recurso o consultorio..."
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
                        <span>Nuevo Recurso</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Recurso / Consultorio</th>
                            <th className="py-2.5 px-4">Descripción / Observaciones</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading && items.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando recursos físicos...
                                </td>
                            </tr>
                        ) : filteredItems.length > 0 ? (
                            filteredItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                📦
                                            </div>
                                            <span className="font-bold text-slate-800 uppercase">{item.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className="text-slate-500">{item.descripcion || "Sin descripción"}</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleOpenModal(item)}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Recurso"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Recurso"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron recursos físicos registrados
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modalOpen && currentItem && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <FiBox size={15} />
                                </div>
                                <h3 className="text-[14px] font-bold text-slate-800">
                                    {currentItem?.id ? "Editar Recurso Físico" : "Nuevo Recurso Físico"}
                                </h3>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre del Recurso *</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="Ej. CONSULTORIO 1, UNIDAD DENTAL 2, EQUIPO RX"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors uppercase"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Descripción / Ubicación</label>
                                <textarea
                                    rows={3}
                                    placeholder="Detalles sobre la ubicación, especificaciones o estado..."
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
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
                                    <span>{saving ? "Guardando..." : "Guardar Recurso"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
