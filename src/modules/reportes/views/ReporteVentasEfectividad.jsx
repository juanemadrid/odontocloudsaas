import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { getConfigItems } from "../../../services/configPersistenceService";
import { FiMenu, FiChevronDown, FiX } from "react-icons/fi";

import { format } from "date-fns";

const PALETTE_COLORS = [
  "#c5c87c", // Olive / Sage (OralDrive primary doctor bar)
  "#a8bfa8", // Sage gray (Sin Doctor)
  "#e05353", // Coral Red
  "#4a90e2", // Sky Blue
  "#f5a623", // Amber Orange
  "#9013fe", // Purple
  "#50e3c2"  // Mint
];

export default function ReporteVentasEfectividad() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(true);

  // Filtros de Fechas y Sucursal
  const now = new Date();
  const [fechaInicial, setFechaInicial] = useState("2025-01-01");
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));
  const [selectedSucursal, setSelectedSucursal] = useState("ATM CENTRO DEL DOLOR OROFACIAL");

  // Filtros aplicados tras hacer clic en Buscar
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2025-01-01",
    fechaFinal: format(now, "yyyy-MM-dd"),
    sucursal: "ATM CENTRO DEL DOLOR OROFACIAL"
  });

  // Listas de datos base
  const [sucursalesList, setSucursalesList] = useState([]);
  const [rawDoctores, setRawDoctores] = useState([]);
  const [rawPlanes, setRawPlanes] = useState([]);
  const [rawPagos, setRawPagos] = useState([]);
  const [rawPacientes, setRawPacientes] = useState([]);

  // Carga inicial de datos desde Supabase
  useEffect(() => {
    const fetchData = async () => {
      const tenantId = userProfile?.inquilino || userProfile?.tenant_id || "juanemadrid/odontocloudsaas";
      setLoading(true);
      try {
        // 1. Cargar Sucursales / Sedes
        let listSucursales = [{ id: "TODAS", nombre: "Todas las sucursales" }];
        try {
          const cfgSucursales = await getConfigItems(tenantId, "sucursales", "sucursales");
          if (Array.isArray(cfgSucursales) && cfgSucursales.length > 0) {
            cfgSucursales.forEach(s => {
              const name = s.nombre || s.nombreSucursal || s.nombreComercial || s.name;
              if (name && !listSucursales.some(item => item.nombre.toLowerCase() === name.toLowerCase())) {
                listSucursales.push({ id: s.id, nombre: name });
              }
            });
          }
        } catch (e) {}

        if (listSucursales.length === 1) {
          listSucursales.push({ id: "PRINCIPAL", nombre: "ATM CENTRO DEL DOLOR OROFACIAL" });
        }
        setSucursalesList(listSucursales);
        if (listSucursales.length > 1) {
          setSelectedSucursal(listSucursales[1].nombre);
          setAppliedFilters(prev => ({ ...prev, sucursal: listSucursales[1].nombre }));
        }

        // 2. Cargar Doctores / Profesionales
        let snapshotUsuarios = [];
        try {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("tenant_id", tenantId);
          if (data) snapshotUsuarios = data;
        } catch (e) {}

        const listProfs = [];
        (snapshotUsuarios || []).forEach((u) => {
          if (isDoctorUser(u)) {
            const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
            const primerApellido = u.apellido || u.apellidos || "";
            const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;
            listProfs.push({
              id: u.id,
              nombre: nombreCompleto,
              allNames: [
                u.id,
                nombreCompleto.toLowerCase(),
                primerNombre.toLowerCase(),
                primerApellido.toLowerCase(),
                (u.email || "").toLowerCase()
              ].filter(Boolean)
            });
          }
        });
        setRawDoctores(listProfs);

        // 3. Cargar Planes de Tratamiento / Presupuestos
        let listPlanes = [];
        try {
          const { data: snapPlanes } = await supabase
            .from("treatment_plans")
            .select("*")
            .eq("tenant_id", tenantId);
          if (snapPlanes) listPlanes = snapPlanes;
        } catch (e) {}
        setRawPlanes(listPlanes);

        // 4. Cargar Pagos / Recaudos Reales
        let listPagos = [];
        try {
          const { data: snapPagos } = await supabase
            .from("pagos")
            .select("*")
            .eq("tenant_id", tenantId);
          if (snapPagos) listPagos = snapPagos;
        } catch (e) {}
        setRawPagos(listPagos);

        // 5. Cargar Pacientes para vinculación autoritativa de doctor tratante
        let listPacientes = [];
        try {
          const { data: snapPacs } = await supabase
            .from("pacientes")
            .select("id, nombre, apellido, nombres, apellidos, documento, nroDocumento, doctorTratante, doctorTratanteId, profesional_id, profesional, sucursal, sucursal_id")
            .eq("tenant_id", tenantId);
          if (snapPacs) listPacientes = snapPacs;
        } catch (e) {}
        setRawPacientes(listPacientes);

      } catch (error) {
        console.error("Error cargando datos para Reporte de Efectividad:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  // Manejador del clic en Buscar
  const handleSearchClick = () => {
    setHasSearched(true);
    setAppliedFilters({
      fechaInicial,
      fechaFinal,
      sucursal: selectedSucursal
    });
  };

  // Cálculo dinámico de Efectividad y Recaudo por Doctor
  const { dataEfectividad, generalIndicador, maxRecaudoValue, totalsResumen } = useMemo(() => {
    const initDate = appliedFilters.fechaInicial ? new Date(appliedFilters.fechaInicial + "T00:00:00") : null;
    const endDate = appliedFilters.fechaFinal ? new Date(appliedFilters.fechaFinal + "T23:59:59") : null;
    const sucursalTarget = (appliedFilters.sucursal || "").toLowerCase();
    const isTodasSucursales = !appliedFilters.sucursal || appliedFilters.sucursal === "Todas las sucursales" || appliedFilters.sucursal === "TODAS";

    // Diccionario de pacientes para resolución de doctor tratante
    const pacMap = {};
    (rawPacientes || []).forEach(p => {
      pacMap[p.id] = p;
      if (p.documento) pacMap[p.documento] = p;
      if (p.nroDocumento) pacMap[p.nroDocumento] = p;
    });

    // Inicializar mapa de doctores registrados
    const map = {};
    rawDoctores.forEach(d => {
      map[d.id] = {
        id: d.id,
        nombre: d.nombre,
        allNames: d.allNames,
        presupuestosGenerados: 0,
        montoPresupuestado: 0,
        presupuestosAceptados: 0,
        montoAceptado: 0,
        recaudo: 0
      };
    });

    // Slot especial "Sin Doctor"
    map["__sin_doctor__"] = {
      id: "__sin_doctor__",
      nombre: "Sin Doctor",
      allNames: ["sin doctor", "—", "ninguno", "sin asignar"],
      presupuestosGenerados: 0,
      montoPresupuestado: 0,
      presupuestosAceptados: 0,
      montoAceptado: 0,
      recaudo: 0
    };

    // Función auxiliar para emparejar doctor
    const matchDoctorKey = (docId, docName) => {
      const cleanId = String(docId || "").trim();
      const cleanName = String(docName || "").trim().toLowerCase();

      if (cleanId && map[cleanId]) return cleanId;

      if (cleanName && cleanName !== "—" && cleanName !== "sin doctor" && cleanName !== "sin asignar") {
        const found = Object.keys(map).find(k => {
          if (k === "__sin_doctor__") return false;
          return map[k].allNames.some(alias => cleanName.includes(alias) || alias.includes(cleanName));
        });
        if (found) return found;
      }
      return null;
    };

    // 1. Procesar Planes de Tratamiento / Presupuestos
    rawPlanes.forEach(p => {
      const pDate = p.created_at || p.createdAt || p.fecha || p.date;
      if (pDate) {
        const dt = new Date(pDate);
        if (initDate && dt < initDate) return;
        if (endDate && dt > endDate) return;
      }

      // Parsear detalles si viene como string JSON
      let d = p.detalles || {};
      if (typeof d === "string") {
        try { d = JSON.parse(d); } catch (e) { d = {}; }
      }

      const pacId = p.paciente_id || p.pacienteId || p.patientId || p.patient_id || d.paciente_id || d.pacienteId || d.patientId;
      const pac = pacMap[pacId] || (p.documento ? pacMap[p.documento] : {}) || {};

      // Filtro de sucursal
      if (!isTodasSucursales) {
        const pSuc = (p.sucursal || p.sede || p.oficina || d.sucursal || pac.sucursal || "").toLowerCase();
        if (pSuc && !pSuc.includes(sucursalTarget) && !sucursalTarget.includes(pSuc)) return;
      }

      const total = Number(p.total || p.montoTotal || p.valor || p.costoTotal || d.total || d.costoTotal || 0);
      const pagado = Number(p.pagado || p.montoPagado || p.abono || d.pagado || 0);
      const statusStr = String(p.status || p.estado || d.status || d.estado || "").toLowerCase();
      const isAceptado =
        statusStr.includes("acept") ||
        statusStr.includes("approv") ||
        statusStr.includes("aprob") ||
        statusStr.includes("inic") ||
        statusStr.includes("curs") ||
        statusStr.includes("comp") ||
        statusStr.includes("fin") ||
        pagado > 0;

      // Resolución de doctor con múltiples fuentes
      const itemsList = Array.isArray(d) ? d : (d.items && Array.isArray(d.items) ? d.items : []);
      const itemWithDoc = itemsList.find(it => it.profesionalId || it.profesional || it.doctor || it.odontologo);

      const rawProfId = p.profesionalId || p.profesional_id || p.odontologoId || p.doctorId || d.profesionalId || d.profesional_id || d.doctorId || (itemWithDoc && (itemWithDoc.profesionalId || itemWithDoc.profesional_id)) || pac.profesional_id || pac.doctorTratanteId || "";
      const rawProfName = p.profesionalAsignado || p.profesional || p.odontologo || p.doctor || d.profesional || d.profesionalAsignado || d.doctor || d.odontologo || (itemWithDoc && (itemWithDoc.profesional || itemWithDoc.doctor)) || pac.doctorTratante || pac.profesional || "";

      let matchedKey = matchDoctorKey(rawProfId, rawProfName);

      if (!matchedKey) {
        if (rawProfName && rawProfName !== "—" && rawProfName.trim().length > 2) {
          map[rawProfName] = {
            id: rawProfName,
            nombre: rawProfName,
            allNames: [rawProfName.toLowerCase()],
            presupuestosGenerados: 0,
            montoPresupuestado: 0,
            presupuestosAceptados: 0,
            montoAceptado: 0,
            recaudo: 0
          };
          matchedKey = rawProfName;
        } else {
          matchedKey = "__sin_doctor__";
        }
      }

      if (matchedKey && map[matchedKey]) {
        map[matchedKey].presupuestosGenerados += 1;
        map[matchedKey].montoPresupuestado += total;
        if (isAceptado) {
          map[matchedKey].presupuestosAceptados += 1;
          map[matchedKey].montoAceptado += total;
        }
      }
    });

    // 2. Procesar Recaudo Real desde Pagos
    rawPagos.forEach(pago => {
      const isAnulado = (pago.estado || "").toLowerCase() === "anulado" || (pago.referencia || "").includes("ANULADO");
      if (isAnulado) return;

      const pagoDate = pago.fecha || pago.created_at || pago.createdAt;
      if (pagoDate) {
        const dt = new Date(pagoDate);
        if (initDate && dt < initDate) return;
        if (endDate && dt > endDate) return;
      }

      // Parsear notas de pago
      let notasObj = {};
      if (pago.notas) {
        if (typeof pago.notas === "string" && pago.notas.trim().startsWith("{")) {
          try { notasObj = JSON.parse(pago.notas); } catch (e) {}
        } else if (typeof pago.notas === "object") {
          notasObj = pago.notas;
        }
      }

      const pacId = pago.paciente_id || pago.pacienteId || notasObj.pacienteId || notasObj.patientId;
      const pac = pacMap[pacId] || {};

      // Filtro de sucursal
      if (!isTodasSucursales) {
        const pagoSuc = (pago.sucursal || pago.sede || pago.oficina || notasObj.sucursal || pac.sucursal || "").toLowerCase();
        if (pagoSuc && !pagoSuc.includes(sucursalTarget) && !sucursalTarget.includes(pagoSuc)) return;
      }

      const monto = Number(pago.monto || pago.valor || 0);

      // Si el pago tiene plan asociado, buscar doctor del plan
      const targetPlanId = pago.plan_id || notasObj.planId;
      const targetPlan = targetPlanId ? rawPlanes.find(pl => pl.id === targetPlanId) : null;
      let planDocId = "";
      let planDocName = "";
      if (targetPlan) {
        let plD = targetPlan.detalles || {};
        if (typeof plD === "string") {
          try { plD = JSON.parse(plD); } catch (e) {}
        }
        planDocId = targetPlan.profesionalId || targetPlan.profesional_id || plD.profesionalId || "";
        planDocName = targetPlan.profesional || plD.profesional || "";
      }

      const rawProfId = pago.profesional_id || pago.profesionalId || pago.doctorId || notasObj.profesionalId || notasObj.profesional_id || planDocId || pac.profesional_id || pac.doctorTratanteId || "";
      const rawProfName = pago.profesional || pago.odontologo || pago.doctor || notasObj.profesional || notasObj.doctor || planDocName || pac.doctorTratante || pac.profesional || "";

      let matchedKey = matchDoctorKey(rawProfId, rawProfName);

      if (!matchedKey) {
        if (rawProfName && rawProfName !== "—" && rawProfName.trim().length > 2) {
          map[rawProfName] = {
            id: rawProfName,
            nombre: rawProfName,
            allNames: [rawProfName.toLowerCase()],
            presupuestosGenerados: 0,
            montoPresupuestado: 0,
            presupuestosAceptados: 0,
            montoAceptado: 0,
            recaudo: 0
          };
          matchedKey = rawProfName;
        } else {
          matchedKey = "__sin_doctor__";
        }
      }

      if (matchedKey && map[matchedKey]) {
        map[matchedKey].recaudo += monto;
      }
    });

    // 3. Formatear lista filtrando los que tengan actividad o sean doctores activos
    let list = Object.values(map).filter(d => 
      d.presupuestosGenerados > 0 || d.recaudo > 0 || (d.id !== "__sin_doctor__" && rawDoctores.some(rd => rd.id === d.id))
    );

    // Si no hay datos, mostrar doctores base con 0 para visualización
    if (list.length === 0) {
      list = rawDoctores.map(d => ({
        id: d.id,
        nombre: d.nombre,
        presupuestosGenerados: 0,
        montoPresupuestado: 0,
        presupuestosAceptados: 0,
        montoAceptado: 0,
        recaudo: 0,
        pctNum: 0,
        pctMonto: 0
      }));
    } else {
      list = list.map(d => {
        const pctNum = d.presupuestosGenerados > 0 ? (d.presupuestosAceptados / d.presupuestosGenerados) * 100 : 0;
        return {
          ...d,
          pctNum: Number(pctNum.toFixed(2)),
          pctMonto: d.montoPresupuestado > 0 ? Number(((d.montoAceptado / d.montoPresupuestado) * 100).toFixed(2)) : 0
        };
      });
    }

    // Ordenar de mayor a menor recaudo o efectividad
    list.sort((a, b) => b.recaudo - a.recaudo || b.pctNum - a.pctNum);

    // Calcular efectividad global promedio y totales
    const totalGen = list.reduce((acc, curr) => acc + curr.presupuestosGenerados, 0);
    const totalAcep = list.reduce((acc, curr) => acc + curr.presupuestosAceptados, 0);
    const totalPresupuestado = list.reduce((acc, curr) => acc + curr.montoPresupuestado, 0);
    const totalAceptado = list.reduce((acc, curr) => acc + curr.montoAceptado, 0);
    const totalRecaudo = list.reduce((acc, curr) => acc + curr.recaudo, 0);

    const globalEf = totalGen > 0 ? Math.round((totalAcep / totalGen) * 100) : 0;
    const maxR = Math.max(...list.map(d => d.recaudo), 1000000);

    return {
      dataEfectividad: list,
      generalIndicador: globalEf,
      maxRecaudoValue: maxR,
      totalsResumen: {
        totalGen,
        totalAcep,
        totalPresupuestado,
        totalAceptado,
        totalRecaudo,
        globalEf
      }
    };
  }, [rawDoctores, rawPlanes, rawPagos, rawPacientes, appliedFilters]);

  // Rotación de aguja para velocímetro semáforo (-90deg a +90deg)
  const needleRotation = -90 + (generalIndicador / 100) * 180;

  return (
    <div className="flex flex-col h-full bg-[#f4f6f9] overflow-y-auto custom-scrollbar font-sans text-slate-700 pb-16">
      
      {/* ─── BARRA SUPERIOR DE FILTROS (FECHAS + SUCURSAL + BUSCAR) ─── */}
      <div className="mx-6 mt-4 p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4 shrink-0">
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Fecha Inicial */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Fecha inicial:</label>
            <input
              type="date"
              value={fechaInicial}
              onChange={(e) => setFechaInicial(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
              max="9999-12-31"
              min="1900-01-01"
            />
          </div>

          {/* Fecha Final */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Fecha final:</label>
            <input
              type="date"
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
              max="9999-12-31"
              min="1900-01-01"
            />
          </div>

          {/* Sucursal */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Sucursal:</label>
            <select
              value={selectedSucursal}
              onChange={(e) => setSelectedSucursal(e.target.value)}
              className="h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase cursor-pointer"
            >
              {sucursalesList.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSearchClick}
          className="h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-2xs"
        >
          Buscar
        </button>
      </div>

      {/* ─── PANELES DE CONTROL (INDICADOR, EFECTIVIDAD, RECAUDO Y TABLA) ─── */}
      <div className="mx-6 mt-4 space-y-4 animate-fadeIn">
        
        {/* TARJETA 1: Indicador general (Velocímetro Semicircular) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs relative flex flex-col items-center justify-center min-h-[220px]">
          <div className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <FiMenu size={16} />
          </div>

          <h3 className="text-sm font-semibold text-slate-700 mb-1">Indicador general</h3>
          <p className="text-xs text-slate-400 font-medium mb-2">Efectividad global del equipo: <span className="font-bold text-slate-800">{generalIndicador}%</span></p>

          {/* Gráfico SVG Velocímetro Semicircular */}
          <div className="relative w-72 h-40 flex items-center justify-center">
            <svg className="w-72 h-72" viewBox="0 0 100 65">
              {/* Arco Rojo (0 - 40) */}
              <path
                d="M 12 52 A 38 38 0 0 1 35 18"
                fill="none"
                stroke="#d32f2f"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Arco Amarillo (40 - 70) */}
              <path
                d="M 35 18 A 38 38 0 0 1 65 18"
                fill="none"
                stroke="#fbc02d"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Arco Verde (70 - 100) */}
              <path
                d="M 65 18 A 38 38 0 0 1 88 52"
                fill="none"
                stroke="#388e3c"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Escala numérica de 10 en 10 */}
              <text x="12" y="58" fontSize="3" fill="#64748b" textAnchor="middle">0</text>
              <text x="17" y="44" fontSize="3" fill="#64748b" textAnchor="middle">10</text>
              <text x="26" y="32" fontSize="3" fill="#64748b" textAnchor="middle">20</text>
              <text x="36" y="24" fontSize="3" fill="#64748b" textAnchor="middle">30</text>
              <text x="44" y="19" fontSize="3" fill="#64748b" textAnchor="middle">40</text>
              <text x="50" y="14" fontSize="3" fill="#64748b" textAnchor="middle" fontWeight="bold">50</text>
              <text x="56" y="19" fontSize="3" fill="#64748b" textAnchor="middle">60</text>
              <text x="64" y="24" fontSize="3" fill="#64748b" textAnchor="middle">70</text>
              <text x="74" y="32" fontSize="3" fill="#64748b" textAnchor="middle">80</text>
              <text x="83" y="44" fontSize="3" fill="#64748b" textAnchor="middle">90</text>
              <text x="88" y="58" fontSize="3" fill="#64748b" textAnchor="middle">100</text>

              {/* Aguja y centro */}
              <g transform="translate(50, 52)">
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-30"
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  style={{
                    transform: `rotate(${needleRotation}deg)`,
                    transformOrigin: '0px 0px',
                    transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />
                <circle cx="0" cy="0" r="3" fill="#cbd5e1" />
                <circle cx="0" cy="0" r="1.2" fill="#64748b" />
              </g>
            </svg>
          </div>
        </div>

        {/* TARJETA 2: Efectividad por profesional (Gráfico de Columnas con escala real 0% - 100%) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs relative">
          <div className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <FiMenu size={16} />
          </div>

          <h3 className="text-sm font-semibold text-slate-700 text-center mb-1">Efectividad por profesional</h3>
          <p className="text-xs text-slate-400 text-center mb-4">Porcentaje de presupuestos aceptados sobre el total generados</p>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center justify-end gap-4 mb-4 text-[11px] text-slate-600 px-4">
            {dataEfectividad.map((d, i) => (
              <div key={d.id} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-2xs"
                  style={{ backgroundColor: PALETTE_COLORS[i % PALETTE_COLORS.length] }}
                />
                <span className="text-[11px] font-medium text-slate-700">{d.nombre}</span>
              </div>
            ))}
          </div>

          {/* Gráfico con cuadrícula horizontal del 0% al 100% */}
          <div className="relative w-full max-w-4xl mx-auto h-64 flex flex-col justify-between pt-4 pb-6 px-10 border-b border-slate-200">
            
            {/* Líneas de guía horizontales de 20% en 20% */}
            <div className="absolute inset-x-10 top-4 bottom-6 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-9 font-mono">100%</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-9 font-mono">80%</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-9 font-mono">60%</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-9 font-mono">40%</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-9 font-mono">20%</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-9 font-mono">0%</span>
              </div>
            </div>

            {/* Columnas */}
            <div className="relative z-10 flex items-end justify-center gap-8 h-full">
              {dataEfectividad.map((d, i) => {
                const heightPct = Math.min(Math.max(d.pctNum, d.pctNum > 0 ? 4 : 2), 100);
                const color = PALETTE_COLORS[i % PALETTE_COLORS.length];

                return (
                  <div key={d.id} className="flex flex-col items-center justify-end h-full flex-1 max-w-[200px]">
                    <span className="text-[11px] font-bold text-slate-700 mb-1">
                      {d.pctNum > 0 ? `${d.pctNum.toFixed(2)}%` : '0.00%'}
                    </span>
                    <div
                      className="w-full rounded-t-sm transition-all duration-1000 shadow-xs hover:brightness-95 cursor-pointer"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: color
                      }}
                      title={`${d.nombre}: ${d.presupuestosAceptados} de ${d.presupuestosGenerados} presupuestos (${d.pctNum.toFixed(2)}%)`}
                    />
                    <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate max-w-[120px] text-center" title={d.nombre}>
                      {d.nombre}
                    </span>
                  </div>
                );
              })}
            </div>

          </div>

        </div>

        {/* TARJETA 3: Recaudo por profesional (Gráfico con valores COP reales) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs relative">
          <div className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <FiMenu size={16} />
          </div>

          <h3 className="text-sm font-semibold text-slate-700 text-center mb-1">Recaudo por profesional</h3>
          <p className="text-xs text-slate-400 text-center mb-4">Total de pagos recaudados efectivamente en el período</p>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center justify-end gap-4 mb-4 text-[11px] text-slate-600 px-4">
            {dataEfectividad.map((d, i) => (
              <div key={d.id} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-2xs"
                  style={{ backgroundColor: PALETTE_COLORS[i % PALETTE_COLORS.length] }}
                />
                <span className="text-[11px] font-medium text-slate-700">{d.nombre}</span>
              </div>
            ))}
          </div>

          {/* Gráfico de barras de recaudo */}
          <div className="relative w-full max-w-4xl mx-auto h-64 flex flex-col justify-between pt-4 pb-6 px-12 border-b border-slate-200">
            
            {/* Líneas de guía con valores en COP */}
            <div className="absolute inset-x-12 top-4 bottom-6 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[9px] text-slate-400">
                <span className="-ml-11 font-mono">${Math.round(maxRecaudoValue / 1000).toLocaleString('es-CO')}k</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[9px] text-slate-400">
                <span className="-ml-11 font-mono">${Math.round((maxRecaudoValue * 0.75) / 1000).toLocaleString('es-CO')}k</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[9px] text-slate-400">
                <span className="-ml-11 font-mono">${Math.round((maxRecaudoValue * 0.5) / 1000).toLocaleString('es-CO')}k</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[9px] text-slate-400">
                <span className="-ml-11 font-mono">${Math.round((maxRecaudoValue * 0.25) / 1000).toLocaleString('es-CO')}k</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[9px] text-slate-400">
                <span className="-ml-11 font-mono">$0</span>
              </div>
            </div>

            {/* Columnas con etiquetas de valor en COP */}
            <div className="relative z-10 flex items-end justify-center gap-10 h-full">
              {dataEfectividad.map((d, i) => {
                const maxVal = maxRecaudoValue || 1000000;
                const heightPct = d.recaudo > 0 ? Math.min((d.recaudo / maxVal) * 100, 100) : 3;
                const color = PALETTE_COLORS[i % PALETTE_COLORS.length];

                return (
                  <div key={d.id} className="flex flex-col items-center justify-end h-full flex-1 max-w-[140px]">
                    {d.recaudo > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black text-white mb-1 shadow-xs" style={{ backgroundColor: color }}>
                        ${d.recaudo.toLocaleString('es-CO')}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 mb-1">$0</span>
                    )}
                    <div
                      className="w-full rounded-t-sm transition-all duration-1000 shadow-xs hover:brightness-95 cursor-pointer"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: color
                      }}
                      title={`${d.nombre}: Recaudo $${d.recaudo.toLocaleString('es-CO')}`}
                    />
                    <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate max-w-[120px] text-center" title={d.nombre}>
                      {d.nombre}
                    </span>
                  </div>
                );
              })}
            </div>

          </div>

        </div>

        {/* TARJETA 4: Tabla Resumen Consolidada de Efectividad y Ventas */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center justify-between">
            <span>Resumen consolidado por profesional</span>
            <span className="text-[11px] font-normal text-slate-400">
              {dataEfectividad.length} profesionales registrados
            </span>
          </h3>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Profesional</th>
                  <th className="py-3 px-4 text-center">Presupuestos Generados</th>
                  <th className="py-3 px-4 text-center">Presupuestos Aceptados</th>
                  <th className="py-3 px-4 text-center">% Efectividad</th>
                  <th className="py-3 px-4 text-right">Monto Presupuestado</th>
                  <th className="py-3 px-4 text-right">Monto Aceptado</th>
                  <th className="py-3 px-4 text-right">Recaudo Cobrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {dataEfectividad.map((d, idx) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PALETTE_COLORS[idx % PALETTE_COLORS.length] }}
                      />
                      {d.nombre}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium">{d.presupuestosGenerados}</td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-emerald-600">{d.presupuestosAceptados}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.pctNum >= 70 ? 'bg-emerald-50 text-emerald-700' :
                        d.pctNum >= 40 ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {d.pctNum.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">$ {d.montoPresupuestado.toLocaleString('es-CO')}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">$ {d.montoAceptado.toLocaleString('es-CO')}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sky-700">$ {d.recaudo.toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-800 text-xs">
                <tr>
                  <td className="py-3 px-4">TOTAL GENERAL</td>
                  <td className="py-3 px-4 text-center font-mono">{totalsResumen.totalGen}</td>
                  <td className="py-3 px-4 text-center font-mono text-emerald-700">{totalsResumen.totalAcep}</td>
                  <td className="py-3 px-4 text-center font-mono text-emerald-700">{totalsResumen.globalEf}%</td>
                  <td className="py-3 px-4 text-right font-mono">$ {totalsResumen.totalPresupuestado.toLocaleString('es-CO')}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">$ {totalsResumen.totalAceptado.toLocaleString('es-CO')}</td>
                  <td className="py-3 px-4 text-right font-mono text-sky-700">$ {totalsResumen.totalRecaudo.toLocaleString('es-CO')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}

