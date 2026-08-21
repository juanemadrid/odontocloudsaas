import React, { useState, useEffect, useRef } from "react";
import { 
  FiArrowLeft, FiSave, FiList, FiType, FiCalendar, FiCheckSquare, 
  FiTrash2, FiFileText, FiLayout, FiHash as FiNumber, FiPlus, 
  FiCheckCircle, FiCopy, FiMove, FiTag, FiPenTool, FiX, FiCheck,
  FiArrowUp, FiArrowDown
} from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext";
import { PREDEFINED_TEMPLATES } from "../../data/plantillasPredeterminadas";
import { getConfigItems, saveConfigItem } from "../../services/configPersistenceService";

export default function PlantillaEditor({ id, isViewOnly = false, onBack, inquilino, userEmail }) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nombre, setNombre] = useState("");
    const [contenido, setContenido] = useState("");
    const [fields, setFields] = useState([]);
    const [terceraFirma, setTerceraFirma] = useState(false);

    // Options Modal State for select and checkbox fields
    const [optionsModalOpen, setOptionsModalOpen] = useState(false);
    const [editingFieldId, setEditingFieldId] = useState(null);
    const [modalOptions, setModalOptions] = useState([]);
    const [newOptionInput, setNewOptionInput] = useState("");

    // Active element tracking for cursor insertion
    const activeElementRef = useRef(null);

    useEffect(() => {
        if (id) {
            const pred = PREDEFINED_TEMPLATES.find(t => t.id === id);
            if (pred) {
                setNombre(pred.nombre || "");
                setContenido(pred.cuerpo || pred.contenido || "");
                setFields(pred.campos || []);
                setTerceraFirma(pred.campos?.some(f => f.id === 'tercera_firma') || pred.terceraFirma || false);
            } else if (inquilino) {
                loadTemplate();
            }
        }
    }, [id, inquilino]);

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const list = await getConfigItems(inquilino, "plantillas_clinicas", "plantillas_clinicas");
            if (Array.isArray(list)) {
                const found = list.find(t => t.id === id);
                if (found) {
                    setNombre(found.nombre || "");
                    setContenido(found.cuerpo || found.contenido || "");
                    setFields(found.campos || []);
                    setTerceraFirma(found.campos?.some(f => f.id === 'tercera_firma') || found.terceraFirma || false);
                }
            }
        } catch (err) {
            console.error("Error loading template in editor:", err);
            toast?.error?.("Error al cargar la plantilla");
        } finally {
            setLoading(false);
        }
    };

    const handleInsertTag = (tag) => {
        const el = activeElementRef.current;
        if (!el) {
            if (fields.length > 0) {
                const lastField = fields[fields.length - 1];
                updateField(lastField.id, "label", (lastField.label || "") + " " + tag);
                if (toast?.success) toast.success(`Etiqueta ${tag} añadida al campo`);
            } else {
                if (toast?.info) toast.info(`Selecciona o haz clic en un campo para insertar ${tag}`);
            }
            return;
        }

        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const text = el.value || "";
        const updatedText = text.substring(0, start) + tag + text.substring(end);

        const fieldId = el.getAttribute("data-field-id");
        const fieldKey = el.getAttribute("data-field-key");

        if (fieldId && fieldKey) {
            updateField(fieldId, fieldKey, updatedText);
        } else if (el.id === "doc-nombre-input") {
            setNombre(updatedText);
        } else {
            setContenido(updatedText);
        }

        setTimeout(() => {
            el.focus();
            const newPos = start + tag.length;
            if (el.setSelectionRange) {
                el.setSelectionRange(newPos, newPos);
            }
        }, 10);
    };

    const handleSave = async () => {
        if (!nombre.trim()) {
            toast?.error?.("El nombre de la plantilla es obligatorio (*)");
            return;
        }

        setSaving(true);
        try {
            const currentList = await getConfigItems(inquilino, "plantillas_clinicas", "plantillas_clinicas") || [];
            const isArray = Array.isArray(currentList);
            const list = isArray ? [...currentList] : [];

            const templatePayload = {
                id: id || Date.now().toString(),
                nombre: nombre.trim().toUpperCase(),
                tipo: "plantilla_clinica",
                tipoDocumento: nombre.trim().toUpperCase(),
                cuerpo: contenido,
                contenido: contenido,
                campos: fields,
                terceraFirma: terceraFirma,
                tercera_firma: terceraFirma,
                updated_at: new Date().toISOString()
            };

            const existingIndex = list.findIndex(t => t.id === templatePayload.id);
            if (existingIndex >= 0) {
                list[existingIndex] = templatePayload;
            } else {
                list.push(templatePayload);
            }

            await saveConfigItem(inquilino, "plantillas_clinicas", "plantillas_clinicas", list);
            toast?.success?.("Plantilla guardada correctamente");
            if (onBack) onBack();
        } catch (err) {
            console.error("Error saving template:", err);
            toast?.error?.("No se pudo guardar la plantilla");
        } finally {
            setSaving(false);
        }
    };

    const addField = (type) => {
        const defaultLabels = {
            section: "NUEVA SECCIÓN DE DOCUMENTO",
            text: "CAMPO DE TEXTO",
            number: "VALOR NUMÉRICO",
            date: "FECHA DE REGISTRO",
            select: "OPCIONES DE SELECCIÓN",
            textarea: "DESCRIPCIÓN / OBSERVACIONES",
            checkbox: "CASILLAS DE VERIFICACIÓN"
        };

        const newField = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
            type,
            label: defaultLabels[type] || "NUEVO CAMPO",
            required: false,
            options: (type === "select" || type === "checkbox") ? ["OPCIÓN 1", "OPCIÓN 2"] : []
        };

        setFields(prev => [...prev, newField]);
        if (toast?.success) toast.success(`Campo "${newField.label}" añadido`);
    };

    const updateField = (fieldId, key, value) => {
        setFields(prev => prev.map(f => f.id === fieldId ? { ...f, [key]: value } : f));
    };

    const removeField = (fieldId) => {
        setFields(prev => prev.filter(f => f.id !== fieldId));
    };

    const moveField = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= fields.length) return;
        const newFields = [...fields];
        const [moved] = newFields.splice(index, 1);
        newFields.splice(targetIndex, 0, moved);
        setFields(newFields);
    };

    const duplicateField = (index) => {
        const source = fields[index];
        if (!source) return;
        const cloned = {
            ...source,
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            options: source.options ? [...source.options] : [],
        };
        const newFields = [...fields];
        newFields.splice(index + 1, 0, cloned);
        setFields(newFields);
        if (toast?.success) toast.success(`Campo "${cloned.label || 'Campo'}" duplicado`);
    };

    // Modal helpers for Select and Checkbox Options
    const openOptionsModal = (field) => {
        setEditingFieldId(field.id);
        setModalOptions([...(field.options || [])]);
        setNewOptionInput("");
        setOptionsModalOpen(true);
    };

    const handleAddModalOption = (e) => {
        if (e) e.preventDefault();
        const trimmed = newOptionInput.trim().toUpperCase();
        if (!trimmed) return;
        if (modalOptions.includes(trimmed)) {
            if (toast?.warning) toast.warning("Esta opción ya existe en la lista");
            return;
        }
        setModalOptions(prev => [...prev, trimmed]);
        setNewOptionInput("");
    };

    const handleRemoveModalOption = (indexToRemove) => {
        setModalOptions(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleUpdateModalOption = (index, value) => {
        setModalOptions(prev => {
            const copy = [...prev];
            copy[index] = value.toUpperCase();
            return copy;
        });
    };

    const handleMoveModalOption = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= modalOptions.length) return;
        const copy = [...modalOptions];
        const [moved] = copy.splice(index, 1);
        copy.splice(targetIndex, 0, moved);
        setModalOptions(copy);
    };

    const handleApplyPreset = (presetArray) => {
        setModalOptions(presetArray.map(p => p.toUpperCase()));
    };

    const handleSaveModalOptions = () => {
        if (editingFieldId) {
            const cleanList = modalOptions.map(o => (typeof o === 'string' ? o.trim().toUpperCase() : '')).filter(Boolean);
            updateField(editingFieldId, "options", cleanList);
            if (toast?.success) toast.success("Opciones actualizadas correctamente");
        }
        setOptionsModalOpen(false);
        setEditingFieldId(null);
    };

    const TOOLS = [
        { type: "section", label: "Título / Sección", icon: FiList, color: "text-blue-600 bg-blue-50 border-blue-100" },
        { type: "text", label: "Texto Corto", icon: FiType, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        { type: "number", label: "Numérico", icon: FiNumber, color: "text-amber-600 bg-amber-50 border-amber-100" },
        { type: "date", label: "Fecha", icon: FiCalendar, color: "text-purple-600 bg-purple-50 border-purple-100" },
        { type: "select", label: "Seleccionable", icon: FiCheckSquare, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
        { type: "textarea", label: "Texto Largo", icon: FiFileText, color: "text-rose-600 bg-rose-50 border-rose-100" },
        { type: "checkbox", label: "Casillas Verificación", icon: FiCheckCircle, color: "text-teal-600 bg-teal-50 border-teal-100" },
    ];

    const VARIABLES = [
        { tag: "[NombrePaciente]", label: "Nombre del Paciente" },
        { tag: "[TipoDocumento]", label: "Tipo de Documento" },
        { tag: "[Documento]", label: "N° Documento" },
        { tag: "[Doctor]", label: "Nombre del Doctor" },
        { tag: "[Telefono]", label: "Teléfono Paciente" },
        { tag: "[Ciudad]", label: "Ciudad" },
        { tag: "[Fecha]", label: "Fecha Actual" },
        { tag: "[FirmaPaciente]", label: "Firma Paciente" },
        { tag: "[FirmaDoctor]", label: "Firma Doctor" },
        { tag: "[TerceraFirma]", label: "Tercera Firma" }
    ];

    const currentEditingField = fields.find(f => f.id === editingFieldId);

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5 flex-1 w-full">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Volver al listado"
                    >
                        <FiArrowLeft size={16} />
                    </button>

                    <div className="flex-1 max-w-xl">
                        <input
                            id="doc-nombre-input"
                            onFocus={e => activeElementRef.current = e.target}
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-extrabold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all uppercase placeholder:font-medium placeholder:text-slate-400"
                            placeholder="NOMBRE DE LA PLANTILLA CLÍNICA / DOCUMENTO..."
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            disabled={isViewOnly}
                        />
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                        {isViewOnly ? "(Modo Lectura)" : "(Modo Edición)"}
                    </span>
                </div>

                {!isViewOnly && (
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[12px] font-extrabold shadow-sm flex items-center gap-2 transition-all cursor-pointer border-0 shrink-0 disabled:opacity-50"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={16} />
                        )}
                        <span>{saving ? "Guardando..." : "Guardar Plantilla"}</span>
                    </button>
                )}
            </div>

            {/* Layout Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                
                {/* Main Document Canvas (Left 3 Columns) */}
                <div className="lg:col-span-3 space-y-4">
                    
                    {/* STRUCTURED DYNAMIC FIELDS BUILDER */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <FiLayout className="text-blue-600" size={16} />
                                <h3 className="text-[13px] font-extrabold text-slate-800 uppercase tracking-tight">
                                    Campos Dinámicos y Preguntas Adicionales
                                </h3>
                            </div>
                            <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                                {fields.length} CAMPOS CONFIGURADOS
                            </span>
                        </div>

                        {fields.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 font-medium space-y-2 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                <FiLayout size={28} className="mx-auto text-slate-300" />
                                <p className="text-[12px] font-bold text-slate-600">No hay campos dinámicos específicos añadidos aún</p>
                                <p className="text-[11px] text-slate-400">Puedes hacer clic en la caja de herramientas (derecha) para agregar preguntas o campos de captura.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {fields.map((field, idx) => (
                                    <div key={field.id} className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2.5 relative group hover:border-blue-300 transition-all shadow-2xs">
                                        
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className="w-2 h-4 bg-blue-600 rounded-full shrink-0"></span>
                                                <input
                                                    data-field-id={field.id}
                                                    data-field-key="label"
                                                    onFocus={e => activeElementRef.current = e.target}
                                                    value={field.label}
                                                    onChange={e => updateField(field.id, "label", e.target.value.toUpperCase())}
                                                    className="w-full text-[12px] font-extrabold text-slate-800 bg-transparent border-none outline-none uppercase p-0 focus:ring-0 focus:text-blue-700"
                                                    placeholder="ETIQUETA / PREGUNTA DEL CAMPO..."
                                                    disabled={isViewOnly}
                                                />
                                            </div>

                                            {!isViewOnly && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => moveField(idx, -1)}
                                                        disabled={idx === 0}
                                                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 flex items-center justify-center transition-colors border-0 cursor-pointer text-[10px] font-bold"
                                                        title="Mover arriba"
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveField(idx, 1)}
                                                        disabled={idx === fields.length - 1}
                                                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 flex items-center justify-center transition-colors border-0 cursor-pointer text-[10px] font-bold"
                                                        title="Mover abajo"
                                                    >
                                                        ▼
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => duplicateField(idx)}
                                                        className="w-6 h-6 rounded bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center transition-colors border border-blue-100 cursor-pointer"
                                                        title="Duplicar campo"
                                                    >
                                                        <FiCopy size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeField(field.id)}
                                                        className="w-6 h-6 rounded bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center transition-colors border border-rose-100 cursor-pointer ml-0.5"
                                                        title="Eliminar campo"
                                                    >
                                                        <FiTrash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Field Editable Input Preview */}
                                        <div className="pl-3.5 text-[12px]">
                                            {field.type === "section" && (
                                                <div className="h-1 bg-blue-200 rounded-full my-2" />
                                            )}
                                            {field.type === "text" && (
                                                <input
                                                    type="text"
                                                    disabled={isViewOnly}
                                                    placeholder="Entrada de texto corto..."
                                                    className="w-full h-8 bg-white border border-slate-200 rounded-md px-3 text-[11px] text-slate-700 outline-none focus:border-blue-500"
                                                />
                                            )}
                                            {field.type === "number" && (
                                                <input
                                                    type="number"
                                                    disabled={isViewOnly}
                                                    placeholder="0000"
                                                    className="w-40 h-8 bg-white border border-slate-200 rounded-md px-3 text-[11px] text-slate-700 outline-none focus:border-blue-500"
                                                />
                                            )}
                                            {field.type === "textarea" && (
                                                <textarea
                                                    rows={2}
                                                    disabled={isViewOnly}
                                                    placeholder="Detalle o descripción clínica..."
                                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 outline-none focus:border-blue-500 resize-none"
                                                />
                                            )}
                                            {field.type === "date" && (
                                                <input
                                                    type="date"
                                                    disabled={isViewOnly}
                                                    className="w-48 h-8 bg-white border border-slate-200 rounded-md px-3 text-[11px] text-slate-700 outline-none focus:border-blue-500"
                                                 max="9999-12-31" min="1900-01-01" />
                                            )}
                                            {field.type === "checkbox" && (
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                        {(field.options && field.options.length > 0 ? field.options : ["OPCIÓN 1", "OPCIÓN 2"]).map((op, i) => (
                                                            <div key={i} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg shadow-2xs">
                                                                <input
                                                                    type="checkbox"
                                                                    disabled={isViewOnly}
                                                                    className="w-4 h-4 rounded text-blue-600 border-slate-300 cursor-pointer"
                                                                />
                                                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                                                    {op}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                        {(field.options || []).map((op, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-[10px] font-extrabold border border-teal-100 flex items-center gap-1">
                                                                ☑ {op}
                                                            </span>
                                                        ))}
                                                        {!isViewOnly && (
                                                            <button
                                                                type="button"
                                                                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-extrabold rounded-md transition-colors cursor-pointer border border-teal-200 flex items-center gap-1 shadow-2xs"
                                                                onClick={() => openOptionsModal(field)}
                                                            >
                                                                <FiCheckSquare size={12} />
                                                                <span>+ Configurar Casillas</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {field.type === "select" && (
                                                <div className="space-y-2">
                                                    <select
                                                        disabled={isViewOnly}
                                                        className="w-full h-8 bg-white border border-slate-200 rounded-md px-3 text-[11px] text-slate-700 outline-none focus:border-blue-500"
                                                    >
                                                        {(field.options && field.options.length > 0 ? field.options : ["OPCIÓN 1", "OPCIÓN 2"]).map((op, i) => (
                                                            <option key={i} value={op}>{op}</option>
                                                        ))}
                                                    </select>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {(field.options || []).map((op, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-extrabold border border-indigo-100">
                                                                {op}
                                                            </span>
                                                        ))}
                                                        {!isViewOnly && (
                                                            <button
                                                                type="button"
                                                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-md transition-colors cursor-pointer border border-indigo-200 flex items-center gap-1 shadow-2xs"
                                                                onClick={() => openOptionsModal(field)}
                                                            >
                                                                <FiCheckSquare size={12} />
                                                                <span>+ Configurar Opciones</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {field.type !== "section" && (
                                            <div className="pl-3.5 pt-1 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`req-${field.id}`}
                                                    checked={field.required || false}
                                                    onChange={e => updateField(field.id, "required", e.target.checked)}
                                                    disabled={isViewOnly}
                                                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <label htmlFor={`req-${field.id}`} className="text-[11px] font-bold text-slate-600 cursor-pointer">
                                                    Obligatorio en diligenciamiento
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Footer Options */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[12px]">
                            <div>
                                <span className="font-extrabold text-slate-800 block">Tercera Firma Autorizada</span>
                                <span className="text-[11px] text-slate-500 font-medium">Habilitar un tercer firmante adicional (ej: Tutor, Testigo o Especialista)</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={terceraFirma}
                                onChange={(e) => setTerceraFirma(e.target.checked)}
                                disabled={isViewOnly}
                                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                    </div>

                </div>

                {/* Right Sidebar: Toolbox & Dynamic Dictionary (1 Column) */}
                <div className="space-y-4">
                    
                    {/* TOOLBOX: ADD DYNAMIC FIELDS */}
                    {!isViewOnly && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                            <div className="border-b border-slate-100 pb-2">
                                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-wide">
                                    Caja de Herramientas
                                </h3>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    Agrega campos interactivos al documento
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                {TOOLS.map((tool) => {
                                    const Icon = tool.icon;
                                    return (
                                        <button
                                            key={tool.type}
                                            type="button"
                                            onClick={() => addField(tool.type)}
                                            className={`w-full p-2.5 rounded-lg border text-[11px] font-extrabold flex items-center justify-between transition-all cursor-pointer ${tool.color} hover:brightness-95 shadow-2xs`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon size={14} />
                                                <span>{tool.label}</span>
                                            </div>
                                            <FiPlus size={12} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* DYNAMIC VARIABLES DICTIONARY */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                        <div className="border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <FiTag className="text-blue-600" size={14} />
                                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-wide">
                                    Diccionario Dinámico
                                </h3>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium leading-tight">
                                Haz clic para insertar la variable donde esté tu cursor
                            </p>
                        </div>

                        <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                            {VARIABLES.map((v) => (
                                <div
                                    key={v.tag}
                                    className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex items-center justify-between gap-1 group"
                                >
                                    <div className="min-w-0 flex-1">
                                        <span className="text-[11px] font-bold text-blue-700 block truncate font-mono">
                                            {v.tag}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-medium block truncate">
                                            {v.label}
                                        </span>
                                    </div>
                                    {!isViewOnly && (
                                        <button
                                            type="button"
                                            onClick={() => handleInsertTag(v.tag)}
                                            className="px-2 py-1 bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded text-[10px] font-extrabold transition-colors cursor-pointer shrink-0 shadow-2xs"
                                        >
                                            + Insertar
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>

            {/* OPTIONS CONFIGURATION MODAL (FOR SELECT & CHECKBOXES) */}
            {optionsModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className={`p-4 border-b border-slate-100 flex items-center justify-between ${
                            currentEditingField?.type === 'checkbox' ? 'bg-teal-50/80' : 'bg-indigo-50/80'
                        }`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    currentEditingField?.type === 'checkbox' ? 'bg-teal-600 text-white' : 'bg-indigo-600 text-white'
                                }`}>
                                    <FiCheckSquare size={16} />
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">
                                        {currentEditingField?.type === 'checkbox' 
                                            ? "Configurar Casillas de Verificación" 
                                            : "Configurar Opciones del Menú Desplegable"}
                                    </h4>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        {currentEditingField?.type === 'checkbox'
                                            ? "Define las opciones que el doctor podrá marcar independientemente"
                                            : "Define las opciones disponibles en la lista de selección"}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOptionsModalOpen(false)}
                                className="w-7 h-7 rounded-lg bg-white/80 hover:bg-white text-slate-500 hover:text-slate-700 flex items-center justify-center border border-slate-200 cursor-pointer"
                            >
                                <FiX size={14} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                            {/* Input to add new option */}
                            <form onSubmit={handleAddModalOption} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newOptionInput}
                                    onChange={e => setNewOptionInput(e.target.value)}
                                    placeholder={currentEditingField?.type === 'checkbox' ? "Ej: DOLOR LEVE, SIN SÍNTOMAS, CONTROL..." : "Ej: NORMAL, ANORMAL, CONTROL..."}
                                    className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 uppercase outline-none focus:bg-white focus:border-blue-500"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    className="px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-black uppercase cursor-pointer border-0 transition-colors flex items-center gap-1"
                                >
                                    <FiPlus size={13} />
                                    <span>Agregar</span>
                                </button>
                            </form>

                            {/* Preset Buttons */}
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Preajustes rápidos:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleApplyPreset(["SÍ", "NO", "NO REFIERE"])}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer border border-slate-200"
                                    >
                                        SÍ / NO / NO REFIERE
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApplyPreset(["BUENO", "REGULAR", "MALO"])}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer border border-slate-200"
                                    >
                                        BUENO / REGULAR / MALO
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApplyPreset(["NORMAL", "ANORMAL", "NO EVALUADO"])}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer border border-slate-200"
                                    >
                                        NORMAL / ANORMAL
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApplyPreset(["LEVE", "MODERADO", "SEVERO"])}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer border border-slate-200"
                                    >
                                        LEVE / MODERADO / SEVERO
                                    </button>
                                </div>
                            </div>

                            {/* Options List */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-slate-700 uppercase">
                                        Lista de opciones ({modalOptions.length})
                                    </span>
                                </div>

                                {modalOptions.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 text-[11px] font-medium border border-dashed border-slate-200 rounded-lg">
                                        No hay opciones agregadas aún. Escribe una arriba y haz clic en "Agregar".
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {modalOptions.map((opt, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg group hover:bg-blue-50/30 hover:border-blue-200 transition-all"
                                            >
                                                <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-center">
                                                    {idx + 1}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={e => handleUpdateModalOption(idx, e.target.value)}
                                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-bold text-slate-800 uppercase outline-none focus:border-blue-500"
                                                />
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveModalOption(idx, -1)}
                                                        disabled={idx === 0}
                                                        className="w-6 h-6 rounded bg-white hover:bg-slate-200 text-slate-600 disabled:opacity-20 flex items-center justify-center border border-slate-200 cursor-pointer text-[10px] font-bold"
                                                        title="Subir"
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveModalOption(idx, 1)}
                                                        disabled={idx === modalOptions.length - 1}
                                                        className="w-6 h-6 rounded bg-white hover:bg-slate-200 text-slate-600 disabled:opacity-20 flex items-center justify-center border border-slate-200 cursor-pointer text-[10px] font-bold"
                                                        title="Bajar"
                                                    >
                                                        ▼
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveModalOption(idx)}
                                                        className="w-6 h-6 rounded bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center border border-rose-100 cursor-pointer ml-1"
                                                        title="Eliminar opción"
                                                    >
                                                        <FiTrash2 size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setOptionsModalOpen(false)}
                                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200 cursor-pointer transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveModalOptions}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-black uppercase cursor-pointer border-0 transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                                <FiCheck size={14} />
                                <span>Aplicar Opciones</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
