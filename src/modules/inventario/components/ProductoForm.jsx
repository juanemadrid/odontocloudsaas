import React, { useState, useEffect } from "react";
import { FiSave, FiX, FiCamera, FiBox, FiUploadCloud } from "react-icons/fi";
import { uploadOptimizedPublicFile } from "../../../services/storageUploadService";
import { toast } from "sonner";

const initialFormState = {
  imagen: "",
  nombre: "",
  referencia: "",
  descripcion: "",
  cuenta_contable: "",
  categoria: "",
  es_servicio: false,
  precio_compra: "",
  cantidad: 0,
  minimo: 5,
  unidad: "unidades",
  marca: "",
  principio_activo: "",
  registro_invima: "",
  forma_farmaceutica: "",
  concentracion: "",
  presentacion_comercial: "",
  temperatura_almacenamiento: "",
  unidad_temperatura: "",
  humedad_almacenamiento: "",
  unidad_humedad: "",
  es_inventariable: false,
  clasificacion_riesgo: "",
  vida_util: "",
  periodicidad_mantenimiento: "",
  periodicidad_calibracion: "",
  extension_texto_1: "",
  extension_texto_2: "",
  extension_numero_1: "",
  extension_numero_2: "",
  extension_fecha_1: "",
  extension_fecha_2: ""
};

