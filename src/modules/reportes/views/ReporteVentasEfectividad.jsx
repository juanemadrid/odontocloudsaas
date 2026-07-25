import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiPieChart, FiBarChart2, FiDollarSign, FiSearch, FiFileText, FiFilter } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteVentasEfectividad() {
  const { userProfile } = useAuth();
  const [dataEfectividad, setDataEfectividad] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2025-07-01");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedSucursal, setSelectedSucursal] = useState("");

  // Métricas para gráficos
  const [generalIndicador, setGeneralIndicador] = useState(50); // Indicador velocímetro / semáforo (0 - 100%)
  const [efectividadPorDoctor, setEfectividadPorDoctor] = useState([]);
  const [recaudoPorDoctor, setRecaudoPorDoctor] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        // Cargar Sucursales
        const qSucursales = query(
          collection(db, "sucursales"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapSuc = await getDocs(qSucursales);
        const listSuc = [];
        snapSuc.forEach(doc => {
          listSuc.push({ id: doc.id, nombre: doc.data().nombre || doc.id });
        });
        setSucursalesList(listSuc);

        // Cargar Doctores
        const qUsuarios = query(
          collection(db, "usuarios"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapUsuarios = await getDocs(qUsuarios);
        const doctoresMap = {};

        snapUsuarios.forEach(doc => {
          const u = doc.data();
          const role = (u.rol || u.role || "").toLowerCase();
          if (role === "odontologo" || role === "doctor" || role === "odontóloga" || role === "doctores" || u.esOdontologo === true) {
            const primerNombre = u.nombre || u.nombres || u.displayName || "";
            const primerApellido = u.apellido || u.apellidos || "";
            const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;
            doctoresMap[doc.id] = {
              id: doc.id,
              nombre: nombreCompleto,
              presupuestosGenerados: 0,
              montoPresupuestado: 0,
              presupuestosAceptados: 0,
              montoAceptado: 0,
              recaudo: 0
            };
          }
        });

        // Cargar Planes/Presupuestos
        const qPlanes = query(
          collection(db, "planes"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapPlanes = await getDocs(qPlanes);

        snapPlanes.forEach(doc => {
          const p = doc.data();
          const profId = p.profesionalId || p.odontologoId || p.doctorId || p.profesional;
          const profName = p.profesionalAsignado || p.profesional || p.odontologo || p.doctor;
          const total = Number(p.total || p.montoTotal || 0);
          const pagado = Number(p.pagado || p.montoPagado || 0);
          const isAceptado = p.status === "Aceptado" || p.status === "Iniciado" || p.status === "Finalizado" || pagado > 0;

          let docKey = Object.keys(doctoresMap).find(k => k === profId || doctoresMap[k].nombre.toLowerCase().includes(String(profName || "").toLowerCase()));
          
          if (!docKey && profName) {
            docKey = profName;
            if (!doctoresMap[docKey]) {
              doctoresMap[docKey] = {
                id: profName,
                nombre: profName,
                presupuestosGenerados: 0,
                montoPresupuestado: 0,
                presupuestosAceptados: 0,
                montoAceptado: 0,
                recaudo: 0
              };
            }
          }

          if (docKey && doctoresMap[docKey]) {
            doctoresMap[docKey].presupuestosGenerados += 1;
            doctoresMap[docKey].montoPresupuestado += total;
            doctoresMap[docKey].recaudo += pagado;
            if (isAceptado) {
              doctoresMap[docKey].presupuestosAceptados += 1;
              doctoresMap[docKey].montoAceptado += total;
            }
          }
        });

        const listEfectividad = Object.values(doctoresMap).map(d => {
          const pctNum = d.presupuestosGenerados > 0 ? (d.presupuestosAceptados / d.presupuestosGenerados) * 100 : 0;
          const pctMonto = d.montoPresupuestado > 0 ? (d.montoAceptado / d.montoPresupuestado) * 100 : 0;
          return {
            ...d,
            pctNum: Number(pctNum.toFixed(1)),
            pctMonto: Number(pctMonto.toFixed(1))
          };
        });

        setDataEfectividad(listEfectividad);

        // Calcular promedio global de efectividad
        const totalGen = listEfectividad.reduce((acc, curr) => acc + curr.presupuestosGenerados, 0);
        const totalAcep = listEfectividad.reduce((acc, curr) => acc + curr.presupuestosAceptados, 0);
        const avgEf = totalGen > 0 ? Math.round((totalAcep / totalGen) * 100) : 50;
        setGeneralIndicador(avgEf);

      } catch (error) {
        console.error("Error cargando reporte de ventas y efectividad:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const handleSearchClick = () => {
    setHasSearched(true);
  };

  // Calcular la rotación de aguja para el reloj / velocímetro (-90deg a +90deg)
  const needleRotation = -90 + (generalIndicador / 100) * 180;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto custom-scrollbar font-sans text-slate-700 pb-12">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte de efectividad</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte de efectividad</span>
          </div>
        </div>
      </div>

      {/* ─── ÁREA DE FILTROS (DISEÑO EXACTO ORALDRIVE) ─── */}
      <div className="mx-5 mt-3 p-5 bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
        
        {/* Fila 1: Fecha inicial / Fecha final */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Fecha inicial</label>
            <input
              type="date"
              value={fechaInicial}
              onChange={(e) => setFechaInicial(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Fecha final</label>
            <input
              type="date"
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        {/* Fila 2: Sucursal + Botón Buscar */}
        <div className="flex flex-wrap md:flex-nowrap items-end justify-between gap-6">
          <div className="w-full md:w-1/2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Sucursal</label>
            <select
              value={selectedSucursal}
              onChange={(e) => setSelectedSucursal(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="">Seleccione...</option>
              {sucursalesList.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
              {sucursalesList.length === 0 && (
                <option value="ATM CENTRO DEL DOLOR OROFACIAL">ATM CENTRO DEL DOLOR OROFACIAL</option>
              )}
            </select>
          </div>

          <div>
            <button
              onClick={handleSearchClick}
              className="h-9 px-8 bg-[#7cb342] hover:bg-[#689f38] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <span>Buscar</span>
            </button>
          </div>
        </div>

      </div>

      {/* ─── PANELES DE GRÁFICOS E INDICADORES VISUALES (ORALDRIVE) ─── */}
      {hasSearched && (
        <div className="mx-5 mt-5 space-y-5 animate-fadeIn">
          
          {/* PANEL 1: Indicador General (Reloj Velocímetro / Gauge) */}
          <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm flex flex-col items-center justify-center relative">
            <div className="absolute right-4 top-4 text-slate-400 cursor-pointer hover:text-slate-600">
              <span className="text-xs font-bold">≡</span>
            </div>

            <h3 className="text-sm font-bold text-slate-600 mb-4">Indicador general</h3>

            {/* Gauge SVG Velocímetro Semicircular */}
            <div className="relative w-56 h-32 flex items-center justify-center">
              <svg className="w-56 h-56" viewBox="0 0 100 60">
                {/* Arco Rojo (0 - 40%) */}
                <path
                  d="M 10 50 A 40 40 0 0 1 35 15"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Arco Amarillo (40 - 70%) */}
                <path
                  d="M 35 15 A 40 40 0 0 1 65 15"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Arco Verde (70 - 100%) */}
                <path
                  d="M 65 15 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* Marcas numéricas de escala */}
                <text x="8" y="58" fontSize="4" fill="#94a3b8" textAnchor="middle">0</text>
                <text x="25" y="24" fontSize="4" fill="#94a3b8" textAnchor="middle">20</text>
                <text x="50" y="8" fontSize="4" fill="#94a3b8" textAnchor="middle">50</text>
                <text x="75" y="24" fontSize="4" fill="#94a3b8" textAnchor="middle">80</text>
                <text x="92" y="58" fontSize="4" fill="#94a3b8" textAnchor="middle">100</text>

                {/* Aguja indicadora con centro */}
                <g transform="translate(50, 50)">
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="-32"
                    stroke="#64748b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{
                      transform: `rotate(${needleRotation}deg)`,
                      transformOrigin: '0px 0px',
                      transition: 'transform 1.2s ease-out'
                    }}
                  />
                  <circle cx="0" cy="0" r="4" fill="#475569" />
                  <circle cx="0" cy="0" r="2" fill="#ffffff" />
                </g>
              </svg>
            </div>
            
            <span className="text-xs font-black text-slate-700 mt-2">{generalIndicador}% efectividad global</span>
          </div>

          {/* PANEL 2: Efectividad por profesional (Gráfico de Barras Horizontal / Vertical) */}
          <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm relative">
            <div className="absolute right-4 top-4 text-slate-400 cursor-pointer hover:text-slate-600">
              <span className="text-xs font-bold">≡</span>
            </div>

            <h3 className="text-sm font-bold text-slate-600 text-center mb-6">Efectividad por profesional</h3>

            <div className="space-y-4 max-w-2xl mx-auto py-4">
              {dataEfectividad.map((d) => (
                <div key={d.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 uppercase">{d.nombre}</span>
                    <span className="font-black text-amber-600">{d.pctNum}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-8 overflow-hidden p-1 flex items-center relative">
                    <div
                      className="bg-[#c5c87c] h-full rounded-md transition-all duration-1000 flex items-center justify-center text-[10px] font-black text-slate-800"
                      style={{ width: `${Math.max(d.pctNum, 10)}%` }}
                    >
                      <span className="px-2 truncate">{d.nombre}</span>
                    </div>
                  </div>
                </div>
              ))}
              {dataEfectividad.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  No hay datos registrados de efectividad por profesional.
                </div>
              )}
            </div>

            {/* Leyenda de doctores */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-500">
              {dataEfectividad.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#c5c87c]" />
                  <span className="uppercase">{d.nombre}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PANEL 3: Recaudo por profesional (Gráfico de Barras de Recaudo COP) */}
          <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm relative">
            <div className="absolute right-4 top-4 text-slate-400 cursor-pointer hover:text-slate-600">
              <span className="text-xs font-bold">≡</span>
            </div>

            <h3 className="text-sm font-bold text-slate-600 text-center mb-6">Recaudo por profesional</h3>

            <div className="flex items-end justify-center gap-8 h-48 pt-6 pb-2 px-4 max-w-2xl mx-auto border-b border-slate-200">
              {dataEfectividad.map((d, i) => {
                const maxRecaudo = Math.max(...dataEfectividad.map(x => x.recaudo), 1);
                const barHeight = Math.max(15, (d.recaudo / maxRecaudo) * 100);
                const colors = ["bg-[#c5c87c]", "bg-[#94a3b8]", "bg-[#ef4444]", "bg-[#3b82f6]"];

                return (
                  <div key={d.id} className="flex flex-col items-center flex-1 max-w-[100px] h-full justify-end group">
                    <span className="text-[9px] font-bold text-slate-600 mb-1 opacity-90 group-hover:opacity-100">
                      $ {d.recaudo.toLocaleString('es-CO')}
                    </span>
                    <div
                      className={`w-full ${colors[i % colors.length]} rounded-t-md transition-all duration-1000 shadow-sm`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Leyenda de doctores */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-[10px] font-bold text-slate-500">
              {dataEfectividad.map((d, i) => {
                const colors = ["bg-[#c5c87c]", "bg-[#94a3b8]", "bg-[#ef4444]", "bg-[#3b82f6]"];
                return (
                  <div key={d.id} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-sm ${colors[i % colors.length]}`} />
                    <span className="uppercase">{d.nombre}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
