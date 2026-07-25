// src/modules/config/ConfigConsecutivosForm.jsx
// ============================================================
// ⚙️ Formulario Consecutivos - OdontoCloud
// Diseño compacto, elegante y estructurado sin desperdicio de espacio.
// ============================================================
import React, { useState, useEffect } from "react";
import { FiSave, FiX, FiCheck } from "react-icons/fi";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";

export default function ConfigConsecutivosForm({ onClose, initialData = null }) {
    const { userProfile } = useAuth();
    const [formData, setFormData] = useState({
        nombre: "",
        contReciboCaja: 0,
        contNotaCredito: 0,
        contNotaDebito: 0,
        contEgresos: 0,
        contPresupuestos: 0,
        contPlanTratamiento: 0,
        contOrdenesCompra: 0,
        contCuentasPorCobrar: 0,
        contUsoSaldoFavor: 0,
        contUsoNotasCredito: 0,
        contRipsAutomaticos: 0,
        numRips: 0,
        datosManuales: false,
        facturaCompra: false,
        facturaVenta: false,
        facturacionElectronica: false,
        manualNombre: "",
        manualPais: "",
        manualCiudad: "",
        manualTipoDoc: "",
        manualNumDoc: "",
        manualTipoPersona: "",
        manualTelefono: "",
        manualEmail: "",
        manualWebsite: "",
        manualDireccion: "",
        manualCodigoPostal: "",
        docSoporteElectronico: false,
        dsReferencia: "Resolucion propia",
        dsNumFormulario: "",
        dsNombre: "",
        dsPrefijoDoc: "",
        dsPrefijoNota: "",
        dsNumActual: 0,
        dsNumInicial: 0,
        dsNumFinal: 0,
        dsFechaInicio: "",
        dsFechaFinal: "",
        dsTextoResolucion: "",
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...initialData }));
        }
    }, [initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.nombre.trim()) {
            toast.error("El nombre es obligatorio");
            return;
        }

        if (!userProfile?.inquilino) {
            toast.error("No se pudo identificar el inquilino");
            return;
        }

        try {
            const payload = {
                ...formData,
                inquilino: userProfile.inquilino,
                actualizado: serverTimestamp(),
            };

            if (initialData?.id) {
                await updateDoc(doc(db, "consecutivos", initialData.id), payload);
                toast.success("Consecutivo actualizado correctamente");
            } else {
                await addDoc(collection(db, "consecutivos"), {
                    ...payload,
                    creado: serverTimestamp(),
                });
                toast.success("Consecutivo creado correctamente");
            }
            
            onClose();
        } catch (error) {
            console.error("Error al guardar consecutivo:", error);
            toast.error("Error al guardar: " + error.message);
        }
    };

    const ToggleSwitch = ({ label, checked, onChange }) => (
        <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[12px] font-medium text-slate-700">{label}</span>
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
        </div>
    );

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-w-3xl mx-auto">
            
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <div>
                    <h2 className="text-[15px] font-bold text-slate-800">
                        {initialData ? "Editar Consecutivo" : "Nuevo Consecutivo"}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                        Configuración de numeración y contadores de documentos
                    </p>
                </div>
                <button 
                    onClick={onClose} 
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                >
                    <FiX size={18} />
                </button>
            </div>

            {/* Form Content Body */}
            <form onSubmit={handleSubmit} className="p-5 max-h-[72vh] overflow-y-auto space-y-4">
                
                {/* Nombre */}
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre del consecutivo *</label>
                    <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej. Consecutivo Principal"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        required
                    />
                </div>

                {/* Contadores Grid */}
                <div className="pt-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Contadores Iniciales</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { label: "Cont. Recibo de caja", key: "contReciboCaja" },
                            { label: "Cont. Nota crédito", key: "contNotaCredito" },
                            { label: "Cont. Nota débito", key: "contNotaDebito" },
                            { label: "Cont. Egresos", key: "contEgresos" },
                            { label: "Cont. Presupuestos", key: "contPresupuestos" },
                            { label: "Cont. Plan de tratamiento", key: "contPlanTratamiento" },
                            { label: "Cont. Órdenes de compra", key: "contOrdenesCompra" },
                            { label: "Cont. Cuentas por cobrar", key: "contCuentasPorCobrar" },
                            { label: "Cont. Uso saldo a favor", key: "contUsoSaldoFavor" },
                            { label: "Cont. Uso notas crédito", key: "contUsoNotasCredito" },
                            { label: "Cont. RIPS automáticos", key: "contRipsAutomaticos" },
                            { label: "Num. RIPS (Res 2275)", key: "numRips" },
                        ].map((field) => (
                            <div key={field.key} className="space-y-1">
                                <label className="text-[11px] text-slate-600 font-medium">{field.label}</label>
                                <input
                                    type="number"
                                    value={formData[field.key]}
                                    onChange={(e) => setFormData({ ...formData, [field.key]: parseInt(e.target.value) || 0 })}
                                    className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Toggles */}
                <div className="pt-2 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Opciones & Operativa</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <ToggleSwitch
                            label="¿Datos manuales consecutivo?"
                            checked={formData.datosManuales}
                            onChange={(val) => setFormData({ ...formData, datosManuales: val })}
                        />
                        <ToggleSwitch
                            label="Factura de compra"
                            checked={formData.facturaCompra}
                            onChange={(val) => {
                                setFormData(prev => ({
                                    ...prev,
                                    facturaCompra: val,
                                    docSoporteElectronico: val ? true : prev.docSoporteElectronico
                                }));
                            }}
                        />
                        <ToggleSwitch
                            label="Factura de venta"
                            checked={formData.facturaVenta}
                            onChange={(val) => setFormData({ ...formData, facturaVenta: val })}
                        />
                        <ToggleSwitch
                            label="Facturación electrónica"
                            checked={formData.facturacionElectronica}
                            onChange={(val) => setFormData({ ...formData, facturacionElectronica: val })}
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 cursor-pointer bg-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                    >
                        <FiSave size={15} />
                        <span>Guardar</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
