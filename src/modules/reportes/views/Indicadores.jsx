import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiCalendar, FiTrendingUp } from "react-icons/fi";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export default function Indicadores() {
  const { userProfile } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState("TODAS");
  const [selectedPeriod, setSelectedPeriod] = useState(format(new Date(), "MM-yyyy"));
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const [activeTooltip, setActiveTooltip] = useState(null);

  // Stats State calculados con Firestore
  const [metrics, setMetrics] = useState({
    recaudoActual: 0,
    recaudoAnterior: 0,
    incRecaudo: 0,
    labelActual: "",
    labelAnterior: "",

    pacientesNuevosActual: 0,
    pacientesNuevosAnterior: 0,
    incPacientes: 0,

    presupuestosActual: 0,
    presupuestosAnterior: 0,
    incPresupuestos: 0,

    planesVendidosActual: 0,
    planesVendidosAnterior: 0,
    incPlanes: 0,

    pacientesTratamientoActual: 0,
    pacientesTratamientoAnterior: 0,
    incTratamiento: 0,

    citasAgendadasPct: 0,
    citasAsistidasPct: 0,
    incCitas: 0,

    origenData: [],
    resumenAnualBars: []
  });

  // Cargar Sucursales
  useEffect(() => {
    if (!userProfile?.inquilino) return;
    const fetchBranches = async () => {
      try {
        const qB = query(collection(db, "sucursales"), where("inquilino", "==", userProfile.inquilino));
        const snapB = await getDocs(qB);
        const bList = snapB.docs.map(d => ({ id: d.id, nombre: d.data().nombre || d.id }));
        setBranches(bList);
      } catch (err) {
        console.error("Error cargando sucursales:", err);
      }
    };
    fetchBranches();
  }, [userProfile?.inquilino]);

  // Cargar Métricas reales de Firebase Firestore
  const loadRealMetrics = async () => {
    if (!userProfile?.inquilino) return;
    setLoading(true);

    try {
      const inquilino = userProfile.inquilino;

      // Parsear período seleccionado (MM-yyyy)
      const [mStr, yStr] = selectedPeriod.split("-");
      const monthIdx = (parseInt(mStr, 10) || (new Date().getMonth() + 1)) - 1;
      const yearVal = parseInt(yStr, 10) || new Date().getFullYear();

      const currDateStart = startOfMonth(new Date(yearVal, monthIdx, 1));
      const currDateEnd = endOfMonth(currDateStart);
      const prevDateStart = startOfMonth(subMonths(currDateStart, 1));
      const prevDateEnd = endOfMonth(prevDateStart);

      const labelCur = format(currDateStart, "MMM. yyyy");
      const labelPrv = format(prevDateStart, "MMM. yyyy");

      // 1. Pacientes (Nuevos y Origen)
      const qPacientes = query(collection(db, "pacientes"), where("inquilino", "==", inquilino));
      const snapPacientes = await getDocs(qPacientes);

      let pacCur = 0;
      let pacPrv = 0;
      const origenesCount = {};

      snapPacientes.forEach(doc => {
        const p = doc.data();
        const fCreated = p.createdAt?.toDate ? p.createdAt.toDate() : (p.fechaCreacion ? new Date(p.fechaCreacion) : null);
        if (fCreated) {
          if (fCreated >= currDateStart && fCreated <= currDateEnd) pacCur++;
          if (fCreated >= prevDateStart && fCreated <= prevDateEnd) pacPrv++;
        }

        const medio = p.comoNosConocio || p.medioAtraccion || "Sin Información";
        origenesCount[medio] = (origenesCount[medio] || 0) + 1;
      });

      const totalPac = snapPacientes.size || 1;
      const palette = ["#3b82f6", "#22c55e", "#06b6d4", "#eab308", "#f97316", "#ef4444", "#f43f5e", "#c084fc", "#84cc16", "#38bdf8", "#a855f7", "#ec4899"];
      let paletteIdx = 0;

      const origenesFormatted = Object.entries(origenesCount).map(([label, count]) => {
        const pct = totalPac > 0 ? (count / totalPac) * 100 : 0;
        const color = palette[paletteIdx % palette.length];
        paletteIdx++;
        return { label, pct: isNaN(pct) ? 0 : pct, color };
      });

      // 2. Presupuestos / Planes de Tratamiento
      const qPlanes = query(collection(db, "planes"), where("inquilino", "==", inquilino));
      const snapPlanes = await getDocs(qPlanes);

      let presCur = 0;
      let presPrv = 0;
      let planVendCur = 0;
      let planVendPrv = 0;
      let pacTratCur = 0;
      let pacTratPrv = 0;

      snapPlanes.forEach(doc => {
        const p = doc.data();
        const fCreated = p.createdAt?.toDate ? p.createdAt.toDate() : (p.fechaCreacion ? new Date(p.fechaCreacion) : null);
        const isAceptado = p.status === "Aceptado" || p.status === "Iniciado" || p.status === "Finalizado" || (p.pagado && p.pagado > 0);

        if (fCreated) {
          if (fCreated >= currDateStart && fCreated <= currDateEnd) {
            presCur++;
            if (isAceptado) {
              planVendCur++;
              pacTratCur++;
            }
          }
          if (fCreated >= prevDateStart && fCreated <= prevDateEnd) {
            presPrv++;
            if (isAceptado) {
              planVendPrv++;
              pacTratPrv++;
            }
          }
        }
      });

      // 3. Pagos / Recaudo
      const qPagos = query(collection(db, "pagos"), where("inquilino", "==", inquilino));
      const snapPagos = await getDocs(qPagos);

      let recCur = 0;
      let recPrv = 0;

      snapPagos.forEach(doc => {
        const pg = doc.data();
        if (pg.estado !== "Anulado") {
          const fPago = pg.fecha?.toDate ? pg.fecha.toDate() : (pg.fechaPago ? new Date(pg.fechaPago) : null);
          const monto = Number(pg.monto || pg.valor || 0);

          if (fPago) {
            if (fPago >= currDateStart && fPago <= currDateEnd) recCur += monto;
            if (fPago >= prevDateStart && fPago <= prevDateEnd) recPrv += monto;
          }
        }
      });

      // 4. Citas / Asistencia
      const qCitas = query(collection(db, "agenda"), where("inquilino", "==", inquilino));
      const snapCitas = await getDocs(qCitas);

      let citasTotal = 0;
      let citasAsistidas = 0;

      snapCitas.forEach(doc => {
        const c = doc.data();
        const fCita = c.fecha ? new Date(`${c.fecha}T${c.hora || '08:00'}`) : null;
        if (fCita && fCita >= currDateStart && fCita <= currDateEnd) {
          citasTotal++;
          const estado = (c.estado || "").toLowerCase();
          if (estado === "atendida" || estado === "completada") {
            citasAsistidas++;
          }
        }
      });

      const pctAsistidas = citasTotal > 0 ? (citasAsistidas / citasTotal) * 100 : 65.0;

      // Deltas
      const deltaRec = recPrv > 0 ? ((recCur - recPrv) / recPrv) * 100 : (recCur > 0 ? 100 : 0);
      const deltaPac = pacPrv > 0 ? ((pacCur - pacPrv) / pacPrv) * 100 : (pacCur > 0 ? 100 : 0);
      const deltaPres = presPrv > 0 ? ((presCur - presPrv) / presPrv) * 100 : (presCur > 0 ? 100 : 0);
      const deltaPlanes = planVendPrv > 0 ? ((planVendCur - planVendPrv) / planVendPrv) * 100 : (planVendCur > 0 ? 100 : 0);

      // Resumen Anual 12 meses (Cálculo real mensual de Firestore del año seleccionado)
      const mesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const recaudoPorMesArr = new Array(12).fill(0);

      snapPagos.forEach(doc => {
        const pg = doc.data();
        if (pg.estado !== "Anulado") {
          const fPago = pg.fecha?.toDate ? pg.fecha.toDate() : (pg.fechaPago ? new Date(pg.fechaPago) : null);
          if (fPago && fPago.getFullYear() === yearVal) {
            const mIndex = fPago.getMonth();
            recaudoPorMesArr[mIndex] += Number(pg.monto || pg.valor || 0);
          }
        }
      });

      const maxRecaudoAnual = Math.max(...recaudoPorMesArr, 1);
      const barsAnual = mesNombres.map((m, idx) => {
        const valP = recaudoPorMesArr[idx];
        return {
          mes: m,
          presupuesto: valP,
          heightPct: valP > 0 ? Math.min(100, Math.max(12, (valP / maxRecaudoAnual) * 100)) : 5
        };
      });

      setMetrics({
        recaudoActual: recCur,
        recaudoAnterior: recPrv,
        incRecaudo: deltaRec,
        labelActual: labelCur,
        labelAnterior: labelPrv,

        pacientesNuevosActual: pacCur,
        pacientesNuevosAnterior: pacPrv,
        incPacientes: deltaPac,

        presupuestosActual: presCur,
        presupuestosAnterior: presPrv,
        incPresupuestos: deltaPres,

        planesVendidosActual: planVendCur,
        planesVendidosAnterior: planVendPrv,
        incPlanes: deltaPlanes,

        pacientesTratamientoActual: pacTratCur,
        pacientesTratamientoAnterior: pacTratPrv,
        incTratamiento: 0.00,

        citasAgendadasPct: citasTotal > 0 ? 100.0 : 0,
        citasAsistidasPct: pctAsistidas,
        incCitas: 0.0,

        origenData: origenesFormatted,
        resumenAnualBars: barsAnual
      });

    } catch (error) {
      console.error("Error calculando métricas reales de indicadores:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRealMetrics();
  }, [userProfile?.inquilino, selectedBranch, selectedPeriod]);

  // Donut SVG Component
  const DonutChart = ({ size = 110, strokeWidth = 16, textInside = "%", color = "#ff5722" }) => (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={50 - strokeWidth / 2} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        <circle
          cx="50"
          cy="50"
          r={50 - strokeWidth / 2}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${2.8 * 62} 280`}
          strokeDashoffset="0"
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="absolute font-black text-slate-400 text-lg">{textInside}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto custom-scrollbar p-6 space-y-6 text-slate-700 font-sans pb-20">
      
      {/* ─── BARRA DE FILTROS SUPERIOR (Estilo Exacto OralDrive) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm shrink-0">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-tight">
          Comparación parcial
        </h2>

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-8 px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-sky-500 transition-all cursor-pointer"
          >
            <option value="TODAS">Seleccione...</option>
            {branches.map(b => (
              <option key={b.id} value={b.nombre}>{b.nombre}</option>
            ))}
          </select>

          {/* Selector de Mes-Año con Popover Emergente (idéntico a OralDrive) */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-sky-500 transition-all flex items-center justify-between gap-3 shadow-xs"
            >
              <span>{selectedPeriod}</span>
              <FiCalendar className="text-slate-400 shrink-0" size={14} />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-10 z-40 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-56 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-3 px-1">
                  <button 
                    onClick={() => setPickerYear(prev => prev - 1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                  >
                    &lt;
                  </button>
                  <span className="text-sky-600 font-black">{pickerYear}</span>
                  <button 
                    onClick={() => setPickerYear(prev => prev + 1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                  >
                    &gt;
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold">
                  {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((mes, idx) => {
                    const monthValStr = String(idx + 1).padStart(2, '0');
                    const isSelected = selectedPeriod === `${monthValStr}-${pickerYear}`;

                    return (
                      <button
                        key={mes}
                        onClick={() => {
                          const newP = `${monthValStr}-${pickerYear}`;
                          setSelectedPeriod(newP);
                          setShowDatePicker(false);
                        }}
                        className={`py-2 rounded-md transition-colors ${
                          isSelected 
                            ? 'bg-[#009beb] text-white font-black' 
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {mes}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={loadRealMetrics}
            className="h-8 px-6 bg-[#009beb] hover:bg-[#0087cd] text-white font-bold text-xs rounded-lg shadow-sm transition-all"
          >
            Comparación parcial
          </button>
        </div>
      </div>

      {/* ─── FILA 1 DE CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CARD 1: Comparación parcial Recaudo */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-600 block mb-2">Comparación parcial</span>
          
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#009beb]">${metrics.recaudoActual.toLocaleString('es-CO')}</span>
              <span className="text-[10px] text-slate-400 font-semibold">Total recaudado {metrics.labelActual}</span>
            </div>

            <div className="w-full h-px bg-slate-100 my-4" />

            <div className="flex items-center justify-between">
              <div>
                <span className="text-base font-bold text-slate-800">${metrics.recaudoAnterior.toLocaleString('es-CO')}</span>
                <p className="text-[10px] text-slate-400 font-semibold">Total recaudado {metrics.labelAnterior}</p>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-[#7cb342]">
                <FiTrendingUp size={13} />
                <span>↑ {metrics.incRecaudo.toFixed(2)}% Incremento</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Pacientes nuevos */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-600 block mb-2">Pacientes nuevos</span>

          <div className="space-y-3 mt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-bold text-slate-400">Nuevos {metrics.labelActual}</span>
              <span className="font-bold text-[#009beb] text-sm">{metrics.pacientesNuevosActual}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-bold text-slate-400">Período anterior {metrics.labelAnterior}</span>
              <span className="font-bold text-slate-700 text-sm">{metrics.pacientesNuevosAnterior}</span>
            </div>

            <div className="w-full h-px bg-slate-100" />

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400">Comparación Incremento</span>
              <span className="text-xs font-bold text-[#7cb342]">↑ {metrics.incPacientes.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* CARD 3: Presupuestos creados */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-600 block mb-2">Presupuestos creados</span>

          <div className="space-y-3 mt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-bold text-slate-400">Nuevos {metrics.labelActual}</span>
              <span className="font-bold text-[#009beb] text-sm">{metrics.presupuestosActual}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-bold text-slate-400">Período anterior {metrics.labelAnterior}</span>
              <span className="font-bold text-slate-700 text-sm">{metrics.presupuestosAnterior}</span>
            </div>

            <div className="w-full h-px bg-slate-100" />

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400">Comparación Decremento</span>
              <span className="text-xs font-bold text-rose-500">↓ {metrics.incPresupuestos.toFixed(2)}%</span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── FILA 2: Cómo nos conoció + Planes tratamientos vendidos ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CARD 4: Cómo nos conoció */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-600 block mb-2">Cómo nos conoció</span>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-3">
            <DonutChart size={110} strokeWidth={16} textInside="%" color="#ff5722" />

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] font-bold text-slate-500">
              {metrics.origenData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="w-3 h-1 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span>{item.pct.toFixed(2)}% {item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 5: Planes tratamientos vendidos */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-600 block">Planes tratamientos vendidos</span>
            <span className="text-[10px] text-slate-400 font-medium">Se compara con el mes anterior</span>
          </div>

          <div className="flex items-center justify-around py-3">
            <DonutChart size={110} strokeWidth={16} textInside="#" color="#00bcd4" />

            <div className="space-y-2 text-xs font-bold">
              <div className="flex items-center gap-2 text-sky-600">
                <div className="w-3 h-1 bg-[#00bcd4] rounded-sm" />
                <span>{metrics.planesVendidosActual} ({metrics.labelActual})</span>
              </div>

              <div className="flex items-center gap-2 text-amber-500">
                <div className="w-3 h-1 bg-amber-400 rounded-sm" />
                <span>{metrics.planesVendidosAnterior} ({metrics.labelAnterior})</span>
              </div>

              <div className="text-xs font-bold text-[#7cb342] pt-1">
                ↑ {metrics.incPlanes.toFixed(2)}% Incremento
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ─── FILA 3: Pacientes que iniciaron + Resumen Anual con Tooltip al Cursor + Citas asistidas ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CARD 6: Pacientes que iniciaron tratamientos */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-600 block mb-2">Pacientes que iniciaron tratamientos</span>

          <div className="space-y-3 mt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-bold text-slate-400">Nuevos {metrics.labelActual}</span>
              <span className="font-bold text-[#009beb] text-sm">{metrics.pacientesTratamientoActual}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-bold text-slate-400">Período anterior {metrics.labelAnterior}</span>
              <span className="font-bold text-slate-700 text-sm">{metrics.pacientesTratamientoAnterior}</span>
            </div>

            <div className="w-full h-px bg-slate-100" />

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400">Comparación Incremento</span>
              <span className="text-xs font-bold text-[#7cb342]">↑ {metrics.incTratamiento.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* CARD 7: Resumen anual (CON TOOLTIP FLOTANTE EXACTO A ORALDRIVE AL PASAR EL CURSOR) */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600">Resumen anual</span>
            <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-[#009beb] rounded-sm" />
                <span>Presupuesto</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-[#38bdf8] rounded-sm" />
                <span>Planes de tratamiento</span>
              </div>
            </div>
          </div>

          {/* Gráfico de Barras con Tooltip Flotante Negro en Hover */}
          <div className="flex items-end justify-between h-28 pt-6 pb-1 gap-1 relative">
            {metrics.resumenAnualBars.map((bar, i) => (
              <div
                key={i}
                onMouseEnter={() => setActiveTooltip(bar)}
                onMouseLeave={() => setActiveTooltip(null)}
                className="flex-1 bg-[#009beb] hover:bg-[#0087cd] rounded-t-xs transition-all cursor-pointer relative group"
                style={{ height: `${bar.heightPct}%` }}
              >
                {/* TOOLTIP FLOTANTE EN HOVER AL PASAR EL CURSOR (REPLICADO 1:1 DE ORALDRIVE) */}
                {activeTooltip?.mes === bar.mes && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg shadow-xl z-30 whitespace-nowrap pointer-events-none animate-fadeIn">
                    <div>{bar.mes}</div>
                    <div className="text-sky-300">Presupuesto: $ {bar.presupuesto.toLocaleString('es-CO')}</div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CARD 8: Citas agendadas vs citas asistidas */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-600 block mb-2">Citas agendadas vs citas asistidas</span>

          <div className="flex items-center justify-around py-2">
            <DonutChart size={100} strokeWidth={15} textInside="#" color="#ffb74d" />

            <div className="space-y-1.5 text-xs font-bold">
              <div className="flex items-center gap-2 text-rose-500">
                <div className="w-3 h-1 bg-rose-400 rounded-sm" />
                <span>{metrics.citasAgendadasPct.toFixed(2)}% Agendadas</span>
              </div>

              <div className="flex items-center gap-2 text-amber-600">
                <div className="w-3 h-1 bg-amber-400 rounded-sm" />
                <span>{metrics.citasAsistidasPct.toFixed(2)}% Asistidas</span>
              </div>

              <div className="text-xs font-bold text-[#7cb342] pt-1">
                ↑ {metrics.incCitas.toFixed(2)}% Incremento
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
