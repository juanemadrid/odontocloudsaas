// src/modules/config/ConfigConsecutivosForm.jsx
// ============================================================
// ⚙️ Formulario Consecutivos - OdontoCloud
// Réplica exacta de la estructura y campos de OralDrive
// ============================================================
import React, { useState, useEffect } from "react";
import { FiSave, FiArrowLeft, FiCheck, FiHelpCircle, FiSearch, FiCheckCircle } from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { saveConfigItem } from "../../services/configPersistenceService";

const initialFormState = {
    // 1. Datos del consecutivo
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

    // Toggles
    datosManuales: false,
    facturaCompra: false,
    docSoporteElectronico: false,
    facturaVenta: false,
    facturacionElectronica: false,

    // Información Manual (when datosManuales is true)
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

    // Factura de Venta (when facturaVenta is true)
    fvNumFormulario: "",
    fvNombre: "",
    fvPrefijo: "",
    fvNumActual: 0,
    fvNumInicial: 0,
    fvNumFinal: 0,
    fvFechaInicio: "",
    fvFechaFinal: "",
    fvTextoResolucion: "",

    // 2. Documento soporte Dian
    dsReferencia: "Resolución propia",
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

    // 3. Facturación - Datos generales
    tipoFacturacion: "Manual",
    contFacturaBorrador: 0,

    // 4. Factura electrónica
    feTestSetId: "",
    feNumFormulario: "",
    feClaveTecnica: "",
    feNombre: "",
    fePrefijoFactura: "",
    fePrefijoNota: "",
    feNumActual: 0,
    feNumInicial: 0,
    feNumFinal: 0,
    feFechaInicio: "",
    feFechaFinal: "",
    feTextoResolucion: ""
};

