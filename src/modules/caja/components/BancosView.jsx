import React, { useState, useEffect, useMemo } from "react";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import { ReceiptPrintService } from "../../../services/ReceiptPrintService";
import { 
  FiArrowLeft, FiBriefcase, FiDollarSign, FiEye, 
  FiCreditCard, FiCalendar, FiActivity, FiUser, FiSearch,
  FiArrowUpCircle, FiArrowDownCircle, FiFileText, FiPrinter,
  FiRefreshCw
} from "react-icons/fi";

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

export default function BancosView({ inquilino, userProfile }) {
  const [loading, setLoading] = useState(true);
  const [bancos, setBancos] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [patientMap, setPatientMap] = useState({});

  // Filter & Pagination states for selected bank movements
  const [filterTercero, setFilterTercero] = useState("");
  const [filterDoc, setFilterDoc] = useState("");
  const [filterMedio, setFilterMedio] = useState("");
  const [filterSucursal, setFilterSucursal] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const sucursalNombre = userProfile?.sucursal || userProfile?.clinica || "ATM CENTRO DEL DOLOR OROFACIAL";

  const loadData = async () => {
    if (!inquilino) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        listBancos,
        listMetodos,
        pacientesRes,
        pagosResult,
        recibosResult,
        movimientosResult,
        tenantConfigRes
      ] = await Promise.all([
        getConfigItems(inquilino, "bancos", "bancos"),
        getConfigItems(inquilino, "metodos_pago", null),
        supabase.from("pacientes").select("*").eq("tenant_id", inquilino),
        supabase.from("pagos").select("*").eq("tenant_id", inquilino),
        supabase.from("recibos_caja").select("*").eq("tenant_id", inquilino),
        supabase.from("movimientos_caja").select("*").eq("tenant_id", inquilino),
        supabase.from("tenants").select("*").eq("id", inquilino).maybeSingle()
      ]);

      const listPagos = pagosResult.data || [];
      const listRecibos = recibosResult.data || [];
      const listMovs = movimientosResult.data || [];
      const listPacientes = pacientesRes.data || [];

      // Map patient details
      const pMap = {};
      listPacientes.forEach(p => {
        const fullName = p.nombreCompleto || `${p.nombres || ''} ${p.apellidos || ''}`.trim() || p.nombre || "Paciente";
        pMap[p.id] = {
          ...p,
          nombreCompleto: fullName,
          documento: p.nroDocumento || p.documento || "—"
        };
      });
      setPatientMap(pMap);

      // Map payment methods to bank IDs
      const methodToBankId = {};
      (listMetodos || []).forEach(method => {
        if (method.bancoId && method.nombre) {
          methodToBankId[method.nombre.toLowerCase().trim()] = method.bancoId;
        }
        if (method.bancoId) methodToBankId[method.id] = method.bancoId;
      });

      // Default bancos if none configured
      let baseBancos = listBancos || [];
      if (baseBancos.length === 0) {
        baseBancos = [
          {
            id: "banco_nequi",
            nombre: "Nequi",
            numero_cuenta: "3001234567",
            tipo_cuenta: "Ahorros / Digital",
            created_at: "2025-08-01T14:56:00Z"
          },
          {
            id: "banco_bancolombia",
            nombre: "Bancolombia",
            numero_cuenta: "123-456789-00",
            tipo_cuenta: "Ahorros",
            created_at: "2025-08-01T14:56:00Z"
          }
        ];
      }

      // Calculate balance and movements for each bank
      const updatedBancos = baseBancos.map(b => {
        const bNameLower = (b.nombre || "").toLowerCase().trim();
        const initialVal = Number(b.valor || b.saldo_inicial || 0);
        let totalRecaudos = 0;
        let totalGastos = 0;
        const movements = [];
        const processedTxIds = new Set();

        // 1. Process pagos
        (listPagos || []).forEach((p, idx) => {
          if (p.estado === "Anulado") return;
          const pMedioLower = (p.medio || p.metodo_pago || "").toLowerCase().trim();
          const linkedBankId = methodToBankId[pMedioLower] || p.bancoId || p.banco_id;
          
          const isMatch = (linkedBankId && linkedBankId === b.id) ||
            (bNameLower && pMedioLower && (pMedioLower.includes(bNameLower) || bNameLower.includes(pMedioLower)));

          if (isMatch) {
            processedTxIds.add(`pago_${p.id}`);
            const val = Number(p.monto || 0);
            totalRecaudos += val;
            
            const patObj = pMap[p.pacienteId || p.paciente_id];
            const pName = p.patientNombre || p.pacienteNombre || p.paciente_nombre || patObj?.nombreCompleto || "Paciente Clínica";
            const docConsecutivo = p.nroConsecutivo || p.consecutivo || `RC-${String(idx + 1).padStart(4, "0")}`;

            movements.push({
              id: p.id || `pago_${idx}`,
              fecha: p.fecha || p.created_at,
              concepto: p.concepto || "Abono a tratamiento",
              documento: docConsecutivo,
              pacienteNombre: pName,
              pacienteObj: patObj,
              medio: p.medio || p.metodo_pago || b.nombre,
              monto: val,
              tipo: "ingreso",
              rawPago: p
            });
          }
        });

        // 2. Process recibos_caja
        (listRecibos || []).forEach((r, idx) => {
          if (r.estado === "Anulado") return;
          const rMedioLower = (r.medioPago || r.medio_pago || "").toLowerCase().trim();
          const linkedBankId = methodToBankId[rMedioLower] || r.bancoId || r.banco_id;
          
          const isMatch = (linkedBankId && linkedBankId === b.id) ||
            (bNameLower && rMedioLower && (rMedioLower.includes(bNameLower) || bNameLower.includes(rMedioLower)));

          if (isMatch && !processedTxIds.has(`recibo_${r.id}`)) {
            processedTxIds.add(`recibo_${r.id}`);
            const val = Number(r.total || r.monto || 0);
            totalRecaudos += val;

            const patObj = pMap[r.pacienteId || r.paciente_id];
            const pName = r.pacienteNombre || patObj?.nombreCompleto || "Paciente Clínica";
            const docConsecutivo = r.nroConsecutivo || `RC-${String(r.consecutivo || idx + 1).padStart(4, "0")}`;

            movements.push({
              id: r.id || `recibo_${idx}`,
              fecha: r.fecha || r.created_at,
              concepto: `Recibo de Caja #${docConsecutivo}`,
              documento: docConsecutivo,
              pacienteNombre: pName,
              pacienteObj: patObj,
              medio: r.medioPago || r.medio_pago || b.nombre,
              monto: val,
              tipo: "ingreso"
            });
          }
        });

        // 3. Process movimientos_caja
        (listMovs || []).forEach((m, idx) => {
          const mMedioLower = (m.metodo_pago || m.metodoPago || "").toLowerCase().trim();
          const linkedBankId = methodToBankId[mMedioLower] || m.bancoId || m.banco_id;

          const isMatch = (linkedBankId && linkedBankId === b.id) ||
            (bNameLower && mMedioLower && (mMedioLower.includes(bNameLower) || bNameLower.includes(mMedioLower)));

          if (isMatch && !processedTxIds.has(`mov_${m.id}`)) {
            processedTxIds.add(`mov_${m.id}`);
            const val = Number(m.monto || 0);
            if (m.tipo === "ingreso") {
              totalRecaudos += val;
            } else {
              totalGastos += val;
            }

            const patObj = pMap[m.paciente_id || m.pacienteId];
            const pName = m.paciente_nombre || m.pacienteNombre || patObj?.nombreCompleto || (m.tipo === "egreso" ? "Gasto / Proveedor" : "Paciente Clínica");
            const docConsecutivo = m.nroConsecutivo || m.consecutivo || (m.tipo === "egreso" ? `EGR-${String(idx + 1).padStart(4, "0")}` : `RC-${String(idx + 1).padStart(4, "0")}`);

            movements.push({
              id: m.id || `mov_${idx}`,
              fecha: m.created_at || m.fecha,
              concepto: m.concepto || (m.tipo === "ingreso" ? "Ingreso de Caja" : "Egreso de Caja"),
              documento: docConsecutivo,
              pacienteNombre: pName,
              pacienteObj: patObj,
              medio: m.metodo_pago || m.metodoPago || b.nombre,
              monto: val,
              tipo: m.tipo || "ingreso"
            });
          }
        });

        // Sort ascending to compute progressive balance
        const sortedAsc = [...movements].sort((x, y) => {
          const tx = new Date(x.fecha || 0).getTime();
          const ty = new Date(y.fecha || 0).getTime();
          return tx - ty;
        });

        let running = initialVal;
        const movementsWithRunning = sortedAsc.map(m => {
          if (m.tipo === "ingreso") {
            running += m.monto;
          } else {
            running -= m.monto;
          }
          return { ...m, runningBalance: running };
        });

        // Sort descending for table view
        const movementsWithRunningDesc = [...movementsWithRunning].reverse();

        // Group by payment methods for summary table
        const methodSummaries = {};
        movementsWithRunningDesc.forEach(m => {
          const med = m.medio || "Otro";
          if (!methodSummaries[med]) {
            methodSummaries[med] = { count: 0, total: 0 };
          }
          methodSummaries[med].count += 1;
          if (m.tipo === "ingreso") {
            methodSummaries[med].total += m.monto;
          } else {
            methodSummaries[med].total -= m.monto;
          }
        });

        const listSummaries = Object.keys(methodSummaries).map(k => ({
          name: k,
          count: methodSummaries[k].count,
          total: methodSummaries[k].total
        }));

        const fechaApertura = b.fecha || b.created_at || "2025-08-01T14:56:00Z";
        const numeroCuenta = b.numero_cuenta || b.numeroCuenta || "—";

        return {
          ...b,
          nombre: b.nombre || "Cuenta Bancaria",
          numero_cuenta: numeroCuenta,
          numeroCuenta: numeroCuenta,
          fecha: fechaApertura,
          fechaFormateada: fmtDate(fechaApertura),
          recaudos: totalRecaudos,
          gastos: totalGastos,
          saldoActual: initialVal + totalRecaudos - totalGastos,
          movements: movementsWithRunningDesc,
          summaries: listSummaries
        };
      });

      setBancos(updatedBancos);
      
      if (selectedBank) {
        const activeB = updatedBancos.find(x => x.id === selectedBank.id);
        if (activeB) setSelectedBank(activeB);
      }
    } catch (e) {
      console.error("Error loading banks contability:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [inquilino]);

  const filteredBancos = useMemo(() => {
    return bancos.filter(b =>
      (b.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.numero_cuenta || b.numeroCuenta || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [bancos, searchTerm]);

  const handleSelectBank = (b) => {
    setSelectedBank(b);
    setFilterTercero("");
    setFilterDoc("");
    setFilterMedio("");
    setFilterSucursal("");
    setPageSize(10);
    setCurrentPage(1);
  };

  const handlePrintTransaction = async (m) => {
    if (!m) return;
    try {
      const patientData = {
        nombreCompleto: m.pacienteNombre || "Paciente",
        nroDocumento: m.pacienteObj?.nroDocumento || m.pacienteObj?.documento || "—",
        tipoDocumento: m.pacienteObj?.tipoDocumento || "CC",
        lugarResidencia: m.pacienteObj?.lugarResidencia || m.pacienteObj?.direccion || "—",
        ciudadDomicilio: m.pacienteObj?.ciudadDomicilio || m.pacienteObj?.ciudad || "—",
        celular: m.pacienteObj?.celular || m.pacienteObj?.telefono || "—",
      };

      const pagoData = {
        monto: m.monto || 0,
        tipo: m.tipo || "ingreso",
        documentTitle: m.tipo === "egreso" ? "Comprobante de Egreso" : "Recibo de Caja",
        medio: m.medio || "Transferencia",
        concepto: m.concepto || "Abono a tratamiento",
        notas: `Transacción registrada en ${selectedBank?.nombre || 'Banco'}`,
        fecha: m.fecha,
        nroConsecutivo: m.documento || "RC-0001",
        registradoPor: userProfile?.nombreCompleto || userProfile?.nombre || "Administrador",
      };

      const clinicData = {
        inquilino,
        nombreComercial: sucursalNombre,
      };

      await ReceiptPrintService.generatePDF(pagoData, patientData, clinicData, userProfile);
    } catch (err) {
      console.error("Error imprimiendo movimiento:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-[13px] font-bold text-slate-600">Cargando contabilidad de bancos...</div>
      </div>
    );
  }

  // ─── DETAILS VIEW (ESTILO ORALDRIVE) ───
  if (selectedBank) {
    const b = selectedBank;
    
    // Filter movements
    const filteredMovements = b.movements.filter(m => {
      if (filterTercero && !(m.pacienteNombre || "").toLowerCase().includes(filterTercero.toLowerCase())) return false;
      if (filterDoc && !((m.documento || "") + " " + (m.concepto || "")).toLowerCase().includes(filterDoc.toLowerCase())) return false;
      if (filterMedio && !(m.medio || "").toLowerCase().includes(filterMedio.toLowerCase())) return false;
      if (filterSucursal && !sucursalNombre.toLowerCase().includes(filterSucursal.toLowerCase())) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
    const paginatedMovements = filteredMovements.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

    return (
      <div className="flex-1 overflow-y-auto bg-slate-100 p-6 space-y-6">
        
        {/* Header & Breadcrumb */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-1">
              <button 
                onClick={() => setSelectedBank(null)} 
                className="hover:text-blue-600 flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 text-slate-400"
              >
                🏠 <span>Caja</span>
              </button>
              <span className="text-slate-300">&rsaquo;</span>
              <button 
                onClick={() => setSelectedBank(null)} 
                className="hover:text-blue-600 bg-transparent border-0 cursor-pointer p-0 text-slate-400"
              >
                Bancos
              </button>
              <span className="text-slate-300">&rsaquo;</span>
              <span className="text-slate-600 font-medium">Detalle de caja</span>
            </div>
            <h1 className="text-[22px] font-bold text-slate-800">Detalle de caja</h1>
          </div>
          <button
            onClick={() => setSelectedBank(null)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-md text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer bg-white shadow-sm"
          >
            <FiArrowLeft size={15} /> Volver
          </button>
        </div>

        {/* Card Resumen General ("Hojita OralDrive") */}
        <div className="bg-white rounded-md border border-slate-200 p-8 shadow-sm max-w-5xl mx-auto space-y-8">
          
          {/* Encabezado Usuario / Banco / Sucursal */}
          <div className="flex items-center gap-8 pb-6 border-b border-slate-100 text-[13px]">
            <div>
              <span className="text-slate-400 font-medium block text-[12px] mb-0.5">Usuario</span>
              <span className="font-bold text-blue-600 uppercase tracking-wide">
                {b.nombre}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <span className="text-slate-400 font-medium block text-[12px] mb-0.5">Número de Cuenta</span>
              <span className="font-bold text-slate-700 uppercase tracking-wide">
                {b.numero_cuenta || "—"}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <span className="text-slate-400 font-medium block text-[12px] mb-0.5">Sucursal</span>
              <span className="font-bold text-slate-800 uppercase tracking-wide">{sucursalNombre}</span>
            </div>
          </div>

          {/* Cifras Principales */}
          <div className="space-y-2.5 text-[13px] max-w-xl">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Fecha de Apertura</span>
              <span className="font-medium text-slate-700">{b.fechaFormateada || "01/08/2025 14:56"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Base</span>
              <span className="font-medium text-slate-700">{fmt(0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Ajuste base</span>
              <span className="font-medium text-slate-700">{fmt(0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Total Saldo Inicial</span>
              <span className="font-medium text-slate-700">{fmt(b.valor || 0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Recaudos</span>
              <span className="font-semibold text-emerald-600">{fmt(b.recaudos)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Gastos</span>
              <span className="font-semibold text-rose-600">{fmt(b.gastos)}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-slate-200 mt-2">
              <span className="font-bold text-slate-800">Total caja</span>
              <span className="font-extrabold text-blue-600 text-[15px]">{fmt(b.saldoActual)}</span>
            </div>
          </div>

          {/* Breakdown por Medio de Pago */}
          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide mb-3">
              Medio de pago
            </h3>
            <table className="w-full text-[13px] border border-slate-200 rounded-md overflow-hidden">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-2.5 text-left border-b border-slate-200">Medio de pago</th>
                  <th className="px-4 py-2.5 text-center border-b border-slate-200">Cantidad</th>
                  <th className="px-4 py-2.5 text-right border-b border-slate-200">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {b.summaries.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-4 text-center text-slate-400 italic">
                      No hay transacciones registradas
                    </td>
                  </tr>
                ) : (
                  b.summaries.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-700 uppercase">{s.name}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-500">{s.count}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${s.total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {fmt(s.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Card Tabla de Movimientos */}
        <div className="bg-white rounded-md border border-slate-200 p-6 shadow-sm max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-[15px] font-bold text-slate-800">
              Movimientos
            </h2>
            <span className="text-[12px] font-medium text-slate-400">
              {filteredMovements.length} transacciones
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left">Fecha</th>
                  <th className="px-3 py-2.5 text-left">Nombre Tercero/Banco</th>
                  <th className="px-3 py-2.5 text-left">Documento</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                  <th className="px-3 py-2.5 text-center">Medio de pago</th>
                  <th className="px-3 py-2.5 text-right">Saldo actual</th>
                  <th className="px-3 py-2.5 text-left">Sucursal</th>
                  <th className="px-3 py-2.5 text-center">Acciones</th>
                </tr>
                {/* Search Filters Row */}
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="p-1.5"></th>
                  <th className="p-1.5">
                    <input
                      type="text"
                      value={filterTercero}
                      onChange={e => { setFilterTercero(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full h-7 px-2 border border-slate-200 rounded text-[11px] outline-none focus:border-blue-500 bg-white font-normal"
                    />
                  </th>
                  <th className="p-1.5">
                    <input
                      type="text"
                      value={filterDoc}
                      onChange={e => { setFilterDoc(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full h-7 px-2 border border-slate-200 rounded text-[11px] outline-none focus:border-blue-500 bg-white font-normal"
                    />
                  </th>
                  <th className="p-1.5"></th>
                  <th className="p-1.5">
                    <input
                      type="text"
                      value={filterMedio}
                      onChange={e => { setFilterMedio(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full h-7 px-2 border border-slate-200 rounded text-[11px] outline-none focus:border-blue-500 bg-white font-normal"
                    />
                  </th>
                  <th className="p-1.5"></th>
                  <th className="p-1.5">
                    <input
                      type="text"
                      value={filterSucursal}
                      onChange={e => { setFilterSucursal(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full h-7 px-2 border border-slate-200 rounded text-[11px] outline-none focus:border-blue-500 bg-white font-normal"
                    />
                  </th>
                  <th className="p-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedMovements.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-slate-400 italic">
                      Sin movimientos registrados
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-3 text-slate-500 font-medium whitespace-nowrap">{fmtDate(m.fecha)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800 uppercase">{m.pacienteNombre}</td>
                      <td className="px-3 py-3 font-medium text-slate-600 uppercase tracking-tight">{m.documento} - {m.concepto}</td>
                      <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${m.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.tipo === "ingreso" ? "+" : "-"}{fmt(m.monto)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase text-slate-600">
                          {m.medio}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        {fmt(m.runningBalance)}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-500 uppercase">{sucursalNombre}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handlePrintTransaction(m)}
                          className="w-7 h-7 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center mx-auto transition-colors cursor-pointer border-0"
                          title="Imprimir / Ver Comprobante"
                        >
                          <FiEye size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 text-[12px] text-slate-500">
              <div className="flex items-center gap-2">
                <span>Mostrar</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 border border-slate-200 rounded font-semibold bg-white outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
                <span>registros por página</span>
              </div>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded text-[11px] font-bold transition-colors cursor-pointer border-0 ${
                      currentPage === page
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    );
  }

  // ─── MAIN LIST VIEW (LISTADO DE BANCOS) ───
  return (
    <div className="flex-1 flex flex-col bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden min-h-0">
      
      {/* Header Toolbar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-bold text-slate-800">
            Cuentas Bancarias
          </h2>
          <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
            {filteredBancos.length}
          </span>
        </div>
        
        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Buscar banco o cuenta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-9 pr-3 rounded-md border border-slate-200 text-[12px] outline-none w-[220px] bg-white text-slate-700 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="flex-1 overflow-y-auto p-6">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
              <th className="px-4 py-3 text-left">Bancos</th>
              <th className="px-4 py-3 text-left">Fecha de apertura</th>
              <th className="px-4 py-3 text-left">Número cuenta</th>
              <th className="px-4 py-3 text-left">Saldo</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBancos.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-16 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <FiCreditCard size={40} className="text-slate-200 mb-3" />
                    <h3 className="text-[14px] font-bold text-slate-600">No hay bancos registrados</h3>
                    <p className="text-[12px] text-slate-400 mt-1">Configure sus entidades financieras en Configuración → Bancos.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredBancos.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiCreditCard size={15} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-[13px] uppercase">
                          {b.nombre}
                        </div>
                        {b.tipo_cuenta && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {b.tipo_cuenta}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-[12px] text-slate-500 whitespace-nowrap">
                    {b.fechaFormateada || "01/08/2025 02:56 PM"}
                  </td>
                  <td className="px-4 py-3.5 align-middle text-[12px] font-semibold text-slate-700">
                    {b.numero_cuenta || "—"}
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <span className="text-[13px] font-bold text-blue-600">
                      {fmt(b.saldoActual)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-center">
                    <button
                      onClick={() => handleSelectBank(b)}
                      className="w-8 h-8 rounded-md bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center mx-auto transition-colors cursor-pointer border-0 shadow-sm"
                      title="Ver detalle del banco"
                    >
                      <FiEye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
