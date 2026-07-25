import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { useToast } from '../../../context/ToastContext';
import { FiDollarSign, FiCalendar, FiCreditCard, FiTrash2, FiActivity, FiArrowRight, FiPrinter, FiX } from 'react-icons/fi';
import { formatCurrency } from '../../../utils/formatters';
import { useAuth } from '../../../context/AuthContext';
import { ReceiptPrintService } from '../../../services/ReceiptPrintService';
import { useAudit } from '../../../hooks/useAudit';

export default function HistoricoPagosTab({ patientId }) {
    const [pagos, setPagos] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const { userProfile } = useAuth();
    const { logAction } = useAudit();

    // Void modal state
    const [voidModal, setVoidModal] = useState({ open: false, pago: null });
    const [voidReason, setVoidReason] = useState("");
    const [voiding, setVoiding] = useState(false);

    const handlePrint = async (pago) => {
        try {
            const patientSnap = await getDoc(doc(db, "pacientes", patientId));
            if (!patientSnap.exists()) {
                toast.error("No se pudo cargar la información del paciente");
                return;
            }
            const patientData = { id: patientSnap.id, ...patientSnap.data() };

            const clinic = userProfile?.tenant || {
                nombre: userProfile?.tenantNombre || userProfile?.clinica || "Clínica",
                inquilino: userProfile?.inquilino || userProfile?.tenantId
            };

            await ReceiptPrintService.generatePDF(pago, patientData, clinic, userProfile);
        } catch (e) {
            console.error("Error launching print:", e);
            toast.error("Error al preparar la impresión");
        }
    };

    useEffect(() => {
        if (!patientId) return;
        
        const q = query(
            collection(db, "pagos"),
            where("patientId", "==", patientId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                fecha: d.data().fecha?.toDate() || new Date()
            }));
            
            // Sort descending client-side to avoid Firestore composite index requirement
            data.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
            
            // Filter out 'SALDO A FAVOR' concept payments, but show voided ones with indicator
            data = data.filter(p => p.concepto !== "SALDO A FAVOR");

            setPagos(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching payments:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [patientId]);

    const handleDelete = (pago) => {
        setVoidReason("");
        setVoidModal({ open: true, pago });
    };

    const handleConfirmVoid = async () => {
        if (!voidReason.trim()) {
            toast.error("El motivo de la anulación es obligatorio");
            return;
        }
        setVoiding(true);
        try {
            await updateDoc(doc(db, "pagos", voidModal.pago.id), {
                estado: "Anulado",
                motivoAnulacion: voidReason.trim(),
                anuladoPor: userProfile?.nombreCompleto || userProfile?.nombre || "Sistema",
                fechaAnulacion: new Date().toISOString(),
                updatedAt: serverTimestamp()
            });

            // Audit log
            await logAction(patientId, "VOID_PAYMENT", {
                pagoId: voidModal.pago.id,
                monto: voidModal.pago.monto || voidModal.pago.total || 0,
                concepto: voidModal.pago.concepto || "Servicio Dental",
                motivoAnulacion: voidReason.trim()
            });

            toast.success("Pago anulado correctamente");
            setVoidModal({ open: false, pago: null });
            setVoidReason("");
        } catch (error) {
            console.error("Error voiding payment:", error);
            toast.error("Error al anular el pago");
        } finally {
            setVoiding(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 opacity-30 animate-pulse">
            <FiActivity size={48} className="text-slate-400 mb-4" />
            <h5 className="text-[14px] font-black uppercase tracking-widest text-slate-500">Cargando Transacciones...</h5>
        </div>
    );

    if (pagos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-slate-50 border border-slate-100 rounded-[32px] m-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-200 mb-4 shadow-sm">
                    <FiDollarSign size={32} />
                </div>
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight mb-2">Sin Registro de Pagos</h3>
                <p className="text-[11px] font-bold text-slate-400 text-center uppercase tracking-widest leading-relaxed px-10">No se han detectado abonos o pagos registrados para este paciente.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 md:p-10 animate-fadeIn bg-slate-50/20 custom-scrollbar overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-600 rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-emerald-100">
                        <FiDollarSign size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase">Historial de <span className="text-emerald-600 underline decoration-emerald-100 decoration-8 underline-offset-4">Pagos</span></h2>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           <span>Comprobantes de ingreso y abonos</span>
                           <FiArrowRight size={10} className="text-slate-200" />
                           <span className="text-slate-500">Histórico acumulado</span>
                        </div>
                    </div>
                 </div>
            </div>

            {/* List - Compacted sizing & typography */}
            <div className="max-w-6xl mx-auto space-y-2.5">
                {pagos.map((pago) => (
                    <div key={pago.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:shadow-lg hover:shadow-slate-100/50 hover:-translate-y-0.5 transition-all duration-300 group">
                        
                        <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors shrink-0 overflow-hidden">
                                {pago.nroConsecutivo ? (
                                    <span className="text-[11px] font-black text-emerald-600 group-hover:text-emerald-700 tracking-tight leading-none"># {pago.nroConsecutivo}</span>
                                ) : (
                                    <FiCreditCard size={16} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
                                )}
                            </div>
                            
                            <div>
                                <div className="flex items-center gap-2.5 mb-0.5">
                                    {pago.nroConsecutivo && (
                                        <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">
                                            # {pago.nroConsecutivo}
                                        </span>
                                    )}
                                    <h4 className="font-black text-slate-800 text-[12px] uppercase tracking-tight">{pago.concepto || "ABONO GENERAL"}</h4>
                                    <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                        {(pago.medio || "").toLowerCase() === "saldo a favor" ? "Consumo s. a favor" : pago.medio}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                                     <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                         <FiCalendar className="text-slate-200" />
                                         {pago.fecha ? pago.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : '---'}
                                     </div>
                                     <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                         <FiActivity className="text-slate-200" />
                                         Registrado por: <span className="text-slate-600">{pago.registradoPor || 'Sistema'}</span>
                                     </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-50">
                             <div className="text-right">
                                  <div className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5">Valor Abono</div>
                                  <div className="text-lg font-black text-emerald-600 tracking-tighter">
                                      <span className="text-xs font-bold text-emerald-200 mr-0.5">$</span>
                                      {formatCurrency(pago.monto || 0)}
                                  </div>
                             </div>

                             <div className="flex items-center gap-1.5">
                                  <button
                                      onClick={() => handlePrint(pago)}
                                      title="Imprimir recibo"
                                      className="w-8 h-8 bg-slate-50 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg flex items-center justify-center transition-all shadow-sm"
                                  >
                                      <FiPrinter size={13} />
                                  </button>
                                  {pago.estado === "Anulado" ? (
                                      <span className="px-3 py-1 rounded-full text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-widest">
                                          Anulado
                                      </span>
                                  ) : (
                                      <button
                                          onClick={() => handleDelete(pago)}
                                          title="Anular pago"
                                          className="w-8 h-8 bg-slate-50 text-slate-300 hover:bg-rose-600 hover:text-white rounded-lg flex items-center justify-center transition-all shadow-sm"
                                      >
                                          <FiTrash2 size={13} />
                                      </button>
                                  )}
                             </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Void Reason Modal */}
            {voidModal.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !voiding && setVoidModal({ open: false, pago: null })} />
                    <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-slate-100 p-8 animate-fadeIn">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Anular Pago</h3>
                            <button onClick={() => !voiding && setVoidModal({ open: false, pago: null })} className="text-slate-300 hover:text-slate-600 transition-colors">
                                <FiX size={20} />
                            </button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Pago: <span className="text-slate-700">{voidModal.pago?.concepto}</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                            Monto: <span className="text-rose-600 font-black">{formatCurrency(voidModal.pago?.monto || 0)}</span>
                        </p>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Motivo de anulación <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                autoFocus
                                rows={4}
                                placeholder="Describe el motivo de la anulación para el registro de auditoría..."
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/5 focus:border-rose-300 transition-all resize-none placeholder:text-slate-200 custom-scrollbar"
                            />
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setVoidModal({ open: false, pago: null }); setVoidReason(""); }}
                                disabled={voiding}
                                className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmVoid}
                                disabled={voiding || !voidReason.trim()}
                                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {voiding ? "Anulando..." : "Confirmar Anulación"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
