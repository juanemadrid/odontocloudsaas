import React, { useState, useMemo, useEffect } from "react";
import { FiCalendar, FiBox, FiAlertTriangle } from "react-icons/fi";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

export default function AjustesInventario({ items, onLoadRequired }) {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";

  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [tipoAjuste, setTipoAjuste] = useState("ingreso"); // ingreso, retiro, reemplazo
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (isNaN(qty) || qty < 0) {
      toast.error("Ingrese una cantidad válida mayor o igual a 0.");
      return;
    }
    if (!motivo.trim()) {
      toast.error("El motivo de ajuste es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const currentStock = parseFloat(selectedItem.cantidad || 0);
      let newStock = currentStock;
      let deltaQty = qty;

      if (tipoAjuste === "ingreso") {
        newStock = currentStock + qty;
      } else if (tipoAjuste === "retiro") {
        newStock = Math.max(0, currentStock - qty);
        deltaQty = -qty;
      } else if (tipoAjuste === "reemplazo") {
        newStock = qty;
        deltaQty = qty - currentStock;
      }

      // 1. Add movement log
      const mov = {
        inquilino,
        itemId: selectedItem.id,
        itemNombre: selectedItem.nombre,
        tipo: "Ajuste",
        cantidad: deltaQty,
        fecha,
        notas: `Ajuste (${tipoAjuste}): ${motivo}`,
        responsable: userProfile?.nombre || "Administrador",
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "registro_movimientos_inventario"), mov);

      // 2. Update product stock count
      await updateDoc(doc(db, "inventario", selectedItem.id), {
        cantidad: newStock,
        actualizado: new Date()
      });

      toast.success(`Ajuste de inventario aplicado con éxito. Nuevo stock: ${newStock}`);
      
      // Reset form
      setSelectedItem(null);
      setSearchQuery("");
      setCantidad("");
      setMotivo("");
      
      if (onLoadRequired) onLoadRequired();
    } catch (err) {
      console.error("Error setting product adjustment:", err);
      toast.error("Error al aplicar el ajuste de stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
        <div className="border-b border-slate-50 pb-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Ajuste manual de inventario</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Corrección de stock por conteo físico o mermas</p>
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
                            MARCA: {p.marca || "—"} | STOCK ACTUAL: {p.cantidad} {p.unidad}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tipo de Ajuste */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Ajuste *</label>
            <select
              required
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
              value={tipoAjuste}
              onChange={e => setTipoAjuste(e.target.value)}
            >
              <option value="ingreso">SUMAR AL STOCK EXISTENTE</option>
              <option value="retiro">RESTAR DEL STOCK EXISTENTE</option>
              <option value="reemplazo">REEMPLAZAR CON VALOR EXACTO (FISICO CONTEO)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fecha */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Ajuste *</label>
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

            {/* Cantidad */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {tipoAjuste === "reemplazo" ? "Nuevo Stock Físico *" : "Cantidad a Ajustar *"}
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Ej: 5"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
              />
            </div>
          </div>

          {/* Motivo de Salida */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo del Ajuste *</label>
            <textarea
              rows="3"
              required
              placeholder="Detalle los motivos del ajuste físico (ej: Auditoría física de inventario julio 2026)..."
              className="w-full p-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all resize-none"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !selectedItem}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <FiAlertTriangle size={15} />
            {saving ? "Procesando..." : "Aplicar Ajuste Físico"}
          </button>
        </form>
      </div>
    </div>
  );
}
