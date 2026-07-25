import React, { useState, useMemo, useEffect } from "react";
import { FiCalendar, FiBox, FiCheckCircle, FiSearch, FiPlus, FiEye, FiTrash2, FiArrowLeft } from "react-icons/fi";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
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
      const snap = await getDocs(query(collection(db, "ordenes_compra"), where("inquilino", "==", inquilino)));
      const list = snap.docs.map((doc, index) => ({
        id: doc.id,
        consecutivo: index + 1,
        ...doc.data()
      }));
      list.sort((a, b) => b.fechaCreacion?.localeCompare(a.fechaCreacion));
      setOrders(list);
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
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "ordenes_compra"), orderData);

      // 2. Add movement log
      const mov = {
        inquilino,
        itemId: selectedItem.id,
        itemNombre: selectedItem.nombre,
        tipo: "Recepción",
        cantidad: qty,
        fecha: fechaRecepcion,
        notas: `Orden Compra: ${notas} (Proveedor: ${tercero})`,
        responsable: userProfile?.nombre || "Administrador",
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "registro_movimientos_inventario"), mov);

      // 3. Update product stock count
      const currentStock = parseFloat(selectedItem.cantidad || 0);
      const newStock = currentStock + qty;
      await updateDoc(doc(db, "inventario", selectedItem.id), {
        cantidad: newStock,
        lote: lote || selectedItem.lote || "",
        vencimiento: vencimiento || selectedItem.vencimiento || "",
        actualizado: new Date()
      });

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
      await deleteDoc(doc(db, "ordenes_compra", id));
      toast.success("Registro de orden de compra eliminado");
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (e) {
      console.error("Error deleting order:", e);
      toast.error("Error al eliminar el registro");
    }
  };

  if (view === "list") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Toolbar */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative w-full max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar orden de compra..."
              className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
              value={searchOrderQuery}
              onChange={e => setSearchOrderQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setView("new")}
            className="h-10 px-6 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 shrink-0"
          >
            <FiPlus className="mr-1.5" size={14} />
            Nueva recepción
          </button>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Órdenes de compra</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="px-8 py-4 w-28 text-center">Documento</th>
                  <th className="px-6 py-4">Fecha de creación</th>
                  <th className="px-6 py-4">Fecha de recepción</th>
                  <th className="px-6 py-4">Tercero</th>
                  <th className="px-6 py-4 text-center pr-8 w-36">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                {loadingOrders ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-20 text-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-20 text-center text-slate-400 italic">
                      No se encontraron órdenes de compra registradas.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-4 text-center font-bold text-slate-500 font-mono">{order.consecutivo}</td>
                      <td className="px-6 py-4 font-semibold text-slate-500 font-mono">{order.fechaCreacion}</td>
                      <td className="px-6 py-4 font-semibold text-slate-500 font-mono">{order.fechaRecepcion}</td>
                      <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tight">{order.tercero}</td>
                      <td className="px-6 py-4 text-center pr-8">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setActiveOrderDetail(order);
                              setShowDetailModal(true);
                            }}
                            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm"
                            title="Ver detalles"
                          >
                            <FiEye size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all shadow-sm"
                            title="Eliminar"
                          >
                            <FiTrash2 size={13} />
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Detalle de Orden de Compra #{activeOrderDetail.consecutivo}
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-xs font-black text-slate-400 hover:text-slate-600"
                >
                  Cerrar
                </button>
              </div>
              <div className="p-8 space-y-4 text-xs font-bold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Producto:</span>
                  <span className="text-slate-800 uppercase">{activeOrderDetail.itemNombre}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Cantidad:</span>
                  <span className="text-blue-600 font-mono">{activeOrderDetail.cantidad} unidades</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Tercero / Proveedor:</span>
                  <span className="text-slate-800 uppercase">{activeOrderDetail.tercero}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Lote:</span>
                  <span className="text-slate-700 font-mono">{activeOrderDetail.lote || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Vencimiento:</span>
                  <span className="text-slate-700 font-mono">{activeOrderDetail.vencimiento || "—"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Notas / Observaciones:</span>
                  <p className="text-slate-700 font-semibold bg-slate-50 p-3 rounded-lg mt-1 whitespace-pre-line leading-relaxed">
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
    <div className="max-w-xl mx-auto animate-in fade-in duration-500 space-y-6">
      <button 
        onClick={() => setView("list")}
        className="h-10 px-5 rounded-full border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2"
      >
        <FiArrowLeft size={14} />
        Volver a la lista
      </button>

      <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
        <div className="border-b border-slate-50 pb-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Nueva recepción</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Registrar ingreso de orden de compra / proveedor</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Autocomplete Select Product */}
          <div className="flex flex-col gap-2 relative" onClick={e => e.stopPropagation()}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Producto *</label>
            {selectedItem ? (
              <div className="flex items-center gap-3 w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50 text-sm font-bold text-slate-700">
                <FiBox className="text-blue-500 shrink-0" />
                <span className="flex-1 truncate uppercase">
                  {selectedItem.nombre} {selectedItem.marca ? `(${selectedItem.marca})` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItem(null);
                    setSearchQuery("");
                  }}
                  className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-wider bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escriba nombre del producto..."
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-50">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400 italic">No se encontraron productos</div>
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
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                        >
                          <span className="text-xs font-black text-slate-800 uppercase">
                            {p.nombre}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            MARCA: {p.marca || "—"} | STOCK: {p.cantidad} {p.unidad}
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
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tercero / Proveedor *</label>
            <input
              type="text"
              required
              placeholder="Ej: FARMACIA NATURAL N.1"
              className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
              value={tercero}
              onChange={e => setTercero(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fecha Creación */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Creación *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                />
                <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Fecha Recepción */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Recepción *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                  value={fechaRecepcion}
                  onChange={e => setFechaRecepcion(e.target.value)}
                />
                <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Cantidad */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad a Ingresar *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Ej: 10"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
              />
            </div>

            {/* Lote */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de Lote</label>
              <input
                type="text"
                placeholder="Lote de fabricación"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={lote}
                onChange={e => setLote(e.target.value)}
              />
            </div>

            {/* Fecha Vencimiento */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Vencimiento</label>
              <input
                type="date"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={vencimiento}
                onChange={e => setVencimiento(e.target.value)}
              />
            </div>
          </div>

          {/* Notas */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas / Observaciones</label>
            <textarea
              rows="3"
              placeholder="Notas sobre el ingreso..."
              className="w-full p-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all resize-none"
              value={notas}
              onChange={e => setNotas(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !selectedItem}
            className="w-full h-11 bg-[#8cc33f] hover:bg-[#7db02b] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <FiCheckCircle size={15} />
            {saving ? "Registrando..." : "Registrar Recepción"}
          </button>
        </form>
      </div>
    </div>
  );
}
