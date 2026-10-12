import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import { FiCalendar, FiRefreshCw } from "react-icons/fi";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

// Catálogo de canales de atracción estándar de OralDrive
const CANALES_ORALDRIVE_COL1 = [
  { label: "Fachada", color: "#00bcd4" },
  { label: "Tik Tok", color: "#4fc3f7" },
  { label: "Facebook", color: "#29b6f6" },
  { label: "Youtube", color: "#8bc34a" },
  { label: "Volante", color: "#ff9800" },
  { label: "Otro", color: "#ab47bc" },
  { label: "Sin información", color: "#f44336" }
];

const CANALES_ORALDRIVE_COL2 = [
  { label: "Referido", color: "#ec407a" },
  { label: "Radio", color: "#4caf50" },
  { label: "Instagram", color: "#26a69a" },
  { label: "Google", color: "#1e88e5" },
  { label: "Prensa", color: "#e53935" }
];

const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_NOMBRES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const getMonthAbbr = (monthIndex, year) => {
  const m = MESES_ES[monthIndex] || "mes";
  return `${m}. ${year}`;
};

export default function Indicadores() {
  const { userProfile } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(() => format(new Date(), "MM/yyyy"));
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Stats State calculados con PostgreSQL del VPS
  const [metrics, setMetrics] = useState({
    recaudoActual: 0,
    recaudoAnterior: 0,
    incRecaudo: 0,
    labelActual: getMonthAbbr(new Date().getMonth(), new Date().getFullYear()),
    labelAnterior: getMonthAbbr((new Date().getMonth() + 11) % 12, new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()),

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

    origenDataCol1: [],
    origenDataCol2: [],
    resumenAnualBars: []
  });

  // Año activo derivado del período seleccionado (ej: "07/2026" -> 2026)
  const activeYear = useMemo(() => {
    const parts = (selectedPeriod || "").replace("-", "/").split("/");
    return parts.length === 2 && parseInt(parts[1], 10) ? parseInt(parts[1], 10) : new Date().getFullYear();
  }, [selectedPeriod]);

  // Cargar Sucursales reales de tu VPS (PostgreSQL / ConfigPersistence)
  useEffect(() => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
    if (!tenantId) return;

    const fetchBranches = async () => {
      try {
        let bList = [];

        // 1. Probar desde website_config
        try {
          const cfgSuc = await getConfigItems(tenantId, "sucursales", "sucursales");
          if (Array.isArray(cfgSuc) && cfgSuc.length > 0) {
            cfgSuc.forEach(s => {
              const name = s.nombre || s.nombreSucursal || s.nombreComercial || s.name;
              if (name && !bList.some(item => String(item.id).toLowerCase() === String(s.id).toLowerCase() || item.nombre.toLowerCase() === name.toLowerCase())) {
                bList.push({ id: String(s.id || name), nombre: name, esPrincipal: Boolean(s.esPrincipal || s.principal) });
              }
            });
          }
        } catch (e) {
          console.warn("Aviso al consultar sucursales en config:", e);
        }

        // 2. Probar tabla sucursales en PostgreSQL
        try {
          const { data } = await supabase.from("sucursales").select("*").eq("tenant_id", tenantId);
          (data || []).forEach(s => {
            const name = s.nombre || s.name;
            if (name && !bList.some(item => String(item.id).toLowerCase() === String(s.id).toLowerCase() || item.nombre.toLowerCase() === name.toLowerCase())) {
              bList.push({ id: String(s.id || name), nombre: name, esPrincipal: Boolean(s.esPrincipal || s.principal) });
            }
          });
        } catch (e) {
          console.warn("Aviso al consultar tabla sucursales:", e);
        }

        // 3. Si no hay sedes configuradas en DB o config, tomar la sede activa de la clínica
        if (bList.length === 0) {
          const clinicName = userProfile?.nombreClinica || userProfile?.clinica || userProfile?.tenant_nombre || "Sede Principal";
          bList.push({ id: "PRINCIPAL", nombre: clinicName, esPrincipal: true });
        }

        setBranches(bList);
      } catch (err) {
        console.error("Error cargando sucursales desde el VPS:", err);
      }
    };
    fetchBranches();
  }, [userProfile]);

  // Helper robusto para filtrar por sucursal en memoria respetando el VPS
  const matchesBranchFilter = useCallback((item, branchFilter) => {
    if (!branchFilter || branchFilter === "" || branchFilter === "TODAS") return true;

    const targetBranch = String(branchFilter).trim().toLowerCase();
    const branchObj = branches.find(
      b => String(b.id).trim().toLowerCase() === targetBranch || String(b.nombre).trim().toLowerCase() === targetBranch
    );

    const targetId = branchObj ? String(branchObj.id).trim().toLowerCase() : targetBranch;
    const targetName = branchObj ? String(branchObj.nombre).trim().toLowerCase() : targetBranch;

    const itemSucId = String(item.sucursal_id || item.sucursalId || item.sede_id || item.sedeId || "").trim().toLowerCase();
    const itemSucNom = String(item.sucursal || item.sucursal_nombre || item.sucursalNombre || item.sede || item.oficina || "").trim().toLowerCase();

    if (itemSucId || itemSucNom) {
      if (itemSucId && (itemSucId === targetId || itemSucId === targetName)) return true;
      if (itemSucNom && (itemSucNom === targetName || itemSucNom === targetId || itemSucNom.includes(targetName) || targetName.includes(itemSucNom))) return true;
      return false;
    }

    const isPrincipal = Boolean(branchObj?.esPrincipal || targetName.includes("principal") || branches.length <= 1);
    return isPrincipal;
  }, [branches]);

  // Cargar Métricas reales de tu PostgreSQL en el VPS
  const loadRealMetrics = useCallback(async (isManualTrigger = false) => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
    if (!tenantId) return;
    setLoading(true);

    try {
      // Parsear período seleccionado (MM/yyyy o MM-yyyy)
      const cleanPeriod = (selectedPeriod || format(new Date(), "MM/yyyy")).replace("-", "/");
      const [mStr, yStr] = cleanPeriod.split("/");
      const monthIdx = (parseInt(mStr, 10) || (new Date().getMonth() + 1)) - 1;
      const yearVal = parseInt(yStr, 10) || new Date().getFullYear();

      const currDateStart = startOfMonth(new Date(yearVal, monthIdx, 1));
      const currDateEnd = endOfMonth(currDateStart);
      const prevDateStart = startOfMonth(subMonths(currDateStart, 1));
      const prevDateEnd = endOfMonth(prevDateStart);

      const labelCur = getMonthAbbr(monthIdx, yearVal);
      const prevMonthIdx = prevDateStart.getMonth();
      const prevYearVal = prevDateStart.getFullYear();
      const labelPrv = getMonthAbbr(prevMonthIdx, prevYearVal);

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

        const rawMedio = String(
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
          ""
        ).toLowerCase().trim();

        // Normalizar contra los canales OralDrive
        let matchedLabel = "Sin información";
        if (rawMedio) {
          if (rawMedio.includes("fachad")) matchedLabel = "Fachada";
          else if (rawMedio.includes("tik")) matchedLabel = "Tik Tok";
          else if (rawMedio.includes("face")) matchedLabel = "Facebook";
          else if (rawMedio.includes("yout")) matchedLabel = "Youtube";
          else if (rawMedio.includes("volan")) matchedLabel = "Volante";
          else if (rawMedio.includes("refer")) matchedLabel = "Referido";
          else if (rawMedio.includes("rad")) matchedLabel = "Radio";
          else if (rawMedio.includes("insta")) matchedLabel = "Instagram";
          else if (rawMedio.includes("goog")) matchedLabel = "Google";
          else if (rawMedio.includes("prens")) matchedLabel = "Prensa";
          else if (rawMedio.includes("otro")) matchedLabel = "Otro";
          else matchedLabel = "Otro";
        }

        origenesCount[matchedLabel] = (origenesCount[matchedLabel] || 0) + 1;
        totalPacientesConMedio++;
      });

      const totalPac = totalPacientesConMedio;

      const formatCol = (list) => {
        return list.map(item => {
          const count = origenesCount[item.label] || 0;
          let pct = 0;
          if (totalPac > 0) {
            pct = (count / totalPac) * 100;
          } else if (item.label === "Sin información") {
            pct = 100;
          }
          return {
            ...item,
            count,
            pct: isNaN(pct) ? 0 : pct
          };
        });
      };

      const col1Formatted = formatCol(CANALES_ORALDRIVE_COL1);
      const col2Formatted = formatCol(CANALES_ORALDRIVE_COL2);

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

      const pagosFiltrados = (snapPagos || []).filter(pg => matchesBranchFilter(pg, selectedBranch));

      let recCur = 0;
      let recPrv = 0;
      const recAnualArr = new Array(12).fill(0);

      pagosFiltrados.forEach(pg => {
        if (pg && String(pg.estado || "").toLowerCase() !== "anulado") {
          const rawFecha = (pg.fecha?.toDate ? pg.fecha.toDate() : null) || pg.fechaPago || pg.fecha_pago || pg.fecha || pg.created_at;
          const fPago = rawFecha ? new Date(rawFecha) : null;
          const monto = Number(pg.monto || pg.valor || 0);

          if (fPago && !isNaN(fPago.getTime())) {
            if (fPago >= currDateStart && fPago <= currDateEnd) recCur += monto;
            if (fPago >= prevDateStart && fPago <= prevDateEnd) recPrv += monto;

            if (fPago.getFullYear() === yearVal) {
              recAnualArr[fPago.getMonth()] += monto;
            }
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

      // Deltas Comparativos Dinámicos
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

      // Resumen Anual 12 meses
      const maxAnualVal = Math.max(...recAnualArr, ...planAnualArr, 1);

      const barsAnual = MESES_NOMBRES.map((m, idx) => {
        const valRec = recAnualArr[idx];
        const valPlan = planAnualArr[idx];
        return {
          mes: m,
          recaudos: valRec,
          planesTratamiento: valPlan,
          heightPctRecaudos: valRec > 0 ? Math.min(100, Math.max(12, (valRec / maxAnualVal) * 100)) : 4,
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

        origenDataCol1: col1Formatted,
        origenDataCol2: col2Formatted,
        resumenAnualBars: barsAnual
      });

      if (isManualTrigger) {
        toast.success("Comparación parcial actualizada correctamente", { id: "ind-update", duration: 1500 });
      }

    } catch (error) {
      console.error("Error calculando métricas de indicadores:", error);
      if (isManualTrigger) {
        toast.error("Error al actualizar la comparación parcial");
      }
    } finally {
      setLoading(false);
    }
  }, [userProfile?.inquilino, userProfile?.tenant_id, selectedBranch, selectedPeriod, matchesBranchFilter]);

  // Carga inicial
  useEffect(() => {
    loadRealMetrics(false);
  }, [loadRealMetrics]);

  // Componente Donut Circular elegante
  const DonutPlaceholder = ({ symbol = "%", ringColor = "#f1f5f9", activeColor = null, percentage = 0 }) => {
    const size = 96;
    const strokeWidth = 14;
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeDash = (Math.max(0, Math.min(100, percentage)) / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke={ringColor} strokeWidth={strokeWidth} />
          {activeColor && strokeDash > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={activeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          )}
        </svg>
        <span className="absolute font-light text-slate-300 text-2xl select-none">{symbol}</span>
      </div>
    );
  };

  // Helper para renderizar los deltas (incremento/decremento)
  const renderDelta = (delta) => {
    const isPos = delta >= 0;
    return (
      <span className={`text-xs font-bold flex items-center gap-0.5 justify-end ${isPos ? "text-[#7cb342]" : "text-rose-500"}`}>
        <span>{isPos ? "↑" : "↓"}</span>
        <span>{Math.abs(delta).toFixed(2)}%</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 overflow-y-auto custom-scrollbar p-6 space-y-6 text-slate-700 font-sans pb-24">
      
      {/* ─── BARRA SUPERIOR: Comparación parcial + Filtros OralDrive ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-5 py-3.5 rounded-xl border border-slate-200/70 shadow-xs shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-700">
            Comparación parcial
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Sede / Sucursal */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-400 transition-all cursor-pointer shadow-2xs min-w-[150px]"
            title="Filtrar por sede"
          >
            <option value="">Seleccione...</option>
            {branches.length > 1 && (
              <option value="TODAS">Todas las sedes</option>
            )}
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.nombre}</option>
            ))}
          </select>

          {/* Selector de Mes-Año (ej. 07/2026) con Popover */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-400 transition-all flex items-center gap-2.5 shadow-2xs hover:border-slate-300 cursor-pointer min-w-[100px] justify-between"
              title="Seleccionar período"
            >
              <span>{selectedPeriod}</span>
              <FiCalendar className="text-slate-400 shrink-0" size={13} />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-9.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-56 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2.5 px-1">
                  <button 
                    onClick={() => setPickerYear(prev => prev - 1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 font-bold cursor-pointer"
                  >
                    &lt;
                  </button>
                  <span className="text-sky-600 font-bold">{pickerYear}</span>
                  <button 
                    onClick={() => setPickerYear(prev => prev + 1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 font-bold cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1 text-[11px] font-medium">
                  {MESES_NOMBRES.map((mes, idx) => {
                    const monthValStr = String(idx + 1).padStart(2, '0');
                    const targetVal = `${monthValStr}/${pickerYear}`;
                    const isSelected = selectedPeriod.replace("-", "/") === targetVal;

                    return (
                      <button
                        key={mes}
                        onClick={() => {
                          setSelectedPeriod(targetVal);
                          setShowDatePicker(false);
                        }}
                        className={`py-1.5 rounded transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-[#42a5f5] text-white font-bold' 
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

          {/* Botón OralDrive: Comparación parcial */}
          <button
            onClick={() => loadRealMetrics(true)}
            disabled={loading}
            className="h-8 px-4 bg-[#42a5f5] hover:bg-[#1e88e5] text-white font-medium text-xs rounded transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-98"
          >
            {loading && <FiRefreshCw className="animate-spin" size={12} />}
            <span>{loading ? "Consultando..." : "Comparación parcial"}</span>
          </button>
        </div>
      </div>

      {/* ─── FILA 1 DE CARDS (3 Columnas) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CARD 1: Comparación parcial Recaudo */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between min-h-[170px]">
          <h3 className="text-xs font-bold text-slate-700">Comparación parcial</h3>
          
          <div className="space-y-4 my-auto">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#00bcd4]">
                ${Number(metrics.recaudoActual || 0).toLocaleString('es-CO')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Total recaudo {metrics.labelActual}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
              <div>
                <span className="text-sm font-bold text-slate-800">
                  ${Number(metrics.recaudoAnterior || 0).toLocaleString('es-CO')}
                </span>
                <p className="text-[10px] text-slate-400 font-medium">
                  Total recaudo {metrics.labelAnterior}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-[#7cb342] flex items-center justify-end gap-0.5">
                  <span>{metrics.incRecaudo >= 0 ? "↑" : "↓"}</span>
                  <span>{Math.abs(metrics.incRecaudo).toFixed(2)}%</span>
                </div>
                <div className="text-[10px] font-medium text-[#7cb342]">
                  {metrics.incRecaudo >= 0 ? "Incremento" : "Decremento"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Pacientes nuevos */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between min-h-[170px]">
          <h3 className="text-xs font-bold text-slate-700">Pacientes nuevos</h3>

          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center text-xs pb-2 border-b border-dotted border-slate-200">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Nuevos</span>
                <span className="text-[10px] text-slate-400 font-medium">{metrics.labelActual}</span>
              </div>
              <span className="font-bold text-sky-500 text-sm">{metrics.pacientesNuevosActual}</span>
            </div>

            <div className="flex justify-between items-center text-xs pb-2 border-b border-dotted border-slate-200">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Periodo anterior</span>
                <span className="text-[10px] text-slate-400 font-medium">{metrics.labelAnterior}</span>
              </div>
              <span className="font-bold text-sky-500 text-sm">{metrics.pacientesNuevosAnterior}</span>
            </div>

            <div className="flex justify-between items-center text-xs pt-1">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Comparación</span>
                <span className="text-[10px] font-medium text-[#7cb342]">
                  {metrics.incPacientes >= 0 ? "Incremento" : "Decremento"}
                </span>
              </div>
              {renderDelta(metrics.incPacientes)}
            </div>
          </div>
        </div>

        {/* CARD 3: Presupuestos creados */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between min-h-[170px]">
          <h3 className="text-xs font-bold text-slate-700">Presupuestos creados</h3>

          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center text-xs pb-2 border-b border-dotted border-slate-200">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Nuevos</span>
                <span className="text-[10px] text-slate-400 font-medium">{metrics.labelActual}</span>
              </div>
              <span className="font-bold text-sky-500 text-sm">{metrics.presupuestosActual}</span>
            </div>

            <div className="flex justify-between items-center text-xs pb-2 border-b border-dotted border-slate-200">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Periodo anterior</span>
                <span className="text-[10px] text-slate-400 font-medium">{metrics.labelAnterior}</span>
              </div>
              <span className="font-bold text-sky-500 text-sm">{metrics.presupuestosAnterior}</span>
            </div>

            <div className="flex justify-between items-center text-xs pt-1">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Comparación</span>
                <span className="text-[10px] font-medium text-[#7cb342]">
                  {metrics.incPresupuestos >= 0 ? "Incremento" : "Decremento"}
                </span>
              </div>
              {renderDelta(metrics.incPresupuestos)}
            </div>
          </div>
        </div>

      </div>

      {/* ─── FILA 2: Cómo nos conoció + Planes tratamientos vendidos (2 Columnas) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CARD 4: Cómo nos conoció */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-700 mb-2">Cómo nos conoció</h3>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
            {/* Donut con % */}
            <DonutPlaceholder symbol="%" ringColor="#f8fafc" />

            {/* Listado en 2 Columnas idéntico a OralDrive */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[10.5px] text-slate-600 w-full max-w-md">
              {/* Columna 1 */}
              <div className="space-y-1.5">
                {metrics.origenDataCol1.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div className="w-3.5 h-1 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="whitespace-nowrap">{item.pct.toFixed(2)}% {item.label}</span>
                  </div>
                ))}
              </div>

              {/* Columna 2 */}
              <div className="space-y-1.5">
                {metrics.origenDataCol2.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div className="w-3.5 h-1 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="whitespace-nowrap">{item.pct.toFixed(2)}% {item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CARD 5: Planes tratamientos vendidos */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-700">Planes tratamientos vendidos</h3>
            <span className="text-[10px] text-slate-400 block mt-0.5">Se compara con el mes anterior</span>
          </div>

          <div className="flex items-center justify-around py-2">
            <DonutPlaceholder symbol="#" ringColor="#f8fafc" />

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <div className="w-3.5 h-1 bg-[#00bcd4] rounded-full shrink-0" />
                <span className="font-medium">{metrics.planesVendidosActual} ({metrics.labelActual})</span>
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <div className="w-3.5 h-1 bg-[#1e88e5] rounded-full shrink-0" />
                <span className="font-medium">{metrics.planesVendidosAnterior} ({metrics.labelAnterior})</span>
              </div>

              <div className="pt-0.5 text-xs font-bold text-[#7cb342] flex items-center gap-0.5">
                <span>{metrics.incPlanes >= 0 ? "↑" : "↓"}</span>
                <span>{Math.abs(metrics.incPlanes).toFixed(2)}% {metrics.incPlanes >= 0 ? "Incremento" : "Decremento"}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ─── FILA 3: Pacientes que iniciaron + Resumen Anual + Citas asistidas (3 Columnas) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CARD 6: Pacientes que iniciaron tratamientos */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between min-h-[170px]">
          <h3 className="text-xs font-bold text-slate-700">Pacientes que iniciaron tratamientos</h3>

          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center text-xs pb-2 border-b border-dotted border-slate-200">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Nuevos</span>
                <span className="text-[10px] text-slate-400 font-medium">{metrics.labelActual}</span>
              </div>
              <span className="font-bold text-sky-500 text-sm">{metrics.pacientesTratamientoActual}</span>
            </div>

            <div className="flex justify-between items-center text-xs pb-2 border-b border-dotted border-slate-200">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Periodo anterior</span>
                <span className="text-[10px] text-slate-400 font-medium">{metrics.labelAnterior}</span>
              </div>
              <span className="font-bold text-sky-500 text-sm">{metrics.pacientesTratamientoAnterior}</span>
            </div>

            <div className="flex justify-between items-center text-xs pt-1">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Comparación</span>
                <span className="text-[10px] font-medium text-[#7cb342]">
                  {metrics.incTratamiento >= 0 ? "Incremento" : "Decremento"}
                </span>
              </div>
              {renderDelta(metrics.incTratamiento)}
            </div>
          </div>
        </div>

        {/* CARD 7: Resumen anual */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between relative min-h-[170px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700">Resumen anual</h3>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 bg-[#00bcd4] rounded-full" />
                <span className="text-slate-500 font-medium">Recaudos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 bg-[#ec407a] rounded-full" />
                <span className="text-slate-500 font-medium">Planes de tratamiento</span>
              </div>
            </div>
          </div>

          {/* Gráfico de Tendencia Anual 12 Meses */}
          <div className="flex items-end justify-between h-24 pt-3 pb-5 gap-1 relative border-b border-dashed border-slate-200 mt-2">
            {metrics.resumenAnualBars.map((bar, i) => (
              <div
                key={i}
                onMouseEnter={() => setActiveTooltip(bar)}
                onMouseLeave={() => setActiveTooltip(null)}
                className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer relative group"
              >
                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                  <div
                    className="w-1/2 bg-[#00bcd4] hover:bg-[#00acc1] rounded-t-xs transition-all"
                    style={{ height: `${bar.heightPctRecaudos}%` }}
                  />
                  <div
                    className="w-1/2 bg-[#ec407a] hover:bg-[#d81b60] rounded-t-xs transition-all"
                    style={{ height: `${bar.heightPctPlanes}%` }}
                  />
                </div>
                <span className="text-[8px] font-medium text-slate-400 mt-1 absolute -bottom-4">
                  {bar.mes}
                </span>

                {/* Tooltip flotante en hover */}
                {activeTooltip?.mes === bar.mes && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-medium py-1.5 px-2.5 rounded-lg shadow-xl z-30 whitespace-nowrap pointer-events-none animate-fadeIn">
                    <div className="text-white border-b border-slate-700 pb-0.5 mb-0.5 font-bold">{bar.mes} {activeYear}</div>
                    <div className="text-cyan-300">Recaudos: ${bar.recaudos.toLocaleString('es-CO')}</div>
                    <div className="text-pink-300">Planes: ${bar.planesTratamiento.toLocaleString('es-CO')}</div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CARD 8: Citas agendadas vs citas asistidas. */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between min-h-[170px]">
          <h3 className="text-xs font-bold text-slate-700 mb-2">Citas agendadas vs citas asistidas.</h3>

          <div className="flex items-center justify-around py-2">
            {/* Donut rojo idéntico a OralDrive */}
            <DonutPlaceholder symbol="#" ringColor="#f8fafc" activeColor="#ef5350" percentage={100} />

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <div className="w-3.5 h-1 bg-[#ef5350] rounded-full shrink-0" />
                <span className="font-medium">100.00% Agendadas</span>
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <div className="w-3.5 h-1 bg-[#4caf50] rounded-full shrink-0" />
                <span className="font-medium">{metrics.citasAsistidasPct.toFixed(2)}% Asistidas</span>
              </div>

              <div className="pt-0.5 text-xs font-bold text-[#7cb342] flex items-center gap-0.5">
                <span>{metrics.incCitas >= 0 ? "↑" : "↓"}</span>
                <span>{Math.abs(metrics.incCitas).toFixed(2)}% {metrics.incCitas >= 0 ? "Incremento" : "Decremento"}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
