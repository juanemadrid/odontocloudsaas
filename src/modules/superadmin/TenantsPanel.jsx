import React, { useState, useEffect } from "react";
import {
    getTenants, createTenant, getPlans, toggleTenantStatus, updateTenantPlan,
    getSubscriptionRequests, approveSubscriptionRequest, rejectSubscriptionRequest, grantFreeMonth,
    deleteTenant
} from "../../services/adminService";


const IconClinic = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
);
const IconPlan = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);
const IconUser = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
const IconEdit = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
);
const IconTrash = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const IconCheck = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const IconFolder = ({ size = 20 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
);

export default function TenantsPanel({ hideTitle }) {
    const [tenants, setTenants] = useState([]);
    const [plans, setPlans] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    // ... rest of states ...
    const [showModal, setShowModal] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [newPlanId, setNewPlanId] = useState("");
    const [newDuration, setNewDuration] = useState("monthly");
    const [processing, setProcessing] = useState(false);

    // Form State
    const [newTenant, setNewTenant] = useState({
        name: "",
        address: "",
        contactEmail: "",
        planId: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        planDuration: "monthly" // Default
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [tData, pData] = await Promise.all([
                getTenants(),
                getPlans()
            ]);
            setTenants(tData);
            setPlans(pData);
            if (pData.length > 0 && !newTenant.planId) {
                setNewTenant(prev => ({ ...prev, planId: pData[0].id }));
            }
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    // ... (logic functions handleCreate etc) ...
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await createTenant(newTenant);
            setShowModal(false);
            setNewTenant({
                name: "", address: "", contactEmail: "",
                planId: plans[0]?.id || "",
                adminName: "", adminEmail: "", adminPassword: "",
                planDuration: "monthly"
            });
            loadData();
            alert("✅ Clínica creada exitosamente.");
        } catch (error) {
            console.error("Error creating tenant:", error);
            alert("Error al crear clínica. Verifica los datos.");
        }
    };

    const handleStatusToggle = async (id, currentStatus) => {
        if (!window.confirm("¿Seguro de cambiar el estado de esta clínica?")) return;
        try {
            await toggleTenantStatus(id, currentStatus);
            loadData();
        } catch (error) {
            alert("Error al cambiar estado");
        }
    };

    const openPlanModal = (tenant) => {
        setSelectedTenant(tenant);
        setNewPlanId(tenant.planId);
        setNewDuration(tenant.planDuration || "monthly");
        setShowPlanModal(true);
    };

    const handleUpdatePlan = async (e) => {
        e.preventDefault();
        if (!selectedTenant || !newPlanId) return;

        try {
            await updateTenantPlan(selectedTenant.id, newPlanId, newDuration);
            setShowPlanModal(false);
            loadData();
            alert("✅ Plan actualizado exitosamente.");
        } catch (error) {
            console.error(error);
            alert("Error al actualizar el plan.");
        }
    };

    const handleGrantFreeMonth = async (id) => {
        if (!window.confirm("¿Deseas regalar 1 mes gratis de servicio a esta clínica? Esto extenderá su fecha de vencimiento actual en 30 días.")) return;
        try {
            await grantFreeMonth(id);
            alert("✅ Mes de cortesía otorgado con éxito.");
            loadData();
        } catch (error) {
            alert("Error al otorgar mes gratis");
        }
    };

    const handleApproveRequest = async (id) => {
        if (!window.confirm("¿Seguro de aprobar y activar este plan?")) return;
        try {
            setProcessing(true);
            await approveSubscriptionRequest(id);
            alert("✅ Solicitud aprobada con éxito.");
            loadData();
        } catch (error) {
            alert("Error al aprobar");
        } finally {
            setProcessing(false);
        }
    };

    const handleRejectRequest = async (id) => {
        const reason = window.prompt("Motivo del rechazo (opcional):");
        if (reason === null) return;
        try {
            await rejectSubscriptionRequest(id, reason);
            loadData();
        } catch (error) {
            alert("Error al rechazar");
        }
    };

    const handleDeleteTenant = async (id, name) => {
        if (!window.confirm(`⚠️ ADVERTENCIA CRÍTICA: ¿Estás ABSOLUTAMENTE SEGURO de eliminar la clínica "${name}"? \n\nEsto borrará permanentemente la configuración, consultorios y perfiles de usuario en la base de datos Firestore. \n\nNOTA: El usuario de autenticación (Email) permanecerá en Firebase Auth. Deberás borrarlo manualmente desde la consola de Firebase si deseas volver a usar el mismo correo para una nueva clínica.`)) return;

        try {
            setProcessing(true);
            await deleteTenant(id);
            alert("✅ Clínica y datos asociados eliminados de Firestore exitosamente.");
            loadData();
        } catch (error) {
            console.error(error);
            alert("Error al eliminar la clínica.");
        } finally {
            setProcessing(false);
        }
    };

    const getPlanName = (id) => {
        if (id === 'trial') return "Mes de Prueba";
        return plans.find(p => p.id === id)?.name || "N/A";
    };

    const formatDate = (ts) => {
        if (!ts) return "Indefinido";
        if (ts.toDate) return ts.toDate().toLocaleDateString();
        return new Date(ts).toLocaleDateString();
    };

    return (
        <div className="w-full space-y-6">

            {/* Enterprise KPI Cards (Flat & Clean) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Clínicas Totales</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{tenants.length}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-md border border-slate-100 text-slate-500">
                        <IconClinic size={20} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Activas</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{tenants.filter(t => t.status === 'active').length}</p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-md border border-emerald-100 text-emerald-600">
                        <IconCheck size={20} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">En Prueba</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{tenants.filter(t => t.planType === 'trial').length}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-md border border-blue-100 text-blue-600">
                        <IconPlan size={20} />
                    </div>
                </div>

                <div className={`p-5 rounded-lg border shadow-sm flex items-center justify-between cursor-pointer transition-colors ${requests.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}
                    onClick={() => setShowRequestModal(true)}>
                    <div>
                        <p className={`text-xs font-medium uppercase tracking-wide ${requests.length > 0 ? 'text-orange-700' : 'text-slate-500'}`}>Solicitudes</p>
                        <div className="flex items-center gap-2 mt-1">
                            <p className={`text-2xl font-bold ${requests.length > 0 ? 'text-orange-900' : 'text-slate-900'}`}>{requests.length}</p>
                            {requests.length > 0 && <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded">Nuevas</span>}
                        </div>
                    </div>
                    <div className={`p-2 rounded-md border ${requests.length > 0 ? 'bg-orange-100 border-orange-200 text-orange-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                        <IconFolder size={20} />
                    </div>
                </div>
            </div>

            {/* Table Header & Actions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
                    <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                        <h3 className="font-black text-slate-800 text-xs uppercase tracking-[.2em]">Registro Central</h3>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <input
                                type="text"
                                placeholder="Filtrar por nombre o email..."
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300"
                            />
                            <span className="absolute left-3.5 top-3 text-slate-300">⌕</span>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
                        >
                            + Registrar Clínica
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 text-sm font-medium">Sincronizando base de datos...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Socio / Contacto</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel de Plan</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiración</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Controles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tenants.map(tenant => (
                                    <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-[#022a63] font-black text-xs border border-slate-200">
                                                    {tenant.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-700 text-sm">{tenant.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">{tenant.contactEmail}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-600">
                                                    {getPlanName(tenant.planId)} <span className="text-[9px] opacity-50 font-normal">({tenant.planDuration === 'yearly' ? 'ANUAL' : 'MENSUAL'})</span>
                                                </span>
                                                <button onClick={() => openPlanModal(tenant)} className="text-slate-300 hover:text-blue-600 transition-colors" title="Ajustar Plan">
                                                    <IconEdit />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-xs font-bold text-slate-500">
                                            {formatDate(tenant.subscriptionEndDate)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${tenant.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                <span className={`w-1 h-1 rounded-full ${tenant.status === 'active' ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                                {tenant.status === 'active' ? 'ACTIVA' : 'OFFLINE'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleGrantFreeMonth(tenant.id)}
                                                    className="px-3 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                    title="Regalar 1 Mes"
                                                >
                                                    + 1 Mes
                                                </button>
                                                <button
                                                    onClick={() => handleStatusToggle(tenant.id, tenant.status)}
                                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${tenant.status === 'active'
                                                        ? 'text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                                                        : 'text-blue-600 border-blue-100 bg-blue-50/50 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                                                        }`}
                                                >
                                                    {tenant.status === 'active' ? 'Bloquear' : 'Habilitar'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Eliminar Permanente"
                                                >
                                                    <IconTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {tenants.length === 0 && (
                            <div className="p-10 text-center text-slate-400 text-xs font-medium italic">No existen registros en el sistema nacional.</div>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-800">Registrar Nueva Clínica</h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                            </div>
                            <form onSubmit={handleCreate} className="p-6 space-y-5">
                                {/* Clinic Info */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Datos de la Empresa</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Comercial</label>
                                        <input type="text" className="w-full input-premium" required
                                            value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
                                            placeholder="Ej. Clínica Dental Sonrisas" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Email Contacto</label>
                                            <input type="email" className="w-full input-premium" required
                                                value={newTenant.contactEmail} onChange={e => setNewTenant({ ...newTenant, contactEmail: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Plan Inicial</label>
                                            <select className="w-full input-premium" required
                                                value={newTenant.planId} onChange={e => setNewTenant({ ...newTenant, planId: e.target.value })}>
                                                <option value="">Seleccionar...</option>
                                                {plans.map(p => <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Duración (Facturación)</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="dur" checked={newTenant.planDuration === "monthly"} onChange={() => setNewTenant({ ...newTenant, planDuration: "monthly" })} />
                                                <span className="text-sm">Mensual</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="dur" checked={newTenant.planDuration === "yearly"} onChange={() => setNewTenant({ ...newTenant, planDuration: "yearly" })} />
                                                <span className="text-sm">Anual (+1 Año)</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>



                                <hr className="border-slate-100" />


                                {/* Admin Info */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Primer Admin (Superusuario)</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                                        <input type="text" className="w-full input-premium" required
                                            value={newTenant.adminName} onChange={e => setNewTenant({ ...newTenant, adminName: e.target.value })}
                                            placeholder="Dr. Juan Pérez" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Email Acceso</label>
                                            <input type="email" className="w-full input-premium" required
                                                value={newTenant.adminEmail} onChange={e => setNewTenant({ ...newTenant, adminEmail: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                                            <input type="password" className="w-full input-premium" required
                                                value={newTenant.adminPassword} onChange={e => setNewTenant({ ...newTenant, adminPassword: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">
                                        Cancelar
                                    </button>
                                    <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all transform active:scale-95">
                                        Crear Clínica
                                    </button>
                                </div>
                            </form >
                        </div >
                    </div >
                )
            }

            {/* MODAL SUBSCRIPTION REQUESTS */}
            {
                showRequestModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
                            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">Solicitudes Pendientes</h3>
                                    <p className="text-xs text-slate-400 font-bold">Revisión de cambios de plan y renovaciones</p>
                                </div>
                                <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors">&times;</button>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                                {requests.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <div className="text-5xl mb-4">📬</div>
                                        <p className="font-bold">No hay solicitudes nuevas por ahora.</p>
                                    </div>
                                ) : (
                                    requests.map(req => (
                                        <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-sm uppercase">{req.tenantName}</h4>
                                                    <p className="text-[10px] text-slate-400 font-bold">Enviada el: {formatDate(req.createdAt)}</p>
                                                </div>
                                                <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded text-[9px] font-black uppercase">Pendiente</span>
                                            </div>
                                            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg mb-4">
                                                <div className="flex-1">
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Plan Actual</p>
                                                    <p className="text-xs font-bold text-slate-600">{getPlanName(req.currentPlanId)}</p>
                                                </div>
                                                <div className="text-slate-300">➜</div>
                                                <div className="flex-1">
                                                    <p className="text-[9px] text-indigo-400 font-bold uppercase">Solicitado</p>
                                                    <p className="text-xs font-black text-indigo-700">{req.requestedPlanName}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleRejectRequest(req.id)}
                                                    className="px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-lg text-[10px] font-black uppercase transition-colors"
                                                >
                                                    Rechazar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const msg = `Hola ${req.tenantName}, recibimos tu solicitud para el plan *${req.requestedPlanName}*. ¿Podrías enviarnos el comprobante de pago para activarlo ahora mismo?`;
                                                        window.open(`https://wa.me/${req.tenantPhone || '573124119846'}?text=${encodeURIComponent(msg)}`, "_blank");
                                                    }}
                                                    className="px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg text-[10px] font-black uppercase transition-colors flex items-center gap-1"
                                                >
                                                    Contactar WhatsApp
                                                </button>
                                                <button
                                                    onClick={() => handleApproveRequest(req.id)}
                                                    disabled={processing}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-[10px] font-black uppercase shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                                                >
                                                    {processing ? 'Procesando...' : 'Validar y Activar'}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-4 border-t border-slate-100 text-center">
                                <button onClick={() => setShowRequestModal(false)} className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">Cerrar Buzón</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODAL PLAN ADJUSTMENT */}
            {
                showPlanModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
                            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-800">Ajustar Plan de {selectedTenant?.name}</h3>
                                <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                            </div>
                            <form onSubmit={handleUpdatePlan} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nuevo Plan</label>
                                    <select className="w-full input-premium" required
                                        value={newPlanId} onChange={e => setNewPlanId(e.target.value)}>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Periodicidad</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="upd_dur" checked={newDuration === "monthly"} onChange={() => setNewDuration("monthly")} />
                                            <span className="text-sm">Mensual</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="upd_dur" checked={newDuration === "yearly"} onChange={() => setNewDuration("yearly")} />
                                            <span className="text-sm">Anual</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setShowPlanModal(false)} className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl font-bold">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Actualizar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <style>{`
                .input-premium {
                    background-color: #ffffff;
                    border: 1px solid #94a3b8; /* slate-400 */
                    border-radius: 0.75rem;
                    padding: 0.625rem 1rem;
                    outline: none;
                    transition: all 0.2s;
                    color: #1e293b; /* slate-800 */
                }
                .input-premium::placeholder {
                    color: #cbd5e1; /* slate-300 */
                }
                .input-premium:focus {
                    background-color: #fff;
                    border-color: #4f46e5; /* indigo-600 */
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
                }
            
            `}</style>
        </div >
    );
}
