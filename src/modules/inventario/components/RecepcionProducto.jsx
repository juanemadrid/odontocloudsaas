import React, { useState, useMemo, useEffect } from "react";
import { FiCalendar, FiBox, FiCheckCircle, FiSearch, FiPlus, FiEye, FiTrash2, FiArrowLeft } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

export default function RecepcionProducto({ items, onLoadRequired }) {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";

  // View state: 'list' or 'new'
  const [view, setView] = useState("list");
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [searchOrderQuery, setSearchOrderQuery] = useState("");

  // Form states
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fechaRecepcion, setFechaRecepcion] = useState(new Date().toISOString().split("T")[0]);
  const [cantidad, setCantidad] = useState("");
  const [lote, setLote] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [notas, setNotas] = useState("");
  const [tercero, setTercero] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeOrderDetail, setActiveOrderDetail] = useState(null);

  // Load Purchase Orders
  const loadOrders = async () => {
    if (!inquilino) return;
    setLoadingOrders(true);
    try {
      const { data: list } = await supabase
        .from("ordenes_compra")
        .select("*")
        .eq("tenant_id", inquilino)
        .order("created_at", { ascending: false });
      setOrders((list || []).map((doc, index) => ({
        id: doc.id,
        consecutivo: index + 1,
        ...doc
      })));
    } catch (e) {
      console.error("Error loading purchase orders:", e);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [inquilino]);

  // Filter purchase orders
  const filteredOrders = useMemo(() => {
    const q = searchOrderQuery.toLowerCase();
    return orders.filter(o => 
      String(o.consecutivo).includes(q) ||
      (o.tercero || "").toLowerCase().includes(q) ||
      (o.itemNombre || "").toLowerCase().includes(q)
    );
  }, [orders, searchOrderQuery]);

  // Filter items for searchable combobox
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return items.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return items.filter(i => (i.nombre || "").toLowerCase().includes(q) || (i.referencia || "").toLowerCase().includes(q));
  }, [items, searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClose = () => setShowDropdown(false);
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!selectedItem) {
      toast.error("Seleccione un producto.");
      return;
    }
    const qty = parseFloat(cantidad);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Ingrese una cantidad válida mayor a 0.");
      return;
    }
    if (!tercero.trim()) {
      toast.error("Debe ingresar el Tercero / Proveedor.");
      return;
    }

    setSaving(true);
    try {
      const timestampStr = new Date().toLocaleTimeString("es-CO", { hour: '2-digit', minute: '2-digit' });
      const fechaCreacionFormatted = `${fecha} ${timestampStr}`;
      const fechaRecepFormatted = `${fechaRecepcion} 07:00 PM`; // Match OralDrive style time

      // 1. Create Purchase Order document
      const orderData = {
        tenant_id: inquilino,
        inquilino,
        itemId: selectedItem.id,
        itemNombre: selectedItem.nombre,
        cantidad: qty,
        tercero: tercero.toUpperCase(),
        fechaCreacion: fechaCreacionFormatted,
        fechaRecepcion: fechaRecepFormatted,
        lote,
        vencimiento,
        notas,
        responsable: userProfile?.nombre || "Administrador",
        created_at: new Date().toISOString()
      };
      await supabase.from("ordenes_compra").insert([orderData]);

      // 2. Add movement log
      const mov = {
        tenant_id: inquilino,
        inquilino,
        itemId: selectedItem.id,
        itemNombre: selectedItem.nombre,
        tipo: "Recepción",
        cantidad: qty,
        fecha: fechaRecepcion,
        notas: `Orden Compra: ${notas} (Proveedor: ${tercero})`,
        responsable: userProfile?.nombre || "Administrador",
        created_at: new Date().toISOString()
      };
      await supabase.from("registro_movimientos_inventario").insert([mov]);

      // 3. Update product stock count
      const currentStock = parseFloat(selectedItem.cantidad || 0);
      const newStock = currentStock + qty;
      await supabase.from("inventario").update({
        cantidad: newStock,
        lote: lote || selectedItem.lote || "",
        vencimiento: vencimiento || selectedItem.vencimiento || "",
        updated_at: new Date().toISOString()
      }).eq("id", selectedItem.id);

      toast.success(`Orden registrada e ingresada: +${qty} ${selectedItem.unidad || "unidades"}`);
      
      // Reset form
      setSelectedItem(null);
      setSearchQuery("");
      setCantidad("");
      setLote("");
      setVencimiento("");
      setNotas("");
      setTercero("");
      
      setView("list");
      loadOrders();
      if (onLoadRequired) onLoadRequired();
    } catch (err) {
      console.error("Error logging product reception:", err);
      toast.error("Error al registrar la orden de compra");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este registro de orden de compra?")) return;
    try {
      await supabase.from("ordenes_compra").delete().eq("id", id);
      toast.success("Registro de orden de compra eliminado");
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (e) {
      console.error("Error deleting order:", e);
      toast.error("Error al eliminar el registro");
    }
  };

  if (view === "list") {
    return (
      <div className="space-y-4 animate-in fade-in duration-300 font-sans text-slate-800">
        {/* Toolbar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input 
              type="text" 
              placeholder="Buscar orden de compra..."
              className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              value={searchOrderQuery}
              onChange={e => setSearchOrderQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setView("new")}
            className="h-8 px-3.5 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer gap-1.5"
          >
            <FiPlus size={13} />
            Nueva recepción
          </button>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Órdenes de compra</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                  <th className="py-2.5 px-3 w-24 text-center">Documento</th>
                  <th className="py-2.5 px-3">Fecha creación</th>
                  <th className="py-2.5 px-3">Fecha recepción</th>
                  <th className="py-2.5 px-3">Tercero</th>
                  <th className="py-2.5 px-3 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loadingOrders ? (
                  <tr>
                    <td colSpan="5" className="py-16 text-center">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-16 text-center text-slate-400 italic text-xs">
                      No se encontraron órdenes de compra registradas.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 font-mono">{order.consecutivo}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{order.fechaCreacion}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{order.fechaRecepcion}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{order.tercero}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setActiveOrderDetail(order);
                              setShowDetailModal(true);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                            title="Ver detalles"
                          >
                            <FiEye size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                            title="Eliminar"
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {showDetailModal && activeOrderDetail && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[1000] animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800">
                  Detalle Orden #{activeOrderDetail.consecutivo}
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
              <div className="p-4 space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-medium">Producto:</span>
                  <span className="text-slate-800 font-bold">{activeOrderDetail.itemNombre}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-medium">Cantidad:</span>
                  <span className="text-emerald-600 font-mono font-bold">{activeOrderDetail.cantidad} unidades</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-medium">Tercero / Proveedor:</span>
                  <span className="text-slate-800 font-bold">{activeOrderDetail.tercero}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-medium">Lote:</span>
                  <span className="text-slate-700 font-mono">{activeOrderDetail.lote || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-medium">Vencimiento:</span>
                  <span className="text-slate-700 font-mono">{activeOrderDetail.vencimiento || "—"}</span>
                </div>
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-slate-400 font-medium">Notas / Observaciones:</span>
                  <p className="text-slate-700 font-normal bg-slate-50 p-2.5 rounded-lg whitespace-pre-line border border-slate-100">
                    {activeOrderDetail.notas || "Sin observaciones."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-in fade-in duration-300 space-y-4 font-sans text-slate-800">
      <button 
        onClick={() => setView("list")}
        className="h-8 px-3.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <FiArrowLeft size={13} />
        Volver a la lista
      </button>

      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800">Nueva recepción</h3>
          <p className="text-xs text-slate-500 font-normal mt-0.5">Registrar ingreso de orden de compra / proveedor</p>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Autocomplete Select Product */}
          <div className="flex flex-col gap-1 relative" onClick={e => e.stopPropagation()}>
            <label className="text-[11px] font-semibold text-slate-600">Producto *</label>
            {selectedItem ? (
              <div className="flex items-center gap-2.5 w-full h-8 px-3 border border-slate-200 rounded-lg bg-slate-50 text-xs font-medium text-slate-700">
                <FiBox className="text-emerald-600 shrink-0" size={13} />
                <span className="flex-1 truncate">
                  {selectedItem.nombre} {selectedItem.marca ? `(${selectedItem.marca})` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItem(null);
                    setSearchQuery("");
                  }}
                  className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 border border-slate-200 px-2 py-0.5 rounded bg-white cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escriba nombre del producto..."
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400 italic">No se encontraron productos</div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedItem(p);
                            setSearchQuery("");
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col cursor-pointer"
                        >
                          <span className="text-xs font-bold text-slate-800">
                            {p.nombre}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Marca: {p.marca || "—"} | Stock: {p.cantidad} {p.unidad}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tercero / Proveedor */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600">Tercero / Proveedor *</label>
            <input
              type="text"
              required
              placeholder="Ej: Farmacia Central"
              className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              value={tercero}
              onChange={e => setTercero(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Fecha Creación */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Fecha creación *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full h-8 px-3 pl-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  max="9999-12-31" min="1900-01-01" 
                />
                <FiCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              </div>
            </div>

            {/* Fecha Recepción */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Fecha recepción *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full h-8 px-3 pl-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                  value={fechaRecepcion}
                  onChange={e => setFechaRecepcion(e.target.value)}
                  max="9999-12-31" min="1900-01-01" 
                />
                <FiCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              </div>
            </div>

            {/* Cantidad */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Cantidad a ingresar *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Ej: 10"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
              />
            </div>

            {/* Lote */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Número de lote</label>
              <input
                type="text"
                placeholder="Lote de fabricación"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={lote}
                onChange={e => setLote(e.target.value)}
              />
            </div>

            {/* Fecha Vencimiento */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-600">Fecha vencimiento</label>
              <input
                type="date"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={vencimiento}
                onChange={e => setVencimiento(e.target.value)}
                max="9999-12-31" min="1900-01-01" 
              />
            </div>
          </div>

          {/* Notas */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600">Notas / Observaciones</label>
            <textarea
              rows="2"
              placeholder="Notas sobre el ingreso..."
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors resize-none"
              value={notas}
              onChange={e => setNotas(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || !selectedItem}
              className="w-full h-8 bg-[#7cb342] hover:bg-[#689f38] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FiCheckCircle size={13} />
              {saving ? "Registrando..." : "Registrar Recepción"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
