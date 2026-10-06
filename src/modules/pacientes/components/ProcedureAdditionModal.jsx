import React, { useState, useEffect, useRef, useMemo } from 'react';
import supabase from '../../../lib/supabaseClient';
import { FiSearch, FiPlus, FiX, FiInfo, FiTrash2, FiPercent, FiCheckCircle, FiPlusCircle, FiAlertTriangle } from 'react-icons/fi';
import { useToast } from '../../../context/ToastContext';
import ToothSelectorModal from './ToothSelectorModal';
import { CUPS_DENTAL_CODES } from '../../../data/cupsCodes';
import { generateClinicalSuggestions } from '../../odontograma/services/clinicalSuggestionEngine';

export default function ProcedureAdditionModal({ 
    isOpen, 
    onClose, 
    onAdd, 
    baseListId, 
    inquilino, 
    convenioDescuentos = {},
    findingContext = null,
    onConfirmFinding = null,
    onSkipFinding = null
}) {
    const toast = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('TODAS');
    const [categories, setCategories] = useState([]);
    const [qty, setQty] = useState(1);
    
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchContainerRef = useRef(null);

    // Staging table
    const [stagedItems, setStagedItems] = useState([]);
    const [globalDiscount, setGlobalDiscount] = useState('');

    useEffect(() => {
        setStagedItems([]);
        setSearchTerm('');
        setShowDropdown(false);
    }, [findingContext]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);

    // Tooth Selector State
    const [toothModal, setToothModal] = useState({ isOpen: false, itemId: null, initialValue: "" });

    const openToothSelector = (item) => {
        setToothModal({
            isOpen: true,
            itemId: item.id,
            initialValue: item.dientes || ""
        });
    };

    const handleToothSelection = (teethString) => {
        updateStagedItem(toothModal.itemId, 'dientes', teethString);
    };

    const [allItems, setAllItems] = useState([]);
    const [loadingAllItems, setLoadingAllItems] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setAllItems([]);
            setCategories(['TODAS']);
            return;
        }

        const loadAllItems = async () => {
            setLoadingAllItems(true);
            try {
                let list = [];
                if (baseListId) {
                    const { data: listRow } = await supabase
                        .from("listas_precios")
                        .select("descripcion")
                        .eq("id", baseListId)
                        .maybeSingle();

                    if (listRow?.descripcion) {
                        try {
                            const parsed = JSON.parse(listRow.descripcion);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                list = parsed.map((d, idx) => {
                                    const rawPrice = d.precio ?? d.valor ?? d.amount ?? d.price ?? 0;
                                    const rawName = d.nombre || d.descripcion || d.desc || d.name || "";
                                    const rawCode = d.codigo || d.code || d.codigo_cups || d.cups || "";
                                    const rawCategory = d.categoria || d.category || "GENERAL";
                                    return {
                                        id: d.id || `item_${idx}`,
                                        ...d,
                                        precio: Number(rawPrice),
                                        amount: Number(rawPrice),
                                        nombre: rawName,
                                        desc: rawName,
                                        codigo: rawCode,
                                        codigo_cups: d.codigo_cups || d.cups || null,
                                        categoria: rawCategory
                                    };
                                });
                            }
                        } catch (_) {}
                    }
                }

                // FALLBACK: Si no hay ítems en la lista de precios seleccionada o está vacía, usar el catálogo maestro CUPS
                if (list.length === 0) {
                    list = CUPS_DENTAL_CODES.map((c, idx) => ({
                        id: `cups_${c.code}_${idx}`,
                        codigo: c.code,
                        nombre: c.name,
                        desc: c.name,
                        precio: Number(c.precio || 0),
                        amount: Number(c.precio || 0),
                        categoria: c.category || "CATÁLOGO CUPS"
                    }));
                }

                setAllItems(list);
                const cats = list.map(item => item.categoria).filter(Boolean);
                setCategories(['TODAS', ...new Set(cats)]);
            } catch (e) {
                console.error("Error al cargar los ítems de la lista de precios:", e);
                const list = CUPS_DENTAL_CODES.map((c, idx) => ({
                    id: `cups_${c.code}_${idx}`,
                    codigo: c.code,
                    nombre: c.name,
                    desc: c.name,
                    precio: Number(c.precio || 0),
                    amount: Number(c.precio || 0),
                    categoria: c.category || "CATÁLOGO CUPS"
                }));
                setAllItems(list);
                setCategories(['TODAS', 'CATÁLOGO CUPS']);
            } finally {
                setLoadingAllItems(false);
            }
        };
        loadAllItems();
    }, [isOpen, baseListId]);

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            let results = allItems;
            if (category !== 'TODAS') {
                results = results.filter(r => r.categoria === category);
            }
            setSearchResults(results.slice(0, 30));
            return;
        }

        const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        
        let results = allItems.filter(item => {
            const nameLower = (item.nombre || "").toLowerCase();
            const codeLower = (item.codigo || "").toLowerCase();
            const categoryLower = (item.categoria || "").toLowerCase();

            return searchWords.every(word => 
                nameLower.includes(word) || 
                codeLower.includes(word) || 
                categoryLower.includes(word)
            );
        });

        if (category !== 'TODAS') {
            results = results.filter(r => r.categoria === category);
        }

        setSearchResults(results.slice(0, 30));
    };

    useEffect(() => {
        handleSearch();
    }, [searchTerm, category, allItems]);

    const buildStagedItem = (proc, targetQty = qty) => {
        const convenioDisc = convenioDescuentos[proc.id] || null;
        let descPorc = 0;
        let descVal = 0;
        if (convenioDisc) {
            descPorc = convenioDisc.desc_porc || 0;
            descVal = (proc.precio || 0) * (descPorc / 100) * targetQty;
        }

        return {
            id: Math.random().toString(36).substr(2, 9),
            code: proc.codigo || proc.code || "",
            codigo: proc.codigo || proc.code || "",
            codigo_cups: proc.codigo || proc.code || proc.codigo_cups || "",
            desc: proc.nombre || proc.desc,
            amount: proc.precio || 0,
            qty: targetQty || 1,
            descuento: descVal,
            desc_porc: descPorc,
            dientes: findingContext?.diente ? String(findingContext.diente) : "",
            superficie: findingContext?.superficie || "",
            hallazgo_origen: findingContext?.hallazgo || "",
            odontograma_id: findingContext?.odontograma_id || null,
            tratamiento_pendiente_id: findingContext?.tratamiento_pendiente_id || null,
            line_obs: findingContext?.superficie && findingContext.superficie !== 'General' && findingContext.superficie !== '---' && findingContext.superficie !== 'Pieza Completa'
                ? `Cara: ${findingContext.superficie}` 
                : "",
            categoria: proc.categoria,
            // Reglas de negocio
            es_consulta: Boolean(proc.es_consulta),
            permite_descuento: proc.permite_descuento !== false,
            max_desc: proc.max_desc !== undefined ? Number(proc.max_desc) : (proc.max_descuento_porcentaje || 100)
        };
    };

    const addToList = (proc) => {
        const newItem = buildStagedItem(proc, qty);
        setStagedItems([...stagedItems, newItem]);
        setShowDropdown(false);
        setSearchResults([]);
        setSearchTerm('');
        setQty(1);
    };

    const handleSelectSuggestion = (proc, immediateConfirm = true) => {
        const newItem = buildStagedItem(proc, 1);
        if (immediateConfirm) {
            if (findingContext && onConfirmFinding) {
                onConfirmFinding([newItem], findingContext);
                setStagedItems([]);
            } else if (onAdd) {
                onAdd([newItem]);
                setStagedItems([]);
                onClose();
            }
        } else {
            setStagedItems([...stagedItems, newItem]);
            toast.info("Procedimiento cargado en la tabla para revisión");
        }
    };

    const clinicalEngineResult = useMemo(() => {
        if (!findingContext || !allItems || allItems.length === 0) {
            return { suggestions: [], metadata: { reason: "EMPTY_CATALOG", dentitionValidated: true } };
        }

        const surfacesList = findingContext.superficies 
            ? (Array.isArray(findingContext.superficies) ? findingContext.superficies : [findingContext.superficies])
            : (findingContext.superficie 
                ? String(findingContext.superficie).split(/[\/,\+]/).map(s => s.trim()).filter(Boolean)
                : []);

        const context = {
            hallazgo: findingContext.hallazgo || findingContext.situacionOriginal || "",
            diente: findingContext.diente || "",
            superficie: findingContext.superficie || "General",
            superficies: surfacesList,
            tipoDenticion: findingContext.tipoDenticion || "adulto"
        };

        return generateClinicalSuggestions(context, allItems);
    }, [findingContext, allItems]);

    const updateStagedItem = (id, field, val) => {
        setStagedItems(stagedItems.map(item => {
            if (item.id !== id) return item;
            
            let updated = { ...item, [field]: val };
            
            // Recalcular descuentos si cambia uno de ellos
            if (field === 'desc_porc') {
                // Validación de tope
                if (val > item.max_desc) {
                    toast.error(`El descuento máximo para este ítem es ${item.max_desc}%`);
                    updated.desc_porc = item.max_desc;
                }
                updated.descuento = (Number(updated.amount) * Number(updated.qty)) * (Number(updated.desc_porc) / 100);
            } else if (field === 'descuento') {
                const subtotal = Number(updated.amount) * Number(updated.qty);
                const perc = subtotal > 0 ? (Number(val) / subtotal) * 100 : 0;
                
                if (perc > item.max_desc) {
                    toast.error(`El descuento máximo permitido es ${item.max_desc}%`);
                    updated.desc_porc = item.max_desc;
                    updated.descuento = subtotal * (item.max_desc / 100);
                } else {
                    updated.desc_porc = perc;
                }
            } else if (field === 'qty' || field === 'amount') {
                // Si cambia cantidad o precio, recalculamos el valor del descuento basado en el % actual
                updated.descuento = (Number(updated.amount) * Number(updated.qty)) * (Number(updated.desc_porc) / 100);
            }
            
            return updated;
        }));
    };

    const applyGlobalDiscount = () => {
        const perc = Number(globalDiscount);
        if (isNaN(perc) || perc < 0) return;
        
        let cappedAny = false;
        setStagedItems(stagedItems.map(item => {
            if (!item.permite_descuento) return item;

            const subtotal = Number(item.amount) * Number(item.qty);
            const finalPerc = Math.min(perc, item.max_desc);
            if (finalPerc < perc) cappedAny = true;

            return {
                ...item,
                desc_porc: finalPerc,
                descuento: subtotal * (finalPerc / 100)
            };
        }));

        if (cappedAny) {
            toast.warning("Algunos ítems se limitaron a su descuento máximo permitido.");
        } else {
            toast.success(`Aplicado ${perc}% de descuento general`);
        }
    };

    const calculateSubtotal = () => stagedItems.reduce((acc, curr) => acc + (Number(curr.amount) * Number(curr.qty)), 0);
    const calculateDiscounts = () => stagedItems.reduce((acc, curr) => acc + Number(curr.descuento), 0);
    const calculateTotal = () => calculateSubtotal() - calculateDiscounts();

    const handleCommit = () => {
        if (stagedItems.length === 0) {
            toast.error(findingContext ? "Selecciona un procedimiento para atender este hallazgo" : "No has agregado ningún item");
            return;
        }
        if (findingContext && onConfirmFinding) {
            onConfirmFinding(stagedItems, findingContext);
            setStagedItems([]);
        } else {
            onAdd(stagedItems);
            setStagedItems([]);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div id="debug-all-items" className="hidden">{JSON.stringify(allItems)}</div>
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">
                            {findingContext ? "Vincular Procedimiento a Hallazgo Clínico" : "Adición de productos"}
                        </h3>
                        <FiInfo size={14} className="text-slate-400" />
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

                {/* Banner de Contexto de Hallazgo Odontológico */}
                {findingContext && (
                    <div className="bg-gradient-to-r from-amber-50/90 via-indigo-50/50 to-emerald-50/40 border-b border-indigo-100 p-4 px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-amber-200 shrink-0">
                                🦷
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded border border-indigo-200">
                                        Hallazgo Clínico del Odontograma
                                    </span>
                                    {findingContext.totalSteps > 1 && (
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 animate-pulse">
                                            Paso {findingContext.step} de {findingContext.totalSteps}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                                    <span className="text-slate-600 font-bold uppercase tracking-tight">
                                        Hallazgo: <strong className="text-amber-800 font-black px-1.5 py-0.5 bg-amber-100/80 rounded border border-amber-200">{findingContext.hallazgo}</strong>
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-slate-600 font-bold uppercase tracking-tight">
                                        Diente: <strong className="text-indigo-700 font-black px-1.5 py-0.5 bg-indigo-100/80 rounded border border-indigo-200">{findingContext.diente || 'General'}</strong>
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-slate-600 font-bold uppercase tracking-tight">
                                        Superficie: <strong className="text-emerald-700 font-black px-1.5 py-0.5 bg-emerald-100/80 rounded border border-emerald-200">{findingContext.superficie || 'General'}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 max-w-sm md:text-right leading-tight">
                            Seleccione el procedimiento clínico que se realizará para este hallazgo. Se vinculará su código CUPS y tarifa oficial.
                        </div>
                    </div>
                )}

                {/* Contenedor desplazable para Sugerencias, Buscador y Tabla */}
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">

                    {/* Advertencia de discrepancia anatómica (DENTITION_MISMATCH) */}
                    {findingContext && clinicalEngineResult?.metadata?.reason === "DENTITION_MISMATCH" && (
                        <div className="bg-amber-50/90 border-b border-amber-200 px-6 py-3.5 flex items-center gap-3 animate-fadeIn">
                            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
                                <FiAlertTriangle size={18} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-amber-900 leading-tight">
                                    Se detectó una discrepancia entre el tipo de dentición y la pieza dental. Por seguridad clínica, seleccione el procedimiento manualmente.
                                </p>
                                <p className="text-[10px] text-amber-700/90 mt-0.5">
                                    El buscador general inferior permanece totalmente habilitado para elegir la prestación adecuada.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Sección de Procedimientos Sugeridos */}
                    {findingContext && clinicalEngineResult?.suggestions?.length > 0 && (
                        <div className="bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/50 p-6 border-b border-slate-200 animate-fadeIn">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        Procedimientos sugeridos
                                    </h4>
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md border border-indigo-200">
                                        {clinicalEngineResult.suggestions.length} {clinicalEngineResult.suggestions.length === 1 ? 'opción compatible' : 'opciones compatibles'}
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium text-slate-400 italic max-w-xl text-left md:text-right leading-tight">
                                    Las sugerencias se generan a partir del hallazgo y el contexto odontológico. La selección del procedimiento corresponde al criterio del profesional tratante.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {clinicalEngineResult.suggestions.map((sug, idx) => {
                                    const proc = sug.procedure;
                                    const isFirst = idx === 0;
                                    return (
                                        <div 
                                            key={proc.id || idx}
                                            className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between shadow-sm hover:shadow-md relative ${
                                                isFirst ? 'border-indigo-300 ring-1 ring-indigo-200/50' : 'border-slate-200 hover:border-indigo-200'
                                            }`}
                                        >
                                            <div>
                                                {/* Top Row: Sugerencia Badge + Categoría */}
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                        isFirst ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        Sugerencia #{idx + 1}
                                                    </span>
                                                    {proc.categoria && (
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[120px]" title={proc.categoria}>
                                                            {proc.categoria}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Nombre del Procedimiento */}
                                                <h5 className="text-xs font-black text-slate-800 leading-snug line-clamp-2 uppercase mb-2" title={proc.nombre}>
                                                    {proc.nombre}
                                                </h5>

                                                {/* Contexto Anatómico */}
                                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] mb-3">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                                                        Pieza: <strong className="text-slate-800">{findingContext.diente || 'General'}</strong>
                                                    </span>
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                                                        Cara: <strong className="text-slate-800">{findingContext.superficie || 'General'}</strong>
                                                    </span>
                                                </div>

                                                {/* Tarifa y Código CUPS */}
                                                <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-slate-100">
                                                    <div>
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Tarifa</span>
                                                        <span className="text-sm font-black text-emerald-600 tracking-tight">
                                                            $ {Number(proc.precio || 0).toLocaleString('es-CO')}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Código</span>
                                                        {sug.cupsCandidate ? (
                                                            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                                CUPS: {sug.cupsCandidate}
                                                            </span>
                                                        ) : sug.internalCode ? (
                                                            <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                Interno: {sug.internalCode}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-medium text-slate-400 italic">S/C</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Advertencia CUPS / RIPS (Solo si genera_rips === true y no tiene CUPS utilizable) */}
                                                {sug.hasCupsWarning && (
                                                    <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200/90 rounded-xl text-amber-900 text-[10px] leading-tight flex items-start gap-1.5 animate-fadeIn">
                                                        <FiAlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                        <div>
                                                            <strong className="block font-black text-[10px] text-amber-900">⚠ Requiere código CUPS para RIPS</strong>
                                                            <span className="text-[9px] text-amber-800/90 block leading-tight mt-0.5">
                                                                Este procedimiento está configurado para generar RIPS pero no tiene un código CUPS utilizable en la Lista de Precios.
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Acciones de la Tarjeta */}
                                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectSuggestion(proc, false)}
                                                    className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                                    title="Cargar en tabla de preparación para ajustar descuento o cantidad"
                                                >
                                                    Elegir
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectSuggestion(proc, true)}
                                                    className="flex-1 py-2 px-3 bg-[#8CC63F] hover:bg-[#7bb335] active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-200/70 flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <FiCheckCircle size={13} />
                                                    Elegir y confirmar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Separador hacia el buscador manual si hay sugerencias visibles */}
                    {findingContext && clinicalEngineResult?.suggestions?.length > 0 && (
                        <div className="px-6 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            <span>O busque cualquier otro procedimiento en el catálogo manual</span>
                            <span className="text-[9px] font-semibold text-slate-400">Catálogo completo disponible</span>
                        </div>
                    )}

                    {/* Search Bar Area */}
                <div className="p-6 bg-white border-b border-slate-50 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Categoría</label>
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-6 relative" ref={searchContainerRef}>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Buscar Ítem (Nombre o Código)</label>
                        <div className="relative">
                            <input 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all pr-16"
                                placeholder="Escribe para buscar..."
                                value={searchTerm}
                                onFocus={() => setShowDropdown(true)}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowDropdown(true);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') setShowDropdown(false);
                                    if (e.key === 'Enter') handleSearch();
                                }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                {searchTerm && (
                                    <button 
                                        type="button" 
                                        onClick={() => { setSearchTerm(''); setShowDropdown(false); }} 
                                        className="text-slate-300 hover:text-slate-500 p-0.5"
                                        title="Limpiar búsqueda"
                                    >
                                        <FiX size={15} />
                                    </button>
                                )}
                                <button type="button" onClick={() => { handleSearch(); setShowDropdown(true); }} className="text-slate-400 hover:text-indigo-600">
                                    <FiSearch size={18} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Instant Search Dropdown */}
                        {showDropdown && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl z-[100] max-h-60 overflow-y-auto custom-scrollbar">
                                <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    <span>Resultados ({searchResults.length})</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowDropdown(false)}
                                        className="hover:text-slate-700 text-slate-400 font-bold"
                                    >
                                        Cerrar ✕
                                    </button>
                                </div>
                                {searchResults.map(r => (
                                    <div 
                                        key={r.id} 
                                        onClick={() => addToList(r)}
                                        className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center group border-b border-slate-50 last:border-0"
                                    >
                                        <div>
                                            <div className="text-[11px] font-black text-slate-700 uppercase">{r.nombre}</div>
                                            <div className="text-[9px] font-bold text-slate-400">{r.categoria} | {r.codigo || 'S/C'}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[12px] font-black text-indigo-600">$ {r.precio.toLocaleString('es-CO')}</div>
                                            <FiPlus className="inline ml-2 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="md:col-span-1 text-center">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cant.</label>
                        <input 
                            type="number"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 text-center outline-none"
                            value={qty}
                            onChange={(e) => setQty(Number(e.target.value))}
                            min="1"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <button 
                            onClick={handleSearch}
                            className="w-full py-2.5 bg-[#8CC63F] text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-[#7bb335] transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <FiPlus /> Agregar
                        </button>
                    </div>
                </div>

                {/* Staging Table */}
                <div className="p-6">
                    <table className="w-full text-left table-auto">
                        <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b border-slate-100 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                <th className="px-3 py-2">Nombre</th>
                                <th className="px-3 py-2 text-right">Precio</th>
                                <th className="px-3 py-2 text-center">Dcto %</th>
                                <th className="px-3 py-2 text-right">Dcto Valor</th>
                                <th className="px-3 py-2 text-center">Cant.</th>
                                <th className="px-3 py-2 text-center">Dientes</th>
                                <th className="px-3 py-2">Observaciones</th>
                                <th className="px-3 py-2 text-right">Total</th>
                                <th className="px-3 py-2 text-center w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stagedItems.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-300">
                                            <FiSearch size={40} className="opacity-20" />
                                            <p className="text-xs font-bold uppercase tracking-widest">Busca y agrega productos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : stagedItems.map(item => (
                                <tr key={item.id} className="text-[11px] font-bold text-slate-600 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-3 py-3 uppercase text-slate-700 truncate max-w-[200px]">{item.desc}</td>
                                    <td className="px-3 py-3 text-right font-mono">$ {item.amount.toLocaleString('es-CO')}</td>
                                    <td className="px-3 py-3 text-center">
                                        <input 
                                            type="number"
                                            disabled={!item.permite_descuento}
                                            className={`w-14 border rounded px-2 py-1 text-center font-black ${item.permite_descuento ? 'bg-white border-slate-200 text-indigo-600' : 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                                            value={item.desc_porc}
                                            onChange={(e) => updateStagedItem(item.id, 'desc_porc', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <input 
                                            type="number"
                                            disabled={!item.permite_descuento}
                                            className={`w-24 border rounded px-2 py-1 text-right font-black ${item.permite_descuento ? 'bg-white border-slate-200 text-rose-500' : 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                                            value={item.descuento}
                                            onChange={(e) => updateStagedItem(item.id, 'descuento', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <input 
                                            type="number"
                                            className="w-12 bg-white border border-slate-200 rounded px-2 py-1 text-center font-black"
                                            value={item.qty}
                                            onChange={(e) => updateStagedItem(item.id, 'qty', Number(e.target.value))}
                                            min="1"
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="text"
                                                className="w-14 bg-white border border-slate-200 rounded px-2 py-1 text-center font-black uppercase text-slate-400 text-[9px]"
                                                value={item.dientes}
                                                onChange={(e) => updateStagedItem(item.id, 'dientes', e.target.value.toUpperCase())}
                                            />
                                            <button 
                                                onClick={() => openToothSelector(item)}
                                                className="text-indigo-500 hover:text-indigo-700 transition-colors"
                                            >
                                                <FiPlusCircle size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <input 
                                            type="text"
                                            className="w-full min-w-[120px] bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-medium"
                                            placeholder="..."
                                            value={item.line_obs}
                                            onChange={(e) => updateStagedItem(item.id, 'line_obs', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-right font-black text-slate-800 font-mono">
                                        $ {((item.amount * item.qty) - item.descuento).toLocaleString('es-CO')}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <button onClick={() => setStagedItems(stagedItems.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-rose-500 transition-colors">
                                            <FiTrash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </div>

                {/* Footer Section */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                    
                    {/* Bulk Tools */}
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                        <input 
                            type="number"
                            className="w-20 px-4 py-2 text-center text-sm font-black text-slate-700 outline-none border-none focus:ring-0"
                            placeholder="Desc %"
                            value={globalDiscount}
                            onChange={(e) => setGlobalDiscount(e.target.value)}
                        />
                        <button 
                            onClick={applyGlobalDiscount}
                            className="bg-[#8CC63F] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#7bb335] transition-all flex items-center gap-2"
                        >
                            <FiPercent /> Descuento general
                        </button>
                    </div>

                    {/* Summary Counters */}
                    <div className="flex items-center gap-8">
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtotal:</div>
                            <div className="text-sm font-black text-slate-600 font-mono">$ {calculateSubtotal().toLocaleString('es-CO')}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Descuento:</div>
                            <div className="text-sm font-black text-rose-500 font-mono">$ {calculateDiscounts().toLocaleString('es-CO')}</div>
                        </div>
                        <div className="text-right border-l border-slate-200 pl-8">
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Total:</div>
                            <div className="text-xl font-black text-indigo-700 tracking-tighter font-mono">$ {calculateTotal().toLocaleString('es-CO')}</div>
                        </div>
                    </div>

                    {/* Final Actions */}
                    <div className="flex items-center gap-3">
                        {findingContext && findingContext.totalSteps > 1 && onSkipFinding && (
                            <button 
                                type="button"
                                onClick={() => {
                                    setStagedItems([]);
                                    onSkipFinding();
                                }} 
                                className="px-4 py-2.5 text-xs font-black uppercase text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-all cursor-pointer"
                                title="Omitir este hallazgo sin asignarle procedimiento"
                            >
                                Omitir este hallazgo
                            </button>
                        )}
                        <button onClick={onClose} className="px-6 py-2.5 text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-colors">
                            {findingContext ? "Cancelar importación" : "Cerrar"}
                        </button>
                        <button 
                            onClick={handleCommit}
                            className="px-8 py-2.5 bg-[#8CC63F] text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-[#7bb335] transition-all active:scale-95 flex items-center gap-3 cursor-pointer"
                        >
                            <FiCheckCircle size={16} /> 
                            {findingContext 
                                ? (findingContext.totalSteps > 1 && findingContext.step < findingContext.totalSteps
                                    ? `Confirmar y siguiente (${findingContext.step + 1}/${findingContext.totalSteps}) →`
                                    : "Confirmar procedimiento para este hallazgo"
                                  )
                                : "Cargar servicios"
                            }
                        </button>
                    </div>
                </div>
            </div>

            <ToothSelectorModal 
                isOpen={toothModal.isOpen}
                onClose={() => setToothModal({ ...toothModal, isOpen: false })}
                onSave={handleToothSelection}
                initialValue={toothModal.initialValue}
            />
        </div>
    );
}
