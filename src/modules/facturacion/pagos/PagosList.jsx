import React, { useState, useEffect, useCallback } from "react";
import { FiCreditCard, FiSearch, FiCalendar, FiPrinter, FiTrash2, FiPlus, FiHome, FiFileText } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function PagosList({ onNew }) {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";
  const [loading, setLoading] = useState(true);
  const [pagos, setPagos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0];
  });
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split("T")[0]);

  const parseLocalDate = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };

  const loadData = useCallback(async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      let list = [];
      try {
        const { data } = await supabase
          .from("pagos_proveedor")
          .select("*")
          .eq("tenant_id", inquilino);
        if (data && data.length > 0) list = data;
      } catch (e) {}

      if (list.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        list = cfgRow?.config?.pagos_proveedor || [];
      }

      const start = parseLocalDate(fechaInicio); start.setHours(0,0,0,0);
      const end = parseLocalDate(fechaFin); end.setHours(23,59,59,999);
      const filtered = (list || [])
        .filter(p => {
          if (!p.fecha && !p.created_at) return false;
          const ts = new Date(p.fecha || p.created_at).getTime();
          return ts >= start.getTime() && ts <= end.getTime();
        })
        .sort((a, b) => new Date(b.fecha || b.created_at).getTime() - new Date(a.fecha || a.created_at).getTime());
      setPagos(filtered);
    } catch (e) {
      console.error("Error loading pagos:", e);
    } finally {
      setLoading(false);
    }
  }, [inquilino, fechaInicio, fechaFin]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = pagos.filter(p =>
    (p.proveedor || p.tercero || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.concepto || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.medioPago || p.bancoCaja || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeletePago = async (pagoId) => {
    if (!window.confirm("¿Está seguro de eliminar este registro de pago?")) return;
    try {
      try {
        await supabase.from("pagos_proveedor").delete().eq("id", pagoId);
      } catch (e) {}

      try {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        const currCfg = cfgRow?.config || {};
        currCfg.pagos_proveedor = (currCfg.pagos_proveedor || []).filter(p => p.id !== pagoId);
        await supabase
          .from("website_config")
          .upsert({ tenant_id: inquilino, config: currCfg });
      } catch (e) {}

      setPagos(prev => prev.filter(p => p.id !== pagoId));
      toast.success("Pago eliminado correctamente");
    } catch (e) {
      toast.error("Error al eliminar el pago");
    }
  };

  const handlePrintPago = (pago) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = (pago.items || []).map(it => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${it.concepto || '—'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${it.descripcion || '—'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${fmt(it.precioUnitario)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.cantidad || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${fmt(it.total)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Egreso / Pago</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: 0 auto; }
          .header { border-bottom: 2px solid #8dc63f; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; }
          th { background: #f8fafc; text-align: left; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; }
          .total-box { text-align: right; font-size: 16px; font-weight: bold; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">COMPROBANTE DE EGRESO / PAGO</div>
            <div style="font-size: 12px; color: #64748b;">Clínica Odontológica</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            <div>Fecha: ${fmtDate(pago.fecha)}</div>
            <div>Ref: ${pago.id}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <strong>Beneficiario / Tercero:</strong> ${pago.tercero || pago.proveedor || '—'}<br/>
            <strong>Condición de pago:</strong> ${pago.condicionPago || 'Contado'}<br/>
            <strong>Profesional:</strong> ${pago.profesional || '—'}
          </div>
          <div>
            <strong>Medio de Pago / Caja:</strong> ${pago.medioPago || pago.bancoCaja || 'Efectivo'}<br/>
            <strong>Pagador:</strong> ${pago.pagadorEmail || '—'}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Descripción</th>
              <th style="text-align: right;">Precio Unitario</th>
              <th style="text-align: center;">Cant.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || `
              <tr>
                <td style="padding: 8px;">${pago.concepto || 'Pago a proveedor'}</td>
                <td style="padding: 8px;">${pago.observaciones || '—'}</td>
                <td style="padding: 8px; text-align: right;">${fmt(pago.monto || pago.total)}</td>
                <td style="padding: 8px; text-align: center;">1</td>
                <td style="padding: 8px; text-align: right; font-weight: bold;">${fmt(pago.monto || pago.total)}</td>
              </tr>
            `}
          </tbody>
        </table>

        <div class="total-box">
          Total Pagado: ${fmt(pago.monto || pago.total)}
        </div>

        ${pago.observaciones ? `
          <div style="margin-top: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            <strong>Observaciones:</strong> ${pago.observaciones}
          </div>
        ` : ''}

        <div style="margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; font-size: 12px;">
          <div>
            <div style="border-top: 1px solid #94a3b8; padding-top: 5px;">Firma Autorizada</div>
          </div>
          <div>
            <div style="border-top: 1px solid #94a3b8; padding-top: 5px;">Recibí Conforme (Firma y Cédula)</div>
          </div>
        </div>

        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-[#f8fafc] text-slate-700 pb-16 animate-fadeIn font-sans">
      
      {/* Header & Breadcrumbs */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1300px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Pagos</h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <FiHome className="text-slate-400" size={13} />
              <span>Facturación</span>
              <span>›</span>
              <span className="text-slate-700 font-semibold">Pagos</span>
            </div>
          </div>

          {onNew && (
            <button
              type="button"
              onClick={onNew}
              className="px-6 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <FiPlus size={15} /> Nuevo pago
            </button>
          )}
        </div>
      </div>

      <div className="max-w-[1300px] mx-auto px-6 py-6 space-y-6">
        
        {/* Filter Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Inicial</label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Final</label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Buscar</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Proveedor, tercero o concepto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={loadData}
                className="w-full h-9 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <FiSearch size={14} /> Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-600 font-semibold">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Proveedor / Tercero</th>
                  <th className="py-3 px-4">Concepto / Detalle</th>
                  <th className="py-3 px-4">Medio de Pago / Caja</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400 font-medium">
                      Cargando pagos...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FiCreditCard size={32} className="text-slate-300" />
                        <p className="font-semibold text-slate-500">No hay pagos registrados en este periodo</p>
                        <p className="text-[11px] text-slate-400">Haz clic en "+ Nuevo pago" para registrar un egreso o pago a proveedor</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-500">{fmtDate(p.fecha)}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 uppercase">{p.proveedor || p.tercero || "—"}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.items && p.items.length > 0 ? p.items[0]?.concepto : (p.concepto || "Egreso / Pago")}
                        {p.items && p.items.length > 1 && (
                          <span className="ml-1 text-[10px] text-slate-400 font-normal">
                            (+{p.items.length - 1} más)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-medium">
                          {p.medioPago || p.bancoCaja || "Efectivo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">{fmt(p.monto || p.total)}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePrintPago(p)}
                            className="w-7 h-7 rounded bg-slate-50 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                            title="Imprimir Comprobante"
                          >
                            <FiPrinter size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePago(p.id)}
                            className="w-7 h-7 rounded bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                            title="Eliminar"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
