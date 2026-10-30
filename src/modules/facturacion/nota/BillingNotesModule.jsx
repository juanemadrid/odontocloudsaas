import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import supabase from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import NotaCreditoElectronicaModal from '../electronica/NotaCreditoElectronicaModal';
import { downloadCreditNotePDF, downloadCreditNoteXML } from '../../../services/factusService';
import { validateInvoiceCreditEligibility } from '../../../services/factusCreditNotePayloadBuilder';

const money = value => Number(value || 0).toLocaleString('es-CO', {style:'currency',currency:'COP',maximumFractionDigits:2});
const invoiceNumber = invoice => invoice?.detalles?.factusInvoiceNumber || invoice?.numero || invoice?.nro_consecutivo || '—';
const patientName = invoice => invoice?.detalles?.pacienteNombre || invoice?.pacienteNombre || '—';

export function billingNoteStatus(note) {
  if (!note.dian_status) return 'Registro interno';
  return ({ACCEPTED:'Aceptada',DRAFT:'Borrador',PENDING:'En proceso',INDETERMINATE:'Por verificar',REJECTED:'Rechazada'})[note.dian_status] || 'Por verificar';
}

// Borradores de nota que quedaron de un intento que no salió y que ya fueron reemplazados por una
// nota ACEPTADA de la misma factura emitida después. Se ocultan de la vista; no se borran.
const noteTime = note => {
  const t = new Date(note?.created_at || note?.fecha || '').getTime();
  return Number.isFinite(t) ? t : null;
};
export function supersededDraftIds(notes = []) {
  const accepted = notes.filter(note => note?.dian_status === 'ACCEPTED' && note.factura_id);
  return new Set(notes.filter(note => note?.dian_status === 'DRAFT' && !note.cude && note.factura_id
    && accepted.some(ok => {
      if (ok.factura_id !== note.factura_id || ok.id === note.id) return false;
      const a = noteTime(ok), d = noteTime(note);
      return a === null || d === null || a >= d;
    })).map(note => note.id));
}

