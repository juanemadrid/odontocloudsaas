// Módulo de Inventario (Administración → Inventario).
// Productos: los mismos de Configuración → Lista de precios → Productos.
// Movimientos: entradas, salidas y ajustes; cada uno queda en el kardex y no se puede editar ni borrar.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowDownCircle, FiArrowUpCircle, FiSliders, FiSearch, FiRefreshCw, FiDownload, FiX, FiList, FiPackage, FiAlertTriangle, FiEdit2 } from "react-icons/fi";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { todayBogota, formatDateCO } from "../../utils/bogotaDate";
import {
  MOTIVOS, estadoStock, listarProductos, listarMovimientos, registrarMovimiento,
  listarProveedores, actualizarStockMinimo,
} from "../../services/inventarioService";

const money = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(v || 0));
const num = (v) => new Intl.NumberFormat("es-CO").format(Number(v || 0));
const fechaHora = (v) => v ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v)) : "—";

const TIPO_INFO = {
  entrada: { label: "Entrada", icon: FiArrowDownCircle, btn: "bg-emerald-600 hover:bg-emerald-700", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  salida: { label: "Salida", icon: FiArrowUpCircle, btn: "bg-rose-600 hover:bg-rose-700", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  ajuste: { label: "Ajuste", icon: FiSliders, btn: "bg-amber-500 hover:bg-amber-600", badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

const ESTADO_INFO = {
  ok: { label: "Disponible", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  bajo: { label: "Stock bajo", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  agotado: { label: "Agotado", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

const inputCls = "w-full h-9 px-3 border border-slate-300 rounded-lg text-[13px] text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1";

function primerDiaMes() {
  const t = todayBogota();
  return `${t.slice(0, 8)}01`;
}

export default function InventarioModule() {
  const { userProfile } = useAuth();
  const { can } = usePermissions();
  const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
  const isAdmin = String(userProfile?.role || userProfile?.rol || "").toLowerCase().includes("admin");
  const puedeMover = isAdmin || can("Administración", "Inventario", "crear");
  const puedeEditar = isAdmin || can("Administración", "Inventario", "editar");

  const [tab, setTab] = useState("existencias");
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modal, setModal] = useState(null);        // { tipo, producto }
  const [minimoModal, setMinimoModal] = useState(null);
  const [kardexProducto, setKardexProducto] = useState("");

  const cargarProductos = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setProductos(await listarProductos(tenantId));
    } catch (e) {
      toast.error("No se pudieron cargar los productos: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { cargarProductos(); }, [cargarProductos]);

  const resumen = useMemo(() => {
    let valor = 0, bajo = 0, agotado = 0;
    productos.forEach((p) => {
      valor += Number(p.cantidad || 0) * Number(p.precio_costo || 0);
      const e = estadoStock(p);
      if (e === "bajo") bajo++;
      if (e === "agotado") agotado++;
    });
    return { total: productos.length, valor, bajo, agotado };
  }, [productos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (filtroEstado && estadoStock(p) !== filtroEstado) return false;
      if (!q) return true;
      return [p.nombre, p.codigo, p.categoria].some((x) => String(x || "").toLowerCase().includes(q));
    });
  }, [productos, busqueda, filtroEstado]);

  const abrirKardex = (producto) => {
    setKardexProducto(producto?.id || "");
    setTab("kardex");
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-slate-800">Inventario de insumos</h2>
          <p className="text-[12px] text-slate-500">Los productos se crean en Configuración → Lista de precios → Productos.</p>
        </div>
        {puedeMover && (
          <div className="flex flex-wrap gap-2">
            {["entrada", "salida", "ajuste"].map((t) => {
              const I = TIPO_INFO[t];
              return (
                <button key={t} type="button" onClick={() => setModal({ tipo: t, producto: null })}
                  className={`h-9 px-3.5 rounded-lg text-white text-[12px] font-bold flex items-center gap-1.5 shadow-sm ${I.btn}`}>
                  <I.icon size={15} /> {I.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-slate-200">
        {[["existencias", "Existencias", FiPackage], ["kardex", "Kardex / movimientos", FiList]].map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`px-4 py-2 text-[12px] font-bold flex items-center gap-1.5 border-b-2 -mb-px ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "existencias" ? (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Resumen titulo="Productos" valor={num(resumen.total)} />
            <Resumen titulo="Valor del inventario" valor={money(resumen.valor)} nota="Stock × costo" />
            <Resumen titulo="Stock bajo" valor={num(resumen.bajo)} tono="amber" onClick={() => setFiltroEstado(filtroEstado === "bajo" ? "" : "bajo")} activo={filtroEstado === "bajo"} />
            <Resumen titulo="Agotados" valor={num(resumen.agotado)} tono="rose" onClick={() => setFiltroEstado(filtroEstado === "agotado" ? "" : "agotado")} activo={filtroEstado === "agotado"} />
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, código o categoría..." className={`${inputCls} pl-9`} />
            </div>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className={`${inputCls} sm:w-48`}>
              <option value="">Todos los estados</option>
              <option value="ok">Disponible</option>
              <option value="bajo">Stock bajo</option>
              <option value="agotado">Agotado</option>
            </select>
            <button type="button" onClick={cargarProductos} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-600 text-[12px] font-bold flex items-center gap-1.5 hover:bg-slate-50">
              <FiRefreshCw size={13} /> Actualizar
            </button>
          </div>

          {/* Tabla de existencias */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2.5">Código</th>
                  <th className="text-left px-3 py-2.5">Producto</th>
                  <th className="text-left px-3 py-2.5">Categoría</th>
                  <th className="text-right px-3 py-2.5">Stock</th>
                  <th className="text-right px-3 py-2.5">Mínimo</th>
                  <th className="text-center px-3 py-2.5">Estado</th>
                  <th className="text-right px-3 py-2.5">Costo unit.</th>
                  <th className="text-right px-3 py-2.5">Valor</th>
                  <th className="text-center px-3 py-2.5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-10 text-slate-400">Cargando...</td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-slate-400">
                    {productos.length === 0 ? "Aún no hay productos. Créalos en Configuración → Lista de precios → Productos." : "No hay productos con ese filtro."}
                  </td></tr>
                ) : filtrados.map((p) => {
                  const est = ESTADO_INFO[estadoStock(p)];
                  return (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 text-slate-500 font-mono">{p.codigo || "—"}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{p.nombre}</td>
                      <td className="px-3 py-2.5 text-slate-500">{p.categoria || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-800">{num(p.cantidad)} <span className="text-[10px] font-medium text-slate-400">{p.unidad || "UND"}</span></td>
                      <td className="px-3 py-2.5 text-right text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          {num(p.minimo_stock)}
                          {puedeEditar && (
                            <button type="button" title="Cambiar stock mínimo" onClick={() => setMinimoModal(p)} className="text-slate-400 hover:text-blue-600"><FiEdit2 size={11} /></button>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${est.cls}`}>{est.label}</span></td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{money(p.precio_costo)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700 font-semibold">{money(Number(p.cantidad || 0) * Number(p.precio_costo || 0))}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          {puedeMover && ["entrada", "salida", "ajuste"].map((t) => {
                            const I = TIPO_INFO[t];
                            return (
                              <button key={t} type="button" title={I.label} onClick={() => setModal({ tipo: t, producto: p })}
                                className={`w-7 h-7 rounded-md border flex items-center justify-center ${I.badge}`}><I.icon size={13} /></button>
                            );
                          })}
                          <button type="button" title="Ver kardex" onClick={() => abrirKardex(p)}
                            className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-500 flex items-center justify-center hover:text-blue-600"><FiList size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Kardex tenantId={tenantId} productos={productos} productoId={kardexProducto} setProductoId={setKardexProducto} />
      )}

      {modal && (
        <MovimientoModal
          tenantId={tenantId}
          tipo={modal.tipo}
          productoInicial={modal.producto}
          productos={productos}
          onClose={() => setModal(null)}
          onDone={async () => { setModal(null); await cargarProductos(); }}
        />
      )}
      {minimoModal && (
        <MinimoModal tenantId={tenantId} producto={minimoModal} onClose={() => setMinimoModal(null)}
          onDone={async () => { setMinimoModal(null); await cargarProductos(); }} />
      )}
    </div>
  );
}

function Resumen({ titulo, valor, nota, tono, onClick, activo }) {
  const color = tono === "amber" ? "text-amber-600" : tono === "rose" ? "text-rose-600" : "text-slate-800";
  return (
    <div onClick={onClick} className={`bg-white border rounded-xl p-3 ${onClick ? "cursor-pointer hover:border-blue-300" : ""} ${activo ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className={`text-[18px] font-bold ${color}`}>{valor}</p>
      {nota && <p className="text-[10px] text-slate-400">{nota}</p>}
    </div>
  );
}

function Kardex({ tenantId, productos, productoId, setProductoId }) {
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(todayBogota());
  const [tipo, setTipo] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const buscar = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setRows(await listarMovimientos(tenantId, { desde, hasta, productoId: productoId || undefined, tipo: tipo || undefined }));
    } catch (e) {
      toast.error("No se pudo cargar el kardex: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, desde, hasta, productoId, tipo]);

  useEffect(() => { buscar(); }, [buscar]);

  const exportar = () => {
    if (rows.length === 0) { toast.warning("No hay movimientos para exportar"); return; }
    const data = rows.map((m) => ({
      "Fecha": fechaHora(m.fecha),
      "Tipo": TIPO_INFO[m.tipo]?.label || m.tipo,
      "Motivo": m.motivo || "",
      "Código": m.producto_codigo || "",
      "Producto": m.producto_nombre,
      "Cantidad": m.cantidad,
      "Stock anterior": m.stock_anterior,
      "Stock nuevo": m.stock_nuevo,
      "Costo unitario": m.costo_unitario ?? "",
      "Lote": m.lote || "",
      "Vence": m.fecha_vencimiento ? formatDateCO(m.fecha_vencimiento) : "",
      "Proveedor": m.tercero_nombre || "",
      "Documento": m.documento || "",
      "Observaciones": m.observaciones || "",
      "Usuario": m.usuario_nombre || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kardex");
    XLSX.writeFile(wb, `kardex_inventario_${desde}_a_${hasta}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div><label className={labelCls}>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Producto</label>
          <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div><label className={labelCls}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
            <option value="ajuste">Ajustes</option>
          </select>
        </div>
        <button type="button" onClick={exportar} className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[12px] font-bold flex items-center justify-center gap-1.5">
          <FiDownload size={13} /> Exportar Excel
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5">Fecha</th>
              <th className="text-left px-3 py-2.5">Tipo</th>
              <th className="text-left px-3 py-2.5">Producto</th>
              <th className="text-right px-3 py-2.5">Cantidad</th>
              <th className="text-right px-3 py-2.5">Antes</th>
              <th className="text-right px-3 py-2.5">Después</th>
              <th className="text-left px-3 py-2.5">Detalle</th>
              <th className="text-left px-3 py-2.5">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400">No hay movimientos en este período.</td></tr>
            ) : rows.map((m) => {
              const I = TIPO_INFO[m.tipo] || TIPO_INFO.ajuste;
              const detalle = [m.motivo, m.tercero_nombre, m.documento && `Doc. ${m.documento}`, m.lote && `Lote ${m.lote}`,
                m.fecha_vencimiento && `Vence ${formatDateCO(m.fecha_vencimiento)}`, m.observaciones].filter(Boolean).join(" · ");
              return (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fechaHora(m.fecha)}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${I.badge}`}>{I.label}</span></td>
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{m.producto_nombre}</td>
                  <td className={`px-3 py-2.5 text-right font-bold ${m.cantidad >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{m.cantidad > 0 ? "+" : ""}{num(m.cantidad)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{num(m.stock_anterior)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{num(m.stock_nuevo)}</td>
                  <td className="px-3 py-2.5 text-slate-500">{detalle || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-500">{m.usuario_nombre || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovimientoModal({ tenantId, tipo, productoInicial, productos, onClose, onDone }) {
  const info = TIPO_INFO[tipo];
  const [productoId, setProductoId] = useState(productoInicial?.id || "");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS[tipo][0]);
  const [costo, setCosto] = useState("");
  const [lote, setLote] = useState("");
  const [vence, setVence] = useState("");
  const [terceroId, setTerceroId] = useState("");
  const [documento, setDocumento] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [proveedores, setProveedores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (tipo === "entrada" && tenantId) listarProveedores(tenantId).then(setProveedores).catch(() => setProveedores([]));
  }, [tipo, tenantId]);

  const producto = productos.find((p) => p.id === productoId);
  const actual = Number(producto?.cantidad || 0);
  const n = Math.floor(Number(cantidad));
  const valido = cantidad !== "" && Number.isFinite(n) && (tipo === "ajuste" ? n >= 0 : n > 0);
  const resultado = !producto || !valido ? null : tipo === "entrada" ? actual + n : tipo === "salida" ? actual - n : n;
  const error = resultado !== null && resultado < 0 ? `Solo hay ${num(actual)} en stock.` : (tipo === "ajuste" && resultado === actual ? "El conteo es igual al stock actual." : "");

  useEffect(() => {
    if (tipo === "entrada" && producto && costo === "" && Number(producto.precio_costo) > 0) setCosto(String(Number(producto.precio_costo)));
  }, [producto, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!producto || !valido || error || guardando) return;
    setGuardando(true);
    try {
      const prov = proveedores.find((p) => p.id === terceroId);
      await registrarMovimiento({
        productoId: producto.id, tipo, cantidad: n, motivo,
        costoUnitario: tipo === "entrada" ? costo : null,
        lote: tipo === "entrada" ? lote : null,
        fechaVencimiento: tipo === "entrada" ? vence : null,
        terceroId: prov?.id, terceroNombre: prov?.nombre,
        documento: tipo === "entrada" ? documento : null,
        observaciones,
      });
      toast.success(`${info.label} ${tipo === "ajuste" ? "registrado" : "registrada"}: ${producto.nombre} queda con ${num(resultado)}.`);
      await onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${info.badge}`}><info.icon size={16} /></div>
            <div>
              <h3 className="text-[14px] font-bold text-slate-800">Registrar {info.label.toLowerCase()}</h3>
              <p className="text-[11px] text-slate-500">
                {tipo === "entrada" ? "Mercancía que llega a la clínica." : tipo === "salida" ? "Insumos que se usan o se retiran." : "Corrige el stock con el conteo físico."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className={labelCls}>Producto *</label>
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className={inputCls}>
              <option value="">Seleccione...</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ""}</option>)}
            </select>
            {producto && <p className="text-[11px] text-slate-500 mt-1">Stock actual: <b>{num(actual)}</b> {producto.unidad || "UND"}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{tipo === "ajuste" ? "Conteo físico *" : "Cantidad *"}</label>
              <input type="number" min={tipo === "ajuste" ? 0 : 1} step={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Motivo</label>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls}>
                {MOTIVOS[tipo].map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {tipo === "entrada" && (
            <>
              <div>
                <label className={labelCls}>Proveedor</label>
                <select value={terceroId} onChange={(e) => setTerceroId(e.target.value)} className={inputCls}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.documento ? ` · ${p.documento}` : ""}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Los proveedores se crean en Administración → Terceros.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Costo unitario</label><input type="number" min={0} value={costo} onChange={(e) => setCosto(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>N° factura / remisión</label><input value={documento} onChange={(e) => setDocumento(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Lote</label><input value={lote} onChange={(e) => setLote(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Fecha de vencimiento</label><input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className={inputCls} /></div>
              </div>
            </>
          )}

          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={`${inputCls} h-auto py-2`} />
          </div>

          {resultado !== null && (
            <div className={`rounded-lg border px-3 py-2 text-[12px] flex items-center gap-2 ${error ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
              {error ? <><FiAlertTriangle /> {error}</> : <>Quedará en <b>{num(resultado)}</b> {producto.unidad || "UND"} (antes {num(actual)}).</>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-slate-300 text-slate-600 text-[12px] font-bold hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={guardar} disabled={!producto || !valido || !!error || guardando}
            className={`h-9 px-4 rounded-lg text-white text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed ${info.btn}`}>
            {guardando ? "Guardando..." : `Registrar ${info.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function MinimoModal({ tenantId, producto, onClose, onDone }) {
  const [valor, setValor] = useState(String(producto.minimo_stock ?? 0));
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    try {
      await actualizarStockMinimo(tenantId, producto.id, valor);
      toast.success("Stock mínimo actualizado");
      await onDone();
    } catch (e) {
      toast.error("No se pudo guardar: " + e.message);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-bold text-slate-800">Stock mínimo</h3>
        <p className="text-[12px] text-slate-500">{producto.nombre}: cuando el stock llegue a este número, el producto se marca como «Stock bajo».</p>
        <input type="number" min={0} step={1} value={valor} onChange={(e) => setValor(e.target.value)} className={inputCls} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-slate-300 text-slate-600 text-[12px] font-bold">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold disabled:opacity-50">Guardar</button>
        </div>
      </div>
    </div>
  );
}
