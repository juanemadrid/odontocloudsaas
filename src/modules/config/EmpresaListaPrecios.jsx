import React, { useState, useEffect } from "react";
// 
import { FiSearch, FiEdit2, FiEye, FiTrash2, FiDollarSign, FiUploadCloud, FiBox } from "react-icons/fi";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import ListaPreciosEditar from "./ListaPreciosEditar";
import ImportadorListaPrecios from "./ImportadorListaPrecios";
import ModalProducto from "./ModalProducto";

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

// MAIN COMPONENT
export default function EmpresaListaPrecios() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [activeTab, setActiveTab] = useState("clinicos"); // clinicos, productos, servicios
    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // View State: 'list' or 'editor'
    const [view, setView] = useState("list");
    const [selectedList, setSelectedList] = useState(null);

    // Modal State
    const [showModal, setShowModal] = useState(false); // Para nuevas listas
    const [showProductModal, setShowProductModal] = useState(false); // Para nuevos productos
    const [editItem, setEditItem] = useState(null); 
    const [formData, setFormData] = useState({ nombre: "" });
    const [showImporter, setShowImporter] = useState(false);

    const TABS = [
        { id: "clinicos", label: "Lista de precios clínicos" },
        { id: "productos", label: "Lista de precios productos" },
        { id: "servicios", label: "Lista de precios servicios" },
    ];

    // Fetch data on tab change
    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            if (activeTab === "productos" || activeTab === "servicios") {
                let q = query(
                    collection(db, "productos"),
                    where("inquilino", "==", inquilino)
                );
                const snap = await getDocs(q);
                let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Filtrar según pestaña actual
                data = data.filter(d => activeTab === "servicios" ? d.es_servicio === true : d.es_servicio !== true);
                
                data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setRows(data);
            } else {
                let q = query(
                    collection(db, "listas_precios"),
                    where("tipo", "==", activeTab),
                    where("inquilino", "==", inquilino)
                );
                const snap = await getDocs(q);
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort locally
                data.sort((a, b) => {
                    const da = a.creado?.seconds || 0;
                    const db = b.creado?.seconds || 0;
                    return db - da; // Descending
                });
                setRows(data);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setSearchTerm("");
    }, [activeTab]);

    const handleSaveList = async () => {
        if (!formData.nombre.trim()) return alert("El nombre es obligatorio");
        if (!inquilino) return;

        try {
            if (editItem) {
                // Update
                await updateDoc(doc(db, "listas_precios", editItem.id), {
                    nombre: formData.nombre,
                    actualizado: new Date()
                });
                alert("Lista actualizada");
            } else {
                // Create
                await addDoc(collection(db, "listas_precios"), {
                    nombre: formData.nombre,
                    tipo: activeTab,
                    inquilino,
                    creado: new Date(),
                    actualizado: new Date(),
                    en_uso: false
                });
                alert("Lista creada");
            }
            setShowModal(false);
            setFormData({ nombre: "" });
            setEditItem(null);
            fetchData();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        }
    };

    const handleSaveProduct = async (productData) => {
        setLoading(true);
        try {
            const dataToSave = {
                ...productData,
                inquilino,
                actualizado: new Date()
            };
            if (editItem) {
                await updateDoc(doc(db, "productos", editItem.id), dataToSave);
            } else {
                await addDoc(collection(db, "productos"), {
                    ...dataToSave,
                    creado: new Date()
                });
            }
            setShowProductModal(false);
            setEditItem(null);
            fetchData();
        } catch (e) {
            console.error(e);
            alert("Error al guardar producto: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (row) => {
        if (activeTab === "productos" || activeTab === "servicios") {
            if (!window.confirm(`¿Seguro eliminar el registro "${row.nombre}"?`)) return;
            try {
                await deleteDoc(doc(db, "productos", row.id));
                fetchData();
            } catch (e) {
                alert("Error al eliminar");
            }
        } else {
            if (!window.confirm(`¿Seguro eliminar lista "${row.nombre}"?`)) return;
            try {
                await deleteDoc(doc(db, "listas_precios", row.id));
                fetchData();
            } catch (e) {
                alert("Error al eliminar lista");
            }
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
        if (activeTab === "productos" || activeTab === "servicios") {
            setEditItem({ es_servicio: activeTab === "servicios" });
            setShowProductModal(true);
        } else {
            setEditItem(null);
            setFormData({ nombre: "" });
            setShowModal(true);
        }
    };

    const filteredRows = rows.filter(r =>
        (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.codigo || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (view === "editor" && selectedList) {
        return <ListaPreciosEditar listaId={selectedList.id} onBack={() => { setView("list"); setSelectedList(null); }} />;
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            {loading && (
                <div className="absolute top-4 right-4 z-50">
                    <div className="w-4 h-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                </div>
            )}

            {/* Header Toolbar */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/80">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-1.5 text-[12px] font-bold rounded-md transition-all cursor-pointer border-0 ${activeTab === tab.id
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700 bg-transparent"
                                }`}
                        >
                            {tab.id === "clinicos" ? "Clínicos" : tab.id === "productos" ? "Productos" : "Servicios"}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                    <div className="relative flex-1 md:w-48">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder={(activeTab === "productos" || activeTab === "servicios") ? "Buscar..." : "Buscar lista..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    
                    {/* Botón de importación */}
                    <button
                        type="button"
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 text-[12px] cursor-pointer"
                        onClick={() => setShowImporter(true)}
                    >
                        <FiUploadCloud size={15} /> <span>Importar Excel</span>
                    </button>

                    {/* Botón Nuevo */}
                    <button
                        type="button"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 text-[12px] cursor-pointer border-0"
                        onClick={handleNew}
                    >
                        <span>
                            {activeTab === "productos" ? "+ Nuevo Producto" : activeTab === "servicios" ? "+ Nuevo Servicio" : "+ Nueva Lista"}
                        </span>
                    </button>
                </div>
            </div>

            {/* Container Seccional */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            {(activeTab === "productos" || activeTab === "servicios") ? <FiBox size={16} /> : <FiDollarSign size={16} />}
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold text-slate-800">
                                {activeTab === "productos" ? "Catálogo Maestro de Productos" : activeTab === "servicios" ? "Catálogo de Servicios" : TABS.find(t => t.id === activeTab)?.label}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                {activeTab === "productos" ? "Gestión global del inventario" : activeTab === "servicios" ? "Gestión global de servicios" : "Gestión de tarifarios institucionales"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Table Area */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70">
                                {(activeTab === "productos" || activeTab === "servicios") ? (
                                    <>
                                        <th className="py-2.5 px-4 text-left font-bold text-slate-600">Cód / Ref</th>
                                        <th className="py-2.5 px-4 text-left font-bold text-slate-600">Producto</th>
                                        <th className="py-2.5 px-4 text-left font-bold text-slate-600">Categoría</th>
                                        <th className="py-2.5 px-4 text-right font-bold text-slate-600">Precio Venta</th>
                                        <th className="py-2.5 px-4 text-right font-bold text-slate-600">Acciones</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="py-2.5 px-4 text-left font-bold text-slate-600">Nombre</th>
                                        <th className="py-2.5 px-4 text-left font-bold text-slate-600">Creación</th>
                                        <th className="py-2.5 px-4 text-left font-bold text-slate-600">Actualización</th>
                                        <th className="py-2.5 px-4 text-left font-bold text-slate-600">Estado</th>
                                        <th className="py-2.5 px-4 text-right font-bold text-slate-600">Acciones</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && filteredRows.length === 0 ? (
                                [1, 2, 3].map((n) => (
                                    <tr key={n} className="animate-pulse">
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="h-4 bg-slate-100 rounded w-20" />
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="h-4 bg-slate-100 rounded w-40" />
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="h-4 bg-slate-100 rounded w-24" />
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <div className="h-4 bg-slate-100 rounded w-16" />
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
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            {(activeTab === "productos" || activeTab === "servicios") ? <FiBox size={40} className="text-slate-400" /> : <FiDollarSign size={40} className="text-slate-400" />}
                                            <p className="text-sm font-bold text-slate-400">No hay registros disponibles</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (activeTab === "productos" || activeTab === "servicios") ? (
                                // TABLA DE PRODUCTOS / SERVICIOS
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="group/row hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">{row.codigo || row.referencia || "-"}</span>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50 transition-all group-hover/row:translate-x-1">
                                            <span className="text-[14px] font-black text-slate-700 uppercase tracking-tight">{row.nombre}</span>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-500">
                                                {row.categoria || 'GENERAL'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50 text-right">
                                            <span className="text-[14px] font-black text-emerald-600">${Number(row.precio || 0).toLocaleString('es-CO')}</span>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleEdit(row)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Editar Producto"
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
                            ) : (
                                // TABLA DE LISTAS
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="group/row hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-4 border-b border-slate-50 transition-all group-hover/row:translate-x-1">
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-black text-slate-700 group-hover/row:text-blue-600 transition-colors uppercase tracking-tight">{row.nombre}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {row.id.substring(0, 8)}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <span className="text-[12px] font-bold text-slate-600">{formatDate(row.creado)}</span>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <span className="text-[12px] font-bold text-slate-600">{formatDate(row.actualizado)}</span>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            {row.en_uso ? (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">En uso</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Borrador</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleEditor(row)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Ver / Configurar Ítems"
                                                >
                                                    <FiEye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(row)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Editar nombre"
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

            {/* Modal CRUD - Para Listas (Clínicos, Servicios) */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-50/70 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <FiDollarSign size={16} />
                                </div>
                                <h3 className="text-[15px] font-bold text-slate-800">{editItem ? "Editar Lista de Precios" : "Nueva Lista de Precios"}</h3>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre Descriptivo *</label>
                                <input
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    value={formData.nombre}
                                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    placeholder="Ej. Tarifas Preferenciales 2026"
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 bg-white cursor-pointer"
                                >
                                    Descartar
                                </button>
                                <button
                                    onClick={handleSaveList}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer border-0"
                                >
                                    {editItem ? "Actualizar" : "Crear Lista"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Producto - Global */}
            {showProductModal && (
                <ModalProducto 
                    item={editItem}
                    categoria={editItem?.categoria || "GENERAL"}
                    onClose={() => setShowProductModal(false)}
                    onSave={handleSaveProduct}
                    loading={loading}
                />
            )}

            {/* Importer Modal */}
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
        </div>
    );
}