export default function ConfigConsecutivosForm({ onClose, initialData = null }) {
    const { userProfile } = useAuth();
    const [formData, setFormData] = useState(initialFormState);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...initialFormState, ...initialData }));
        }
    }, [initialData]);

    const handleChange = (field, val) => {
        setFormData(prev => ({ ...prev, [field]: val }));
    };

    const handleNumberChange = (field, e) => {
        const val = e.target.value;
        if (val === "" || val === null || val === undefined) {
            setFormData(prev => ({ ...prev, [field]: "" }));
        } else {
            const parsed = parseInt(val, 10);
            setFormData(prev => ({ ...prev, [field]: isNaN(parsed) ? "" : parsed }));
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        if (!formData.nombre.trim()) {
            toast.error("El nombre del consecutivo es obligatorio");
            return;
        }

        if (!userProfile?.inquilino) {
            toast.error("No se pudo identificar la clínica activa.");
            return;
        }

        const numericFields = [
            "contReciboCaja", "contNotaCredito", "contNotaDebito", "contEgresos",
            "contPresupuestos", "contPlanTratamiento", "contOrdenesCompra", "contCuentasPorCobrar",
            "contUsoSaldoFavor", "contUsoNotasCredito", "contRipsAutomaticos", "contFacturaBorrador",
            "fvNumActual", "fvNumInicial", "fvNumFinal", "dsNumActual", "dsNumInicial", "dsNumFinal",
            "feNumActual", "feNumInicial", "feNumFinal"
        ];
        const cleanedData = { ...formData };
        numericFields.forEach(f => {
            cleanedData[f] = Number(cleanedData[f]) || 0;
        });

        setIsSaving(true);
        try {
            await saveConfigItem(userProfile.inquilino, "consecutivos", "consecutivos", {
                ...cleanedData,
                ...(initialData?.id ? { id: initialData.id } : {})
            });

            toast.success(initialData?.id ? "Consecutivo actualizado correctamente" : "Consecutivo creado correctamente");
            onClose();
        } catch (error) {
            console.error("Error al guardar consecutivo:", error);
            toast.error("Error al guardar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const ToggleSwitch = ({ label, checked, onChange, helpText }) => (
        <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50/80 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all">
            <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-slate-700">{label}</span>
                {helpText && <FiHelpCircle className="text-slate-400 cursor-help" size={13} title={helpText} />}
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
            </label>
        </div>
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fadeIn">
            
            {/* Top Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors border border-slate-200 bg-white cursor-pointer"
                        title="Volver"
                    >
                        <FiArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Consecutivos</span>
                            <span>•</span>
                            <span className="text-blue-600">Edición de consecutivo</span>
                        </div>
                        <h1 className="text-[17px] font-black text-slate-800 tracking-tight">
                            {initialData ? "Editar Consecutivo" : "Nuevo Consecutivo"}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-5 py-2.5 rounded-xl text-[12px] font-extrabold uppercase tracking-wider transition-all shadow-md shadow-[#8CC63F]/20 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        <FiCheck size={16} strokeWidth={3} />
                        <span>{isSaving ? "Guardando..." : "Guardar"}</span>
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
                
                {/* SECCIÓN 1: DATOS DEL CONSECUTIVO */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                    <h2 className="text-[15px] font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                        <span>Datos del consecutivo</span>
                    </h2>

                    {/* Nombre */}
                    <div className="space-y-1.5 max-w-xl">
                        <label className="text-[12px] font-bold text-slate-700">Nombre *</label>
                        <input
                            type="text"
                            required
                            value={formData.nombre}
                            onChange={(e) => handleChange("nombre", e.target.value)}
                            className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                        />
                    </div>

                    {/* Grid Contadores */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {[
                            { label: "Cont. Recibo de caja", field: "contReciboCaja" },
                            { label: "Cont. Nota crédito", field: "contNotaCredito" },
                            { label: "Cont. Nota débito", field: "contNotaDebito" },
                            { label: "Cont. Egresos", field: "contEgresos" },
                            { label: "Cont. Presupuestos", field: "contPresupuestos" },
                            { label: "Cont. Plan de tratamiento", field: "contPlanTratamiento" },
                            { label: "Cont. Órdenes de compra", field: "contOrdenesCompra" },
                            { label: "Cont. Cuentas por cobrar", field: "contCuentasPorCobrar" },
                            { label: "Cont. Uso saldo a favor", field: "contUsoSaldoFavor" },
                            { label: "Cont. Uso notas crédito", field: "contUsoNotasCredito" },
                            { label: "Cont. Rips automáticos", field: "contRipsAutomaticos" },
                        ].map((item) => (
                            <div key={item.field} className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">{item.label}</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData[item.field]}
                                    onChange={(e) => handleNumberChange(item.field, e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Toggles Operativos */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <ToggleSwitch
                                label="¿Datos manuales consecutivo?"
                                checked={formData.datosManuales}
                                onChange={(val) => handleChange("datosManuales", val)}
                            />
                            <ToggleSwitch
                                label="Factura de compra"
                                checked={formData.facturaCompra}
                                onChange={(val) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        facturaCompra: val,
                                        docSoporteElectronico: val ? prev.docSoporteElectronico : false
                                    }));
                                }}
                            />
                            {formData.facturaCompra && (
                                <ToggleSwitch
                                    label="Documento soporte electrónico"
                                    checked={formData.docSoporteElectronico}
                                    onChange={(val) => handleChange("docSoporteElectronico", val)}
                                />
                            )}
                            <ToggleSwitch
                                label="Factura de venta"
                                checked={formData.facturaVenta}
                                onChange={(val) => handleChange("facturaVenta", val)}
                            />
                            <ToggleSwitch
                                label="Facturación electrónica"
                                checked={formData.facturacionElectronica}
                                onChange={(val) => handleChange("facturacionElectronica", val)}
                            />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN OPCIONAL: INFORMACIÓN MANUAL */}
                {formData.datosManuales && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5 animate-fadeIn">
                        <h2 className="text-[15px] font-bold text-slate-800 border-b border-slate-100 pb-3">
                            Información Manual
                        </h2>

                        <div className="space-y-4 max-w-2xl">
                            {/* Nombre */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.manualNombre}
                                    onChange={(e) => handleChange("manualNombre", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* País */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">País *</label>
                                <select
                                    value={formData.manualPais}
                                    onChange={(e) => handleChange("manualPais", e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                >
                                    <option value="">Seleccione...</option>
                                    <option value="Colombia">Colombia</option>
                                    <option value="México">México</option>
                                    <option value="Ecuador">Ecuador</option>
                                    <option value="Perú">Perú</option>
                                    <option value="Chile">Chile</option>
                                    <option value="Argentina">Argentina</option>
                                    <option value="España">España</option>
                                    <option value="Estados Unidos">Estados Unidos</option>
                                </select>
                            </div>

                            {/* Ciudad de domicilio */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Ciudad de domicilio *</label>
                                <select
                                    value={formData.manualCiudad}
                                    onChange={(e) => handleChange("manualCiudad", e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                >
                                    <option value="">Seleccione...</option>
                                    <option value="Bogotá">Bogotá D.C.</option>
                                    <option value="Medellín">Medellín</option>
                                    <option value="Cali">Cali</option>
                                    <option value="Barranquilla">Barranquilla</option>
                                    <option value="Cartagena">Cartagena</option>
                                    <option value="Bucaramanga">Bucaramanga</option>
                                    <option value="Santa Marta">Santa Marta</option>
                                    <option value="Pereira">Pereira</option>
                                    <option value="Manizales">Manizales</option>
                                    <option value="Cúcuta">Cúcuta</option>
                                    <option value="Ibagué">Ibagué</option>
                                    <option value="Pasto">Pasto</option>
                                    <option value="Neiva">Neiva</option>
                                    <option value="Montería">Montería</option>
                                    <option value="Valledupar">Valledupar</option>
                                    <option value="Villavicencio">Villavicencio</option>
                                </select>
                            </div>

                            {/* Tipo documento */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Tipo documento *</label>
                                <select
                                    value={formData.manualTipoDoc}
                                    onChange={(e) => handleChange("manualTipoDoc", e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                >
                                    <option value="">Seleccione...</option>
                                    <option value="CC">Cédula de Ciudadanía (CC)</option>
                                    <option value="NIT">Número de Identificación Tributaria (NIT)</option>
                                    <option value="CE">Cédula de Extranjería (CE)</option>
                                    <option value="PP">Pasaporte</option>
                                    <option value="TI">Tarjeta de Identidad (TI)</option>
                                </select>
                            </div>

                            {/* Número de documento */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número de documento *</label>
                                <input
                                    type="text"
                                    value={formData.manualNumDoc}
                                    onChange={(e) => handleChange("manualNumDoc", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Tipo de persona */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Tipo de persona *</label>
                                <select
                                    value={formData.manualTipoPersona}
                                    onChange={(e) => handleChange("manualTipoPersona", e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                >
                                    <option value="">Seleccione...</option>
                                    <option value="Persona Natural">Persona Natural</option>
                                    <option value="Persona Jurídica">Persona Jurídica</option>
                                </select>
                            </div>

                            {/* Teléfono fijo */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Teléfono fijo *</label>
                                <input
                                    type="text"
                                    value={formData.manualTelefono}
                                    onChange={(e) => handleChange("manualTelefono", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Correo electrónico */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Correo electrónico *</label>
                                <input
                                    type="email"
                                    value={formData.manualEmail}
                                    onChange={(e) => handleChange("manualEmail", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Sitio web */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Sitio web</label>
                                <input
                                    type="text"
                                    value={formData.manualWebsite}
                                    onChange={(e) => handleChange("manualWebsite", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Dirección */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Dirección *</label>
                                <input
                                    type="text"
                                    value={formData.manualDireccion}
                                    onChange={(e) => handleChange("manualDireccion", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Código postal */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Código postal *</label>
                                <input
                                    type="text"
                                    value={formData.manualCodigoPostal}
                                    onChange={(e) => handleChange("manualCodigoPostal", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* SECCIÓN OPCIONAL: DOCUMENTO SOPORTE DIAN */}
                {formData.facturaCompra && formData.docSoporteElectronico && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5 animate-fadeIn">
                        <h2 className="text-[15px] font-bold text-slate-800 border-b border-slate-100 pb-3">
                            Documento soporte Dian
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Consecutivo Referencia */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Consecutivo de referencia</label>
                                <select
                                    value={formData.dsReferencia}
                                    onChange={(e) => handleChange("dsReferencia", e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                >
                                    <option value="Resolución propia">Resolución propia</option>
                                    <option value="Resolución DIAN">Resolución DIAN</option>
                                </select>
                            </div>

                            {/* Número Formulario */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número formulario *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.dsNumFormulario}
                                        onChange={(e) => handleChange("dsNumFormulario", e.target.value)}
                                        className="flex-1 h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                    <button
                                        type="button"
                                        className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center cursor-pointer border-0 transition-colors shrink-0 shadow-sm"
                                        title="Verificar"
                                    >
                                        <FiCheck size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Nombre */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.dsNombre}
                                    onChange={(e) => handleChange("dsNombre", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Prefijo documento soporte */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Prefijo documento soporte</label>
                                <input
                                    type="text"
                                    value={formData.dsPrefijoDoc}
                                    onChange={(e) => handleChange("dsPrefijoDoc", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Prefijo nota de ajuste */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Prefijo nota de ajuste</label>
                                <input
                                    type="text"
                                    value={formData.dsPrefijoNota}
                                    onChange={(e) => handleChange("dsPrefijoNota", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Número actual */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número actual</label>
                                <input
                                    type="number"
                                    value={formData.dsNumActual}
                                    onChange={(e) => handleNumberChange("dsNumActual", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Número inicial */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número inicial *</label>
                                <input
                                    type="number"
                                    value={formData.dsNumInicial}
                                    onChange={(e) => handleNumberChange("dsNumInicial", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Número final */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número final</label>
                                <input
                                    type="number"
                                    value={formData.dsNumFinal}
                                    onChange={(e) => handleNumberChange("dsNumFinal", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Fecha Inicio */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Fecha de inicio de la autorización</label>
                                <input
                                    type="date"
                                    value={formData.dsFechaInicio}
                                    onChange={(e) => handleChange("dsFechaInicio", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                 max="9999-12-31" min="1900-01-01" />
                            </div>

                            {/* Fecha Final */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Fecha de final de la autorización</label>
                                <input
                                    type="date"
                                    value={formData.dsFechaFinal}
                                    onChange={(e) => handleChange("dsFechaFinal", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                 max="9999-12-31" min="1900-01-01" />
                            </div>
                        </div>

                        {/* Texto Resolución */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-slate-600">Texto resolución *</label>
                            <textarea
                                rows={3}
                                value={formData.dsTextoResolucion}
                                onChange={(e) => handleChange("dsTextoResolucion", e.target.value)}
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>
                )}

                {/* SECCIÓN 3: FACTURACIÓN - DATOS GENERALES */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                    <h2 className="text-[15px] font-bold text-slate-800 border-b border-slate-100 pb-3">
                        Facturación - Datos generales
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-600">Tipo de facturación</label>
                            <select
                                value={formData.tipoFacturacion}
                                onChange={(e) => handleChange("tipoFacturacion", e.target.value)}
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                            >
                                <option value="Manual">Manual</option>
                                <option value="Realizadas">Realizadas</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-600">Consecutivo para factura borrador</label>
                            <input
                                type="number"
                                value={formData.contFacturaBorrador}
                                onChange={(e) => handleNumberChange("contFacturaBorrador", e)}
                                onFocus={(e) => e.target.select()}
                                className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN OPCIONAL: FACTURA DE VENTA */}
                {formData.facturaVenta && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5 animate-fadeIn">
                        <h2 className="text-[15px] font-bold text-slate-800 border-b border-slate-100 pb-3">
                            Factura de venta
                        </h2>

                        <div className="space-y-4 max-w-2xl">
                            {/* Número Formulario */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número formulario</label>
                                <input
                                    type="text"
                                    value={formData.fvNumFormulario}
                                    onChange={(e) => handleChange("fvNumFormulario", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Nombre */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.fvNombre}
                                    onChange={(e) => handleChange("fvNombre", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Prefijo */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Prefijo</label>
                                <input
                                    type="text"
                                    value={formData.fvPrefijo}
                                    onChange={(e) => handleChange("fvPrefijo", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Número actual */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número actual</label>
                                <input
                                    type="number"
                                    value={formData.fvNumActual}
                                    onChange={(e) => handleNumberChange("fvNumActual", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                                <p className="text-[11px] font-medium text-slate-500 pt-0.5">
                                    La siguiente factura llevará el consecutivo <span className="font-bold text-slate-700">{Number(formData.fvNumActual || 0) + 1}</span>
                                </p>
                            </div>

                            {/* Número inicial */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número inicial *</label>
                                <input
                                    type="number"
                                    value={formData.fvNumInicial}
                                    onChange={(e) => handleNumberChange("fvNumInicial", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Número final */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número final</label>
                                <input
                                    type="number"
                                    value={formData.fvNumFinal}
                                    onChange={(e) => handleNumberChange("fvNumFinal", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Fecha inicio */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Fecha de inicio de la autorización</label>
                                <input
                                    type="date"
                                    value={formData.fvFechaInicio}
                                    onChange={(e) => handleChange("fvFechaInicio", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                 max="9999-12-31" min="1900-01-01" />
                            </div>

                            {/* Fecha final */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Fecha de final de la autorización</label>
                                <input
                                    type="date"
                                    value={formData.fvFechaFinal}
                                    onChange={(e) => handleChange("fvFechaFinal", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                 max="9999-12-31" min="1900-01-01" />
                            </div>

                            {/* Texto resolución */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-slate-600">Texto resolución *</label>
                                <textarea
                                    rows={3}
                                    value={formData.fvTextoResolucion}
                                    onChange={(e) => handleChange("fvTextoResolucion", e.target.value)}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* SECCIÓN OPCIONAL: FACTURA ELECTRÓNICA */}
                {formData.facturacionElectronica && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5 animate-fadeIn">
                        <h2 className="text-[15px] font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">
                            <span>Factura electrónica</span>
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* TestSetID */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-medium text-slate-600">TestSetID</label>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded-md uppercase tracking-wider">Activo</span>
                                </div>
                                <input
                                    type="text"
                                    value={formData.feTestSetId}
                                    onChange={(e) => handleChange("feTestSetId", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-mono text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Número Formulario */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número formulario *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.feNumFormulario}
                                        onChange={(e) => handleChange("feNumFormulario", e.target.value)}
                                        className="flex-1 h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                    <button
                                        type="button"
                                        className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center cursor-pointer border-0 transition-colors shrink-0 shadow-sm"
                                        title="Verificar"
                                    >
                                        <FiCheck size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Clave técnica */}
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[11px] font-medium text-slate-600">Clave técnica *</label>
                                <input
                                    type="text"
                                    value={formData.feClaveTecnica}
                                    onChange={(e) => handleChange("feClaveTecnica", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-mono text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Nombre */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.feNombre}
                                    onChange={(e) => handleChange("feNombre", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Prefijo factura electrónica */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Prefijo factura electrónica</label>
                                <input
                                    type="text"
                                    value={formData.fePrefijoFactura}
                                    onChange={(e) => handleChange("fePrefijoFactura", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Prefijo nota crédito */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Prefijo nota crédito</label>
                                <input
                                    type="text"
                                    value={formData.fePrefijoNota}
                                    onChange={(e) => handleChange("fePrefijoNota", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Número actual + Helper text */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número actual</label>
                                <input
                                    type="number"
                                    value={formData.feNumActual}
                                    onChange={(e) => handleNumberChange("feNumActual", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                                <p className="text-[11px] font-medium text-slate-500 pt-0.5">
                                    La siguiente factura llevará el consecutivo <span className="font-bold text-slate-700">{Number(formData.feNumActual || 0) + 1}</span>
                                </p>
                            </div>

                            {/* Número inicial */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número inicial *</label>
                                <input
                                    type="number"
                                    value={formData.feNumInicial}
                                    onChange={(e) => handleNumberChange("feNumInicial", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Número final */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Número final</label>
                                <input
                                    type="number"
                                    value={formData.feNumFinal}
                                    onChange={(e) => handleNumberChange("feNumFinal", e)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Fecha Inicio */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Fecha de inicio de la autorización</label>
                                <input
                                    type="date"
                                    value={formData.feFechaInicio}
                                    onChange={(e) => handleChange("feFechaInicio", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                 max="9999-12-31" min="1900-01-01" />
                            </div>

                            {/* Fecha Final */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-600">Fecha de final de la autorización</label>
                                <input
                                    type="date"
                                    value={formData.feFechaFinal}
                                    onChange={(e) => handleChange("feFechaFinal", e.target.value)}
                                    className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                 max="9999-12-31" min="1900-01-01" />
                            </div>
                        </div>

                        {/* Texto Resolución */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-slate-600">Texto resolución *</label>
                            <textarea
                                rows={3}
                                value={formData.feTextoResolucion}
                                onChange={(e) => handleChange("feTextoResolucion", e.target.value)}
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>
                )}

                {/* Footer Bar */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors text-xs border border-slate-200 bg-white cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-[#8CC63F]/20 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        <FiCheck size={16} strokeWidth={3} />
                        <span>{isSaving ? "Guardando..." : "Guardar Consecutivo"}</span>
                    </button>
                </div>

            </form>
        </div>
    );
}
