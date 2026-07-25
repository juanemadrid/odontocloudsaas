import React, { useState, useEffect } from "react";
import { FiX, FiCheck, FiCamera, FiImage } from "react-icons/fi";
import { subscribeToCategories } from "../../services/resourceService";
import { useAuth } from "../../context/AuthContext";
import { storage } from "../../firebase/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const initialProductoState = {
    imagen: "",
    nombre: "",
    codigo: "", // Reference in screenshot
    descripcion: "",
    cuenta_contable: "",
    categoria: "",
    es_servicio: false,
    precio_compra: "",
    es_vendible: false,
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
    permite_descuento: false
};

export default function ModalProducto({ item = null, onClose, onSave, loading }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const [categoriasList, setCategoriasList] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            const storageRef = ref(storage, `productos/${inquilino}_${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setFormData({ ...formData, imagen: url });
        } catch (error) {
            console.error("Error al subir imagen:", error);
            alert("No se pudo subir la imagen.");
        } finally {
            setIsUploading(false);
        }
    };

    const [formData, setFormData] = useState({ 
        ...initialProductoState,
        ...item
    });

    useEffect(() => {
        if (item) {
            setFormData({ ...initialProductoState, ...item });
        } else {
            setFormData({ ...initialProductoState });
        }
    }, [item]);

    useEffect(() => {
        if (!inquilino) return;
        const unsub = subscribeToCategories(inquilino, (data) => {
            setCategoriasList(data);
        });
        return () => unsub();
    }, [inquilino]);

    const handleSubmitt = () => {
        if (!formData.nombre.trim()) {
            alert("El nombre es obligatorio");
            return;
        }
        if (!formData.categoria) {
            alert("Debe seleccionar una Categoría");
            return;
        }
        
        onSave({
            ...formData,
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex justify-center items-start pt-10 pb-10 overflow-hidden">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-4xl border border-slate-100 flex flex-col h-full max-h-[90vh] animate-fadeIn">
                
                {/* Header Superior - Similar a OralDrive pero mejorado */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 rounded-t-[24px]">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-bold text-slate-800">{formData.es_servicio ? 'Nuevo servicio' : 'Nuevo producto'}</h3>
                        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2 mt-1">
                            <span>Configuración</span> <span className="text-slate-300">-</span> 
                            <span>Lista de precios</span> <span className="text-slate-300">-</span> 
                            <span className="text-blue-500">{formData.es_servicio ? 'Nuevo servicio' : 'Nuevo producto'}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleSubmitt}
                            disabled={loading}
                            className="px-6 py-2 bg-[#8CC63F] text-white rounded-full font-bold text-sm shadow flex items-center gap-2 hover:bg-[#7bb335] transition-colors"
                        >
                            {loading ? "Guardando..." : "Guardar"}
                        </button>
                        <button 
                            onClick={onClose} 
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            <FiX size={20} className="text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Área de Formulario con Scroll */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    
                    {/* Título de sección interna */}
                    <h4 className="text-lg font-bold text-slate-800 mb-8 pb-3 border-b border-slate-50 inline-block">Información básica</h4>

                    <div className="max-w-3xl mx-auto space-y-6">
                        
                        {/* 1. Componente Imagen */}
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-10 pb-10 border-b border-dashed border-slate-200">
                            <span className="text-sm font-bold text-slate-600 md:w-1/4 md:text-right pt-2">Imagen</span>
                            <div className="flex flex-col items-center gap-4 flex-1">
                                <div className="w-32 h-32 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 shadow-inner overflow-hidden border-2 border-slate-100 relative group cursor-pointer">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        onChange={handleImageChange}
                                        disabled={isUploading || loading}
                                    />
                                    {isUploading ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 animate-pulse">
                                            <span className="text-xs font-bold text-slate-500">Subiendo...</span>
                                        </div>
                                    ) : formData.imagen ? (
                                        <img src={formData.imagen} alt="Producto" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="bg-slate-400 w-full h-full flex flex-col items-center justify-center relative group-hover:bg-slate-500 transition-colors">
                                            <div className="absolute w-[40px] h-[40px] rounded-full bg-white/20 top-[20%]"></div>
                                            <div className="absolute w-[80px] h-[60px] rounded-t-full bg-white/20 bottom-0"></div>
                                        </div>
                                    )}
                                </div>
                                <div className="relative overflow-hidden">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment"
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        onChange={handleImageChange}
                                        disabled={isUploading || loading}
                                    />
                                    <button type="button" className="px-5 py-2 bg-[#8CC63F] text-white text-xs font-bold rounded-full shadow hover:bg-[#7bb335] transition-colors pointer-events-none">
                                        {isUploading ? "Cargando..." : "Tomar foto"}
                                    </button>
                                </div>
                                <div className="text-center">
                                    <p className="text-[12px] font-bold text-slate-500">Arrastra o click para cargar la foto.</p>
                                    <p className="text-[10px] text-slate-400">Solo archivos de imágenes</p>
                                </div>
                            </div>
                        </div>

                        {/* Campos de texto generales - Formularios Apilados en Grid adaptada */}
                        {[
                            { label: "Nombre*", id: "nombre", placeholder: "Nombre del concepto", type: "text" },
                            { label: "Referencia", id: "codigo", placeholder: "Referencia del concepto", type: "text" },
                            { label: "Descripción", id: "descripcion", placeholder: "Descripción del concepto", type: "text" },
                        ].map((field, i) => (
                            <div key={i} className="flex flex-col md:flex-row items-center gap-4 border-b border-slate-50 pb-4">
                                <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full">{field.label}</label>
                                <div className="flex-1 w-full">
                                    <input 
                                        type={field.type}
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium placeholder:text-slate-300"
                                        placeholder={field.placeholder}
                                        value={formData[field.id]}
                                        onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Cuenta Contable Dinámica */}
                        <div className="flex flex-col md:flex-row items-center gap-4 border-b border-slate-50 pb-4">
                            <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full">Cuenta contable</label>
                            <div className="flex-1 w-full">
                                <select 
                                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                    value={formData.cuenta_contable}
                                    onChange={e => setFormData({...formData, cuenta_contable: e.target.value})}
                                >
                                    <option value="">Seleccione...</option>
                                    <option value="Activos">Activos</option>
                                    <option value="Pasivos">Pasivos</option>
                                    <option value="Patrimonio">Patrimonio</option>
                                    <option value="Ingresos">Ingresos</option>
                                    <option value="Egresos">Egresos</option>
                                    <option value="Costos de venta">Costos de venta</option>
                                    <option value="Costos de producción">Costos de producción</option>
                                    <option value="Cuentas de orden deudoras">Cuentas de orden deudoras</option>
                                    <option value="Cuentas de orden acreedoras">Cuentas de orden acreedoras</option>
                                </select>
                            </div>
                        </div>

                        {/* Categoría Dinámica */}
                        <div className="flex flex-col md:flex-row items-center gap-4 border-b border-slate-50 pb-4">
                            <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full">Categoría*</label>
                            <div className="flex-1 w-full">
                                <select 
                                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                    value={formData.categoria}
                                    onChange={e => setFormData({...formData, categoria: e.target.value})}
                                >
                                    <option value="">Seleccione...</option>
                                    {categoriasList.map(cat => (
                                        <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                                    ))}
                                </select>
                                {categoriasList.length === 0 && (
                                    <p className="text-[10px] text-red-500 mt-1 font-bold">¡No hay categorías! Créalas en Configuración - Categorías Inventario.</p>
                                )}
                            </div>
                        </div>

                        {/* Toggle ¿Es servicio? */}
                        <div className="flex flex-col md:flex-row items-center gap-4 border-b border-slate-50 pb-4">
                            <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full flex items-center md:justify-end gap-1">
                                ¿Es servicio? <span className="text-[10px] bg-slate-100 text-slate-400 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer" title="Marque si este ítem no requiere control físico (ej: Consultas, Procedimientos)">?</span>
                            </label>
                            <div className="flex-1 flex items-center w-full min-h-[44px]">
                                <div 
                                    onClick={() => setFormData({...formData, es_servicio: !formData.es_servicio})}
                                    className={`w-12 h-6 rounded-full cursor-pointer transition-all duration-300 relative flex items-center shadow-inner ${formData.es_servicio ? 'bg-[#8CC63F]' : 'bg-slate-200'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 absolute ${formData.es_servicio ? 'translate-x-7' : 'translate-x-1'}`} />
                                </div>
                            </div>
                        </div>

                        {/* Bloque Precios */}
                        <div className="flex flex-col md:flex-row items-center gap-4 border-b border-slate-50 pb-4">
                            <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full">Precio compra*</label>
                            <div className="flex-1 w-full relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                <input 
                                    type="text"
                                    className="w-full h-11 pl-8 pr-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium placeholder:text-slate-300"
                                    placeholder="0"
                                    value={handleCOPFormat(formData.precio_compra)}
                                    onChange={e => setFormData({...formData, precio_compra: e.target.value.replace(/\D/g, "")})}
                                />
                            </div>
                        </div>

                        {/* Toggle ¿Es vendible? */}
                        <div className="flex flex-col md:flex-row items-center gap-4 border-b border-slate-50 pb-4">
                            <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full flex items-center md:justify-end gap-1">
                                ¿Es vendible? <span className="text-[10px] bg-slate-100 text-slate-400 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer" title="Marque si este ítem se factura a pacientes o clientes.">?</span>
                            </label>
                            <div className="flex-1 flex items-center w-full min-h-[44px]">
                                <div 
                                    onClick={() => setFormData({...formData, es_vendible: !formData.es_vendible})}
                                    className={`w-12 h-6 rounded-full cursor-pointer transition-all duration-300 relative flex items-center shadow-inner ${formData.es_vendible ? 'bg-blue-500' : 'bg-slate-200'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 absolute ${formData.es_vendible ? 'translate-x-7' : 'translate-x-1'}`} />
                                </div>
                            </div>
                        </div>

                        {/* Campos de Venta (Condicional) */}
                        {formData.es_vendible && (
                            <div className="bg-blue-50/30 p-6 rounded-[16px] border border-blue-50 space-y-4 mb-6">
                                <div className="flex flex-col md:flex-row items-center gap-4">
                                    <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full">Precio venta*</label>
                                    <div className="flex-1 w-full relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 font-bold">$</span>
                                        <input 
                                            type="text"
                                            className="w-full h-11 pl-8 pr-4 bg-white border border-blue-200 rounded-lg text-sm text-blue-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-black placeholder:text-blue-300"
                                            placeholder="0"
                                            value={handleCOPFormat(formData.precio)}
                                            onChange={e => setFormData({...formData, precio: e.target.value.replace(/\D/g, "")})}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row items-center gap-4">
                                    <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full">Impuesto*</label>
                                    <div className="flex-1 w-full">
                                        <input 
                                            type="text"
                                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium placeholder:text-slate-300"
                                            placeholder="Impuesto del concepto"
                                            value={formData.impuesto}
                                            onChange={e => setFormData({...formData, impuesto: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Block Resto */}
                        {[
                            { label: "Marca", id: "marca", placeholder: "Marca del concepto" },
                            { label: "Principio activo", id: "principio_activo", placeholder: "Principio activo del concepto" },
                            { label: "Registro Invima", id: "registro_invima", placeholder: "Información Invima del Concepto" },
                            { label: "Forma farmacéutica", id: "forma_farmaceutica", placeholder: "Forma farmacéutica del concepto" },
                            { label: "Concentración", id: "concentracion", placeholder: "Concentración del concepto" },
                            { label: "Presentación comercial", id: "presentacion_comercial", placeholder: "Presentación com. del concepto" },
                        ].map((field, i) => (
                            <div key={`block2-${i}`} className="flex flex-col md:flex-row justify-center md:items-center gap-4 border-b border-slate-50 pb-4">
                                <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right w-full shrink-0">{field.label}</label>
                                <div className="flex-1 w-full">
                                    <input 
                                        type="text"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium placeholder:text-slate-300"
                                        placeholder={field.placeholder}
                                        value={formData[field.id]}
                                        onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Temperatura y Humedad Grid */}
                        {[
                            { label: "Temperatura de almacenamiento", id: "temperatura_almacenamiento" },
                            { label: "Unidad de temperatura", id: "unidad_temperatura" },
                            { label: "Humedad de almacenamiento", id: "humedad_almacenamiento" },
                            { label: "Unidad de humedad", id: "unidad_humedad" }
                        ].map((field, i) => (
                            <div key={`temp-${i}`} className="flex flex-col md:flex-row justify-center md:items-center gap-4 border-b border-slate-50 pb-4">
                                <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right shrink-0">{field.label}</label>
                                <div className="flex-1">
                                    <input 
                                        type="text"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 transition-all font-medium placeholder:text-slate-300"
                                        placeholder={`${field.label.split(" ")[0]} del concepto`}
                                        value={formData[field.id]}
                                        onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                    />
                                </div>
                            </div>
                        ))}

                         {/* Toggle ¿Es inventariable? */}
                         <div className="flex flex-col md:flex-row justify-center md:items-center gap-4 border-b border-slate-50 pb-4 pt-2">
                            <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right shrink-0 flex items-center md:justify-end gap-1">
                                ¿Es inventariable? <span className="text-[10px] bg-slate-100 text-slate-400 w-4 h-4 rounded-full flex items-center justify-center">?</span>
                            </label>
                            <div className="flex-1 flex items-center min-h-[44px]">
                                <div 
                                    onClick={() => setFormData({...formData, es_inventariable: !formData.es_inventariable})}
                                    className={`w-12 h-6 rounded-full cursor-pointer transition-all duration-300 relative flex items-center ${formData.es_inventariable ? 'bg-[#8CC63F]' : 'bg-slate-200'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 absolute ${formData.es_inventariable ? 'translate-x-7' : 'translate-x-1'}`} />
                                </div>
                            </div>
                        </div>

                        {/* Más campos finales */}
                        {[
                            { label: "Clasificación de riesgo", id: "clasificacion_riesgo" },
                            { label: "Vida útil", id: "vida_util" },
                            { label: "Periodicidad reabastecimiento", id: "periodicidad_reabastecimiento" },
                            { label: "Periodicidad confirmación", id: "periodicidad_confirmacion" },
                            { label: "Extensión texto 1", id: "extension_texto_1" },
                            { label: "Extensión texto 2", id: "extension_texto_2" },
                            { label: "Extensión número 1", id: "extension_numero_1" },
                            { label: "Extensión número 2", id: "extension_numero_2" }
                        ].map((field, i) => (
                            <div key={`ext-${i}`} className="flex flex-col md:flex-row justify-center md:items-center gap-4 border-b border-slate-50 pb-4">
                                <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right shrink-0">{field.label}</label>
                                <div className="flex-1">
                                    <input 
                                        type="text"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 transition-all font-medium placeholder:text-slate-300"
                                        placeholder={`Ext. ${field.label.split(" ")[1] || field.label.split(" ")[0]} del concepto`}
                                        value={formData[field.id]}
                                        onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Extensión Fecha */}
                        {[
                            { label: "Extensión fecha 1 (dd/mm/aaaa)", id: "extension_fecha_1" },
                            { label: "Extensión fecha 2 (dd/mm/aaaa)", id: "extension_fecha_2" },
                        ].map((field, i) => (
                            <div key={`extdate-${i}`} className="flex flex-col md:flex-row justify-center md:items-center gap-4 pb-4">
                                <label className="text-[13px] font-bold text-slate-600 md:w-1/4 md:text-right shrink-0">{field.label}</label>
                                <div className="flex-1">
                                    <input 
                                        type="date"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 transition-all font-medium text-slate-500"
                                        value={formData[field.id]}
                                        onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                    />
                                </div>
                            </div>
                        ))}

                    </div>
                </div>

                {/* Submit button on bottom right */}
                <div className="p-6 flex justify-end bg-slate-50 border-t border-slate-100 rounded-b-[24px]">
                    <button 
                         onClick={handleSubmitt}
                         disabled={loading}
                         className="px-8 py-3 bg-[#8CC63F] text-white rounded-full font-bold text-sm shadow hover:bg-[#7bb335] transition-colors"
                    >
                        {loading ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
