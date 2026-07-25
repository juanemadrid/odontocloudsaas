import React, { useState, useEffect, useMemo } from "react";
import {
  FiPlus, FiSearch, FiDownload, FiPrinter, FiRefreshCw,
  FiFileText, FiCalendar, FiCheck, FiAlertCircle, FiClock,
} from "react-icons/fi";
import {
  collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { getDianStatusLabel } from "../../../services/DianService";
import factusService from "../../../services/factusService";
import FacturaElectronicaForm from "./FacturaElectronicaForm";

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

const StatusBadge = ({ status }) => {
  const { label, color } = getDianStatusLabel(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${color}`}>
      {label}
    </span>
  );
};

const KpiCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-5 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color}`}>
      <Icon size={20} className="text-white" />
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xl font-black text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 font-bold">{sub}</p>}
    </div>
  </div>
);

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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [desde, setDesde] = useState(firstOfMonth);
  const [hasta, setHasta] = useState(todayStr);
  const [downloadingId, setDownloadingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  const loadFacturas = async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "facturas_electronicas"),
        where("inquilino", "==", inquilino),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setFacturas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      const matchSearch = !search ||
        (f.pacienteNombre || "").toLowerCase().includes(search.toLowerCase()) ||
        (f.factusInvoiceNumber || "").toLowerCase().includes(search.toLowerCase());
      const createdDate = f.createdAt?.toDate ? f.createdAt.toDate() : new Date(f.createdAt || 0);
      const matchDesde = !desde || createdDate >= new Date(desde);
      const matchHasta = !hasta || createdDate <= new Date(hasta + "T23:59:59");
      return matchSearch && matchDesde && matchHasta;
    });
  }, [facturas, search, desde, hasta]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, f) => s + Number(f.total || 0), 0);
    const aceptadas = filtered.filter((f) => f.dianStatus === "ACEPTADA").length;
    const simuladas = filtered.filter((f) => f.dianStatus === "SIMULADA").length;
    const pendientes = filtered.filter(
      (f) => !f.dianStatus || f.dianStatus === "PROCESANDO" || f.dianStatus === "NO_CONFIGURADA"
    ).length;
    return { total, aceptadas, simuladas, pendientes, count: filtered.length };
  }, [filtered]);

  const handleDownloadPDF = async (factura) => {
    if (!factura.factusInvoiceNumber) {
      toast.error("Esta factura no tiene número de Factus asignado.");
      return;
    }
    setDownloadingId(factura.id);
    try {
      const tenantDoc = await getDoc(doc(db, "tenants", inquilino));
      const creds = tenantDoc.exists() ? tenantDoc.data() : {};
      const token = await factusService.getToken({
        factusClientId: creds.factusClientId,
        factusClientSecret: creds.factusClientSecret,
        factusUsername: creds.factusUsername,
        factusPassword: creds.factusPassword,
        factusTestMode: creds.factusTestMode ?? true,
      });
      const blob = await factusService.downloadInvoicePDF(
        factura.factusInvoiceNumber, token, creds.factusTestMode ?? true
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura-${factura.factusInvoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado correctamente.");
    } catch (err) {
      toast.error(`Error al descargar PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleResend = async (factura) => {
    setResendingId(factura.id);
    try {
      const tenantDoc = await getDoc(doc(db, "tenants", inquilino));
      const creds = tenantDoc.exists() ? tenantDoc.data() : {};

      if (!creds.factusClientId || !creds.factusClientSecret || !creds.factusUsername || !creds.factusPassword) {
        toast.error("No hay credenciales Factus configuradas. Ve a Configuración → Facturación Electrónica.");
        return;
      }

      // Mark as PROCESANDO first
      await updateDoc(doc(db, "facturas_electronicas", factura.id), {
        dianStatus: "PROCESANDO",
        updatedAt: serverTimestamp(),
      });

      // Re-build invoiceData from stored factura doc
      const invoiceData = {
        items: factura.items || [],
        total: factura.total,
        subtotal: factura.subtotal,
        descuento: factura.descuento,
        condicionPago: factura.condicionPago || "1",
        medioPago: factura.medioPago || "10",
        referenciaPago: factura.referenciaPago || "",
        observaciones: factura.observaciones || "",
        factusReferenceCode: `OC-${Date.now().toString(36).toUpperCase()}`,
      };

      const patientData = {
        nombre: factura.pacienteNombre?.split(" ")[0] || "",
        apellido: factura.pacienteNombre?.split(" ").slice(1).join(" ") || "",
        documento: factura.pacienteDocumento || "",
        tipoDocumento: factura.pacienteTipoDocumento || "CC",
        email: factura.pacienteEmail || "correo@prueba.com",
        telefono: factura.pacienteTelefono || "3001234567",
        direccion: factura.pacienteDireccion || "",
        ciudad: factura.pacienteCiudad || "",
      };

      const tenantCreds = {
        factusClientId: creds.factusClientId,
        factusClientSecret: creds.factusClientSecret,
        factusUsername: creds.factusUsername,
        factusPassword: creds.factusPassword,
        factusTestMode: creds.factusTestMode ?? true,
        factusNumberingRangeId: creds.factusNumberingRangeId || 1,
      };

      const result = await factusService.sendInvoice(invoiceData, patientData, tenantCreds);

      // Extract bill data with fallbacks
      const bill = result?.data?.bill || result?.bill || result?.data || {};
      const cufe   = bill?.cufe || bill?.cude || result?.data?.cufe || null;
      const qrCode = bill?.qr_code || bill?.qr || result?.data?.qr_code || null;
      const number = bill?.number || bill?.invoice_number || result?.data?.number || null;
      const isTestMode = tenantCreds.factusTestMode;

      await updateDoc(doc(db, "facturas_electronicas", factura.id), {
        dianStatus: isTestMode ? "SIMULADA" : "ACEPTADA",
        cufe,
        qrCode,
        factusInvoiceNumber: number,
        factusReferenceCode: invoiceData.factusReferenceCode,
        factusResponse: result?.data || null,
        updatedAt: serverTimestamp(),
      });

      toast.success(`Factura reenviada con éxito.${number ? ` Número: ${number}` : ''}`);
      await loadFacturas();
    } catch (err) {
      console.error("Error al reenviar factura:", err);
      await updateDoc(doc(db, "facturas_electronicas", factura.id), {
        dianStatus: "RECHAZADA",
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      toast.error(`Error al reenviar: ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

  const handlePrint = (factura) => {
    const tenant = userProfile?.tenant || {};
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) { toast.error("No se pudo abrir ventana de impresión."); return; }
    const items = (factura.items || []).map((it) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${it.descripcion || it.nombre || "Servicio"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${it.cantidad || 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">$${Number(it.precioUnitario || 0).toLocaleString("es-CO")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${it.descuento || 0}%</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">$${Number(it.total || it.precioUnitario || 0).toLocaleString("es-CO")}</td>
      </tr>`).join("");
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Factura Electrónica</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#222}h1{font-size:20px;margin:0}.header{display:flex;justify-content:space-between;margin-bottom:24px;border-bottom:2px solid #2563eb;padding-bottom:16px}.section{margin-bottom:16px}.label{font-size:11px;font-weight:900;color:#888;text-transform:uppercase;letter-spacing:.08em}.value{font-size:13px;font-weight:600;color:#111}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#f1f5f9;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;text-align:left}td{font-size:12px}.totals{text-align:right;margin-top:16px}.cufe{word-break:break-all;font-size:10px;color:#555;background:#f8fafc;padding:8px;border-radius:6px;margin-top:12px}.dian-note{font-size:10px;color:#16a34a;margin-top:8px;font-weight:600}@media print{button{display:none}}</style>
      </head><body>
      <div class="header">
        <div><h1>${tenant.nombreComercial || tenant.nombre || "Clínica Dental"}</h1>
          <p class="label">NIT: <span class="value">${tenant.nit || "—"}</span></p>
          <p class="label">Dirección: <span class="value">${tenant.direccion || "—"}</span></p>
          <p class="label">Teléfono: <span class="value">${tenant.telefono || "—"}</span></p>
        </div>
        <div style="text-align:right">
          <p class="label">Factura Electrónica</p>
          <p style="font-size:22px;font-weight:900;color:#2563eb">${factura.factusInvoiceNumber || factura.id?.slice(-8)}</p>
          <p class="label">Fecha: <span class="value">${fmtDate(factura.createdAt)}</span></p>
        </div>
      </div>
      <div class="section"><p class="label">Paciente</p>
        <p class="value">${factura.pacienteNombre || "—"}</p>
        <p class="label">Documento: <span class="value">${factura.pacienteDocumento || "—"}</span></p>
      </div>
      <table><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Dto.</th><th>Total</th></tr></thead>
      <tbody>${items}</tbody></table>
      <div class="totals">
        <p><strong>Subtotal:</strong> $${Number(factura.subtotal || factura.total || 0).toLocaleString("es-CO")}</p>
        ${factura.descuento ? `<p><strong>Descuento:</strong> $${Number(factura.descuento).toLocaleString("es-CO")}</p>` : ""}
        <p style="font-size:18px;font-weight:900;color:#2563eb"><strong>TOTAL:</strong> $${Number(factura.total || 0).toLocaleString("es-CO")} COP</p>
      </div>
      ${factura.cufe ? `<div class="cufe"><strong>CUFE:</strong> ${factura.cufe}</div>` : ""}
      ${factura.qrCode ? `<div class="cufe"><strong>QR:</strong> ${factura.qrCode}</div>` : ""}
      <p class="dian-note">✓ Factura electrónica de venta — Verificar validez en https://catalogo-vpfe.dian.gov.co</p>
      <script>window.onload=()=>window.print();</script></body></html>`);
    printWindow.document.close();
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Facturas Electrónicas</h2>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">Emisión y gestión ante la DIAN vía Factus</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-[18px] font-black text-[11px] uppercase tracking-widest shadow-md shadow-blue-100 hover:bg-blue-700 transition-all"
        >
          <FiPlus size={15} /> Nueva Factura Electrónica
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Facturado" value={fmt(kpis.total)} sub={`${kpis.count} facturas`} icon={FiFileText} color="bg-blue-500" />
        <KpiCard label="Aceptadas" value={kpis.aceptadas} icon={FiCheck} color="bg-green-500" />
        <KpiCard label="Simuladas" value={kpis.simuladas} icon={FiClock} color="bg-amber-400" />
        <KpiCard label="Pendientes" value={kpis.pendientes} icon={FiAlertCircle} color="bg-orange-400" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente o número..."
              className="w-full h-11 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiCalendar size={14} className="text-slate-400" />
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all" />
            <span className="text-slate-400 text-sm">—</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all" />
          </div>
          <button onClick={loadFacturas} className="h-11 w-11 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100 transition-all">
            <FiRefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando facturas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FiFileText size={36} className="text-slate-200" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin facturas en el período seleccionado</p>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-[14px] font-black text-[11px] uppercase tracking-widest mt-2">
              <FiPlus size={13} /> Nueva Factura
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest px-5 py-4">Número</th>
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Paciente</th>
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Fecha</th>
                  <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Total</th>
                  <th className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-4">Estado</th>
                  <th className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-5 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-black text-blue-600">
                        {f.factusInvoiceNumber || f.id?.slice(-8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-sm font-bold text-slate-700">{f.pacienteNombre || "—"}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{f.pacienteDocumento}</p>
                    </td>
                    <td className="px-3 py-3.5 text-xs font-bold text-slate-500">{fmtDate(f.createdAt)}</td>
                    <td className="px-3 py-3.5 text-right text-sm font-black text-slate-800">{fmt(f.total)}</td>
                    <td className="px-3 py-3.5 text-center"><StatusBadge status={f.dianStatus} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handlePrint(f)} title="Imprimir" className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-all">
                          <FiPrinter size={13} />
                        </button>
                        {(f.dianStatus === "ACEPTADA" || f.dianStatus === "SIMULADA") && f.factusInvoiceNumber && (
                          <button onClick={() => handleDownloadPDF(f)} disabled={downloadingId === f.id} title="Descargar PDF"
                            className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-all disabled:opacity-50">
                            {downloadingId === f.id ? <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <FiDownload size={13} />}
                          </button>
                        )}
                        {f.dianStatus === "RECHAZADA" && (
                          <button onClick={() => handleResend(f)} disabled={resendingId === f.id} title="Reenviar"
                            className="w-8 h-8 rounded-lg bg-orange-50 hover:bg-orange-100 flex items-center justify-center text-orange-600 transition-all disabled:opacity-50">
                            {resendingId === f.id ? <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" /> : <FiRefreshCw size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
