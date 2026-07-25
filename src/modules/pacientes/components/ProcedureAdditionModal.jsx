import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/firebaseConfig';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { FiSearch, FiPlus, FiX, FiInfo, FiTrash2, FiPercent, FiCheckCircle, FiPlusCircle } from 'react-icons/fi';
import { useToast } from '../../../context/ToastContext';
import ToothSelectorModal from './ToothSelectorModal';

export default function ProcedureAdditionModal({ isOpen, onClose, onAdd, baseListId, inquilino, convenioDescuentos = {} }) {
    const toast = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('TODAS');
    const [categories, setCategories] = useState([]);
    const [qty, setQty] = useState(1);
    
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    
    // Staging table
    const [stagedItems, setStagedItems] = useState([]);
    const [globalDiscount, setGlobalDiscount] = useState('');

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
        if (isOpen && baseListId) {
            const loadAllItems = async () => {
                setLoadingAllItems(true);
                try {
                    const snap = await getDocs(collection(db, "listas_precios", baseListId, "items"));
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setAllItems(list);
                    
                    // Extraer categorías únicas
                    const cats = list.map(item => item.categoria).filter(c => !!c);
                    setCategories(['TODAS', ...new Set(cats)]);
                } catch (e) {
                    console.error("Error al cargar los ítems de la lista de precios:", e);
                    toast?.error("Error al cargar los productos");
                } finally {
                    setLoadingAllItems(false);
                }
            };
            loadAllItems();
        } else {
            setAllItems([]);
            setCategories(['TODAS']);
        }
    }, [isOpen, baseListId]);

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }

        const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        
        let results = allItems.filter(item => {
            const nameLower = (item.nombre || "").toLowerCase();
            const codeLower = (item.codigo || "").toLowerCase();
            const categoryLower = (item.categoria || "").toLowerCase();

            // Todas las palabras escritas deben coincidir en el nombre, código o categoría
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

    const addToList = (proc) => {
        const convenioDisc = convenioDescuentos[proc.id] || null;
        let descPorc = 0;
        let descVal = 0;
        if (convenioDisc) {
            descPorc = convenioDisc.desc_porc || 0;
            descVal = (proc.precio || 0) * (descPorc / 100) * qty;
        }

        const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            code: proc.codigo || "",
            desc: proc.nombre,
            amount: proc.precio || 0,
            qty: qty,
            descuento: descVal,
            desc_porc: descPorc,
            dientes: "",
            line_obs: "",
            categoria: proc.categoria,
            // Reglas de negocio
            permite_descuento: proc.permite_descuento !== false,
            max_desc: proc.max_descuento_porcentaje || 100
        };
        setStagedItems([...stagedItems, newItem]);
        setSearchResults([]);
        setSearchTerm('');
        setQty(1);
    };

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
            toast.error("No has agregado ningún item");
            return;
        }
        onAdd(stagedItems);
        setStagedItems([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">Adición de productos</h3>
                        <FiInfo size={14} className="text-slate-400" />
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

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
                    <div className="md:col-span-6 relative">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Buscar Ítem (Nombre o Código)</label>
                        <div className="relative">
                            <input 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all pr-10"
                                placeholder="Escribe para buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button onClick={handleSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                                <FiSearch size={18} />
                            </button>
                        </div>
                        
                        {/* Instant Search Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 shadow-2xl rounded-xl z-[100] max-h-60 overflow-y-auto custom-scrollbar">
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
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
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
                        <button onClick={onClose} className="px-6 py-2.5 text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-colors">Cerrar</button>
                        <button 
                            onClick={handleCommit}
                            className="px-8 py-2.5 bg-[#8CC63F] text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-[#7bb335] transition-all active:scale-95 flex items-center gap-3"
                        >
                            <FiCheckCircle size={16} /> Cargar servicios
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
