import React, { useState, useEffect } from "react";
import { FiArrowLeft, FiSave, FiCheck, FiInfo } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem } from "../../services/configPersistenceService";
import { PREDEFINED_TEMPLATES } from "../../data/plantillasPredeterminadas";

// Default fields definition for Formulario Físico
export const DEFAULT_FORMULARIO_FISICO_FIELDS = [
  // Left Column items
  { id: "fc", key: "fc", editLabel: "FC", viewLabel: "FC", type: "input", col: "left", visible: true },
  { id: "fr", key: "fr", editLabel: "FR", viewLabel: "FR", type: "input", col: "left", visible: true },
  { id: "peso", key: "peso", editLabel: "PESO", viewLabel: "PESO (Kg)", type: "input", col: "left", visible: true },
  { id: "otro_param", key: "otro_param", editLabel: "----", viewLabel: "---", type: "input", col: "left", visible: true },
  { id: "cabeza", key: "cabeza", editLabel: "Cabeza", viewLabel: "Cabeza", type: "textarea", col: "left", visible: true },
  { id: "cuello", key: "cuello", editLabel: "Cuello", viewLabel: "Cuello", type: "textarea", col: "left", visible: true },
  { id: "cardio_pulmonar", key: "cardio_pulmonar", editLabel: "Pulmonar", viewLabel: "Cardio Pulmonar", type: "textarea", col: "left", visible: true },
  { id: "genitourinario", key: "genitourinario", editLabel: "Genito-urinario", viewLabel: "Genitourinario", type: "textarea", col: "left", visible: true },
  { id: "neurologicos", key: "neurologicos", editLabel: "Neuro-lógico", viewLabel: "Neurológicos", type: "textarea", col: "left", visible: true },

  // Right Column items
  { id: "pa", key: "pa", editLabel: "PA", viewLabel: "PA", type: "input", col: "right", visible: true },
  { id: "tc", key: "tc", editLabel: "TC", viewLabel: "TC", type: "input", col: "right", visible: true },
  { id: "talla", key: "talla", editLabel: "Talla", viewLabel: "TALLA", type: "input", col: "right", visible: true },
  { id: "imc", key: "imc", editLabel: "IMC", viewLabel: "IMC", type: "input", col: "right", visible: true },
  { id: "organos_sentidos", key: "organos_sentidos", editLabel: "Órganos", viewLabel: "Órgano de los sentidos", type: "textarea", col: "right", visible: true },
  { id: "torax", key: "torax", editLabel: "Tórax", viewLabel: "Tórax", type: "textarea", col: "right", visible: true },
  { id: "abdomen", key: "abdomen", editLabel: "Abdomen", viewLabel: "Abdomen", type: "textarea", col: "right", visible: true },
  { id: "columna", key: "columna", editLabel: "Columna", viewLabel: "Columna y extremidades", type: "textarea", col: "right", visible: true },
  { id: "piel_anexos", key: "piel_anexos", editLabel: "Piel y Anexos", viewLabel: "Piel y Anexos", type: "textarea", col: "right", visible: true },
];

