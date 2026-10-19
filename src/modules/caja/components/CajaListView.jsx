import React from "react";
import { FiSearch, FiBriefcase, FiEye, FiXSquare, FiDollarSign } from "react-icons/fi";
const fmt = (n) => {
  const num = Number(n || 0);
  const isNeg = num < 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString("es-CO", {
    minimumFractionDigits: abs % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return isNeg ? `-$${formatted}` : `$${formatted}`;
};

const fmtDate = (ts) => {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch { return "—"; }
};


export default function CajaListView({ activeMenu, search, setSearch, loading, cajasFiltradas, userProfile, userId, userName, can, setSelectedCaja, setShowDetalle, setShowCerrar, setShowMovimiento }) {
  return (
            <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col min-h-0">

              {/* Toolbar */}
              <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white">
                <div className="text-[13px] font-bold text-slate-700">
                  {activeMenu === "cerradas" ? "Histórico de Cajas Cerradas" : "Listado de Cajas Abiertas"}
                </div>
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 pl-8 pr-3 rounded border border-slate-200 text-[12px] outline-none w-[180px] bg-white text-slate-700 focus:border-blue-400 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-[13px]">Cargando cajas...</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {activeMenu === "cerradas" ? (
                          <>
                            <th className="px-4 py-3 text-left">Caja</th>
                            <th className="px-4 py-3 text-left">Fecha apertura</th>
                            <th className="px-4 py-3 text-left">Fecha cierre</th>
                            <th className="px-4 py-3 text-left">Usuario cierra</th>
                            <th className="px-4 py-3 text-right">Ingresos</th>
                            <th className="px-4 py-3 text-right">Egresos</th>
                            <th className="px-4 py-3 text-right">Base Inicial</th>
                            <th className="px-4 py-3 text-right">Saldo</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 text-left">Caja</th>
                            <th className="px-4 py-3 text-left">Fecha apertura</th>
                            <th className="px-4 py-3 text-right">Base Inicial</th>
                            <th className="px-4 py-3 text-right">Ingresos</th>
                            <th className="px-4 py-3 text-right">Egresos</th>
                            <th className="px-4 py-3 text-right">Saldo actual</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cajasFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={activeMenu === "cerradas" ? 9 : 7} className="p-16 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400">
                              <FiBriefcase size={36} className="text-slate-200 mb-3" />
                              <p className="text-[13px] font-medium text-slate-500">
                                {activeMenu === "cerradas" ? "No hay cajas cerradas en el historial" : "No hay cajas abiertas registradas"}
                              </p>
                              {activeMenu === "abiertas" && (
                                <p className="text-[12px] text-slate-400 mt-1">
                                  Usa "Abrir caja" en el menú lateral para comenzar.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        cajasFiltradas.map((caja) => (
                          <tr
                            key={caja.id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Caja */}
                            <td className="px-4 py-3.5 align-middle">
                              <div className="font-bold text-slate-800 uppercase">
                                {caja.usuarioNombre || caja.nombre || "—"}
                              </div>
                              {caja.nombre && caja.usuarioNombre && caja.nombre !== caja.usuarioNombre && (
                                <div className="text-[11px] text-slate-400 mt-0.5">{caja.nombre}</div>
                              )}
                            </td>

                            {/* Fecha apertura */}
                            <td className="px-4 py-3.5 align-middle text-slate-500 whitespace-nowrap">
                              {fmtDate(caja.fechaApertura || caja.created_at)}
                            </td>

                            {activeMenu === "cerradas" ? (
                              <>
                                {/* Fecha cierre */}
                                <td className="px-4 py-3.5 align-middle text-slate-500 whitespace-nowrap">
                                  {fmtDate(caja.fecha_cierre || caja.fechaCierre || caja.updated_at)}
                                </td>
                                {/* Usuario cierra */}
                                <td className="px-4 py-3.5 align-middle font-medium text-slate-700 uppercase">
                                  {caja.cierradoPor || caja.usuarioNombre || "—"}
                                </td>
                                {/* Ingresos */}
                                <td className="px-4 py-3.5 align-middle text-right font-semibold text-emerald-600">
                                  {fmt(caja.totalIngresos || 0)}
                                </td>
                                {/* Egresos */}
                                <td className="px-4 py-3.5 align-middle text-right font-semibold text-rose-600">
                                  {fmt(caja.totalEgresos || 0)}
                                </td>
                                {/* Base Inicial */}
                                <td className="px-4 py-3.5 align-middle text-right text-slate-600 font-medium">
                                  {fmt(caja.baseInicial || 0)}
                                </td>
                                {/* Saldo */}
                                <td className="px-4 py-3.5 align-middle text-right font-bold text-blue-600">
                                  {fmt(caja.saldoActual || 0)}
                                </td>
                              </>
                            ) : (
                              <>
                                {/* Base Inicial */}
                                <td className="px-4 py-3.5 align-middle text-right text-slate-600 font-medium">
                                  {fmt(caja.baseInicial || 0)}
                                </td>
                                {/* Ingresos */}
                                <td className="px-4 py-3.5 align-middle text-right font-semibold text-emerald-600">
                                  {fmt(caja.totalIngresos || 0)}
                                </td>
                                {/* Egresos */}
                                <td className="px-4 py-3.5 align-middle text-right font-semibold text-rose-600">
                                  {fmt(caja.totalEgresos || 0)}
                                </td>
                                {/* Saldo actual */}
                                <td className="px-4 py-3.5 align-middle text-right font-bold text-blue-600">
                                  {fmt(caja.saldoActual || 0)}
                                </td>
                              </>
                            )}

                            {/* Acciones */}
                            <td className="px-4 py-3.5 align-middle text-center">
                              {(() => {
                                const rawRole = (userProfile?.rol || userProfile?.role || "").toLowerCase();
                                const isAdmin = rawRole.includes("admin") || rawRole.includes("superadmin");
                                const isOwner = caja.usuarioId === userId || caja.usuario_id === userId || (caja.usuarioNombre || "").toLowerCase() === userName.toLowerCase();
                                const canClose = caja.estado === "abierta" && can("Caja", "Cajas Abiertas", "editar") && (isAdmin || isOwner);
                                const canMove = caja.estado === "abierta" && can("Caja", "Cajas Abiertas", "crear") && (isAdmin || isOwner);

                                return (
                                  <div className="flex items-center justify-center gap-1.5">
                                    {/* Ver detalle - azul */}
                                    {can("Caja", "Cajas Abiertas", "consultar") && (
                                      <button
                                        onClick={() => { setSelectedCaja(caja); setShowDetalle(true); }}
                                        title="Ver detalle de movimientos"
                                        className="w-7 h-7 rounded bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                      >
                                        <FiEye size={13} />
                                      </button>
                                    )}
                                    {/* Cerrar caja - rojo */}
                                    {canClose && (
                                      <button
                                        onClick={() => { setSelectedCaja(caja); setShowCerrar(true); }}
                                        title="Cerrar caja"
                                        className="w-7 h-7 rounded bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                      >
                                        <FiXSquare size={13} />
                                      </button>
                                    )}
                                    {/* Movimiento - verde */}
                                    {canMove && (
                                      <button
                                        onClick={() => { setSelectedCaja(caja); setShowMovimiento(true); }}
                                        title="Registrar movimiento"
                                        className="w-7 h-7 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                      >
                                        <FiDollarSign size={13} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
  );
}
