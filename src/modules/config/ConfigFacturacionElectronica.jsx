/**
 * ConfigFacturacionElectronica.jsx
 * Rediseño corporativo compacto e institucional
 * FASE P0-FEV1B: Perfiles de Catálogo FEV Salud + Configuración Factus Autoritativa
 */
import React, { useState, useEffect } from "react";
import {
    getConfigItems,
    getConfigSection,
    saveConfigSection,
} from "../../services/configPersistenceService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
    FiSave,
    FiInfo,
    FiFileText,
    FiZap,
    FiAlertCircle,
    FiMapPin,
    FiActivity,
    FiShield,
    FiCheckCircle,
} from "react-icons/fi";
import { getSucursalQuota } from "../../services/factusAdminService";
import { getFactusRanges, testFactusCredentials } from "../../services/factusProxyService";
import {
    FACTUS_HEALTH_CATALOG_PROFILE_METADATA,
    FACTUS_HEALTH_COVERAGE_CATALOG,
    FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG,
    getHealthPaymentCatalogForProfile,
    filterActiveSalesInvoiceRanges,
} from "../../services/factusHealthPayloadBuilder";

const EMPTY_DIAN_DATA = {
    dianResolucion: "",
    dianPrefijo: "",
    dianRangoDesde: 1,
    dianRangoHasta: 1000,
    dianClaveTecnica: "",
    dianFechaResolucion: "",
    dianVigenciaHasta: "",
    // FEV Salud autoritativo (P0-FEV1B)
    factus_health_catalog_profile: "SHARED_SANDBOX_LEGACY_4",
    numbering_range_id: "",
    provider_code: "",
    health_payment_method_code: "04",
    coverage_code: "15",
    contract_mode: "without_contract",
    contract_number: "",
    without_contract_code: "05",
    // Modo de generación de facturas electrónicas
    modo_generacion: "manual", // 'manual' | 'automatico'
    emitir_inmediatamente_dian: false,
};

