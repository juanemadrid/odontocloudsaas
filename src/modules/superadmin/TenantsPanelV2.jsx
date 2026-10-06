import React, { useState, useEffect } from "react";
import {
    getTenants, createTenant, getPlans, toggleTenantStatus, updateTenantPlan,
    getSubscriptionRequests, approveSubscriptionRequest, rejectSubscriptionRequest,
    grantFreeMonth, deleteTenant, updateTenantDetails,
    resendWelcomeEmail, sendPasswordResetEmail, getEmailLogsByTenant
} from "../../services/adminService";
import supabase from "../../lib/supabaseClient";
import { adminChangePassword } from "../../lib/supabaseAdmin";

import {
    FiPlus, FiRefreshCw, FiSearch, FiActivity, FiCheck, FiX,
    FiEdit3, FiTrash2, FiToggleLeft, FiToggleRight, FiGift,
    FiAlertCircle, FiChevronRight, FiUser, FiCalendar,
    FiFileText, FiMail, FiSliders, FiMessageSquare, FiKey, FiCopy, FiEye, FiEyeOff, FiRepeat
} from "react-icons/fi";

const fmt = (ts) => {
    if (!ts) return "—";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtDateTime = (ts) => {
    if (!ts) return "Nunca";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-CO", { 
        day: "2-digit", 
        month: "short", 
        year: "numeric", 
        hour: "2-digit", 
        minute: "2-digit", 
        hour12: true 
    });
};

const formatRelativeLogin = (ts) => {
    if (!ts) return { text: "Sin actividad", sub: "Sin ingresos registrados", badge: "never" };
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return { text: "—", sub: "", badge: "never" };
    
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const timeStr = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
    const dateStr = d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });

    if (diffMins < 5) {
        return { text: "En línea", sub: `Hoy a las ${timeStr}`, badge: "online" };
    }
    if (diffMins < 60) {
        return { text: `Hace ${diffMins} min`, sub: `Hoy a las ${timeStr}`, badge: "today" };
    }
    if (diffDays === 0) {
        return { text: `Hoy ${timeStr}`, sub: `Hace ${diffHours} h`, badge: "today" };
    }
    if (diffDays === 1) {
        return { text: `Ayer ${timeStr}`, sub: `${dateStr}`, badge: "recent" };
    }
    if (diffDays < 7) {
        return { text: `Hace ${diffDays} días`, sub: `${dateStr} · ${timeStr}`, badge: "recent" };
    }
    return { text: dateStr, sub: timeStr, badge: "older" };
};

const inp = "w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all";

