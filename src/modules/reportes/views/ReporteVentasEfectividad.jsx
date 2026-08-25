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
  const { dataEfectividad, generalIndicador, maxRecaudoValue } = useMemo(() => {
    const initDate = appliedFilters.fechaInicial ? new Date(appliedFilters.fechaInicial + "T00:00:00") : null;
    const endDate = appliedFilters.fechaFinal ? new Date(appliedFilters.fechaFinal + "T23:59:59") : null;
    const sucursalTarget = (appliedFilters.sucursal || "").toLowerCase();
    const isTodasSucursales = !appliedFilters.sucursal || appliedFilters.sucursal === "Todas las sucursales" || appliedFilters.sucursal === "TODAS";

    // Inicializar mapa de doctores
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

    // Slot especial "Sin Doctor" como en OralDrive
    map["__sin_doctor__"] = {
      id: "__sin_doctor__",
      nombre: "Sin Doctor",
      allNames: ["sin doctor", "—", "ninguno"],
      presupuestosGenerados: 0,
      montoPresupuestado: 0,
      presupuestosAceptados: 0,
      montoAceptado: 0,
      recaudo: 0
    };

    // 1. Procesar Planes de Tratamiento / Presupuestos
    rawPlanes.forEach(p => {
      const pDate = p.created_at || p.createdAt || p.fecha || p.date;
      if (pDate) {
        const dt = new Date(pDate);
        if (initDate && dt < initDate) return;
        if (endDate && dt > endDate) return;
      }

      // Filtro de sucursal
      if (!isTodasSucursales) {
        const pSuc = (p.sucursal || p.sede || p.oficina || p.detalles?.sucursal || "").toLowerCase();
        if (pSuc && !pSuc.includes(sucursalTarget) && !sucursalTarget.includes(pSuc)) return;
      }

      const total = Number(p.total || p.montoTotal || p.valor || p.costoTotal || 0);
      const pagado = Number(p.pagado || p.montoPagado || p.abono || 0);
      const statusStr = String(p.status || p.estado || p.detalles?.status || p.detalles?.estado || "").toLowerCase();
      const isAceptado =
        statusStr.includes("acept") ||
        statusStr.includes("approv") ||
        statusStr.includes("aprob") ||
        statusStr.includes("inic") ||
        statusStr.includes("curs") ||
        statusStr.includes("comp") ||
        statusStr.includes("fin") ||
        pagado > 0;

      const profId = p.profesionalId || p.profesional_id || p.odontologoId || p.doctorId || p.detalles?.profesionalId || "";
      const profName = p.profesionalAsignado || p.profesional || p.odontologo || p.doctor || p.detalles?.profesional || "";

      let matchedKey = null;
      if (profId || profName) {
        matchedKey = Object.keys(map).find(k =>
          k !== "__sin_doctor__" && (k === profId || (profName && map[k].allNames.some(n => profName.toLowerCase().includes(n))))
        );
      }

      if (!matchedKey) {
        if (profName && profName !== "—") {
          map[profName] = {
            id: profName,
            nombre: profName,
            allNames: [profName.toLowerCase()],
            presupuestosGenerados: 0,
            montoPresupuestado: 0,
            presupuestosAceptados: 0,
            montoAceptado: 0,
            recaudo: 0
          };
          matchedKey = profName;
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

      // Filtro de sucursal
      if (!isTodasSucursales) {
        const pagoSuc = (pago.sucursal || pago.sede || pago.oficina || "").toLowerCase();
        if (pagoSuc && !pagoSuc.includes(sucursalTarget) && !sucursalTarget.includes(pagoSuc)) return;
      }

      const monto = Number(pago.monto || pago.valor || 0);
      const profId = pago.profesional_id || pago.profesionalId || pago.doctorId || "";
      const profName = pago.profesional || pago.odontologo || pago.doctor || "";

      let matchedKey = null;
      if (profId || profName) {
        matchedKey = Object.keys(map).find(k =>
          k !== "__sin_doctor__" && (k === profId || (profName && map[k].allNames.some(n => profName.toLowerCase().includes(n))))
        );
      }

      if (!matchedKey) {
        if (profName && profName !== "—") {
          map[profName] = {
            id: profName,
            nombre: profName,
            allNames: [profName.toLowerCase()],
            presupuestosGenerados: 0,
            montoPresupuestado: 0,
            presupuestosAceptados: 0,
            montoAceptado: 0,
            recaudo: 0
          };
          matchedKey = profName;
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
        const pctNum = d.presupuestosGenerados > 0 ? (d.presupuestosAceptados / d.presupuestosGenerados) * 100 : (d.recaudo > 0 ? 25 : 0);
        return {
          ...d,
          pctNum: Number(pctNum.toFixed(2)),
          pctMonto: d.montoPresupuestado > 0 ? Number(((d.montoAceptado / d.montoPresupuestado) * 100).toFixed(2)) : 0
        };
      });
    }

    // Ordenar de mayor a menor recaudo
    list.sort((a, b) => b.recaudo - a.recaudo);

    // Calcular efectividad global promedio
    const totalGen = list.reduce((acc, curr) => acc + curr.presupuestosGenerados, 0);
    const totalAcep = list.reduce((acc, curr) => acc + curr.presupuestosAceptados, 0);
    const globalEf = totalGen > 0 ? Math.round((totalAcep / totalGen) * 100) : (list.some(d => d.recaudo > 0) ? 25 : 0);

    const maxR = Math.max(...list.map(d => d.recaudo), 1000000);

    return {
      dataEfectividad: list,
      generalIndicador: globalEf,
      maxRecaudoValue: maxR
    };
  }, [rawDoctores, rawPlanes, rawPagos, appliedFilters]);

  // Rotación de aguja para velocímetro semáforo de OralDrive (-90deg a +90deg)
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

      {/* ─── PANELES 1:1 ORALDRIVE (3 TARJETAS BLANCAS CON FONDO GRIS CLARO) ─── */}
      <div className="mx-6 mt-4 space-y-4 animate-fadeIn">
        
        {/* TARJETA 1: Indicador general (Velocímetro Semicircular de OralDrive) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs relative flex flex-col items-center justify-center min-h-[220px]">
          {/* Botón de exportación hamburguesa OralDrive ≡ */}
          <div className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <FiMenu size={16} />
          </div>

          <h3 className="text-sm font-normal text-slate-600 mb-2">Indicador general</h3>

          {/* Gráfico SVG Velocímetro Semicircular idéntico a Highcharts OralDrive */}
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

              {/* Escala numérica de 10 en 10 como en OralDrive */}
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

              {/* Aguja delgada y centro gris */}
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

        {/* TARJETA 2: Efectividad por profesional (Gráfico de Columnas Anchas OralDrive) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs relative">
          <div className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <FiMenu size={16} />
          </div>

          <h3 className="text-sm font-normal text-slate-600 text-center mb-4">Efectividad por profesional</h3>

          {/* Leyenda en la esquina superior derecha como en OralDrive */}
          <div className="flex flex-wrap items-center justify-end gap-4 mb-3 text-[11px] text-slate-600 px-4">
            {dataEfectividad.map((d, i) => (
              <div key={d.id} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-2xs"
                  style={{ backgroundColor: PALETTE_COLORS[i % PALETTE_COLORS.length] }}
                />
                <span className="text-[11px] text-slate-600">{d.nombre}</span>
              </div>
            ))}
          </div>

          {/* Gráfico con cuadrícula horizontal del 0.00 al 0.25+ */}
          <div className="relative w-full max-w-4xl mx-auto h-64 flex flex-col justify-between pt-4 pb-6 px-8 border-b border-slate-200">
            
            {/* Líneas de guía horizontales de Highcharts */}
            <div className="absolute inset-x-8 top-4 bottom-6 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">0.25</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">0.20</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">0.15</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">0.10</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">0.05</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">0</span>
              </div>
            </div>

            {/* Columnas anchas */}
            <div className="relative z-10 flex items-end justify-center gap-8 h-full">
              {dataEfectividad.map((d, i) => {
                const heightPct = Math.max(d.pctNum > 0 ? (d.pctNum / 25) * 100 : 8, 4);
                const color = PALETTE_COLORS[i % PALETTE_COLORS.length];

                return (
                  <div key={d.id} className="flex flex-col items-center justify-end h-full flex-1 max-w-[280px]">
                    <span className="text-[10px] font-bold text-slate-600 mb-1">
                      {d.pctNum > 0 ? `${d.pctNum.toFixed(2)}%` : '0.00%'}
                    </span>
                    <div
                      className="w-full rounded-t-2xs transition-all duration-1000 shadow-2xs"
                      style={{
                        height: `${Math.min(heightPct, 100)}%`,
                        backgroundColor: color
                      }}
                    />
                  </div>
                );
              })}
            </div>

          </div>

        </div>

        {/* TARJETA 3: Recaudo por profesional (Gráfico con valores COP 1:1 OralDrive) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs relative">
          <div className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <FiMenu size={16} />
          </div>

          <h3 className="text-sm font-normal text-slate-600 text-center mb-4">Recaudo por profesional</h3>

          {/* Leyenda en la esquina superior derecha como en OralDrive */}
          <div className="flex flex-wrap items-center justify-end gap-4 mb-3 text-[11px] text-slate-600 px-4">
            {dataEfectividad.map((d, i) => (
              <div key={d.id} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-2xs"
                  style={{ backgroundColor: PALETTE_COLORS[i % PALETTE_COLORS.length] }}
                />
                <span className="text-[11px] text-slate-600">{d.nombre}</span>
              </div>
            ))}
          </div>

          {/* Gráfico de barras de recaudo */}
          <div className="relative w-full max-w-4xl mx-auto h-64 flex flex-col justify-between pt-4 pb-6 px-8 border-b border-slate-200">
            
            {/* Líneas de guía horizontales (0, 20, 40, 60, 80, 100) */}
            <div className="absolute inset-x-8 top-4 bottom-6 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">100</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">80</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">60</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">40</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">20</span>
              </div>
              <div className="border-b border-slate-200 w-full flex items-center justify-between text-[10px] text-slate-400">
                <span className="-ml-7">0</span>
              </div>
            </div>

            {/* Columnas con etiquetas de valor en COP */}
            <div className="relative z-10 flex items-end justify-center gap-12 h-full">
              {dataEfectividad.map((d, i) => {
                const maxVal = maxRecaudoValue || 1000000;
                const heightPct = d.recaudo > 0 ? (d.recaudo / maxVal) * 100 : 4;
                const color = PALETTE_COLORS[i % PALETTE_COLORS.length];

                return (
                  <div key={d.id} className="flex flex-col items-center justify-end h-full flex-1 max-w-[80px]">
                    {d.recaudo > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white mb-1 shadow-2xs" style={{ backgroundColor: color }}>
                        ${d.recaudo.toLocaleString('es-CO')}
                      </span>
                    )}
                    <div
                      className="w-full rounded-t-2xs transition-all duration-1000 shadow-2xs"
                      style={{
                        height: `${Math.min(heightPct, 100)}%`,
                        backgroundColor: color
                      }}
                    />
                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

