// src/modules/config/ConfigConsecutivos.jsx
// ============================================================
// ⚙️ Consecutivos y Numeración Interna - OdontoCloud
// Gestión segura y unificada de contadores correlativos de la clínica.
// ============================================================
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
    FiHash, 
    FiSave, 
    FiInfo, 
    FiCheckCircle, 
    FiDollarSign, 
    FiFileText, 
    FiLayers, 
    FiArrowRight,
    FiCheck,
    FiShield
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { getConfigItems, saveConfigItem } from "../../services/configPersistenceService";

export default function ConfigConsecutivos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [rawItem, setRawItem] = useState(null);

    const [formData, setFormData] = useState({
        nombre: "Principal",
        contReciboCaja: 0,
        contEgresos: 0,
        contPresupuestos: 0,
        contPlanTratamiento: 0,
        contNotaCredito: 0,
        contNotaDebito: 0,
        contUsoSaldoFavor: 0,
        contCuentasPorCobrar: 0
    });

    useEffect(() => {
        if (inquilino) {
            loadConsecutivo();
        }
    }, [inquilino]);

    const loadConsecutivo = async () => {
        setLoading(true);
        try {
            const data = await getConfigItems(inquilino, "consecutivos", "consecutivos");
            const existing = Array.isArray(data) && data.length > 0 ? data[0] : null;

            if (existing) {
                setRawItem(existing);
                setFormData({
                    nombre: existing.nombre || existing.name || "Principal",
                    contReciboCaja: Number(existing.contReciboCaja ?? existing.recibo_caja ?? 0),
                    contEgresos: Number(existing.contEgresos ?? existing.egresos ?? 0),
                    contPresupuestos: Number(existing.contPresupuestos ?? existing.presupuestos ?? 0),
                    contPlanTratamiento: Number(existing.contPlanTratamiento ?? existing.tratamientos ?? 0),
                    contNotaCredito: Number(existing.contNotaCredito ?? existing.nota_credito ?? 0),
                    contNotaDebito: Number(existing.contNotaDebito ?? existing.nota_debito ?? 0),
                    contUsoSaldoFavor: Number(existing.contUsoSaldoFavor ?? existing.saldos_favor ?? 0),
                    contCuentasPorCobrar: Number(existing.contCuentasPorCobrar ?? existing.cx_cobrar ?? 0)
                });
            } else {
                setRawItem(null);
            }
        } catch (error) {
            console.error("Error al cargar consecutivos:", error);
            toast.error("Error al cargar la numeración de consecutivos");
        } finally {
            setLoading(false);
        }
    };

    const handleNumberChange = (field, e) => {
        const val = e.target.value;
        const parsed = val === "" ? 0 : parseInt(val, 10);
        setFormData(prev => ({
            ...prev,
            [field]: isNaN(parsed) || parsed < 0 ? 0 : parsed
        }));
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!inquilino) {
            toast.error("No se pudo identificar la clínica activa.");
            return;
        }

        setIsSaving(true);
        try {
            const cleanNombre = (formData.nombre || "").trim() || "Principal";
            const updatedPayload = {
                ...(rawItem || {}),
                id: rawItem?.id || "consecutivo-principal",
                nombre: cleanNombre,
                en_uso: true,
                // Sincronización dual para garantizar compatibilidad con todos los servicios
                contReciboCaja: Number(formData.contReciboCaja) || 0,
                recibo_caja: Number(formData.contReciboCaja) || 0,
                contEgresos: Number(formData.contEgresos) || 0,
                egresos: Number(formData.contEgresos) || 0,
                contPresupuestos: Number(formData.contPresupuestos) || 0,
                presupuestos: Number(formData.contPresupuestos) || 0,
                contPlanTratamiento: Number(formData.contPlanTratamiento) || 0,
                tratamientos: Number(formData.contPlanTratamiento) || 0,
                contNotaCredito: Number(formData.contNotaCredito) || 0,
                nota_credito: Number(formData.contNotaCredito) || 0,
                contNotaDebito: Number(formData.contNotaDebito) || 0,
                nota_debito: Number(formData.contNotaDebito) || 0,
                contUsoSaldoFavor: Number(formData.contUsoSaldoFavor) || 0,
                saldos_favor: Number(formData.contUsoSaldoFavor) || 0,
                contCuentasPorCobrar: Number(formData.contCuentasPorCobrar) || 0,
                cx_cobrar: Number(formData.contCuentasPorCobrar) || 0,
                updated_at: new Date().toISOString()
            };

            await saveConfigItem(inquilino, "consecutivos", "consecutivos", updatedPayload);
            setRawItem(updatedPayload);
            toast.success("Numeración de consecutivos actualizada correctamente");
        } catch (error) {
            console.error("Error al guardar consecutivos:", error);
            toast.error("Error al guardar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const CounterCard = ({ label, field, description, badge }) => {
        const val = Number(formData[field]) || 0;
        return (
            <div className="bg-slate-50/70 hover:bg-slate-50 p-4 rounded-xl border border-slate-200/80 transition-all flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-1.5">
                            <label className="text-[12px] font-bold text-slate-800">{label}</label>
                            {badge && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                                    {badge}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{description}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
                    <div className="relative w-32">
                        <FiHash className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input
                            type="number"
                            min="0"
                            value={formData[field]}
                            onChange={e => handleNumberChange(field, e)}
                            className="w-full h-8 pl-7 pr-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-left outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all"
                        />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 text-right">
                        Próximo a emitir: <strong className="text-slate-800 font-bold">#{val + 1}</strong>
                    </span>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[300px]">
                <div className="flex items-center gap-3 text-slate-500 text-sm font-semibold">
                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                    <span>Cargando numeración de consecutivos...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto animate-fade-in">
            {/* Header Corporativo */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiHash size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-[17px] font-black text-slate-800 tracking-tight">Consecutivos de Documentos</h1>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <FiCheck size={11} /> Activo
                            </span>
                        </div>
                        <p className="text-[12px] text-slate-500 font-medium">Control correlativo automático de recibos, caja y presupuestos</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={15} />
                        )}
                        <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
                    </button>
                </div>
            </div>

            {/* Aviso Informativo DIAN vs Interno */}
            <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/80 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                        <FiInfo size={17} />
                    </div>
                    <div>
                        <p className="font-bold text-[12px] text-blue-950">Resoluciones de Facturación Electrónica DIAN</p>
                        <p className="text-blue-800/90 text-[11px] mt-0.5 leading-relaxed">
                            Los prefijos, resoluciones y rangos autorizados por la DIAN se gestionan de forma oficial y en tiempo real a través del módulo especializado. Esta pantalla administra los números correlativos de recibos internos de la clínica.
                        </p>
                    </div>
                </div>
                <Link
                    to="/dashboard_admin/config/facturacion-electronica"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-bold shrink-0 transition-colors shadow-xs"
                >
                    <span>Ir a Facturación Electrónica</span>
                    <FiArrowRight size={12} />
                </Link>
            </div>

            {/* Formulario de Contadores Organizados */}
            <form onSubmit={handleSave} className="space-y-4">
                {/* 1. SECCIÓN: CAJA Y COBROS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <FiDollarSign size={16} />
                        </div>
                        <div>
                            <h2 className="text-[13px] font-bold text-slate-800">Caja y Cobranza a Pacientes</h2>
                            <p className="text-[11px] text-slate-400">Numeración correlativa de comprobantes de pago y movimientos de efectivo</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        <CounterCard
                            label="Recibos de Caja"
                            field="contReciboCaja"
                            badge="Principal"
                            description="Comprobante emitido al registrar cobros a pacientes en la ficha clínica y módulo de Caja."
                        />
                        <CounterCard
                            label="Egresos de Caja"
                            field="contEgresos"
                            description="Numeración para salidas de dinero, compras menores o pagos a proveedores desde caja."
                        />
                        <CounterCard
                            label="Uso de Saldo a Favor"
                            field="contUsoSaldoFavor"
                            description="Comprobantes emitidos cuando un paciente utiliza un anticipo o saldo registrado a su favor."
                        />
                    </div>
                </div>

                {/* 2. SECCIÓN: PRESUPUESTOS Y TRATAMIENTOS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <FiFileText size={16} />
                        </div>
                        <div>
                            <h2 className="text-[13px] font-bold text-slate-800">Planes Clínicos y Presupuestos</h2>
                            <p className="text-[11px] text-slate-400">Identificación correlativa de cotizaciones entregadas a los pacientes</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <CounterCard
                            label="Presupuestos"
                            field="contPresupuestos"
                            description="Número asignado a las cotizaciones formales emitidas desde la ficha del paciente."
                        />
                        <CounterCard
                            label="Planes de Tratamiento"
                            field="contPlanTratamiento"
                            description="Correlativo para planes de tratamiento odontológico activos y evolucionables."
                        />
                    </div>
                </div>

                {/* Pie de guardado */}
                <div className="pt-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={15} />
                        )}
                        <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