export default function TenantsPanelV2() {
    const [tenants,   setTenants]   = useState([]);
    const [plans,     setPlans]     = useState([]);
    const [requests,  setRequests]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [search,    setSearch]    = useState("");
    const [processing,setProcessing]= useState(false);

    // Modals
    const [showCreate,     setShowCreate]     = useState(false);
    const [showCreatePwd,  setShowCreatePwd]  = useState(false);
    const [showPlan,       setShowPlan]       = useState(false);
    const [showRequests,   setShowRequests]   = useState(false);
    const [showDetail,     setShowDetail]     = useState(null); // tenant object
    const [showEditTenant, setShowEditTenant] = useState(null);
    const [showQuickRenew, setShowQuickRenew] = useState(null); // tenant object para renovar
    const [quickRenewDuration, setQuickRenewDuration] = useState("yearly");
    const [renewing, setRenewing] = useState(false);

    // Forms
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [newPlanId,  setNewPlanId]  = useState("");
    const [newDuration,setNewDuration]= useState("monthly");
    const [newTenant,  setNewTenant]  = useState({
        name: "", nit: "", ciudad: "", address: "", contactEmail: "", planId: "",
        adminName: "", adminEmail: "", adminPassword: "", planDuration: "monthly"
    });

    const [editForm, setEditForm] = useState({
        name: "", nit: "", contactEmail: "", address: "", telefono: "", adminEmail: "", newPassword: "", showPwd: false
    });

    // Audit logs per tenant (loaded on demand)
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [sendingReset, setSendingReset] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    // Modal cambio de contraseña
    const [showChangePwd, setShowChangePwd] = useState(null); // tenant object
    const [pwdForm, setPwdForm] = useState({ newPassword: "", confirm: "", show: false });
    const [changingPwd, setChangingPwd] = useState(false);
    const [updatingPlan, setUpdatingPlan] = useState(false);
    const [grantingId, setGrantingId] = useState(null);
    const [sendingEmailId, setSendingEmailId] = useState(null);
    const [clinicEmailLogs, setClinicEmailLogs] = useState([]);
    const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tData, pData, rData] = await Promise.all([getTenants(), getPlans(), getSubscriptionRequests()]);
            setTenants(tData);
            setPlans(pData);
            setRequests(rData || []);
            if (pData.length > 0) setNewTenant(p => ({ ...p, planId: p.planId || pData[0].id }));
        } finally { setLoading(false); }
    };

    const loadClinicEmailLogs = async (tenantId) => {
        if (!tenantId) return;
        setLoadingEmailLogs(true);
        try {
            const logs = await getEmailLogsByTenant(tenantId);
            setClinicEmailLogs(logs || []);
        } catch {
            setClinicEmailLogs([]);
        } finally {
            setLoadingEmailLogs(false);
        }
    };

    const handleResendWelcome = async (tenant) => {
        const targetEmail = tenant.contactEmail || tenant.adminEmail || tenant.email;
        if (!targetEmail) {
            alert("⚠️ Esta clínica no tiene un correo de contacto o administrador registrado.");
            return;
        }

        const confirmed = window.confirm(
            `✉️ ¿Reenviar correo de bienvenida oficial de OdontoCloud a:\n\n${targetEmail}?\n\nSe generará un nuevo enlace seguro de un solo uso para que el usuario configure su contraseña de acceso.`
        );
        if (!confirmed) return;

        setSendingEmailId(tenant.id);
        try {
            const res = await resendWelcomeEmail(tenant.id, targetEmail);
            alert(`✅ ${res.message || "Correo de bienvenida enviado exitosamente."}`);
            if (showDetail?.id === tenant.id) {
                await loadClinicEmailLogs(tenant.id);
            }
        } catch (err) {
            console.error("Error al reenviar correo de bienvenida:", err);
            const msg = err.message || "";
            if (msg.toLowerCase().includes("desconocida")) {
                alert("⚠️ La función del servidor (Edge Function 'register-clinic') aún tiene la versión previa.\n\nEs necesario actualizar la función en Coolify para habilitar el envío y reenvío de correos de bienvenida.");
            } else {
                alert(`❌ Error al enviar correo:\n${msg}`);
            }
        } finally {
            setSendingEmailId(null);
        }
    };

    const loadAuditLogs = async (inquilino) => {
        // Los logs de auditoría serán implementados en una fase futura con Supabase
        setAuditLogs([]);
        setLoadingLogs(false);
    };

    const handleResetPassword = async (adminEmail) => {
        if (!adminEmail) {
            alert("⚠️ Esta clínica no tiene un correo de administrador registrado.\n\nEdita la clínica y agrega el email del admin primero.");
            return;
        }
        const confirmed = window.confirm(`🔑 ¿Enviar link de restablecimiento de contraseña a:\n\n${adminEmail}?\n\nEl usuario recibirá un correo con instrucciones para crear una nueva contraseña.`);
        if (!confirmed) return;
        setSendingReset(true);
        setResetSent(false);
        try {
            const res = await sendPasswordResetEmail(showDetail?.id || selectedTenant?.id || "", adminEmail);
            if (!res?.success) {
                throw new Error(res?.error || "No fue posible despachar el correo oficial de recuperación.");
            }

            setResetSent(true);
            setTimeout(() => setResetSent(false), 6000);
            alert(`✅ Correo oficial de restablecimiento enviado exitosamente a ${adminEmail}\n\nEl destinatario recibirá la plantilla oficial de OdontoCloud vía Resend (revisar bandeja de entrada y spam).`);
        } catch (err) {
            console.error("Error al enviar reset:", err);
            const msg = err.message || "";
            if (msg.toLowerCase().includes("desconocida") || msg.toLowerCase().includes("not found")) {
                alert("⚠️ La función del servidor (Edge Function 'register-clinic') requiere ser actualizada en el servidor.\n\nEjecuta el script de actualización en la terminal de Coolify para activar el envío oficial.");
            } else {
                alert(`❌ Error al enviar el correo de restablecimiento:\n${msg}`);
            }
        } finally {
            setSendingReset(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        const { newPassword, confirm } = pwdForm;
        const adminEmail = showChangePwd?.adminEmail || showChangePwd?.contactEmail;

        if (!adminEmail) {
            alert("⚠️ La clínica no tiene email de administrador registrado.\nEdita la clínica y agrega el email primero.");
            return;
        }
        if (newPassword.length < 8) {
            alert("❌ La contraseña debe tener al menos 8 caracteres.");
            return;
        }
        if (newPassword !== confirm) {
            alert("❌ Las contraseñas no coinciden. Por favor verifica.");
            return;
        }

        setChangingPwd(true);
        try {
            const res = await adminChangePassword(adminEmail, newPassword);
            if (res?.message) {
                alert(`ℹ️ ${res.message}`);
            } else {
                alert(`✅ Contraseña cambiada exitosamente.\n\nEl administrador de "${showChangePwd.name}" ya puede iniciar sesión con la nueva contraseña.`);
            }
            setShowChangePwd(null);
            setPwdForm({ newPassword: "", confirm: "", show: false });
        } catch (err) {
            console.error("Error al cambiar contraseña:", err);
            alert(`❌ ${err.message}`);
        } finally {
            setChangingPwd(false);
        }
    };

    const openDetail = (tenant) => {
        setShowDetail(tenant);
        loadAuditLogs(tenant.id);
    };

    const openEdit = (tenant) => {
        setSelectedTenant(tenant);
        const rawAdminEmail = tenant.adminEmail || tenant.contactEmail || tenant.email || "";
        const cleanAdminEmail = rawAdminEmail.toLowerCase() === "madridsystem@outlook.es" ? "" : rawAdminEmail;

        setEditForm({
            name: tenant.name || tenant.nombre || "",
            nit: tenant.nit || "",
            contactEmail: tenant.contactEmail && tenant.contactEmail.toLowerCase() !== "madridsystem@outlook.es" ? tenant.contactEmail : cleanAdminEmail,
            address: tenant.address || tenant.direccion || "",
            telefono: tenant.telefono || tenant.phone || "",
            adminEmail: cleanAdminEmail,
            newPassword: "",
            showPwd: false,
        });
        setShowEditTenant(tenant);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!showEditTenant) return;

        setProcessing(true);
        try {
            // Guardar datos de la clínica
            await updateTenantDetails(showEditTenant.id, editForm);

            let msg = "✅ Datos de la clínica actualizados exitosamente.";

            // Si además se escribió una nueva contraseña para el administrador
            if (editForm.newPassword && editForm.newPassword.trim().length >= 8) {
                const adminEmail = editForm.adminEmail || showEditTenant.adminEmail || showEditTenant.contactEmail;
                if (adminEmail) {
                    const res = await adminChangePassword(adminEmail, editForm.newPassword.trim());
                    if (res?.message) {
                        msg += `\n\nℹ️ ${res.message}`;
                    } else {
                        msg += `\n\n🔑 Nueva contraseña establecida para ${adminEmail}.`;
                    }
                }
            } else if (editForm.newPassword && editForm.newPassword.trim().length < 8) {
                alert("⚠️ La contraseña debe tener al menos 8 caracteres. No se cambió la contraseña.");
            }

            alert(msg);
            setShowEditTenant(null);
            loadData();
        } catch (err) {
            alert("❌ Error al guardar: " + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if ((newTenant.adminPassword || "").length < 8) {
            alert("La contrasena inicial debe tener al menos 8 caracteres.");
            return;
        }
        try {
            await createTenant(newTenant);
            setShowCreate(false);
            setNewTenant({ name:"",nit:"",ciudad:"",address:"",contactEmail:"",planId:plans[0]?.id||"",adminName:"",adminEmail:"",adminPassword:"",planDuration:"monthly" });
            loadData();
        } catch (err) { alert("Error al crear clinica: " + err.message); }
    };

    const handleStatusToggle = async (id, current) => {
        const action = current === "active" ? "Suspender" : "Activar";
        if (!window.confirm(`¿${action} esta clínica? ${current === "active" ? "Los usuarios no podrán iniciar sesión mientras esté suspendida." : ""}`)) return;
        try { 
            await toggleTenantStatus(id, current);
            // Force full reload to get fresh data from Supabase
            await loadData();
        } catch(err) { 
            console.error("Error al cambiar estado:", err);
            alert("Error al cambiar estado: " + err.message); 
        }
    };

    const handleUpdatePlan = async (e) => {
        e.preventDefault();
        if (!selectedTenant) return;
        setUpdatingPlan(true);
        try {
            const res = await updateTenantPlan(selectedTenant.id, newPlanId, newDuration);
            setShowPlan(false);
            await loadData();
            const planName = getPlanName(newPlanId);
            const durLabel = newDuration === "yearly" ? "Anual" : "Mensual";
            alert(`✅ Plan actualizado exitosamente a "${planName} (${durLabel})".\n\nSuscripción reactivada hasta: ${fmt(res?.newEndDate)}`);
        } catch (err) {
            console.error("Error al actualizar plan:", err);
            alert("❌ Error al actualizar plan: " + (err.message || "Error desconocido"));
        } finally {
            setUpdatingPlan(false);
        }
    };

    const handleGrantFree = async (tenant) => {
        const confirmed = window.confirm(
            `🎁 ¿Deseas regalar 1 mes de servicio gratis a:\n"${tenant.name}"?\n\nLa suscripción se extenderá por 30 días y la clínica quedará activa inmediatamente.`
        );
        if (!confirmed) return;

        setGrantingId(tenant.id);
        try {
            const res = await grantFreeMonth(tenant.id);
            await loadData();
            alert(`🎁 ¡1 mes gratis otorgado exitosamente a "${tenant.name}"!\n\nNueva fecha de vencimiento: ${fmt(res?.newEndDate)}`);
        } catch (err) {
            console.error("Error al otorgar mes gratis:", err);
            alert("❌ Error al otorgar mes gratis: " + (err.message || "Error desconocido"));
        } finally {
            setGrantingId(null);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`⚠️ ¿Eliminar permanentemente "${name}"? Esta acción no se puede deshacer.`)) return;
        setProcessing(true);
        try { await deleteTenant(id); loadData(); } catch { alert("Error al eliminar."); } finally { setProcessing(false); }
    };

    const handleExecuteQuickRenew = async () => {
        if (!showQuickRenew) return;
        const durText = quickRenewDuration === "yearly" ? "1 Año (365 días)" : "1 Mes (30 días)";
        if (!window.confirm(`¿Confirmas la recepción del pago y la extensión por ${durText} para "${showQuickRenew.name}"?`)) return;

        setRenewing(true);
        try {
            const res = await updateTenantPlan(showQuickRenew.id, showQuickRenew.planId || "pro", quickRenewDuration);
            await loadData();
            setShowQuickRenew(null);
            const newDateFmt = fmt(res.newEndDate);
            alert(`✅ Suscripción de "${showQuickRenew.name}" renovada exitosamente.\nNueva fecha de vencimiento: ${newDateFmt}`);
        } catch (err) {
            console.error("Error renovando suscripción:", err);
            alert("❌ Error al renovar: " + (err.message || "Error desconocido"));
        } finally {
            setRenewing(false);
        }
    };

    const handleApprove = async (id) => {
        setProcessing(true);
        try {
            await approveSubscriptionRequest(id);
            await loadData();
            alert("✅ Clínica aprobada y activada exitosamente. Ya aparece en tu lista de clínicas activas.");
        } catch (err) {
            console.error("Error al aprobar solicitud:", err);
            alert("❌ Error al aprobar la solicitud: " + (err.message || "Intenta nuevamente."));
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt("Motivo del rechazo (opcional):");
        if (reason === null) return;
        try {
            await rejectSubscriptionRequest(id, reason);
            await loadData();
            alert("ℹ️ Solicitud rechazada.");
        } catch (err) {
            alert("Error al rechazar solicitud: " + err.message);
        }
    };

    const getPlanName = (id) => id === "trial" ? "Prueba" : plans.find(p => p.id === id)?.name || "N/A";

    const filtered = tenants.filter(t =>
        !search ||
        (t.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.contactEmail || t.email || "").toLowerCase().includes(search.toLowerCase())
    );

    const active   = tenants.filter(t => t.status === "active").length;
    const inactive = tenants.filter(t => t.status !== "active").length;
    const trial    = tenants.filter(t => t.planId === "trial").length;

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label:"Clínicas totales", val:tenants.length, color:"text-slate-800",  bg:"bg-white" },
                    { label:"Activas",           val:active,         color:"text-emerald-600",bg:"bg-emerald-50" },
                    { label:"Inactivas",         val:inactive,       color:"text-rose-600",   bg:"bg-rose-50" },
                    { label:"Solicitudes",       val:requests.length,color:"text-amber-600",  bg:"bg-amber-50", onClick:()=>setShowRequests(true), pulse: requests.length > 0 },
                ].map((k,i) => (
                    <div key={i} onClick={k.onClick} className={`${k.bg} rounded-2xl border border-white/60 shadow-sm p-5 ${k.onClick?"cursor-pointer hover:shadow-md transition-shadow":""}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{k.label}</p>
                        <div className="flex items-center gap-2">
                            <p className={`text-3xl font-black ${k.color}`}>{k.val}</p>
                            {k.pulse && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14}/>
                        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o correo..."
                            className="pl-9 pr-3 h-10 w-full rounded-lg border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-slate-50 transition-all"/>
                    </div>
                    <button onClick={loadData} title="Actualizar lista"
                        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-blue-500 transition-all">
                        <FiRefreshCw size={14}/>
                    </button>
                    <button onClick={()=>setShowCreate(true)}
                        className="shrink-0 flex items-center gap-2 px-5 h-10 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 whitespace-nowrap">
                        <FiPlus size={14}/> Registrar Clínica
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                        Cargando...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/70">
                                    {["Clínica","Plan","Vencimiento","Estado","Último Acceso","Facturas","Acciones"].map((h,i)=>(
                                        <th key={i} className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(t => {
                                    const isActive = t.status === "active";
                                    const cuota = t.facturacionCuota ?? 0;
                                    const usadas = t.facturacionUsadas ?? 0;
                                    const disp = Math.max(0, cuota - usadas);
                                    return (
                                        <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3 cursor-pointer group/name" onClick={() => { setShowDetail(t); loadClinicEmailLogs(t.id); }}>
                                                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                                                        {(t.name||"?")[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800 text-sm leading-tight">{t.name}</p>
                                                        <p className="text-[11px] text-slate-400">{t.contactEmail || t.email || "—"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 uppercase">
                                                    {getPlanName(t.planId)}
                                                </span>
                                                <p className="text-[10px] text-slate-400 mt-1 ml-0.5">{t.planDuration === "yearly" ? "Anual" : "Mensual"}</p>
                                            </td>
                                            <td className="px-5 py-4 text-xs whitespace-nowrap">
                                                {(() => {
                                                    if (!t.subscriptionEndDate) {
                                                        return <span className="text-slate-400 font-medium">Sin fecha</span>;
                                                    }
                                                    const end = new Date(t.subscriptionEndDate);
                                                    const now = new Date();
                                                    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
                                                    const isExp = diffDays < 0;
                                                    const isToday = diffDays === 0;
                                                    const isUrgent = diffDays > 0 && diffDays <= 7;
                                                    const isWarning = diffDays > 7 && diffDays <= 15;

                                                    return (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className={isExp ? "text-rose-600 font-bold" : "text-slate-700 font-semibold"}>
                                                                {fmt(t.subscriptionEndDate)}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                {isExp && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
                                                                        Vencido
                                                                    </span>
                                                                )}
                                                                {isToday && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                                                                        Vence hoy
                                                                    </span>
                                                                )}
                                                                {isUrgent && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                        {diffDays === 1 ? "Vence mañana" : `Vence en ${diffDays} d`}
                                                                    </span>
                                                                )}
                                                                {isWarning && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                                        Vence en {diffDays} d
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-5 py-4">
                                                <button onClick={()=>handleStatusToggle(t.id, t.status)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all group relative ${isActive
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                                                        : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"}`}>
                                                    {isActive ? <FiToggleRight size={13}/> : <FiToggleLeft size={13}/>}
                                                    <span className="group-hover:hidden">{isActive ? "Activo" : "Inactivo"}</span>
                                                    <span className="hidden group-hover:inline">{isActive ? "Suspender" : "Activar"}</span>
                                                </button>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {(() => {
                                                    const login = formatRelativeLogin(t.lastSignInAt);
                                                    const isOnline = login.badge === "online";
                                                    const isToday = login.badge === "today";
                                                    return (
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                                    isOnline ? "bg-emerald-500 animate-pulse" :
                                                                    isToday ? "bg-emerald-500" :
                                                                    login.badge === "recent" ? "bg-sky-500" :
                                                                    login.badge === "older" ? "bg-slate-400" :
                                                                    "bg-slate-300"
                                                                }`} />
                                                                <span className={`text-xs font-bold leading-tight ${
                                                                    isOnline || isToday ? "text-emerald-700" :
                                                                    login.badge === "recent" ? "text-slate-700" :
                                                                    "text-slate-400"
                                                                }`}>
                                                                    {login.text}
                                                                </span>
                                                            </div>
                                                            {login.sub && (
                                                                <span className="text-[10px] text-slate-400 font-medium pl-3.5 mt-0.5">
                                                                    {login.sub}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-5 py-4">
                                                {cuota === 0 ? (
                                                    <span className="text-[11px] text-slate-300">Sin cuota</span>
                                                ) : (
                                                    <div>
                                                        <span className={`text-sm font-black ${disp <= 0 ? "text-rose-600" : disp <= 50 ? "text-amber-500" : "text-emerald-600"}`}>
                                                            {disp}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400"> / {cuota}</span>
                                                        <div className="w-16 bg-slate-100 rounded-full h-1 mt-1">
                                                            <div className={`h-1 rounded-full ${disp<=0?"bg-rose-500":disp<=50?"bg-amber-400":"bg-emerald-500"}`}
                                                                style={{width:`${Math.min(100,Math.round(usadas/cuota*100))}%`}}/>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={()=>openEdit(t)}
                                                        title="Editar información de la clínica (Nombre, NIT, Correo, Dirección)"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all group relative">
                                                        <FiEdit3 size={13}/>
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            Editar Clínica
                                                        </span>
                                                    </button>
                                                    <button onClick={()=>handleResendWelcome(t)}
                                                        disabled={sendingEmailId === t.id}
                                                        title="Reenviar correo oficial de bienvenida (Resend)"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-all disabled:opacity-50 group relative">
                                                        {sendingEmailId === t.id ? (
                                                            <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"/>
                                                        ) : (
                                                            <FiMail size={13}/>
                                                        )}
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            {sendingEmailId === t.id ? "Enviando..." : "Reenviar Bienvenida"}
                                                        </span>
                                                    </button>
                                                    <button onClick={()=>{ setShowChangePwd(t); setPwdForm({ newPassword: "", confirm: "", show: false }); }}
                                                        title="Cambiar contraseña del administrador directamente"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all group relative">
                                                        <FiKey size={13}/>
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            Cambiar Contraseña
                                                        </span>
                                                    </button>
                                                    <button onClick={()=>{ setShowQuickRenew(t); setQuickRenewDuration(t.planDuration || "yearly"); }}
                                                        title="Validar pago y renovar suscripción (+1 Año o +1 Mes)"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-all group relative">
                                                        <FiRepeat size={13}/>
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            Validar Pago y Renovar
                                                        </span>
                                                    </button>
                                                    <button onClick={()=>{setSelectedTenant(t);setNewPlanId(t.planId);setNewDuration(t.planDuration||"monthly");setShowPlan(true);}}
                                                        title="Cambiar plan de suscripción y ciclo"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all group relative">
                                                        <FiSliders size={13}/>
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            Cambiar plan
                                                        </span>
                                                    </button>
                                                    <button onClick={()=>handleGrantFree(t)} disabled={grantingId === t.id}
                                                        title="Regalar 1 mes de servicio gratis"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all disabled:opacity-50 group relative">
                                                        {grantingId === t.id ? (
                                                            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"/>
                                                        ) : (
                                                            <FiGift size={13}/>
                                                        )}
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            {grantingId === t.id ? "Aplicando..." : "Regalar 1 mes"}
                                                        </span>
                                                    </button>
                                                    <button onClick={()=>handleDelete(t.id, t.name)} disabled={processing}
                                                        title="Eliminar clínica permanentemente"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all disabled:opacity-50 group relative">
                                                        <FiTrash2 size={13}/>
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            Eliminar clínica
                                                        </span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-300 text-sm">
                                        {search ? "Sin resultados para esa búsqueda." : "No hay clínicas registradas."}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Detail / Audit drawer ── */}
            {showDetail && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={()=>setShowDetail(null)}/>
                    <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center">
                                    {(showDetail.name||"?")[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{showDetail.name}</p>
                                    <p className="text-[11px] text-slate-400">{showDetail.contactEmail || showDetail.email || "—"}</p>
                                </div>
                            </div>
                            <button onClick={()=>setShowDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><FiX size={16}/></button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label:"Plan",          val: getPlanName(showDetail.planId) },
                                    { label:"Ciclo",         val: showDetail.planDuration === "yearly" ? "Anual" : "Mensual" },
                                    { label:"Estado",        val: showDetail.status === "active" ? "✅ Activo" : "🔴 Inactivo" },
                                    { label:"Vencimiento",   val: fmt(showDetail.subscriptionEndDate) },
                                    { label:"Último Acceso", val: showDetail.lastSignInAt ? fmtDateTime(showDetail.lastSignInAt) : "Sin ingresos" },
                                    { label:"Cuota facturas",val: `${showDetail.facturacionUsadas||0} / ${showDetail.facturacionCuota||0}` },
                                    { label:"Plan fact.",    val: showDetail.facturacionPlan || "—" },
                                ].map((item,i)=>(
                                    <div key={i} className="bg-slate-50 rounded-xl p-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                                        <p className="text-sm font-semibold text-slate-700">{item.val}</p>
                                    </div>
                                ))}
                            </div>

                            {/* ── Sección Acceso del Administrador ── */}
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
                                <p className="text-xs font-black text-amber-700 uppercase tracking-wide flex items-center gap-2">
                                    <FiKey size={13}/> Acceso del Administrador
                                </p>
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Email de acceso (usuario)</p>
                                        {(showDetail.adminEmail || showDetail.contactEmail) ? (
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-slate-800 flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2">
                                                    {showDetail.adminEmail || showDetail.contactEmail}
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(showDetail.adminEmail || showDetail.contactEmail);
                                                        alert("✅ Email copiado al portapapeles");
                                                    }}
                                                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-amber-200 text-amber-600 hover:bg-amber-100 transition-all shrink-0"
                                                    title="Copiar email"
                                                >
                                                    <FiCopy size={13}/>
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No registrado — edita la clínica para agregar el email</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contraseña</p>
                                        <p className="text-xs text-slate-500 italic bg-white border border-amber-200 rounded-lg px-3 py-2">
                                            🔒 Las contraseñas son privadas y encriptadas. No son visibles por nadie.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleResetPassword(showDetail.adminEmail || showDetail.contactEmail)}
                                    disabled={sendingReset}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                        resetSent
                                            ? "bg-emerald-500 text-white"
                                            : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200"
                                    } disabled:opacity-60`}
                                >
                                    {sendingReset ? (
                                        <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/> Enviando...</>
                                    ) : resetSent ? (
                                        <><FiCheck size={13}/> ¡Link enviado!</>
                                    ) : (
                                        <><FiKey size={13}/> Enviar Link de Reset de Contraseña</>
                                    )}
                                </button>
                                <p className="text-[10px] text-amber-600 text-center">
                                    El admin recibirá un email para crear una nueva contraseña.
                                </p>
                            </div>

                            {/* ── Correo Oficial de Bienvenida y Auditoría (Resend) ── */}
                            <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black text-sky-800 uppercase tracking-wide flex items-center gap-2">
                                        <FiMail size={13}/> Correo Oficial de Bienvenida (Resend)
                                    </p>
                                    <button
                                        onClick={() => loadClinicEmailLogs(showDetail.id)}
                                        className="text-[11px] text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1"
                                        title="Actualizar historial de correos"
                                    >
                                        <FiRefreshCw size={11} className={loadingEmailLogs ? "animate-spin" : ""} /> Actualizar
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Envía la plantilla corporativa con remitente <strong>bienvenido@odontocloudcolombia.com</strong> y enlace seguro de un solo uso para establecer contraseña.
                                </p>
                                <button
                                    onClick={() => handleResendWelcome(showDetail)}
                                    disabled={sendingEmailId === showDetail.id}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 transition-all disabled:opacity-60"
                                >
                                    {sendingEmailId === showDetail.id ? (
                                        <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/> Procesando Envío...</>
                                    ) : (
                                        <><FiMail size={13}/> Reenviar Correo de Bienvenida</>
                                    )}
                                </button>

                                {/* Historial de envíos */}
                                <div className="pt-2 border-t border-sky-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                        Historial de Envíos Registrados:
                                    </p>
                                    {loadingEmailLogs ? (
                                        <div className="flex items-center justify-center py-2 text-xs text-slate-400 gap-1.5">
                                            <div className="w-3.5 h-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"/>
                                            Consultando logs...
                                        </div>
                                    ) : clinicEmailLogs.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 italic text-center py-1">
                                            Sin registros de envíos de correo aún.
                                        </p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {clinicEmailLogs.map((log) => (
                                                <div key={log.id} className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                            log.status === "sent" ? "bg-emerald-100 text-emerald-700" :
                                                            log.status === "pending" ? "bg-amber-100 text-amber-700" :
                                                            "bg-rose-100 text-rose-700"
                                                        }`}>
                                                            {log.status === "sent" ? "Enviado" : log.status === "pending" ? "Pendiente" : "Fallido"}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {fmt(log.sent_at || log.created_at)}
                                                        </span>
                                                    </div>
                                                    <p className="font-medium text-slate-700 truncate">{log.recipient_email}</p>
                                                    {log.error_message && (
                                                        <p className="text-[10px] text-rose-600 font-mono truncate" title={log.error_message}>
                                                            Error: {log.error_message}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick actions */}
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={()=>{handleStatusToggle(showDetail.id,showDetail.status);setShowDetail(p=>({...p,status:p.status==="active"?"inactive":"active"}));}}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${showDetail.status==="active"?"bg-amber-50 text-amber-700 hover:bg-amber-100":"bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                                    {showDetail.status==="active"?<FiToggleLeft size={14}/>:<FiToggleRight size={14}/>}
                                    {showDetail.status==="active"?"Suspender":"Activar"}
                                </button>
                                <button onClick={()=>{setSelectedTenant(showDetail);setNewPlanId(showDetail.planId);setNewDuration(showDetail.planDuration||"monthly");setShowPlan(true);}}
                                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all">
                                    <FiSliders size={14}/> Cambiar plan
                                </button>
                                <button onClick={()=>handleGrantFree(showDetail.id)}
                                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all">
                                    <FiGift size={14}/> Regalar 1 mes
                                </button>
                                <button onClick={()=>{ const msg=`Hola ${showDetail.name}, somos OdontoCloud.`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");}}
                                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-all">
                                    <FiMessageSquare size={14}/> WhatsApp
                                </button>
                            </div>

                            {/* Audit log */}
                            <div>
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <FiActivity size={12}/> Actividad reciente
                                </p>
                                {loadingLogs ? (
                                    <div className="flex items-center gap-2 text-slate-400 text-xs py-4"><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>Cargando logs...</div>
                                ) : auditLogs.length === 0 ? (
                                    <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-400 text-center">No hay registros de actividad aún.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {auditLogs.map(log=>(
                                            <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"/>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-slate-700 truncate">{log.action || log.description || "Acción registrada"}</p>
                                                    <p className="text-[10px] text-slate-400">{fmt(log.createdAt)} · {log.user || "Sistema"}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create clinic modal ── */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Registrar nueva clínica</h3>
                            <button onClick={()=>setShowCreate(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><FiX size={16}/></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 grid grid-cols-2 gap-4">
                            <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Datos de la clínica</div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre *</label><input required className={inp} value={newTenant.name} onChange={e=>setNewTenant(p=>({...p,name:e.target.value}))}/></div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email corporativo *</label><input type="email" required className={inp} value={newTenant.contactEmail} onChange={e=>setNewTenant(p=>({...p,contactEmail:e.target.value}))}/></div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NIT / Documento</label><input className={inp} placeholder="Ej: 900123456-7" value={newTenant.nit} onChange={e=>setNewTenant(p=>({...p,nit:e.target.value}))}/></div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ciudad</label><input className={inp} placeholder="Ej: Bogotá" value={newTenant.ciudad} onChange={e=>setNewTenant(p=>({...p,ciudad:e.target.value}))}/></div>
                            <div className="col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección</label><input className={inp} placeholder="Ej: Calle 45 # 12-34" value={newTenant.address} onChange={e=>setNewTenant(p=>({...p,address:e.target.value}))}/></div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plan *</label>
                                <select required className={inp} value={newTenant.planId} onChange={e=>setNewTenant(p=>({...p,planId:e.target.value}))}>
                                    {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ciclo</label>
                                <select className={inp} value={newTenant.planDuration} onChange={e=>setNewTenant(p=>({...p,planDuration:e.target.value}))}>
                                    <option value="monthly">Mensual</option>
                                    <option value="yearly">Anual</option>
                                </select>
                            </div>
                            <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100 mt-2">Administrador de la clínica</div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre completo *</label><input required className={inp} value={newTenant.adminName} onChange={e=>setNewTenant(p=>({...p,adminName:e.target.value}))}/></div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email de acceso *</label><input type="email" required className={inp} value={newTenant.adminEmail} onChange={e=>setNewTenant(p=>({...p,adminEmail:e.target.value}))}/></div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contraseña inicial *</label>
                                <div className="relative">
                                    <input
                                        type={showCreatePwd ? "text" : "password"}
                                        required
                                        minLength={8}
                                        className={inp}
                                        placeholder="Mínimo 8 caracteres"
                                        value={newTenant.adminPassword}
                                        onChange={e=>setNewTenant(p=>({...p,adminPassword:e.target.value}))}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCreatePwd(!showCreatePwd)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        title={showCreatePwd ? "Ocultar contraseña" : "Ver contraseña"}
                                    >
                                        {showCreatePwd ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                                    </button>
                                </div>
                            </div>
                            <div className="col-span-2 flex gap-3 pt-2">
                                <button type="button" onClick={()=>setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
                                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm">Crear clínica</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Plan modal ── */}
            {showPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Cambiar plan / ciclo</h3>
                                <p className="text-xs font-semibold text-indigo-600 truncate max-w-[220px]">{selectedTenant?.name}</p>
                            </div>
                            <button onClick={()=>setShowPlan(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><FiX size={16}/></button>
                        </div>
                        <form onSubmit={handleUpdatePlan} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plan</label>
                                <select required className={inp} value={newPlanId} onChange={e=>setNewPlanId(e.target.value)}>
                                    {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ciclo de Cobro</label>
                                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                                    {["monthly","yearly"].map(d=>(
                                        <button key={d} type="button" onClick={()=>setNewDuration(d)}
                                            className={`flex-1 py-2 text-xs font-semibold transition-all ${newDuration===d?"bg-blue-600 text-white shadow-sm":"bg-white text-slate-500 hover:bg-slate-50"}`}>
                                            {d==="monthly"?"Mensual (30 días)":"Anual (365 días)"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800">
                                <p className="font-semibold flex items-center gap-1.5 mb-0.5">
                                    <FiCheck className="text-blue-600 shrink-0" size={13} />
                                    Reactivación automática
                                </p>
                                <p className="text-[11px] text-blue-600/90 leading-tight">
                                    Al confirmar en ciclo <strong>{newDuration === "yearly" ? "Anual (365 días)" : "Mensual (30 días)"}</strong>, la clínica quedará <strong>Activa</strong> y se renovará la fecha de vencimiento.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={()=>setShowPlan(false)} disabled={updatingPlan} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">Cancelar</button>
                                <button type="submit" disabled={updatingPlan} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-indigo-200">
                                    {updatingPlan ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        "Confirmar cambio"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal de Renovación Rápida tras Validar Pago ── */}
            {showQuickRenew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-6 py-5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                                    <FiRepeat size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">Validar Pago & Renovar</h3>
                                    <p className="text-[11px] text-emerald-100 uppercase tracking-wider font-semibold">OdontoCloud SuperAdmin</p>
                                </div>
                            </div>
                            <button onClick={()=>setShowQuickRenew(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                                <FiX size={16}/>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Información de la clínica */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Clínica a Renovar</span>
                                <h4 className="text-base font-black text-slate-800">{showQuickRenew.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                        Plan: {getPlanName(showQuickRenew.planId)}
                                    </span>
                                    <span>Vence: <strong>{fmt(showQuickRenew.subscriptionEndDate)}</strong></span>
                                </div>
                            </div>

                            {/* Selector de periodo */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                    Selecciona el tiempo pagado a extender:
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={()=>setQuickRenewDuration("yearly")}
                                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                                            quickRenewDuration === "yearly"
                                                ? "border-emerald-600 bg-emerald-50/50 shadow-xs"
                                                : "border-slate-200 hover:border-slate-300 bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black text-slate-800 uppercase">⭐ Anual</span>
                                            {quickRenewDuration === "yearly" && <FiCheck size={14} className="text-emerald-600" />}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-semibold">+365 días</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={()=>setQuickRenewDuration("monthly")}
                                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                                            quickRenewDuration === "monthly"
                                                ? "border-emerald-600 bg-emerald-50/50 shadow-xs"
                                                : "border-slate-200 hover:border-slate-300 bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black text-slate-800 uppercase">⚡ Mensual</span>
                                            {quickRenewDuration === "monthly" && <FiCheck size={14} className="text-emerald-600" />}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-semibold">+30 días</p>
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                                ℹ️ Al confirmar, el sistema sumará el periodo correspondiente a partir de hoy (si estaba vencida) o extenderá la fecha actual (si renovó anticipadamente), reactivará la clínica y a todos sus usuarios.
                            </div>

                            <div className="flex gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={()=>setShowQuickRenew(null)}
                                    disabled={renewing}
                                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteQuickRenew}
                                    disabled={renewing}
                                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0"
                                >
                                    {renewing ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                                            <span>Procesando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FiCheck size={14} />
                                            <span>Confirmar y Extender</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Subscription requests modal ── */}
            {showRequests && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Solicitudes pendientes ({requests.length})</h3>
                            <button onClick={()=>setShowRequests(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><FiX size={16}/></button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                            {requests.length === 0 ? (
                                <p className="text-center text-slate-300 text-sm py-8">No hay solicitudes pendientes.</p>
                            ) : requests.map(req=>(
                                <div key={req.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{req.tenantName}</p>
                                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase">
                                                Plan: {req.requestedPlanName}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400">{fmt(req.createdAt)}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-1 text-xs text-slate-600">
                                        <p>👤 <strong>Solicitante:</strong> {req.adminName || 'Sin especificar'}</p>
                                        <p>✉️ <strong>Email de acceso:</strong> <span className="font-semibold text-blue-600">{req.adminEmail}</span></p>
                                        <p>🔑 <strong>Contraseña elegida:</strong> <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{req.adminPassword}</span></p>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={()=>handleReject(req.id)} className="flex-1 py-2 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all">Rechazar</button>
                                        <button onClick={()=>{ const msg=`Hola ${req.adminName || req.tenantName}, recibimos tu solicitud de demostración para ${req.tenantName}.\n\nTu usuario de acceso es: ${req.adminEmail}`; window.open(`https://wa.me/${req.tenantPhone||""}?text=${encodeURIComponent(msg)}`, "_blank");}}
                                            className="flex-1 py-2 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-all">WhatsApp</button>
                                        <button onClick={()=>handleApprove(req.id)} disabled={processing}
                                            className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all">
                                            {processing?"...":"Aprobar y Activar"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Clinic Modal ── */}
            {showEditTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Editar Datos de Clínica</h3>
                                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{showEditTenant.name}</p>
                            </div>
                            <button onClick={() => setShowEditTenant(null)} className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-all">&times;</button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre de la Clínica *</label>
                                    <input
                                        type="text"
                                        className={inp}
                                        required
                                        value={editForm.name}
                                        onChange={e=>setEditForm({...editForm, name: e.target.value})}
                                        placeholder="Ej: Clínica Dental San José"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NIT / Documento</label>
                                    <input
                                        type="text"
                                        className={inp}
                                        placeholder="Ej: 900123456-7"
                                        value={editForm.nit}
                                        onChange={e=>setEditForm({...editForm, nit: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correo de Contacto</label>
                                    <input
                                        type="email"
                                        className={inp}
                                        placeholder="contacto@clinica.com"
                                        value={editForm.contactEmail}
                                        onChange={e=>setEditForm({...editForm, contactEmail: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección Física</label>
                                    <input
                                        type="text"
                                        className={inp}
                                        placeholder="Ej: Calle 45 # 12-34"
                                        value={editForm.address}
                                        onChange={e=>setEditForm({...editForm, address: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</label>
                                    <input
                                        type="text"
                                        className={inp}
                                        placeholder="Ej: +57 300 123 4567"
                                        value={editForm.telefono}
                                        onChange={e=>setEditForm({...editForm, telefono: e.target.value})}
                                    />
                                </div>

                                {/* ── Acceso del Administrador ── */}
                                <div className="border-t border-slate-100 pt-4 space-y-3">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                                        <FiKey size={11}/> Acceso del Administrador
                                    </p>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email de Acceso (usuario)</label>
                                        <input
                                            type="email"
                                            className={inp}
                                            placeholder="admin@clinica.com"
                                            value={editForm.adminEmail}
                                            onChange={e=>setEditForm({...editForm, adminEmail: e.target.value})}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Correo con el que el administrador inicia sesión en OdontoCloud.</p>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cambiar Contraseña Directamente</label>
                                        <div className="relative">
                                            <input
                                                type={editForm.showPwd ? "text" : "password"}
                                                className={inp}
                                                placeholder="Ingresa una nueva contraseña (mín. 8 caract.)"
                                                value={editForm.newPassword || ""}
                                                onChange={e=>setEditForm({...editForm, newPassword: e.target.value})}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setEditForm(f => ({ ...f, showPwd: !f.showPwd }))}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {editForm.showPwd ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            🔒 Por privacidad y encriptación de Supabase/PostgreSQL, las contraseñas guardadas no pueden verse en texto plano. Escribe una nueva aquí para cambiarla directamente.
                                        </p>
                                    </div>

                                    <div className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-4 space-y-2 mt-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">¿Restablecer mediante Email?</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">Envía un enlace seguro al correo para que el admin elija su propia clave.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleResetPassword(editForm.adminEmail)}
                                                disabled={sendingReset || !editForm.adminEmail}
                                                className="shrink-0 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm shadow-amber-200 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                <FiMail size={13}/>
                                                {sendingReset ? "Enviando..." : "Enviar enlace"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowEditTenant(null)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
                                >
                                    {processing ? "Guardando..." : "Guardar Cambios"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Direct Change Password Modal ── */}
            {showChangePwd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/80">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                                    <FiKey size={16}/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Cambiar Contraseña Directa</h3>
                                    <p className="text-xs font-semibold text-amber-700">{showChangePwd.name}</p>
                                </div>
                            </div>
                            <button onClick={()=>setShowChangePwd(null)} className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-all">&times;</button>
                        </div>

                        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600">
                                <p className="font-bold text-slate-700">Administrador de la clínica:</p>
                                <p className="font-mono text-blue-600 font-bold mt-0.5">{showChangePwd.adminEmail || showChangePwd.contactEmail || "Sin email registrado"}</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nueva Contraseña *</label>
                                <div className="relative">
                                    <input
                                        type={pwdForm.show ? "text" : "password"}
                                        required
                                        minLength={6}
                                        className={inp}
                                        placeholder="Mínimo 8 caracteres"
                                        value={pwdForm.newPassword}
                                        onChange={e=>setPwdForm({...pwdForm, newPassword: e.target.value})}
                                    />
                                    <button
                                        type="button"
                                        onClick={()=>setPwdForm(f=>({...f, show:!f.show}))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {pwdForm.show ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Confirmar Contraseña *</label>
                                <input
                                    type={pwdForm.show ? "text" : "password"}
                                    required
                                    minLength={6}
                                    className={inp}
                                    placeholder="Repite la nueva contraseña"
                                    value={pwdForm.confirm}
                                    onChange={e=>setPwdForm({...pwdForm, confirm: e.target.value})}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={()=>setShowChangePwd(null)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={changingPwd}
                                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-amber-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    <FiKey size={14}/>
                                    {changingPwd ? "Actualizando..." : "Guardar Contraseña"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
