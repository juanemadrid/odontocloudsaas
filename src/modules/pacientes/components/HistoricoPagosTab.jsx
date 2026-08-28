import React, { useEffect, useState } from 'react';
import supabase from '../../../lib/supabaseClient';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useAudit } from '../../../hooks/useAudit';
import { ReceiptPrintService } from '../../../services/ReceiptPrintService';
import { formatCurrency } from '../../../utils/formatters';
import { getPatientFinancials } from '../../../services/billingService';
import {
    FiDollarSign, FiCalendar, FiCreditCard, FiTrash2,
    FiPrinter, FiX, FiSearch, FiCopy, FiInbox, FiLoader,
    FiCheckCircle, FiAlertCircle, FiInfo, FiUser, FiArrowRight
} from 'react-icons/fi';

const PAYMENT_METHOD_BADGES = {
    'efectivo': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Efectivo' },
    'nequi': { bg: 'bg-purple-50 text-purple-700 border-purple-100', label: 'Nequi' },
    'daviplata': { bg: 'bg-rose-50 text-rose-700 border-rose-100', label: 'Daviplata' },
    'transferencia': { bg: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Transferencia' },
    'tarjeta débito': { bg: 'bg-indigo-50 text-indigo-700 border-indigo-100', label: 'T. Débito' },
    'tarjeta crédito': { bg: 'bg-violet-50 text-violet-700 border-violet-100', label: 'T. Crédito' },
    'saldo a favor': { bg: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Saldo a Favor' },
};

const getMethodBadge = (m) => {
    const key = (m || '').toLowerCase().trim();
    if (key.includes('saldo')) return PAYMENT_METHOD_BADGES['saldo a favor'];
    if (key.includes('nequi')) return PAYMENT_METHOD_BADGES['nequi'];
    if (key.includes('davi')) return PAYMENT_METHOD_BADGES['daviplata'];
    if (key.includes('transf')) return PAYMENT_METHOD_BADGES['transferencia'];
    if (key.includes('débito') || key.includes('debito')) return PAYMENT_METHOD_BADGES['tarjeta débito'];
    if (key.includes('crédito') || key.includes('credito')) return PAYMENT_METHOD_BADGES['tarjeta crédito'];
    return PAYMENT_METHOD_BADGES[key] || { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: m || 'Efectivo' };
};

const formatDate = (iso) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return '—';
    }
};

const getReceiptNumber = (pago, index) => {
    if (pago.nroConsecutivo && !isNaN(Number(pago.nroConsecutivo))) return `#${pago.nroConsecutivo}`;
    if (pago.consecutivo && !isNaN(Number(pago.consecutivo))) return `#${pago.consecutivo}`;
    if (pago.nroRecibo || pago.numero_recibo || pago.numeroRecibo) return `#${pago.nroRecibo || pago.numero_recibo || pago.numeroRecibo}`;
    if (pago.id) return `#RC-${pago.id.slice(0, 6).toUpperCase()}`;
    return `#RC-${String(index + 1).padStart(3, '0')}`;
};

const getUserLabel = (pago, profile) => {
    const raw = pago.registradoPor || pago.registrado_por || pago.usuario || pago.usuarioNombre || pago.creadoPor || pago.created_by;
    if (raw && typeof raw === 'string' && !raw.includes('@') && raw.toLowerCase() !== 'sistema') {
        return raw;
    }
    if (raw && typeof raw === 'string' && raw.includes('@')) {
        return raw.split('@')[0];
    }
    return profile?.nombreCompleto || profile?.nombre || profile?.email?.split('@')[0] || 'Administración';
};

