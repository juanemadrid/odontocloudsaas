import React, { useState, useEffect, useRef } from "react";
import { 
  FiArrowLeft, FiSave, FiList, FiType, FiCalendar, FiCheckSquare, 
  FiTrash2, FiFileText, FiLayout, FiHash as FiNumber, FiPlus, 
  FiCheckCircle, FiCopy, FiMove, FiTag, FiPenTool 
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

    // Active element tracking for cursor insertion
    const activeElementRef = useRef(null);

    useEffect(() => {
        if (id) {
            const pred = PREDEFINED_TEMPLATES.find(t => t.id === id);
            if (pred) {
                setNombre(pred.nombre || "");
                setContenido(pred.cuerpo || pred.contenido || "");
                setFields(pred.campos || []);
                setTerceraFirma(pred.campos.some(f => f.id === 'tercera_firma') || pred.terceraFirma || false);
            } else if (inquilino) {
                loadTemplate();
            }
        }
    }, [id, inquilino]);

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const dbTemplates = await getConfigItems(inquilino, "plantillas_clinicas", "plantillas_clinicas");
            const data = dbTemplates.find(t => t.id === id);
            if (data) {
                setNombre(data.nombre || "");
                setContenido(data.cuerpo || data.contenido || "");
                setFields(data.campos || []);
                setTerceraFirma(data.terceraFirma || data.tercera_firma || false);
            }
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al cargar la plantilla");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!nombre.trim()) {
            if (toast?.warning) toast.warning("Asigne un nombre a la plantilla");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                id: id && !id.startsWith("pred_") ? id : undefined,
                nombre: nombre.toUpperCase(),
                cuerpo: contenido,
                contenido: contenido,
                campos: fields,
                terceraFirma,
                tercera_firma: terceraFirma,
                created_at: new Date().toISOString(),
                created_by: userEmail,
                updated_at: new Date().toISOString(),
                updated_by: userEmail
            };

            await saveConfigItem(inquilino, "plantillas_clinicas", "plantillas_clinicas", payload);
            if (toast?.success) toast.success("Plantilla clínica guardada correctamente");
            onBack();
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al procesar la solicitud");
        } finally {
            setSaving(false);
        }
    };

    // Insert dynamic tag/variable at exact cursor position in the active text input/textarea
    const handleInsertTag = (tag) => {
        const el = activeElementRef.current || document.activeElement;
        
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
            const start = el.selectionStart || 0;
            const end = el.selectionEnd || 0;
            const val = el.value || "";
            const newVal = val.substring(0, start) + tag + val.substring(end);

            if (el.id === "doc-contenido-textarea") {
                setContenido(newVal);
            } else if (el.id === "doc-nombre-input") {
                setNombre(newVal);
            } else if (el.dataset?.fieldId) {
                updateField(el.dataset.fieldId, el.dataset.fieldKey || "label", newVal);
            }

            setTimeout(() => {
                el.focus();
                el.setSelectionRange(start + tag.length, start + tag.length);
            }, 50);
        } else {
            // Default insertion into document body
            const textarea = document.getElementById("doc-contenido-textarea");
            if (textarea) {
                const start = textarea.selectionStart || contenido.length;
                const end = textarea.selectionEnd || contenido.length;
                const newVal = contenido.substring(0, start) + tag + contenido.substring(end);
                setContenido(newVal);
                setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start + tag.length, start + tag.length);
                }, 50);
            } else {
                setContenido(prev => prev ? `${prev} ${tag}` : tag);
            }
        }
        if (toast?.success) toast.success(`Etiqueta ${tag} insertada`);
    };

    const addField = (type) => {
        const defaultLabels = {
            section: "NUEVA SECCIÓN DE DOCUMENTO",
            text: "CAMPO DE TEXTO",
            number: "VALOR NUMÉRICO",
            date: "FECHA DE REGISTRO",
            select: "OPCIONES DE SELECCIÓN",
            textarea: "DESCRIPCIÓN / OBSERVACIONES",
            checkbox: "CASILLA DE VERIFICACIÓN"
        };

        const newField = {
            id: Date.now().toString(),
            type,
            label: defaultLabels[type] || "NUEVO CAMPO",
            required: false,
            options: type === "select" ? ["OPCIÓN 1", "OPCIÓN 2"] : []
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

    const TOOLS = [
        { type: "section", label: "Título / Sección", icon: FiList, color: "text-blue-600 bg-blue-50 border-blue-100" },
        { type: "text", label: "Texto Corto", icon: FiType, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        { type: "number", label: "Numérico", icon: FiNumber, color: "text-amber-600 bg-amber-50 border-amber-100" },
        { type: "date", label: "Fecha", icon: FiCalendar, color: "text-purple-600 bg-purple-50 border-purple-100" },
        { type: "select", label: "Seleccionable", icon: FiCheckSquare, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
        { type: "textarea", label: "Texto Largo", icon: FiFileText, color: "text-rose-600 bg-rose-50 border-rose-100" },
        { type: "checkbox", label: "Casilla Verificación", icon: FiCheckCircle, color: "text-teal-600 bg-teal-50 border-teal-100" },
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
                    
                    {/* SECTION 1: DOCUMENT BODY / TEXT CONTENT */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                                <FiFileText className="text-blue-600" size={16} />
                                <h3 className="text-[13px] font-extrabold text-slate-800 uppercase tracking-tight">
                                    Texto y Cuerpo del Documento / Consentimiento
                                </h3>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                                Edición de Texto
                            </span>
                        </div>

                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                            Escribe las cláusulas, términos o texto general del documento. Haz clic en las etiquetas del panel derecho para insertarlas al instante donde esté tu cursor.
                        </p>

                        <textarea
                            id="doc-contenido-textarea"
                            onFocus={e => activeElementRef.current = e.target}
                            rows={10}
                            disabled={isViewOnly}
                            value={contenido}
                            onChange={e => setContenido(e.target.value)}
                            placeholder="Escribe aquí las cláusulas del documento, términos legales o instructivo clínico... Ejemplo: Yo [NombrePaciente], identificado con [Documento], autorizo al Dr. [Doctor] a realizar el tratamiento de..."
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all resize-none leading-relaxed font-sans"
                        />
                    </div>

                    {/* SECTION 2: STRUCTURED DYNAMIC FIELDS BUILDER */}
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
                                                        onClick={() => removeField(field.id)}
                                                        className="w-6 h-6 rounded bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center transition-colors border border-rose-100 cursor-pointer ml-1"
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
                                                <div className="flex items-center gap-2 py-1">
                                                    <input type="checkbox" disabled={isViewOnly} className="w-4 h-4 rounded text-blue-600 border-slate-300" />
                                                    <span className="text-[11px] text-slate-600 font-medium">Opción de verificación sí / no</span>
                                                </div>
                                            )}
                                            {field.type === "select" && (
                                                <div className="space-y-2">
                                                    <select disabled={isViewOnly} className="w-full h-8 bg-white border border-slate-200 rounded-md px-3 text-[11px] text-slate-700 outline-none">
                                                        <option value="">-- Seleccionar Opción --</option>
                                                        {(field.options || []).map((op, i) => (
                                                            <option key={i} value={op}>{op}</option>
                                                        ))}
                                                    </select>
                                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                        {(field.options || []).map((op, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-extrabold border border-blue-100 flex items-center gap-1">
                                                                {op}
                                                            </span>
                                                        ))}
                                                        {!isViewOnly && (
                                                            <button
                                                                type="button"
                                                                className="px-2.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-extrabold rounded transition-colors cursor-pointer border-0"
                                                                onClick={() => {
                                                                    const current = (field.options || []).join(", ");
                                                                    const opts = prompt("Ingresa las opciones separadas por coma:", current);
                                                                    if (opts !== null) {
                                                                        const arr = opts.split(",").map(o => o.trim().toUpperCase()).filter(Boolean);
                                                                        updateField(field.id, "options", arr);
                                                                    }
                                                                }}
                                                            >
                                                                + Configurar Opciones
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
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Toolbox & Dynamic Dictionary Panel (Right 1 Column) */}
                {!isViewOnly && (
                    <div className="space-y-4">
                        
                        {/* TOOLBOX: ADD FIELDS */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                            <div>
                                <h3 className="text-[12px] font-extrabold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                                    <FiLayout className="text-blue-600" />
                                    <span>Caja de Herramientas</span>
                                </h3>
                                <p className="text-[10px] text-slate-400 font-medium">Haz clic para añadir un campo al formulario</p>
                            </div>

                            <div className="space-y-1.5">
                                {TOOLS.map((t, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => addField(t.type)}
                                        className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold ${t.color}`}>
                                                <t.icon size={13} />
                                            </div>
                                            <span className="text-[11px] font-extrabold text-slate-700 group-hover:text-blue-700">{t.label}</span>
                                        </div>
                                        <FiPlus size={14} className="text-slate-400 group-hover:text-blue-600" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* DYNAMIC DICTIONARY: CLICK TO INSERT AT CURSOR */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                            <div>
                                <h3 className="text-[12px] font-extrabold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                                    <FiTag className="text-emerald-600" />
                                    <span>Diccionario Dinámico</span>
                                </h3>
                                <p className="text-[10px] text-slate-400 font-medium">Haz clic para insertar la variable donde esté tu cursor</p>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                {VARIABLES.map((v, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleInsertTag(v.tag)}
                                        className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition-all cursor-pointer group"
                                        title={`Insertar ${v.tag} en el cursor`}
                                    >
                                        <div>
                                            <div className="text-[11px] font-extrabold text-emerald-700 font-mono">{v.tag}</div>
                                            <div className="text-[9px] text-slate-400 font-medium">{v.label}</div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 bg-white group-hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            + Insertar
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
