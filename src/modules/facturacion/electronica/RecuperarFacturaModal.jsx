import React, { useState, useRef } from 'react';
import { previewFactusInvoiceRecovery, saveRecoveredInvoice } from '../../../services/factusInvoiceRecovery.js';

export default function RecuperarFacturaModal({ tenantId, onClose, onRecovered }) {
  const [number, setNumber] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const run = async (save) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      if (save) {
        await saveRecoveredInvoice(preview);
        await onRecovered();
      } else setPreview(await previewFactusInvoiceRecovery(tenantId, number));
    } catch (e) { setError(e.message || 'No se pudo recuperar la factura.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
    <div role="dialog" aria-modal="true" aria-label="Recuperar factura de Factus" className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
      <h2 className="font-bold text-slate-800">Recuperar factura emitida</h2>
      <p className="text-sm text-slate-600">Consulte una factura de esta clínica que ya fue validada en Factus para incorporarla a OdontoCloud.</p>
      <label className="block text-sm">Número de factura
        <input disabled={busy} value={number} onChange={e => { setNumber(e.target.value); setPreview(null); }} placeholder="Ej. FCEV1345" className="border rounded p-2 w-full mt-1" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {preview && <div className="rounded border bg-slate-50 p-3 text-sm space-y-2">
        <p><strong>{preview.numero}</strong> — {preview.detalles.pacienteNombre}</p>
        <p>Total: {preview.total.toLocaleString('es-CO', {style:'currency',currency:'COP'})}</p>
        {preview.detalles.items.map((it,i) => <p key={i}>{it.descripcion} — cantidad {it.cantidad}</p>)}
        <p className="break-all">CUFE: {preview.detalles.cufe}</p>
        <p>Se guardará como aceptada. Los recibos y las notas crédito se revisan por separado.</p>
      </div>}
      <div className="flex justify-end gap-3">
        <button disabled={busy} onClick={onClose} className="border rounded px-3 py-2">Cancelar</button>
        <button disabled={busy || !number.trim()} onClick={() => run(Boolean(preview))} className="bg-blue-600 text-white rounded px-3 py-2 disabled:opacity-50">
          {busy ? 'Procesando…' : preview ? 'Guardar en OdontoCloud' : 'Consultar Factus'}
        </button>
      </div>
    </div>
  </div>;
}
