import React, { useState, useEffect, useCallback } from "react";
import { FiCreditCard, FiSearch, FiCalendar, FiPrinter, FiTrash2, FiPlus, FiHome, FiFileText, FiAlertTriangle, FiSlash, FiX } from "react-icons/fi";
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

  // Estado para el modal de anulación
  const [pagoAAnular, setPagoAAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);

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

      try {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        const cfgList = cfgRow?.config?.pagos_proveedor || [];
        if (cfgList.length > 0) {
          const map = new Map();
          list.forEach(p => map.set(p.id, p));
          cfgList.forEach(p => {
            if (!map.has(p.id)) map.set(p.id, p);
          });
          list = Array.from(map.values());
        }
      } catch (e) {}

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

  const handleOpenAnularModal = (pago) => {
    if (pago.anulado || (pago.estado || "").toLowerCase() === "anulado") {
      toast.info("Este egreso ya se encuentra anulado");
      return;
    }
    setPagoAAnular(pago);
    setMotivoAnulacion("");
  };

  const handleConfirmarAnulacion = async () => {
    if (!pagoAAnular) return;
    if (!motivoAnulacion.trim()) {
      toast.error("Por favor ingrese el motivo de anulación");
      return;
    }

    setAnulando(true);
    const pago = pagoAAnular;
    const motivo = motivoAnulacion.trim();
    const ahoraIso = new Date().toISOString();
    const nombreUsuario = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador";

    try {
      const anulacionPayload = {
        estado: "anulado",
        anulado: true,
        motivo_anulacion: motivo,
        motivoAnulacion: motivo,
        fecha_anulacion: ahoraIso,
        fechaAnulacion: ahoraIso,
        anulado_por: nombreUsuario,
        anuladoPor: nombreUsuario,
        updated_at: ahoraIso
      };

      // 1. Actualizar en tabla pagos_proveedor en Supabase
      try {
        await supabase
          .from("pagos_proveedor")
          .update(anulacionPayload)
          .eq("id", pago.id);
      } catch (e) {
        console.warn("Aviso actualizando pagos_proveedor en DB:", e);
      }

      // 2. Sincronizar en website_config (pagos_proveedor)
      try {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        const currCfg = cfgRow?.config || {};
        const currPp = currCfg.pagos_proveedor || [];
        const consStr = String(pago.consecutivo || pago.numero || pago.nroConsecutivo || "").trim();

        const updatedPp = (currPp || []).map(p => {
          const matchId = p.id === pago.id;
          const matchCons = consStr && String(p.consecutivo || p.numero || p.nroConsecutivo || "").trim() === consStr;
          if (matchId || matchCons) {
            return { ...p, ...anulacionPayload };
          }
          return p;
        });

        if (!updatedPp.some(p => p.id === pago.id)) {
          updatedPp.unshift({ ...pago, ...anulacionPayload });
        }

        currCfg.pagos_proveedor = updatedPp;
        await supabase
          .from("website_config")
          .upsert({ tenant_id: inquilino, config: currCfg });
      } catch (e) {
        console.warn("Aviso actualizando pagos_proveedor en config:", e);
      }

      // 3. Sincronizar con el módulo de Caja
      const montoNum = Number(pago.monto || pago.total || 0);
      const consStr = String(pago.consecutivo || pago.numero || pago.nroConsecutivo || "").trim();

      let targetMovs = [];
      try {
        const { data: mData } = await supabase
          .from("movimientos_caja")
          .select("*")
          .eq("tenant_id", inquilino)
          .eq("tipo", "egreso");

        if (mData && mData.length > 0) {
          targetMovs = mData.filter(m => {
            if (m.id === pago.id || m.pago_id === pago.id || m.pagoId === pago.id) return true;
            if (consStr && (
              String(m.numero_comprobante || "").trim() === consStr ||
              String(m.consecutivo || "").trim() === consStr ||
              String(m.nro_consecutivo || "").trim() === consStr ||
              (m.concepto && m.concepto.includes(consStr)) ||
              (m.referencia && m.referencia.includes(consStr))
            )) return true;
            return false;
          });

          // Si no coincidió por ID o consecutivo, buscar por monto y fecha
          if (targetMovs.length === 0) {
            const pFecha = (pago.fecha || pago.created_at || "").split("T")[0];
            const candidate = mData.find(m => {
              const mFecha = (m.fecha || m.created_at || "").split("T")[0];
              const isNotAnulado = (m.estado || "").toLowerCase() !== "anulado" && !m.anulado;
              return isNotAnulado && Math.abs(Number(m.monto || 0) - montoNum) < 0.01 && mFecha === pFecha;
            });
            if (candidate) targetMovs = [candidate];
          }
        }
      } catch (e) {
        console.warn("Aviso consultando movimientos_caja:", e);
      }

      // Marcar los movimientos como anulados en movimientos_caja
      for (const mov of targetMovs) {
        try {
          await supabase
            .from("movimientos_caja")
            .update({
              estado: "anulado",
              anulado: true,
              motivo_anulacion: motivo,
              observaciones: `Egreso anulado: ${motivo}`,
              updated_at: ahoraIso
            })
            .eq("id", mov.id);
        } catch (e) {
          console.warn("Aviso actualizando movimiento_caja:", e);
        }
      }

      // Reintegrar valores a la Caja (cajas y website_config.cajas)
      try {
        const { data: dbCajas } = await supabase
          .from("cajas")
          .select("*")
          .eq("tenant_id", inquilino);

        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();

        const cfgCajas = cfgRow?.config?.cajas || [];
        const allCajas = [...(dbCajas || []), ...cfgCajas];

        const cajaIdAfectada = targetMovs[0]?.caja_id || targetMovs[0]?.cajaId || pago.caja_id || pago.cajaId;
        let cajaAfectada = null;

        if (cajaIdAfectada) {
          cajaAfectada = allCajas.find(c => c.id === cajaIdAfectada);
        }
        if (!cajaAfectada && pago.bancoCaja) {
          cajaAfectada = allCajas.find(c => (c.nombre || "").toLowerCase() === (pago.bancoCaja || "").toLowerCase());
        }
        if (!cajaAfectada) {
          cajaAfectada = allCajas.find(c => c.estado === "abierta" || c.abierta) || allCajas[0];
        }

        if (cajaAfectada && cajaAfectada.id) {
          const prevSaldo = Number(cajaAfectada.saldo_actual ?? cajaAfectada.saldoActual ?? 0);
          const prevEgresos = Number(cajaAfectada.total_egresos ?? cajaAfectada.totalEgresos ?? 0);
          const newSaldo = prevSaldo + montoNum;
          const newEgresos = Math.max(0, prevEgresos - montoNum);

          // Actualizar en tabla cajas
          try {
            await supabase
              .from("cajas")
              .update({
                saldo_actual: newSaldo,
                saldoActual: newSaldo,
                total_egresos: newEgresos,
                totalEgresos: newEgresos,
                updated_at: ahoraIso
              })
              .eq("id", cajaAfectada.id);
          } catch (e) {
            console.warn("Aviso actualizando tabla cajas:", e);
          }

          // Actualizar en website_config.cajas
          try {
            const currCfg = cfgRow?.config || {};
            if (Array.isArray(currCfg.cajas)) {
              currCfg.cajas = currCfg.cajas.map(c => {
                if (c.id === cajaAfectada.id) {
                  return {
                    ...c,
                    saldo_actual: newSaldo,
                    saldoActual: newSaldo,
                    total_egresos: newEgresos,
                    totalEgresos: newEgresos,
                    updated_at: ahoraIso
                  };
                }
                return c;
              });
              await supabase
                .from("website_config")
                .upsert({ tenant_id: inquilino, config: currCfg });
            }
          } catch (e) {
            console.warn("Aviso actualizando config.cajas:", e);
          }
        }
      } catch (e) {
        console.warn("Aviso recalculando saldos de caja:", e);
      }

      // 4. Si amortizó facturas de compra, restaurar saldo pendiente
      if (Array.isArray(pago.items)) {
        for (const it of pago.items) {
          if (it.isFactura && it.facturaId) {
            try {
              const { data: fc } = await supabase
                .from("facturas_compra")
                .select("*")
                .eq("id", it.facturaId)
                .maybeSingle();

              if (fc) {
                const sPrev = Number(fc.saldo_pendiente ?? fc.saldoPendiente ?? 0);
                const abono = Number(it.total || it.precioUnitario || 0);
                const restored = sPrev + abono;
                await supabase
                  .from("facturas_compra")
                  .update({
                    saldo_pendiente: restored,
                    saldoPendiente: restored,
                    estado: "Pendiente",
                    updated_at: ahoraIso
                  })
                  .eq("id", it.facturaId);
              }
            } catch (e) {
              console.warn("Aviso restaurando factura de compra:", e);
            }
          }
        }
      }

      // 5. Actualizar en el estado local (CONSERVA EL CONSECUTIVO Y EL REGISTRO)
      setPagos(prev => prev.map(p => {
        if (p.id === pago.id) {
          return {
            ...p,
            ...anulacionPayload
          };
        }
        return p;
      }));

      toast.success(`Egreso #${consStr || pago.id} anulado. Consecutivo conservado y valores de caja actualizados.`);
      setPagoAAnular(null);
    } catch (e) {
      console.error("Error al anular pago:", e);
      toast.error("Error al anular el registro de pago");
    } finally {
      setAnulando(false);
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

      const isAnulado = pago.anulado || (pago.estado || "").toLowerCase() === "anulado";
      const motivoAnulacionTexto = pago.motivo_anulacion || pago.motivoAnulacion || "";

      const pagoPayload = {
        ...pago,
        tipo: "egreso",
        tipoDocumento: "Egreso",
        documentTitle: isAnulado ? "COMPROBANTE DE EGRESO (ANULADO)" : "COMPROBANTE DE EGRESO",
        monto: Number(pago.monto || pago.total || 0),
        concepto: (itemsList && itemsList[0]?.desc) || pago.concepto || "Egreso / Pago a proveedor",
        nroConsecutivo: pago.consecutivo || pago.numero || (pago.id && String(pago.id).replace(/\D/g, "").slice(-4)) || "S/N",
        medio: pago.medioPago || pago.bancoCaja || "Efectivo",
        registradoPor: (userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador"),
        itemPayments: itemsList,
        observaciones: isAnulado
          ? `*** DOCUMENTO ANULADO: ${motivoAnulacionTexto || "Anulado por administración"} ***${obsFinal ? ` — ${obsFinal}` : ""}`
          : obsFinal
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
                  <th className="py-3 px-4 w-24">Doc.</th>
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
                  filtered.map(p => {
                    const isAnulado = p.anulado || (p.estado || "").toLowerCase() === "anulado";
                    const motivoAnul = p.motivo_anulacion || p.motivoAnulacion || "";
                    const docConsecutivo = p.consecutivo || p.numero || p.nroConsecutivo || (p.id && String(p.id).replace(/\D/g, "").slice(-4)) || "—";

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isAnulado ? "bg-rose-50/40 hover:bg-rose-50/70" : "hover:bg-slate-50/50"
                        }`}
                      >
                        <td className="py-3 px-4 font-medium text-slate-500">{fmtDate(p.fecha)}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className={`font-mono font-bold ${isAnulado ? "text-slate-500" : "text-slate-700"}`}>
                              {docConsecutivo}
                            </span>
                            {isAnulado && (
                              <span className="inline-block w-fit px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black uppercase tracking-wider">
                                ANULADO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`py-3 px-4 font-bold uppercase ${isAnulado ? "text-slate-400" : "text-slate-800"}`}>
                          {p.proveedor || p.tercero || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex flex-col">
                            <span className={isAnulado ? "text-slate-400" : "text-slate-700"}>
                              {p.items && p.items.length > 0 ? p.items[0]?.concepto : (p.concepto || "Egreso / Pago")}
                              {p.items && p.items.length > 1 && (
                                <span className="ml-1 text-[10px] text-slate-400 font-normal">
                                  (+{p.items.length - 1} más)
                                </span>
                              )}
                            </span>
                            {isAnulado && motivoAnul && (
                              <span className="text-[10px] text-rose-600 font-semibold mt-0.5" title={`Motivo: ${motivoAnul}`}>
                                Motivo anulación: {motivoAnul}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-medium ${
                            isAnulado ? "bg-rose-100/60 text-rose-600" : "bg-slate-100 text-slate-600"
                          }`}>
                            {p.medioPago || p.bancoCaja || "Efectivo"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          {isAnulado ? (
                            <span className="line-through text-slate-400" title="Egreso anulado (no resta del saldo de caja)">
                              {fmt(p.monto || p.total)}
                            </span>
                          ) : (
                            <span className="text-slate-800">{fmt(p.monto || p.total)}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintPago(p)}
                              className="w-7 h-7 rounded bg-slate-50 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                              title={isAnulado ? "Imprimir Comprobante (Anulado)" : "Imprimir Comprobante"}
                            >
                              <FiPrinter size={13} />
                            </button>
                            {isAnulado ? (
                              <button
                                type="button"
                                disabled
                                className="w-7 h-7 rounded bg-rose-50 text-rose-400 cursor-not-allowed flex items-center justify-center"
                                title={`Egreso Anulado: ${motivoAnul || "Sin motivo especificado"}`}
                              >
                                <FiSlash size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenAnularModal(p)}
                                className="w-7 h-7 rounded bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                                title="Anular Egreso"
                              >
                                <FiTrash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal de Anulación de Egreso */}
      {pagoAAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                <FiAlertTriangle size={20} />
                <span>Anular Comprobante de Egreso</span>
              </div>
              <button
                type="button"
                onClick={() => { if (!anulando) setPagoAAnular(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 leading-relaxed">
                <p className="font-semibold text-amber-900 mb-1">
                  ⚠️ ¿Está seguro de anular este egreso?
                </p>
                <p>
                  El registro <strong>no se eliminará</strong> para conservar la correlación de consecutivos numéricos y auditoría. Se marcará como <strong>ANULADO</strong> y el valor de <strong>{fmt(pagoAAnular.monto || pagoAAnular.total)}</strong> se reintegrará automáticamente al saldo del módulo de caja.
                </p>
              </div>

              {/* Resumen del Egreso */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Documento / Consecutivo:</span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    #{pagoAAnular.consecutivo || pagoAAnular.numero || pagoAAnular.nroConsecutivo || (pagoAAnular.id && String(pagoAAnular.id).replace(/\D/g, "").slice(-4)) || pagoAAnular.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proveedor / Tercero:</span>
                  <span className="text-slate-800 font-bold">{pagoAAnular.proveedor || pagoAAnular.tercero || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Medio de Pago / Caja:</span>
                  <span className="text-slate-800 font-medium">{pagoAAnular.medioPago || pagoAAnular.bancoCaja || "Efectivo"}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 items-baseline">
                  <span className="text-slate-700 font-bold">Monto a reintegrar:</span>
                  <span className="text-rose-600 font-extrabold text-sm">
                    {fmt(pagoAAnular.monto || pagoAAnular.total)}
                  </span>
                </div>
              </div>

              {/* Campo Motivo de Anulación */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Motivo de la anulación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Indique detalladamente la razón por la cual se anula este egreso (ej. error en digitación, pago duplicado, egreso no realizado)..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={anulando}
                onClick={() => setPagoAAnular(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={anulando || !motivoAnulacion.trim()}
                onClick={handleConfirmarAnulacion}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {anulando ? "Anulando egreso..." : "Confirmar Anulación"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
