import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, orderBy, query, where, limit } from "firebase/firestore";
import { FiCpu, FiDownload, FiSearch, FiShield, FiUserCheck, FiClock, FiGrid, FiFileText } from "react-icons/fi";

const StatBox = ({ title, value, icon: Icon, color, bg }) => (
  <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center text-2xl ${bg} ${color}`}>
      <Icon />
    </div>
    <div className="min-w-0">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 truncate">{title}</h4>
      <div className={`text-2xl font-black ${color} leading-none truncate`}>{value}</div>
    </div>
  </div>
);

// Helpers for translations and visual styling of audit logs
const translateAction = (action) => {
  const mapping = {
    "CREATE_PATIENT": "Creación de Paciente",
    "UPDATE_PATIENT": "Edición de Paciente",
    "DELETE_PATIENT": "Eliminación de Paciente",
    "CREATE_EVOLUTION": "Nueva Evolución Clínica",
    "ADD_EVOLUTION_CLARIFICATION": "Aclaración de Evolución",
    "CREATE_APPOINTMENT": "Nueva Cita Agendada",
    "UPDATE_APPOINTMENT": "Modificación de Cita",
    "DELETE_APPOINTMENT": "Eliminación de Cita",
    "UPDATE_HISTORY": "Modificación de Anamnesis",
    "VOID_PAYMENT": "Anulación de Pago",
    "VOID_CREDIT": "Anulación de Saldo a Favor"
  };
  return mapping[action] || action;
};

const getActionColor = (action) => {
  if (action?.startsWith("CREATE")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (action?.startsWith("UPDATE")) return "bg-sky-50 text-sky-700 border-sky-100";
  if (action?.startsWith("DELETE") || action?.startsWith("VOID")) return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-slate-50 text-slate-700 border-slate-100";
};

const formatTimestamp = (ts) => {
  if (!ts) return "—";
  let date;
  if (ts.toDate) {
    date = ts.toDate();
  } else if (ts.seconds) {
    date = new Date(ts.seconds * 1000);
  } else {
    date = new Date(ts);
  }
  return date.toLocaleString();
};

const renderDetails = (log) => {
  const { action, details } = log;
  if (!details) return "—";
  
  switch (action) {
    case "CREATE_PATIENT":
    case "UPDATE_PATIENT":
    case "DELETE_PATIENT":
      return `Paciente: ${details.nombre || "—"} (${details.documento || "—"})${details.parcial ? ' [Cambio parcial]' : ''}`;
    case "CREATE_EVOLUTION":
      return `Evolución: "${details.content?.substring(0, 60)}${details.content?.length > 60 ? '...' : ''}"`;
    case "ADD_EVOLUTION_CLARIFICATION":
      return `Nota aclaratoria: "${details.note?.substring(0, 60)}${details.note?.length > 60 ? '...' : ''}"`;
    case "CREATE_APPOINTMENT":
    case "UPDATE_APPOINTMENT":
      return `Cita para el ${details.fecha || "—"} a las ${details.horaInicio || "—"} con Dr(a). ${details.doctor || "—"}${details.status ? ` [Estado: ${details.status}]` : ""}`;
    case "DELETE_APPOINTMENT":
      return `Cita eliminada del ${details.fecha || "—"} a las ${details.horaInicio || "—"}`;
    case "UPDATE_HISTORY":
      return `Diag: "${details.diagnostico || "—"}" | Motivo: "${details.motivo || "—"}"`;
    case "VOID_PAYMENT":
    case "VOID_CREDIT":
      return `Concepto: ${details.concepto || "—"} | Monto: $${(details.monto || 0).toLocaleString()} | Motivo: "${details.motivoAnulacion || "—"}"`;
    default:
      return JSON.stringify(details);
  }
};

export default function ReporteSistema() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("usuarios"); // "usuarios" or "auditoria"
  
  // State for user accounts
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    activos: 0
  });

  // State for audit logs
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // 1. Fetch User Accounts
  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        const q = query(collection(db, "usuarios"), where("inquilino", "==", userProfile.inquilino));
        const snapshot = await getDocs(q);
        
        const data = [];
        let admins = 0;
        let activos = 0;

        snapshot.forEach(doc => {
          const u = { id: doc.id, ...doc.data() };
          data.push(u);

          const rol = (u.rol || "").toLowerCase();
          if (rol === "admin" || rol === "superadmin") {
               admins++;
          }
          if (u.estado !== "inactivo") {
               activos++;
          }
        });

        setUsuarios(data);
        setStats({
          total: data.length,
          admins,
          activos
        });
      } catch (error) {
        console.error("Error fetching usuarios:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile?.inquilino) {
        fetchData();
    }
  }, [userProfile?.inquilino]);

  // 2. Fetch Audit Logs (On-demand when clicking the tab)
  useEffect(() => {
    const fetchLogs = async () => {
      if (!userProfile?.inquilino || activeTab !== "auditoria") return;
      setLoadingLogs(true);
      try {
        let snapshot;
        try {
          // Standard optimized query
          const qLogs = query(
            collection(db, "audit_logs"),
            where("tenantId", "==", userProfile.inquilino),
            orderBy("timestamp", "desc"),
            limit(150)
          );
          snapshot = await getDocs(qLogs);
        } catch (err) {
          console.warn("Firestore index not ready for audit_logs query. Querying without orderBy...", err);
          const qFallback = query(
            collection(db, "audit_logs"),
            where("tenantId", "==", userProfile.inquilino),
            limit(200)
          );
          snapshot = await getDocs(qFallback);
        }

        const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Ensure accurate client-side ordering (fallback safety)
        logsData.sort((a, b) => {
          const timeA = a.timestamp?.seconds || a.timestamp?.toDate?.()?.getTime() || 0;
          const timeB = b.timestamp?.seconds || b.timestamp?.toDate?.()?.getTime() || 0;
          return timeB - timeA;
        });

        setLogs(logsData);
      } catch (error) {
        console.error("Error fetching audit logs:", error);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [userProfile?.inquilino, activeTab]);

  // Filters
  const filteredUsers = usuarios.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (u.nombre && u.nombre.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.rol && u.rol.toLowerCase().includes(term))
    );
  });

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const actionFriendly = translateAction(log.action).toLowerCase();
    const dateStr = formatTimestamp(log.timestamp).toLowerCase();
    const performer = (log.performedBy?.name || "sistema").toLowerCase();
    const detailsStr = renderDetails(log).toLowerCase();
    const deviceStr = (log.deviceInfo || "").toLowerCase();
    
    return (
      performer.includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      actionFriendly.includes(term) ||
      detailsStr.includes(term) ||
      dateStr.includes(term) ||
      deviceStr.includes(term)
    );
  });

  // Export CSV
  const handleExportCSV = () => {
    let headers = "";
    let rows = [];

    if (activeTab === "usuarios") {
      headers = "Nombre,Email,Rol,Estado";
      filteredUsers.forEach(u => {
        rows.push([
          u.nombre || 'Sin Nombre',
          u.email || '—',
          u.rol || 'Usuario',
          u.estado === 'inactivo' ? 'Inactivo' : 'Activo'
        ]);
      });
    } else {
      headers = "Fecha,Usuario,Rol,Accion,Detalles,Dispositivo";
      filteredLogs.forEach(l => {
        rows.push([
          formatTimestamp(l.timestamp),
          l.performedBy?.name || "Sistema",
          l.performedBy?.role || "usuario",
          translateAction(l.action),
          renderDetails(l),
          l.deviceInfo || ""
        ]);
      });
    }

    const csvContent = [
      headers,
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", activeTab === "usuarios" ? "directorio_personal.csv" : "bitacora_auditoria.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header and Actions */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shrink-0 mb-6 mx-2 mt-2">
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-[24px] border border-slate-100 self-start">
          <div className="px-6 font-black text-slate-400 uppercase tracking-widest text-[11px]">
            Logs de Plataforma y Aforo
          </div>
        </div>
        
        {/* Tab Selector */}
        <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200 self-center">
          <button
            onClick={() => { setActiveTab("usuarios"); setSearchTerm(""); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === "usuarios"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FiUserCheck size={13} />
            <span>Acceso y Personal</span>
          </button>
          <button
            onClick={() => { setActiveTab("auditoria"); setSearchTerm(""); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === "auditoria"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FiClock size={13} />
            <span>Bitácora de Auditoría</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder={activeTab === "usuarios" ? "Buscar personal..." : "Buscar en bitácora..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-11 pr-4 rounded-full border border-slate-200 text-[12px] outline-none w-[240px] bg-slate-50 text-slate-700 focus:bg-white focus:border-indigo-500 transition-all font-bold placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-800 text-white hover:bg-slate-700 font-black text-[11px] uppercase tracking-[0.1em] transition-all shadow-lg shadow-slate-200"
          >
            <FiDownload size={16} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-20">
        
        {activeTab === "usuarios" ? (
          /* TAB 1: USER ACCOUNTS DIRECTORY */
          loading ? (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400">
               <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
               <div className="text-[13px] font-bold">Cargando personal de sistema...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatBox 
                  title="Usuarios Registrados" 
                  value={stats.total} 
                  icon={FiUserCheck} 
                  color="text-indigo-600" 
                  bg="bg-indigo-50" 
                />
                <StatBox 
                  title="Cuentas Activas" 
                  value={stats.activos} 
                  icon={FiCpu} 
                  color="text-emerald-600" 
                  bg="bg-emerald-50" 
                />
                <StatBox 
                  title="Privilegios Admin" 
                  value={stats.admins} 
                  icon={FiShield} 
                  color="text-purple-600" 
                  bg="bg-purple-50" 
                />
              </div>

              {/* User Accounts Table */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                     Directorio de Acceso al Sistema
                     <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{filteredUsers.length} Cuentas</span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Usuario</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Email (ID)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Rol de Acceso</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 border-b border-slate-50">
                            <div className="font-bold text-slate-800 text-[13px]">{u.nombre || "Sin Nombre"}</div>
                            {u.telefono && <div className="text-[10px] font-medium text-slate-400 mt-1">{u.telefono}</div>}
                          </td>
                          <td className="px-6 py-4 border-b border-slate-50">
                            <div className="font-semibold text-slate-600 text-[12px]">{u.email || "—"}</div>
                          </td>
                          <td className="px-6 py-4 border-b border-slate-50 text-center">
                             <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                                {u.rol || "Usuario"}
                             </span>
                          </td>
                          <td className="px-6 py-4 border-b border-slate-50 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                u.estado === "inactivo"
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            }`}>
                                {u.estado === "inactivo" ? "Inactivo" : "Activa"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-6 py-10 text-center text-[12px] text-slate-400 font-bold">
                            No se encontraron usuarios
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        ) : (
          /* TAB 2: AUDIT LOGS BITACORA */
          loadingLogs ? (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400">
               <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
               <div className="text-[13px] font-bold">Consultando bitácora de auditoría inmutable...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bitacora Table Box */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                     Bitácora del Sistema
                     <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{filteredLogs.length} Eventos</span>
                  </h3>
                  <div className="text-[10px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-100 flex items-center gap-1.5 animate-pulse">
                     <FiShield size={12} />
                     <span>Auditoría Legal Activa (Libro Inmutable)</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Fecha y Hora</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Usuario / Operador</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Acción</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Detalles de Operación</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Dispositivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 border-b border-slate-50 whitespace-nowrap">
                            <div className="font-bold text-slate-800 text-[11px]">{formatTimestamp(log.timestamp)}</div>
                          </td>
                          <td className="px-6 py-4 border-b border-slate-50 whitespace-nowrap">
                            <div className="font-bold text-slate-800 text-[12px]">{log.performedBy?.name || "Sistema"}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{log.performedBy?.role || "usuario"}</div>
                          </td>
                          <td className="px-6 py-4 border-b border-slate-50 text-center whitespace-nowrap">
                            <span className={`inline-block px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getActionColor(log.action)}`}>
                              {translateAction(log.action)}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-b border-slate-50 max-w-xs md:max-w-md">
                            <div className="text-[12px] text-slate-600 font-semibold leading-relaxed">
                              {renderDetails(log)}
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-slate-50 max-w-[120px] truncate">
                            <div className="text-[10px] text-slate-400 font-medium truncate" title={log.deviceInfo}>
                              {log.deviceInfo || "—"}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-[12px] text-slate-400 font-bold">
                            No se registraron logs de auditoría para este inquilino
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
