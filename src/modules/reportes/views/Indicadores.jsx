import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import { FiCalendar, FiTrendingUp, FiTrendingDown, FiRefreshCw, FiCheckCircle } from "react-icons/fi";
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

  // Stats State calculados con PostgreSQL de tu VPS
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

    citasTotalActual: 0,
    citasAsistidasActual: 0,
    citasTotalAnterior: 0,
    citasAsistidasAnterior: 0,
    citasAsistidasPct: 0,
    incCitas: 0,

    origenData: [],
    resumenAnualBars: []
  });

  // Año activo derivado del período seleccionado (ej: "10-2026" -> 2026)
  const activeYear = useMemo(() => {
    const parts = (selectedPeriod || "").split("-");
    return parts.length === 2 && parseInt(parts[1], 10) ? parseInt(parts[1], 10) : new Date().getFullYear();
  }, [selectedPeriod]);

  // Cargar Sucursales reales de tu VPS (PostgreSQL / ConfigPersistence)
  useEffect(() => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
    if (!tenantId) return;

    const fetchBranches = async () => {
      try {
        let bList = [];
        try {
          const cfgSuc = await getConfigItems(tenantId, "sucursales", "sucursales");
          if (Array.isArray(cfgSuc) && cfgSuc.length > 0) {
            cfgSuc.forEach(s => {
              const name = s.nombre || s.nombreSucursal || s.nombreComercial || s.name;
              if (name && !bList.some(item => String(item.id).toLowerCase() === String(s.id).toLowerCase() || item.nombre.toLowerCase() === name.toLowerCase())) {
                bList.push({ id: s.id, nombre: name, esPrincipal: Boolean(s.esPrincipal || s.principal) });
              }
            });
          }
        } catch (e) {
          console.warn("Aviso al consultar sucursales en config:", e);
        }

        try {
          const { data } = await supabase.from("sucursales").select("*").eq("tenant_id", tenantId);
          (data || []).forEach(s => {
            const name = s.nombre || s.name;
            if (name && !bList.some(item => String(item.id).toLowerCase() === String(s.id).toLowerCase() || item.nombre.toLowerCase() === name.toLowerCase())) {
              bList.push({ id: s.id, nombre: name, esPrincipal: Boolean(s.esPrincipal || s.principal) });
            }
          });
        } catch (e) {
          console.warn("Aviso al consultar tabla sucursales:", e);
        }

        if (bList.length === 0) {
          bList.push({ id: "PRINCIPAL", nombre: "Clínica Dental Sincelejo - Sede Principal", esPrincipal: true });
        }
        setBranches(bList);
      } catch (err) {
        console.error("Error cargando sucursales desde el VPS:", err);
      }
    };
    fetchBranches();
  }, [userProfile?.inquilino, userProfile?.tenant_id]);

  // Helper robusto para filtrar por sucursal en memoria respetando el VPS
  const matchesBranchFilter = useCallback((item, branchFilter) => {
    if (!branchFilter || branchFilter === "TODAS") return true;

    const targetBranch = String(branchFilter).trim().toLowerCase();
    const branchObj = branches.find(
      b => String(b.id).trim().toLowerCase() === targetBranch || String(b.nombre).trim().toLowerCase() === targetBranch
    );

    const targetId = branchObj ? String(branchObj.id).trim().toLowerCase() : targetBranch;
    const targetName = branchObj ? String(branchObj.nombre).trim().toLowerCase() : targetBranch;

    // Verificar todas las posibles columnas de sucursal que use el registro
    const itemSucId = String(item.sucursal_id || item.sucursalId || item.sede_id || item.sedeId || "").trim().toLowerCase();
    const itemSucNom = String(item.sucursal || item.sucursal_nombre || item.sucursalNombre || item.sede || item.oficina || "").trim().toLowerCase();

    if (itemSucId || itemSucNom) {
      if (itemSucId && (itemSucId === targetId || itemSucId === targetName)) return true;
      if (itemSucNom && (itemSucNom === targetName || itemSucNom === targetId || itemSucNom.includes(targetName) || targetName.includes(itemSucNom))) return true;
      return false;
    }

    // Si el registro histórico no tiene sucursal explícita:
    // Aplica a la sucursal si es la única sede de la clínica o es la principal
    const isPrincipal = Boolean(branchObj?.esPrincipal || targetName.includes("principal") || branches.length <= 1);
    return isPrincipal;
  }, [branches]);

  // Cargar Métricas reales de tu PostgreSQL en el VPS
  const loadRealMetrics = useCallback(async () => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
    if (!tenantId) return;
    setLoading(true);

    try {
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

      // ─── 1. PACIENTES (Nuevos y Medio de Atracción) ───
      let snapPacientes = [];
      try {
        const { data, error } = await supabase
          .from("pacientes")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (!error && data) snapPacientes = data;
      } catch (e) {
        console.warn("Aviso al consultar pacientes en VPS:", e);
      }

      // Filtrar por sucursal
      const pacientesFiltrados = (snapPacientes || []).filter(p => matchesBranchFilter(p, selectedBranch));

      let pacCur = 0;
      let pacPrv = 0;
      const origenesCount = {};
      let totalPacientesConMedio = 0;

      pacientesFiltrados.forEach(p => {
        const rawDate = p.created_at || (p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt) || p.fechaCreacion || p.fecha_ingreso;
        const fCreated = rawDate ? new Date(rawDate) : null;
        const isValidDate = fCreated && !isNaN(fCreated.getTime());

        if (isValidDate) {
          if (fCreated >= currDateStart && fCreated <= currDateEnd) pacCur++;
          if (fCreated >= prevDateStart && fCreated <= prevDateEnd) pacPrv++;
        }

        // Analizar cómo nos conoció (evaluando todas las variantes de columna)
        const rawMedio =
          p.como_conocio ||
          p.comoConocio ||
          p.comoNosConocio ||
          p.medioAtraccion ||
          p.medio_atraccion ||
          p.fuente ||
          p.remitido_por ||
          p.remitidoPor ||
          p.canal ||
          p.origen ||
          "";

        let medio = rawMedio && String(rawMedio).trim() ? String(rawMedio).trim() : "Sin información";
        medio = medio.charAt(0).toUpperCase() + medio.slice(1).toLowerCase();
        if (medio === "Sin informacion") medio = "Sin información";

        // Registrar para la distribución
        origenesCount[medio] = (origenesCount[medio] || 0) + 1;
        totalPacientesConMedio++;
      });

      const totalPac = totalPacientesConMedio || 1;
      const palette = ["#ff5722", "#009beb", "#22c55e", "#00bcd4", "#eab308", "#f43f5e", "#8b5cf6", "#ec4899", "#84cc16", "#38bdf8"];
      let paletteIdx = 0;

      const origenesFormatted = Object.entries(origenesCount).map(([label, count]) => {
        const pct = totalPac > 0 ? (count / totalPac) * 100 : 0;
        const color = palette[paletteIdx % palette.length];
        paletteIdx++;
        return { label, count, pct: isNaN(pct) ? 0 : pct, color };
      });

      // ─── 2. PRESUPUESTOS Y PLANES DE TRATAMIENTO ───
      let snapPlanes = [];
      try {
        const { data, error } = await supabase
          .from("treatment_plans")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (!error && data) snapPlanes = data;
      } catch (e) {
        console.warn("Aviso al consultar treatment_plans en VPS:", e);
      }

      // Filtrar por sucursal
      const planesFiltrados = (snapPlanes || []).filter(p => {
        let d = p.detalles || {};
        if (typeof d === "string") {
          try { d = JSON.parse(d); } catch (e) { d = {}; }
        }
        return matchesBranchFilter({ ...p, ...d }, selectedBranch);
      });

      let presCur = 0;
      let presPrv = 0;
      let planVendCur = 0;
      let planVendPrv = 0;
      const pacTratCurSet = new Set();
      const pacTratPrvSet = new Set();

      const presAnualArr = new Array(12).fill(0);
      const planAnualArr = new Array(12).fill(0);

      planesFiltrados.forEach(p => {
        let d = p.detalles || {};
        if (typeof d === "string") {
          try { d = JSON.parse(d); } catch (e) { d = {}; }
        }

        const rawDate = p.created_at || (p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt) || p.fecha_creacion || p.fecha || p.date;
        const fCreated = rawDate ? new Date(rawDate) : null;

        const totalVal = Number(p.total || p.montoTotal || p.valor || p.costoTotal || d.total || d.costoTotal || 0);
        const pagadoVal = Number(p.pagado || p.montoPagado || p.abono || d.pagado || 0);
        const statusStr = String(p.status || p.estado || d.status || d.estado || "").toLowerCase();

        const itemsList = Array.isArray(d) ? d : (d.items && Array.isArray(d.items) ? d.items : []);
        const hasItemRealizado = itemsList.some(it => it.realizada || it.realizado || it.pagada || Number(it.pagado || 0) > 0 || String(it.estado || '').toLowerCase() === 'completado');

        const isAceptado =
          statusStr.includes("acept") ||
          statusStr.includes("aprob") ||
          statusStr.includes("approv") ||
          statusStr.includes("inic") ||
          statusStr.includes("curs") ||
          statusStr.includes("comp") ||
          statusStr.includes("fin") ||
          pagadoVal > 0 ||
          hasItemRealizado;

        const pacId = p.paciente_id || p.pacienteId || p.patientId || p.patient_id || d.paciente_id || d.pacienteId || p.documento;

        if (fCreated && !isNaN(fCreated.getTime())) {
          if (fCreated >= currDateStart && fCreated <= currDateEnd) {
            presCur++;
            if (isAceptado) {
              planVendCur++;
              if (pacId) pacTratCurSet.add(pacId);
            }
          }
          if (fCreated >= prevDateStart && fCreated <= prevDateEnd) {
            presPrv++;
            if (isAceptado) {
              planVendPrv++;
              if (pacId) pacTratPrvSet.add(pacId);
            }
          }

          // Resumen Anual correspondiente al año seleccionado
          if (fCreated.getFullYear() === yearVal) {
            const mIdx = fCreated.getMonth();
            presAnualArr[mIdx] += totalVal;
            if (isAceptado) {
              planAnualArr[mIdx] += (pagadoVal > 0 ? pagadoVal : totalVal);
            }
          }
        }
      });

      // ─── 3. PAGOS / RECAUDOS REALES DE TU VPS ───
      let snapPagos = [];
      try {
        const { data, error } = await supabase
          .from("pagos")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (!error && data) snapPagos = data;
      } catch (e) {
        console.warn("Aviso al consultar pagos en VPS:", e);
      }

      // Filtrar por sucursal
      const pagosFiltrados = (snapPagos || []).filter(pg => matchesBranchFilter(pg, selectedBranch));

      let recCur = 0;
      let recPrv = 0;

      pagosFiltrados.forEach(pg => {
        if (pg && String(pg.estado || "").toLowerCase() !== "anulado") {
          const rawFecha = (pg.fecha?.toDate ? pg.fecha.toDate() : null) || pg.fechaPago || pg.fecha_pago || pg.fecha || pg.created_at;
          const fPago = rawFecha ? new Date(rawFecha) : null;
          const monto = Number(pg.monto || pg.valor || 0);

          if (fPago && !isNaN(fPago.getTime())) {
            if (fPago >= currDateStart && fPago <= currDateEnd) recCur += monto;
            if (fPago >= prevDateStart && fPago <= prevDateEnd) recPrv += monto;
          }
        }
      });

      // ─── 4. CITAS Y ASISTENCIA REALES DE TU VPS ───
      let snapCitas = [];
      try {
        const { data, error } = await supabase
          .from("citas")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (!error && data) snapCitas = data;
      } catch (e) {
        console.warn("Aviso al consultar citas en VPS:", e);
      }

      // Filtrar por sucursal
      const citasFiltradas = (snapCitas || []).filter(c => matchesBranchFilter(c, selectedBranch));

      let citasCurTotal = 0;
      let citasCurAsistidas = 0;
      let citasPrvTotal = 0;
      let citasPrvAsistidas = 0;

      citasFiltradas.forEach(c => {
        const rawDate = c.fecha_inicio || c.fechaInicio || (c.fecha ? `${c.fecha}T${c.hora || "08:00"}:00` : (c.created_at || c.createdAt));
        const fCita = rawDate ? new Date(rawDate) : null;
        if (!fCita || isNaN(fCita.getTime())) return;

        const est = String(c.estado || "").toLowerCase().trim();
        const isCancelled = est.includes("cancel") || est.includes("anul") || est.includes("no asiste");
        const isAsistida = est.includes("atend") || est.includes("complet") || est.includes("consulta") || est.includes("finaliz");

        if (fCita >= currDateStart && fCita <= currDateEnd) {
          if (!isCancelled) citasCurTotal++;
          if (isAsistida) citasCurAsistidas++;
        }
        if (fCita >= prevDateStart && fCita <= prevDateEnd) {
          if (!isCancelled) citasPrvTotal++;
          if (isAsistida) citasPrvAsistidas++;
        }
      });

      const pctCurAsistidas = citasCurTotal > 0 ? (citasCurAsistidas / citasCurTotal) * 100 : 0;
      const pctPrvAsistidas = citasPrvTotal > 0 ? (citasPrvAsistidas / citasPrvTotal) * 100 : 0;

      // Deltas Comparativos Dinámicos con protección matemática (sin división por cero)
      const calculateDelta = (actual, anterior) => {
        if (anterior === 0) {
          return actual > 0 ? 100 : 0;
        }
        return ((actual - anterior) / anterior) * 100;
      };

      const deltaRec = calculateDelta(recCur, recPrv);
      const deltaPac = calculateDelta(pacCur, pacPrv);
      const deltaPres = calculateDelta(presCur, presPrv);
      const deltaPlanes = calculateDelta(planVendCur, planVendPrv);
      const deltaTratamiento = calculateDelta(pacTratCurSet.size, pacTratPrvSet.size);
      const deltaCitas = calculateDelta(pctCurAsistidas, pctPrvAsistidas);

      // Resumen Anual 12 meses normalizado
      const mesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const maxAnualVal = Math.max(...presAnualArr, ...planAnualArr, 1);

      const barsAnual = mesNombres.map((m, idx) => {
        const valPres = presAnualArr[idx];
        const valPlan = planAnualArr[idx];
        return {
          mes: m,
          presupuesto: valPres,
          planesTratamiento: valPlan,
          heightPctPresupuesto: valPres > 0 ? Math.min(100, Math.max(12, (valPres / maxAnualVal) * 100)) : 4,
          heightPctPlanes: valPlan > 0 ? Math.min(100, Math.max(12, (valPlan / maxAnualVal) * 100)) : 4
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

        pacientesTratamientoActual: pacTratCurSet.size,
        pacientesTratamientoAnterior: pacTratPrvSet.size,
        incTratamiento: deltaTratamiento,

        citasTotalActual: citasCurTotal,
        citasAsistidasActual: citasCurAsistidas,
        citasTotalAnterior: citasPrvTotal,
        citasAsistidasAnterior: citasPrvAsistidas,
        citasAsistidasPct: pctCurAsistidas,
        incCitas: deltaCitas,

        origenData: origenesFormatted,
        resumenAnualBars: barsAnual
      });

    } catch (error) {
      console.error("Error calculando métricas reales de indicadores:", error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.inquilino, userProfile?.tenant_id, selectedBranch, selectedPeriod, matchesBranchFilter]);

  // Ejecución inicial y reactiva
  useEffect(() => {
    loadRealMetrics();
  }, [loadRealMetrics]);

  // Donut SVG Component con cálculo dinámico proporcional
  const DonutChart = ({ size = 110, strokeWidth = 16, textInside = "%", color = "#ff5722", percentage = 100, segments = null }) => {
    const radius = 50 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;

    if (Array.isArray(segments) && segments.length > 0) {
      let currentOffset = 0;
      return (
        <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
            {segments.map((seg, idx) => {
              const segPct = Math.max(0, Math.min(100, Number(seg.pct || 0)));
              const strokeLength = (segPct / 100) * circumference;
              const dasharray = `${strokeLength} ${circumference}`;
              const dashoffset = -currentOffset;
              currentOffset += strokeLength;
              if (strokeLength <= 0) return null;
              return (
                <circle
                  key={idx}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={seg.color || "#009beb"}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dasharray}
                  strokeDashoffset={dashoffset}
                  transform="rotate(-90 50 50)"
                  strokeLinecap="butt"
                />
              );
            })}
          </svg>
          <span className="absolute font-black text-slate-400 text-lg">{textInside}</span>
        </div>
      );
    }

    const validPct = Math.max(0, Math.min(100, Number(percentage || 0)));
    const strokeDash = (validPct / 100) * circumference;
    return (
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
          {validPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          )}
        </svg>
        <span className="absolute font-black text-slate-400 text-lg">{textInside}</span>
      </div>
    );
  };

  // Helper para renderizar los deltas de incremento/decremento con exactitud matemática
  const renderDeltaBadge = (actual, anterior, delta) => {
    if (anterior === 0 && actual === 0) {
      return <span className="text-slate-400 font-bold text-xs">0.00%</span>;
    }
    if (anterior === 0 && actual > 0) {
      return (
        <span className="text-[#7cb342] font-bold text-xs flex items-center gap-1">
          <FiTrendingUp size={13} />
          <span>Nuevo (+100%)</span>
        </span>
      );
    }
    if (actual === 0 && anterior > 0) {
      return (
        <span className="text-rose-500 font-bold text-xs flex items-center gap-1">
          <FiTrendingDown size={13} />
          <span>↓ 100.00%</span>
        </span>
      );
    }
    const isPos = delta >= 0;
    return (
      <span className={`text-xs font-bold flex items-center gap-1 ${isPos ? "text-[#7cb342]" : "text-rose-500"}`}>
        {isPos ? <FiTrendingUp size={13} /> : <FiTrendingDown size={13} />}
        <span>{isPos ? "↑" : "↓"} {Math.abs(delta).toFixed(2)}% {isPos ? "Incremento" : "Decremento"}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto custom-scrollbar p-6 space-y-6 text-slate-700 font-sans pb-20">
      
      {/* ─── BARRA DE FILTROS SUPERIOR (100% Funcional con tu VPS) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-tight">
            Comparación parcial
          </h2>
          <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-md">
            Datos en vivo
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Selector de Sucursales real */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-8 px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-sky-500 transition-all cursor-pointer shadow-xs"
            title="Filtrar por sede"
          >
            <option value="TODAS">Todas las sucursales</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.nombre}</option>
            ))}
          </select>

          {/* Selector de Mes-Año con Popover Emergente */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-sky-500 transition-all flex items-center justify-between gap-3 shadow-xs hover:border-slate-300"
            >
              <span>{selectedPeriod}</span>
              <FiCalendar className="text-slate-400 shrink-0" size={14} />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-10 z-40 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-56 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-3 px-1">
                  <button 
                    onClick={() => setPickerYear(prev => prev - 1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 font-bold"
                  >
                    &lt;
                  </button>
                  <span className="text-sky-600 font-black">{pickerYear}</span>
                  <button 
                    onClick={() => setPickerYear(prev => prev + 1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 font-bold"
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

          {/* Botón de Actualizar Datos */}
          <button
            onClick={loadRealMetrics}
            disabled={loading}
            className="h-8 px-5 bg-[#009beb] hover:bg-[#0087cd] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} size={12} />
            <span>{loading ? "Consultando..." : "Actualizar"}</span>
          </button>
        </div>
      </div>

      {/* ─── FILA 1 DE CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CARD 1: Comparación parcial Recaudo */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 block">Comparación parcial</span>
            <span className="text-[9px] font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">Recaudo real</span>
          </div>
          
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

              <div>
                {renderDeltaBadge(metrics.recaudoActual, metrics.recaudoAnterior, metrics.incRecaudo)}
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
              <span className="text-[10px] font-bold text-slate-400">
                {metrics.incPacientes >= 0 ? "Comparación Incremento" : "Comparación Decremento"}
              </span>
              {renderDeltaBadge(metrics.pacientesNuevosActual, metrics.pacientesNuevosAnterior, metrics.incPacientes)}
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
              <span className="text-[10px] font-bold text-slate-400">
                {metrics.incPresupuestos >= 0 ? "Comparación Incremento" : "Comparación Decremento"}
              </span>
              {renderDeltaBadge(metrics.presupuestosActual, metrics.presupuestosAnterior, metrics.incPresupuestos)}
            </div>
          </div>
        </div>

      </div>

      {/* ─── FILA 2: Cómo nos conoció + Planes tratamientos vendidos ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CARD 4: Cómo nos conoció */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-600">Cómo nos conoció</span>
            <span className="text-[10px] text-slate-400 font-medium">Medio de atracción</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-3">
            <DonutChart 
              size={110} 
              strokeWidth={16} 
              textInside="%" 
              segments={metrics.origenData} 
            />

            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10px] font-bold text-slate-500 max-h-24 overflow-y-auto">
              {metrics.origenData.length > 0 ? (
                metrics.origenData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 whitespace-nowrap">
                    <div className="w-3 h-1 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    <span>{item.pct.toFixed(2)}% {item.label}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 italic col-span-2">Sin pacientes registrados aún</div>
              )}
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
            <DonutChart 
              size={110} 
              strokeWidth={16} 
              textInside="#" 
              color="#00bcd4"
              percentage={metrics.planesVendidosActual > 0 ? Math.min(100, (metrics.planesVendidosActual / Math.max(1, metrics.presupuestosActual)) * 100) : 0}
            />

            <div className="space-y-2 text-xs font-bold">
              <div className="flex items-center gap-2 text-sky-600">
                <div className="w-3 h-1 bg-[#00bcd4] rounded-sm shrink-0" />
                <span>{metrics.planesVendidosActual} ({metrics.labelActual})</span>
              </div>

              <div className="flex items-center gap-2 text-amber-500">
                <div className="w-3 h-1 bg-amber-400 rounded-sm shrink-0" />
                <span>{metrics.planesVendidosAnterior} ({metrics.labelAnterior})</span>
              </div>

              <div className="pt-1">
                {renderDeltaBadge(metrics.planesVendidosActual, metrics.planesVendidosAnterior, metrics.incPlanes)}
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
              <span className="text-[10px] font-bold text-slate-400">
                {metrics.incTratamiento >= 0 ? "Comparación Incremento" : "Comparación Decremento"}
              </span>
              {renderDeltaBadge(metrics.pacientesTratamientoActual, metrics.pacientesTratamientoAnterior, metrics.incTratamiento)}
            </div>
          </div>
        </div>

        {/* CARD 7: Resumen anual sincronizado con activeYear */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600">Resumen anual {activeYear}</span>
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

          {/* Gráfico de Barras con Etiquetas de Mes y Tooltip Flotante */}
          <div className="flex items-end justify-between h-28 pt-4 pb-5 gap-1 relative border-b border-slate-100">
            {metrics.resumenAnualBars.map((bar, i) => (
              <div
                key={i}
                onMouseEnter={() => setActiveTooltip(bar)}
                onMouseLeave={() => setActiveTooltip(null)}
                className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer relative group"
              >
                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                  <div
                    className="w-1/2 bg-[#009beb] hover:bg-[#0087cd] rounded-t-xs transition-all"
                    style={{ height: `${bar.heightPctPresupuesto}%` }}
                  />
                  <div
                    className="w-1/2 bg-[#38bdf8] hover:bg-[#0284c7] rounded-t-xs transition-all"
                    style={{ height: `${bar.heightPctPlanes}%` }}
                  />
                </div>
                <span className="text-[8px] font-bold text-slate-400 mt-1 absolute -bottom-5">
                  {bar.mes}
                </span>

                {/* Tooltip flotante en Hover */}
                {activeTooltip?.mes === bar.mes && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg shadow-xl z-30 whitespace-nowrap pointer-events-none animate-fadeIn">
                    <div className="text-white border-b border-slate-700 pb-0.5 mb-0.5">{bar.mes} {activeYear}</div>
                    <div className="text-sky-300">Presupuestos: $ {bar.presupuesto.toLocaleString('es-CO')}</div>
                    <div className="text-cyan-200">Planes: $ {bar.planesTratamiento.toLocaleString('es-CO')}</div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CARD 8: Citas agendadas vs citas asistidas */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-600">Citas agendadas vs asistidas</span>
            <span className="text-[10px] font-semibold text-slate-400">{metrics.labelActual}</span>
          </div>

          <div className="flex items-center justify-around py-2">
            <DonutChart 
              size={100} 
              strokeWidth={15} 
              textInside="%" 
              color="#ffb74d" 
              percentage={metrics.citasAsistidasPct} 
            />

            <div className="space-y-1.5 text-xs font-bold">
              <div className="flex items-center gap-2 text-rose-500">
                <div className="w-3 h-1 bg-rose-400 rounded-sm shrink-0" />
                <span>{metrics.citasTotalActual} Agendadas</span>
              </div>

              <div className="flex items-center gap-2 text-amber-600">
                <div className="w-3 h-1 bg-amber-400 rounded-sm shrink-0" />
                <span>{metrics.citasAsistidasActual} Asistidas ({metrics.citasAsistidasPct.toFixed(1)}%)</span>
              </div>

              <div className="pt-1">
                {renderDeltaBadge(metrics.citasAsistidasActual, metrics.citasAsistidasAnterior, metrics.incCitas)}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