export default function HistoricoPagosTab({ patientId }) {
    const [pagos, setPagos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const toast = useToast();
    const { userProfile } = useAuth();
    const { logAction } = useAudit();

    // Void modal state
    const [voidModal, setVoidModal] = useState({ open: false, pago: null });
    const [voidReason, setVoidReason] = useState("");
    const [voiding, setVoiding] = useState(false);

    useEffect(() => {
        if (!patientId) return;
        const loadPagos = async () => {
            setLoading(true);
            try {
                const inq = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId || "";
                const finData = await getPatientFinancials(patientId, inq);
                const allPagos = finData?.pagos || [];

                // Excluir exclusivamente consumos / usos de saldo a favor
                const validPagos = allPagos.filter(p => {
                    const medio = (p.metodo || p.medio || p.metodo_pago || "").toLowerCase();
                    const concepto = (p.concepto || p.referencia || p.notas || "").toLowerCase();
                    const isConsumo = medio === "saldo a favor" || 
                                     medio.includes("saldo a favor") ||
                                     concepto.includes("consumo s. a favor") ||
                                     concepto.includes("uso saldo a favor") ||
                                     concepto.includes("consumo saldo a favor");
                    return !isConsumo;
                });

                setPagos(validPagos);
            } catch (err) {
                console.error("Error fetching payments:", err);
                toast?.error?.("Error al cargar el historial de pagos");
            } finally {
                setLoading(false);
            }
        };

        loadPagos();
    }, [patientId, userProfile]);

    const handlePrint = async (pago) => {
        try {
            const { data: pDb } = await supabase
                .from("pacientes")
                .select("id,nombres,apellidos,documento,tipo_documento,telefono,email,direccion,ciudad,ciudad_domicilio,saldo_favor")
                .eq("id", patientId)
                .maybeSingle();

            const targetPatient = pDb ? {
                ...pDb,
                nombreCompleto: `${pDb.nombres || ""} ${pDb.apellidos || ""}`.trim(),
                nroDocumento: pDb.documento || "",
                tipoDocumento: pDb.tipo_documento || "CC",
                celular: pDb.telefono || "",
            } : null;

            if (!targetPatient) {
                toast?.error?.("No se pudo cargar la información del paciente");
                return;
            }

            const clinic = userProfile?.tenant || {
                nombre: userProfile?.tenantNombre || userProfile?.clinica || "Clínica Dental",
                inquilino: userProfile?.inquilino || userProfile?.tenantId,
                ciudad: userProfile?.tenant?.ciudad || userProfile?.ciudad || "Sincelejo"
            };

            await ReceiptPrintService.generatePDF(pago, targetPatient, clinic, userProfile);
        } catch (e) {
            console.error("Error launching print:", e);
            toast?.error?.("Error al preparar el comprobante de impresión");
        }
    };

    const handleDelete = (pago) => {
        setVoidReason("");
        setVoidModal({ open: true, pago });
    };

    const handleConfirmVoid = async () => {
        if (!voidReason.trim()) {
            toast?.error?.("El motivo de la anulación es obligatorio");
            return;
        }
        setVoiding(true);
        try {
            await supabase
                .from("pagos")
                .update({
                    estado: "Anulado",
                    motivoAnulacion: voidReason.trim(),
                    anuladoPor: userProfile?.nombreCompleto || userProfile?.nombre || "Sistema",
                    fechaAnulacion: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq("id", voidModal.pago.id);

            // Update local state
            setPagos(prev => prev.map(p => p.id === voidModal.pago.id ? { ...p, estado: "Anulado", motivoAnulacion: voidReason.trim() } : p));

            await logAction(patientId, "VOID_PAYMENT", {
                pagoId: voidModal.pago.id,
                monto: voidModal.pago.monto || 0,
                concepto: voidModal.pago.concepto || "ABONO GENERAL",
                motivoAnulacion: voidReason.trim()
            });

            toast?.success?.("Pago anulado correctamente");
            setVoidModal({ open: false, pago: null });
            setVoidReason("");
        } catch (error) {
            console.error("Error voiding payment:", error);
            toast?.error?.("Error al anular el pago");
        } finally {
            setVoiding(false);
        }
    };

    const filtered = pagos.filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        const num = String(p.nroConsecutivo || p.consecutivo || '');
        const dateStr = formatDate(p.fechaISO);
        return (p.concepto || '').toLowerCase().includes(q) ||
            num.includes(q) ||
            (p.registradoPor || p.registrado_por || '').toLowerCase().includes(q) ||
            (p.medio || p.metodo_pago || '').toLowerCase().includes(q) ||
            dateStr.includes(q);
    });

    const totalValid = pagos.filter(p => p.estado !== "Anulado").reduce((acc, p) => acc + (p.monto || 0), 0);

    const copyTable = () => {
        const text = filtered.map(p =>
            [
                formatDate(p.fechaISO),
                p.nroConsecutivo ? `#${p.nroConsecutivo}` : '—',
                p.concepto || 'ABONO GENERAL',
                p.medio || 'Efectivo',
                p.registradoPor || 'Sistema',
                `$${(p.monto || 0).toLocaleString('es-CO')}`,
                p.estado || 'Completado'
            ].join('\t')
        ).join('\n');

        navigator.clipboard.writeText(text).then(() => toast?.success?.('Tabla copiada al portapapeles'));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
                <FiLoader size={20} className="animate-spin" />
                <span className="text-xs font-semibold">Cargando histórico de pagos...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white animate-fadeIn">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-5 py-3 border-b border-slate-100 bg-white sticky top-0 z-10 gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                        <FiDollarSign size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Historial de Pagos y Abonos</h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Total: ${formatCurrency(totalValid)}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">Comprobantes de ingreso registrados y recibos de caja</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        onClick={copyTable}
                        title="Copiar tabla"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <FiCopy size={14} />
                    </button>
                    <div className="relative">
                        <FiSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar abono..."
                            className="pl-7 pr-3 h-8 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 w-44 transition"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-300 py-16">
                    <FiInbox size={36} strokeWidth={1.2} />
                    <p className="text-xs font-semibold text-slate-400">
                        {search ? 'Sin resultados para la búsqueda' : 'No hay abonos o pagos registrados'}
                    </p>
                    {search && (
                        <button onClick={() => setSearch('')} className="text-xs font-medium text-emerald-600 hover:underline">
                            Limpiar búsqueda
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70">
                                {['Fecha', 'Recibo N.º', 'Concepto', 'Medio de Pago', 'Registrado Por', 'Valor Abono', 'Estado', 'Acciones'].map((col, i) => (
                                    <th
                                        key={i}
                                        className={`px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none whitespace-nowrap ${
                                            col === 'Valor Abono' || col === 'Acciones' ? 'text-right' : 'text-left'
                                        }`}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map((pago, idx) => {
                                const isVoided = pago.estado === "Anulado";
                                const badge = getMethodBadge(pago.medio || pago.metodo_pago);
                                const numLabel = getReceiptNumber(pago, idx);
                                const userLabel = getUserLabel(pago, userProfile);

                                return (
                                    <tr
                                        key={pago.id}
                                        className={`hover:bg-slate-50/60 transition-colors ${
                                            isVoided ? 'bg-rose-50/20 opacity-75' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                        }`}
                                    >
                                        {/* Fecha */}
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                                            {formatDate(pago.fechaISO)}
                                        </td>

                                        {/* Nro Consecutivo */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                {numLabel}
                                            </span>
                                        </td>

                                        {/* Concepto */}
                                        <td className="px-4 py-3 font-semibold text-slate-800 uppercase tracking-tight">
                                            {pago.concepto || "ABONO GENERAL"}
                                        </td>

                                        {/* Medio de Pago */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.bg}`}>
                                                {badge.label}
                                            </span>
                                        </td>

                                        {/* Registrado por */}
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                                            {userLabel}
                                        </td>

                                        {/* Valor Abono */}
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <span className={`font-bold text-sm ${isVoided ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                                                ${formatCurrency(pago.monto || 0)}
                                            </span>
                                        </td>

                                        {/* Estado */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {isVoided ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                                    Anulado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    <FiCheckCircle size={11} /> Recibido
                                                </span>
                                            )}
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handlePrint(pago)}
                                                    title="Imprimir comprobante de caja"
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors border border-slate-200/60"
                                                >
                                                    <FiPrinter size={13} />
                                                </button>
                                                {!isVoided && (
                                                    <button
                                                        onClick={() => handleDelete(pago)}
                                                        title="Anular abono"
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors border border-rose-100"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer summary */}
            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <p className="text-[11px] text-slate-400 font-medium">OdontoCloud &middot; Comprobantes de Pago</p>
                <p className="text-[11px] text-slate-400 font-medium">{filtered.length} de {pagos.length} registros</p>
            </div>

            {/* Void Modal */}
            {voidModal.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-800">Anular Registro de Pago</h3>
                            <button
                                onClick={() => !voiding && setVoidModal({ open: false, pago: null })}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 mb-4 space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Concepto:</span>
                                <span className="font-semibold text-slate-700">{voidModal.pago?.concepto || "ABONO GENERAL"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Monto a anular:</span>
                                <span className="font-bold text-rose-600">${formatCurrency(voidModal.pago?.monto || 0)}</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700">
                                Motivo de anulación <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                autoFocus
                                rows={3}
                                placeholder="Escribe el motivo detallado de la anulación..."
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition"
                            />
                        </div>

                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => { setVoidModal({ open: false, pago: null }); setVoidReason(""); }}
                                disabled={voiding}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmVoid}
                                disabled={voiding || !voidReason.trim()}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {voiding && <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                <span>{voiding ? "Anulando..." : "Confirmar Anulación"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
