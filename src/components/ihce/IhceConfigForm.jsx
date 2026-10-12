import React, { useState } from 'react';
import { Building2, Key, Shield, CheckCircle2, AlertCircle, Save, Eye, EyeOff } from 'lucide-react';

export default function IhceConfigForm({ config = {}, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    codigo_habilitacion_reps: config.codigo_habilitacion_reps || '',
    codigo_sede_reps: config.codigo_sede_reps || '01',
    nombre_prestador: config.nombre_prestador || '',
    nit: config.nit || '',
    ambiente: config.ambiente || 'SANDBOX_MOCK',
    client_id: config.client_id || '',
    client_secret: config.client_secret || '',
    apim_subscription_key: config.apim_subscription_key || '',
    is_active: config.is_active || false,
    auto_dispatch_enabled: config.auto_dispatch_enabled ?? true
  });

  const [showSecret, setShowSecret] = useState(false);
  const [showApimKey, setShowApimKey] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    // Validación básica de formato
    if (formData.codigo_habilitacion_reps && !/^\d{12}$/.test(formData.codigo_habilitacion_reps)) {
      setFeedback({ type: 'error', message: 'El código de habilitación REPS debe contener exactamente 12 dígitos numéricos.' });
      return;
    }

    if (formData.codigo_sede_reps && !/^\d{2}$/.test(formData.codigo_sede_reps)) {
      setFeedback({ type: 'error', message: 'El código de sede REPS debe contener exactamente 2 dígitos numéricos (ej. 01).' });
      return;
    }

    try {
      await onSave(formData);
      setFeedback({ type: 'success', message: 'Configuración de interoperabilidad IHCE guardada correctamente.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al guardar la configuración.' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Banner Superior */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600/30 border border-blue-400/30 rounded-xl">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Configuración de Interoperabilidad IHCE</h3>
            <p className="text-xs text-slate-300">Conexión Segura con el Mecanismo Nacional (MinSalud / SISPRO)</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {feedback && (
          <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Sección 1: Datos del Prestador */}
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Identificación Oficial en Registro REPS</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código Habilitación REPS (12 dígitos) *
              </label>
              <input
                type="text"
                name="codigo_habilitacion_reps"
                value={formData.codigo_habilitacion_reps}
                onChange={handleChange}
                placeholder="Ej. 110010998801"
                maxLength={12}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">Expedido por la Secretaría de Salud departamental/distrital.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código de Sede REPS (2 dígitos) *
              </label>
              <input
                type="text"
                name="codigo_sede_reps"
                value={formData.codigo_sede_reps}
                onChange={handleChange}
                placeholder="01"
                maxLength={2}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">Normalmente '01' para sede principal.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Razón Social / Nombre del Prestador
              </label>
              <input
                type="text"
                name="nombre_prestador"
                value={formData.nombre_prestador}
                onChange={handleChange}
                placeholder="Clínica Odontológica..."
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIT del Prestador
              </label>
              <input
                type="text"
                name="nit"
                value={formData.nit}
                onChange={handleChange}
                placeholder="901234567"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Sección 2: Credenciales de Integración */}
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Key className="w-4 h-4 text-slate-400" />
            <span>Credenciales Hércules OAuth2 (Minsalud)</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ambiente de Conexión
              </label>
              <select
                name="ambiente"
                value={formData.ambiente}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              >
                <option value="SANDBOX_MOCK">Simulador Local Aislado (Pruebas Seguras)</option>
                <option value="PRUEBAS_MINSALUD">Ambiente Oficial de Pruebas (MinSalud)</option>
                <option value="PRODUCCION" disabled>Producción Nacional (Requiere Certificación Oficial)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                name="client_id"
                value={formData.client_id}
                onChange={handleChange}
                placeholder="Identificador asignado por MinSalud"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client Secret (Hércules OAuth2) {config.has_secret && <span className="text-emerald-600 font-normal">(Configurado en servidor)</span>}
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  name="client_secret"
                  value={formData.client_secret}
                  onChange={handleChange}
                  placeholder={config.has_secret ? '•••••••••••••••• (Dejar vacío para no modificar)' : 'Secreto de autenticación'}
                  className="w-full pr-10 px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                APIM Subscription Key (Ocp-Apim-Subscription-Key) {config.has_apim_key && <span className="text-emerald-600 font-normal">(Configurado en servidor)</span>}
              </label>
              <div className="relative">
                <input
                  type={showApimKey ? 'text' : 'password'}
                  name="apim_subscription_key"
                  value={formData.apim_subscription_key}
                  onChange={handleChange}
                  placeholder={config.has_apim_key ? '•••••••••••••••• (Dejar vacío para no modificar)' : 'Clave de suscripción del portal Azure APIM'}
                  className="w-full pr-10 px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowApimKey(!showApimKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showApimKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Cabecera obligatoria según Manual de Operaciones IHCE v1.3 para pasar por el API Management de MinSalud.</p>
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Sección 3: Interruptores Operativos */}
        <div className="space-y-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800">Activar Interoperabilidad IHCE para esta clínica</span>
              <p className="text-xs text-slate-500">Permite la generación y transmisión automática de resúmenes de atención.</p>
            </div>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              name="auto_dispatch_enabled"
              checked={formData.auto_dispatch_enabled}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800">Despacho asíncrono automático al cerrar evolución</span>
              <p className="text-xs text-slate-500">Encola de inmediato la atención en el Outbox Worker sin requerir acción manual del doctor.</p>
            </div>
          </label>
        </div>

        {/* Botón de Guardado */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Configuración'}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
