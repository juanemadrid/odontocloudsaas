import React, { useEffect, useState } from 'react';
import { getPatientFinancials } from '../../../services/billingService';
import { 
    FiDollarSign, FiPlus, FiSearch, FiFileText, FiClock, 
    FiCheckCircle, FiAlertCircle, FiTrendingUp, FiArrowRight, FiActivity,
    FiPrinter, FiTrash2
} from "react-icons/fi";
import AddCreditModal from './AddCreditModal';
import { formatCurrency } from '../../../utils/formatters';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { ReceiptPrintService } from '../../../services/ReceiptPrintService';
import supabase from '../../../lib/supabaseClient';
import { useAudit } from '../../../hooks/useAudit';

const parseNotes = (notesRaw) => {
    if (!notesRaw) return null;
    if (typeof notesRaw === "object") return notesRaw;
    try {
        if (typeof notesRaw === "string" && notesRaw.trim().startsWith("{")) {
            return JSON.parse(notesRaw);
        }
    } catch (e) {}
    return null;
};

const getUserLabel = (pago, profile) => {
    const raw = pago.registradoPor || pago.registrado_por || pago.usuario || pago.usuarioNombre || pago.profesional || pago.created_by;
    if (raw && typeof raw === 'string' && !raw.includes('@') && raw.toLowerCase() !== 'sistema') {
        return raw;
    }
    if (raw && typeof raw === 'string' && raw.includes('@')) {
        return raw.split('@')[0];
    }
    return profile?.nombreCompleto || profile?.nombre || profile?.email?.split('@')[0] || 'Administración';
};

const getDisplayNotes = (pago) => {
    const parsed = parseNotes(pago.notas || pago.notes);
    if (parsed) {
        const parts = [];
        if (parsed.referencia) parts.push(`Ref: ${parsed.referencia}`);
        if (parsed.observaciones) parts.push(parsed.observaciones);
        if (parsed.concepto && parts.length === 0) parts.push(parsed.concepto);
        if (parts.length > 0) return parts.join(" — ");
        if (parsed.notas && parsed.notas !== "SALDO A FAVOR") return parsed.notas;
    }
    
    const ref = pago.referencia || "";
    const notes = pago.notas || pago.notes || "";
    
    if (ref && !ref.startsWith("{") && ref !== "SALDO A FAVOR") {
        if (notes && !notes.startsWith("{") && notes !== "SALDO A FAVOR" && notes !== ref) {
            return `${ref} — ${notes}`;
        }
        return ref;
    }
    if (notes && !notes.startsWith("{") && notes !== "SALDO A FAVOR") {
        return notes;
    }
    return "SALDO A FAVOR";
};

