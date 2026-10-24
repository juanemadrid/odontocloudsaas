import React, { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import HelpAiKeySettings from './HelpAiKeySettings';

export default function HelpAiControls({ tenants }) {
  const [global, setGlobal] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  async function load() {
    setLoaded(false);
    try {
      const [g, c] = await Promise.all([
        supabase.from('odonto_help_global').select('id, enabled, daily_limit, monthly_limit').eq('id', true).single(),
        supabase.from('odonto_help_clinics').select('tenant_id, enabled, daily_limit, monthly_limit'),
      ]);
      if (g.error || c.error) {
        setError('No se pudo cargar el control de IA. Comprueba que la actualización del servidor esté instalada.');
        setGlobal(null);
        return;
      }
      setGlobal(g.data); setClinics(c.data || []); setError(''); setLoaded(true);
    } catch {
      setGlobal(null);
      setError('No se pudo cargar el control de IA. Revisa la conexión y actualiza el estado.');
    }
  }
  useEffect(() => { void load(); }, []);
  async function toggle(tenantId) {
    setBusy(true); setError('');
    try {
      const current = clinics.find(c => c.tenant_id === tenantId);
      const result = tenantId
        ? await supabase.from('odonto_help_clinics').upsert({ tenant_id: tenantId, enabled: !current?.enabled }, { onConflict: 'tenant_id' }).select('tenant_id').single()
        : await supabase.from('odonto_help_global').update({ enabled: !global.enabled }).eq('id', true).select('id').single();
      if (result.error) throw result.error;
      await load();
    } catch { setError('No se pudo guardar el cambio. Actualiza y vuelve a intentarlo.'); }
    finally { setBusy(false); }
  }
  const switchButton = (enabled, label, action) => <button type="button" role="switch" aria-checked={enabled}
    aria-label={label} disabled={busy || !loaded} onClick={action}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${enabled ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
    {enabled ? 'Encendida' : 'Apagada'}
  </button>;
  return <details className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
    <summary className="cursor-pointer font-bold text-sm text-slate-800">Asistente IA de ayuda · Control por clínica</summary>
    <HelpAiKeySettings />
    <p className="text-xs text-slate-500 my-3">Las guías siguen disponibles con la IA apagada. Solo explica el uso del sistema y no ejecuta operaciones.</p>
    {error && <p role="alert" className="text-sm text-amber-800 mb-3">{error}</p>}
    {!loaded && <button type="button" onClick={load} className="text-xs text-blue-700">Actualizar estado</button>}
    {global && <>
      <div className="flex justify-between items-center gap-3 py-2 border-b">
        <div className="text-sm font-bold">Interruptor general
          <p className="text-xs font-normal text-slate-500">Máximo {global.daily_limit} consultas/día y {global.monthly_limit}/mes entre todas las clínicas.</p>
        </div>
        {switchButton(global.enabled, 'Asistente IA en todas las clínicas', () => toggle(null))}
      </div>
      {tenants.map(t => {
        const c = clinics.find(row => row.tenant_id === t.id);
        return <div key={t.id} className="flex justify-between items-center gap-3 py-2 border-b last:border-0">
          <div className="text-sm">{t.name}
            <p className="text-xs text-slate-500">Máximo {c?.daily_limit ?? 15}/día y {c?.monthly_limit ?? 150}/mes.{!global.enabled && c?.enabled ? ' Pausada por el interruptor general.' : ''}</p>
          </div>
          {switchButton(!!c?.enabled, `Asistente IA para ${t.name}`, () => toggle(t.id))}
        </div>;
      })}
    </>}
  </details>;
}