export default function BillingNotesModule({kind = 'credit', initialCreate = false}) {
  const credit = kind === 'credit';
  const label = credit ? 'Notas crédito' : 'Notas débito';
  const table = credit ? 'notas_credito' : 'notas_debito';
  const {userProfile} = useAuth();
  const tenant = userProfile?.inquilino || userProfile?.tenantId || userProfile?.tenant_id;
  const {can} = usePermissions();
  const allowed = can('Administración','Factura de venta','consultar');
  const mayCreate = can('Administración','Factura de venta','crear');
  const [notes,setNotes] = useState([]);
  const [invoices,setInvoices] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [choosing,setChoosing] = useState(false);
  const [selected,setSelected] = useState(null);
  const [viewed,setViewed] = useState(null);
  const [busy,setBusy] = useState(false);
  const [showReplaced,setShowReplaced] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    if (!tenant || !allowed) {setLoading(false);return;}
    setLoading(true);setError('');setNotes([]);setInvoices([]);
    try {
      const [{data:rows,error:noteError},{data:bills,error:invoiceError}] = await Promise.all([
        supabase.from(table).select('*').eq('tenant_id',tenant).order('fecha',{ascending:false}),
        supabase.from('facturas').select('*').eq('tenant_id',tenant),
      ]);
      if (noteError) throw noteError;
      if (invoiceError) throw invoiceError;
      if (request !== generation.current) return;
      setNotes(rows || []);setInvoices(bills || []);
    } catch (e) {if (request === generation.current) setError('No se pudo cargar el historial: ' + e.message);}
    finally {if (request === generation.current) setLoading(false);}
  },[tenant,table,allowed]);
  useEffect(()=>{setSelected(null);setViewed(null);setChoosing(initialCreate && credit && mayCreate);load();return ()=>{generation.current++;};},[load,initialCreate,credit,mayCreate]);

  const billsById = useMemo(()=>new Map(invoices.map(invoice=>[invoice.id,invoice])),[invoices]);
  const replaced = useMemo(()=>supersededDraftIds(notes),[notes]);
  const matches = useMemo(()=>notes.filter(note=>{
    if (!showReplaced && replaced.has(note.id)) return false;
    const bill=billsById.get(note.factura_id);
    return [note.numero,note.nro_consecutivo,note.nroConsecutivo,note.concepto,note.motivo,note.pacienteNombre,patientName(bill),invoiceNumber(bill),billingNoteStatus(note)]
      .some(value=>String(value || '').toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
  }),[notes,billsById,search,replaced,showReplaced]);
  const eligible = useMemo(()=>invoices.filter(invoice=>{
    if (invoice.estado === 'Anulado' || invoice.detalles?.fiscal_adjustment_status === 'FULLY_CREDITED') return false;
    try {validateInvoiceCreditEligibility(invoice);return true;} catch {return false;}
  }),[invoices]);

  const download = async (note,format) => {
    if (busy) return;
    setBusy(true);setError('');
    try {
      const result=format==='PDF' ? {blob:await downloadCreditNotePDF(note.numero),fileName:`NotaCredito-${note.numero}.pdf`} : await downloadCreditNoteXML(note.numero);
      const url=URL.createObjectURL(result.blob);
      const anchor=document.createElement('a');anchor.href=url;anchor.download=result.fileName || `${note.numero}.xml`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch (e) {setError('No se pudo descargar el documento: ' + e.message);}
    finally {setBusy(false);}
  };
  const openCredit = invoice => {if (!invoice) return;setChoosing(false);setSelected(invoice);};

  if (!allowed) return <p className="p-6">No tienes permiso para consultar estos documentos.</p>;
  return <div className="p-4 space-y-4">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><h3 className="font-bold text-slate-800">{label}</h3><p className="text-xs text-slate-500">Historial y documentos asociados a las facturas de la clínica.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={load} disabled={loading || busy} className="border rounded-lg px-3 py-2 text-sm">Actualizar</button>
        {credit && mayCreate && <button type="button" onClick={()=>setChoosing(true)} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">Nueva nota crédito</button>}
      </div>
    </div>
    {!credit && <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">Este acceso permite consultar las notas débito existentes. La emisión electrónica de nuevas notas débito no está habilitada aquí; un registro interno no equivale a un documento validado por la DIAN.</p>}
    {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl">{error}</p>}
    <input aria-label="Buscar notas" placeholder="Buscar por nota, factura, paciente o estado" value={search} onChange={e=>setSearch(e.target.value)} className="border rounded-lg px-3 py-2 w-full" />
    {replaced.size > 0 && <label className="flex items-center gap-2 text-xs text-slate-500 select-none">
      <input type="checkbox" checked={showReplaced} onChange={e=>setShowReplaced(e.target.checked)} />
      Mostrar borradores de intentos que ya fueron reemplazados por una nota aceptada ({replaced.size})
    </label>}
    <div className="overflow-x-auto border rounded-xl bg-white">
      <table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr>{['Nota','Fecha','Factura','Paciente / tercero','Valor','Estado','Acciones'].map(title=><th key={title} className="p-3">{title}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={7} className="p-6">Cargando historial…</td></tr> : matches.length===0 ? <tr><td colSpan={7} className="p-6 text-slate-500">No se encontraron registros.</td></tr> : matches.map(note=>{
        const bill=billsById.get(note.factura_id);
        const fiscal=note.dian_status==='ACCEPTED' && /^[a-f0-9]{96}$/i.test(note.cude || '');
        return <tr key={note.id} className="border-t">
          <td className="p-3 font-semibold">{note.numero || note.nro_consecutivo || note.nroConsecutivo || 'Borrador'}</td>
          <td className="p-3">{note.fecha || note.created_at ? new Date(note.fecha || note.created_at).toLocaleDateString('es-CO',{timeZone:'America/Bogota'}) : '—'}</td>
          <td className="p-3">{invoiceNumber(bill)}</td><td className="p-3">{bill ? patientName(bill) : note.pacienteNombre || '—'}</td>
          <td className="p-3 whitespace-nowrap">{money(note.monto_acreditado ?? note.monto ?? note.total)}</td>
          <td className="p-3">{note.dian_status==='ACCEPTED' && !fiscal ? 'Confirmación incompleta' : billingNoteStatus(note)}</td>
          <td className="p-3"><div className="flex flex-wrap gap-2">
            <button type="button" className="text-blue-700 underline" onClick={()=>setViewed({...note,bill})}>Ver detalle</button>
            {credit && bill && <button type="button" className="text-blue-700 underline" onClick={()=>openCredit(bill)}>Verificar / ver nota</button>}
            {credit && fiscal && <><button type="button" disabled={busy} className="text-blue-700 underline" onClick={()=>download(note,'PDF')}>PDF</button><button type="button" disabled={busy} className="text-blue-700 underline" onClick={()=>download(note,'XML')}>XML</button></>}
          </div></td>
        </tr>;
      })}</tbody></table>
    </div>
    {choosing && <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Seleccionar factura" className="bg-white p-5 rounded-2xl w-full max-w-xl space-y-4">
      <h3 className="font-bold">Selecciona la factura para la nota crédito</h3>
      <p className="text-sm text-slate-600">La factura debe estar aceptada y conservar saldo fiscal acreditable. El saldo se verificará al abrirla.</p>
      <div className="max-h-80 overflow-auto space-y-2">{eligible.map(invoice=><button type="button" key={invoice.id} onClick={()=>openCredit(invoice)} className="w-full text-left border p-3 rounded-lg">{invoiceNumber(invoice)} — {patientName(invoice)} — {money(invoice.total)}</button>)}{!eligible.length && <p>No hay facturas disponibles para una nueva nota crédito.</p>}</div>
      <button type="button" onClick={()=>setChoosing(false)} className="border px-4 py-2 rounded-lg">Cerrar</button>
    </div></div>}
    {viewed && <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Detalle de nota" className="bg-white p-5 rounded-2xl w-full max-w-xl space-y-3">
      <h3 className="font-bold">{viewed.numero || viewed.nroConsecutivo || 'Nota'}</h3>
      <p>Factura: {invoiceNumber(viewed.bill)}</p><p>Estado: {billingNoteStatus(viewed)}</p>
      <p>Valor: {money(viewed.monto_acreditado ?? viewed.monto ?? viewed.total)}</p>
      <p className="break-words">{viewed.detalles?.observacion || viewed.concepto || viewed.motivo || viewed.notas || 'Sin observaciones'}</p>
      {viewed.cude && <p className="break-all text-xs">CUDE: {viewed.cude}</p>}
      <button type="button" onClick={()=>setViewed(null)} className="border px-4 py-2 rounded-lg">Cerrar</button>
    </div></div>}
    {selected && <NotaCreditoElectronicaModal factura={selected} inquilino={tenant} onClose={()=>{setSelected(null);load();}} onSuccess={load} />}
  </div>;
}
