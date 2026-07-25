import React, { useState, useEffect } from 'react';
import { getPlansByPatient, deletePlan, updatePlan, createPlan } from '../../../services/planService';
import { getPatientById } from '../../../services/patientService';
import { FiPlus, FiPrinter, FiEdit3, FiTrash2, FiX, FiAlertCircle, FiShield, FiFileText, FiArrowRight, FiCopy } from "react-icons/fi";
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { BudgetPrintService } from '../../../services/BudgetPrintService';
import { db } from '../../../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function PlanList({ patient, refreshKey, onEdit, onNew, setEditingPlan }) {
    const patientId = patient?.id;
    const [plans, setPlans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [evolutions, setEvolutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const { userProfile } = useAuth();
    
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('presupuesto'); // 'presupuesto' | 'plan'
    
    // Deletion Modal State
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, planId: null, planName: "" });
    
    // Form fields
    const [formData, setFormData] = useState({
        nombre: '',
        profesional: userProfile?.nombreCompleto || `${userProfile?.nombre || ''} ${userProfile?.apellido || ''}`.trim() || '',
        vigencia: 30,
        observaciones: '',
        paymentMode: 'particular',
        epsName: '',
        entidadId: '',
        tarifaId: '',
        ordenNumero: '',
        ordenFecha: '',
        ordenUrgente: false
    });
    
    const [profesionalesDropdown, setProfesionalesDropdown] = useState([]);
    const [entidades, setEntidades] = useState([]);
    const [tarifas, setTarifas] = useState([]);

    useEffect(() => {
        loadData();
        loadProfesionales();
        loadInstitutionalCatalogs();
    }, [patientId, refreshKey]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getPlansByPatient(patientId);
            setPlans(data);

            if (patientId) {
                // Load payments
                const q = query(collection(db, "pagos"), where("patientId", "==", patientId));
                const snap = await getDocs(q);
                const paymentsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPayments(paymentsData);

                // Load clinical evolutions
                const evoQ = query(collection(db, "clinical_evolutions"), where("patientId", "==", patientId));
                const evoSnap = await getDocs(evoQ);
                setEvolutions(evoSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadProfesionales = async () => {
        if (!userProfile?.inquilino) return;
        try {
            if (patient?.profesionales && Array.isArray(patient.profesionales) && patient.profesionales.length > 0) {
                const profs = patient.profesionales.map(p => 
                    p.nombreCompleto || `${p.nombre || ''} ${p.apellido || ''}`.trim() || p.displayName || p.email || ''
                ).filter(n => !!n);
                setProfesionalesDropdown([...new Set(profs)]);
                return;
            }

            // Asumiendo que los profesionales son usuarios del inquilino
            const q = query(
                collection(db, "usuarios"), 
                where("inquilino", "==", userProfile.inquilino)
            );
            const snap = await getDocs(q);
            const profs = snap.docs.map(d => {
                const data = d.data();
                return data.nombreCompleto || `${data.nombre || ''} ${data.apellido || ''}`.trim() || data.displayName || data.email || '';
            }).filter(n => !!n);
            setProfesionalesDropdown([...new Set(profs)]);
        } catch (e) {
            console.error(e);
        }
    };

    const loadInstitutionalCatalogs = async () => {
        if (!userProfile?.inquilino) return;
        try {
            const [entidadesSnap, tarifasSnap] = await Promise.all([
                getDocs(query(collection(db, "entidades"), where("inquilino", "==", userProfile.inquilino))),
                getDocs(query(collection(db, "listas_precios"), where("inquilino", "==", userProfile.inquilino)))
            ]);

            setEntidades(entidadesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setTarifas(tarifasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("Error loading institutional catalogs:", e);
        }
    };

    const handleDeleteClick = (plan) => {
        setDeleteModal({
            isOpen: true,
            planId: plan.id,
            planName: plan.title || plan.nombre || "este registro"
        });
    };

    const confirmDelete = async () => {
        const id = deleteModal.planId;
        setDeleteModal({ ...deleteModal, isOpen: false });
        try {
            await deletePlan(id);
            toast.success("Registro eliminado permanentemente");
            loadData();
        } catch (e) {
            toast.error("Error al eliminar el registro");
        }
    };

    const handlePrint = async (e, plan) => {
        if (e) e.stopPropagation();
        
        if (!patient) {
            toast.error("Error: Datos del paciente no cargados");
            return;
        }

        const clinic = userProfile?.tenant || {
            nombre: userProfile?.tenantNombre || userProfile?.clinica || "Clínica",
            inquilino: userProfile?.inquilino || userProfile?.tenantId || userProfile?.tenant?.id
        };

        if (!clinic.inquilino && !clinic.id && !clinic.nombre) {
            console.error("Clinic identification failed:", { userProfile });
            toast.error("Datos de clínica incompletos. Por favor contacte soporte.");
            return;
        }

        // Pass userProfile to generatePDF to use as fallback for professional name
        await BudgetPrintService.generatePDF(plan, patient, clinic, userProfile);
    };

    const handleConvertToPlan = async (e, plan) => {
        if (e) e.stopPropagation();
        try {
            await updatePlan(plan.id, {
                ...plan,
                type: 'plan',
                status: 'accepted',
                convertedAt: new Date()
            });
            toast.success(`Presupuesto "${plan.title || plan.nombre}" convertido a Plan de Tratamiento`);
            loadData();
        } catch (err) {
            console.error("Error converting plan:", err);
            toast.error("Error al convertir el presupuesto");
        }
    };

    const handleDuplicate = async (e, plan) => {
        if (e) e.stopPropagation();
        try {
            const duplicatedData = {
                patientId: plan.patientId,
                title: `${plan.title || plan.nombre || 'Presupuesto'} (Copia)`,
                items: plan.items || [],
                total: plan.total || 0,
                subtotal: plan.subtotal || 0,
                totalDescuento: plan.totalDescuento || 0,
                status: 'draft',
                type: plan.type || 'presupuesto',
                profesionalId: plan.profesionalId || '',
                vigencia: plan.vigencia || 30,
                observaciones: plan.observaciones || '',
                cobertura: plan.cobertura || {},
                inquilino: plan.inquilino || '',
                baseListId: plan.baseListId || null
            };
            await createPlan(duplicatedData);
            toast.success("Presupuesto duplicado correctamente");
            loadData();
        } catch (err) {
            console.error("Error duplicating plan:", err);
            toast.error("Error al duplicar el presupuesto");
        }
    };

    const currentUserFullName = userProfile?.nombreCompleto || `${userProfile?.nombre || ''} ${userProfile?.apellido || ''}`.trim() || userProfile?.displayName || '';
    const hasInstitutionalContext = Boolean(userProfile?.tenant?.esIps || patient?.nombreEps || patient?.convenioBeneficio || entidades.length > 0);

    const openModal = (type) => {
        setModalType(type);
        setFormData({
            nombre: '',
            profesional: currentUserFullName || (profesionalesDropdown.length > 0 ? profesionalesDropdown[0] : ''),
            vigencia: 30,
            observaciones: '',
            paymentMode: 'particular',
            epsName: patient?.nombreEps || patient?.eps || '',
            entidadId: '',
            tarifaId: '',
            ordenNumero: '',
            ordenFecha: '',
            ordenUrgente: false
        });
        setShowModal(true);
    };

    const handleCreateSubmit = (e) => {
        e.preventDefault();
        const selectedEntidad = entidades.find(ent => ent.id === formData.entidadId);
        const selectedTarifa = tarifas.find(tarifa => tarifa.id === formData.tarifaId);
        const cobertura = {
            tipo: formData.paymentMode,
            epsNombre: formData.paymentMode === 'entidad' ? formData.epsName : '',
            entidadId: formData.paymentMode === 'entidad' ? formData.entidadId : '',
            entidadNombre: formData.paymentMode === 'entidad' ? (selectedEntidad?.nombre || selectedEntidad?.name || selectedEntidad?.razonSocial || '') : '',
            tarifaId: formData.paymentMode === 'entidad' ? formData.tarifaId : '',
            tarifaNombre: formData.paymentMode === 'entidad' ? (selectedTarifa?.nombre || selectedTarifa?.name || '') : '',
            ordenNumero: formData.paymentMode === 'entidad' ? formData.ordenNumero : '',
            ordenFecha: formData.paymentMode === 'entidad' ? formData.ordenFecha : '',
            ordenUrgente: formData.paymentMode === 'entidad' ? formData.ordenUrgente : false
        };

        setShowModal(false);
        // Start edit mode with initial data
        setEditingPlan({
            type: modalType,
            title: formData.nombre,
            profesionalId: formData.profesional,
            vigencia: modalType === 'presupuesto' ? formData.vigencia : null,
            observaciones: formData.observaciones,
            cobertura,
            items: []
        });
        onNew(); // Switches PresupuestosTab to 'create/edit' mode
    };

    // Compute the display status of a plan: 'paid' | 'debt' | 'partial' | 'pending'
    const getPlanStatus = (plan) => {
        const planPayments = payments.filter(pay => pay.planId === plan.id && pay.estado !== 'Anulado');
        const planEvolutions = evolutions.filter(e => e.planId === plan.id);
        const totalCost = Number(plan.total || 0);
        const paidAmt = planPayments.reduce((s, p) => s + Number(p.monto || 0), 0);

        // Build paidMap per item
        const paidMap = {};
        (plan.items || []).forEach(it => { paidMap[it.id] = 0; });
        planPayments.forEach(p => {
            if (p.itemPayments && p.itemPayments.length > 0) {
                p.itemPayments.forEach(ip => {
                    if (paidMap[ip.itemId] !== undefined) paidMap[ip.itemId] += Number(ip.monto || 0);
                });
            }
        });

        // Check if any realized item has debt
        const hasRealizedDebt = (plan.items || []).some(item => {
            // Compatibilidad: registros nuevos usan `realizado`, antiguos usaban `checked`
            const realized = planEvolutions.some(e =>
                e.plantillaItems?.[item.id]?.realizado === true ||
                (e.plantillaItems?.[item.id]?.realizado === undefined && e.plantillaItems?.[item.id]?.checked === true)
            );
            if (!realized) return false;
            const itemCost = (Number(item.amount || 0) * Number(item.qty || 1)) - Number(item.descuento || 0);
            const itemPaid = paidMap[item.id] || 0;
            return itemCost - itemPaid > 0;
        });

        if (totalCost > 0 && paidAmt >= totalCost) return 'paid';
        if (hasRealizedDebt) return 'debt';
        if (paidAmt > 0) return 'partial';
        return 'pending';
    };

    const presupuestos = plans.filter(p => !p.type || p.type === 'presupuesto'); // Fallback viejo a presupuesto
    const planesTrat = plans.filter(p => p.type === 'plan');

    // Verifica si algún ítem del plan fue marcado como realizado en cualquier evolución
    const isPlanRealized = (plan) => {
        return (plan.items || []).some(item =>
            evolutions.some(evo =>
                evo.planId === plan.id &&
                (evo.plantillaItems?.[item.id]?.realizado === true ||
                 (evo.plantillaItems?.[item.id]?.realizado === undefined &&
                  evo.plantillaItems?.[item.id]?.checked === true))
            )
        );
    };

    if (loading) return <div className="p-10 text-center text-slate-400 font-bold animate-pulse">Cargando registros...</div>;

    return (
        <div className="space-y-12 pb-20">
            {/* Tabla de Presupuestos */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-6 border-b border-slate-200">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Presupuestos</h3>
                    <button 
                        onClick={() => openModal('presupuesto')}
                        className="mt-4 sm:mt-0 px-6 py-2 bg-[#8CC63F] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 hover:bg-[#7bb335] transition-all flex items-center gap-2"
                    >
                        <FiPlus size={14} strokeWidth={3} /> Nuevo Presupuesto
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto">
                        <thead>
                            <tr className="bg-white border-b border-slate-100 uppercase text-[10px] font-black text-slate-400 tracking-widest">
                                <th className="px-3 py-3.5">Nombre</th>
                                <th className="px-3 py-3.5">Sucursal</th>
                                <th className="px-3 py-3.5">Profesional</th>
                                <th className="px-3 py-3.5">Fecha de creación</th>
                                <th className="px-3 py-3.5 text-center">Válido hasta</th>
                                <th className="px-3 py-3.5 text-right">Costo total</th>
                                <th className="px-3 py-3.5 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[12px] font-bold text-slate-600">
                            {presupuestos.length === 0 ? (
                                <tr><td colSpan="7" className="p-8 text-center text-slate-400">No data available in table</td></tr>
                            ) : presupuestos.map(p => {
                                const createdAt = p.date ? new Date(p.date) : new Date();
                                const vigencia = p.vigencia || 30;
                                const validUntil = new Date(createdAt);
                                validUntil.setDate(validUntil.getDate() + vigencia);

                                return (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onEdit(p)}>
                                    <td className="px-3 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2.5 h-2.5 rounded-full ${p.status === 'accepted' ? 'bg-[#8CC63F]' : 'bg-slate-300'}`} />
                                            <span className="uppercase text-slate-700">{p.title || p.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3.5 uppercase text-[10px] text-slate-400 font-black">{userProfile?.tenant?.nombre || "Sede Principal"}</td>
                                    <td className="px-3 py-3.5 text-slate-500">{p.profesionalId || p.profesional || "No Asignado"}</td>
                                    <td className="px-3 py-3.5 align-middle">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <FiFileText className="text-slate-300"/> {createdAt.toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3.5 text-center text-slate-500">{validUntil.toLocaleDateString()}</td>
                                    <td className="px-3 py-3.5 text-right font-black text-slate-900 font-mono whitespace-nowrap align-middle">$ {Number(p.total || 0).toLocaleString('es-CO')}</td>
                                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button 
                                                onClick={(e) => handleConvertToPlan(e, p)} 
                                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm" 
                                                title="Convertir a Plan de Tratamiento"
                                            >
                                                <FiArrowRight size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEdit(p); }} 
                                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" 
                                                title="Editar"
                                            >
                                                <FiEdit3 size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDuplicate(e, p)} 
                                                className="p-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-600 hover:text-white transition-all shadow-sm" 
                                                title="Duplicar"
                                            >
                                                <FiCopy size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(p); }} 
                                                disabled={isPlanRealized(p)}
                                                className={`p-2 rounded-lg transition-all shadow-sm ${
                                                    isPlanRealized(p)
                                                        ? 'bg-slate-50 text-slate-200 cursor-not-allowed'
                                                        : 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white'
                                                }`}
                                                title={isPlanRealized(p) ? 'No se puede eliminar: tiene procedimientos marcados como realizados' : 'Eliminar'}
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tabla de Planes de Tratamiento */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-6 border-b border-slate-200">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Planes de Tratamiento</h3>
                    <button 
                        onClick={() => openModal('plan')}
                        className="mt-4 sm:mt-0 px-6 py-2 bg-[#8CC63F] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 hover:bg-[#7bb335] transition-all flex items-center gap-2"
                    >
                        <FiPlus size={14} strokeWidth={3} /> Nuevo Plan de Tratamiento
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto">
                        <thead>
                            <tr className="bg-white border-b border-slate-100 uppercase text-[10px] font-black text-slate-400 tracking-widest">
                                <th className="px-3 py-3.5">Nombre</th>
                                <th className="px-3 py-3.5">Sucursal</th>
                                <th className="px-3 py-3.5">Profesional</th>
                                <th className="px-3 py-3.5 text-center">Fecha de inicio</th>
                                <th className="px-3 py-3.5 text-center">Fecha finalización</th>
                                <th className="px-3 py-3.5 text-center">Estado</th>
                                <th className="px-3 py-3.5 text-right">Costo total</th>
                                <th className="px-3 py-3.5 text-right">Pagado</th>
                                <th className="px-3 py-3.5 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[12px] font-bold text-slate-600">
                            {planesTrat.length === 0 ? (
                                <tr><td colSpan="9" className="p-8 text-center text-slate-400">No data available in table</td></tr>
                            ) : planesTrat.map(p => {
                                const createdAt = p.date ? new Date(p.date) : new Date();
                                const paidAmt = payments.filter(pay => pay.planId === p.id && pay.estado !== 'Anulado').reduce((sum, pay) => sum + Number(pay.monto || 0), 0);
                                const totalCost = Number(p.total || 0);
                                const planStatus = getPlanStatus(p);

                                const dotColor = planStatus === 'paid' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : planStatus === 'debt' ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'
                                    : planStatus === 'partial' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                                    : 'bg-[#8CC63F] shadow-[0_0_8px_rgba(140,198,63,0.5)]';

                                return (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onEdit(p)}>
                                    <td className="px-3 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                                            <span className="uppercase text-slate-700">{p.title || p.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3.5 uppercase text-[10px] text-slate-400 font-black">{userProfile?.tenant?.nombre || "Sede Principal"}</td>
                                    <td className="px-3 py-3.5 text-slate-500">{p.profesionalId || p.profesional || "No Asignado"}</td>
                                    <td className="px-3 py-3.5 text-center text-slate-500">{createdAt.toLocaleDateString()}</td>
                                    <td className="px-3 py-3.5 text-center text-slate-500">
                                        {p.fechaFinalizacion ? new Date(p.fechaFinalizacion).toLocaleDateString() : '--'}
                                    </td>
                                    <td className="px-3 py-3.5 text-center">
                                        {planStatus === 'paid' ? (
                                            <span className="inline-flex items-center justify-center px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-wider leading-none shadow-sm">
                                                Pagado
                                            </span>
                                        ) : planStatus === 'debt' ? (
                                            <span className="inline-flex items-center gap-1 justify-center px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[9px] font-black uppercase tracking-wider leading-none shadow-sm animate-pulse">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                Con deuda
                                            </span>
                                        ) : planStatus === 'partial' ? (
                                            <span className="inline-flex items-center gap-1 justify-center px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[9px] font-black uppercase tracking-wider leading-none shadow-sm">
                                                Abono parcial
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-[10px] uppercase font-black tracking-widest">Sin finalizar</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3.5 text-right font-black text-slate-900 font-mono whitespace-nowrap align-middle">$ {totalCost.toLocaleString('es-CO')}</td>
                                    <td className="px-3 py-3.5 text-right font-black text-[#8CC63F] font-mono whitespace-nowrap align-middle">$ {paidAmt.toLocaleString('es-CO')}</td>
                                    <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEdit(p); }} 
                                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" 
                                                title="Ver Plan"
                                            >
                                                <FiEdit3 size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(p); }} 
                                                disabled={getPlanStatus(p) !== 'pending' || isPlanRealized(p)}
                                                className={`p-2 rounded-lg transition-all shadow-sm ${
                                                    (getPlanStatus(p) !== 'pending' || isPlanRealized(p))
                                                        ? 'bg-slate-50 text-slate-200 cursor-not-allowed'
                                                        : 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white'
                                                }`}
                                                title={
                                                    getPlanStatus(p) !== 'pending' ? 'No se puede eliminar: tiene pagos registrados' :
                                                    isPlanRealized(p) ? 'No se puede eliminar: tiene procedimientos marcados como realizados' :
                                                    'Eliminar'
                                                }
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal para Nuevo Presupuesto / Plan */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">
                                {modalType === 'presupuesto' ? 'Nuevo Presupuesto' : 'Nuevo Plan de Tratamiento'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <FiX size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Nombre *</label>
                                <input 
                                    required autoFocus
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-700" 
                                    placeholder={`Ingrese el nombre del ${modalType === 'presupuesto' ? 'presupuesto' : 'plan de tratamiento'}`}
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Profesionales *</label>
                                <select 
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-700"
                                    value={formData.profesional}
                                    onChange={(e) => setFormData({...formData, profesional: e.target.value})}
                                >
                                    <option value="" disabled>Seleccione...</option>
                                    <option value={currentUserFullName || 'Usuario Demo'}>{currentUserFullName || 'Usuario Demo'}</option>
                                    {profesionalesDropdown.filter(p => p !== currentUserFullName).map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>

                            {modalType === 'presupuesto' && (
                                <div>
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Vigencia (días) *</label>
                                    <input 
                                        type="number" required min="1"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-700"
                                        value={formData.vigencia}
                                        onChange={(e) => setFormData({...formData, vigencia: Number(e.target.value)})}
                                    />
                                </div>
                            )}

                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-[11px] font-black text-slate-600 uppercase tracking-widest">
                                        <FiShield className="text-blue-500" />
                                        Modalidad de pago
                                    </div>
                                    {hasInstitutionalContext && (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full">
                                            IPS / convenio disponible
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMode: 'particular' })}
                                        className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${formData.paymentMode === 'particular' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        Particular
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMode: 'entidad' })}
                                        className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${formData.paymentMode === 'entidad' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'}`}
                                    >
                                        EPS / convenio
                                    </button>
                                </div>

                                {formData.paymentMode === 'entidad' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">EPS</label>
                                            <input
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-xs font-bold text-slate-700"
                                                value={formData.epsName}
                                                onChange={(e) => setFormData({ ...formData, epsName: e.target.value })}
                                                placeholder="Nombre de EPS"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entidad</label>
                                            <select
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-xs font-bold text-slate-700"
                                                value={formData.entidadId}
                                                onChange={(e) => setFormData({ ...formData, entidadId: e.target.value })}
                                            >
                                                <option value="">Seleccione...</option>
                                                {entidades.map(ent => (
                                                    <option key={ent.id} value={ent.id}>{ent.nombre || ent.name || ent.razonSocial || ent.id}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarifa</label>
                                            <select
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-xs font-bold text-slate-700"
                                                value={formData.tarifaId}
                                                onChange={(e) => setFormData({ ...formData, tarifaId: e.target.value })}
                                            >
                                                <option value="">Seleccione...</option>
                                                {tarifas.map(tarifa => (
                                                    <option key={tarifa.id} value={tarifa.id}>{tarifa.nombre || tarifa.name || tarifa.id}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Orden</label>
                                            <input
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-xs font-bold text-slate-700"
                                                value={formData.ordenNumero}
                                                onChange={(e) => setFormData({ ...formData, ordenNumero: e.target.value })}
                                                placeholder="Numero de autorizacion"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha de la orden</label>
                                            <input
                                                type="date"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-xs font-bold text-slate-700"
                                                value={formData.ordenFecha}
                                                onChange={(e) => setFormData({ ...formData, ordenFecha: e.target.value })}
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <input
                                                type="checkbox"
                                                checked={formData.ordenUrgente}
                                                onChange={(e) => setFormData({ ...formData, ordenUrgente: e.target.checked })}
                                                className="accent-blue-600"
                                            />
                                            Orden por urgencia
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Observaciones</label>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-bold text-slate-700 h-24 resize-none"
                                    value={formData.observaciones}
                                    onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                                ></textarea>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-50">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-700">Cerrar</button>
                                <button 
                                    type="button" 
                                    onClick={handleCreateSubmit}
                                    className="px-6 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-md"
                                >
                                    Crear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación Elite */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn border border-rose-100">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6 animate-pulse">
                                <FiTrash2 size={40} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">¿Confirmar Eliminación?</h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                                Estás a punto de eliminar el presupuesto <span className="text-rose-500 font-bold">"{deleteModal.planName}"</span>. 
                                Esta acción es irreversible y se perderán todos los datos asociados.
                            </p>
                            
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={confirmDelete}
                                    className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
                                >
                                    SÍ, ELIMINAR REGISTRO
                                </button>
                                <button 
                                    onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                                    className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all text-center"
                                >
                                    NO, MANTENER REGISTRO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
