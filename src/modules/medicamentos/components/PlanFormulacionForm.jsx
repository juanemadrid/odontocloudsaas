import React, { useState, useEffect, useMemo, useRef } from "react";
import { FiArrowLeft, FiAlertCircle, FiPlus, FiTrash2, FiSearch } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import { getConfigItems, saveConfigItem } from "../../../services/configPersistenceService";
import { MEDICAMENTOS_COLOMBIA } from "../../../data/medicamentosColombia";

const VIAS_ADMINISTRACION = [
    "Oral", "Tópica", "Infiltración Local", "Sublingual", "Intramuscular", "Intravenosa", "Oftálmica", "Ótica", "Nasal", "Otros"
];

export default function PlanFormulacionForm({ id, onCancel, onSuccess }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || userProfile?.tenant_id || "juanemadrid/odontocloudsaas";

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Form State
    const [nombre, setNombre] = useState("");
    const [planMeds, setPlanMeds] = useState([]);
    const [tableSearch, setTableSearch] = useState("");

    // Autocomplete / Search input state
    const [searchMedText, setSearchMedText] = useState("");
    const [savedMedicamentos, setSavedMedicamentos] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchWrapperRef = useRef(null);

    // Load available saved medicines for autocomplete
    useEffect(() => {
        if (!inquilino) return;
        const loadCatalog = async () => {
            try {
                const list = await getConfigItems(inquilino, "medicamentos", "medicamentos");
                setSavedMedicamentos(list || []);
            } catch (err) {
                console.error("Error loading medicines catalog:", err);
            }
        };
        loadCatalog();
    }, [inquilino]);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Load plan details if editing
    useEffect(() => {
        if (!id || !inquilino) return;
        const loadPlan = async () => {
            setLoading(true);
            try {
                const list = await getConfigItems(inquilino, "planes_formulacion", "planes_formulacion");
                const found = list.find(p => String(p.id) === String(id));
                if (found) {
                    setNombre(found.nombre || "");
                    setPlanMeds(found.medicamentos || []);
                }
            } catch (err) {
                console.error("Error loading plan:", err);
                setError("Error al cargar la información del plan de formulación");
            } finally {
                setLoading(false);
            }
        };
        loadPlan();
    }, [id, inquilino]);

    // Suggestions matching both saved clinic medicines AND official Colombia MIPRES DCI
    const suggestedMeds = useMemo(() => {
        if (!searchMedText.trim()) return [];
        const term = searchMedText.trim().toLowerCase();
        
        const results = [];
        
        // 1. Check clinic's saved medications first
        savedMedicamentos.forEach(m => {
            const name = (m.principio_activo || m.nombre || "").toLowerCase();
            const code = String(m.codigo || "").toLowerCase();
            if (name.includes(term) || code.includes(term)) {
                results.push({
                    code: m.codigo || "MED",
                    name: m.principio_activo || m.nombre,
                    tipo: m.tipo || "Otros",
                    descripcion: m.descripcion || "",
                    marca: m.marca || "",
                    isSaved: true
                });
            }
        });

        // 2. Check national MIPRES DCI catalog
        (MEDICAMENTOS_COLOMBIA || []).forEach(m => {
            if (results.length >= 10) return;
            const name = String(m.name || "").toLowerCase();
            const code = String(m.code || "").toLowerCase();
            if ((name.includes(term) || code.includes(term)) && !results.some(r => r.name.toLowerCase() === name)) {
                results.push({
                    code: m.code,
                    name: m.name,
                    tipo: "POS",
                    descripcion: "",
                    marca: "",
                    isSaved: false
                });
            }
        });

        return results.slice(0, 10);
    }, [searchMedText, savedMedicamentos]);

    const handleAddMedicine = (selectedMed) => {
        if (!selectedMed) return;
        
        const medName = selectedMed.name || selectedMed.principio_activo || selectedMed.nombre;
        if (planMeds.some(m => (m.principio_activo || m.nombre || m.medicamento)?.toLowerCase() === medName.toLowerCase())) {
            toast.warning("Este medicamento ya ha sido agregado al plan.");
            setSearchMedText("");
            setShowSuggestions(false);
            return;
        }

        const newRow = {
            tipo: selectedMed.tipo || "Otros",
            codigo: selectedMed.code || selectedMed.codigo || "",
            principio_activo: medName || "",
            medicamento: medName || "",
            dosis: "",
            frecuencia: "",
            via: "Oral",
            duracion: "",
            cantidad: "1",
            descripcion: selectedMed.descripcion || "",
            marca: selectedMed.marca || ""
        };

        setPlanMeds(prev => [...prev, newRow]);
        setSearchMedText("");
        setShowSuggestions(false);
    };

    const handleAddCustom = () => {
        if (!searchMedText.trim()) return;

        if (planMeds.some(m => (m.principio_activo || m.nombre || m.medicamento)?.toLowerCase() === searchMedText.trim().toLowerCase())) {
            toast.warning("Este medicamento ya ha sido agregado al plan.");
            setSearchMedText("");
            setShowSuggestions(false);
            return;
        }

        const newRow = {
            tipo: "Otros",
            codigo: "N/A",
            principio_activo: searchMedText.trim(),
            medicamento: searchMedText.trim(),
            dosis: "",
            frecuencia: "",
            via: "Oral",
            duracion: "",
            cantidad: "1",
            descripcion: "",
            marca: ""
        };

        setPlanMeds(prev => [...prev, newRow]);
        setSearchMedText("");
        setShowSuggestions(false);
    };

    const handleRemoveRow = (idx) => {
        setPlanMeds(prev => prev.filter((_, i) => i !== idx));
    };

    const handleRowChange = (idx, field, val) => {
        setPlanMeds(prev => prev.map((row, i) => {
            if (i !== idx) return row;
            return { ...row, [field]: val };
        }));
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!nombre.trim()) {
            setError("El Nombre del Plan es obligatorio.");
            toast.error("Ingrese el nombre del plan de formulación");
            return;
        }

        if (planMeds.length === 0) {
            setError("Debe agregar al menos un medicamento al plan de formulación.");
            toast.error("Agregue al menos un medicamento al plan");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const planData = {
                nombre: nombre.trim(),
                descripcion: "",
                medicamentos: planMeds.map(m => ({
                    tipo: m.tipo || "Otros",
                    codigo: m.codigo || "",
                    principio_activo: (m.principio_activo || m.medicamento || m.nombre || "").trim(),
                    medicamento: (m.principio_activo || m.medicamento || m.nombre || "").trim(),
                    nombre: (m.principio_activo || m.medicamento || m.nombre || "").trim(),
                    dosis: (m.dosis || "").trim(),
                    frecuencia: (m.frecuencia || "").trim(),
                    via: m.via || "Oral",
                    duracion: (m.duracion || "").trim(),
                    cantidad: (m.cantidad || "").trim(),
                    descripcion: (m.descripcion || "").trim(),
                    marca: (m.marca || "").trim()
                })),
            };

            await saveConfigItem(inquilino, "planes_formulacion", "planes_formulacion", {
                ...planData,
                ...(id ? { id } : {})
            });

            toast.success(id ? "Plan de formulación actualizado correctamente" : "Plan de formulación creado correctamente");
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error("Error saving formulation plan:", err);
            setError("Error al guardar el plan: " + err.message);
            toast.error("Error al guardar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredTableMeds = useMemo(() => {
        if (!tableSearch.trim()) return planMeds;
        const term = tableSearch.toLowerCase().trim();
        return planMeds.filter(m => 
            (m.principio_activo || "").toLowerCase().includes(term) ||
            (m.codigo || "").toLowerCase().includes(term) ||
            (m.tipo || "").toLowerCase().includes(term) ||
            (m.descripcion || "").toLowerCase().includes(term)
        );
    }, [planMeds, tableSearch]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs font-semibold">Cargando datos...</span>
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-4 animate-in fade-in duration-300 w-full max-w-7xl mx-auto pb-12">
            {/* ─── ENCABEZADO Y BREADCRUMB 1:1 ORALDRIVE ─── */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-7 h-7 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer mr-1"
                        title="Volver"
                    >
                        <FiArrowLeft size={14} />
                    </button>
                    <h2 className="text-sm font-bold text-slate-800 tracking-tight">
                        {id ? "Editar plan de formulación" : "Nuevo plan de formulación"}
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <span>🏠 - Medicamentos y planes de formulación - Planes de formulación - {id ? "Editar" : "Nuevo"} plan de formulación</span>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded-full transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
                >
                    {saving ? "Guardando..." : "Guardar"}
                </button>
            </div>

            {error && (
                <div className="mx-6 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center gap-2.5">
                    <FiAlertCircle className="text-rose-500 shrink-0" size={16} />
                    <p className="text-rose-700 text-xs font-medium">{error}</p>
                </div>
            )}

            {/* ─── TARJETA INFORMACIÓN BÁSICA (DISEÑO 1:1 ORALDRIVE) ─── */}
            <div className="mx-6 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="px-6 py-3.5 border-b border-slate-100 bg-white">
                    <h3 className="text-xs font-bold text-slate-700">Información básica</h3>
                </div>

                <div className="p-6 space-y-6">
                    {/* Fila 1: Nombre + Ingrese el medicamento a añadir + Botón Añadir */}
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                        {/* Nombre */}
                        <div className="flex items-center gap-3 flex-1 w-full">
                            <label className="text-xs font-normal text-slate-500 w-16 text-right shrink-0">Nombre</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Nombres del plan de formulación"
                                className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
                                required
                            />
                        </div>

                        {/* Ingrese el medicamento a añadir + Añadir */}
                        <div ref={searchWrapperRef} className="flex items-center gap-3 flex-1 w-full relative">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={searchMedText}
                                    onChange={(e) => {
                                        setSearchMedText(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    placeholder="Ingrese el medicamento a añadir"
                                    className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
                                />

                                {/* Dropdown de sugerencias */}
                                {showSuggestions && searchMedText.trim() && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs animate-in fade-in">
                                        {suggestedMeds.length === 0 ? (
                                            <button
                                                type="button"
                                                onClick={handleAddCustom}
                                                className="w-full text-left px-3.5 py-2 text-xs font-bold text-blue-600 hover:bg-slate-50 flex items-center justify-between border-0 bg-transparent cursor-pointer"
                                            >
                                                <span>Añadir personalizado: "{searchMedText}"</span>
                                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">NUEVO</span>
                                            </button>
                                        ) : (
                                            suggestedMeds.map((med, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onMouseDown={() => handleAddMedicine(med)}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2 border-0 bg-transparent cursor-pointer group text-slate-700"
                                                >
                                                    <span className="font-semibold text-xs text-slate-700 uppercase group-hover:text-blue-600">
                                                        {med.name} - {med.code}
                                                    </span>
                                                    {med.isSaved && (
                                                        <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold">
                                                            Registrado
                                                        </span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleAddCustom}
                                className="h-8 px-5 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-2xs shrink-0"
                            >
                                Añadir
                            </button>
                        </div>
                    </div>

                    {/* Barra de DataGrid */}
                    <div className="border border-slate-200 rounded overflow-hidden">
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-400">
                            <span className="italic text-[11px]">Arrastre una columna aquí para agrupar por ella</span>
                            <div className="relative">
                                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                <input
                                    type="text"
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="h-7 pl-8 pr-2.5 w-44 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-sky-500"
                                />
                            </div>
                        </div>

                        {/* Tabla de Medicamentos */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[11px]">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold">
                                        <th className="py-2.5 px-2.5 border-r border-slate-200 w-16">Tipo</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200 w-20">Código</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200">Principio Activo</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200 w-28">Dosis</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200 w-32">Frecuencia</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200 w-32">Vía de administración</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200 w-24">Duración</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200 w-16">Cantidad</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200">Descripción</th>
                                        <th className="py-2.5 px-2.5 border-r border-slate-200 w-24">Marca</th>
                                        <th className="py-2.5 px-2 text-center w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTableMeds.length === 0 ? (
                                        <tr>
                                            <td colSpan="11" className="py-12 text-center text-slate-400 text-xs">
                                                Sin datos
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTableMeds.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="py-2 px-2.5 border-r border-slate-100 text-slate-600 font-medium">{row.tipo || "Otros"}</td>
                                                <td className="py-2 px-2.5 border-r border-slate-100 text-slate-700 font-bold">{row.codigo || "—"}</td>
                                                <td className="py-2 px-2.5 border-r border-slate-100 font-bold text-slate-800 uppercase">{row.principio_activo || row.medicamento}</td>
                                                <td className="py-1.5 px-2 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={row.dosis}
                                                        onChange={(e) => handleRowChange(idx, "dosis", e.target.value)}
                                                        placeholder="Dosis"
                                                        className="w-full h-7 px-2 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-sky-500"
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={row.frecuencia}
                                                        onChange={(e) => handleRowChange(idx, "frecuencia", e.target.value)}
                                                        placeholder="Frecuencia"
                                                        className="w-full h-7 px-2 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-sky-500"
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2 border-r border-slate-100">
                                                    <select
                                                        value={row.via}
                                                        onChange={(e) => handleRowChange(idx, "via", e.target.value)}
                                                        className="w-full h-7 px-1.5 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-sky-500 cursor-pointer"
                                                    >
                                                        {VIAS_ADMINISTRACION.map(v => (
                                                            <option key={v} value={v}>{v}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="py-1.5 px-2 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={row.duracion}
                                                        onChange={(e) => handleRowChange(idx, "duracion", e.target.value)}
                                                        placeholder="Duración"
                                                        className="w-full h-7 px-2 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-sky-500"
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={row.cantidad}
                                                        onChange={(e) => handleRowChange(idx, "cantidad", e.target.value)}
                                                        placeholder="Cantidad"
                                                        className="w-full h-7 px-2 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-sky-500"
                                                    />
                                                </td>
                                                <td className="py-2 px-2.5 border-r border-slate-100 text-slate-500">{row.descripcion || "—"}</td>
                                                <td className="py-2 px-2.5 border-r border-slate-100 text-slate-500">{row.marca || "—"}</td>
                                                <td className="py-1 px-1.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRow(idx)}
                                                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-0 bg-transparent mx-auto"
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
                </div>
            </div>

            {/* Botón Guardar Inferior 1:1 OralDrive */}
            <div className="mx-6 flex justify-end">
                <button
                    type="submit"
                    disabled={saving}
                    className="h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded-full transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
                >
                    {saving ? "Guardando..." : "Guardar"}
                </button>
            </div>
        </form>
    );
}


