import React, { useState, useEffect } from "react";
import { FiSave, FiX, FiCamera, FiBox, FiUploadCloud } from "react-icons/fi";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../../firebase/firebaseConfig";
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
      const storageRef = ref(storage, `inventario/${inquilino}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm(prev => ({ ...prev, imagen: url }));
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
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto space-y-6 pb-20">
      {/* Form Page Header */}
      <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            {item ? "Modificar producto" : "Nuevo producto"}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
            Información del concepto o insumo clínico
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onCancel}
            className="h-10 px-5 rounded-full border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            className="h-10 px-6 rounded-full bg-[#8cc33f] hover:bg-[#7db02b] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[#8cc33f]/20 transition-all"
          >
            Guardar
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Información básica */}
        <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-50 pb-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Información básica</h4>
          </div>

          {/* Image Upload Box */}
          <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 gap-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Imagen</span>
            <div className="w-36 h-36 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-slate-300 overflow-hidden relative group cursor-pointer shadow-sm">
              <input 
                type="file" 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={handleImageChange}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 animate-pulse">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subiendo...</span>
                </div>
              ) : form.imagen ? (
                <img src={form.imagen} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="bg-slate-200 w-full h-full flex flex-col items-center justify-center relative">
                  <FiBox size={32} className="text-slate-400" />
                </div>
              )}
            </div>
            <div className="text-center space-y-1">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-tight">Arrastra o click para cargar la foto.</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Solo archivos de imágenes</p>
            </div>
          </div>

          {/* Grid inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre *</label>
              <input 
                type="text" 
                required
                placeholder="Nombre del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Referencia</label>
              <input 
                type="text" 
                placeholder="Referencia del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.referencia}
                onChange={e => setForm({ ...form, referencia: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción</label>
              <input 
                type="text" 
                placeholder="Descripción del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta contable</label>
              <select 
                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                value={form.cuenta_contable}
                onChange={e => setForm({ ...form, cuenta_contable: e.target.value })}
              >
                <option value="">Seleccione...</option>
                <option value="Activos">ACTIVOS</option>
                <option value="Pasivos">PASIVOS</option>
                <option value="Patrimonio">PATRIMONIO</option>
                <option value="Ingresos">INGRESOS</option>
                <option value="Egresos">EGRESOS</option>
                <option value="Costos de venta">COSTOS DE VENTA</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría *</label>
              <select 
                required
                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                value={form.categoria}
                onChange={e => setForm({ ...form, categoria: e.target.value })}
              >
                <option value="">Seleccione...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 pl-1 pt-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">¿Es servicio?</span>
              <button 
                type="button"
                onClick={() => setForm({ ...form, es_servicio: !form.es_servicio })}
                className={`w-12 h-6 rounded-full transition-all duration-300 relative flex items-center shadow-inner ${form.es_servicio ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-300 absolute ${form.es_servicio ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio compra *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                <input 
                  type="text" 
                  required
                  placeholder="0"
                  className="w-full pl-8 pr-4 h-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                  value={handleCOPFormat(form.precio_compra)}
                  onChange={e => setForm({ ...form, precio_compra: e.target.value.replace(/\D/g, "") })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
              <input 
                type="text" 
                placeholder="Marca del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.marca}
                onChange={e => setForm({ ...form, marca: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Principio activo</label>
              <input 
                type="text" 
                placeholder="Principio activo del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.principio_activo}
                onChange={e => setForm({ ...form, principio_activo: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registro Invima</label>
              <input 
                type="text" 
                placeholder="Información Invima del Concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.registro_invima}
                onChange={e => setForm({ ...form, registro_invima: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma farmacéutica</label>
              <input 
                type="text" 
                placeholder="Forma farmacéutica del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.forma_farmaceutica}
                onChange={e => setForm({ ...form, forma_farmaceutica: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Concentración</label>
              <input 
                type="text" 
                placeholder="Concentración del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.concentracion}
                onChange={e => setForm({ ...form, concentracion: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Presentación comercial</label>
              <input 
                type="text" 
                placeholder="Presentación com. del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.presentacion_comercial}
                onChange={e => setForm({ ...form, presentacion_comercial: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Almacenamiento & Control */}
        <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-50 pb-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Almacenamiento y Control</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temperatura de almacenamiento</label>
              <input 
                type="text" 
                placeholder="Temperatura de almacenamiento"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.temperatura_almacenamiento}
                onChange={e => setForm({ ...form, temperatura_almacenamiento: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidad de temperatura</label>
              <select 
                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                value={form.unidad_temperatura}
                onChange={e => setForm({ ...form, unidad_temperatura: e.target.value })}
              >
                <option value="">Seleccione...</option>
                <option value="°C">Grados Celsius (°C)</option>
                <option value="°F">Grados Fahrenheit (°F)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Humedad de almacenamiento</label>
              <input 
                type="text" 
                placeholder="Humedad de almacenamiento"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.humedad_almacenamiento}
                onChange={e => setForm({ ...form, humedad_almacenamiento: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidad de humedad</label>
              <select 
                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                value={form.unidad_humedad}
                onChange={e => setForm({ ...form, unidad_humedad: e.target.value })}
              >
                <option value="">Seleccione...</option>
                <option value="%">% Humedad Relativa</option>
              </select>
            </div>

            <div className="flex items-center gap-4 pl-1 pt-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">¿Es inventariable?</span>
              <button 
                type="button"
                onClick={() => setForm({ ...form, es_inventariable: !form.es_inventariable })}
                className={`w-12 h-6 rounded-full transition-all duration-300 relative flex items-center shadow-inner ${form.es_inventariable ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-300 absolute ${form.es_inventariable ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clasificación de riesgo</label>
              <input 
                type="text" 
                placeholder="Clasif. riesgo del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.clasificacion_riesgo}
                onChange={e => setForm({ ...form, clasificacion_riesgo: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vida útil</label>
              <input 
                type="text" 
                placeholder="Vida útil del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.vida_util}
                onChange={e => setForm({ ...form, vida_util: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Periodicidad mantenimiento</label>
              <input 
                type="text" 
                placeholder="Periodicidad mant. del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.periodicidad_mantenimiento}
                onChange={e => setForm({ ...form, periodicidad_mantenimiento: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Periodicidad calibración</label>
              <input 
                type="text" 
                placeholder="Periodicidad cal. del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.periodicidad_calibracion}
                onChange={e => setForm({ ...form, periodicidad_calibracion: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Datos adicionales */}
        <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-50 pb-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Datos adicionales / Extensiones</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Extensión texto 1</label>
              <input 
                type="text" 
                placeholder="Ext. texto 1 del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.extension_texto_1}
                onChange={e => setForm({ ...form, extension_texto_1: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Extensión texto 2</label>
              <input 
                type="text" 
                placeholder="Ext. texto 2 del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.extension_texto_2}
                onChange={e => setForm({ ...form, extension_texto_2: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Extensión número 1</label>
              <input 
                type="number" 
                placeholder="Ext. número 1 del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.extension_numero_1}
                onChange={e => setForm({ ...form, extension_numero_1: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Extensión número 2</label>
              <input 
                type="number" 
                placeholder="Ext. número 2 del concepto"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.extension_numero_2}
                onChange={e => setForm({ ...form, extension_numero_2: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Extensión fecha 1 (dd/mm/aaaa)</label>
              <input 
                type="date" 
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.extension_fecha_1}
                onChange={e => setForm({ ...form, extension_fecha_1: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Extensión fecha 2 (dd/mm/aaaa)</label>
              <input 
                type="date" 
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={form.extension_fecha_2}
                onChange={e => setForm({ ...form, extension_fecha_2: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onCancel}
            className="h-11 px-8 rounded-full text-xs font-black uppercase tracking-widest text-slate-400 border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="h-11 px-10 rounded-full text-xs font-black uppercase tracking-widest text-white bg-[#8cc33f] hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <FiSave size={15} />
            Guardar
          </button>
        </div>

      </form>
    </div>
  );
}
