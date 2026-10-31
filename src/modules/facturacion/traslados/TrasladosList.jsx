import React, { useState, useEffect, useCallback } from "react";
import { FiRepeat, FiSearch, FiCalendar, FiPlus, FiFileText, FiX, FiCheckCircle } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { getConfigItems, getConfigSection, saveConfigSection } from "../../../services/configPersistenceService";
import { toast } from "sonner";
import { bankNames, loadAllTransfers, loadBanksAndExpenses, expensesFromBank, normalizeAccountName, saveTransfers, tidyTransferText, localDate, loadOpenCajas } from "../../../services/bankTransferService";
import { todayBogota } from "../../../utils/bogotaDate";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtPure = (n) => new Intl.NumberFormat("es-CO").format(n);

const fmtDate = (ts) => {
  const d = localDate(ts); // "2026-10-31" se muestra 31/10, no 30/10
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function TrasladosList({ onNew }) {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";
  const [loading, setLoading] = useState(true);
  const [traslados, setTraslados] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return todayBogota(d);
  });
  const [fechaFin, setFechaFin] = useState(todayBogota());

  // Modal Nuevo Traslado
  const [showModal, setShowModal] = useState(false);
  const [savingTraslado, setSavingTraslado] = useState(false);
  // Solo cuentas reales: la caja y los bancos creados en Configuración → Bancos.
  const [cuentasDisponibles, setCuentasDisponibles] = useState(["Caja Principal (Efectivo)"]);
  const [bancosNombres, setBancosNombres] = useState([]);
  const [cajasAbiertas, setCajasAbiertas] = useState([]); // [{ id, label }] para que el traslado sume en esa caja
  const [direccion, setDireccion] = useState("todos"); // todos | entrada (+) | salida (−)
  const [origen, setOrigen] = useState("Caja Principal (Efectivo)");
  const [destino, setDestino] = useState("");
  const [montoDisplay, setMontoDisplay] = useState("");
  const [montoRaw, setMontoRaw] = useState(0);
  const [fechaTraslado, setFechaTraslado] = useState(todayBogota());
  const [descripcion, setDescripcion] = useState("");
  const [referencia, setReferencia] = useState("");

  const parseLocalDate = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };

  const loadData = useCallback(async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      // Traslados de cierres de caja y manuales, y egresos pagados desde un banco (salidas).
      const [transfers, { banks, expenses }] = await Promise.all([loadAllTransfers(inquilino), loadBanksAndExpenses(inquilino)]);
      const names = bankNames(banks);
      setBancosNombres(names);
      const egresosBanco = names.flatMap(name => expensesFromBank(expenses, name).map(p => ({
        id: `eg_${p.id}`,
        esEgreso: true,
        fecha: p.fecha || p.created_at,
        origen: name,
        destino: p.tercero || p.proveedor || "Proveedor",
        monto: Number(p.monto ?? p.total ?? 0),
        descripcion: `Egreso desde banco: ${p.concepto || "Pago"}`,
        referencia: p.consecutivo || p.numero || "",
        estado: p.estado || "Activo",
        created_at: p.created_at,
      })));
      const list = [...transfers, ...egresosBanco];

      const start = parseLocalDate(fechaInicio); start.setHours(0,0,0,0);
      const end = parseLocalDate(fechaFin); end.setHours(23,59,59,999);
      const filtered = (list || [])
        .filter(t => {
          if (!t.fecha && !t.created_at) return false;
          const ts = localDate(t.fecha || t.created_at)?.getTime() ?? NaN;
          return ts >= start.getTime() && ts <= end.getTime();
        })
        .sort((a, b) => String(b.created_at || b.fecha || "").localeCompare(String(a.created_at || a.fecha || "")));
      setTraslados(filtered);
    } catch (e) {
      console.error("Error loading traslados:", e);
    } finally {
      setLoading(false);
    }
  }, [inquilino, fechaInicio, fechaFin]);

  useEffect(() => { loadData(); }, [loadData]);

  // Cuentas para el traslado: las cajas ABIERTAS (por su nombre) y los bancos de Configuración → Bancos.
  // Así un traslado de un banco a una caja suma en el saldo de esa caja.
  const loadCuentas = useCallback(async () => {
    if (!inquilino) return;
    try {
      const [{ banks }, open] = await Promise.all([loadBanksAndExpenses(inquilino), loadOpenCajas(inquilino).catch(() => [])]);
      const cajaLabels = open.length ? open.map(c => c.label) : ["Caja Principal (Efectivo)"];
      const bancos = bankNames(banks);
      const list = [...cajaLabels, ...bancos];
      setCajasAbiertas(open);
      setCuentasDisponibles(list);
      setOrigen(prev => (list.includes(prev) ? prev : list[0] || ""));
      setDestino(prev => (list.includes(prev) ? prev : (bancos[0] || list[1] || "")));
    } catch (_) {}
  }, [inquilino]);

  useEffect(() => { loadCuentas(); }, [loadCuentas]);
  useEffect(() => { if (showModal) loadCuentas(); }, [showModal, loadCuentas]);

  const handleSaveTraslado = async (e) => {
    e?.preventDefault();
    if (montoRaw <= 0) {
      toast.error("Por favor ingrese un monto válido para el traslado");
      return;
    }
    if (!destino) {
      toast.error("Cree primero el banco en Configuración → Bancos y selecciónelo como destino");
      return;
    }
    if (origen === destino) {
      toast.error("La cuenta de origen y destino no pueden ser iguales");
      return;
    }

    setSavingTraslado(true);
    try {
      const ahoraIso = new Date().toISOString();
      const newTraslado = {
        tenant_id: inquilino,
        fecha: fechaTraslado || ahoraIso.split("T")[0],
        origen,
        destino,
        monto: montoRaw,
        descripcion: descripcion.trim() || `Traslado de fondos de ${origen} a ${destino}`,
        referencia: referencia.trim() || `TR-${Date.now().toString().slice(-6)}`,
        estado: "Activo",
        created_at: ahoraIso
      };

      newTraslado.id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `tr_${Date.now()}`;
      // Caja exacta de origen o destino: el traslado aparece en sus movimientos y suma/resta en su saldo.
      const cajaIdDe = (label) => cajasAbiertas.find(c => c.label === label)?.id || null;
      newTraslado.caja_origen_id = cajaIdDe(origen);
      newTraslado.caja_destino_id = cajaIdDe(destino);
      newTraslado.tipo = "manual";
      newTraslado.usuario = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email || "";
      await saveTransfers(inquilino, [newTraslado]);

      toast.success("Traslado registrado correctamente");
      setShowModal(false);
      setMontoDisplay("");
      setMontoRaw(0);
      setDescripcion("");
      setReferencia("");
      loadData();
    } catch (e) {
      console.error("Error guardando traslado:", e);
      toast.error("No se pudo registrar el traslado");
    } finally {
      setSavingTraslado(false);
    }
  };

  const isBank = (name) => bancosNombres.some(b => normalizeAccountName(b) === normalizeAccountName(name));
  // Traslado + = dinero que entra a un banco; Traslado − = dinero que sale de un banco (traslado o egreso).
  const tipoDe = (t) => (t.esEgreso || isBank(t.origen)) ? (isBank(t.destino) ? "both" : "salida") : (isBank(t.destino) ? "entrada" : "otro");
  const filtered = traslados.filter(t => {
    const tipo = tipoDe(t);
    if (direccion === "entrada" && tipo !== "entrada" && tipo !== "both") return false;
    if (direccion === "salida" && tipo !== "salida" && tipo !== "both") return false;
    const q = searchTerm.toLowerCase();
    return (t.origen || "").toLowerCase().includes(q) ||
      (t.destino || "").toLowerCase().includes(q) ||
      (t.descripcion || "").toLowerCase().includes(q);
  });
  const totalEntradas = filtered.filter(t => ["entrada", "both"].includes(tipoDe(t)) && t.estado !== "Anulado").reduce((a, t) => a + Number(t.monto || 0), 0);
  const totalSalidas = filtered.filter(t => ["salida", "both"].includes(tipoDe(t)) && t.estado !== "Anulado").reduce((a, t) => a + Number(t.monto || 0), 0);

  return (
    <div className="p-1.5 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Filter Card */}
      <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end flex-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Inicial</label>
              <div className="relative">
                <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                  value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} max="9999-12-31" min="1900-01-01" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Final</label>
              <div className="relative">
                <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                  value={fechaFin} onChange={e => setFechaFin(e.target.value)} max="9999-12-31" min="1900-01-01" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscar</label>
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Origen, destino o descripción..." className="w-full h-11 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-blue-500 transition-all"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={loadData} className="h-11 px-5 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 cursor-pointer">
              <FiSearch /> Buscar
            </button>
            <button 
              onClick={() => setShowModal(true)} 
              className="h-11 px-6 flex items-center justify-center gap-2 bg-[#8cc33f] hover:bg-[#7db02b] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow cursor-pointer"
            >
              <FiPlus size={16} /> Nuevo Traslado
            </button>
          </div>
        </div>
      </div>

      {/* Tipo de traslado */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["todos", "Todos"],
          ["entrada", "Traslado + (entradas a bancos)"],
          ["salida", "Traslado − (salidas de bancos)"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setDireccion(id)}
            className={`px-4 h-9 rounded-xl text-[12px] font-bold border cursor-pointer transition-colors ${direccion === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-[12px] font-bold text-slate-500">
          Entradas: <span className="text-emerald-600">{fmt(totalEntradas)}</span> · Salidas: <span className="text-rose-600">{fmt(totalSalidas)}</span>
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[550px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 pl-8">Fecha</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Origen</th>
                <th className="px-6 py-4">Destino</th>
                <th className="px-6 py-4">Descripción</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-[#8cc33f] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando traslados...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                        <FiRepeat className="text-slate-300" size={28} />
                      </div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No se encontraron traslados</p>
                      <p className="text-[11px] text-slate-400">Crea tu primer traslado entre cuentas</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4 pl-8 font-semibold text-slate-500">{fmtDate(t.fecha)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const tipo = tipoDe(t);
                      if (t.esEgreso) return <span className="inline-block whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700">EGRESO −</span>;
                      if (tipo === "entrada") return <span className="inline-block whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">TRASLADO +</span>;
                      if (tipo === "salida") return <span className="inline-block whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700">TRASLADO −</span>;
                      if (tipo === "both") return <span className="inline-block whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700">ENTRE BANCOS</span>;
                      return <span className="inline-block whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">TRASLADO</span>;
                    })()}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">{tidyTransferText(t.origen) || "—"}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{tidyTransferText(t.destino) || "—"}</td>
                  <td className="px-6 py-4 text-slate-500">{tidyTransferText(t.descripcion) || "—"}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 font-mono">{fmt(t.monto)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      t.estado === "Anulado" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}>{t.estado || "Activo"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Traslado */}
      {showModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FiRepeat size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Nuevo Traslado de Fondos</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Transferir dinero entre cajas y cuentas bancarias</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTraslado} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Cuenta / Caja Origen *</label>
                  <select 
                    value={origen}
                    onChange={e => setOrigen(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    required
                  >
                    {cuentasDisponibles.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Cuenta / Caja Destino *</label>
                  <select 
                    value={destino}
                    onChange={e => setDestino(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    required
                  >
                    {cuentasDisponibles.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {cajasAbiertas.length === 0 && (
                <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  No hay cajas abiertas. Si el dinero va hacia una caja o sale de ella, abra primero la caja para que se sume en su saldo.
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Monto a Trasladar (COP) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                    <input 
                      type="text"
                      placeholder="0"
                      value={montoDisplay}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setMontoRaw(Number(raw || 0));
                        setMontoDisplay(raw ? fmtPure(raw) : "");
                      }}
                      className="w-full h-10 pl-8 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Fecha del Traslado *</label>
                  <input 
                    type="date"
                    value={fechaTraslado}
                    onChange={e => setFechaTraslado(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Descripción / Concepto</label>
                <input 
                  type="text"
                  placeholder="Ej: Consignación de efectivo del día en Bancolombia"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Nro. Comprobante / Referencia (Opcional)</label>
                <input 
                  type="text"
                  placeholder="Ej: TR-894523 o recibo de consignación"
                  value={referencia}
                  onChange={e => setReferencia(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTraslado || montoRaw <= 0}
                  className="px-6 py-2.5 bg-[#8cc33f] hover:bg-[#7db02b] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow cursor-pointer disabled:opacity-50 flex items-center gap-2 border-0"
                >
                  {savingTraslado ? "Guardando..." : "Registrar Traslado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