export default function SaldoTab({ patient }) {
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    
    // Void credit top-up state
    const [voidModalOpen, setVoidModalOpen] = useState(false);
    const [selectedPagoToVoid, setSelectedPagoToVoid] = useState(null);
    const [voidReason, setVoidReason] = useState("");

    const { userProfile } = useAuth();
    const toast = useToast();
    const { logAction } = useAudit();

    const loadData = async () => {
        if (!patient?.id) return;
        setLoading(true);
        const data = await getPatientFinancials(patient.id, userProfile?.inquilino);
        setFinancials(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [patient?.id]);

    const handlePrint = async (pago) => {
        try {
            const clinic = userProfile?.tenant || {
                nombre: userProfile?.tenantNombre || userProfile?.clinica || "Clínica",
                inquilino: userProfile?.inquilino || userProfile?.tenantId
            };
            await ReceiptPrintService.generatePDF(pago, patient, clinic, userProfile);
        } catch (e) {
            console.error("Error launching print:", e);
            toast.error("Error al preparar la impresión");
        }
    };

    const handleVoidClick = (pago) => {
        setSelectedPagoToVoid(pago);
        setVoidReason("");
        setVoidModalOpen(true);
    };

    const handleConfirmVoid = async () => {
        if (!voidReason.trim()) {
            alert("El motivo de la anulación es obligatorio");
            return;
        }
        try {
            const inq = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId || "";
            const voidNotes = `ANULADO - ${voidReason.trim()} (${userProfile?.nombre || userProfile?.email || "Usuario"})`;

            // 1. Actualizar tabla pagos en DB Supabase (columnas válidas: referencia, notas)
            try {
                await supabase
                    .from("pagos")
                    .update({
                        referencia: "ANULADO",
                        notas: voidNotes
                    })
                    .eq("id", selectedPagoToVoid.id);
            } catch (err) {
                console.warn("Error actualizando pagos en DB:", err);
            }

            // 2. Actualizar website_config
            try {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inq)
                    .maybeSingle();

                if (cfgRow?.config) {
                    const currentPagos = cfgRow.config.pagos || [];
                    const updatedPagos = currentPagos.map(p => {
                        if (p.id === selectedPagoToVoid.id) {
                            return {
                                ...p,
                                estado: "Anulado",
                                referencia: "ANULADO",
                                notas: voidNotes
                            };
                        }
                        return p;
                    });
                    await supabase.from("website_config").upsert(
                        { tenant_id: inq, config: { ...cfgRow.config, pagos: updatedPagos } },
                        { onConflict: "tenant_id" }
                    );
                }
            } catch (e) {
                console.warn("Error actualizando website_config pagos:", e);
            }

            // 3. Recalcular saldo_favor en tabla pacientes
            try {
                const { data: pac } = await supabase
                    .from("pacientes")
                    .select("id, saldo_favor")
                    .eq("id", patient.id)
                    .single();

                if (pac) {
                    const currentSaldo = Number(pac.saldo_favor || 0);
                    const voidMonto = Number(selectedPagoToVoid.monto || selectedPagoToVoid.total || 0);
                    const newSaldo = Math.max(0, currentSaldo - voidMonto);

                    await supabase
                        .from("pacientes")
                        .update({ saldo_favor: newSaldo })
                        .eq("id", patient.id);
                }
            } catch (e) {
                console.warn("Error actualizando saldo_favor de paciente:", e);
            }

            // 4. Audit log (seguro)
            try {
                if (logAction) {
                    await logAction(patient?.id, "VOID_CREDIT", {
                        pagoId: selectedPagoToVoid.id,
                        monto: selectedPagoToVoid.monto || 0,
                        motivoAnulacion: voidReason.trim()
                    });
                }
            } catch (e) {}

            toast.success("Abono de saldo a favor anulado con éxito");
            setVoidModalOpen(false);
            setSelectedPagoToVoid(null);
            setVoidReason("");
            loadData();
        } catch (e) {
            console.error("Error voiding credit top-up:", e);
            toast.error("Error al anular el saldo a favor");
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 opacity-30 animate-pulse">
            <FiActivity size={48} className="text-slate-400 mb-4" />
            <h5 className="text-[14px] font-black uppercase tracking-widest text-slate-500">Analizando Finanzas Hub...</h5>
        </div>
    );

    const { totals, pagos = [] } = financials;

    const creditPayments = pagos.filter(p => {
        const ref = (p.referencia || p.concepto || "").toUpperCase();
        const notes = (p.notas || p.notes || "").toUpperCase();
        const isAnulado = (p.estado || "").toLowerCase() === "anulado" || ref.includes("ANULADO") || notes.includes("ANULADO");
        return isAnulado || ref.includes("SALDO A FAVOR") || notes.includes("SALDO A FAVOR");
    });

    const filteredCredits = creditPayments.filter(p => 
        (p.medio || p.metodo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.notas || p.notes || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.registradoPor || p.registrado_por || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50/20 animate-fadeIn overflow-hidden">
            
            {/* 1. HUD ELITE (Top metrics) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 md:px-10 border-b border-slate-100 bg-white shrink-0">
                <HUDCard 
                    label="Total Facturado" 
                    value={totals.totalFacturado} 
                    icon={FiFileText} 
                    color="slate" 
                />
                <HUDCard 
                    label="Total Recaudado" 
                    value={totals.totalPagado} 
                    icon={FiCheckCircle} 
                    color="emerald" 
                />
                <HUDCard 
                    label="Saldo por Cobrar" 
                    value={totals.balance > 0 ? totals.balance : 0} 
                    icon={FiAlertCircle} 
                    color="rose" 
                    isCritical={totals.balance > 0}
                />
                <HUDCard 
                    label="Saldo a Favor" 
                    value={totals.totalSaldosAFavor} 
                    icon={FiDollarSign} 
                    color="indigo" 
                    badge="Crédito"
                />
            </div>

            {/* 2. TOOLBAR & TABLE AREA */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30">
                
                {/* TOOLBAR */}
                <div className="px-6 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50 backdrop-blur-sm border-b border-slate-100/50">
                    <div className="relative w-full sm:w-96">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <input 
                            type="text" 
                            placeholder="Buscar en recibos de caja..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold text-slate-600 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder:text-slate-200 uppercase"
                        />
                    </div>
                    
                    <button 
                        onClick={() => setModalOpen(true)}
                        className="w-full sm:w-auto px-8 py-3 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-xl shadow-[#8CC63F]/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                         <FiPlus size={16} strokeWidth={3} /> Adicionar saldo a favor
                    </button>
                </div>

                {/* TABLE (Saldo a Favor History Style) */}
                <div className="flex-1 overflow-auto custom-scrollbar p-6 pt-2">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead className="bg-slate-50/80 border-b border-slate-100">
                                <tr>
                                    <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Medio de Pago</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas / Referencia</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Registrado Por</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                                    <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-[12px] font-bold text-slate-600">
                                {filteredCredits.length > 0 ? (
                                    filteredCredits.map(pago => {
                                        const dateStr = pago.fechaISO ? new Date(pago.fechaISO).toLocaleDateString('es-CO') : "—";
                                        const isVoided = pago.estado === "Anulado";
                                        const isUsage = (pago.medio || pago.metodo || "").toLowerCase() === "saldo a favor";
                                        const displayNotes = getDisplayNotes(pago);
                                        return (
                                            <tr key={pago.id} className={`transition-colors group ${isVoided ? 'bg-rose-50/10 hover:bg-rose-50/20' : 'hover:bg-slate-50/50'}`}>
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
                                                            ${isVoided 
                                                                ? 'bg-rose-50 text-rose-500' 
                                                                : isUsage
                                                                    ? 'bg-amber-50 text-amber-500 group-hover:bg-amber-100'
                                                                    : 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-100'}`}
                                                        >
                                                            <FiClock size={14} />
                                                        </div>
                                                        <span className={`font-mono ${isVoided ? 'text-rose-500/80 line-through' : 'text-slate-700'}`}>{dateStr}</span>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-6 uppercase text-[10px] font-black">
                                                    <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-full ${
                                                        isVoided 
                                                            ? 'bg-rose-50 text-rose-600 border border-rose-100/50' 
                                                            : isUsage 
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                                    }`}>
                                                        {isUsage ? "USO DE SALDO" : (pago.medio || pago.metodo || "EFECTIVO")}
                                                    </span>
                                                </td>
                                                <td className="py-5 px-6 uppercase">
                                                    <span className={isVoided ? 'text-rose-400 line-through' : 'text-slate-600'}>
                                                        {displayNotes}
                                                    </span>
                                                    {isVoided && (
                                                        <span className="block text-[11px] font-bold text-rose-600 normal-case tracking-normal mt-1 bg-rose-50 border border-rose-200/60 px-2.5 py-1 rounded-lg">
                                                            ⚠️ Motivo de anulación: <span className="font-semibold text-rose-700">{pago.motivoAnulacion || (pago.notas && pago.notas.includes("ANULADO") ? pago.notas.replace(/^ANULADO\s*-\s*/i, "") : "Sin motivo especificado")}</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`py-5 px-6 uppercase ${isVoided ? 'text-rose-400/80' : 'text-slate-700 font-bold'}`}>
                                                    {getUserLabel(pago, userProfile)}
                                                </td>
                                                <td className={`py-5 px-6 text-right font-black font-mono ${
                                                    isVoided 
                                                        ? 'text-rose-400/80 line-through' 
                                                        : isUsage 
                                                            ? 'text-amber-600' 
                                                            : 'text-emerald-600'
                                                }`}>
                                                    {isUsage ? `- $ ${formatCurrency(pago.monto || 0)}` : `+ $ ${formatCurrency(pago.monto || 0)}`}
                                                </td>
                                                <td className="py-5 px-8 text-center">
                                                    {isVoided ? (
                                                        <span className="inline-flex px-3 py-1 rounded-full text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-widest">
                                                            Anulado
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handlePrint(pago)}
                                                                title="Imprimir Recibo"
                                                                className="w-8 h-8 bg-slate-50 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg flex items-center justify-center transition-all shadow-sm"
                                                            >
                                                                <FiPrinter size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleVoidClick(pago)}
                                                                title="Anular Abono"
                                                                className="w-8 h-8 bg-slate-50 text-slate-400 hover:bg-rose-600 hover:text-white rounded-lg flex items-center justify-center transition-all shadow-sm"
                                                            >
                                                                <FiTrash2 size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="py-20 text-center">
                                            <div className="flex flex-col items-center opacity-20">
                                                <FiDollarSign size={48} className="mb-4" />
                                                <p className="text-xs font-black uppercase tracking-widest">No hay saldos a favor registrados</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FOOTER INFO */}
                <div className="px-10 py-6 border-t border-slate-100 bg-white flex justify-between items-center opacity-60">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FiCheckCircle size={12} className="text-emerald-500" /> Auditoría financiera activa v4.0
                    </p>
                    <div className="flex gap-4">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inversión Bruta: ${formatCurrency(totals.totalFacturado)}</span>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Abonos Totales: ${formatCurrency(totals.totalPagado)}</span>
                    </div>
                </div>
            </div>

            {/* MODAL INTEGRATION */}
            <AddCreditModal 
                isOpen={modalOpen} 
                onClose={() => setModalOpen(false)} 
                patient={patient} 
                onUpdate={loadData}
            />

            {/* Void Reason Modal */}
            {voidModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fadeIn" onClick={() => { setVoidModalOpen(false); setSelectedPagoToVoid(null); }} />
                    
                    {/* Modal Content */}
                    <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 p-6 animate-zoomIn">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-2">Anular Abono de Saldo a Favor</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Por favor, ingresa el motivo de la anulación para fines de auditoría.</p>
                        
                        <div className="space-y-4">
                            <textarea
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[13px] font-semibold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/5 focus:border-rose-300 transition-all h-28 resize-none placeholder:text-slate-200"
                                placeholder="Escribe el motivo de la anulación..."
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                            />
                        </div>
                        
                        <div className="mt-8 flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setVoidModalOpen(false); setSelectedPagoToVoid(null); setVoidReason(""); }}
                                className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmVoid}
                                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-95"
                            >
                                Confirmar Anulación
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function HUDCard({ label, value, icon: Icon, color, isCritical, badge }) {
    const colors = {
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 ring-indigo-500/10",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500/10",
        rose: "bg-rose-50 text-rose-600 border-rose-100 ring-rose-500/10",
        slate: "bg-slate-50 text-slate-600 border-slate-100 ring-slate-500/10"
    };

    return (
        <div className={`p-5 rounded-[24px] border ${colors[color]} ring-4 transition-all hover:scale-[1.02] duration-300 relative overflow-hidden group`}>
            <div className="flex justify-between items-start mb-3 relative z-10">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm`}>
                    <Icon size={16} />
                </div>
                {badge && (
                    <span className="text-[8px] font-black bg-white/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        {badge}
                    </span>
                )}
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5 leading-none">{label}</div>
            <div className={`text-xl font-black tracking-tighter leading-none ${isCritical ? 'animate-pulse' : ''}`}>
                <span className="text-xs mr-0.5 opacity-40">$</span>
                {formatCurrency(value)}
            </div>
            
            {/* Subtle background decoration */}
            <div className={`absolute -right-2 -bottom-2 opacity-5 transition-transform group-hover:scale-150 duration-700`}>
                <Icon size={64} />
            </div>
        </div>
    );
}
