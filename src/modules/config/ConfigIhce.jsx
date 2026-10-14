import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Building2, 
  Key, 
  Lock, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Activity, 
  Clock, 
  AlertTriangle,
  Send,
  HelpCircle,
  FileText
} from "lucide-react";
import { ihceClientService } from "../../services/ihce/ihceClientService.js";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import IhceOutboxTable from "../../components/ihce/IhceOutboxTable.jsx";
import BreakGlassManager from "../../components/ihce/BreakGlassManager.jsx";

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ConfigIhce({ tenantId, tenantName, onClose } = {}) {
  const { userProfile } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("config");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [formData, setFormData] = useState({
    codigo_habilitacion_reps: "",
    codigo_sede_reps: "01",
    codigo_servicio_reps: "334",
    nombre_prestador: "",
    nit: "",
    ambiente: "SANDBOX_MOCK",
    client_id: "",
    tenant_id_auth: "",
    scope: "https://sandbox.ihcecol.gov.co/.default",
    client_secret: "",
    apim_subscription_key: "",
    api_fhir_endpoint: "https://sandbox.ihcecol.gov.co/ihce",
    is_active: false,
    auto_dispatch_enabled: true
  });

  const [hasStoredSecret, setHasStoredSecret] = useState(false);
  const [hasStoredApimKey, setHasStoredApimKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showApimKey, setShowApimKey] = useState(false);

  // Carga inicial
  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await ihceClientService.getClinicConfiguration(tenantId);
      if (data) {
        setFormData({
          codigo_habilitacion_reps: data.codigo_habilitacion_reps || "",
          codigo_sede_reps: data.codigo_sede_reps || "01",
          codigo_servicio_reps: data.codigo_servicio_reps || "334",
          nombre_prestador: data.nombre_prestador || tenantName || "",
          nit: data.nit || "",
          ambiente: data.ambiente || "SANDBOX_MOCK",
          client_id: data.client_id || "",
          tenant_id_auth: data.tenant_id_auth || "",
          scope: data.scope || "https://sandbox.ihcecol.gov.co/.default",
          client_secret: data.client_secret ? "••••••••••••••••" : "",
          apim_subscription_key: data.apim_subscription_key ? "••••••••••••••••" : "",
          api_fhir_endpoint: data.api_fhir_endpoint || "https://sandbox.ihcecol.gov.co/ihce",
          is_active: data.is_active ?? false,
          auto_dispatch_enabled: data.auto_dispatch_enabled ?? true
        });
        setHasStoredSecret(Boolean(data.client_secret));
        setHasStoredApimKey(Boolean(data.apim_subscription_key));
      }
    } catch (err) {
      console.warn("Aviso al consultar configuración IHCE (usando valores iniciales):", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const [saveMessage, setSaveMessage] = useState(null);

  const notify = (msg, type = "info") => {
    if (toast?.[type]) {
      toast[type](msg);
    } else if (toast?.addToast) {
      toast.addToast(msg, type);
    } else if (toast?.showToast) {
      toast.showToast(msg, type);
    }
  };

  // Prueba de Conectividad
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setSaveMessage(null);

    try {
      const result = await ihceClientService.testConnectivity(formData, tenantId);
      setTestResult(result);
      if (result.success) {
        notify(result.message, "success");
      } else {
        notify(result.message, "error");
      }
    } catch (err) {
      setTestResult({
        success: false,
        status: 500,
        category: "ERROR_INESPERADO",
        message: err.message || "Error al validar la conexión."
      });
      notify("Error al verificar la conexión.", "error");
    } finally {
      setTesting(false);
    }
  };

  // Guardar Configuración
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    setSaveMessage(null);

    // Validaciones
    if (formData.codigo_habilitacion_reps && !/^\d{10,12}$/.test(formData.codigo_habilitacion_reps)) {
      notify("El código REPS debe contener entre 10 y 12 dígitos numéricos.", "error");
      setSaving(false);
      return;
    }

    if (formData.ambiente === "PRODUCCION") {
      notify("El ambiente de Producción requiere visto bueno formal de MinSalud antes de su activación.", "warning");
    }

    try {
      // Si el secreto no fue modificado (es la máscara), no sobreescribir con la máscara
      const payloadToSave = { ...formData };
      if (payloadToSave.client_secret === "••••••••••••••••") {
        delete payloadToSave.client_secret;
      }
      if (payloadToSave.apim_subscription_key === "••••••••••••••••") {
        delete payloadToSave.apim_subscription_key;
      }

      await ihceClientService.saveClinicConfiguration(payloadToSave, tenantId);
      const okMsg = "Configuración de interoperabilidad IHCE guardada y cifrada correctamente en el servidor.";
      setSaveMessage({ type: "success", text: okMsg });
      notify(okMsg, "success");
      await loadConfig();
    } catch (err) {
      console.error("Error al guardar IHCE:", err);
      const errMsg = err.message || "Error al guardar la configuración.";
      setSaveMessage({ type: "error", text: errMsg });
      notify(errMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Encabezado Principal */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600/30 border border-blue-400/30 rounded-2xl">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {tenantName ? `IHCE — ${tenantName}` : "Interoperabilidad IHCE"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  MinSalud Colombia
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Conexión oficial con el Mecanismo Nacional de Historia Clínica Electrónica (Ley 2015/2020, Res. 866/2021 y Res. 1888/2025).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {formData.ambiente === "PRODUCCION" ? (
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Producción</span>
              </span>
            ) : formData.ambiente === "PRUEBAS_MINSALUD" ? (
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Preproducción (Sandbox)</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600 flex items-center space-x-1.5">
                <span>Simulador Local</span>
              </span>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm transition-colors ml-2"
                title="Cerrar ventana"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pestañas de Navegación */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab("config")}
          className={`py-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === "config"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Credenciales y Conexión</span>
        </button>

        <button
          onClick={() => setActiveTab("outbox")}
          className={`py-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === "outbox"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Bandeja de Transmisiones (Outbox)</span>
        </button>

        <button
          onClick={() => setActiveTab("breakglass")}
          className={`py-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === "breakglass"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Seguridad y Break-Glass</span>
        </button>
      </div>

      {/* PESTAÑA 1: CONFIGURACIÓN */}
      {activeTab === "config" && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Resultado de la Prueba de Conectividad */}
          {testResult && (
            <div className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs leading-relaxed ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">{testResult.message}</p>
                {testResult.latencyMs && (
                  <p className="text-[11px] text-emerald-700 mt-1">Latencia de respuesta: {testResult.latencyMs} ms</p>
                )}
              </div>
            </div>
          )}

          {/* Mensaje de Guardado */}
          {saveMessage && (
            <div className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs leading-relaxed ${
              saveMessage.type === "success"
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {saveMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">{saveMessage.text}</p>
              </div>
            </div>
          )}

          {/* Sección 1: Datos del Prestador REPS */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>1. Identificación Oficial en Registro REPS</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código REPS Prestador (10 o 12 dígitos) *
                </label>
                <input
                  type="text"
                  name="codigo_habilitacion_reps"
                  value={formData.codigo_habilitacion_reps}
                  onChange={handleChange}
                  placeholder="Ej. 7000101658"
                  maxLength={12}
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Código asignado en habilitación de salud.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código de Sede (2 dígitos) *
                </label>
                <input
                  type="text"
                  name="codigo_sede_reps"
                  value={formData.codigo_sede_reps}
                  onChange={handleChange}
                  placeholder="01"
                  maxLength={2}
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Sede principal habitual: 01.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Servicio Habilitado *
                </label>
                <input
                  type="text"
                  name="codigo_servicio_reps"
                  value={formData.codigo_servicio_reps}
                  onChange={handleChange}
                  placeholder="334"
                  maxLength={3}
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">334 = Odontología General.</span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Razón Social o Nombre del Profesional Prestador *
                </label>
                <input
                  type="text"
                  name="nombre_prestador"
                  value={formData.nombre_prestador}
                  onChange={handleChange}
                  placeholder="Ej. IPS Odontológica / Profesional Independiente"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NIT o Cédula Tributaria *
                </label>
                <input
                  type="text"
                  name="nit"
                  value={formData.nit}
                  onChange={handleChange}
                  placeholder="Ej. 900000000"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Ambiente y Parámetros OAuth2 */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Key className="w-4 h-4 text-slate-500" />
              <span>2. Credenciales y Pasarela Ministerial (MinSalud / Entra ID)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ambiente de Interoperabilidad *
                </label>
                <select
                  name="ambiente"
                  value={formData.ambiente}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SANDBOX_MOCK">Simulador Local (Desarrollo y pruebas internas)</option>
                  <option value="PRUEBAS_MINSALUD">Preproducción / Sandbox MinSalud (Oficial)</option>
                  <option value="PRODUCCION">Producción Nacional (Requiere visto bueno)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Utilice Preproducción para pruebas con las llaves oficiales del portal.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  TenantID de Autenticación (GUID Entra ID)
                </label>
                <input
                  type="text"
                  name="tenant_id_auth"
                  value={formData.tenant_id_auth}
                  onChange={handleChange}
                  autoComplete="new-password"
                  placeholder="Ej. 00000000-0000-0000-0000-000000000000"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client ID (GUID asignado en portal) *
                </label>
                <input
                  type="text"
                  name="client_id"
                  value={formData.client_id}
                  onChange={handleChange}
                  autoComplete="new-password"
                  placeholder="Ej. 00000000-0000-0000-0000-000000000000"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Scope Oficial Asignado *
                </label>
                <input
                  type="text"
                  name="scope"
                  value={formData.scope}
                  onChange={handleChange}
                  autoComplete="off"
                  placeholder="Ej. https://sandbox.ihcecol.gov.co/.default"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              {/* Client Secret */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Client Secret *</span>
                  {hasStoredSecret && <span className="text-[10px] text-emerald-600 font-bold">Cifrado en servidor</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    name="client_secret"
                    value={formData.client_secret}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder="Introduzca el secreto ministerial"
                    className="w-full pl-3.5 pr-10 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required={!hasStoredSecret}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Custodiado con sobre AES-256-GCM.</span>
              </div>

              {/* APIM Subkey */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>APIM Subkey (Ocp-Apim-Subscription-Key) *</span>
                  {hasStoredApimKey && <span className="text-[10px] text-emerald-600 font-bold">Cifrado en servidor</span>}
                </label>
                <div className="relative">
                  <input
                    type={showApimKey ? "text" : "password"}
                    name="apim_subscription_key"
                    value={formData.apim_subscription_key}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder="Introduzca la clave de suscripción APIM"
                    className="w-full pl-3.5 pr-10 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required={!hasStoredApimKey}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApimKey(!showApimKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showApimKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Clave de la pasarela ministerial.</span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  EndPoint Base de la API FHIR R4 *
                </label>
                <input
                  type="url"
                  name="api_fhir_endpoint"
                  value={formData.api_fhir_endpoint}
                  onChange={handleChange}
                  placeholder="https://sandbox.ihcecol.gov.co/ihce"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Sección 3: Banderas Operativas */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Habilitar Interoperabilidad para esta Clínica</span>
                <span className="text-[11px] text-slate-500">Permite encolar atenciones cerradas para su radicación ministerial.</span>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="auto_dispatch_enabled"
                checked={formData.auto_dispatch_enabled}
                onChange={handleChange}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Despacho Automático Asíncrono</span>
                <span className="text-[11px] text-slate-500">El worker procesará la cola sin requerir intervención manual.</span>
              </div>
            </label>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Comprobando Conexión...' : 'Probar Conectividad'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
            </button>
          </div>
        </form>
      )}

      {/* PESTAÑA 2: OUTBOX QUEUE */}
      {activeTab === "outbox" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-700">Cola de Transmisiones Asíncronas (Transactional Outbox)</span>
            </div>
            <button
              onClick={() => setActiveTab("outbox")}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refrescar</span>
            </button>
          </div>
          <IhceOutboxTable items={[]} onRetryItem={async () => {}} />
        </div>
      )}

      {/* PESTAÑA 3: BREAK-GLASS */}
      {activeTab === "breakglass" && (
        <BreakGlassManager 
          sessions={[]} 
          onApproveSession={async () => {}} 
          onRevokeSession={async () => {}} 
        />
      )}
    </div>
  );
}
