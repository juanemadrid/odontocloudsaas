// src/modules/caja/components/CajaDetalleView.jsx
// ============================================================
// 📊 Vista Detalle de Caja - OdontoCloud
// Muestra resumen de caja, totales por medio de pago y movimientos.
// Genera e imprime el recibo PDF oficial del sistema OdontoCloud.
// ============================================================
import React, { useState, useEffect } from "react";
import { db } from "../../../firebase/firebaseConfig";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc
} from "firebase/firestore";
import { FiSearch, FiEye, FiArrowLeft, FiFileText, FiPrinter, FiX } from "react-icons/fi";
import { ReceiptPrintService } from "../../../services/ReceiptPrintService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch { return "—"; }
};

export default function CajaDetalleView({ caja, userProfile, onBack }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);
  const [tenantConfig, setTenantConfig] = useState(null);

  // Cargar datos reales de la empresa / inquilino desde Firestore
  useEffect(() => {
    const inquilinoId = userProfile?.inquilino || caja?.inquilino || "";
    if (!inquilinoId) return;
    getDoc(doc(db, "tenants", inquilinoId))
      .then((snap) => {
        if (snap.exists()) {
          setTenantConfig(snap.data());
        }
      })
      .catch((err) => console.error("Error cargando tenant:", err));
  }, [userProfile?.inquilino, caja?.inquilino]);

  // Cargar movimientos en tiempo real
  useEffect(() => {
    if (!caja?.id) return;
    const q = query(
      collection(db, "cajas", caja.id, "movimientos"),
      orderBy("fecha", "desc")
    );

    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando movimientos:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [caja?.id]);

  // Cálculos de totales
  const totalIngresos = movimientos
    .filter(m => m.tipo === "ingreso")
    .reduce((s, m) => s + (m.monto || 0), 0);

  const totalEgresos = movimientos
    .filter(m => m.tipo === "egreso")
    .reduce((s, m) => s + (m.monto || 0), 0);

  // Desglose por Medio de Pago
  const resumenMediosPago = React.useMemo(() => {
    const map = {};
    movimientos.forEach(m => {
      const metodo = m.metodoPago || "Efectivo";
      if (!map[metodo]) {
        map[metodo] = { cantidad: 0, valor: 0 };
      }
      map[metodo].cantidad += 1;
      const signo = m.tipo === "egreso" ? -1 : 1;
      map[metodo].valor += (m.monto || 0) * signo;
    });
    return Object.entries(map).map(([metodo, data]) => ({
      metodo,
      cantidad: data.cantidad,
      valor: data.valor,
    }));
  }, [movimientos]);

  // Filtrar movimientos por búsqueda
  const movsFiltrados = movimientos.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.concepto || "").toLowerCase().includes(q) ||
      (m.pacienteNombre || "").toLowerCase().includes(q) ||
      (m.tercero || "").toLowerCase().includes(q) ||
      (m.metodoPago || "").toLowerCase().includes(q)
    );
  });

  // Datos reales de la clínica / sucursal
  const sucursalNombre = tenantConfig?.nombreComercial || tenantConfig?.name || tenantConfig?.nombre || userProfile?.nombreClinica || userProfile?.inquilino || "Clínica Dental";
  const clinicNit = tenantConfig?.nit || userProfile?.nit || "—";
  const clinicAddress = tenantConfig?.address || tenantConfig?.direccion || userProfile?.direccion || "—";
  const clinicPhone = tenantConfig?.phone || tenantConfig?.telefono || userProfile?.telefono || "—";
  const clinicEmail = tenantConfig?.email || userProfile?.email || "";
  const clinicLogo = tenantConfig?.logo || tenantConfig?.logoUrl || userProfile?.logoUrl || userProfile?.logo || "";

  // Generación oficial del PDF mediante ReceiptPrintService (Plantilla Oficial OdontoCloud)
  const handlePrintMovimiento = async (m) => {
    const mov = m || selectedMovimiento;
    if (!mov) return;

    // 1. Resolver nombre del responsable (evitando mostrar correo electrónico)
    let nombreElaborador = userProfile?.nombreCompleto || userProfile?.nombre || caja.usuarioNombre || mov.usuarioNombre || "Cajero";
    if (nombreElaborador.includes("@")) {
      if (userProfile?.nombreCompleto && !userProfile.nombreCompleto.includes("@")) {
        nombreElaborador = userProfile.nombreCompleto;
      } else if (userProfile?.nombre && !userProfile.nombre.includes("@")) {
        nombreElaborador = userProfile.nombre;
      } else {
        nombreElaborador = nombreElaborador.split("@")[0].toUpperCase();
      }
    }

    // 2. Resolver datos completos del paciente
    let patientData = {
      nombreCompleto: mov.pacienteNombre || mov.tercero || "Cliente / Tercero",
      nroDocumento: mov.pacienteDocumento || mov.documento || "—",
      tipoDocumento: mov.pacienteTipoDoc || mov.tipoDocumento || "CC",
      lugarResidencia: mov.pacienteDireccion || mov.direccion || "—",
      ciudadDomicilio: mov.pacienteCiudad || mov.ciudad || "—",
      celular: mov.pacienteCelular || mov.pacienteTelefono || mov.celular || "—",
    };

    if (mov.pacienteId) {
      try {
        const patientSnap = await getDoc(doc(db, "pacientes", mov.pacienteId));
        if (patientSnap.exists()) {
          const p = patientSnap.data();
          patientData = {
            nombreCompleto: p.nombreCompleto || `${p.nombres || ''} ${p.apellidos || ''}`.trim() || patientData.nombreCompleto,
            nroDocumento: p.nroDocumento || p.documento || patientData.nroDocumento,
            tipoDocumento: p.tipoDocumento || patientData.tipoDocumento,
            lugarResidencia: p.lugarResidencia || p.direccion || patientData.lugarResidencia,
            ciudadDomicilio: p.ciudadDomicilio || p.ciudad || patientData.ciudadDomicilio,
            celular: p.celular || p.telefono || patientData.celular,
          };
        }
      } catch (err) {
        console.error("Error cargando paciente para PDF:", err);
      }
    }

    const pagoData = {
      monto: mov.monto || 0,
      tipo: mov.tipo || "ingreso",
      documentTitle: mov.tipo === "egreso" ? "Egreso" : "Recibo de Caja",
      medio: mov.metodoPago || "Efectivo",
      concepto: mov.concepto || mov.descripcion || (mov.tipo === "egreso" ? "Egreso de Caja" : "Recibo de Caja"),
      notas: mov.descripcion || mov.concepto || "Sin observaciones adicionales",
      fecha: mov.fecha,
      nroConsecutivo: mov.id ? mov.id.slice(0, 6).toUpperCase() : "S/N",
      registradoPor: nombreElaborador,
      planTitle: mov.planTitle || "General",
    };

    const clinicData = {
      inquilino: userProfile?.inquilino || caja?.inquilino || "",
      logo: clinicLogo,
      nombreComercial: sucursalNombre,
      nit: clinicNit,
      direccion: clinicAddress,
      telefono: clinicPhone,
      email: clinicEmail,
    };

    try {
      await ReceiptPrintService.generatePDF(pagoData, patientData, clinicData, userProfile);
    } catch (err) {
      console.error("Error al generar el recibo PDF:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-6 space-y-6">

      {/* Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-1">
            <button onClick={onBack} className="hover:text-blue-600 flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 text-slate-400">
              🏠 <span>Caja</span>
            </button>
            <span className="text-slate-300">&rsaquo;</span>
            <span className="text-slate-600 font-medium">Detalle de caja</span>
          </div>
          <h1 className="text-[22px] font-bold text-slate-800">Detalle de caja</h1>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-md text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer bg-white shadow-sm"
        >
          <FiArrowLeft size={15} /> Volver
        </button>
      </div>

      {/* Card Resumen General ("Hojita") */}
      <div className="bg-white rounded-md border border-slate-200 p-8 shadow-sm max-w-5xl mx-auto">
        
        {/* Encabezado Usuario / Sucursal */}
        <div className="flex items-center gap-8 pb-6 border-b border-slate-100 text-[13px]">
          <div>
            <span className="text-slate-400 font-medium block text-[12px] mb-0.5">Usuario</span>
            <span className="font-bold text-slate-800 uppercase tracking-wide">
              {caja.usuarioNombre || caja.nombre || "—"}
            </span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <span className="text-slate-400 font-medium block text-[12px] mb-0.5">Sucursal</span>
            <span className="font-bold text-slate-800 uppercase tracking-wide">{sucursalNombre}</span>
          </div>
        </div>

        {/* Cifras Principales */}
        <div className="py-6 space-y-2.5 text-[13px] max-w-xl">
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Fecha de Apertura</span>
            <span className="text-slate-700 font-semibold">{fmtDate(caja.fechaApertura)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Base</span>
            <span className="text-slate-700 font-semibold">$0</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Ajuste base</span>
            <span className="text-slate-700 font-semibold">{fmt(caja.baseInicial || 0)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Total Saldo Inicial</span>
            <span className="text-slate-700 font-semibold">{fmt(caja.baseInicial || 0)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Recaudos</span>
            <span className="text-emerald-600 font-semibold">{fmt(totalIngresos)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Gastos</span>
            <span className="text-rose-600 font-semibold">{fmt(totalEgresos)}</span>
          </div>
          <div className="flex justify-between py-2 border-t-2 border-slate-200 mt-3 pt-3">
            <span className="text-slate-800 font-bold">Total caja</span>
            <span className="text-slate-900 font-extrabold text-[15px]">{fmt(caja.saldoActual || 0)}</span>
          </div>
        </div>

        {/* Resumen por Medio de Pago */}
        <div className="pt-6 border-t border-slate-100">
          <div className="max-w-xl">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2.5 px-3 text-left font-bold text-slate-500 text-[12px]">Medio de pago</th>
                  <th className="py-2.5 px-3 text-center font-bold text-slate-500 text-[12px]">Cantidad</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-500 text-[12px]">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumenMediosPago.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-slate-400 text-[12px]">Sin registros de pago</td>
                  </tr>
                ) : (
                  resumenMediosPago.map((item) => (
                    <tr key={item.metodo} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-700">{item.metodo}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{item.cantidad}</td>
                      <td className={`py-2.5 px-3 text-right font-semibold ${item.valor < 0 ? "text-rose-600" : "text-slate-800"}`}>
                        {fmt(item.valor)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Card Movimientos ("Hojita") */}
      <div className="bg-white rounded-md border border-slate-200 shadow-sm p-6 max-w-5xl mx-auto space-y-4">
        
        {/* Header Movimientos */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-[16px] font-bold text-slate-800">Movimientos</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 rounded border border-slate-200 text-[12px] outline-none w-[180px] bg-white text-slate-700 focus:border-blue-400 transition-all placeholder:text-slate-400"
              />
            </div>
            <button
              title="Exportar movimientos"
              className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:text-slate-700 bg-white transition-colors cursor-pointer"
            >
              <FiFileText size={15} />
            </button>
          </div>
        </div>

        {/* Tabla Movimientos */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-[13px]">Cargando movimientos...</p>
            </div>
          ) : movsFiltrados.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-[13px]">
              No hay movimientos registrados en esta caja.
            </div>
          ) : (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  {[
                    { label: "Fecha", w: 140 },
                    { label: "Nombre Tercero/Banco", w: "auto" },
                    { label: "Documento", w: 120 },
                    { label: "Valor", w: 110 },
                    { label: "Medio de pago", w: 120 },
                    { label: "Saldo actual", w: 110 },
                    { label: "Sucursal", w: 150 },
                    { label: "Acciones", w: 80 },
                  ].map((h) => (
                    <th key={h.label} style={{ width: h.w }} className="px-3 py-2.5 text-left font-bold text-slate-500 text-[11px] bg-white">
                      <div>{h.label}</div>
                      {h.label !== "Acciones" && (
                        <div className="mt-0.5">
                          <FiSearch size={10} className="text-slate-300" />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movsFiltrados.map((m) => {
                  const esEgreso = m.tipo === "egreso";
                  const valorFormateado = esEgreso ? `-${fmt(m.monto || 0)}` : fmt(m.monto || 0);
                  const tercero = m.pacienteNombre || m.tercero || m.usuarioNombre || "—";
                  const docText = m.concepto || (esEgreso ? "Egreso" : "Recibo de caja");

                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{fmtDate(m.fecha)}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{tercero}</td>
                      <td className="px-3 py-3 text-slate-600">{docText}</td>
                      <td className={`px-3 py-3 font-semibold ${esEgreso ? "text-rose-600" : "text-emerald-600"}`}>
                        {valorFormateado}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{m.metodoPago || "Efectivo"}</td>
                      <td className="px-3 py-3 text-slate-700 font-medium">{fmt(caja.saldoActual || 0)}</td>
                      <td className="px-3 py-3 text-slate-500 uppercase">{sucursalNombre}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setSelectedMovimiento(m)}
                          title="Ver recibo / comprobante"
                          className="w-7 h-7 rounded flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer border-0"
                        >
                          <FiEye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Vista Previa del Comprobante Oficial */}
      {selectedMovimiento && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-[700px] rounded-lg shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Header modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-[13px] font-bold text-slate-700">Comprobante de Movimiento</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintMovimiento(selectedMovimiento)}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium flex items-center gap-1.5 hover:bg-blue-700 transition-colors border-0 cursor-pointer shadow-sm"
                >
                  <FiPrinter size={14} /> Imprimir PDF Oficial
                </button>
                <button
                  onClick={() => setSelectedMovimiento(null)}
                  className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {/* Document Body (Vista previa) */}
            <div className="p-8 overflow-y-auto space-y-6 text-[12px] text-slate-700 bg-white">
              
              {/* Header Comprobante */}
              <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                <div className="flex items-center gap-4">
                  {clinicLogo && (
                    <img src={clinicLogo} alt="Logo" className="max-h-14 max-w-32 object-contain" />
                  )}
                  <div>
                    <h2 className="text-[15px] font-bold text-slate-900 uppercase">{sucursalNombre}</h2>
                    <p className="text-slate-500">NIT: {clinicNit}</p>
                    <p className="text-slate-500">{clinicAddress}</p>
                    <p className="text-slate-500">{clinicEmail}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[14px] font-bold text-slate-800 uppercase block">
                    {selectedMovimiento.tipo === "egreso" ? "Egreso" : "Recibo de caja"}
                  </span>
                  <span className="text-slate-500 font-medium">No. {selectedMovimiento.id.slice(0, 6).toUpperCase()}</span>
                </div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-slate-100 text-[12px]">
                <div>
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Señor(a):</span>
                  <span className="font-semibold text-slate-800">{selectedMovimiento.pacienteNombre || selectedMovimiento.tercero || selectedMovimiento.usuarioNombre || "—"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Fecha de Expedición:</span>
                  <span className="font-semibold text-slate-800">{fmtDate(selectedMovimiento.fecha)}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Elaborado Por:</span>
                  <span className="font-semibold text-slate-800">{caja.usuarioNombre || caja.nombre || "—"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Medio de Pago:</span>
                  <span className="font-semibold text-slate-800">{selectedMovimiento.metodoPago || "Efectivo"}</span>
                </div>
              </div>

              {/* Detalle Concepto */}
              <table className="w-full text-[12px] border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="p-2 text-left font-bold text-slate-600">Concepto</th>
                    <th className="p-2 text-center font-bold text-slate-600">Cantidad</th>
                    <th className="p-2 text-right font-bold text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 text-slate-800">{selectedMovimiento.concepto || selectedMovimiento.descripcion || "Movimiento de caja"}</td>
                    <td className="p-2 text-center text-slate-600">1</td>
                    <td className="p-2 text-right font-semibold text-slate-800">{fmt(selectedMovimiento.monto)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totales */}
              <div className="flex justify-end pt-2">
                <div className="w-48 space-y-1 text-right">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>{fmt(selectedMovimiento.monto)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 text-[13px] pt-1 border-t border-slate-200">
                    <span>Total:</span>
                    <span>{fmt(selectedMovimiento.monto)}</span>
                  </div>
                </div>
              </div>

              {/* Firmas */}
              <div className="grid grid-cols-2 gap-8 pt-12 text-center text-[11px] text-slate-500">
                <div className="border-t border-slate-300 pt-2 font-medium">ELABORADO POR</div>
                <div className="border-t border-slate-300 pt-2 font-medium">ACEPTADA, FIRMA Y/O SELLO Y FECHA</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
