import React, { useState, useEffect } from "react";
import { FiX, FiCheck, FiCamera, FiImage, FiBox, FiSave, FiDollarSign, FiTag, FiFileText } from "react-icons/fi";
import { subscribeToCategories } from "../../services/resourceService";
import { useAuth } from "../../context/AuthContext";
import { storage } from "../../firebase/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const initialProductoState = {
    imagen: "",
    nombre: "",
    codigo: "",
    descripcion: "",
    cuenta_contable: "",
    categoria: "",
    es_servicio: false,
    precio_compra: "",
    es_vendible: true,
    precio: "", // Venta
    impuesto: "",
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
    periodicidad_reabastecimiento: "",
    periodicidad_confirmacion: "",
    extension_texto_1: "",
    extension_texto_2: "",
    extension_numero_1: "",
    extension_numero_2: "",
    extension_fecha_1: "",
    extension_fecha_2: "",
    permite_descuento: true
};

export default function ModalProducto({ item = null, categoria = "", onClose, onSave, loading }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const [categoriasList, setCategoriasList] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [activeSection, setActiveSection] = useState("basico"); // basico, precios, tecnico

    const [formData, setFormData] = useState({ 
        ...initialProductoState,
        categoria: categoria || "",
        ...item
    });

    useEffect(() => {
        if (item) {
            setFormData({ ...initialProductoState, categoria: categoria || "", ...item });
        } else {
            setFormData({ ...initialProductoState, categoria: categoria || "" });
        }
    }, [item, categoria]);

    useEffect(() => {
        if (!inquilino) return;
        const unsub = subscribeToCategories(inquilino, (data) => {
            setCategoriasList(data);
        });
        return () => unsub();
    }, [inquilino]);

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            const storageRef = ref(storage, `productos/${inquilino}_${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setFormData(prev => ({ ...prev, imagen: url }));
        } catch (error) {
            console.error("Error al subir imagen:", error);
            alert("No se pudo subir la imagen.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmitt = (e) => {
        if (e) e.preventDefault();
        if (!formData.nombre.trim()) {
            alert("El nombre del concepto es obligatorio");
            return;
        }
        
        onSave({
            ...formData,
            categoria: formData.categoria || categoria || "GENERAL",
            precio_compra: Number(String(formData.precio_compra).replace(/\D/g, "")) || 0,
            precio: Number(String(formData.precio).replace(/\D/g, "")) || 0,
            search_name: formData.nombre.toLowerCase()
        });
    };

    const handleCOPFormat = (val) => {
        if (!val) return "";
        const numericVal = String(val).replace(/\D/g, "");
        if (!numericVal) return "";
        return Number(numericVal).toLocaleString("es-CO");
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* Header Compacto y Elegante */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-200">
                            <FiBox size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                                {item ? (formData.es_servicio ? 'Editar Servicio' : 'Editar Producto') : (formData.es_servicio ? 'Nuevo Servicio' : 'Nuevo Producto')}
                            </h3>
                            <p className="text-xs font-medium text-slate-500">Configuración de catálogo y tarifarios de clínica</p>
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 font-bold hover:bg-slate-200 transition-colors cursor-pointer border-0"
                    >
                        &times;
                    </button>
                </div>

                {/* Sub-Tabs de Navegación del Formulario */}
                <div className="px-6 py-2 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveSection("basico")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                            activeSection === "basico"
                                ? "bg-blue-50 text-blue-600 font-black"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        Información Básica
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection("precios")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                            activeSection === "precios"
                                ? "bg-blue-50 text-blue-600 font-black"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        Tarifas y Precios
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection("tecnico")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                            activeSection === "tecnico"
                                ? "bg-blue-50 text-blue-600 font-black"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        Datos Técnicos / Invima
                    </button>
                </div>

                {/* Formulario Compacto */}
                <form onSubmit={handleSubmitt} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                    
                    {activeSection === "basico" && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Cargar Imagen - Versión Compacta Inline */}
                            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                                    {formData.imagen ? (
                                        <img src={formData.imagen} alt="Producto" className="w-full h-full object-cover" />
                                    ) : (
                                        <FiImage className="text-slate-400" size={20} />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-slate-800">Imagen del concepto</h4>
                                    <p className="text-[11px] text-slate-500 truncate">Formatos JPG o PNG hasta 5MB</p>
                                </div>
                                <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 shadow-xs">
                                    <span>{isUploading ? "Subiendo..." : "Cargar foto"}</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden"
                                        onChange={handleImageChange}
                                        disabled={isUploading || loading}
                                    />
                                </label>
                            </div>

                            {/* Grid de 2 columnas para campos básicos */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-600">Nombre del Concepto *</label>
                                    <input 
                                        type="text"
                                        required
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        placeholder="Ej. Resina Compuesta Fotocurable, Limpieza Profunda"
                                        value={formData.nombre}
                                        onChange={e => setFormData({...formData, nombre: e.target.value})}
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Código / Referencia</label>
                                    <input 
                                        type="text"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        placeholder="Ej. REF-0012"
                                        value={formData.codigo}
                                        onChange={e => setFormData({...formData, codigo: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Categoría *</label>
                                    <select 
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        value={formData.categoria}
                                        onChange={e => setFormData({...formData, categoria: e.target.value})}
                                    >
                                        <option value="">Seleccionar Categoría...</option>
                                        <option value="GENERAL">GENERAL</option>
                                        {categoriasList.map(cat => (
                                            <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-600">Descripción del Concepto</label>
                                    <textarea 
                                        rows={2}
                                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                                        placeholder="Descripción detallada para presupuesto e inventario..."
                                        value={formData.descripcion}
                                        onChange={e => setFormData({...formData, descripcion: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Cuenta Contable</label>
                                    <select 
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        value={formData.cuenta_contable}
                                        onChange={e => setFormData({...formData, cuenta_contable: e.target.value})}
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Ingresos">Ingresos</option>
                                        <option value="Costos de venta">Costos de venta</option>
                                        <option value="Activos">Activos</option>
                                        <option value="Egresos">Egresos</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-xs font-bold text-slate-700">¿Es un Servicio?</span>
                                    <input 
                                        type="checkbox"
                                        checked={!!formData.es_servicio}
                                        onChange={e => setFormData({...formData, es_servicio: e.target.checked})}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === "precios" && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Precio Venta (COP) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-bold">$</span>
                                        <input 
                                            type="text"
                                            className="w-full h-9 pl-7 pr-3 bg-white border border-blue-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                            placeholder="0"
                                            value={handleCOPFormat(formData.precio)}
                                            onChange={e => setFormData({...formData, precio: e.target.value.replace(/\D/g, "")})}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Precio Compra / Costo Base</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input 
                                            type="text"
                                            className="w-full h-9 pl-7 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                            placeholder="0"
                                            value={handleCOPFormat(formData.precio_compra)}
                                            onChange={e => setFormData({...formData, precio_compra: e.target.value.replace(/\D/g, "")})}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Impuesto / IVA Aplica</label>
                                    <input 
                                        type="text"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        placeholder="Ej. IVA 19%, Exento"
                                        value={formData.impuesto}
                                        onChange={e => setFormData({...formData, impuesto: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Marca Comercial</label>
                                    <input 
                                        type="text"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        placeholder="Ej. 3M, Dentsply"
                                        value={formData.marca}
                                        onChange={e => setFormData({...formData, marca: e.target.value})}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-xs font-bold text-slate-700">¿Permite Descuento?</span>
                                    <input 
                                        type="checkbox"
                                        checked={!!formData.permite_descuento}
                                        onChange={e => setFormData({...formData, permite_descuento: e.target.checked})}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-xs font-bold text-slate-700">¿Es Inventariable?</span>
                                    <input 
                                        type="checkbox"
                                        checked={!!formData.es_inventariable}
                                        onChange={e => setFormData({...formData, es_inventariable: e.target.checked})}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === "tecnico" && (
                        <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Registro Invima</label>
                                <input 
                                    type="text"
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    placeholder="INVIMA 2026-000123"
                                    value={formData.registro_invima}
                                    onChange={e => setFormData({...formData, registro_invima: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Principio Activo</label>
                                <input 
                                    type="text"
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Ej. Eugenol, Lidocaína"
                                    value={formData.principio_activo}
                                    onChange={e => setFormData({...formData, principio_activo: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Forma Farmacéutica</label>
                                <input 
                                    type="text"
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Gel, Crema, Solución"
                                    value={formData.forma_farmaceutica}
                                    onChange={e => setFormData({...formData, forma_farmaceutica: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Presentación Comercial</label>
                                <input 
                                    type="text"
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Jeringa 4g, Caja x 50"
                                    value={formData.presentacion_comercial}
                                    onChange={e => setFormData({...formData, presentacion_comercial: e.target.value})}
                                />
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
                        <span className="text-[11px] text-slate-400 font-semibold">* Campos obligatorios</span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                            >
                                <FiSave size={15} />
                                <span>{loading ? "Guardando..." : "Guardar Concepto"}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
