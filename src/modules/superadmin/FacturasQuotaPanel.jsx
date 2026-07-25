import React, { useState, useEffect } from "react";
import supabase from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext";
import factusService from "../../services/factusService";
import { getTenants } from "../../services/adminService";
import { saveClinicFactusConfig } from "../../services/factusAdminService";
import {
  FiSave, FiZap, FiPlus, FiRefreshCw, FiEye, FiEyeOff,
  FiFileText, FiAlertCircle, FiCheckCircle, FiMapPin, FiSettings, FiLock, FiCheck
} from "react-icons/fi";

const PLAN_PRESETS = [
  { label: "Paquete Pequeño — 100 facturas",  cuota: 100,  plan: "básico" },
  { label: "Paquete Estándar — 400 facturas", cuota: 400,  plan: "estándar" },
  { label: "Paquete Profesional — 600 facturas", cuota: 600, plan: "profesional" },
  { label: "Paquete IPS — 1200 facturas",      cuota: 1200, plan: "premium" },
  { label: "Personalizado",                   cuota: 0,    plan: "personalizado" },
];

const inp = "w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all";

export default function FacturasQuotaPanel() {
  const toast = useToast();

  // ── Tenants & sucursales list ──
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Modal state for Clinic Factus & Quota configuration ──
  const [configModal, setConfigModal] = useState(null); // { tenantId, sucursalId, nombre }
  const [modalForm, setModalForm] = useState({
    facturacionCuota: 400,
    facturacionPlan: "estándar",
    isCustomCuota: false,
    factusClientId: "",
    factusClientSecret: "",
    factusUsername: "",
    factusPassword: "",
    factusNumberingRangeId: "",
    factusTestMode: true,
  });

  const [showSecret, setShowSecret] = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);

  // ─────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await getTenants();
      const list = (data || []).map(t => {
        const cuota = t.facturacionCuota || 0;
        const usadas = t.facturacionUsadas || 0;
        return {
          id: t.id,
          nombre: t.name || t.nombre || "Clínica Dental",
          nit: t.nit || "Sin NIT",
          facturacionCuota: cuota,
          facturacionUsadas: usadas,
          facturacionPlan: t.planId || "Sin plan",
          disponibles: Math.max(0, cuota - usadas),
          hasFactusCreds: Boolean(t.hasFactusCreds),
          factusClientId: t.factusClientId || "",
          factusClientSecret: t.factusClientSecret || "",
          factusUsername: t.factusUsername || "",
          factusPassword: t.factusPassword || "",
          factusNumberingRangeId: t.factusNumberingRangeId || "",
          factusTestMode: t.factusTestMode ?? true,
          sucursales: [],
        };
      });
      setTenants(list);
    } catch (e) {
      console.error(e);
      toast.error("Error cargando clínicas desde Supabase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ─────────────────────────────────────────
  const openModalForClinic = (item, isSucursal = false, parentTenant = null) => {
    const isCustom = !PLAN_PRESETS.some(p => p.cuota === item.facturacionCuota);
    setModalForm({
      facturacionCuota: item.facturacionCuota || 400,
      facturacionPlan: item.facturacionPlan || "estándar",
      isCustomCuota: isCustom,
      factusClientId: item.factusClientId || "",
      factusClientSecret: item.factusClientSecret || "",
      factusUsername: item.factusUsername || "",
      factusPassword: item.factusPassword || "",
      factusNumberingRangeId: item.factusNumberingRangeId || "",
      factusTestMode: item.factusTestMode ?? true,
    });
    setConfigModal({
      tenantId: isSucursal ? parentTenant.id : item.id,
      sucursalId: isSucursal ? item.id : null,
      nombre: isSucursal ? `${parentTenant.nombre} — Sede ${item.nombre}` : item.nombre,
      isSucursal,
    });
    setShowSecret(false);
    setShowPass(false);
  };

  // ─────────────────────────────────────────
  const handleTestConnection = async () => {
    if (!modalForm.factusClientId || !modalForm.factusClientSecret) {
      toast.error("Ingresa Client ID y Client Secret para probar conexión.");
      return;
    }
    setTesting(true);
    try {
      await factusService.testConnection({
        factusClientId:     modalForm.factusClientId,
        factusClientSecret: modalForm.factusClientSecret,
        factusUsername:     modalForm.factusUsername,
        factusPassword:     modalForm.factusPassword,
        factusTestMode:     modalForm.factusTestMode,
      });
      toast.success("¡Conexión exitosa! Las credenciales de Factus son válidas.");
    } catch (e) {
      toast.error(`Error de conexión: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  // ─────────────────────────────────────────
  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!configModal) return;

    setSaving(true);
    try {
      const payload = {
        facturacionCuota: Number(modalForm.facturacionCuota) || 0,
        facturacionPlan: modalForm.facturacionPlan,
        factusClientId: modalForm.factusClientId.trim(),
        factusClientSecret: modalForm.factusClientSecret.trim(),
        factusUsername: modalForm.factusUsername.trim(),
        factusPassword: modalForm.factusPassword.trim(),
        factusNumberingRangeId: modalForm.factusNumberingRangeId.trim(),
        factusTestMode: modalForm.factusTestMode,
      };

      await saveClinicFactusConfig(configModal.tenantId, payload);

      toast.success(`Facturación electrónica configurada con éxito para ${configModal.nombre}`);
      setConfigModal(null);
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error(`Error al guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const totalClinics = tenants.length;
  const configuredClinics = tenants.filter(t => t.hasFactusCreds || t.sucursales.some(s => s.hasFactusCreds)).length;

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-6xl mx-auto animate-fadeIn">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200">
            <FiZap size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Facturación Electrónica por Clínica</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Gestión independiente de paquetes y credenciales API Factus
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 px-5 py-2.5 bg-slate-50 border border-slate-200/60 rounded-2xl">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Clínicas</p>
              <p className="text-xl font-black text-slate-800">{totalClinics}</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Configuradas Factus</p>
              <p className="text-xl font-black text-emerald-600">{configuredClinics}</p>
            </div>
          </div>

          <button onClick={loadAll} className="w-10 h-10 flex items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-blue-300 transition-all shadow-sm">
            <FiRefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Clinics Table ── */}
      <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 gap-2">
          <div className="flex items-center gap-2.5">
            <FiFileText size={16} className="text-blue-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Clínicas Registradas en el Sistema
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Haz clic en "Configurar API & Facturas" para gestionar la sede
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400 animate-pulse">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
            <span className="text-xs font-bold uppercase tracking-widest">Cargando clínicas...</span>
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {["Clínica / Sede", "NIT", "Estado Factus", "Plan", "Cuota", "Usadas", "Disponibles", "Acción"].map((h, i) => (
                    <th key={i} className="px-3.5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map(t => (
                  <React.Fragment key={t.id}>
                    {/* Parent Clinic Row */}
                    <tr className="hover:bg-slate-50/60 transition-colors group text-xs">
                      <td className="px-3.5 py-2.5 font-black text-slate-800 uppercase tracking-tight">
                        <div className="flex items-center gap-1.5">
                          <span>{t.nombre}</span>
                          {t.sucursales?.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-blue-100 text-blue-700 uppercase">
                              {t.sucursales.length} sedes
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap">{t.nit}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {t.hasFactusCreds ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase">
                            <FiCheckCircle size={10} className="text-emerald-600" /> API Lista
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200/60 uppercase">
                            <FiAlertCircle size={10} className="text-amber-600" /> Sin Credenciales
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase">
                          {t.facturacionPlan}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 text-xs whitespace-nowrap">{t.facturacionCuota.toLocaleString("es-CO")}</td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-500 text-xs whitespace-nowrap">{t.facturacionUsadas.toLocaleString("es-CO")}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className={`font-black text-xs ${t.disponibles <= 0 ? "text-rose-600" : t.disponibles <= 50 ? "text-amber-500" : "text-emerald-600"}`}>
                          {t.disponibles.toLocaleString("es-CO")}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <button
                          onClick={() => openModalForClinic(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                        >
                          <FiSettings size={12} /> Configurar API & Facturas
                        </button>
                      </td>
                    </tr>

                    {/* Sub-rows for Sucursales */}
                    {t.sucursales && t.sucursales.map(s => (
                      <tr key={s.id} className="bg-slate-50/30 hover:bg-blue-50/30 transition-colors text-xs">
                        <td className="pl-8 pr-3.5 py-2 text-[11px] font-bold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
                          <FiMapPin size={11} className="text-blue-500 shrink-0" />
                          <span>Sede: {s.nombre} {s.ciudad ? `(${s.ciudad})` : ""}</span>
                        </td>
                        <td className="px-3.5 py-2 text-[10px] font-mono text-slate-400 whitespace-nowrap">Sucursal</td>
                        <td className="px-3.5 py-2 whitespace-nowrap">
                          {s.hasFactusCreds ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">
                              <FiCheckCircle size={9} /> API Sede Configurada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-slate-100 text-slate-500 uppercase">
                              Usa Cuenta Principal
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-indigo-50 text-indigo-600 uppercase">
                            {s.facturacionPlan}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 font-semibold text-slate-700 text-[11px] whitespace-nowrap">{s.facturacionCuota.toLocaleString("es-CO")}</td>
                        <td className="px-3.5 py-2 text-slate-500 text-[11px] whitespace-nowrap">{s.facturacionUsadas.toLocaleString("es-CO")}</td>
                        <td className="px-3.5 py-2 font-bold text-[11px] text-emerald-600 whitespace-nowrap">{s.disponibles.toLocaleString("es-CO")}</td>
                        <td className="px-3.5 py-2 whitespace-nowrap">
                          <button
                            onClick={() => openModalForClinic(s, true, t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase transition-all"
                          >
                            <FiSettings size={11} /> Configurar Sede
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}

                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-8 py-16 text-center text-slate-400 text-sm font-semibold">
                      No hay clínicas registradas en el sistema.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Configuration Modal (API Keys + Invoice Package) ── */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-8 py-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <FiSettings size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Facturación Electrónica Factus</h3>
                  <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mt-0.5">
                    {configModal.nombre}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigModal(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveModal} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Sección 1: Paquete de Facturas */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <FiZap className="text-blue-600" size={18} />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    1. Paquete de Facturas Asignado
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PLAN_PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        if (p.plan === "personalizado") {
                          setModalForm(prev => ({ ...prev, isCustomCuota: true, facturacionPlan: "personalizado", facturacionCuota: prev.facturacionCuota || "" }));
                        } else {
                          setModalForm(prev => ({ ...prev, facturacionCuota: p.cuota, facturacionPlan: p.plan, isCustomCuota: false }));
                        }
                      }}
                      className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                        (modalForm.facturacionPlan === p.plan && !modalForm.isCustomCuota) || (modalForm.isCustomCuota && p.plan === "personalizado")
                          ? "border-blue-600 bg-blue-50/80 text-blue-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span>{p.label}</span>
                      {((modalForm.facturacionPlan === p.plan && !modalForm.isCustomCuota) || (modalForm.isCustomCuota && p.plan === "personalizado")) && (
                        <FiCheck className="text-blue-600" size={16} />
                      )}
                    </button>
                  ))}
                </div>

                {modalForm.isCustomCuota && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Cantidad de Facturas del Paquete
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={modalForm.facturacionCuota === 0 || modalForm.facturacionCuota === "" ? "" : Number(modalForm.facturacionCuota).toLocaleString("es-CO")}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setModalForm(prev => ({ ...prev, facturacionCuota: raw === "" ? "" : Number(raw) }));
                      }}
                      className={inp}
                      placeholder="Ej: 400"
                    />
                  </div>
                )}
              </div>

              {/* Sección 2: Credenciales Factus API */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <FiLock className="text-indigo-600" size={18} />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      2. Credenciales API de Factus (Entregadas por Factus para esta clínica)
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Client ID Factus *
                    </label>
                    <input
                      value={modalForm.factusClientId}
                      onChange={e => setModalForm(prev => ({ ...prev, factusClientId: e.target.value }))}
                      className={inp}
                      placeholder="Ej: a249df34-772b-461d-a9eb-2bb4f95ad511"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Client Secret Factus *
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? "text" : "password"}
                        value={modalForm.factusClientSecret}
                        onChange={e => setModalForm(prev => ({ ...prev, factusClientSecret: e.target.value }))}
                        className={inp + " pr-10"}
                        placeholder="Client Secret"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showSecret ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Usuario / Email API *
                    </label>
                    <input
                      value={modalForm.factusUsername}
                      onChange={e => setModalForm(prev => ({ ...prev, factusUsername: e.target.value }))}
                      className={inp}
                      placeholder="sandboxv2@factus.com.co"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Contraseña API *
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={modalForm.factusPassword}
                        onChange={e => setModalForm(prev => ({ ...prev, factusPassword: e.target.value }))}
                        className={inp + " pr-10"}
                        placeholder="Contraseña Factus API"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      ID Rango Numeración Factus
                    </label>
                    <input
                      value={modalForm.factusNumberingRangeId}
                      onChange={e => setModalForm(prev => ({ ...prev, factusNumberingRangeId: e.target.value }))}
                      className={inp}
                      placeholder="Ej: 8"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={modalForm.factusTestMode}
                        onChange={e => setModalForm(prev => ({ ...prev, factusTestMode: e.target.checked }))}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-700">Modo Pruebas (Sandbox)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {testing ? <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"/> : <FiZap size={15} className="text-blue-600" />}
                  Probar Conexión Factus
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfigModal(null)}
                    className="px-6 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 active:scale-95"
                  >
                    {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <FiSave size={16} />}
                    Guardar Configuración
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

