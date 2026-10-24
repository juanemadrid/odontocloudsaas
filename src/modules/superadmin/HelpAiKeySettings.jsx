import React, { useEffect, useRef, useState } from 'react';
import { manageHelpAiKey } from '../../services/helpAiSettingsService';

export default function HelpAiKeySettings() {
  const [status, setStatus] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash-lite');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void loadStatus();
    return () => { mounted.current = false; };
  }, []);
  async function loadStatus() {
    try {
      const result = await manageHelpAiKey('status');
      if (!mounted.current) return;
      setStatus(result); setModel(result.model); setError('');
    } catch (e) { if (mounted.current) setError(e.message); }
  }
  async function run(action) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await manageHelpAiKey(action, { apiKey: apiKey.trim(), model });
      if (!mounted.current) return;
      setMessage(result.message);
      if (action === 'save') { setApiKey(''); await loadStatus(); }
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section aria-label="Conexión de Gemini para ayuda" className="border border-slate-200 rounded-xl p-4 my-3 bg-slate-50">
    <h3 className="font-bold text-sm text-slate-800">Conexión de Gemini para ayuda</h3>
    <p className="text-xs text-slate-600 mt-1">Una clave para la ayuda de todas las clínicas. La configuración del asistente de superadministrador se conserva.</p>
    <p className="text-xs font-semibold text-slate-700 my-2" role="status">
      {status ? (status.configured ? `Clave configurada · ${status.source === 'panel' ? 'Guardada desde este panel' : 'Configurada en el servidor'}` : 'Sin clave configurada') : 'Consultando conexión…'}
    </p>
    {status?.verifiedAt && <p className="text-xs text-slate-500 mb-2">Última verificación: {new Date(status.verifiedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>}
    {status?.serverDisabled && <p className="text-xs text-amber-800 mb-2">La IA está bloqueada en el servidor. Guardar la clave no levanta ese bloqueo.</p>}
    {status && !status.encryptionReady && <p className="text-xs text-amber-800 mb-2">{status.message}</p>}
    <label className="block text-xs font-semibold text-slate-700" htmlFor="help-gemini-key">Nueva clave API de Gemini</label>
    <input id="help-gemini-key" type="password" autoComplete="new-password" spellCheck={false} value={apiKey}
      disabled={busy} maxLength={200} onChange={e => { setApiKey(e.target.value); setMessage(''); }}
      placeholder="Pega aquí la clave; no se mostrará después de guardarla"
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1 mb-3" />
    <label className="block text-xs font-semibold text-slate-700" htmlFor="help-gemini-model">Modelo de ayuda</label>
    <select id="help-gemini-model" value={model} disabled={busy} onChange={e => { setModel(e.target.value); setMessage(''); }}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1 mb-3">
      <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite · Menor costo</option>
      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
    </select>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !apiKey.trim() || !status} onClick={() => run('test')}
        className="rounded-lg px-3 py-2 bg-white border text-xs font-bold disabled:opacity-50">{busy ? 'Procesando…' : 'Probar conexión'}</button>
      <button type="button" disabled={busy || !apiKey.trim() || !status?.encryptionReady} onClick={() => run('save')}
        className="rounded-lg px-3 py-2 bg-blue-600 text-white text-xs font-bold disabled:opacity-50">Probar y guardar clave</button>
      <button type="button" disabled={busy} onClick={loadStatus} className="text-xs text-blue-700 px-2">Actualizar conexión</button>
    </div>
    {message && <p role="status" className="text-sm text-green-800 mt-3">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-700 mt-3">{error}</p>}
    <p className="text-xs text-slate-500 mt-3">Cada prueba consume una consulta mínima. Guardar vuelve a probar antes de sustituir la clave. Cambiar una clave del mismo proyecto de Google no reinicia su cuota.</p>
  </section>;
}
