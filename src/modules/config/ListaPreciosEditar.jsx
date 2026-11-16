
import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { 
    FiArrowLeft, FiPlus, FiTrash2, FiEdit3, FiSave, FiX, FiSearch, FiCheck, 
    FiChevronDown, FiChevronRight, FiPercent, FiPlusCircle, FiDownload, FiFolder
} from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { CUPS_ODONTOLOGIA } from "../../data/cupsOdontologia";
import ModalProducto from "./ModalProducto";
import { useToast } from "../../context/ToastContext";
import { getConfigSection, saveConfigSection } from "../../services/configPersistenceService";

import { todayBogota } from "../../utils/bogotaDate";
// Helper: parse items stored as JSON string in descripcion field
const parseItems = (descripcion) => {
    try {
        const parsed = typeof descripcion === "string" ? JSON.parse(descripcion) : descripcion;
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
};

// Las categorías vacías se guardan en la configuración de la clínica: { [listaId]: ["CATEGORÍA", ...] }
const CATEGORIAS_KEY = "listas_precios_categorias";

// Helper: generate a simple UUID for new items
const genId = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

export default function ListaPreciosEditar({ listaId, onBack }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();

    // Ajuste global de precios (aumentar o disminuir un % a toda la lista)
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [ajusteTipo, setAjusteTipo] = useState("aumentar");
    const [ajustePct, setAjustePct] = useState("");
    const [ajusteRedondeo, setAjusteRedondeo] = useState("100");
    const [ajusteSaving, setAjusteSaving] = useState(false);

    const [listData, setListData] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedCats, setExpandedCats] = useState(new Set());
    
    // Edit state for List Name
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState("");

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null); // null for new, item object for edit
    const [targetCat, setTargetCat] = useState(null);

    // Category Modal State
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [customCategories, setCustomCategories] = useState([]);
    
    const initialItemState = {
        nombre: "",
        codigo: "",
        precio: "",
        observaciones: "",
        pago_fijo_doctor: "",
        usar_pago_fijo: false,
        permite_descuento: false,
        max_descuento_porcentaje: "",
        max_descuento_valor: "",
        genera_rips: false,
        es_consulta: false
    };

    const [formData, setFormData] = useState(initialItemState);

    // CUPS Search UI State
    const [cupsQuery, setCupsQuery] = useState("");
    const [showCupsDropdown, setShowCupsDropdown] = useState(false);
    
    // Memoized filtering for CUPS
    const filteredCUPS = useMemo(() => {
        if (!cupsQuery || cupsQuery.length < 2) return [];
        // Busca en TODOS los códigos CUPS oficiales de odontología y sus especialidades (461),
        // por código o por palabras del nombre, sin importar tildes ni el orden de las palabras.
        const plain = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const words = plain(cupsQuery).split(/\s+/).filter(Boolean);
        return CUPS_ODONTOLOGIA.filter(c => {
            const text = `${c.code} ${plain(c.name)} ${plain(c.category)}`;
            return words.every(w => text.includes(w));
        }).slice(0, 30);
    }, [cupsQuery]);

    const fetchListInfo = async () => {
        const { data, error } = await supabase
            .from("listas_precios")
            .select("*")
            .eq("id", listaId)
            .single();
        if (!error && data) {
            setListData(data);
            setTempName(data.nombre);
            // Load items from JSON stored in descripcion
            const parsedItems = parseItems(data.descripcion);
            const sorted = parsedItems.sort((a, b) => {
                const catA = (a.categoria || "GENERAL").toUpperCase();
                const catB = (b.categoria || "GENERAL").toUpperCase();
                if (catA < catB) return -1;
                if (catA > catB) return 1;
                return (a.nombre || "").localeCompare(b.nombre || "");
            });
            setItems(sorted);
            if (sorted.length > 0) {
                setExpandedCats(new Set([sorted[0].categoria || "GENERAL"]));
            }
        } else if (error) {
            console.error("Error fetching lista:", error);
        }
    };

    // Save all items back to Supabase as JSON in descripcion field
    const saveItemsToSupabase = async (updatedItems) => {
        const { error } = await supabase
            .from("listas_precios")
            .update({ descripcion: JSON.stringify(updatedItems) })
            .eq("id", listaId);
        if (error) throw error;
        setItems(updatedItems);
    };

    const fetchItems = async () => {
        if (!listaId) return;
        setLoading(true);
        try {
            await fetchListInfo();
        } catch (e) {
            console.error("Error fetching items:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchListInfo();
    }, [listaId]);

    // Categorías creadas sin ítems (guardadas en la configuración de la clínica)
    useEffect(() => {
        if (!inquilino || !listaId) return;
        let alive = true;
        getConfigSection(inquilino, CATEGORIAS_KEY, {})
            .then(map => {
                const list = map && typeof map === "object" && Array.isArray(map[listaId]) ? map[listaId] : [];
                if (alive) setCustomCategories(list.map(c => String(c).toUpperCase()).filter(Boolean));
            })
            .catch(e => console.error("Error cargando categorías de la lista:", e));
        return () => { alive = false; };
    }, [inquilino, listaId]);

    const persistCustomCategories = async (nextList) => {
        const current = await getConfigSection(inquilino, CATEGORIAS_KEY, {});
        const map = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
        if (nextList.length > 0) map[listaId] = nextList;
        else delete map[listaId];
        await saveConfigSection(inquilino, CATEGORIAS_KEY, map);
    };

    // Group items by category
    const groupedData = useMemo(() => {
        const groups = items.reduce((acc, item) => {
            const cat = item.categoria || "GENERAL";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});
        return groups;
    }, [items]);

    const categories = useMemo(() => {
        const setOfCats = new Set([...Object.keys(groupedData), ...customCategories]);
        return Array.from(setOfCats).filter(Boolean).sort();
    }, [groupedData, customCategories]);

    const handleSaveCategory = async (e) => {
        if (e) e.preventDefault();
        const trimmed = newCategoryName.trim().toUpperCase();
        if (!trimmed) return;

        if (!categories.includes(trimmed)) {
            const nextList = Array.from(new Set([...customCategories, trimmed]));
            try {
                await persistCustomCategories(nextList);
                setCustomCategories(nextList);
            } catch (err) {
                console.error("Error guardando la categoría:", err);
                toast?.error?.("No se pudo guardar la categoría: " + (err.message || "Error de conexión"));
                return;
            }
        }
        setExpandedCats(prev => new Set([...prev, trimmed]));
        setNewCategoryName("");
        setShowCategoryModal(false);
        toast?.success?.(`Categoría ${trimmed} guardada`);
    };

    const handleDeleteCategory = async (cat) => {
        if (!window.confirm(`¿Seguro que deseas eliminar la categoría "${cat}" y todos sus ítems de esta lista?`)) return;
        try {
            const updatedItems = items.filter(item => (item.categoria || "GENERAL") !== cat);
            if (updatedItems.length !== items.length) await saveItemsToSupabase(updatedItems);
            if (customCategories.includes(cat)) {
                const nextList = customCategories.filter(c => c !== cat);
                await persistCustomCategories(nextList);
                setCustomCategories(nextList);
            }
        } catch (err) {
            console.error("Error eliminando la categoría:", err);
            toast?.error?.("No se pudo eliminar la categoría: " + (err.message || "Error de conexión"));
        }
    };

    // ---- Ajuste global de precios ----
    const ajusteNum = Number(String(ajustePct).replace(",", "."));
    const ajusteValido = Number.isFinite(ajusteNum) && ajusteNum > 0 && (ajusteTipo === "aumentar" || ajusteNum < 100);
    const ajustarPrecio = (precio) => {
        const base = Number(precio) || 0;
        if (!ajusteValido || base <= 0) return base;
        const factor = ajusteTipo === "aumentar" ? 1 + ajusteNum / 100 : 1 - ajusteNum / 100;
        const paso = Number(ajusteRedondeo) || 1;
        return Math.max(0, Math.round((base * factor) / paso) * paso);
    };
    const ajusteEjemplo = items.find(it => Number(it.precio) > 0);

    const handleAplicarAjuste = async () => {
        if (!ajusteValido) return;
        const conPrecio = items.filter(it => Number(it.precio) > 0).length;
        if (!conPrecio) { toast?.error?.("La lista no tiene tratamientos con precio."); return; }
        setAjusteSaving(true);
        try {
            const ahora = new Date().toISOString();
            const updatedItems = items.map(it => {
                if (!(Number(it.precio) > 0)) return it;
                const precio = ajustarPrecio(it.precio);
                const pct = Number(it.max_descuento_porcentaje) || 0;
                return {
                    ...it,
                    precio,
                    // el descuento máximo en pesos sigue el mismo porcentaje sobre el nuevo precio
                    max_descuento_valor: pct > 0 ? Math.round((pct / 100) * precio) : (Number(it.max_descuento_valor) || 0),
                    actualizado: ahora
                };
            });
            await saveItemsToSupabase(updatedItems);
            setShowAjusteModal(false);
            setAjustePct("");
            toast?.success?.(`Precios ${ajusteTipo === "aumentar" ? "aumentados" : "disminuidos"} ${ajusteNum}% en ${conPrecio} tratamientos`);
        } catch (err) {
            console.error("Error en el ajuste global:", err);
            toast?.error?.("No se pudo aplicar el ajuste: " + (err.message || "Error de conexión"));
        } finally {
            setAjusteSaving(false);
        }
    };

    const toggleCat = (cat) => {
        const next = new Set(expandedCats);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        setExpandedCats(next);
    };

    const handleUpdateListName = async () => {
        if (!tempName.trim()) return;
        try {
            const { error } = await supabase
                .from("listas_precios")
                .update({ nombre: tempName.toUpperCase() })
                .eq("id", listaId);
            if (error) throw error;
            setIsEditingName(false);
            setListData(prev => ({ ...prev, nombre: tempName.toUpperCase() }));
        } catch (e) { console.error("Error actualizando nombre:", e); }
    };

    const handleOpenModal = (cat, item = null) => {
        setTargetCat(cat);
        setCurrentItem(item);
        setFormData(item ? { ...initialItemState, ...item } : { ...initialItemState });
        setCupsQuery("");
        setShowCupsDropdown(false);
        setShowModal(true);
    };

    const handleSelectCUPS = (cups) => {
        setFormData(prev => ({
            ...prev,
            codigo: cups.code,
            // Only overwrite name if it's currently empty or previously equal to a CUPS name
            nombre: !prev.nombre ? cups.name : prev.nombre
        }));
        setCupsQuery(cups.code);
        setShowCupsDropdown(false);
    };

    // Helper to format currency for display in inputs
    const formatCOP = (val) => {
        if (val === "" || val === undefined || val === null) return "";
        return Number(val).toLocaleString('es-CO');
    };

    // Helper to parse formatted string back to number
    const parseCOP = (str) => {
        if (!str) return "";
        // Remove everything that isn't a digit
        const numericVal = String(str).replace(/\D/g, "");
        return numericVal === "" ? "" : Number(numericVal);
    };

    const handleSaveItem = async () => {
        if (!formData.nombre.trim()) return;
        setLoading(true);
        try {
            const itemData = {
                ...formData,
                categoria: targetCat || "GENERAL",
                precio: Number(formData.precio) || 0,
                pago_fijo_doctor: Number(formData.pago_fijo_doctor) || 0,
                max_descuento_porcentaje: Number(formData.max_descuento_porcentaje) || 0,
                max_descuento_valor: Number(formData.max_descuento_valor) || 0,
                search_name: formData.nombre.toLowerCase(),
                actualizado: new Date().toISOString()
            };

            let updatedItems;
            if (currentItem) {
                // UPDATE: replace item by id
                updatedItems = items.map(it => it.id === currentItem.id ? { ...it, ...itemData } : it);
            } else {
                // CREATE: add new item with generated id
                const newItem = { ...itemData, id: genId(), creado: new Date().toISOString() };
                updatedItems = [...items, newItem];
            }

            await saveItemsToSupabase(updatedItems);
            setShowModal(false);
        } catch (e) { 
            console.error("Error al guardar ítem:", e); 
            alert("Error al guardar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProducto = async (productData) => {
        setLoading(true);
        try {
            const itemData = {
                ...productData,
                categoria: targetCat || "GENERAL",
                actualizado: new Date().toISOString()
            };

            let updatedItems;
            if (currentItem) {
                updatedItems = items.map(it => it.id === currentItem.id ? { ...it, ...itemData } : it);
            } else {
                updatedItems = [...items, { ...itemData, id: genId(), creado: new Date().toISOString() }];
            }

            await saveItemsToSupabase(updatedItems);
            setShowModal(false);
        } catch (e) { 
            console.error("Error al guardar producto:", e); 
            alert("Error al guardar producto: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm("¿Seguro que deseas eliminar este ítem de la lista?")) return;
        setLoading(true);
        try {
            const updatedItems = items.filter(item => item.id !== itemId);
            await saveItemsToSupabase(updatedItems);
        } catch (e) { 
            console.error("Error al eliminar ítem:", e); 
            alert("Error al eliminar el ítem: " + (e.message || "Error desconocido"));
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!items || items.length === 0) return;
        
        try {
            // Prepare data for Excel
            const exportData = items.map(it => ({
                CATEGORIA: it.categoria || "GENERAL",
                CODIGO: it.codigo || "",
                NOMBRE: it.nombre || "",
                PRECIO: it.precio || 0,
                CODIGO_CUPS: it.codigo || "",
                OBSERVACIONES: it.observaciones || "",
                PAGO_FIJO_DOCTOR: it.pago_fijo_doctor || 0,
                MAX_DESC_PORC: it.max_descuento_porcentaje || 0,
                MAX_DESC_VAL: it.max_descuento_valor || 0,
                GENERA_RIPS: it.genera_rips ? "SÍ" : "NO",
                ES_CONSULTA: it.es_consulta ? "SÍ" : "NO"
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Lista de Precios");
            
            // Generate filename
            const fileName = `LISTA_${listData?.nombre || 'PRECIOS'}_${todayBogota()}.xlsx`;
            XLSX.writeFile(workbook, fileName);
        } catch (error) {
            console.error("Error exporting:", error);
            alert("No se pudo exportar el archivo.");
        }
    };

    return (
        <div className="p-1.5 sm:p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            {/* Top Toolbar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer border border-slate-200 bg-white"
                        title="Volver"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-[17px] font-bold text-slate-800">Edición Lista de Precios</h1>
                        <p className="text-[12px] text-slate-500">Configuración de tarifario y precios por categoría</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleExportExcel}
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 text-[12px] cursor-pointer"
                    >
                        <FiDownload size={15} /> <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                
                {/* Global Controls Bar */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-[12px] font-bold text-slate-600">Nombre *</span>
                        {isEditingName ? (
                            <div className="flex items-center gap-1.5">
                                <input 
                                    className="h-8 bg-white border border-blue-400 rounded-lg px-3 text-[13px] font-bold text-slate-800 outline-none"
                                    value={tempName}
                                    onChange={e => setTempName(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleUpdateListName} className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center border-0 cursor-pointer"><FiCheck size={14} /></button>
                                <button onClick={() => { setIsEditingName(false); setTempName(listData?.nombre || ""); }} className="w-7 h-7 bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center border-0 cursor-pointer"><FiX size={14} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-[14px] font-bold text-slate-800">{listData?.nombre}</span>
                                <button onClick={() => setIsEditingName(true)} className="w-6 h-6 rounded text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent" title="Editar nombre"><FiEdit3 size={13} /></button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { setAjusteTipo("aumentar"); setAjustePct(""); setShowAjusteModal(true); }}
                            disabled={items.length === 0}
                            title={items.length === 0 ? "La lista no tiene tratamientos" : "Aumentar o disminuir todos los precios en un porcentaje"}
                            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-[12px] font-bold flex items-center gap-1.5 cursor-pointer shadow-sm border-0">
                            <FiPercent size={14} /> <span>Ajuste global %</span>
                        </button>
                        <button 
                            onClick={() => {
                                setNewCategoryName("");
                                setShowCategoryModal(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                        >
                            <FiPlus size={16} /> <span>Agregar categoría</span>
                        </button>
                    </div>
                </div>

                {/* Categories List */}
                <div className="p-4 space-y-3">
                    {categories.map(cat => {
                        const isExpanded = expandedCats.has(cat);
                        const catItems = groupedData[cat] || [];
                        
                        return (
                            <div key={cat} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                                {/* Category Header */}
                                <div 
                                    className="px-4 py-2.5 flex justify-between items-center cursor-pointer border-b border-slate-100 bg-slate-50/70 hover:bg-slate-100/60 transition-colors"
                                    onClick={() => toggleCat(cat)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="text-slate-500 w-5 flex items-center justify-center">
                                            {isExpanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-700">Categoría:</span>
                                        <span className="text-[13px] font-bold text-blue-600">{cat}</span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between flex-1 pl-6">
                                        <span className="text-[12px] text-slate-400 font-medium hidden md:inline">({catItems.length} ítems)</span>
                                        
                                        {/* Category Actions */}
                                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                            <button 
                                                onClick={() => handleOpenModal(cat)}
                                                className="w-7 h-7 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm border-0 cursor-pointer transition-colors"
                                                title="Agregar producto"
                                            >
                                                <FiPlus size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteCategory(cat)} 
                                                className="w-7 h-7 rounded-md bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-sm border-0 cursor-pointer transition-colors" 
                                                title="Eliminar categoría"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content (Items Table) */}
                                {isExpanded && (
                                    <div className="bg-white">
                                        {catItems.length === 0 ? (
                                            <div className="p-6 text-center text-slate-400 text-[13px] font-medium italic">
                                                Esta categoría no contiene ítems aún. Utiliza el botón de abajo o el botón verde arriba para agregar un producto.
                                            </div>
                                        ) : (
                                            <table className="w-full text-left border-collapse text-[12px]">
                                                <thead>
                                                    <tr className="border-b border-slate-200 bg-slate-50/30">
                                                        <th className="py-2.5 px-4 font-bold text-slate-600 w-32">Código</th>
                                                        <th className="py-2.5 px-4 font-bold text-slate-600">Producto</th>
                                                        <th className="py-2.5 px-4 font-bold text-slate-600 w-32 text-center">Permite desc.</th>
                                                        <th className="py-2.5 px-4 font-bold text-slate-600 w-36">Precio</th>
                                                        <th className="py-2.5 px-4 font-bold text-slate-600 w-28 text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {catItems.map(item => (
                                                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                                            <td className="py-2.5 px-4 text-slate-600 font-mono">
                                                                {item.codigo || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-slate-800 font-semibold">
                                                                {item.nombre}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-center text-slate-600">
                                                                {item.permite_descuento ? 'Sí' : 'No'}
                                                            </td>
                                                            <td className="py-2.5 px-4 font-bold text-slate-700">
                                                                ${Number(item.precio || 0).toLocaleString('es-CO')}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-right">
                                                                <div className="flex justify-end gap-1.5">
                                                                    <button onClick={() => handleOpenModal(cat, item)} className="w-7 h-7 rounded-md bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-sm border-0 cursor-pointer transition-colors" title="Editar"><FiEdit3 size={13} /></button>
                                                                    <button onClick={() => handleDeleteItem(item.id)} className="w-7 h-7 rounded-md bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-sm border-0 cursor-pointer transition-colors" title="Eliminar"><FiTrash2 size={13} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}

                                        {/* Nested Add Link */}
                                        <div className="p-3 flex justify-center border-t border-slate-100">
                                            <button 
                                                onClick={() => handleOpenModal(cat)}
                                                className="text-[12px] text-blue-600 hover:text-blue-700 font-semibold transition-colors flex items-center gap-1 border-0 bg-transparent cursor-pointer"
                                            >
                                                <FiPlus size={14} /> <span>Agregar producto a esta categoría</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {categories.length === 0 && !loading && (
                        <div className="p-20 flex flex-col items-center justify-center opacity-30 select-none">
                             <div className="w-24 h-24 rounded-full bg-white border-2 border-dashed border-slate-300 flex items-center justify-center mb-6">
                                <FiPlus size={48} className="text-slate-300" />
                             </div>
                             <h4 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Sin Categorías</h4>
                             <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest text-center max-w-xs">Configura las categorías de tu tarifario para comenzar.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Avanzado de Edición Múltiple */}
            {showModal && listData?.tipo === "productos" ? (
                <ModalProducto 
                    item={currentItem}
                    categoria={targetCat}
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveProducto}
                    loading={loading}
                />
            ) : showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[1100] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                    <FiEdit3 size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-base font-bold text-slate-800">
                                        {currentItem ? 'Editar producto' : 'Agregar producto'}
                                    </h3>
                                    <span className="text-xs font-medium text-slate-500">Categoría: {targetCat}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowModal(false)} 
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors border-0 bg-transparent cursor-pointer"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Modal Content - Scrollable Area */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                            
                            {/* Row 1: Codigo & Nombre */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5 relative">
                                    <label className="text-xs font-semibold text-slate-700">Código CUPS *</label>
                                    <div className="relative">
                                        <input 
                                            className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 uppercase placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                            value={formData.codigo}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                setFormData({...formData, codigo: val});
                                                setCupsQuery(val);
                                                setShowCupsDropdown(true);
                                            }}
                                            onFocus={() => setShowCupsDropdown(true)}
                                            placeholder="BUSCAR CUPS..."
                                        />
                                        
                                        {/* CUPS Suggestions Dropdown */}
                                        {showCupsDropdown && filteredCUPS.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 shadow-xl rounded-lg z-50 p-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                                                {filteredCUPS.map(c => (
                                                    <div
                                                        key={c.code}
                                                        onClick={() => handleSelectCUPS(c)}
                                                        className="p-2.5 hover:bg-blue-50 rounded-md cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors group/cups"
                                                    >
                                                        <div className="flex flex-col">
                                                            <div className="text-xs font-bold text-slate-800 group-hover/cups:text-blue-600">{c.name}</div>
                                                            <div className="text-[10px] font-medium text-slate-400">{c.code}</div>
                                                        </div>
                                                        <FiCheck className="text-emerald-500 opacity-0 group-hover/cups:opacity-100 transition-opacity" size={16} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Nombre procedimiento *</label>
                                    <input 
                                        className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 uppercase placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                        value={formData.nombre}
                                        onChange={e => setFormData({...formData, nombre: e.target.value.toUpperCase()})}
                                        placeholder="Nombre del procedimiento o producto..."
                                    />
                                </div>
                            </div>

                            {/* Row 2: Precio & Observaciones */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Precio *</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">$</div>
                                        <input 
                                            type="text"
                                            className="w-full h-10 pl-8 pr-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                            value={formatCOP(formData.precio)}
                                            onChange={e => {
                                                const val = parseCOP(e.target.value);
                                                setFormData({...formData, precio: val});
                                            }}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Observaciones</label>
                                    <textarea 
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-h-[40px] max-h-24 resize-y"
                                        value={formData.observaciones}
                                        onChange={e => setFormData({...formData, observaciones: e.target.value})}
                                        placeholder="Notas adicionales..."
                                        rows={1}
                                    />
                                </div>
                            </div>

                            {/* Row 3: Pago Fijo Doctor */}
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 space-y-1.5 w-full">
                                    <label className="text-xs font-semibold text-slate-700">Pago valor fijo a doctores</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">$</div>
                                        <input 
                                            type="text"
                                            className="w-full h-10 pl-8 pr-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                            value={formatCOP(formData.pago_fijo_doctor)}
                                            onChange={e => {
                                                const val = parseCOP(e.target.value);
                                                setFormData({...formData, pago_fijo_doctor: val});
                                            }}
                                            disabled={!formData.usar_pago_fijo}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5 pt-4 md:pt-6">
                                    <input 
                                        type="checkbox" 
                                        id="usarFijo"
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                        checked={formData.usar_pago_fijo}
                                        onChange={e => setFormData({...formData, usar_pago_fijo: e.target.checked})}
                                    />
                                    <label htmlFor="usarFijo" className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                                        Usar este campo para no liquidar por %
                                    </label>
                                </div>
                            </div>

                            {/* Section: Booleans & Limits (RIPS, Consulta, Descuento) */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <label htmlFor="pDesc" className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            id="pDesc"
                                            checked={formData.permite_descuento}
                                            onChange={e => setFormData({...formData, permite_descuento: e.target.checked})}
                                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-xs font-semibold text-slate-700 select-none">Permite Descuento</span>
                                    </label>
                                    <label htmlFor="gRips" className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            id="gRips"
                                            checked={formData.genera_rips}
                                            onChange={e => setFormData({...formData, genera_rips: e.target.checked})}
                                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-xs font-semibold text-slate-700 select-none">Genera RIPS</span>
                                    </label>
                                    <label htmlFor="eCons" className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            id="eCons"
                                            checked={formData.es_consulta}
                                            onChange={e => setFormData({...formData, es_consulta: e.target.checked})}
                                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-xs font-semibold text-slate-700 select-none">Es Consulta</span>
                                    </label>
                                </div>

                                {formData.permite_descuento && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/80 border border-slate-200 rounded-lg">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">Máximo % de Descuento</label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    className="w-full h-10 pr-8 pl-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                                    value={formData.max_descuento_porcentaje}
                                                    onChange={e => {
                                                        const p = e.target.value === "" ? "" : Number(e.target.value);
                                                        const price = Number(formData.precio) || 0;
                                                        const v = p === "" ? "" : Math.round((p / 100) * price);
                                                        setFormData({...formData, max_descuento_porcentaje: p, max_descuento_valor: v});
                                                    }}
                                                    placeholder="0"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">%</div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700">Máximo Valor de Descuento ($)</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">$</div>
                                                <input 
                                                    type="text"
                                                    className="w-full h-10 pl-8 pr-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                                    value={formatCOP(formData.max_descuento_valor)}
                                                    onChange={e => {
                                                        const v = parseCOP(e.target.value);
                                                        const price = Number(formData.precio) || 0;
                                                        const p = v === "" ? "" : (price > 0 ? Number(((v / price) * 100).toFixed(2)) : 0);
                                                        setFormData({...formData, max_descuento_valor: v, max_descuento_porcentaje: p});
                                                    }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end items-center gap-3 shrink-0">
                            <button 
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                Cerrar
                            </button>
                            <button 
                                onClick={handleSaveItem}
                                disabled={loading}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer border-0"
                            >
                                {loading ? 'Guardando...' : (
                                    <>
                                        <FiCheck size={16} /> Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* Modal Agregar Categoría */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[1100] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                    <FiFolder size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Agregar Categoría</h3>
                                    <p className="text-xs text-slate-500 font-medium">Crea una nueva categoría para agrupar ítems</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowCategoryModal(false)} 
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors border-0 bg-transparent cursor-pointer"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveCategory} className="p-4 sm:p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">
                                    Nombre de la categoría *
                                </label>
                                <input 
                                    className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 uppercase placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="EJ: CIRUGÍA ORAL, ENDODONCIA..."
                                    autoFocus
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => setShowCategoryModal(false)}
                                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={!newCategoryName.trim()}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer border-0"
                                >
                                    <FiCheck size={16} /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showAjusteModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[1100] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                                    <FiPercent size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Ajuste global de precios</h3>
                                    <p className="text-xs text-slate-500 font-medium">Cambia todos los precios de esta lista en un porcentaje</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAjusteModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 border-0 bg-transparent cursor-pointer"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                {[["aumentar", "Aumentar"], ["disminuir", "Disminuir"]].map(([val, label]) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setAjusteTipo(val)}
                                        className={`h-10 rounded-lg text-sm font-semibold border cursor-pointer transition-colors ${ajusteTipo === val ? (val === "aumentar" ? "bg-emerald-600 border-emerald-600 text-white" : "bg-rose-600 border-rose-600 text-white") : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Porcentaje *</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoFocus
                                            className="w-full h-10 pl-3.5 pr-8 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                                            value={ajustePct}
                                            onChange={e => setAjustePct(e.target.value.replace(/[^0-9.,]/g, ""))}
                                            placeholder="Ej. 5"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Redondear precios</label>
                                    <select
                                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                                        value={ajusteRedondeo}
                                        onChange={e => setAjusteRedondeo(e.target.value)}
                                    >
                                        <option value="1">Sin redondear</option>
                                        <option value="100">A la centena ($100)</option>
                                        <option value="1000">Al mil ($1.000)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                                <p>Se cambiará el precio de <strong>{items.filter(it => Number(it.precio) > 0).length}</strong> tratamientos de esta lista.</p>
                                {ajusteValido && ajusteEjemplo && (
                                    <p>Ejemplo: {ajusteEjemplo.nombre}: <strong>${formatCOP(ajusteEjemplo.precio)}</strong> → <strong className={ajusteTipo === "aumentar" ? "text-emerald-700" : "text-rose-700"}>${formatCOP(ajustarPrecio(ajusteEjemplo.precio))}</strong></p>
                                )}
                                {ajusteTipo === "disminuir" && Number.isFinite(ajusteNum) && ajusteNum >= 100 && (
                                    <p className="text-rose-600 font-semibold">Para disminuir, el porcentaje debe ser menor a 100%.</p>
                                )}
                                <p className="text-slate-400">Los presupuestos y planes que ya están hechos no cambian.</p>
                            </div>

                            <div className="flex justify-end gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowAjusteModal(false)}
                                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAplicarAjuste}
                                    disabled={!ajusteValido || ajusteSaving}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 border-0 cursor-pointer"
                                >
                                    <FiCheck size={16} /> {ajusteSaving ? "Aplicando..." : "Aplicar ajuste"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

