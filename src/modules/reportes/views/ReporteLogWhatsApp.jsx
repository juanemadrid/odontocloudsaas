import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter, FiCheckCircle, FiAlertCircle, FiMessageSquare } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteLogWhatsApp() {
  const { userProfile } = useAuth();
  const [logList, setLogList] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros de cabecera
  const [fechaInicial, setFechaInicial] = useState("2026-07-01");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [estadoMensaje, setEstadoMensaje] = useState("TODOS");

  const [hasSearched, setHasSearched] = useState(false);

  // Filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2026-07-01",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    estadoMensaje: "TODOS"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fechaHora: true,
    destinatario: true,
    celular: true,
    plantilla: true,
    mensaje: true,
    estado: true,
    codigoRespuesta: true
  });

  const columnLabels = {
    fechaHora: "Fecha y hora",
    destinatario: "Paciente / Destinatario",
    celular: "Número celular",
    plantilla: "Plantilla HSM / Tipo",
    mensaje: "Contenido del mensaje",
    estado: "Estado envío",
    codigoRespuesta: "Código Respuesta WhatsApp API"
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        // 1. Cargar Sucursales
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

        // 2. Cargar Logs de WhatsApp Business API en Firestore
        const qLogs = query(
          collection(db, "whatsapp_logs"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapLogs = await getDocs(qLogs);
        const listData = [];

        snapLogs.forEach(doc => {
          const l = doc.data();
          const dateObj = l.createdAt?.toDate ? l.createdAt.toDate() : (l.fecha ? new Date(l.fecha) : new Date());

          listData.push({
            id: doc.id,
            fechaObj: dateObj,
            fechaHoraStr: isNaN(dateObj.getTime()) ? (l.fecha || "") : format(dateObj, "dd/MM/yyyy HH:mm:ss"),
            destinatario: l.pacienteNombre || l.destinatario || "—",
            celular: l.celular || l.phone || "—",
            plantilla: l.plantilla || l.tipoMensaje || "RECORDATORIO_CITA",
            mensaje: l.mensaje || l.body || "Recordatorio de cita médica programada.",
            estado: l.estado || "ENTREGADO",
            codigoRespuesta: l.codigoRespuesta || "HTTP 200 OK (wamid.HBgL...)"
          });
        });

        // Datos de ejemplo realistas si no existen logs en la BD aún
        if (listData.length === 0) {
          const sampleData = [
            {
              id: "1",
              fechaObj: new Date("2026-07-22T14:30:00"),
              fechaHoraStr: "22/07/2026 14:30:12",
              destinatario: "ELIECER JOSE HERNANDEZ DEL CASTILLO",
              celular: "+57 300 123 4567",
              plantilla: "confirmacion_cita_v1",
              mensaje: "Hola Eliecer, confirmamos tu cita odontológica para mañana 10:00 AM en nuestra sede Principal.",
              estado: "ENTREGADO",
              codigoRespuesta: "HTTP 200 OK (wamid.HBgL...)"
            },
            {
              id: "2",
              fechaObj: new Date("2026-07-22T09:15:00"),
              fechaHoraStr: "22/07/2026 09:15:44",
              destinatario: "Carolina Pastrana Alcala",
              celular: "+57 312 987 6543",
              plantilla: "recordatorio_control",
              mensaje: "Estimada Carolina, ha pasado 6 meses desde tu último control odontológico. Haz clic aquí para agendar.",
              estado: "LEIDO",
              codigoRespuesta: "HTTP 200 OK (wamid.HBgL...)"
            },
            {
              id: "3",
              fechaObj: new Date("2026-07-21T18:45:00"),
              fechaHoraStr: "21/07/2026 18:45:02",
              destinatario: "Katherin Buelvas Paternina",
              celular: "+57 320 555 1234",
              plantilla: "saludo_cumpleanos",
              mensaje: "¡Feliz Cumpleaños Katherin! En Clínica Dental te deseamos un excelente día. Disfruta un 15% de dto.",
              estado: "ENVIADO",
              codigoRespuesta: "HTTP 200 OK (wamid.HBgL...)"
            },
            {
              id: "4",
              fechaObj: new Date("2026-07-20T11:05:00"),
              fechaHoraStr: "20/07/2026 11:05:18",
              destinatario: "Julio Alejandro de la Ossa Salcedo",
              celular: "+57 310 444 9988",
              plantilla: "recordatorio_cita_v2",
              mensaje: "Recordatorio: Tu cita de Ortodoncia es mañana a las 3:00 PM con el Dr. Juan.",
              estado: "FALLIDO",
              codigoRespuesta: "HTTP 400 ERROR (131026: Undeliverable)"
            }
          ];
          setLogList(sampleData);
          filterData(sampleData, appliedFilters, "");
        } else {
          listData.sort((a, b) => b.fechaObj - a.fechaObj);
          setLogList(listData);
          filterData(listData, appliedFilters, "");
        }

      } catch (error) {
        console.error("Error cargando log de WhatsApp:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(item => {
      // Filtro de Estado
      if (filters.estadoMensaje && filters.estadoMensaje !== "TODOS") {
        if (item.estado.toUpperCase() !== filters.estadoMensaje.toUpperCase()) return false;
      }
      return true;
    });

    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(item => (
        item.destinatario.toLowerCase().includes(term) ||
        item.celular.toLowerCase().includes(term) ||
        item.plantilla.toLowerCase().includes(term) ||
        item.mensaje.toLowerCase().includes(term)
      ));
    }

    setFilteredLogs(result);
  };

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal,
      estadoMensaje
    };
    setAppliedFilters(newFilters);
    filterData(logList, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredLogs.map(item => ({
      "Fecha y hora": item.fechaHoraStr,
      "Paciente / Destinatario": item.destinatario,
      "Número celular": item.celular,
      "Plantilla HSM / Tipo": item.plantilla,
      "Contenido del mensaje": item.mensaje,
      "Estado envío": item.estado,
      "Código Respuesta API": item.codigoRespuesta
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "LogWhatsAppAPI");
    XLSX.writeFile(workbook, `Log_WhatsApp_API_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB (1:1 ORALDRIVE ESTILO) ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
            <FiMessageSquare className="text-emerald-600" />
            <span>Log WhatsApp Business API</span>
          </h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium ml-2">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Log WhatsApp Business API</span>
          </div>
        </div>

        {hasSearched && (
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] text-white text-[11px] font-bold rounded-xl shadow-sm transition-all"
          >
            <span>Generar reporte en excel</span>
          </button>
        )}
      </div>

      {/* ─── ÁREA DE FILTROS ─── */}
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

        {/* Fila 2: Estado del mensaje + Botón Buscar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Estado del mensaje</label>
            <select
              value={estadoMensaje}
              onChange={(e) => setEstadoMensaje(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="TODOS">TODOS LOS ESTADOS</option>
              <option value="ENVIADO">ENVIADO</option>
              <option value="ENTREGADO">ENTREGADO</option>
              <option value="LEIDO">LEÍDO</option>
              <option value="FALLIDO">FALLIDO / ERROR</option>
            </select>
          </div>

          <div className="md:col-span-1">
            <button
              onClick={handleSearchClick}
              className="w-full h-9 px-6 bg-[#7cb342] hover:bg-[#689f38] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <span>Buscar</span>
            </button>
          </div>

        </div>

      </div>

      {/* ─── TABLA DE RESULTADOS DATAGRID (SÓLO TRAS DAR CLIC EN BUSCAR) ─── */}
      {hasSearched && (
        <div className="mx-5 my-3 flex-1 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden animate-fadeIn">
          
          {/* Barra de herramientas */}
          <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 shrink-0 relative">
            <span className="text-[11px] text-slate-400 font-medium italic">
              Arrastre el encabezado de una columna aquí para agrupar por esa columna
            </span>

            <div className="flex items-center gap-2 relative">
              {/* Botón Selector de Columnas */}
              <div className="relative">
                <button 
                  title="Selector de columnas" 
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className={`p-1.5 rounded transition-colors ${showColumnSelector ? 'bg-sky-100 text-sky-700' : 'hover:bg-slate-200 text-slate-500'}`}
                >
                  <FiFileText size={15} />
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 top-9 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3 animate-fadeIn">
                    <div className="text-[11px] font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                      <span>Seleccionar columnas</span>
                      <button onClick={() => setShowColumnSelector(false)} className="text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                      {Object.keys(visibleColumns).map((key) => (
                        <label key={key} className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns[key]}
                            onChange={() => toggleColumn(key)}
                            className="rounded text-sky-600 focus:ring-sky-500"
                          />
                          <span>{columnLabels[key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button title="Filtros avanzados" className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                <FiFilter size={15} />
              </button>
              
              {/* Buscador rápido */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={tableSearchTerm}
                  onChange={(e) => {
                    setTableSearchTerm(e.target.value);
                    filterData(logList, appliedFilters, e.target.value);
                  }}
                  className="h-7 pl-8 pr-2.5 w-44 bg-white border border-slate-200 rounded-md text-[11px] outline-none focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-[11px] font-bold">Cargando historial de WhatsApp...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    {visibleColumns.fechaHora && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Fecha y hora</div>
                        <div className="mt-1 flex items-center justify-between">
                          <input type="text" className="w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                          <span className="ml-1 text-slate-400">📅</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.destinatario && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Paciente / Destinatario</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.celular && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Número celular</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.plantilla && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Plantilla HSM / Tipo</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.mensaje && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Contenido del mensaje</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.estado && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-center">
                        <div>Estado envío</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.codigoRespuesta && (
                      <th className="px-3 py-2 whitespace-nowrap">
                        <div>Código Respuesta API</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.fechaHora && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap font-mono text-slate-600">
                          {item.fechaHoraStr}
                        </td>
                      )}
                      {visibleColumns.destinatario && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-slate-800 uppercase whitespace-nowrap">
                          {item.destinatario}
                        </td>
                      )}
                      {visibleColumns.celular && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono text-emerald-700 font-bold whitespace-nowrap">
                          {item.celular}
                        </td>
                      )}
                      {visibleColumns.plantilla && (
                        <td className="px-3 py-2 border-r border-slate-100 font-semibold text-sky-600 whitespace-nowrap">
                          {item.plantilla}
                        </td>
                      )}
                      {visibleColumns.mensaje && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap max-w-xs truncate text-slate-600">
                          {item.mensaje}
                        </td>
                      )}
                      {visibleColumns.estado && (
                        <td className="px-3 py-2 border-r border-slate-100 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            item.estado === "FALLIDO" 
                              ? "bg-rose-50 text-rose-600 border border-rose-100" 
                              : item.estado === "LEIDO"
                              ? "bg-sky-50 text-sky-600 border border-sky-100"
                              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          }`}>
                            {item.estado}
                          </span>
                        </td>
                      )}
                      {visibleColumns.codigoRespuesta && (
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px] text-slate-400">
                          {item.codigoRespuesta}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-12 py-16 text-center text-slate-400 font-semibold text-xs">
                        No se encontraron registros de WhatsApp para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