export default function ProductoForm({ item, categories, inquilino, onSave, onCancel }) {
  const [form, setForm] = useState(initialFormState);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({ ...initialFormState, ...item });
    } else {
      setForm(initialFormState);
    }
  }, [item]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const filePath = `${inquilino}/inventario/${Date.now()}_${file.name}`;
      const uploaded = await uploadOptimizedPublicFile({
        bucket: "clinical-files",
        path: filePath,
        file,
        profile: "avatar",
        upsert: true,
      });
      setForm(prev => ({ ...prev, imagen: uploaded.publicUrl }));
      toast.success("Imagen cargada con éxito");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("No se pudo subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCOPFormat = (val) => {
    if (!val) return "";
    const numericVal = String(val).replace(/\D/g, "");
    if (!numericVal) return "";
    return Number(numericVal).toLocaleString("es-CO");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    if (!form.categoria) {
      toast.error("Debe seleccionar una categoría.");
      return;
    }
    
    // Parse numeric fields properly
    const parsedData = {
      ...form,
      precio_compra: Number(String(form.precio_compra).replace(/\D/g, "")) || 0,
      cantidad: Number(form.cantidad) || 0,
      minimo: Number(form.minimo) || 0
    };
    onSave(parsedData);
  };

  return (
    <div className="animate-in fade-in duration-300 max-w-4xl mx-auto space-y-4 pb-16 font-sans text-slate-800">
      {/* Form Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            {item ? "Modificar producto" : "Nuevo producto"}
          </h3>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Información del concepto o insumo clínico
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={onCancel}
            className="h-8 px-3.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            className="h-8 px-4 rounded-lg bg-[#7cb342] hover:bg-[#689f38] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <FiSave size={13} />
            Guardar
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Section 1: Información básica */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Información básica</h4>
          </div>

          {/* Compact Image Upload Box */}
          <div className="flex items-center gap-4 p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-300 overflow-hidden relative group cursor-pointer shadow-2xs shrink-0">
              <input 
                type="file" 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={handleImageChange}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 animate-pulse">
                  <span className="text-[9px] font-bold text-slate-400">Subiendo...</span>
                </div>
              ) : form.imagen ? (
                <img src={form.imagen} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="bg-slate-100 w-full h-full flex flex-col items-center justify-center relative">
                  <FiCamera size={22} className="text-slate-400" />
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-700">Foto del producto</p>
              <p className="text-[11px] text-slate-400">Click en el recuadro para subir imagen (PNG, JPG).</p>
            </div>
          </div>

          {/* Grid inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Nombre *</label>
              <input 
                type="text" 
                required
                placeholder="Nombre del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Referencia</label>
              <input 
                type="text" 
                placeholder="Referencia del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.referencia}
                onChange={e => setForm({ ...form, referencia: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-600">Descripción</label>
              <input 
                type="text" 
                placeholder="Descripción del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Cuenta contable</label>
              <select 
                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                value={form.cuenta_contable}
                onChange={e => setForm({ ...form, cuenta_contable: e.target.value })}
              >
                <option value="">Seleccione...</option>
                <option value="Activos">Activos</option>
                <option value="Pasivos">Pasivos</option>
                <option value="Patrimonio">Patrimonio</option>
                <option value="Ingresos">Ingresos</option>
                <option value="Egresos">Egresos</option>
                <option value="Costos de venta">Costos de venta</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Categoría *</label>
              <select 
                required
                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                value={form.categoria}
                onChange={e => setForm({ ...form, categoria: e.target.value })}
              >
                <option value="">Seleccione...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setForm({ ...form, es_servicio: !form.es_servicio })}
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer ${form.es_servicio ? 'bg-[#7cb342]' : 'bg-slate-300'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-xs transform transition-transform duration-200 absolute ${form.es_servicio ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs font-semibold text-slate-700">¿Es servicio?</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Precio compra *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">$</span>
                <input 
                  type="text" 
                  required
                  placeholder="0"
                  className="w-full pl-6 pr-3 h-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                  value={handleCOPFormat(form.precio_compra)}
                  onChange={e => setForm({ ...form, precio_compra: e.target.value.replace(/\D/g, "") })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Marca</label>
              <input 
                type="text" 
                placeholder="Marca del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.marca}
                onChange={e => setForm({ ...form, marca: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Principio activo</label>
              <input 
                type="text" 
                placeholder="Principio activo del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.principio_activo}
                onChange={e => setForm({ ...form, principio_activo: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Registro Invima</label>
              <input 
                type="text" 
                placeholder="Información Invima del Concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.registro_invima}
                onChange={e => setForm({ ...form, registro_invima: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Forma farmacéutica</label>
              <input 
                type="text" 
                placeholder="Forma farmacéutica del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.forma_farmaceutica}
                onChange={e => setForm({ ...form, forma_farmaceutica: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Concentración</label>
              <input 
                type="text" 
                placeholder="Concentración del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.concentracion}
                onChange={e => setForm({ ...form, concentracion: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Presentación comercial</label>
              <input 
                type="text" 
                placeholder="Presentación com. del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.presentacion_comercial}
                onChange={e => setForm({ ...form, presentacion_comercial: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Almacenamiento & Control */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Almacenamiento y Control</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Temperatura de almacenamiento</label>
              <input 
                type="text" 
                placeholder="Temperatura de almacenamiento"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.temperatura_almacenamiento}
                onChange={e => setForm({ ...form, temperatura_almacenamiento: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Unidad de temperatura</label>
              <select 
                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                value={form.unidad_temperatura}
                onChange={e => setForm({ ...form, unidad_temperatura: e.target.value })}
              >
                <option value="">Seleccione...</option>
                <option value="°C">Grados Celsius (°C)</option>
                <option value="°F">Grados Fahrenheit (°F)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Humedad de almacenamiento</label>
              <input 
                type="text" 
                placeholder="Humedad de almacenamiento"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.humedad_almacenamiento}
                onChange={e => setForm({ ...form, humedad_almacenamiento: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Unidad de humedad</label>
              <select 
                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                value={form.unidad_humedad}
                onChange={e => setForm({ ...form, unidad_humedad: e.target.value })}
              >
                <option value="">Seleccione...</option>
                <option value="%">% Humedad Relativa</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setForm({ ...form, es_inventariable: !form.es_inventariable })}
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer ${form.es_inventariable ? 'bg-[#7cb342]' : 'bg-slate-300'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-xs transform transition-transform duration-200 absolute ${form.es_inventariable ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs font-semibold text-slate-700">¿Es inventariable?</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Clasificación de riesgo</label>
              <input 
                type="text" 
                placeholder="Clasif. riesgo del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.clasificacion_riesgo}
                onChange={e => setForm({ ...form, clasificacion_riesgo: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Vida útil</label>
              <input 
                type="text" 
                placeholder="Vida útil del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.vida_util}
                onChange={e => setForm({ ...form, vida_util: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Periodicidad mantenimiento</label>
              <input 
                type="text" 
                placeholder="Periodicidad mant. del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.periodicidad_mantenimiento}
                onChange={e => setForm({ ...form, periodicidad_mantenimiento: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Periodicidad calibración</label>
              <input 
                type="text" 
                placeholder="Periodicidad cal. del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.periodicidad_calibracion}
                onChange={e => setForm({ ...form, periodicidad_calibracion: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Datos adicionales */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Datos adicionales / Extensiones</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Extensión texto 1</label>
              <input 
                type="text" 
                placeholder="Ext. texto 1 del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.extension_texto_1}
                onChange={e => setForm({ ...form, extension_texto_1: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Extensión texto 2</label>
              <input 
                type="text" 
                placeholder="Ext. texto 2 del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.extension_texto_2}
                onChange={e => setForm({ ...form, extension_texto_2: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Extensión número 1</label>
              <input 
                type="number" 
                placeholder="Ext. número 1 del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.extension_numero_1}
                onChange={e => setForm({ ...form, extension_numero_1: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Extensión número 2</label>
              <input 
                type="number" 
                placeholder="Ext. número 2 del concepto"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.extension_numero_2}
                onChange={e => setForm({ ...form, extension_numero_2: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Extensión fecha 1</label>
              <input 
                type="date" 
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.extension_fecha_1}
                onChange={e => setForm({ ...form, extension_fecha_1: e.target.value })}
                max="9999-12-31" min="1900-01-01" 
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Extensión fecha 2</label>
              <input 
                type="date" 
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={form.extension_fecha_2}
                onChange={e => setForm({ ...form, extension_fecha_2: e.target.value })}
                max="9999-12-31" min="1900-01-01" 
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex justify-end gap-2.5">
          <button 
            type="button" 
            onClick={onCancel}
            className="h-8 px-4 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="h-8 px-5 rounded-lg text-xs font-semibold text-white bg-[#7cb342] hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <FiSave size={13} />
            Guardar
          </button>
        </div>

      </form>
    </div>
  );
}
