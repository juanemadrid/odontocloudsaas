/**
 * ConfigFacturacionElectronica.jsx
 * Rediseño corporativo compacto e institucional
 */
import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { FiSave, FiInfo, FiFileText, FiZap, FiAlertCircle, FiMapPin } from "react-icons/fi";
import { getSucursalQuota } from "../../services/factusAdminService";

export default function ConfigFacturacionElectronica() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Sucursales list
    const [sucursales, setSucursales] = useState([]);
    const [selectedSucursalId, setSelectedSucursalId] = useState("");

    // Quota info (per sucursal or tenant fallback)
    const [quota, setQuota] = useState(null);

    // DIAN resolution data — per sucursal
    const [dianData, setDianData] = useState({
        dianResolucion: "",
        dianPrefijo: "",
        dianRangoDesde: 1,
        dianRangoHasta: 1000,
        dianClaveTecnica: "",
        dianFechaResolucion: ""
    });

    useEffect(() => {
        if (userProfile?.inquilino) {
            initLoad();
        }
    }, [userProfile]);

    const initLoad = async () => {
        setLoading(true);
        try {
            const qSuc = query(collection(db, "sucursales"), where("inquilino", "==", userProfile.inquilino));
            const snapSuc = await getDocs(qSuc);
            const listSuc = snapSuc.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setSucursales(listSuc);

            const initialSucId = listSuc.length > 0 ? listSuc[0].id : "";
            setSelectedSucursalId(initialSucId);
            await loadSucursalData(initialSucId);
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al cargar sedes");
        } finally {
            setLoading(false);
        }
    };

    const loadSucursalData = async (sucId) => {
        setLoading(true);
        try {
            let sucursalDocData = null;
            let tenantDocData = null;

            const tenantSnap = await getDoc(doc(db, "tenants", userProfile.inquilino));
            if (tenantSnap.exists()) tenantDocData = tenantSnap.data();

            if (sucId) {
                const sucSnap = await getDoc(doc(db, "sucursales", sucId));
                if (sucSnap.exists()) sucursalDocData = sucSnap.data();
            }

            const quotaData = await getSucursalQuota(sucId, userProfile.inquilino);
            setQuota(quotaData);

            const src = sucursalDocData?.dianResolucion ? sucursalDocData : (tenantDocData || {});
            setDianData({
                dianResolucion:      src.dianResolucion      || "",
                dianPrefijo:         src.dianPrefijo         || "",
                dianRangoDesde:      src.dianRangoDesde      || 1,
                dianRangoHasta:      src.dianRangoHasta      || 1000,
                dianClaveTecnica:    src.dianClaveTecnica    || "",
                dianFechaResolucion: src.dianFechaResolucion || "",
            });
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al cargar datos de facturación de la sede");
        } finally {
            setLoading(false);
        }
    };

    const handleSucursalChange = async (e) => {
        const newSucId = e.target.value;
        setSelectedSucursalId(newSucId);
        await loadSucursalData(newSucId);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...dianData,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.uid,
            };

            if (selectedSucursalId) {
                await setDoc(doc(db, "sucursales", selectedSucursalId), payload, { merge: true });
            }

            await setDoc(doc(db, "tenants", userProfile.inquilino), payload, { merge: true });

            if (toast?.success) toast.success("Configuración de facturación electrónica guardada");
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al guardar cambios");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 max-w-4xl mx-auto py-24 text-center text-slate-400 font-medium">
                <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                Cargando parámetros de facturación electrónica...
            </div>
        );
    }

    const pct = quota && quota.facturacionCuota > 0
        ? Math.round((quota.facturacionUsadas / quota.facturacionCuota) * 100)
        : 0;

    const currentSucName = sucursales.find(s => s.id === selectedSucursalId)?.nombre || "Sede General";

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiZap size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Facturación Electrónica DIAN</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Resolución DIAN, prefijos de comprobante y saldo de folios</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    {/* Sede Selector */}
                    {sucursales.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                            <FiMapPin size={13} className="text-blue-600 shrink-0" />
                            <select
                                value={selectedSucursalId}
                                onChange={handleSucursalChange}
                                className="bg-transparent text-[12px] font-bold text-slate-800 outline-none cursor-pointer uppercase"
                            >
                                {sucursales.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre} {s.ciudad ? `(${s.ciudad})` : ""}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        {saving ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={15} />
                        )}
                        <span>Guardar Ajustes</span>
                    </button>
                </div>
            </div>

            {/* Quota Card */}
            <div className={`p-4 rounded-xl border shadow-sm ${
                !quota || quota.facturacionCuota === 0
                    ? "bg-slate-50 border-slate-200"
                    : quota.disponibles <= 0
                        ? "bg-rose-50/50 border-rose-200"
                        : quota.disponibles <= 50
                            ? "bg-amber-50/50 border-amber-200"
                            : "bg-blue-50/40 border-blue-200"
            }`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <FiZap size={16} className={
                            !quota || quota.facturacionCuota === 0 ? "text-slate-400"
                            : quota.disponibles <= 0 ? "text-rose-600"
                            : quota.disponibles <= 50 ? "text-amber-600"
                            : "text-blue-600"
                        }/>
                        <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">
                            Folios de Facturación — <span className="text-blue-600">{currentSucName}</span>
                        </h2>
                    </div>

                    {quota?.isSucursalQuota && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                            Paquete Específico Sede
                        </span>
                    )}
                </div>

                {!quota || quota.facturacionCuota === 0 ? (
                    <div className="flex items-center gap-2 text-[12px] text-slate-500">
                        <FiAlertCircle className="text-slate-400 shrink-0" size={15}/>
                        <span>No hay cuota de facturas electrónicas asignada para <strong>{currentSucName}</strong>.</span>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-3 text-center py-1">
                            <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                                <p className="text-[18px] font-bold text-slate-800">{quota.disponibles.toLocaleString("es-CO")}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase">Disponibles</p>
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                                <p className="text-[18px] font-bold text-slate-600">{quota.facturacionUsadas.toLocaleString("es-CO")}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase">Usadas</p>
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                                <p className="text-[18px] font-bold text-slate-400">{quota.facturacionCuota.toLocaleString("es-CO")}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Plan</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5">
                            <div
                                className={`h-1.5 rounded-full transition-all ${
                                    pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                            <span>{pct}% Consumido</span>
                            <span>Plan: <strong>{quota.facturacionPlan}</strong></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Form Resolution Card */}
            <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiFileText size={15} />
                    </div>
                    <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">
                        Autorización de Numeración DIAN — <span className="text-blue-600">{currentSucName}</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Prefijo de Factura *</label>
                        <input
                            type="text"
                            placeholder="Ej. SETT o FE"
                            value={dianData.dianPrefijo}
                            onChange={e => setDianData(p => ({ ...p, dianPrefijo: e.target.value.toUpperCase() }))}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 uppercase"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Resolución DIAN Nº *</label>
                        <input
                            type="text"
                            placeholder="Número de resolución autorizada por la DIAN"
                            value={dianData.dianResolucion}
                            onChange={e => setDianData(p => ({ ...p, dianResolucion: e.target.value }))}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Fecha de Resolución</label>
                        <input
                            type="date"
                            value={dianData.dianFechaResolucion}
                            onChange={e => setDianData(p => ({ ...p, dianFechaResolucion: e.target.value }))}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">Rango Desde</label>
                            <input
                                type="number"
                                min="1"
                                value={dianData.dianRangoDesde}
                                onChange={e => setDianData(p => ({ ...p, dianRangoDesde: parseInt(e.target.value) || 1 }))}
                                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">Rango Hasta</label>
                            <input
                                type="number"
                                min="1"
                                value={dianData.dianRangoHasta}
                                onChange={e => setDianData(p => ({ ...p, dianRangoHasta: parseInt(e.target.value) || 1000 }))}
                                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Clave Técnica DIAN</label>
                        <input
                            type="text"
                            placeholder="Clave técnica otorgada por la DIAN para facturación electrónica"
                            value={dianData.dianClaveTecnica}
                            onChange={e => setDianData(p => ({ ...p, dianClaveTecnica: e.target.value }))}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 font-mono text-[11px]"
                        />
                    </div>
                </div>
            </form>

            {/* Info Footer Note */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 flex items-start gap-2.5 text-[11px] text-slate-600">
                <FiInfo size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <p>
                    Los parámetros de numeración y prefijos DIAN se aplican a la sede seleccionada. Asegúrese de mantener vigentes las fechas y claves técnicas autorizadas.
                </p>
            </div>
        </div>
    );
}