export default function FormularioFisicoConfig({ isViewOnly = false, onBack, inquilino, userEmail }) {
  const toast = useToast();
  const [fields, setFields] = useState(DEFAULT_FORMULARIO_FISICO_FIELDS);
  const [terceraFirma, setTerceraFirma] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!inquilino) return;
    const loadConfig = async () => {
      setLoading(true);
      try {
        const dbTemplates = await getConfigItems(inquilino, "plantillas_clinicas", "plantillas_clinicas");
        const found = dbTemplates?.find(t => t.id === "formulario_fisico" || t.nombre === "FORMULARIO FISICO");
        if (found && Array.isArray(found.campos) && found.campos.length > 0) {
          // Merge saved visibility settings with base fields
          const updated = DEFAULT_FORMULARIO_FISICO_FIELDS.map(def => {
            const match = found.campos.find(c => c.id === def.id || c.key === def.key || c.label === def.editLabel || c.label === def.viewLabel);
            return {
              ...def,
              visible: match !== undefined ? (match.visible !== false) : true
            };
          });
          setFields(updated);
          setTerceraFirma(found.terceraFirma || found.tercera_firma || false);
        }
      } catch (err) {
        console.error("Error loading formulario_fisico config:", err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [inquilino]);

  const toggleField = (fieldId) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, visible: !f.visible } : f));
  };

  const handleSave = async () => {
    if (!inquilino) {
      if (toast?.error) toast.error("Error de sesión o clínica no identificada");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: "formulario_fisico",
        nombre: "FORMULARIO FISICO",
        isSystem: true,
        campos: fields.map(f => ({
          id: f.id,
          key: f.key,
          label: f.editLabel,
          fullLabel: f.viewLabel,
          type: f.type,
          visible: f.visible
        })),
        terceraFirma,
        tercera_firma: terceraFirma,
        updated_at: new Date().toISOString(),
        updated_by: userEmail || "admin"
      };

      await saveConfigItem(inquilino, "plantillas_clinicas", "plantillas_clinicas", payload);
      if (toast?.success) toast.success("Configuración de plantilla física guardada correctamente");
      if (onBack) onBack();
    } catch (err) {
      console.error("Error saving formulario_fisico config:", err);
      if (toast?.error) toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const leftFields = fields.filter(f => f.col === "left");
  const rightFields = fields.filter(f => f.col === "right");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Volver a plantillas"
          >
            <FiArrowLeft size={16} />
          </button>
          <h1 className="text-base md:text-lg font-bold text-slate-800 tracking-tight">
            {isViewOnly ? "Formulario físico" : "Formulario plantilla física"}
          </h1>
        </div>
        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
          <span>🏠</span>
          <span>Configuración</span>
          <span>-</span>
          <span>Plantillas Doc. Clínicos</span>
          <span>-</span>
          <span className="text-slate-600 font-semibold">{isViewOnly ? "Formulario físico" : "Formulario"}</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-10 transition-all">
        {isViewOnly ? (
          /* ======================= VISTA PREVIA (IMAGE 2) ======================= */
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Top Vitals Row 1: FC, PA, FR, TC */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {fields.find(f => f.id === "fc")?.visible !== false && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">FC</label>
                  <input
                    type="text"
                    readOnly
                    placeholder=""
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none cursor-default"
                  />
                </div>
              )}
              {fields.find(f => f.id === "pa")?.visible !== false && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">PA</label>
                  <input
                    type="text"
                    readOnly
                    placeholder=""
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none cursor-default"
                  />
                </div>
              )}
              {fields.find(f => f.id === "fr")?.visible !== false && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">FR</label>
                  <input
                    type="text"
                    readOnly
                    placeholder=""
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none cursor-default"
                  />
                </div>
              )}
              {fields.find(f => f.id === "tc")?.visible !== false && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">TC</label>
                  <input
                    type="text"
                    readOnly
                    placeholder=""
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none cursor-default"
                  />
                </div>
              )}
            </div>

            {/* Top Vitals Row 2: PESO (Kg), TALLA, IMC, --- */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {fields.find(f => f.id === "peso")?.visible !== false && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">PESO (Kg)</label>
                  <input
                    type="text"
                    readOnly
                    placeholder=""
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none cursor-default"
                  />
                </div>
              )}
              {fields.find(f => f.id === "talla")?.visible !== false && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">TALLA</label>
                  <input
                    type="text"
                    readOnly
                    placeholder=""
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none cursor-default"
                  />
                </div>
              )}
              {fields.find(f => f.id === "imc")?.visible !== false && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">IMC</label>
                  <input
                    type="text"
                    readOnly
                    placeholder=""
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none cursor-default"
                  />
                </div>
              )}
              {fields.find(f => f.id === "otro_param")?.visible !== false && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">---</label>
                  <input
                    type="text"
                    readOnly
                    placeholder=""
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none cursor-default"
                  />
                </div>
              )}
            </div>

            {/* Detailed Body Textareas with Left Label */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              {[
                { id: "cabeza", label: "Cabeza" },
                { id: "organos_sentidos", label: "Órgano de los sentidos" },
                { id: "cuello", label: "Cuello" },
                { id: "torax", label: "Tórax" },
                { id: "cardio_pulmonar", label: "Cardio Pulmonar" },
                { id: "abdomen", label: "Abdomen" },
                { id: "genitourinario", label: "Genitourinario" },
                { id: "columna", label: "Columna y extremidades" },
                { id: "neurologicos", label: "Neurológicos" },
                { id: "piel_anexos", label: "Piel y Anexos" }
              ].map(item => {
                const f = fields.find(x => x.id === item.id);
                if (f && f.visible === false) return null;
                return (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 items-start gap-2 md:gap-4">
                    <label className="text-[12px] font-medium text-slate-600 pt-1.5 md:col-span-1">
                      {item.label}
                    </label>
                    <div className="md:col-span-3">
                      <textarea
                        readOnly
                        rows={2}
                        placeholder=""
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px] text-slate-700 outline-none resize-none cursor-default"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom: Tercera Firma */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-2">
              <span className="text-[12px] font-semibold text-slate-700">Tercera firma</span>
              <span title="Habilitar tercera firma de testigo / acompañante" className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <FiInfo size={14} />
              </span>
              <div
                onClick={() => setTerceraFirma(!terceraFirma)}
                className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${
                  terceraFirma ? "bg-sky-500" : "bg-slate-200"
                }`}
              >
                <div
                  className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                    terceraFirma ? "translate-x-4" : "translate-x-[2px]"
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={onBack}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer border-0"
              >
                Volver
              </button>
            </div>
          </div>
        ) : (
          /* ======================= EDICIÓN / CONFIGURACIÓN (IMAGE 1) ======================= */
          <div>
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-slate-700">Configuracion plantilla fisica</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6 max-w-4xl mx-auto">
              {/* Left Column */}
              <div className="space-y-6">
                {leftFields.map(field => (
                  <div key={field.id} className="flex items-center justify-between py-1">
                    <span className="text-[12px] font-medium text-slate-600 uppercase tracking-wide">
                      {field.editLabel}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400 font-medium">¿Visible?</span>
                      <div
                        onClick={() => toggleField(field.id)}
                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${
                          field.visible ? "bg-sky-500" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                            field.visible ? "translate-x-5" : "translate-x-[2px]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {rightFields.map(field => (
                  <div key={field.id} className="flex items-center justify-between py-1">
                    <span className="text-[12px] font-medium text-slate-600 uppercase tracking-wide">
                      {field.editLabel}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400 font-medium">¿Visible?</span>
                      <div
                        onClick={() => toggleField(field.id)}
                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${
                          field.visible ? "bg-sky-500" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                            field.visible ? "translate-x-5" : "translate-x-[2px]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Action Button */}
            <div className="mt-12 flex justify-end items-center gap-3 border-t border-slate-100 pt-6">
              <button
                onClick={onBack}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer border-0"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-[#86efac] hover:bg-[#4ade80] text-slate-800 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer border-0 flex items-center gap-2 disabled:opacity-50"
              >
                <FiSave size={14} />
                <span>{saving ? "Guardando..." : "Guardar"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
