import React, { useState, useEffect, useMemo, useRef } from "react";
import { FiArrowLeft, FiSave, FiAlertCircle } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import { getConfigItems, saveConfigItem } from "../../../services/configPersistenceService";
import { MEDICAMENTOS_COLOMBIA } from "../../../data/medicamentosColombia";

export default function MedicamentoForm({ id, onCancel, onSuccess }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || userProfile?.tenant_id || "juanemadrid/odontocloudsaas";

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Form State
    const [tipo, setTipo] = useState("Otros");
    const [codigo, setCodigo] = useState("");
    const [principioActivo, setPrincipioActivo] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [marca, setMarca] = useState("");

    // Autocomplete states
    const [activeDropdown, setActiveDropdown] = useState(null); // "codigo" | "principio" | null
    const [codeSuggestions, setCodeSuggestions] = useState([]);
    const [nameSuggestions, setNameSuggestions] = useState([]);
    const wrapperRef = useRef(null);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter code suggestions using exact MIPRES DCI Catalog (OralDrive)
    useEffect(() => {
        if (!codigo || codigo.trim().length < 1 || activeDropdown !== "codigo") {
            setCodeSuggestions([]);
            return;
        }
        const term = codigo.trim().toLowerCase();
        const matches = (MEDICAMENTOS_COLOMBIA || []).filter(item => {
            const codeStr = String(item.code || "").toLowerCase();
            const nameStr = String(item.name || "").toLowerCase();
            return codeStr.includes(term) || nameStr.includes(term);
        }).slice(0, 8);
        setCodeSuggestions(matches);
    }, [codigo, activeDropdown]);

    // Filter name suggestions using exact MIPRES DCI Catalog (OralDrive)
    useEffect(() => {
        if (!principioActivo || principioActivo.trim().length < 1 || activeDropdown !== "principio") {
            setNameSuggestions([]);
            return;
        }
        const term = principioActivo.trim().toLowerCase();
        const matches = (MEDICAMENTOS_COLOMBIA || []).filter(item => {
            const nameStr = String(item.name || "").toLowerCase();
            const codeStr = String(item.code || "").toLowerCase();
            return nameStr.includes(term) || codeStr.includes(term);
        }).slice(0, 8);
        setNameSuggestions(matches);
    }, [principioActivo, activeDropdown]);

    const handleSelectCatalogItem = (item) => {
        if (!item) return;

        setCodigo(item.code || "");
        setPrincipioActivo(item.name || "");
        setActiveDropdown(null);
    };

    useEffect(() => {
        if (!id || !inquilino) return;
        const loadMedicine = async () => {
            setLoading(true);
            try {
                const list = await getConfigItems(inquilino, "medicamentos", "medicamentos");
                const found = list.find(m => String(m.id) === String(id));
                if (found) {
                    setTipo(found.tipo || "Otros");
                    setCodigo(found.codigo || "");
                    setPrincipioActivo(found.principio_activo || found.nombre || "");
                    setDescripcion(found.descripcion || "");
                    setMarca(found.marca || "");
                }
            } catch (err) {
                console.error("Error loading medicine:", err);
                setError("Error al cargar la información del medicamento");
            } finally {
                setLoading(false);
            }
        };
        loadMedicine();
    }, [id, inquilino]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!codigo.trim() || !principioActivo.trim()) {
            setError("Los campos Código y Principio Activo son obligatorios.");
            toast.error("Complete los campos obligatorios (*)");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const medData = {
                tipo,
                codigo: codigo.trim(),
                principio_activo: principioActivo.trim(),
                nombre: principioActivo.trim(),
                descripcion: descripcion.trim(),
                marca: marca.trim(),
            };

            await saveConfigItem(inquilino, "medicamentos", "medicamentos", {
                ...medData,
                ...(id ? { id } : {})
            });

            toast.success(id ? "Medicamento actualizado correctamente" : "Medicamento creado correctamente");
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error("Error saving medicine:", err);
            setError("Error al guardar el medicamento: " + err.message);
            toast.error("Error al guardar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs font-semibold">Cargando datos...</span>
            </div>
        );
    }

    return (
        <form ref={wrapperRef} onSubmit={handleSave} className="space-y-4 animate-in fade-in duration-300 max-w-4xl mx-auto">
            {/* Header / Top Action Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                        title="Volver"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-[17px] font-bold text-slate-800">
                            {id ? "Editar Medicamento" : "Nuevo Medicamento"}
                        </h2>
                        <p className="text-[12px] text-slate-500">
                            {id ? "Modifique los detalles del medicamento" : "Complete los campos o seleccione del catálogo oficial CUM / MIPRES"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-0 bg-transparent"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        <FiSave size={15} />
                        <span>{saving ? "Guardando..." : "Guardar Medicamento"}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 animate-in shake">
                    <FiAlertCircle className="text-rose-500 shrink-0" size={18} />
                    <p className="text-rose-700 text-xs font-medium">{error}</p>
                </div>
            )}

            {/* Input card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-5">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Información Básica
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Tipo Dropdown */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Tipo *</label>
                        <select
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-colors cursor-pointer"
                        >
                            <option value="POS">POS</option>
                            <option value="NO POS">NO POS</option>
                            <option value="Otros">Otros</option>
                        </select>
                    </div>

                    {/* Código with Autocomplete Dropdown */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Código * <span className="text-[11px] font-normal text-slate-400">(CUM / MIPRES)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={codigo}
                                onFocus={() => setActiveDropdown("codigo")}
                                onChange={(e) => {
                                    setCodigo(e.target.value);
                                    setActiveDropdown("codigo");
                                }}
                                placeholder="Escriba código o CUM (ej. 1829, 2203)..."
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                                required
                            />
                        </div>

                        {/* Suggestions dropdown for Code */}
                        {activeDropdown === "codigo" && codeSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs animate-in fade-in">
                                {codeSuggestions.map((item, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onMouseDown={() => handleSelectCatalogItem(item)}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2 border-0 bg-transparent cursor-pointer group text-slate-700"
                                    >
                                        <span className="font-semibold text-xs text-slate-700 uppercase group-hover:text-blue-600">
                                            {item.name} - {item.code}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Principio Activo with Autocomplete Dropdown */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Principio activo *</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={principioActivo}
                                onFocus={() => setActiveDropdown("principio")}
                                onChange={(e) => {
                                    setPrincipioActivo(e.target.value);
                                    setActiveDropdown("principio");
                                }}
                                placeholder="Ej. Amoxicilina, Ibuprofeno..."
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-colors uppercase"
                                required
                            />
                        </div>

                        {/* Suggestions dropdown for Principio Activo */}
                        {activeDropdown === "principio" && nameSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs animate-in fade-in">
                                {nameSuggestions.map((item, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onMouseDown={() => handleSelectCatalogItem(item)}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2 border-0 bg-transparent cursor-pointer group text-slate-700"
                                    >
                                        <span className="font-semibold text-xs text-slate-700 uppercase group-hover:text-blue-600">
                                            {item.name} - {item.code}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Marca */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Marca / Laboratorio</label>
                        <input
                            type="text"
                            value={marca}
                            onChange={(e) => setMarca(e.target.value)}
                            placeholder="Ej. Genfar, Lafrancol..."
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Descripción */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Descripción / Presentación</label>
                        <input
                            type="text"
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            placeholder="Ej. Tabletas 500mg, Jarabe 250mg/5ml..."
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>
            </div>
        </form>
    );
}


