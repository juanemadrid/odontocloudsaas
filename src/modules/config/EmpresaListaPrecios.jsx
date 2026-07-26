import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiEye, FiTrash2, FiDollarSign, FiUploadCloud, FiBox, FiAlertTriangle, FiCheck } from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import ListaPreciosEditar from "./ListaPreciosEditar";
import ImportadorListaPrecios from "./ImportadorListaPrecios";
import ModalProducto from "./ModalProducto";

// Helper for formatting date
const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
        return new Date(isoString).toLocaleString("es-CO");
    } catch (e) {
        return isoString;
    }
};

// MAIN COMPONENT
export default function EmpresaListaPrecios() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [activeTab, setActiveTab] = useState("clinicos"); // clinicos, productos, servicios
    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    // View State: 'list' or 'editor'
    const [view, setView] = useState("list");
    const [selectedList, setSelectedList] = useState(null);

    // Modal State
    const [showModal, setShowModal] = useState(false); // Para nuevas listas
    const [showProductModal, setShowProductModal] = useState(false); // Para nuevos productos
    const [editItem, setEditItem] = useState(null); 
    const [formData, setFormData] = useState({ nombre: "" });
    const [showImporter, setShowImporter] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); // Custom delete confirm modal
    const [deleting, setDeleting] = useState(false);

    const TABS = [
        { id: "clinicos", label: "Lista de precios clínicos" },
        { id: "productos", label: "Lista de precios productos" },
        { id: "servicios", label: "Lista de precios servicios" },
    ];

    // Fetch data on tab change
    const fetchData = async () => {
        if (!inquilino) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            if (activeTab === "productos" || activeTab === "servicios") {
                const { data, error } = await supabase
                    .from("inventario")
                    .select("*")
                    .eq("tenant_id", inquilino);

                if (error) throw error;
                let filtered = (data || []).map(d => ({
                    ...d,
                    precio: d.precio_venta || d.precio || 0
                }));

                filtered = filtered.filter(d => activeTab === "servicios" ? d.es_servicio === true : !d.es_servicio);
                filtered.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setRows(filtered);
            } else {
                const { data, error } = await supabase
                    .from("listas_precios")
                    .select("*")
                    .eq("tenant_id", inquilino);

                if (error) throw error;
                const sorted = (data || []).sort((a, b) => new Date(b.created_at || b.creado || 0) - new Date(a.created_at || a.creado || 0));
                setRows(sorted);
            }
        } catch (error) {
            console.error("Error fetching data from Supabase:", error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setSearchTerm("");
    }, [activeTab, inquilino]);

    const handleSaveList = async () => {
        if (!formData.nombre.trim()) return alert("El nombre es obligatorio");
        if (!inquilino) return;

        try {
            if (editItem) {
                const { error } = await supabase
                    .from("listas_precios")
                    .update({ nombre: formData.nombre.trim() })
                    .eq("id", editItem.id);
                if (error) throw error;
                if (toast?.success) toast.success("Lista actualizada correctamente");
            } else {
                const { error } = await supabase
                    .from("listas_precios")
                    .insert([{
                        nombre: formData.nombre.trim(),
                        tenant_id: inquilino,
                        descripcion: "[]",
                        activa: true
                    }]);
                if (error) throw error;
                if (toast?.success) toast.success("Lista de precios creada correctamente");
            }
            setShowModal(false);
            setFormData({ nombre: "" });
            setEditItem(null);
            fetchData();
        } catch (e) {
            console.error("Error al guardar lista:", e);
            if (toast?.error) toast.error("Error al guardar: " + e.message);
            else alert("Error al guardar: " + e.message);
        }
    };

    const handleSaveProduct = async (productData) => {
        setLoading(true);
        try {
            const dataToSave = {
                nombre: productData.nombre,
                codigo: productData.codigo || "",
                categoria: productData.categoria || "GENERAL",
                precio_venta: Number(productData.precio) || 0,
                es_servicio: activeTab === "servicios",
                tenant_id: inquilino
            };

            if (editItem?.id) {
                const { error } = await supabase
                    .from("inventario")
                    .update(dataToSave)
                    .eq("id", editItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("inventario")
                    .insert([dataToSave]);
                if (error) throw error;
            }
            setShowProductModal(false);
            setEditItem(null);
            if (toast?.success) toast.success("Registro guardado en Supabase");
            fetchData();
        } catch (e) {
            console.error("Error al guardar producto:", e);
            if (toast?.error) toast.error("Error al guardar producto: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // ── CONFIRMAR Y ELIMINAR REGISTRO O LISTA DE PRECIOS ──
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const targetId = deleteTarget.id;
            const targetTable = (activeTab === "productos" || activeTab === "servicios") ? "inventario" : "listas_precios";

            const { error } = await supabase
                .from(targetTable)
                .delete()
                .eq("id", targetId);

            if (error) throw error;

            // Remove from local state immediately
            setRows(prev => prev.filter(r => String(r.id) !== String(targetId)));

            if (toast?.success) toast.success("Registro eliminado correctamente de Supabase");
            else alert("✅ Registro eliminado correctamente.");

            setDeleteTarget(null);
            fetchData();
        } catch (e) {
            console.error("Error al eliminar:", e);
            alert("❌ Error al eliminar el registro: " + (e.message || "Error de permisos"));
        } finally {
            setDeleting(false);
        }
    };

    const handleEdit = (row) => {
        setEditItem(row);
        if (activeTab === "productos" || activeTab === "servicios") {
            setShowProductModal(true);
        } else {
            setFormData({ nombre: row.nombre });
            setShowModal(true);
        }
    };

    const handleEditor = (row) => {
        setSelectedList(row);
        setView("editor");
    };

    const handleNew = () => {
        setEditItem(null);
        if (activeTab === "productos" || activeTab === "servicios") {
            setShowProductModal(true);
        } else {
            setFormData({ nombre: "" });
            setShowModal(true);
        }
    };

    if (view === "editor" && selectedList) {
        return (
            <ListaPreciosEditar 
                listaId={selectedList.id} 
                onBack={() => {
                    setView("list");
                    setSelectedList(null);
                    fetchData();
                }} 
            />
        );
    }

    const filteredRows = rows.filter(r => (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            {/* Top Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0 ${
                                activeTab === tab.id
                                    ? "bg-white text-blue-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            {tab.label.replace("Lista de precios ", "")}
                        </button>
                    ))}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar lista..."
                            className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors w-48 sm:w-60"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setShowImporter(true)}
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Importar desde Excel"
                    >
                        <FiUploadCloud size={16} className="text-blue-600" />
                        <span className="hidden sm:inline">Importar Excel</span>
                    </button>

                    <button
                        onClick={handleNew}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider px-4 py-2 rounded-xl shadow-md shadow-blue-200 flex items-center gap-1.5 transition-all cursor-pointer border-0"
                    >
                        <span className="text-base leading-none">+</span>
                        <span>Nueva Lista</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            {activeTab === "productos" ? <FiBox size={16} /> : <FiDollarSign size={16} />}
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                {TABS.find(t => t.id === activeTab)?.label}
                            </h2>
                            <p className="text-[11px] font-medium text-slate-500">Gestión de tarifarios institucionales y catálogo</p>
                        </div>
                    </div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{filteredRows.length} Registros</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                                <th className="py-3 px-4">Nombre</th>
                                {activeTab === "productos" || activeTab === "servicios" ? (
                                    <>
                                        <th className="py-3 px-4">Código</th>
                                        <th className="py-3 px-4">Categoría</th>
                                        <th className="py-3 px-4 text-right">Precio Venta</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="py-3 px-4">Creación</th>
                                        <th className="py-3 px-4">Actualización</th>
                                        <th className="py-3 px-4">Estado</th>
                                    </>
                                )}
                                <th className="py-3 px-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                        <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                        Cargando datos...
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                        No se encontraron listas o productos registrados
                                    </td>
                                </tr>
                            ) : activeTab === "productos" || activeTab === "servicios" ? (
                                // TABLA DE PRODUCTOS / SERVICIOS
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-4 font-bold text-slate-800 uppercase">{row.nombre}</td>
                                        <td className="py-3 px-4 font-mono text-slate-500">{row.codigo || "-"}</td>
                                        <td className="py-3 px-4">
                                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md font-bold text-[10px] uppercase">
                                                {row.categoria || "GENERAL"}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-black text-slate-800">
                                            ${Number(row.precio || 0).toLocaleString("es-CO")}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleEdit(row)}
                                                    className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors border-0 cursor-pointer"
                                                    title="Editar"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(row)}
                                                    className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors border-0 cursor-pointer"
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                // TABLA DE LISTAS
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 uppercase tracking-tight">{row.nombre}</span>
                                                <span className="text-[10px] font-mono text-slate-400">ID: {row.id ? String(row.id).substring(0, 8) : '-'}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 font-mono text-slate-500">{formatDate(row.creado || row.created_at)}</td>
                                        <td className="py-3 px-4 font-mono text-slate-500">{formatDate(row.actualizado || row.updated_at)}</td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Activa
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleEditor(row)}
                                                    className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors border-0 cursor-pointer"
                                                    title="Ver / Configurar Ítems"
                                                >
                                                    <FiEye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(row)}
                                                    className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors border-0 cursor-pointer"
                                                    title="Editar nombre"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(row)}
                                                    className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors border-0 cursor-pointer"
                                                    title="Eliminar Lista"
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

            {/* Modal CRUD - Para Listas */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                                    <FiDollarSign size={18} />
                                </div>
                                <h3 className="text-base font-black text-slate-800 uppercase">{editItem ? "Editar Lista de Precios" : "Nueva Lista de Precios"}</h3>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 font-bold">&times;</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre Descriptivo *</label>
                                <input
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    value={formData.nombre}
                                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    placeholder="Ej. Tarifas Preferenciales 2026"
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer"
                                >
                                    Descartar
                                </button>
                                <button
                                    onClick={handleSaveList}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-200 flex items-center gap-1.5 cursor-pointer border-0"
                                >
                                    {editItem ? "Actualizar" : "Crear Lista"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Producto */}
            {showProductModal && (
                <ModalProducto 
                    item={editItem}
                    categoria={editItem?.categoria || "GENERAL"}
                    onClose={() => setShowProductModal(false)}
                    onSave={handleSaveProduct}
                    loading={loading}
                />
            )}

            {/* Modal Importer */}
            {showImporter && (
                <ImportadorListaPrecios 
                    activeTab={activeTab}
                    onClose={() => setShowImporter(false)}
                    onComplete={() => {
                        fetchData();
                        setShowImporter(false);
                    }}
                />
            )}

            {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN MODERNO Y 100% FIABLE */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-rose-100 p-6 space-y-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                                <FiAlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">¿Eliminar Registro?</h3>
                                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Esta acción borrará el ítem de Supabase</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-700 uppercase">
                                Estás a punto de eliminar: <span className="text-blue-600 font-black">{deleteTarget.nombre}</span>
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-200 flex items-center gap-2 border-0 disabled:opacity-50"
                            >
                                {deleting ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <FiTrash2 size={16} />
                                )}
                                <span>{deleting ? "Eliminando..." : "Sí, Eliminar Ahora"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
