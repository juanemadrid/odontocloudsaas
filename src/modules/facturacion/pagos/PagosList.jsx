import React, { useState, useEffect, useCallback } from "react";
import { FiCreditCard, FiSearch, FiCalendar, FiPrinter, FiTrash2, FiPlus, FiHome, FiFileText } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import { ReceiptPrintService } from "../../../services/ReceiptPrintService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  if (typeof ts === 'string') {
    const match = ts.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && (!ts.includes('T') || ts.includes('T00:00:00') || ts.includes('T05:00:00'))) {
      const [, y, m, d] = match;
      return `${d}/${m}/${y}`;
    }
  }
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "—";
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
          let ts = null;
          const raw = p.fecha || p.created_at;
          if (typeof raw === 'string') {
            const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match && (!raw.includes('T') || raw.includes('T00:00:00') || raw.includes('T05:00:00'))) {
              const [, y, m, d] = match;
              ts = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0).getTime();
            }
          }
          if (!ts) {
            ts = new Date(raw).getTime();
          }
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
    (p.medioPago || p.bancoCaja || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.consecutivo || p.numero || p.nroConsecutivo || "").toLowerCase().includes(searchTerm.toLowerCase())
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

  const handlePrintPago = async (pago) => {
    try {
      const clinic = {
        ...(userProfile?.tenant || {}),
        nombre: userProfile?.tenant?.nombre || userProfile?.tenant?.name || userProfile?.tenantNombre || userProfile?.clinica || "CLÍNICA ODONTOLÓGICA",
        inquilino: userProfile?.tenant?.id || userProfile?.inquilino || userProfile?.tenantId || "",
        ciudad: userProfile?.tenant?.ciudad || userProfile?.tenantCiudad || "Sincelejo"
      };

      const terceroNombre = pago.tercero || pago.proveedor || "BENEFICIARIO / TERCERO";
      const terceroDoc = pago.documentoTercero || pago.nit || pago.cedula || "—";
      const isNit = String(terceroDoc).replace(/\D/g, "").length >= 9;

      const patientPayload = {
        nombreCompleto: terceroNombre,
        documento: terceroDoc,
        tipoDocumento: isNit ? "NIT" : "CC",
        direccion: pago.direccion || "—",
        ciudad: pago.ciudad || userProfile?.tenantCiudad || "Sincelejo",
        celular: pago.telefono || "—"
      };

      // 1. Identificar y resolver Facturas de Compra asociadas si existen
      let facturasMap = {};
      const tieneFacturas = pago.pagoFacturasCompra || 
        (pago.facturasSeleccionadas && pago.facturasSeleccionadas.length > 0) ||
        (pago.items && pago.items.some(it => it.isFactura || it.facturaId || /^FC[A-Z0-9\-_]*/i.test(it.concepto || "") || /^DS[A-Z0-9\-_]*/i.test(it.concepto || "")));

      if (tieneFacturas) {
        try {
          const { data: fcDb } = await supabase
            .from("facturas_compra")
            .select("*")
            .eq("tenant_id", inquilino);
          if (fcDb && fcDb.length > 0) {
            fcDb.forEach(f => {
              if (f.id) facturasMap[f.id] = f;
              if (f.nroFactura) facturasMap[f.nroFactura] = f;
              if (f.documentoNumero) facturasMap[f.documentoNumero] = f;
            });
          }
        } catch (_) {}

        if (Object.keys(facturasMap).length === 0) {
          try {
            const { data: cfgRow } = await supabase
              .from("website_config")
              .select("config")
              .eq("tenant_id", inquilino)
              .maybeSingle();
            const fcs = cfgRow?.config?.facturas_compra || [];
            fcs.forEach(f => {
              if (f.id) facturasMap[f.id] = f;
              if (f.nroFactura) facturasMap[f.nroFactura] = f;
              if (f.documentoNumero) facturasMap[f.documentoNumero] = f;
            });
          } catch (_) {}
        }
      }

      let facturaRefNotas = [];
      const itemsList = (pago.items && pago.items.length > 0)
        ? pago.items.map(it => {
            const isFc = it.isFactura || it.facturaId || /^FC[A-Z0-9\-_]*/i.test(it.concepto || "") || /^DS[A-Z0-9\-_]*/i.test(it.concepto || "");
            const fcObj = isFc ? (facturasMap[it.facturaId] || facturasMap[it.concepto] || facturasMap[it.numeroFactura]) : null;

            let descItem = "";
            if (isFc) {
              const numDoc = fcObj?.nroFactura || fcObj?.documentoNumero || it.numeroFactura || it.concepto;
              if (numDoc) {
                facturaRefNotas.push(numDoc);
              }
              // Resolver concepto real de la factura de compra (evitando repetir el nombre del proveedor)
              if (fcObj && Array.isArray(fcObj.items) && fcObj.items.length > 0) {
                descItem = fcObj.items.map(i => (i.concepto && i.descripcion && i.concepto !== i.descripcion) ? `${i.concepto} - ${i.descripcion}` : (i.concepto || i.descripcion)).filter(Boolean).join(", ");
              } else if (fcObj?.concepto || fcObj?.descripcion) {
                descItem = fcObj.concepto || fcObj.descripcion;
              } else if (it.descripcion && it.descripcion !== terceroNombre && !it.descripcion.toLowerCase().includes(terceroNombre.toLowerCase())) {
                descItem = it.descripcion;
              } else {
                descItem = "ADQUISICIÓN DE BIENES / SERVICIOS";
              }
            } else {
              // Movimiento normal o de caja
              if (it.concepto && it.descripcion && it.concepto !== it.descripcion) {
                descItem = `${it.concepto} - ${it.descripcion}`;
              } else {
                descItem = it.concepto || it.descripcion || "Item";
              }
            }

            return {
              desc: descItem,
              monto: it.total || it.precioUnitario || 0
            };
          })
        : null;

      // Limpieza de observaciones para evitar redundancias
      let obsFinal = String(pago.observaciones || "").trim();

      // Limpiar prefijo legacy "Factura de compra / Documento soporte:" si venía guardado
      obsFinal = obsFinal.replace(/factura de compra\s*\/\s*documento soporte:\s*/gi, "").trim();

      // Caso 1: Si es de caja menor y la observación sólo repite "Egreso caja menor: X"
      // y ese texto ya está en la descripción del concepto, no duplicar en observaciones
      if (/^egreso caja menor:\s*/i.test(obsFinal)) {
        const obsContenido = obsFinal.replace(/^egreso caja menor:\s*/i, "").trim().toLowerCase();
        const yaEnConcepto = (itemsList || []).some(it => it.desc.toLowerCase().includes(obsContenido));
        if (yaEnConcepto || obsContenido === "") {
          obsFinal = "";
        }
      }

      // Caso 2: Si hay factura asociada, fijar el número de documento soporte/factura y anexar cualquier observación adicional
      if (facturaRefNotas.length > 0) {
        const uniqueFacturas = [...new Set(facturaRefNotas)].join(", ");
        if (!obsFinal) {
          obsFinal = uniqueFacturas;
        } else if (!obsFinal.includes(uniqueFacturas)) {
          obsFinal = `${uniqueFacturas} — ${obsFinal}`;
        }
      }

      const pagoPayload = {
        ...pago,
        tipo: "egreso",
        tipoDocumento: "Egreso",
        documentTitle: "COMPROBANTE DE EGRESO",
        monto: Number(pago.monto || pago.total || 0),
        concepto: (itemsList && itemsList[0]?.desc) || pago.concepto || "Egreso / Pago a proveedor",
        nroConsecutivo: pago.consecutivo || pago.numero || (pago.id && String(pago.id).replace(/\D/g, "").slice(-4)) || "S/N",
        medio: pago.medioPago || pago.bancoCaja || "Efectivo",
        registradoPor: (userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador"),
        itemPayments: itemsList,
        observaciones: obsFinal
      };

      await ReceiptPrintService.generatePDF(pagoPayload, patientPayload, clinic, userProfile);
    } catch (e) {
      console.error("Error generating egreso PDF:", e);
      toast.error("Error al preparar la impresión del comprobante");
    }
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
                  <th className="py-3 px-4 w-28">Fecha</th>
                  <th className="py-3 px-4 w-20">Doc.</th>
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
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-medium">
                      Cargando pagos...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
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
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {p.consecutivo || p.numero || p.nroConsecutivo || (p.id && String(p.id).replace(/\D/g, "").slice(-4)) || "—"}
                      </td>
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
