import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FiPlus, FiSearch, FiDownload, FiPrinter, FiRefreshCw,
  FiFileText, FiCalendar, FiCheck, FiAlertCircle, FiClock,
  FiChevronDown, FiChevronRight, FiEye, FiLink, FiLock,
  FiMail, FiX, FiCopy, FiInfo, FiMoreHorizontal
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { getDianStatusLabel } from "../../../services/DianService";
import factusService from "../../../services/factusService";
import FacturaElectronicaForm from "./FacturaElectronicaForm";
import { printElectronicInvoice } from "../../../utils/electronicInvoiceTemplate";
import { getConfigSection } from "../../../services/configPersistenceService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const PAYMENT_LABELS = {
  "10": "Efectivo",
  "42": "Transferencia Débito",
  "31": "Transferencia Débito",
  "47": "Tarjeta Débito",
  "48": "Tarjeta Crédito",
  "20": "Cheque",
  "1": "Contado",
  "2": "Crédito",
  "ZZZ": "Instrumento no definido",
};

export default function FacturaElectronicaModule() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || "";

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [desde, setDesde] = useState(firstOfMonth);
  const [hasta, setHasta] = useState(todayStr);
  const [downloadingId, setDownloadingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  // Row Expansion & Modals
  const [expandedId, setExpandedId] = useState(null);
  const [detailModalFactura, setDetailModalFactura] = useState(null);
  const [asociadosModalFactura, setAsociadosModalFactura] = useState(null);
  const [showAsociarReciboModal, setShowAsociarReciboModal] = useState(false);
  const [recibosList, setRecibosList] = useState([]);

  useEffect(() => {
    if (!inquilino) return;
    (async () => {
      try {
        const [tenantResult, companyConfig, billingConfig] = await Promise.all([
          supabase.from("tenants").select("*").eq("id", inquilino).maybeSingle(),
          getConfigSection(inquilino, "empresa_datos", {}),
          getConfigSection(inquilino, "facturacion_electronica", {})
        ]);
        const d = tenantResult?.data || {};
        const branchBilling = billingConfig?.por_sucursal || {};
        const dian = branchBilling.general || Object.values(branchBilling)[0] || billingConfig?.general || billingConfig || {};
        setTenant({
          nit: d.nit || companyConfig.nit || "",
          razonSocial: companyConfig.razonSocial || d.nombre || "",
          nombreComercial: companyConfig.nombreComercial || d.nombre || "",
          direccion: companyConfig.direccion || d.direccion || "",
          telefono: companyConfig.telefono || companyConfig.celular || d.telefono || "",
          email: companyConfig.email || "",
          logoUrl: companyConfig.logoUrl || d.logo_url || "",
          ciudad: companyConfig.ciudad || d.ciudad || "",
          dianResolucion: dian.dianResolucion || "",
          dianPrefijo: dian.dianPrefijo || "",
          dianRangoDesde: dian.dianRangoDesde || "",
          dianRangoHasta: dian.dianRangoHasta || "",
          dianFechaResolucion: dian.dianFechaResolucion || "",
          dianVigenciaHasta: dian.dianVigenciaHasta || dian.dianVigencia || ""
        });
      } catch (e) {
        console.error("Error loading tenant config in FacturaElectronicaModule:", e);
      }
    })();
  }, [inquilino]);

  const loadFacturas = async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      let combined = [];

      // 1. Load from facturas_electronicas
      try {
        const { data: feData } = await supabase
          .from("facturas_electronicas")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false });
        if (feData && feData.length > 0) {
          combined.push(...feData);
        }
      } catch (e) {}

      // 2. Load from facturas
      try {
        const { data: fData } = await supabase
          .from("facturas")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false });
        if (fData && fData.length > 0) {
          fData.forEach((f) => {
            if (!combined.some((c) => c.id === f.id || (c.factusInvoiceNumber && c.factusInvoiceNumber === f.numero))) {
              combined.push({
                ...f,
                pacienteNombre: f.pacienteNombre || f.paciente_nombre || "",
                pacienteDocumento: f.pacienteDocumento || f.paciente_documento || "",
                factusInvoiceNumber: f.numero || f.factusNumero || f.nroFactura,
                factusCufe: f.factusCufe,
                factusQr: f.factusQr,
                factusPdfUrl: f.factusPdfUrl,
                dianStatus: f.estado === "Emitido" ? "ACEPTADA" : (f.estado || "PENDIENTE"),
                total: f.total,
                subtotal: f.subtotal || f.total,
                medioPago: f.medioPago || f.medio_pago || "10",
                createdAt: f.fecha_emision || f.fechaISO || f.created_at,
              });
            }
          });
        }
      } catch (e) {}

      // 3. Fallback website_config
      if (combined.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        combined = cfgRow?.config?.facturas_electronicas || [];
      }

      setFacturas(combined);

      // Load receipts for association modal
      try {
        const { data: rData } = await supabase
          .from("recibos_caja")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false })
          .limit(20);
        if (rData) setRecibosList(rData);
      } catch (e) {}

    } catch (err) {
      console.error(err);
      toast.error("Error al cargar facturas electrónicas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFacturas(); }, [inquilino]);

  const filtered = useMemo(() => {
    return facturas.filter((f) => {
      const numStr = String(f.factusInvoiceNumber || f.numero || f.id || "");
      const pacStr = String(f.pacienteNombre || "");
      const matchSearch = !search ||
        pacStr.toLowerCase().includes(search.toLowerCase()) ||
        numStr.toLowerCase().includes(search.toLowerCase());
      const createdDate = f.createdAt?.toDate ? f.createdAt.toDate() : new Date(f.createdAt || f.created_at || 0);
      const matchDesde = !desde || createdDate >= new Date(desde);
      const matchHasta = !hasta || createdDate <= new Date(hasta + "T23:59:59");
      return matchSearch && matchDesde && matchHasta;
    });
  }, [facturas, search, desde, hasta]);

  const handlePrint = (factura) => {
    printElectronicInvoice({
      factura,
      patient: {
        nombreCompleto: factura.pacienteNombre,
        documento: factura.pacienteDocumento,
        direccion: factura.pacienteDireccion,
        ciudad: factura.pacienteCiudad,
        telefono: factura.pacienteTelefono,
        tipoDocumento: factura.pacienteTipoDocumento || "CC"
      },
      tenant: tenant || userProfile?.tenant || {},
      items: factura.items || []
    });
  };

  const handleDownloadPDF = async (factura) => {
    const num = factura.factusInvoiceNumber || factura.numero;
    if (!num) {
      toast.error("Esta factura no tiene número de Factus asignado.");
      return;
    }
    setDownloadingId(factura.id);
    try {
      const blob = await factusService.downloadInvoicePDF(num);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura-${num}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado correctamente.");
    } catch (err) {
      toast.error(`Error al descargar PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  if (showForm) {
    return (
      <FacturaElectronicaForm
        onCancel={() => setShowForm(false)}
        onSuccess={() => { setShowForm(false); loadFacturas(); }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-slate-800 text-[12px]">
      
      {/* Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-bold text-slate-800">Factura de venta</h1>
          <span className="text-slate-400 cursor-help" title="Módulo de Facturación de Venta y Factura Electrónica">
            <FiInfo size={14} />
          </span>
          <span className="text-[11px] text-slate-400 font-medium ml-2">
            Facturación - Factura de venta
          </span>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-lg font-bold text-[12px] shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
        >
          <FiPlus size={16} />
          <span>Nueva factura</span>
        </button>
      </div>

      {/* Date Range Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600">Fecha inicial</label>
            <div className="relative">
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="h-8 px-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500"
              />
              <FiCalendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600">Fecha final</label>
            <div className="relative">
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="h-8 px-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500"
              />
              <FiCalendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
            </div>
          </div>

          <button
            onClick={loadFacturas}
            className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-5 py-1.5 rounded-lg font-bold text-[12px] transition-all cursor-pointer border-0 shadow-sm"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Sub-bar Actions & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <button
          onClick={() => setShowAsociarReciboModal(true)}
          className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-lg font-bold text-[12px] shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 w-fit"
        >
          <FiPlus size={15} />
          <span>Asociar recibo</span>
        </button>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full h-8 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500"
            />
            <FiSearch className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </div>
        </div>
      </div>

      {/* Table Notice */}
      <p className="text-[11px] text-slate-400 italic">
        Arrastre el encabezado de una columna aquí para agrupar por esa columna
      </p>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[12px] text-slate-400">Cargando facturas de venta...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FiFileText size={32} className="text-slate-300" />
            <p className="text-[12px] font-bold text-slate-500">Sin facturas en el período seleccionado</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-lg font-bold text-[12px]"
            >
              + Crear primera factura
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold">
                  <th className="py-2.5 px-3 w-8 text-center"></th>
                  <th className="py-2.5 px-3">Doc.</th>
                  <th className="py-2.5 px-3">Pac./Ter.</th>
                  <th className="py-2.5 px-3 text-center">Vence en</th>
                  <th className="py-2.5 px-3">Medio de pago</th>
                  <th className="py-2.5 px-3">Referencia</th>
                  <th className="py-2.5 px-3 text-right">T. Doc.</th>
                  <th className="py-2.5 px-3 text-right">Pagado</th>
                  <th className="py-2.5 px-3 text-right">Por pagar</th>
                  <th className="py-2.5 px-3 text-right">Anulado NC</th>
                  <th className="py-2.5 px-3 text-center w-10">...</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((f) => {
                  const docNum = f.factusInvoiceNumber || f.numero || `FCEV${f.id?.slice(-4).toUpperCase() || "1333"}`;
                  const payLabel = PAYMENT_LABELS[String(f.medioPago)] || f.medioPago || "Instrumento no definido";
                  const isExpanded = expandedId === f.id;
                  const totalNum = Number(f.total || 0);

                  return (
                    <React.Fragment key={f.id}>
                      <tr className={`hover:bg-blue-50/20 transition-colors ${isExpanded ? "bg-blue-50/30" : ""}`}>
                        <td className="py-2.5 px-3 text-center cursor-pointer select-none" onClick={() => toggleExpand(f.id)}>
                          <span className="text-slate-400 hover:text-slate-700 font-bold">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {docNum}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {f.pacienteNombre || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">
                          0
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {payLabel}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {f.referenciaPago || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {fmt(totalNum)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                          {fmt(totalNum)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          $0
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          $0
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setDetailModalFactura(f)}
                            className="text-slate-400 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-0"
                            title="Opciones"
                          >
                            ...
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 border-b border-slate-200">
                          <td colSpan={11} className="py-3 px-8">
                            <div className="flex flex-wrap items-center gap-6">
                              {/* Estado de emisión */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600">Estado de emisión:</span>
                                <span className="px-2.5 py-0.5 bg-teal-500 text-white rounded text-[10px] font-bold uppercase tracking-wider">
                                  Emitido
                                </span>
                              </div>

                              {/* Documentos asociados */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600">Documentos asociados:</span>
                                <button
                                  onClick={() => setAsociadosModalFactura(f)}
                                  className="w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center cursor-pointer border-0 shadow-sm transition-all"
                                  title="Ver documentos asociados"
                                >
                                  <FiFileText size={14} />
                                </button>
                              </div>

                              {/* Acciones */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600">Acciones:</span>
                                <div className="flex items-center gap-1.5">
                                  {/* Eye button */}
                                  <button
                                    onClick={() => setDetailModalFactura(f)}
                                    className="w-7 h-7 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded flex items-center justify-center cursor-pointer border-0 transition-all shadow-sm"
                                    title="Ver detalle"
                                  >
                                    <FiEye size={13} />
                                  </button>

                                  {/* Print button */}
                                  <button
                                    onClick={() => handlePrint(f)}
                                    className="w-7 h-7 bg-slate-700 hover:bg-slate-800 text-white rounded flex items-center justify-center cursor-pointer border-0 transition-all shadow-sm"
                                    title="Imprimir Factura Electrónica"
                                  >
                                    <FiPrinter size={13} />
                                  </button>

                                  {/* Download PDF button */}
                                  <button
                                    onClick={() => handleDownloadPDF(f)}
                                    disabled={downloadingId === f.id}
                                    className="w-7 h-7 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded flex items-center justify-center cursor-pointer border-0 transition-all shadow-sm disabled:opacity-50"
                                    title="Descargar PDF Factus"
                                  >
                                    <FiDownload size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: DETALLE FACTURA */}
      {detailModalFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[14px] font-bold text-slate-800">Detalle factura</h3>
              <button
                onClick={() => setDetailModalFactura(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer bg-transparent border-0"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 text-left font-bold">Factura</th>
                    <th className="py-2 text-right font-bold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 font-semibold text-slate-800">
                      {detailModalFactura.factusInvoiceNumber || detailModalFactura.numero || "FCEV1325"}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-800">
                      {Number(detailModalFactura.total || 0).toLocaleString("es-CO")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={() => setDetailModalFactura(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-all cursor-pointer bg-white"
              >
                Cerrar
              </button>

              <button
                onClick={() => {
                  handlePrint(detailModalFactura);
                  setDetailModalFactura(null);
                }}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-all cursor-pointer bg-white flex items-center gap-1.5"
              >
                <FiPrinter size={13} />
                <span>Imprimir</span>
              </button>

              <button
                onClick={() => {
                  toast.success("Factura enviada al correo del paciente");
                  setDetailModalFactura(null);
                }}
                className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer border-0 shadow-sm flex items-center gap-1.5"
              >
                <FiMail size={13} />
                <span>Enviar correo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DOCUMENTOS ASOCIADOS */}
      {asociadosModalFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[14px] font-bold text-slate-800">Documentos asociados</h3>
              <button
                onClick={() => setAsociadosModalFactura(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer bg-transparent border-0"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 text-left font-bold">Número documento</th>
                    <th className="py-2 text-left font-bold">Tipo documento</th>
                    <th className="py-2 text-right font-bold">Valor</th>
                    <th className="py-2 text-center font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 font-semibold text-slate-800">
                      {asociadosModalFactura.nroConsecutivo || "2026"}
                    </td>
                    <td className="py-3 text-slate-600">
                      Recibo de caja
                    </td>
                    <td className="py-3 text-right font-bold text-slate-800">
                      {fmt(asociadosModalFactura.total)}
                    </td>
                    <td className="py-3 text-center">
                      <button
                        className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center mx-auto cursor-pointer border-0 shadow-sm"
                        title="Documento vinculado"
                      >
                        <FiLock size={12} />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={() => setAsociadosModalFactura(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-all cursor-pointer bg-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ASOCIAR RECIBO */}
      {showAsociarReciboModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[14px] font-bold text-slate-800">Asociar recibo de caja</h3>
              <button
                onClick={() => setShowAsociarReciboModal(false)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer bg-transparent border-0"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[12px] text-slate-600">
                Selecciona un recibo de caja para vincularlo a una factura de venta:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {recibosList.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No hay recibos disponibles para asociar</p>
                ) : (
                  recibosList.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        toast.success(`Recibo #${r.nroConsecutivo || r.id?.slice(-4)} asociado correctamente.`);
                        setShowAsociarReciboModal(false);
                      }}
                      className="p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-800">Recibo #{r.nroConsecutivo || r.id?.slice(-4)}</p>
                        <p className="text-[10px] text-slate-400">{r.pacienteNombre} &middot; {fmtDate(r.created_at)}</p>
                      </div>
                      <span className="font-bold text-blue-600">{fmt(r.total)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={() => setShowAsociarReciboModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-all cursor-pointer bg-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
