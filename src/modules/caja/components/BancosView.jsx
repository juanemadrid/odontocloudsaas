import React, { useState, useEffect } from "react";
import { db } from "../../../firebase/firebaseConfig";
import { collection, query, where, getDocs, collectionGroup } from "firebase/firestore";
import { 
  FiArrowLeft, FiBriefcase, FiDollarSign, FiEye, 
  FiCreditCard, FiCalendar, FiActivity, FiUser, FiSearch,
  FiArrowUpCircle, FiArrowDownCircle, FiFileText
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

  // Filter & Pagination states for selected bank movements
  const [filterTercero, setFilterTercero] = useState("");
  const [filterDoc, setFilterDoc] = useState("");
  const [filterMedio, setFilterMedio] = useState("");
  const [filterSucursal, setFilterSucursal] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = async () => {
    console.log("BancosView - loadData starting for inquilino:", inquilino);
    if (!inquilino) return;
    setLoading(true);
    try {
      // 1. Load banks
      const snapBancos = await getDocs(query(collection(db, "bancos"), where("inquilino", "==", inquilino)));
      const listBancos = snapBancos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("BancosView - listBancos loaded:", listBancos);

      // 2. Load payment methods
      const snapMetodos = await getDocs(query(collection(db, "metodos_pago"), where("inquilino", "==", inquilino)));
      const listMetodos = snapMetodos.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Map payment method names to bank IDs
      const methodToBankId = {};
      listMetodos.forEach(m => {
        if (m.bancoId && m.nombre) {
          methodToBankId[m.nombre.toLowerCase().trim()] = m.bancoId;
        }
      });

      // Also map method IDs if relevant
      listMetodos.forEach(m => {
        if (m.bancoId) {
          methodToBankId[m.id] = m.bancoId;
        }
      });

      // 3. Load payments (pagos)
      let listPagos = [];
      try {
        const snapPagos = await getDocs(query(collection(db, "pagos"), where("inquilino", "==", inquilino)));
        listPagos = snapPagos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn("BancosView - Failed to load pagos:", err);
      }

      // 4. Load receipts (recibos_caja)
      let listRecibos = [];
      try {
        const snapRecibos = await getDocs(query(collection(db, "recibos_caja"), where("inquilino", "==", inquilino)));
        listRecibos = snapRecibos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn("BancosView - Failed to load recibos_caja:", err);
      }

      // 5. Load caja movements (collection group)
      let listMovs = [];
      try {
        const snapMovs = await getDocs(query(collectionGroup(db, "movimientos"), where("inquilino", "==", inquilino)));
        listMovs = snapMovs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn("BancosView - Failed to load collection group movimientos (index might be missing):", err);
      }

      // Calculate balance and movements for each bank
      const updatedBancos = listBancos.map(b => {
        const initialVal = Number(b.valor || 0);
        let totalRecaudos = 0;
        let totalGastos = 0;
        const movements = [];

        // 1. Process pagos
        listPagos.forEach(p => {
          if (p.estado === "Anulado") return;
          const linkedBankId = methodToBankId[p.medio?.toLowerCase().trim()] || p.bancoId;
          if (linkedBankId === b.id) {
            const val = Number(p.monto || 0);
            totalRecaudos += val;
            movements.push({
              id: p.id,
              fecha: p.fecha || p.createdAt,
              concepto: p.concepto || "Abono a tratamiento",
              pacienteNombre: p.patientNombre || "Paciente",
              medio: p.medio || "Pago",
              monto: val,
              tipo: "ingreso"
            });
          }
        });

        // 2. Process recibos_caja
        listRecibos.forEach(r => {
          const linkedBankId = methodToBankId[r.condicionPago?.toLowerCase().trim()] || r.cajaId;
          if (linkedBankId === b.id) {
            const val = Number(r.total || 0);
            totalRecaudos += val;
            movements.push({
              id: r.id,
              fecha: r.fecha || r.createdAt,
              concepto: `Recibo de Caja #${r.id.slice(0, 6).toUpperCase()}`,
              pacienteNombre: r.pacienteNombre || "Paciente",
              medio: r.condicionPago || "Pago",
              monto: val,
              tipo: "ingreso"
            });
          }
        });

        // 3. Process caja movements (e.g. transfers, manual logs)
        listMovs.forEach(m => {
          if (m.reciboId || m.pagoId) return;
          
          const linkedBankId = methodToBankId[m.metodoPago?.toLowerCase().trim()];
          if (linkedBankId === b.id) {
            const val = Number(m.monto || 0);
            if (m.tipo === "egreso") {
              totalRecaudos += val;
              movements.push({
                id: m.id,
                fecha: m.fecha,
                concepto: m.concepto || "Consignación / Traslado",
                pacienteNombre: m.usuarioNombre || m.registradoPor || "Sistema",
                medio: m.metodoPago || "Efectivo",
                monto: val,
                tipo: "ingreso"
              });
            } else {
              totalGastos += val;
              movements.push({
                id: m.id,
                fecha: m.fecha,
                concepto: m.concepto || "Retiro / Gasto",
                pacienteNombre: m.usuarioNombre || m.registradoPor || "Sistema",
                medio: m.metodoPago || "Efectivo",
                monto: val,
                tipo: "egreso"
              });
            }
          }
        });

        // Sort movements ascending to calculate running balance
        const sortedAsc = [...movements].sort((x, y) => {
          const tx = x.fecha?.seconds || new Date(x.fecha).getTime() / 1000 || 0;
          const ty = y.fecha?.seconds || new Date(y.fecha).getTime() / 1000 || 0;
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

        // Sort back to descending for display
        const movementsWithRunningDesc = movementsWithRunning.reverse();

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

        return {
          ...b,
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

  const filteredBancos = bancos.filter(b =>
    (b.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.numeroCuenta || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectBank = (b) => {
    setSelectedBank(b);
    setFilterTercero("");
    setFilterDoc("");
    setFilterMedio("");
    setFilterSucursal("");
    setPageSize(10);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex-1 min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-[13px] font-bold">Cargando contabilidad bancaria...</div>
      </div>
    );
  }

  // ─── DETAILS VIEW ───
  if (selectedBank) {
    const b = selectedBank;
    
    // Filter movements inside view
    const filteredMovements = b.movements.filter(m => {
      if (filterTercero && !(m.pacienteNombre || "").toLowerCase().includes(filterTercero.toLowerCase())) return false;
      if (filterDoc && !(m.concepto || "").toLowerCase().includes(filterDoc.toLowerCase())) return false;
      if (filterMedio && !(m.medio || "").toLowerCase().includes(filterMedio.toLowerCase())) return false;
      
      const sucursalName = userProfile?.sucursal || "ATM CENTRO DEL DOLOR OROFACIAL";
      if (filterSucursal && !sucursalName.toLowerCase().includes(filterSucursal.toLowerCase())) return false;
      
      return true;
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredMovements.length / pageSize);
    const paginatedMovements = filteredMovements.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto custom-scrollbar pr-2 pb-6 space-y-6">
        
        {/* Navigation / Header */}
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedBank(null)}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 shadow-sm"
              title="Volver a bancos"
            >
              <FiArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <FiBriefcase className="text-blue-600" />
                <span>Caja</span>
                <span className="text-slate-200">/</span>
                <span className="text-slate-800">Detalle de Caja</span>
              </div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mt-1">
                Detalle de caja
              </h2>
            </div>
          </div>
        </div>

        {/* Basic Info Horizontal Row */}
        <div className="bg-white rounded-[24px] border border-slate-100 p-6 flex flex-col md:flex-row justify-between gap-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Usuario</span>
            <span className="text-[13px] font-bold text-slate-800 mt-1">—</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Banco</span>
            <span className="text-[13px] font-black text-blue-600 mt-1 uppercase">{b.nombre}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sucursal</span>
            <span className="text-[13px] font-bold text-slate-800 mt-1 uppercase">{userProfile?.sucursal || "ATM CENTRO DEL DOLOR OROFACIAL"}</span>
          </div>
        </div>

        {/* Primary Container: KPIs list & Payment summaries */}
        <div className="bg-white rounded-[24px] border border-slate-100 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] space-y-8">
          
          {/* Key-Value Metrics List */}
          <div className="max-w-xl space-y-4">
            {[
              { label: "Fecha de Apertura", val: b.fecha || "01/08/2025 14:56" },
              { label: "Base", val: fmt(0) },
              { label: "Ajuste base", val: fmt(0) },
              { label: "Total Saldo Inicial", val: fmt(b.valor) },
              { label: "Recaudos", val: fmt(b.recaudos) },
              { label: "Gastos", val: fmt(b.gastos) },
              { label: "Total caja", val: fmt(b.saldoActual) }
            ].map((row, idx) => (
              <div key={idx} className="flex justify-between items-center text-[13px] border-b border-slate-50 pb-2.5">
                <span className="text-slate-500 font-semibold">{row.label}</span>
                <span className={`font-black ${row.label === 'Total caja' ? 'text-blue-600 text-sm' : 'text-slate-800'}`}>
                  {row.val}
                </span>
              </div>
            ))}
          </div>

          {/* Payment Methods Breakdown Table */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider">Medio de pago</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="pb-2.5 font-bold uppercase tracking-widest">Medio de pago</th>
                  <th className="pb-2.5 font-bold uppercase tracking-widest text-center">Cantidad</th>
                  <th className="pb-2.5 font-bold uppercase tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[13px]">
                {b.summaries.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-4 text-center text-slate-400 italic">No hay transacciones registradas</td>
                  </tr>
                ) : (
                  b.summaries.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3.5 font-bold text-slate-700 uppercase tracking-tight">{s.name}</td>
                      <td className="py-3.5 font-bold text-slate-500 text-center">{s.count}</td>
                      <td className={`py-3.5 font-black text-right ${s.total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {fmt(s.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Movements Section */}
        <div className="bg-white rounded-[24px] border border-slate-100 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Movimientos
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {filteredMovements.length} transacciones
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Nombre Tercero/Banco</th>
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Medio de pago</th>
                  <th className="px-4 py-3 text-right">Saldo actual</th>
                  <th className="px-4 py-3 text-left">Sucursal</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
                <tr className="bg-slate-50/50">
                  <th className="px-2 py-2">
                    <div className="w-full h-8 flex items-center justify-center text-slate-300">
                      <FiCalendar size={14} />
                    </div>
                  </th>
                  <th className="px-2 py-2">
                    <input
                      type="text"
                      value={filterTercero}
                      onChange={e => { setFilterTercero(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                    />
                  </th>
                  <th className="px-2 py-2">
                    <input
                      type="text"
                      value={filterDoc}
                      onChange={e => { setFilterDoc(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                    />
                  </th>
                  <th className="px-2 py-2">
                    <div className="w-full h-8 flex items-center justify-center text-slate-300">
                      <FiDollarSign size={14} />
                    </div>
                  </th>
                  <th className="px-2 py-2">
                    <input
                      type="text"
                      value={filterMedio}
                      onChange={e => { setFilterMedio(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                    />
                  </th>
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2">
                    <input
                      type="text"
                      value={filterSucursal}
                      onChange={e => { setFilterSucursal(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                    />
                  </th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {paginatedMovements.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 italic">Sin movimientos registrados</td>
                  </tr>
                ) : (
                  paginatedMovements.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-slate-500">{fmtDate(m.fecha)}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{m.pacienteNombre}</td>
                      <td className="px-4 py-3 font-bold text-slate-500 uppercase tracking-tight">{m.concepto}</td>
                      <td className={`px-4 py-3 text-right font-black ${m.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.tipo === "ingreso" ? "+" : "-"}{fmt(m.monto)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black uppercase tracking-widest text-slate-600">
                          {m.medio}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-700">
                        {fmt(m.runningBalance)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-500 uppercase">{userProfile?.sucursal || "ATM CENTRO DEL DOLOR OROFACIAL"}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center mx-auto transition-all shadow-sm"
                          title="Ver detalle"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-50">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Mostrar</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 border border-slate-200 rounded-lg outline-none bg-white font-bold"
                >
                  <option value={3}>3</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
                <span>registros por página</span>
              </div>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                      currentPage === page
                        ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600"
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

  // ─── MAIN LIST VIEW ───
  return (
    <div className="flex-1 flex flex-col bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden min-h-0">
      
      {/* Toolbar */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50 bg-slate-50/30 shrink-0">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
          Cuentas Bancarias
          <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{filteredBancos.length}</span>
        </h2>
        
        {/* Search */}
        <div className="relative group">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Buscar banco o cuenta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 pl-11 pr-4 rounded-xl border border-slate-200 text-[13px] outline-none w-[220px] bg-slate-50 text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[
                { label: "Bancos", w: "auto" },
                { label: "Fecha de apertura", w: 180 },
                { label: "Número cuenta", w: 180 },
                { label: "Saldo", w: 160 },
                { label: "Acciones", w: 100 },
              ].map((h) => (
                <th key={h.label} style={{ width: h.w }} className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 bg-white">
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredBancos.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-16 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <FiBriefcase size={48} className="text-slate-200 mb-4" />
                    <h3 className="text-base font-bold text-slate-600">No hay bancos registrados</h3>
                    <p className="text-xs mt-1">Configure sus bancos en Configuración → Bancos.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredBancos.map((b) => (
                <tr key={b.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform duration-500">
                        <FiCreditCard size={16} />
                      </div>
                      <div className="font-bold text-slate-800 text-[13px] uppercase">
                        {b.nombre}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle text-[12px] font-semibold text-slate-500 whitespace-nowrap">
                    {b.fecha || "—"}
                  </td>
                  <td className="px-4 py-4 align-middle text-[12px] font-extrabold text-slate-600">
                    {b.numeroCuenta || "CAJA-GRAL"}
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <span className="text-[14px] font-black text-blue-600">
                      {fmt(b.saldoActual)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <button
                      onClick={() => handleSelectBank(b)}
                      className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm"
                      title="Ver movimientos"
                    >
                      <FiEye size={15} />
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