export default function ConfigFacturacionElectronica() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const tenantId = userProfile?.inquilino;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [sucursales, setSucursales] = useState([]);
    const [selectedSucursalId, setSelectedSucursalId] = useState("");
    const [quota, setQuota] = useState(null);
    const [billingConfig, setBillingConfig] = useState({});
    const [dianData, setDianData] = useState(EMPTY_DIAN_DATA);
    const [factusRanges, setFactusRanges] = useState([]);

    const getSavedDianData = (sucId, config = billingConfig) => {
        const key = sucId || "general";
        return config?.por_sucursal?.[key] || config?.general || EMPTY_DIAN_DATA;
    };

    const loadSucursalData = async (sucId, config = billingConfig, loadedRanges = factusRanges) => {
        setLoading(true);
        try {
            const [quotaData, companyCfg] = await Promise.all([
                getSucursalQuota(sucId, tenantId),
                getConfigSection(tenantId, "empresa_datos", {}),
            ]);
            setQuota(quotaData);

            const saved = getSavedDianData(sucId, config);
            const repsDefault = companyCfg?.reps || companyCfg?.codigoPrestador || "";
            const initialData = {
                ...EMPTY_DIAN_DATA,
                ...saved,
                provider_code: saved.provider_code || repsDefault,
                numbering_range_id: saved.numbering_range_id || quotaData.factusNumberingRangeId || "",
                modo_generacion: saved.modo_generacion || "manual",
                emitir_inmediatamente_dian: Boolean(saved.emitir_inmediatamente_dian),
            };

            // Si hay un rango seleccionado en Factus, sincronizar metadatos autoritativos
            if (initialData.numbering_range_id && Array.isArray(loadedRanges) && loadedRanges.length > 0) {
                const match = loadedRanges.find(r => String(r.id) === String(initialData.numbering_range_id));
                if (match) {
                    initialData.dianPrefijo = match.prefix || initialData.dianPrefijo;
                    initialData.dianResolucion = match.resolution_number || initialData.dianResolucion;
                    initialData.dianRangoDesde = match.from || initialData.dianRangoDesde;
                    initialData.dianRangoHasta = match.to || initialData.dianRangoHasta;
                    initialData.dianFechaResolucion = match.start_date || initialData.dianFechaResolucion;
                    initialData.dianVigenciaHasta = match.end_date || initialData.dianVigenciaHasta;
                    if (match.technical_key) initialData.dianClaveTecnica = match.technical_key;
                }
            }

            setDianData(initialData);
        } catch (error) {
            console.error(error);
            if (toast?.error) toast.error("Error al cargar datos de facturación de la sede");
        } finally {
            setLoading(false);
        }
    };

    const initLoad = async () => {
        setLoading(true);
        try {
            const [savedBranches, savedBillingConfig] = await Promise.all([
                getConfigItems(tenantId, "sucursales", "sucursales"),
                getConfigSection(tenantId, "facturacion_electronica", {})
            ]);

            let activeRanges = [];
            try {
                const rawRanges = await getFactusRanges();
                activeRanges = filterActiveSalesInvoiceRanges(rawRanges);
            } catch (errRanges) {
                console.warn("No se pudieron cargar rangos autoritativos de Factus:", errRanges?.message);
            }
            setFactusRanges(activeRanges);

            const list = [...savedBranches].sort(
                (a, b) => (a.nombre || "").localeCompare(b.nombre || "")
            );
            const config = savedBillingConfig || {};
            const initialSucursalId = list[0]?.id || "";

            setSucursales(list);
            setBillingConfig(config);
            setSelectedSucursalId(initialSucursalId);
            await loadSucursalData(initialSucursalId, config, activeRanges);
        } catch (error) {
            console.error(error);
            if (toast?.error) toast.error("Error al cargar la configuración de facturación");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tenantId) initLoad();
    }, [tenantId]);

    const handleSucursalChange = async (event) => {
        const newSucursalId = event.target.value;
        setSelectedSucursalId(newSucursalId);
        await loadSucursalData(newSucursalId);
    };

    const handleRangeSelect = (rangeId) => {
        const selected = factusRanges.find(r => String(r.id) === String(rangeId));
        if (!selected) {
            setDianData(p => ({ ...p, numbering_range_id: "" }));
            return;
        }
        setDianData(p => ({
            ...p,
            numbering_range_id: selected.id,
            dianPrefijo: selected.prefix || "",
            dianResolucion: selected.resolution_number || "",
            dianRangoDesde: selected.from || 1,
            dianRangoHasta: selected.to || 1000,
            dianFechaResolucion: selected.start_date || "",
            dianVigenciaHasta: selected.end_date || "",
            dianClaveTecnica: selected.technical_key || p.dianClaveTecnica || "",
        }));
    };

    const handleProfileChange = (newProfile) => {
        let validCodes = [];
        try {
            const cat = getHealthPaymentCatalogForProfile(newProfile);
            validCodes = Object.keys(cat);
        } catch {
            validCodes = ["04"];
        }

        let nextCode = dianData.health_payment_method_code;
        if (!validCodes.includes(nextCode)) {
            nextCode = validCodes.includes("04") ? "04" : validCodes[0];
        }

        setDianData(p => ({
            ...p,
            factus_health_catalog_profile: newProfile,
            health_payment_method_code: nextCode,
        }));
    };

    const handleSave = async (event) => {
        if (event) event.preventDefault();
        if (Number(dianData.dianRangoHasta) < Number(dianData.dianRangoDesde)) {
            if (toast?.warning) toast.warning("El rango final no puede ser menor que el rango inicial.");
            return;
        }

        setSaving(true);
        try {
            const key = selectedSucursalId || "general";
            const storedData = {
                ...dianData,
                updated_at: new Date().toISOString(),
                updated_by: userProfile.uid || userProfile.id
            };
            const updatedConfig = {
                ...billingConfig,
                general: storedData,
                por_sucursal: {
                    ...(billingConfig?.por_sucursal || {}),
                    [key]: storedData
                }
            };

            await saveConfigSection(tenantId, "facturacion_electronica", updatedConfig);
            setBillingConfig(updatedConfig);
            if (toast?.success) toast.success("Configuración de facturación electrónica guardada con éxito");
        } catch (error) {
            console.error(error);
            if (toast?.error) toast.error("Error al guardar cambios: " + (error.message || ""));
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            await testFactusCredentials({});
            const refreshedQuota = await getSucursalQuota(selectedSucursalId, tenantId);
            setQuota(refreshedQuota);

            // Actualizar rangos autoritativos de Factus
            try {
                const rawRanges = await getFactusRanges();
                const activeRanges = filterActiveSalesInvoiceRanges(rawRanges);
                setFactusRanges(activeRanges);
            } catch (errRanges) {
                console.warn("No se pudieron refrescar los rangos de Factus:", errRanges);
            }

            if (toast?.success) toast.success("Conexión con Factus verificada correctamente.");
        } catch (error) {
            console.error(error);
            if (toast?.error) toast.error(error.message || "No fue posible conectar con Factus.");
        } finally {
            setTesting(false);
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

    // Catálogo activo para la modalidad de pago según perfil seleccionado
    let activePaymentCatalog = {};
    try {
        activePaymentCatalog = getHealthPaymentCatalogForProfile(
            dianData.factus_health_catalog_profile || "SHARED_SANDBOX_LEGACY_4"
        );
    } catch {
        activePaymentCatalog = { "04": "Pago por evento" };
    }

    const selectedRangeObj = factusRanges.find(r => String(r.id) === String(dianData.numbering_range_id));

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiZap size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Facturación Electrónica DIAN & Salud</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Rangos autoritativos Factus, sector salud FEV-RIPS y cuota de folios</p>
                        <p className={`text-[10px] font-bold mt-0.5 ${quota?.configured ? "text-emerald-600" : "text-amber-600"}`}>
                            {quota?.configured
                                ? `Factus conectado · ${quota.factusTestMode ? "Ambiente de pruebas (Sandbox)" : "Producción"}`
                                : "Factus todavía no tiene credenciales completas"}
                        </p>
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
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testing || !quota?.configured}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FiZap size={14} />
                        <span>{testing ? "Probando..." : "Probar Factus"}</span>
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
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

            {/* SECCIÓN 1: RANGO DE NUMERACIÓN FACTUS AUTORITATIVO */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                            <FiFileText size={15} />
                        </div>
                        <div>
                            <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">
                                Rango de Numeración Factus Autoritativo — <span className="text-indigo-600">{currentSucName}</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Fuente legal directa de Factus / DIAN. El sistema no genera consecutivos manuales ni locales.
                            </p>
                        </div>
                    </div>
                    {selectedRangeObj && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <FiShield size={13} /> Rango Activo en Factus
                        </span>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                            Seleccionar Rango Activo de Factura de Venta *
                        </label>
                        <select
                            value={dianData.numbering_range_id || ""}
                            onChange={e => handleRangeSelect(e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="">-- Seleccionar Rango Autorizado de Factus --</option>
                            {factusRanges.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.prefix} (Res. {r.resolution_number || "Sin número"} · {r.from} a {r.to} · Vigencia: {r.end_date || "N/A"})
                                </option>
                            ))}
                        </select>
                        {factusRanges.length === 0 && (
                            <p className="text-[10px] text-amber-600 font-medium">
                                No se encontraron rangos activos de Factura de Venta devueltos por Factus. Presione "Probar Factus" arriba para verificar credenciales.
                            </p>
                        )}
                    </div>

                    {/* Resumen autoritativo visible para el usuario */}
                    {dianData.numbering_range_id && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Prefijo</span>
                                <span className="font-mono font-bold text-slate-800 text-[12px]">{dianData.dianPrefijo || "—"}</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Resolución DIAN</span>
                                <span className="font-mono font-bold text-slate-800 text-[12px]">{dianData.dianResolucion || "—"}</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Rango Autorizado</span>
                                <span className="font-mono font-bold text-slate-800 text-[12px]">
                                    {dianData.dianRangoDesde} a {dianData.dianRangoHasta}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Vigencia</span>
                                <span className="font-medium text-slate-700 text-[12px]">
                                    {dianData.dianFechaResolucion || "—"} al {dianData.dianVigenciaHasta || "—"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 2: FACTURACIÓN ELECTRÓNICA SECTOR SALUD (FEV-RIPS SS-CUFE) */}
            <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-50 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                            <FiActivity size={15} />
                        </div>
                        <div>
                            <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">
                                Facturación Electrónica Sector Salud — <span className="text-indigo-600">MinSalud FEV-RIPS SS-CUFE</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Configuración contractual autoritativa requerida por la Resolución 2275 de 2023 / 0948 de 2026.
                            </p>
                        </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        SS-CUFE
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Ambiente Factus */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Ambiente Factus Activo</label>
                        <div className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 flex items-center justify-between">
                            <span>{quota?.factusTestMode ? "Ambiente de pruebas (Sandbox)" : "Ambiente de Producción"}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                                {quota?.factusTestMode ? "SANDBOX" : "PRODUCCIÓN"}
                            </span>
                        </div>
                    </div>

                    {/* Perfil de Catálogo de Modalidad Factus */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                            Catálogo de Factus (Perfil de Modalidad) *
                        </label>
                        <select
                            value={dianData.factus_health_catalog_profile || "SHARED_SANDBOX_LEGACY_4"}
                            onChange={e => handleProfileChange(e.target.value)}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            {Object.entries(FACTUS_HEALTH_CATALOG_PROFILE_METADATA).map(([key, meta]) => (
                                <option key={key} value={key}>
                                    {meta.nombreVisible}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400">
                            {FACTUS_HEALTH_CATALOG_PROFILE_METADATA[dianData.factus_health_catalog_profile]?.descripcion || ""}
                        </p>
                    </div>

                    {/* Código Prestador REPS */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                            Código de Prestador de Salud (REPS) *
                        </label>
                        <input
                            type="text"
                            placeholder="Ej. 110010000001 (12 dígitos numéricos)"
                            value={dianData.provider_code || ""}
                            onChange={e => setDianData(p => ({ ...p, provider_code: e.target.value.trim() }))}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-mono font-bold text-slate-800 outline-none focus:border-indigo-500"
                        />
                        <p className="text-[10px] text-slate-400">Código oficial asignado por el Ministerio de Salud / SISPRO</p>
                    </div>

                    {/* Modalidad de Pago por Defecto (Dinámica según catálogo activo) */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                            Modalidad de Pago por Defecto *
                        </label>
                        <select
                            value={dianData.health_payment_method_code || "04"}
                            onChange={e => setDianData(p => ({ ...p, health_payment_method_code: e.target.value }))}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            {Object.entries(activePaymentCatalog).map(([code, desc]) => (
                                <option key={code} value={code}>
                                    {code} — {desc}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400">Determinado por el catálogo activo de Factus para el perfil configurado</p>
                    </div>

                    {/* Cobertura en Salud por Defecto */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                            Cobertura en Salud por Defecto *
                        </label>
                        <select
                            value={dianData.coverage_code || "15"}
                            onChange={e => setDianData(p => ({ ...p, coverage_code: e.target.value }))}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            {Object.entries(FACTUS_HEALTH_COVERAGE_CATALOG).map(([code, desc]) => (
                                <option key={code} value={code}>
                                    {code} — {desc}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400">15 = Particular (catálogo oficial Factus V2 / MinSalud)</p>
                    </div>

                    {/* Contrato vs Sin Contrato */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Régimen Contractual Predeterminado</label>
                        <div className="flex items-center gap-3 h-8">
                            <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="contract_mode"
                                    checked={dianData.contract_mode !== "contract"}
                                    onChange={() => setDianData(p => ({ ...p, contract_mode: "without_contract" }))}
                                />
                                Sin Contrato (Particular)
                            </label>
                            <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="contract_mode"
                                    checked={dianData.contract_mode === "contract"}
                                    onChange={() => setDianData(p => ({ ...p, contract_mode: "contract" }))}
                                />
                                Con Contrato / Convenio
                            </label>
                        </div>

                        {dianData.contract_mode === "contract" ? (
                            <input
                                type="text"
                                placeholder="Número de contrato o convenio (ej. CONV-2026-01)"
                                value={dianData.contract_number || ""}
                                onChange={e => setDianData(p => ({ ...p, contract_number: e.target.value }))}
                                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:border-indigo-500 mt-1"
                            />
                        ) : (
                            <select
                                value={dianData.without_contract_code || "05"}
                                onChange={e => setDianData(p => ({ ...p, without_contract_code: e.target.value }))}
                                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:border-indigo-500 mt-1 cursor-pointer"
                            >
                                {Object.entries(FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG).map(([code, desc]) => (
                                    <option key={code} value={code}>
                                        {code} — {desc}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 3: MODO DE GENERACIÓN DE FACTURAS ELECTRÓNICAS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <FiCheckCircle size={15} />
                        </div>
                        <div>
                            <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">
                                Modo de Generación de Facturas Electrónicas — <span className="text-emerald-600">{currentSucName}</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Define si las facturas de venta oficiales se crean bajo demanda manual o se automatizan por atención clínica y pago.
                            </p>
                        </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        dianData.modo_generacion === "automatico" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}>
                        {dianData.modo_generacion === "automatico" ? "Automático (Realizado + Pagado)" : "Manual (Bajo demanda)"}
                    </span>
                </div>

                <div className="space-y-3">
                    {/* Selector de Modo: Manual vs Automático */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Opción 1: Manual */}
                        <label 
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                                dianData.modo_generacion !== "automatico"
                                    ? "bg-blue-50/40 border-blue-300 ring-1 ring-blue-300"
                                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                            }`}
                        >
                            <input 
                                type="radio" 
                                name="modo_generacion"
                                value="manual"
                                checked={dianData.modo_generacion !== "automatico"}
                                onChange={() => setDianData(p => ({ ...p, modo_generacion: "manual" }))}
                                className="mt-0.5 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="space-y-0.5">
                                <span className="text-[12px] font-bold text-slate-800 block">
                                    Modo Manual (Bajo demanda)
                                </span>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Recepción o facturación genera y emite cada factura manualmente desde el plan de tratamiento o el módulo de facturación cuando lo considere necesario.
                                </p>
                            </div>
                        </label>

                        {/* Opción 2: Automático */}
                        <label 
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                                dianData.modo_generacion === "automatico"
                                    ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300"
                                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                            }`}
                        >
                            <input 
                                type="radio" 
                                name="modo_generacion"
                                value="automatico"
                                checked={dianData.modo_generacion === "automatico"}
                                onChange={() => setDianData(p => ({ ...p, modo_generacion: "automatico" }))}
                                className="mt-0.5 w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div className="space-y-0.5">
                                <span className="text-[12px] font-bold text-slate-800 block">
                                    Modo Automático (Realizado + Pagado)
                                </span>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    El sistema genera la factura automáticamente cuando el doctor marca los procedimientos como <strong>Realizados</strong> y el paciente ha <strong>cancelado el valor en caja</strong>.
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Sub-opción condicional: Emitir inmediatamente a la DIAN vs Borrador (0 folios) */}
                    {dianData.modo_generacion === "automatico" && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in duration-200">
                            <label className="flex items-start gap-2.5 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={Boolean(dianData.emitir_inmediatamente_dian)}
                                    onChange={e => setDianData(p => ({ ...p, emitir_inmediatamente_dian: e.target.checked }))}
                                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div>
                                    <span className="text-[12px] font-bold text-slate-800">
                                        Emitir inmediatamente ante la DIAN
                                    </span>
                                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                                        {dianData.emitir_inmediatamente_dian ? (
                                            <span className="text-emerald-700 font-semibold">
                                                ✓ La factura se firmará y transmitirá a la DIAN en tiempo real (consume 1 folio de tu cuota de inmediato).
                                            </span>
                                        ) : (
                                            <span className="text-slate-600">
                                                (Recomendado) <strong>Desmarcado:</strong> Se genera en estado <strong>Borrador lista para emitir (0 folios consumidos)</strong>. Podrás verificarla visualmente y emitirla formalmente a la DIAN con un solo clic.
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Footer Note */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 flex items-start gap-2.5 text-[11px] text-slate-600">
                <FiInfo size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <p>
                    Los parámetros de numeración y facturación en salud se almacenan por sede en la configuración institucional.
                    El rango de numeración es provisto de manera autoritativa por Factus / DIAN.
                </p>
            </div>
        </div>
    );
}
